import { entries, type Entry } from '../data/entries';
import {
  BOARD_POSITION,
  BUILDINGS,
  GATE_POSITION,
  MAILBOX_POSITION,
  MAP_ASCII,
  MAP_HEIGHT,
  MAP_WIDTH,
  SPAWN_POSITION,
} from '../data/world';
import {
  ACHIEVEMENTS,
  getLevel,
  MAX_XP,
  type ProgressDelta,
  type ProgressState,
} from '../lib/progress';
import { createProgressStore, type ProgressStore } from '../lib/store';
import {
  getAdjacentInteractable,
  highlightedBuildings,
  isGateOpen,
  tryMove,
  type WorldState,
} from '../lib/world';
import type { LensId } from '../lib/lenses';

export interface GameOptions {
  /** Shared progress store. If omitted, a store backed by `storage` is created. */
  store?: ProgressStore;
  storage?: Storage | null;
  onAnnounce?: (message: string) => void;
  initialState?: Partial<WorldState>;
}

export interface GameHandle {
  getState(): WorldState;
  getProgress(): ProgressState;
  move(direction: string): void;
  interact(): void;
  closeDialog(): void;
  setSelectedClass(classId: LensId | 'all' | null): void;
  getSelectedClass(): LensId | 'all' | null;
  destroy(): void;
}

const TILE_SIZE = 32;
const CANVAS_WIDTH = MAP_WIDTH * TILE_SIZE; // 640px
const CANVAS_HEIGHT = MAP_HEIGHT * TILE_SIZE; // 448px
const REPEAT_DELAY_MS = 120;

// Retro palette
const C_DARKEST = '#0F380F';
const C_DARK = '#306230';
const C_LIGHT = '#8BAC0F';
const C_LIGHTEST = '#C4D68A';
const C_ACCENT = '#B3261E';

function getNextGoalText(xp: number): string {
  if (xp < 20) return `Next: Scout at 20 XP (+${20 - xp} XP)`;
  if (xp < 45) return `Next: Builder at 45 XP (+${45 - xp} XP)`;
  if (xp < 75) return `Next: Engineer at 75 XP (+${75 - xp} XP)`;
  if (xp < 100) return `Next: Gate opens at 100 XP (+${100 - xp} XP)`;
  return 'Gate open! Step through to finish.';
}

export function mountGame(container: HTMLElement, options: GameOptions = {}): GameHandle {
  const doc = container.ownerDocument;
  const win = doc.defaultView ?? window;
  const store =
    options.store ??
    createProgressStore({
      storage: options.storage !== undefined ? options.storage : win.localStorage,
    });
  const progress = (): ProgressState => store.getState();

  // Player position only. XP is never copied here; it is read from the store
  // whenever the world logic needs it (gate checks, movement).
  let playerPos: { x: number; y: number } = {
    x: options.initialState?.x ?? SPAWN_POSITION.x,
    y: options.initialState?.y ?? SPAWN_POSITION.y,
  };
  const worldState = (): WorldState => ({ ...playerPos, xp: progress().xp });

  let selectedClass: LensId | 'all' | null = null;
  let walkFrame = 0;
  let lastMoveTime = 0;
  let activeMoveKey: string | null = null;
  let repeatTimer: ReturnType<typeof setInterval> | null = null;
  let activeDialog: HTMLDialogElement | null = null;
  let lastFocusedElement: HTMLElement | null = null;
  let lastAnnouncedInteractable: string | null = null;

  // Build Game Shell
  const gameRoot = doc.createElement('section');
  gameRoot.className = 'game-screen-root';
  gameRoot.id = 'game-screen-root';
  gameRoot.setAttribute('aria-label', "Harshal's Campus Playable Game");

  // HUD
  const hud = doc.createElement('header');
  hud.className = 'cartridge-hud game-hud';
  hud.innerHTML = `
    <div class="hud-inner">
      <div class="hud-brand">
        <span class="hud-player">HARSHAL</span>
        <span class="hud-level-badge">LV: <strong id="game-hud-level">${getLevel(progress().xp)}</strong></span>
      </div>
      <div class="hud-progress-wrap">
        <div class="hud-label-row">
          <span class="hud-xp-label">XP</span>
          <span class="hud-xp-val" id="game-hud-xp-val">${progress().xp}/${MAX_XP}</span>
        </div>
        <div 
          class="hud-progressbar" 
          id="game-hud-progressbar"
          role="progressbar" 
          aria-label="Campus game progress" 
          aria-valuemin="0" 
          aria-valuemax="${MAX_XP}" 
          aria-valuenow="${progress().xp}"
        >
          <div class="hud-progressbar-fill" id="game-hud-progressbar-fill" style="width: ${(progress().xp / MAX_XP) * 100}%"></div>
        </div>
        <div class="hud-goal-line" id="game-hud-next-goal">${getNextGoalText(progress().xp)}</div>
      </div>
      <div class="hud-stats">
        <span class="hud-achievements" id="game-hud-trophies" title="Achievements unlocked">
          TROPHIES: <strong>${progress().achievements.length}/${ACHIEVEMENTS.length}</strong>
        </span>
        <button type="button" class="hud-btn" id="game-hud-new-game-btn">New Game</button>
      </div>
    </div>
  `;

  // HOW TO PLAY card (native <details>, open by default)
  const instructions = doc.createElement('details');
  instructions.className = 'game-instructions';
  instructions.open = true;
  instructions.innerHTML = `
    <summary class="instructions-title">HOW TO PLAY</summary>
    <ol class="instructions-list">
      <li><strong>1.</strong> Walk with arrow keys or WASD.</li>
      <li><strong>2.</strong> Stand next to a door and press E to enter.</li>
      <li><strong>3.</strong> Explore everything to reach 100 XP and open the gate.</li>
    </ol>
    <p class="instructions-note">Nothing is locked. Prefer reading? <button type="button" class="instructions-skip-btn" id="instructions-skip-link">Skip the game</button>.</p>
  `;

  // Canvas Wrapper
  const canvasWrap = doc.createElement('div');
  canvasWrap.className = 'game-canvas-wrap';

  const canvas = doc.createElement('canvas');
  canvas.id = 'game-canvas';
  canvas.className = 'game-canvas';
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute(
    'aria-label',
    "HARSHAL'S CAMPUS map. Top-down pixel view of 7 buildings, plaza with class board, mailbox, and the final gate. Use Arrow keys or WASD to move, and E to interact.",
  );
  canvasWrap.append(canvas);

  // Live region for game announcements
  const liveRegion = doc.createElement('div');
  liveRegion.className = 'game-aria-live sr-only';
  liveRegion.id = 'game-aria-live';
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('aria-atomic', 'true');

  // Touch Controls (D-pad + A + B)
  const touchControls = doc.createElement('div');
  touchControls.className = 'game-touch-controls';
  touchControls.innerHTML = `
    <div class="dpad-cluster" role="group" aria-label="Directional Controls">
      <button type="button" class="dpad-btn dpad-up" data-dir="up" aria-label="Move Up">▲</button>
      <div class="dpad-middle">
        <button type="button" class="dpad-btn dpad-left" data-dir="left" aria-label="Move Left">◀</button>
        <div class="dpad-center" aria-hidden="true"></div>
        <button type="button" class="dpad-btn dpad-right" data-dir="right" aria-label="Move Right">▶</button>
      </div>
      <button type="button" class="dpad-btn dpad-down" data-dir="down" aria-label="Move Down">▼</button>
    </div>
    <div class="action-buttons-cluster" role="group" aria-label="Action Buttons">
      <button type="button" class="action-btn action-b" id="game-btn-b" aria-label="Close">B</button>
      <button type="button" class="action-btn action-a" id="game-btn-a" aria-label="Interact">A</button>
    </div>
  `;

  // Native Dialogs Container
  const dialogsContainer = doc.createElement('div');
  dialogsContainer.className = 'game-dialogs-container';

  // Generic Building Dialog
  const buildingDialog = doc.createElement('dialog');
  buildingDialog.className = 'cartridge-dialog game-modal';
  buildingDialog.id = 'game-building-dialog';
  buildingDialog.innerHTML = `
    <div class="dialog-content">
      <header class="dialog-header">
        <h3 class="dialog-title" id="game-building-title">BUILDING</h3>
        <span class="dialog-role" id="game-building-role"></span>
        <span class="dialog-dates" id="game-building-dates"></span>
      </header>
      <div class="dialog-body">
        <p class="dialog-summary" id="game-building-summary"></p>
        <div class="dialog-tags" id="game-building-tags"></div>
        <p class="dialog-note" id="game-building-note" hidden></p>
      </div>
      <footer class="dialog-actions">
        <button type="button" class="hud-btn" id="game-building-close" value="close">Close (Esc)</button>
      </footer>
    </div>
  `;

  // Class Board Dialog
  const boardDialog = doc.createElement('dialog');
  boardDialog.className = 'cartridge-dialog game-modal';
  boardDialog.id = 'game-board-dialog';
  boardDialog.innerHTML = `
    <div class="dialog-content">
      <header class="dialog-header">
        <h3 class="dialog-title">CAMPUS CLASS BOARD</h3>
        <p class="dialog-desc">Select a class to highlight matching campus facilities (+5 XP each):</p>
      </header>
      <div class="dialog-class-picker">
        <button type="button" class="hud-btn class-pick-btn" data-class="data">Data &amp; ML</button>
        <button type="button" class="hud-btn class-pick-btn" data-class="fullstack">Full-stack</button>
        <button type="button" class="hud-btn class-pick-btn" data-class="leadership">Leadership</button>
        <button type="button" class="hud-btn class-pick-btn" data-class="cloud">Cloud</button>
        <button type="button" class="hud-btn class-pick-btn" data-class="all">All (Show All)</button>
      </div>
      <footer class="dialog-actions">
        <button type="button" class="hud-btn" id="game-board-close">Close (Esc)</button>
      </footer>
    </div>
  `;

  // Mailbox Dialog
  const mailboxDialog = doc.createElement('dialog');
  mailboxDialog.className = 'cartridge-dialog game-modal';
  mailboxDialog.id = 'game-mailbox-dialog';
  mailboxDialog.innerHTML = `
    <div class="dialog-content">
      <header class="dialog-header">
        <h3 class="dialog-title">CAMPUS MAILBOX</h3>
        <p class="dialog-desc">Harshal Joshi's Contact Dispatch:</p>
      </header>
      <div class="dialog-body contact-links-list">
        <p><strong>Email:</strong> <a href="mailto:harshal5@illinois.edu" class="contact-link" target="_blank" rel="noopener noreferrer">harshal5@illinois.edu</a></p>
        <p><strong>GitHub:</strong> <a href="https://github.com/Hj-c0ding" class="contact-link" target="_blank" rel="noopener noreferrer">github.com/Hj-c0ding</a></p>
        <p><strong>LinkedIn:</strong> <a href="https://linkedin.com/in/harshal-joshi-54b3392a1" class="contact-link" target="_blank" rel="noopener noreferrer">linkedin.com/in/harshal-joshi-54b3392a1</a></p>
      </div>
      <footer class="dialog-actions">
        <button type="button" class="hud-btn" id="game-mailbox-close">Close (Esc)</button>
      </footer>
    </div>
  `;

  // Final Gate / Ending Dialog
  const endingDialog = doc.createElement('dialog');
  endingDialog.className = 'cartridge-dialog game-modal ending-dialog';
  endingDialog.id = 'game-ending-dialog';
  endingDialog.innerHTML = `
    <div class="dialog-content">
      <header class="dialog-header">
        <h3 class="dialog-title">CONGRATULATIONS!</h3>
      </header>
      <div class="dialog-body">
        <p class="dialog-message">You explored everything. Thanks for visiting.</p>
        <div class="contact-links-list">
          <p><strong>Email:</strong> <a href="mailto:harshal5@illinois.edu" class="contact-link" target="_blank" rel="noopener noreferrer">harshal5@illinois.edu</a></p>
          <p><strong>GitHub:</strong> <a href="https://github.com/Hj-c0ding" class="contact-link" target="_blank" rel="noopener noreferrer">github.com/Hj-c0ding</a></p>
          <p><strong>LinkedIn:</strong> <a href="https://linkedin.com/in/harshal-joshi-54b3392a1" class="contact-link" target="_blank" rel="noopener noreferrer">linkedin.com/in/harshal-joshi-54b3392a1</a></p>
        </div>
      </div>
      <footer class="dialog-actions">
        <button type="button" class="hud-btn hud-btn-accent" id="game-ending-play-again">Play again</button>
      </footer>
    </div>
  `;

  // New Game Confirmation Dialog
  const resetDialog = doc.createElement('dialog');
  resetDialog.className = 'cartridge-dialog';
  resetDialog.id = 'game-reset-dialog';
  resetDialog.innerHTML = `
    <form method="dialog" class="dialog-content">
      <h3 class="dialog-title">RESET PROGRESS?</h3>
      <p class="dialog-desc">All earned XP and unlocked achievements will be wiped. Start a fresh game?</p>
      <div class="dialog-actions">
        <button type="button" class="hud-btn" id="game-reset-cancel" value="cancel">Cancel</button>
        <button type="submit" class="hud-btn hud-btn-accent" id="game-reset-confirm" value="confirm">Confirm</button>
      </div>
    </form>
  `;

  dialogsContainer.append(
    buildingDialog,
    boardDialog,
    mailboxDialog,
    endingDialog,
    resetDialog,
  );

  gameRoot.append(
    hud,
    instructions,
    canvasWrap,
    touchControls,
    liveRegion,
    dialogsContainer,
  );
  container.append(gameRoot);

  const ctx = canvas.getContext('2d');

  // Announcement helper
  const announce = (message: string): void => {
    liveRegion.textContent = message;
    if (options.onAnnounce) options.onAnnounce(message);
  };

  const updateHud = (): void => {
    const s = progress();
    const levelEl = hud.querySelector('#game-hud-level');
    const xpValEl = hud.querySelector('#game-hud-xp-val');
    const progressFill = hud.querySelector('#game-hud-progressbar-fill') as HTMLElement;
    const progressBar = hud.querySelector('#game-hud-progressbar') as HTMLElement;
    const goalEl = hud.querySelector('#game-hud-next-goal');
    const trophiesEl = hud.querySelector('#game-hud-trophies strong');

    if (levelEl) levelEl.textContent = getLevel(s.xp);
    if (xpValEl) xpValEl.textContent = `${s.xp}/${MAX_XP}`;
    if (progressBar) progressBar.setAttribute('aria-valuenow', String(s.xp));
    if (progressFill) progressFill.style.width = `${(s.xp / MAX_XP) * 100}%`;
    if (goalEl) goalEl.textContent = getNextGoalText(s.xp);
    if (trophiesEl)
      trophiesEl.textContent = `${s.achievements.length}/${ACHIEVEMENTS.length}`;
  };

  const announceDelta = (delta: ProgressDelta): void => {
    const messages: string[] = [];
    if (delta.xpGained > 0) messages.push(`+${delta.xpGained} XP!`);
    if (delta.levelUp) messages.push(`LEVEL UP! Now ${delta.levelUp}!`);
    for (const achId of delta.unlockedAchievements) {
      const ach = ACHIEVEMENTS.find((a) => a.id === achId);
      if (ach) messages.push(`🏆 Achievement: "${ach.name}"!`);
    }

    if (messages.length > 0) {
      announce(messages.join(' '));
    }
  };

  // Dialog Controls
  const openModal = (dialog: HTMLDialogElement): void => {
    lastFocusedElement = (doc.activeElement as HTMLElement) ?? canvas;
    activeDialog = dialog;
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
    const firstBtn = dialog.querySelector<HTMLElement>('button, a');
    if (firstBtn) firstBtn.focus();
  };

  const closeModal = (dialog: HTMLDialogElement): void => {
    if (typeof dialog.close === 'function') {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
    if (activeDialog === dialog) {
      activeDialog = null;
    }
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
    } else {
      canvas.focus();
    }
  };

  const closeActiveDialog = (): void => {
    if (activeDialog) {
      closeModal(activeDialog);
    }
  };

  // Reset Progress logic: the store clears localStorage and notifies every
  // subscriber; this game resets its own view state in onStoreChange below.
  const onConfirmReset = (e?: Event): void => {
    if (e) e.preventDefault();
    closeModal(resetDialog);
    store.reset();
  };

  hud
    .querySelector('#game-hud-new-game-btn')
    ?.addEventListener('click', () => openModal(resetDialog));
  resetDialog
    .querySelector('#game-reset-cancel')
    ?.addEventListener('click', () => closeModal(resetDialog));
  resetDialog.querySelector('form')?.addEventListener('submit', onConfirmReset);

  endingDialog.querySelector('#game-ending-play-again')?.addEventListener('click', () => {
    closeModal(endingDialog);
    store.reset();
  });

  buildingDialog
    .querySelector('#game-building-close')
    ?.addEventListener('click', () => closeModal(buildingDialog));
  boardDialog
    .querySelector('#game-board-close')
    ?.addEventListener('click', () => closeModal(boardDialog));
  mailboxDialog
    .querySelector('#game-mailbox-close')
    ?.addEventListener('click', () => closeModal(mailboxDialog));

  const onCancel = (d: HTMLDialogElement) => (e: Event) => {
    e.preventDefault();
    closeModal(d);
  };
  buildingDialog.addEventListener('cancel', onCancel(buildingDialog));
  boardDialog.addEventListener('cancel', onCancel(boardDialog));
  mailboxDialog.addEventListener('cancel', onCancel(mailboxDialog));
  endingDialog.addEventListener('cancel', onCancel(endingDialog));
  resetDialog.addEventListener('cancel', onCancel(resetDialog));

  instructions
    .querySelector('#instructions-skip-link')
    ?.addEventListener('click', (e) => {
      e.preventDefault();
      doc.getElementById('skip-to-reader-link')?.click();
    });

  // Dynamic Class Board Buttons
  const classPickerEl = boardDialog.querySelector('.dialog-class-picker');
  const classDefs: ReadonlyArray<{ id: LensId | 'all'; label: string }> = [
    { id: 'data', label: 'Data & ML' },
    { id: 'fullstack', label: 'Full-stack' },
    { id: 'leadership', label: 'Leadership' },
    { id: 'cloud', label: 'Cloud' },
    { id: 'all', label: 'All (Show All)' },
  ];

  const classButtons: HTMLButtonElement[] = [];

  if (classPickerEl) {
    classPickerEl.innerHTML = '';
    for (const def of classDefs) {
      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'hud-btn class-pick-btn';
      btn.setAttribute('data-class', def.id);

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        selectedClass = def.id;
        if (def.id !== 'all') {
          store.dispatch({ type: 'chooseClass', classId: def.id });
        }
        updateClassButtons();
        announce(
          def.id === 'all'
            ? 'Class filter reset: showing all facilities.'
            : `Class selected: ${def.label}. Matching facilities highlighted!`,
        );
      });

      classButtons.push(btn);
      classPickerEl.append(btn);
    }
  }

  const updateClassButtons = (): void => {
    for (const btn of classButtons) {
      const cls = btn.getAttribute('data-class');
      const def = classDefs.find((d) => d.id === cls);
      if (!def) continue;

      const isCurrent =
        (def.id === 'all' && (selectedClass === 'all' || !selectedClass)) ||
        selectedClass === def.id;

      btn.className = `hud-btn class-pick-btn ${isCurrent ? 'is-selected' : ''}`;
      btn.setAttribute('aria-pressed', isCurrent ? 'true' : 'false');
      btn.innerHTML = `
        <span class="class-btn-name">${def.label}</span>
        ${isCurrent ? '<span class="class-btn-status">[Selected]</span>' : ''}
      `;
    }
  };

  updateClassButtons();

  // Single subscription to the shared store. Changes made anywhere (canvas,
  // reader mode, either New Game button) flow back here.
  const onStoreChange = (_state: ProgressState, delta: ProgressDelta | null): void => {
    updateHud();
    if (delta === null) {
      closeActiveDialog();
      playerPos = { x: SPAWN_POSITION.x, y: SPAWN_POSITION.y };
      selectedClass = null;
      lastAnnouncedInteractable = null;
      updateClassButtons();
      announce('Game progress reset. Fresh start!');
      return;
    }
    announceDelta(delta);
  };
  const unsubscribe = store.subscribe(onStoreChange);

  // Action / Interaction Trigger
  const interact = (): void => {
    if (activeDialog) return;

    const targetId = getAdjacentInteractable(playerPos);
    if (!targetId) return;

    if (targetId === 'board') {
      updateClassButtons();
      openModal(boardDialog);
      return;
    }

    if (targetId === 'mailbox') {
      store.dispatch({ type: 'openMailbox' });
      openModal(mailboxDialog);
      return;
    }

    if (targetId === 'gate') {
      if (isGateOpen(progress().xp)) {
        openModal(endingDialog);
      } else {
        announce('The Final Gate is locked! Reach 100 XP to open it.');
      }
      return;
    }

    // Target is a building id
    const entry: Entry | undefined = entries.find((e) => e.id === targetId);
    if (entry) {
      store.dispatch({ type: 'visitBuilding', buildingId: targetId });

      const titleEl = buildingDialog.querySelector('#game-building-title');
      const roleEl = buildingDialog.querySelector('#game-building-role');
      const datesEl = buildingDialog.querySelector('#game-building-dates');
      const summaryEl = buildingDialog.querySelector('#game-building-summary');
      const tagsEl = buildingDialog.querySelector('#game-building-tags');
      const noteEl = buildingDialog.querySelector('#game-building-note') as HTMLElement;

      if (titleEl) titleEl.textContent = entry.title;
      if (roleEl) roleEl.textContent = entry.role ?? '';
      if (datesEl) datesEl.textContent = entry.dates;
      if (summaryEl) summaryEl.textContent = entry.summary;
      if (tagsEl) {
        tagsEl.innerHTML = entry.tags
          .map((t) => `<span class="cartridge-badge">[${t.toUpperCase()}]</span>`)
          .join(' ');
      }
      if (noteEl) {
        if (entry.note) {
          noteEl.textContent = `★ Note: ${entry.note}`;
          noteEl.hidden = false;
        } else {
          noteEl.hidden = true;
        }
      }

      openModal(buildingDialog);
    }
  };

  const prefersReducedMotion = (): boolean =>
    typeof win.matchMedia === 'function' &&
    win.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Movement execution
  const doMove = (dir: string): void => {
    if (activeDialog) return;
    const nextState = tryMove(worldState(), dir);
    if (nextState.x !== playerPos.x || nextState.y !== playerPos.y) {
      playerPos = { x: nextState.x, y: nextState.y };
      walkFrame = prefersReducedMotion() ? 0 : (walkFrame + 1) % 2;

      // Check if stepped into Gate tile (10, 1) when gate is open
      if (
        playerPos.x === GATE_POSITION.x &&
        playerPos.y === GATE_POSITION.y &&
        isGateOpen(progress().xp)
      ) {
        openModal(endingDialog);
        return;
      }

      // Check adjacent interactable and announce
      const adjacentId = getAdjacentInteractable(playerPos);
      if (adjacentId && adjacentId !== lastAnnouncedInteractable) {
        lastAnnouncedInteractable = adjacentId;
        if (adjacentId === 'board') {
          announce('Near Class Board. Press E to select a class.');
        } else if (adjacentId === 'mailbox') {
          announce('Near Mailbox. Press E to view contact info.');
        } else if (adjacentId === 'gate') {
          announce(
            isGateOpen(progress().xp)
              ? 'Near Final Gate. Gate is open! Step through to finish.'
              : 'Near Final Gate. Gate is locked (100 XP required).',
          );
        } else {
          const b = BUILDINGS.find((building) => building.id === adjacentId);
          announce(`Near ${b?.name ?? adjacentId}. Press E to enter.`);
        }
      } else if (!adjacentId) {
        lastAnnouncedInteractable = null;
      }
    }
  };

  // Input Listeners
  const handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      if (activeDialog) {
        e.preventDefault();
        closeModal(activeDialog);
      }
      return;
    }

    const movementKeys = [
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'w',
      'W',
      's',
      'S',
      'a',
      'A',
      'd',
      'D',
    ];
    const isMovement = movementKeys.includes(e.key);
    const isSpace = e.key === ' ' || e.key === 'Space' || e.key === 'Spacebar';

    const activeEl = doc.activeElement as HTMLElement | null;
    const tag = activeEl ? activeEl.tagName.toLowerCase() : '';
    const isInteractiveFocus =
      tag === 'button' ||
      tag === 'input' ||
      tag === 'a' ||
      tag === 'summary' ||
      tag === 'textarea' ||
      tag === 'select';

    // preventDefault on arrow keys, WASD and Space ONLY when no dialog is open and focus is not in a button, input, link or summary. Tab navigation must keep working.
    if (!activeDialog && !isInteractiveFocus && (isMovement || isSpace)) {
      e.preventDefault();
    }

    if (activeDialog) return;

    if (e.key === 'e' || e.key === 'E' || e.key === 'Enter') {
      if (!isInteractiveFocus || activeEl === canvas) {
        e.preventDefault();
        interact();
      }
      return;
    }

    if (isMovement && !isInteractiveFocus) {
      const now = Date.now();
      if (activeMoveKey !== e.key) {
        activeMoveKey = e.key;
        lastMoveTime = now;
        doMove(e.key);

        if (repeatTimer) clearInterval(repeatTimer);
        repeatTimer = setInterval(() => {
          if (activeMoveKey && !activeDialog) {
            doMove(activeMoveKey);
          }
        }, REPEAT_DELAY_MS);
      } else if (now - lastMoveTime >= REPEAT_DELAY_MS) {
        lastMoveTime = now;
        doMove(e.key);
      }
    }
  };

  const handleKeyUp = (e: KeyboardEvent): void => {
    if (activeMoveKey === e.key) {
      activeMoveKey = null;
      if (repeatTimer) {
        clearInterval(repeatTimer);
        repeatTimer = null;
      }
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);

  // Touch controls listeners
  touchControls.querySelectorAll<HTMLButtonElement>('.dpad-btn').forEach((btn) => {
    const dir = btn.getAttribute('data-dir');
    if (!dir) return;

    const startTouchMove = (e: Event): void => {
      e.preventDefault();
      doMove(dir);
      if (repeatTimer) clearInterval(repeatTimer);
      repeatTimer = setInterval(() => doMove(dir), REPEAT_DELAY_MS);
    };

    const stopTouchMove = (e: Event): void => {
      e.preventDefault();
      if (repeatTimer) {
        clearInterval(repeatTimer);
        repeatTimer = null;
      }
    };

    btn.addEventListener('touchstart', startTouchMove, { passive: false });
    btn.addEventListener('touchend', stopTouchMove);
    btn.addEventListener('mousedown', startTouchMove);
    btn.addEventListener('mouseup', stopTouchMove);
    btn.addEventListener('mouseleave', stopTouchMove);
  });

  const btnA = touchControls.querySelector('#game-btn-a');
  btnA?.addEventListener('click', (e) => {
    e.preventDefault();
    interact();
  });

  const btnB = touchControls.querySelector('#game-btn-b');
  btnB?.addEventListener('click', (e) => {
    e.preventDefault();
    closeActiveDialog();
  });

  // Canvas Drawing Routine
  let animationFrameId: number | null = null;

  const render = (): void => {
    if (!ctx) return;

    // Clear background
    ctx.fillStyle = C_LIGHT;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 1. Draw Map Tiles
    for (let y = 0; y < MAP_HEIGHT; y++) {
      const row = MAP_ASCII[y];
      if (!row) continue;
      for (let x = 0; x < MAP_WIDTH; x++) {
        const char = row[x];
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        if (char === '.') {
          // Grass
          ctx.fillStyle = C_LIGHT;
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          // Grass blades texture
          ctx.fillStyle = C_DARK;
          ctx.fillRect(px + 6, py + 8, 2, 6);
          ctx.fillRect(px + 8, py + 6, 2, 8);
          ctx.fillRect(px + 22, py + 20, 2, 6);
          ctx.fillRect(px + 24, py + 18, 2, 8);
        } else if (char === '=') {
          // Stone Path
          ctx.fillStyle = C_LIGHTEST;
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          // Mortar border
          ctx.fillStyle = C_LIGHT;
          ctx.fillRect(px, py, TILE_SIZE, 2);
          ctx.fillRect(px, py, 2, TILE_SIZE);
          ctx.fillRect(px + 16, py + 2, 2, 14);
          ctx.fillRect(px, py + 16, TILE_SIZE, 2);
          ctx.fillRect(px + 8, py + 18, 2, 14);
        } else if (char === '~') {
          // Water
          ctx.fillStyle = C_DARK;
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          // Ripples
          ctx.fillStyle = C_LIGHT;
          ctx.fillRect(px + 4, py + 8, 12, 2);
          ctx.fillRect(px + 16, py + 20, 12, 2);
          ctx.fillStyle = C_LIGHTEST;
          ctx.fillRect(px + 8, py + 10, 4, 2);
          ctx.fillRect(px + 20, py + 22, 4, 2);
        } else if (char === 'T') {
          // Tree
          // Grass base
          ctx.fillStyle = C_LIGHT;
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          // Trunk
          ctx.fillStyle = C_DARKEST;
          ctx.fillRect(px + 12, py + 18, 8, 14);
          // Foliage
          ctx.fillStyle = C_DARK;
          ctx.fillRect(px + 4, py + 4, 24, 18);
          ctx.fillRect(px + 8, py + 2, 16, 22);
          // Highlights
          ctx.fillStyle = C_LIGHTEST;
          ctx.fillRect(px + 8, py + 6, 6, 6);
        } else if (char === '#') {
          // Border Wall
          ctx.fillStyle = C_DARKEST;
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = C_DARK;
          ctx.fillRect(px + 2, py + 2, 12, 12);
          ctx.fillRect(px + 16, py + 2, 14, 12);
          ctx.fillRect(px + 2, py + 16, 28, 14);
        }
      }
    }

    // 2. Draw Buildings
    const highlighted = highlightedBuildings(selectedClass);

    for (const b of BUILDINGS) {
      // Find bounding box
      let minX = MAP_WIDTH;
      let maxX = 0;
      let minY = MAP_HEIGHT;
      let maxY = 0;

      for (const t of b.tiles) {
        if (t.x < minX) minX = t.x;
        if (t.x > maxX) maxX = t.x;
        if (t.y < minY) minY = t.y;
        if (t.y > maxY) maxY = t.y;
      }

      const bx = minX * TILE_SIZE;
      const by = minY * TILE_SIZE;
      const bw = (maxX - minX + 1) * TILE_SIZE;
      const bh = (maxY - minY + 1) * TILE_SIZE;

      // Base wall
      ctx.fillStyle = C_LIGHTEST;
      ctx.fillRect(bx, by, bw, bh);

      // Roof styles based on building
      if (b.id === 'idx-exchange') {
        // Geometric step roof
        ctx.fillStyle = C_DARKEST;
        ctx.fillRect(bx, by, bw, 18);
        ctx.fillStyle = C_DARK;
        ctx.fillRect(bx + 6, by + 4, bw - 12, 10);
      } else if (b.id === 'illinois-state') {
        // Lab parapet roof with crenellations
        ctx.fillStyle = C_DARKEST;
        ctx.fillRect(bx, by, bw, 12);
        for (let k = 0; k < bw; k += 16) {
          ctx.fillRect(bx + k, by - 4, 8, 6);
        }
      } else if (b.id === 'fynder') {
        // Mansard dormer roof
        ctx.fillStyle = C_DARK;
        ctx.fillRect(bx, by, bw, 20);
        ctx.fillStyle = C_DARKEST;
        ctx.fillRect(bx + 4, by + 4, bw - 8, 12);
      } else if (b.id === 'backline') {
        // Hipped modern roof
        ctx.fillStyle = C_DARKEST;
        ctx.fillRect(bx, by, bw, 16);
        ctx.fillStyle = C_DARK;
        ctx.fillRect(bx + 12, by + 4, bw - 24, 8);
      } else if (b.id === 'fbla') {
        // Classical pediment roof
        ctx.fillStyle = C_DARKEST;
        ctx.fillRect(bx, by, bw, 18);
        ctx.fillStyle = C_LIGHT;
        ctx.fillRect(bx + 8, by + 6, bw - 16, 6);
      } else if (b.id === 'tsa') {
        // Barrel arch roof
        ctx.fillStyle = C_DARK;
        ctx.fillRect(bx, by, bw, 16);
        ctx.fillStyle = C_DARKEST;
        ctx.fillRect(bx + 4, by + 2, bw - 8, 12);
      } else if (b.id === 'aws-ccp') {
        // Tall tower spire roof
        ctx.fillStyle = C_DARKEST;
        ctx.fillRect(bx, by, bw, 22);
        ctx.fillStyle = C_ACCENT;
        ctx.fillRect(bx + 14, by - 6, 4, 10);
      }

      // Windows
      ctx.fillStyle = C_DARKEST;
      for (const t of b.tiles) {
        if (t.x !== b.door.x || t.y !== b.door.y) {
          const wx = t.x * TILE_SIZE + 8;
          const wy = t.y * TILE_SIZE + 10;
          ctx.fillRect(wx, wy, 8, 8);
          ctx.fillStyle = C_LIGHTEST;
          ctx.fillRect(wx + 2, wy + 2, 2, 2);
          ctx.fillStyle = C_DARKEST;
        }
      }

      // Door
      const dx = b.door.x * TILE_SIZE;
      const dy = b.door.y * TILE_SIZE;
      ctx.fillStyle = C_DARKEST;
      ctx.fillRect(dx + 8, dy + 10, 16, 22);
      ctx.fillStyle = C_DARK;
      ctx.fillRect(dx + 10, dy + 12, 12, 20);
      // Door handle
      ctx.fillStyle = C_LIGHTEST;
      ctx.fillRect(dx + 18, dy + 22, 2, 4);

      // Highlight outline for chosen class
      if (highlighted.includes(b.id)) {
        // 2px accent-free outline in #0F380F
        ctx.strokeStyle = C_DARKEST;
        ctx.lineWidth = 2;
        ctx.strokeRect(bx - 2, by - 2, bw + 4, bh + 4);

        // Small tag
        ctx.fillStyle = C_DARKEST;
        ctx.fillRect(bx + 4, by - 10, 48, 10);
        ctx.fillStyle = C_LIGHTEST;
        ctx.fillRect(bx + 6, by - 8, 44, 6);
        ctx.fillStyle = C_DARKEST;
        ctx.fillRect(bx + 10, by - 6, 36, 2);
      }
    }

    // 3. Draw Class Board (S) at (7, 5)
    {
      const sx = BOARD_POSITION.x * TILE_SIZE;
      const sy = BOARD_POSITION.y * TILE_SIZE;
      // Post
      ctx.fillStyle = C_DARKEST;
      ctx.fillRect(sx + 14, sy + 16, 4, 16);
      // Signboard
      ctx.fillStyle = C_DARKEST;
      ctx.fillRect(sx + 4, sy + 4, 24, 16);
      ctx.fillStyle = C_LIGHTEST;
      ctx.fillRect(sx + 6, sy + 6, 20, 12);
      // Text lines
      ctx.fillStyle = C_DARK;
      ctx.fillRect(sx + 8, sy + 9, 16, 2);
      ctx.fillRect(sx + 8, sy + 13, 12, 2);
    }

    // 4. Draw Mailbox (M) at (12, 5)
    {
      const mx = MAILBOX_POSITION.x * TILE_SIZE;
      const my = MAILBOX_POSITION.y * TILE_SIZE;
      // Post
      ctx.fillStyle = C_DARKEST;
      ctx.fillRect(mx + 14, my + 14, 4, 18);
      // Red Box (Accent)
      ctx.fillStyle = C_ACCENT;
      ctx.fillRect(mx + 8, my + 4, 16, 12);
      // Mail slot
      ctx.fillStyle = C_DARKEST;
      ctx.fillRect(mx + 10, my + 8, 12, 2);
      // White Flag
      ctx.fillStyle = C_LIGHTEST;
      ctx.fillRect(mx + 22, my + 2, 4, 6);
    }

    // 5. Draw Final Gate (G) at (10, 1)
    {
      const gx = GATE_POSITION.x * TILE_SIZE;
      const gy = GATE_POSITION.y * TILE_SIZE;
      const gateOpen = isGateOpen(progress().xp);

      // Archway Pillars
      ctx.fillStyle = C_DARKEST;
      ctx.fillRect(gx, gy, 8, TILE_SIZE);
      ctx.fillRect(gx + 24, gy, 8, TILE_SIZE);
      ctx.fillRect(gx, gy, TILE_SIZE, 8);

      if (gateOpen) {
        // Glowing open portal
        ctx.fillStyle = C_LIGHTEST;
        ctx.fillRect(gx + 8, gy + 8, 16, 24);
        ctx.fillStyle = C_LIGHT;
        ctx.fillRect(gx + 12, gy + 12, 8, 16);
      } else {
        // Locked iron bars
        ctx.fillStyle = C_DARK;
        ctx.fillRect(gx + 8, gy + 8, 16, 24);
        ctx.fillStyle = C_DARKEST;
        ctx.fillRect(gx + 12, gy + 8, 2, 24);
        ctx.fillRect(gx + 18, gy + 8, 2, 24);
        // Lock
        ctx.fillStyle = C_ACCENT;
        ctx.fillRect(gx + 13, gy + 16, 6, 6);
      }
    }

    // 6. Draw Player Sprite (2-frame walk cycle)
    {
      const px = playerPos.x * TILE_SIZE;
      const py = playerPos.y * TILE_SIZE;

      // Shadow
      ctx.fillStyle = C_DARK;
      ctx.fillRect(px + 8, py + 26, 16, 4);

      // Legs / Feet (toggled by walkFrame if not reduced motion)
      const currentWalkFrame = prefersReducedMotion() ? 0 : walkFrame;
      ctx.fillStyle = C_DARKEST;
      if (currentWalkFrame === 0) {
        ctx.fillRect(px + 9, py + 22, 5, 8);
        ctx.fillRect(px + 18, py + 20, 5, 8);
      } else {
        ctx.fillRect(px + 9, py + 20, 5, 8);
        ctx.fillRect(px + 18, py + 22, 5, 8);
      }

      // Torso / Jacket
      ctx.fillStyle = C_DARK;
      ctx.fillRect(px + 8, py + 12, 16, 10);
      ctx.fillStyle = C_LIGHTEST;
      ctx.fillRect(px + 14, py + 12, 4, 10);

      // Head / Face
      ctx.fillStyle = C_LIGHTEST;
      ctx.fillRect(px + 10, py + 4, 12, 10);

      // Eyes
      ctx.fillStyle = C_DARKEST;
      ctx.fillRect(px + 12, py + 8, 2, 2);
      ctx.fillRect(px + 18, py + 8, 2, 2);

      // Cap
      ctx.fillStyle = C_DARKEST;
      ctx.fillRect(px + 8, py + 2, 16, 4);
      ctx.fillRect(px + 10, py, 12, 3);
    }

    // 7. Draw "!" Speech Bubble when adjacent to an interactable
    const adjacent = getAdjacentInteractable(playerPos);
    if (adjacent) {
      const bx = playerPos.x * TILE_SIZE + 9;
      const by = playerPos.y * TILE_SIZE - 16;

      // Bubble background
      ctx.fillStyle = C_DARKEST;
      ctx.fillRect(bx - 1, by - 1, 16, 16);
      ctx.fillStyle = C_LIGHTEST;
      ctx.fillRect(bx, by, 14, 14);

      // Exclamation point in Accent Red
      ctx.fillStyle = C_ACCENT;
      ctx.fillRect(bx + 6, by + 2, 2, 6);
      ctx.fillRect(bx + 6, by + 10, 2, 2);
    }

    animationFrameId = requestAnimationFrame(render);
  };

  // Start render loop
  animationFrameId = requestAnimationFrame(render);

  return {
    getState: worldState,
    getProgress: progress,
    move: doMove,
    interact,
    closeDialog: closeActiveDialog,
    setSelectedClass: (cls) => {
      selectedClass = cls;
      updateClassButtons();
    },
    getSelectedClass: () => selectedClass,
    destroy: () => {
      unsubscribe();
      if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
      if (repeatTimer !== null) clearInterval(repeatTimer);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      gameRoot.remove();
    },
  };
}
