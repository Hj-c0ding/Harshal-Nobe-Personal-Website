import {
  ACHIEVEMENTS,
  getLevel,
  MAX_XP,
  type ProgressDelta,
  type ProgressState,
} from '../lib/progress';
import { createProgressStore, type ProgressStore } from '../lib/store';

export interface HudHandle {
  getState(): ProgressState;
  /** Commits a delta computed from getState() into the shared store. */
  applyDelta(delta: ProgressDelta): void;
  showToast(message: string): void;
  destroy(): void;
}

export interface HudOptions {
  /** Shared progress store. If omitted, a store backed by `storage` is created. */
  store?: ProgressStore;
  storage?: Storage | null;
  toastDurationMs?: number;
}

export function getNextGoalText(xp: number): string {
  if (xp < 20) return `Next: Scout at 20 XP (+${20 - xp} XP)`;
  if (xp < 45) return `Next: Builder at 45 XP (+${45 - xp} XP)`;
  if (xp < 75) return `Next: Engineer at 75 XP (+${75 - xp} XP)`;
  if (xp < 100) return `Next: Gate opens at 100 XP (+${100 - xp} XP)`;
  return 'Gate open! Step through to finish.';
}

export function mountHud(container: HTMLElement, options: HudOptions = {}): HudHandle {
  const doc = container.ownerDocument;
  const win = doc.defaultView ?? window;
  const store =
    options.store ??
    createProgressStore({
      storage: options.storage !== undefined ? options.storage : win.localStorage,
    });
  const state = (): ProgressState => store.getState();

  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  // Build HUD elements
  const hud = doc.createElement('header');
  hud.className = 'cartridge-hud';
  hud.id = 'cartridge-hud';

  const inner = doc.createElement('div');
  inner.className = 'hud-inner';

  const brand = doc.createElement('div');
  brand.className = 'hud-brand';
  brand.innerHTML = `
    <span class="hud-player">HARSHAL</span>
    <span class="hud-level-badge" id="hud-level-badge">LV: <strong id="hud-level">${getLevel(state().xp)}</strong></span>
  `;

  const barContainer = doc.createElement('div');
  barContainer.className = 'hud-progress-wrap';
  barContainer.innerHTML = `
    <div class="hud-label-row">
      <span class="hud-xp-label">XP</span>
      <span class="hud-xp-val" id="hud-xp-val">${state().xp}/${MAX_XP}</span>
    </div>
    <div 
      class="hud-progressbar" 
      id="hud-progressbar"
      role="progressbar" 
      aria-label="Explorer progress" 
      aria-valuemin="0" 
      aria-valuemax="${MAX_XP}" 
      aria-valuenow="${state().xp}"
    >
      <div class="hud-progressbar-fill" id="hud-progressbar-fill" style="width: ${(state().xp / MAX_XP) * 100}%"></div>
    </div>
    <div class="hud-goal-line" id="hud-next-goal">${getNextGoalText(state().xp)}</div>
  `;

  const stats = doc.createElement('div');
  stats.className = 'hud-stats';
  stats.innerHTML = `
    <span class="hud-achievements" id="hud-achievements" title="Achievements unlocked">
      ACHV: <strong id="hud-achievements-count">${state().achievements.length}/${ACHIEVEMENTS.length}</strong>
    </span>
    <button type="button" class="hud-btn" id="hud-new-game-btn">New Game</button>
  `;

  inner.append(brand, barContainer, stats);
  hud.append(inner);

  // Live Toast container
  const toastRegion = doc.createElement('div');
  toastRegion.className = 'hud-toast-region';
  toastRegion.id = 'hud-toast-region';
  toastRegion.setAttribute('aria-live', 'polite');
  toastRegion.setAttribute('aria-atomic', 'true');

  const toastMessage = doc.createElement('div');
  toastMessage.className = 'hud-toast-message';
  toastMessage.id = 'hud-toast-message';
  toastMessage.hidden = true;
  toastRegion.append(toastMessage);

  // Native Confirm Dialog
  const dialog = doc.createElement('dialog');
  dialog.className = 'cartridge-dialog';
  dialog.id = 'hud-reset-dialog';
  dialog.innerHTML = `
    <form method="dialog" class="dialog-content">
      <h3 class="dialog-title">RESET PROGRESS?</h3>
      <p class="dialog-desc">All earned XP and unlocked achievements will be wiped. Start a fresh game?</p>
      <div class="dialog-actions">
        <button type="button" class="hud-btn" id="hud-dialog-cancel" value="cancel">Cancel</button>
        <button type="submit" class="hud-btn hud-btn-accent" id="hud-dialog-confirm" value="confirm">Confirm</button>
      </div>
    </form>
  `;

  container.append(hud, toastRegion, dialog);

  const levelElem = inner.querySelector('#hud-level') as HTMLElement;
  const xpValElem = inner.querySelector('#hud-xp-val') as HTMLElement;
  const progressBar = inner.querySelector('#hud-progressbar') as HTMLElement;
  const progressFill = inner.querySelector('#hud-progressbar-fill') as HTMLElement;
  const goalElem = inner.querySelector('#hud-next-goal') as HTMLElement;
  const achvCountElem = inner.querySelector('#hud-achievements-count') as HTMLElement;
  const newGameBtn = inner.querySelector('#hud-new-game-btn') as HTMLButtonElement;
  const cancelBtn = dialog.querySelector('#hud-dialog-cancel') as HTMLButtonElement;
  const dialogForm = dialog.querySelector('form') as HTMLFormElement;

  const renderHud = (): void => {
    const s = state();
    levelElem.textContent = getLevel(s.xp);
    xpValElem.textContent = `${s.xp}/${MAX_XP}`;
    progressBar.setAttribute('aria-valuenow', String(s.xp));
    progressFill.style.width = `${(s.xp / MAX_XP) * 100}%`;
    if (goalElem) goalElem.textContent = getNextGoalText(s.xp);
    achvCountElem.textContent = `${s.achievements.length}/${ACHIEVEMENTS.length}`;
  };

  const showToast = (message: string): void => {
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    toastMessage.textContent = message;
    toastMessage.hidden = false;
    toastMessage.classList.add('is-active');

    const duration = options.toastDurationMs ?? 4000;
    toastTimer = setTimeout(() => {
      toastMessage.classList.remove('is-active');
      toastMessage.hidden = true;
      toastTimer = null;
    }, duration);
  };

  const onStoreChange = (_next: ProgressState, delta: ProgressDelta | null): void => {
    renderHud();

    if (delta === null) {
      showToast('Game progress reset. Fresh start!');
      return;
    }

    const messages: string[] = [];
    if (delta.xpGained > 0) {
      messages.push(`+${delta.xpGained} XP!`);
    }
    if (delta.levelUp) {
      messages.push(`LEVEL UP! Now ${delta.levelUp}!`);
    }
    for (const achId of delta.unlockedAchievements) {
      const ach = ACHIEVEMENTS.find((a) => a.id === achId);
      if (ach) {
        messages.push(`🏆 Achievement: "${ach.name}"!`);
      }
    }

    if (messages.length > 0) {
      showToast(messages.join(' '));
    }
  };
  const unsubscribe = store.subscribe(onStoreChange);

  // Dialog handlers
  const openDialog = (): void => {
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      // Fallback for environments lacking HTMLDialogElement.prototype.showModal
      dialog.setAttribute('open', '');
    }
  };

  const closeDialog = (): void => {
    if (typeof dialog.close === 'function') {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
  };

  const onConfirmReset = (e?: Event): void => {
    if (e) e.preventDefault();
    closeDialog();
    // Clears localStorage and notifies every subscriber (HUD, canvas, reader mode).
    store.reset();
  };

  newGameBtn.addEventListener('click', openDialog);
  cancelBtn.addEventListener('click', closeDialog);
  dialogForm.addEventListener('submit', onConfirmReset);

  renderHud();

  return {
    getState: state,
    applyDelta: (delta) => store.commit(delta),
    showToast,
    destroy: () => {
      unsubscribe();
      if (toastTimer) clearTimeout(toastTimer);
      newGameBtn.removeEventListener('click', openDialog);
      cancelBtn.removeEventListener('click', closeDialog);
      dialogForm.removeEventListener('submit', onConfirmReset);
      hud.remove();
      toastRegion.remove();
      dialog.remove();
    },
  };
}
