import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { entries } from '../src/data/entries';
import { GATE_POSITION } from '../src/data/world';
import { BUILDING_IDS, STORAGE_KEY, VALID_CLASSES } from '../src/lib/progress';
import { createProgressStore, type ProgressStore } from '../src/lib/store';
import { isGateOpen } from '../src/lib/world';
import { mountGame, type GameHandle } from '../src/ui/game';
import { mountHud, type HudHandle } from '../src/ui/hud';
import { mountLenses, type LensesHandle } from '../src/ui/lenses';

let store: ProgressStore;
let gameHandle: GameHandle | undefined;
let hudHandle: HudHandle | undefined;
let lensesHandle: LensesHandle | undefined;

function getRequiredEl<T extends Element>(
  selector: string,
  parent: ParentNode = document,
): T {
  const el = parent.querySelector<T>(selector);
  if (!el) throw new Error(`Element not found: ${selector}`);
  return el;
}

function setupFullDom(customStorage: Storage | null = window.localStorage): void {
  window.localStorage.clear();

  // Stub minimal fake 2D canvas context
  const fakeCtx = {
    fillRect: () => {},
    strokeRect: () => {},
    fillText: () => {},
    beginPath: () => {},
    arc: () => {},
    fill: () => {},
    stroke: () => {},
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
  };
  HTMLCanvasElement.prototype.getContext = (() =>
    fakeCtx) as unknown as typeof HTMLCanvasElement.prototype.getContext;

  document.body.innerHTML = `
    <button
      type="button"
      class="skip-link"
      id="skip-to-reader-link"
      aria-pressed="false"
    >Skip the game: read everything</button>

    <div id="game-root"></div>
    <div id="hud-root" hidden></div>

    <div class="page" id="reader-mode" hidden>
      <header class="title-screen">
        <h1 class="name">Harshal Joshi</h1>
        <button type="button" class="hud-btn reader-return-btn" id="reader-return-btn">Return to game</button>
      </header>

      <main>
        <section id="work" class="work" aria-labelledby="work-heading">
          <div id="lenses-root"></div>
        </section>

        <section id="trophies-section" class="row trophies">
          <p class="trophies-summary">
            <span id="reader-trophies-count">0</span> / 7 unlocked
          </p>
          <ul class="trophies-list" id="reader-trophies-list"></ul>
        </section>

        <section id="contact-section" class="row contact">
          <ul class="contact-list">
            <li>
              <a href="mailto:harshal5@illinois.edu" class="contact-link" id="contact-email-link">harshal5@illinois.edu</a>
            </li>
          </ul>
        </section>
      </main>
    </div>
  `;

  store = createProgressStore({ storage: customStorage });

  const gameRoot = document.getElementById('game-root') as HTMLElement;
  gameHandle = mountGame(gameRoot, { store, storage: customStorage });

  const hudRoot = document.getElementById('hud-root') as HTMLElement;
  hudHandle = mountHud(hudRoot, { store, storage: customStorage });

  const lensesRoot = document.getElementById('lenses-root') as HTMLElement;
  lensesHandle = mountLenses(lensesRoot, entries, window, {
    onStageExpand: (stageId: string) => {
      store.dispatch({ type: 'visitBuilding', buildingId: stageId });
    },
    onLensUse: (lensId: string) => {
      store.dispatch({ type: 'chooseClass', classId: lensId });
    },
  });

  // Wire reader mode toggle
  const skipBtn = document.getElementById('skip-to-reader-link') as HTMLButtonElement;
  const readerMode = document.getElementById('reader-mode') as HTMLElement;
  const returnBtn = document.getElementById('reader-return-btn') as HTMLButtonElement;

  const toggleReaderMode = (forceState?: boolean): void => {
    const currentlyReader = skipBtn.getAttribute('aria-pressed') === 'true';
    const nextIsReader = forceState !== undefined ? forceState : !currentlyReader;

    skipBtn.setAttribute('aria-pressed', String(nextIsReader));
    skipBtn.textContent = nextIsReader
      ? 'Return to game'
      : 'Skip the game: read everything';
    gameRoot.hidden = nextIsReader;
    readerMode.hidden = !nextIsReader;
    hudRoot.hidden = !nextIsReader;
  };

  skipBtn.addEventListener('click', () => toggleReaderMode());
  returnBtn.addEventListener('click', () => toggleReaderMode(false));

  const contactSection = document.getElementById('contact-section');
  if (contactSection) {
    const triggerContact = (): void => {
      store.dispatch({ type: 'openMailbox' });
    };
    contactSection.addEventListener('click', triggerContact);
    contactSection
      .querySelectorAll('a')
      .forEach((a) => a.addEventListener('click', triggerContact));
  }
}

beforeEach(() => {
  setupFullDom();
});

afterEach(() => {
  gameHandle?.destroy();
  hudHandle?.destroy();
  lensesHandle?.destroy();
  gameHandle = undefined;
  hudHandle = undefined;
  lensesHandle = undefined;
  document.body.innerHTML = '';
});

describe('Game World & Reader Mode DOM Tests (happy-dom)', () => {
  it('1. Skip link is the first focusable element and toggles reader mode both ways', () => {
    const focusables = Array.from(
      document.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => !el.closest('[hidden]'));

    const skipBtn = document.getElementById('skip-to-reader-link') as HTMLButtonElement;
    expect(focusables[0]).toBe(skipBtn);

    const gameRoot = document.getElementById('game-root') as HTMLElement;
    const readerMode = document.getElementById('reader-mode') as HTMLElement;

    // Initially in game mode
    expect(skipBtn.getAttribute('aria-pressed')).toBe('false');
    expect(gameRoot.hidden).toBe(false);
    expect(readerMode.hidden).toBe(true);

    // Toggle to reader mode
    skipBtn.click();
    expect(skipBtn.getAttribute('aria-pressed')).toBe('true');
    expect(skipBtn.textContent).toContain('Return to game');
    expect(gameRoot.hidden).toBe(true);
    expect(readerMode.hidden).toBe(false);

    // Toggle back to game mode
    skipBtn.click();
    expect(skipBtn.getAttribute('aria-pressed')).toBe('false');
    expect(skipBtn.textContent).toContain('Skip the game');
    expect(gameRoot.hidden).toBe(false);
    expect(readerMode.hidden).toBe(true);
  });

  it('2. A stage expanded in reader mode awards +10 once (0 on repeat) and the XP shown in the HUD matches', () => {
    // Activate reader mode
    const skipBtn = document.getElementById('skip-to-reader-link') as HTMLButtonElement;
    skipBtn.click();

    expect(store.getState().xp).toBe(0);
    const hudXp = document.querySelector('#hud-xp-val') as HTMLElement;
    expect(hudXp.textContent).toBe('0/100');

    const firstStage = getRequiredEl<HTMLButtonElement>('.stage-toggle-btn');
    expect(firstStage).not.toBeNull();

    // Expand stage -> awards +10 once
    firstStage.click();
    expect(store.getState().xp).toBe(10);
    expect(hudXp.textContent).toBe('10/100');

    // Collapse
    firstStage.click();
    expect(store.getState().xp).toBe(10);
    expect(hudXp.textContent).toBe('10/100');

    // Re-expand (repeat) -> awards 0
    firstStage.click();
    expect(store.getState().xp).toBe(10);
    expect(hudXp.textContent).toBe('10/100');
  });

  it('3. Choosing a lens in reader mode awards +5 once; opening contact in reader mode awards +10 once, via the real reader-mode controls (click them), not by calling openMailbox directly', () => {
    const skipBtn = document.getElementById('skip-to-reader-link') as HTMLButtonElement;
    skipBtn.click();

    // 1. Choose a lens via real button
    const fullstackChip = getRequiredEl<HTMLButtonElement>('#lens-chip-fullstack');
    expect(fullstackChip).not.toBeNull();
    fullstackChip.click();

    expect(store.getState().xp).toBe(5);

    // Repeat lens selection awards 0
    fullstackChip.click(); // de-select
    fullstackChip.click(); // re-select
    expect(store.getState().xp).toBe(5);

    // 2. Open contact in reader mode via clicking real control
    const contactControl = getRequiredEl<HTMLElement>('#contact-email-link');
    expect(contactControl).not.toBeNull();
    contactControl.click();

    // 5 from lens + 10 from contact = 15 XP
    expect(store.getState().xp).toBe(15);

    // Repeat click on contact awards 0
    contactControl.click();
    expect(store.getState().xp).toBe(15);
  });

  it('4. TWO-COMPONENT SYNC TEST: mount the HUD and the game together. Visit a building, then confirm New Game in the dialog. Both the HUD and the game state show 0 XP and the gate is closed. Then one building visit gives exactly +10 in both, not more', () => {
    // 1. Visit a building via store dispatch
    store.dispatch({ type: 'visitBuilding', buildingId: 'idx-exchange' });

    expect(hudHandle?.getState().xp).toBe(10);
    expect(gameHandle?.getProgress().xp).toBe(10);
    expect(gameHandle?.getState().xp).toBe(10);

    // 2. Open New Game in the dialog and confirm
    const newGameBtn = getRequiredEl<HTMLButtonElement>('#hud-new-game-btn');
    newGameBtn.click();

    const dialog = getRequiredEl<HTMLDialogElement>('#hud-reset-dialog');
    dialog
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { cancelable: true }));

    // Both HUD and game state show 0 XP and the gate is closed
    expect(hudHandle?.getState().xp).toBe(0);
    expect(gameHandle?.getProgress().xp).toBe(0);
    expect(gameHandle?.getState().xp).toBe(0);
    expect(isGateOpen(gameHandle?.getProgress().xp ?? 0)).toBe(false);

    // 3. One building visit gives exactly +10 in both, not more
    store.dispatch({ type: 'visitBuilding', buildingId: 'illinois-state' });
    expect(hudHandle?.getState().xp).toBe(10);
    expect(gameHandle?.getProgress().xp).toBe(10);
    expect(gameHandle?.getState().xp).toBe(10);
  });

  it('5. Arrow key moves the player and is default-prevented; it is NOT default-prevented when a dialog is open', () => {
    if (!gameHandle) throw new Error('gameHandle is not mounted');
    const initialPos = { ...gameHandle.getState() };

    // Move when no dialog is open -> moves player and is default-prevented
    const event1 = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      cancelable: true,
      bubbles: true,
    });
    window.dispatchEvent(event1);

    expect(event1.defaultPrevented).toBe(true);
    expect(gameHandle.getState().y).toBe(initialPos.y + 1);

    // Open a modal dialog
    const newGameBtn = getRequiredEl<HTMLButtonElement>('#game-hud-new-game-btn');
    newGameBtn.click();

    const posWhileDialogOpen = { ...gameHandle.getState() };

    // Keydown when dialog is open -> NOT default-prevented and player does not move
    const event2 = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      cancelable: true,
      bubbles: true,
    });
    window.dispatchEvent(event2);

    expect(event2.defaultPrevented).toBe(false);
    expect(gameHandle.getState().y).toBe(posWhileDialogOpen.y);
  });

  it('6. Escape closes a dialog and focus returns to the element that opened it', () => {
    const newGameBtn = getRequiredEl<HTMLButtonElement>('#game-hud-new-game-btn');
    newGameBtn.focus();
    expect(document.activeElement).toBe(newGameBtn);

    // Open dialog
    newGameBtn.click();
    const dialog = getRequiredEl<HTMLDialogElement>('#game-reset-dialog');
    expect(dialog.hasAttribute('open') || dialog.open).toBe(true);

    // Press Escape
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', cancelable: true, bubbles: true }),
    );

    // Dialog is closed
    expect(dialog.hasAttribute('open')).toBe(false);

    // Focus returned to element that opened it
    expect(document.activeElement).toBe(newGameBtn);
  });

  it('7. New Game cancel keeps progress; confirm resets it and clears localStorage', () => {
    store.dispatch({ type: 'visitBuilding', buildingId: 'idx-exchange' });
    expect(store.getState().xp).toBe(10);
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();

    const newGameBtn = getRequiredEl<HTMLButtonElement>('#hud-new-game-btn');
    newGameBtn.click();

    // Cancel keeps progress
    const cancelBtn = getRequiredEl<HTMLButtonElement>('#hud-dialog-cancel');
    cancelBtn.click();

    expect(store.getState().xp).toBe(10);
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();

    // Confirm resets
    newGameBtn.click();
    const dialog = getRequiredEl<HTMLDialogElement>('#hud-reset-dialog');
    dialog
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { cancelable: true }));

    expect(store.getState().xp).toBe(0);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('8. App still works when localStorage throws (in-memory fallback)', () => {
    gameHandle?.destroy();
    hudHandle?.destroy();
    lensesHandle?.destroy();

    const throwingStorage: Storage = {
      getItem: () => {
        throw new Error('SecurityError: Access Denied');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {
        throw new Error('SecurityError: Access Denied');
      },
      clear: () => {},
      length: 0,
      key: () => null,
    };

    expect(() => setupFullDom(throwingStorage)).not.toThrow();

    // Expanding a stage works in memory
    const firstStage = getRequiredEl<HTMLButtonElement>('.stage-toggle-btn');
    expect(() => firstStage.click()).not.toThrow();
    expect(store.getState().xp).toBe(10);
  });

  it('9. Gate stays closed below 100 XP; at 100 XP walking onto the gate opens the ending panel', () => {
    // 1. Visit 6 of 7 buildings -> 60 XP
    for (let i = 0; i < 6; i++) {
      const bId = BUILDING_IDS[i];
      if (bId) store.dispatch({ type: 'visitBuilding', buildingId: bId });
    }
    expect(store.getState().xp).toBe(60);
    expect(isGateOpen(store.getState().xp)).toBe(false);

    // Re-mount game directly adjacent south of the gate at (10, 2)
    gameHandle?.destroy();
    const gameRoot = document.getElementById('game-root') as HTMLElement;
    gameHandle = mountGame(gameRoot, {
      store,
      initialState: { x: GATE_POSITION.x, y: GATE_POSITION.y + 1 },
    });

    // Try moving up into locked gate
    gameHandle.move('up');
    // Gate is locked, ending dialog is not opened
    const endingDialog = getRequiredEl<HTMLDialogElement>('#game-ending-dialog');
    expect(endingDialog.hasAttribute('open')).toBe(false);
    expect(gameHandle.getState().y).toBe(GATE_POSITION.y + 1);

    // 2. Complete remaining objectives: 7th building (10), 4 classes (20), mailbox (10) -> 100 XP
    const lastBuildingId = BUILDING_IDS[6];
    if (lastBuildingId)
      store.dispatch({ type: 'visitBuilding', buildingId: lastBuildingId });
    for (const c of VALID_CLASSES) {
      store.dispatch({ type: 'chooseClass', classId: c });
    }
    store.dispatch({ type: 'openMailbox' });

    expect(store.getState().xp).toBe(100);
    expect(isGateOpen(store.getState().xp)).toBe(true);

    // Move up onto open gate (10, 1)
    gameHandle.move('up');
    expect(gameHandle.getState().x).toBe(GATE_POSITION.x);
    expect(gameHandle.getState().y).toBe(GATE_POSITION.y);

    // Ending panel is opened
    expect(endingDialog.hasAttribute('open') || endingDialog.open).toBe(true);
  });
});
