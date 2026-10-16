import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { entries } from '../src/data/entries';
import { openStage, STORAGE_KEY } from '../src/lib/progress';
import { mountHud, type HudHandle } from '../src/ui/hud';
import { mountLenses, type LensesHandle } from '../src/ui/lenses';

let root: HTMLElement;
let hudContainer: HTMLElement;
let lensesHandle: LensesHandle | undefined;
let hudHandle: HudHandle | undefined;

function setupApp(storage: Storage = window.localStorage): void {
  document.body.innerHTML = `
    <div id="hud-root"></div>
    <div id="lenses-root"></div>
  `;
  hudContainer = document.getElementById('hud-root') as HTMLElement;
  root = document.getElementById('lenses-root') as HTMLElement;

  hudHandle = mountHud(hudContainer, { storage });
  lensesHandle = mountLenses(root, entries, window, {
    onStageExpand: (stageId: string) => {
      if (!hudHandle) return;
      const cur = hudHandle.getState();
      const allIds = entries.map((e) => e.id);
      hudHandle.applyDelta(openStage(cur, stageId, allIds));
    },
  });
}

beforeEach(() => {
  window.localStorage.clear();
  setupApp();
});

afterEach(() => {
  lensesHandle?.destroy();
  hudHandle?.destroy();
  lensesHandle = undefined;
  hudHandle = undefined;
});

describe('Explorer Progress DOM integration', () => {
  it("expanding a stage updates aria-expanded, the XP bar's aria-valuenow, and the toast text in the aria-live region", () => {
    const firstStageArticle = root.querySelector('article.stage-row') as HTMLElement;
    const toggleBtn = firstStageArticle.querySelector(
      '.stage-toggle-btn',
    ) as HTMLButtonElement;
    const details = firstStageArticle.querySelector('.stage-details') as HTMLElement;
    const progressBar = hudContainer.querySelector('#hud-progressbar') as HTMLElement;
    const toastRegion = hudContainer.querySelector('#hud-toast-region') as HTMLElement;
    const toastMessage = hudContainer.querySelector('#hud-toast-message') as HTMLElement;

    expect(toggleBtn.getAttribute('aria-expanded')).toBe('false');
    expect(details.hidden).toBe(true);
    expect(progressBar.getAttribute('aria-valuenow')).toBe('0');
    expect(toastRegion.getAttribute('aria-live')).toBe('polite');

    // Expand stage
    toggleBtn.click();

    expect(toggleBtn.getAttribute('aria-expanded')).toBe('true');
    expect(details.hidden).toBe(false);
    expect(progressBar.getAttribute('aria-valuenow')).toBe('10');
    expect(hudContainer.querySelector('#hud-xp-val')?.textContent).toBe('10/100');

    // Toast appeared in polite region
    expect(toastMessage.hidden).toBe(false);
    expect(toastMessage.textContent).toContain('+10 XP!');
    expect(toastMessage.textContent).toContain('First Steps');
  });

  it('New Game dialog cancel keeps progress; confirm resets it and clears localStorage', () => {
    const firstStageArticle = root.querySelector('article.stage-row') as HTMLElement;
    const toggleBtn = firstStageArticle.querySelector(
      '.stage-toggle-btn',
    ) as HTMLButtonElement;
    toggleBtn.click();

    expect(hudHandle?.getState().xp).toBe(10);
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();

    const newGameBtn = hudContainer.querySelector(
      '#hud-new-game-btn',
    ) as HTMLButtonElement;
    const dialog = hudContainer.querySelector('#hud-reset-dialog') as HTMLDialogElement;
    const cancelBtn = dialog.querySelector('#hud-dialog-cancel') as HTMLButtonElement;
    const dialogForm = dialog.querySelector('form') as HTMLFormElement;

    // Open dialog
    newGameBtn.click();

    // Cancel keeping progress
    cancelBtn.click();
    expect(hudHandle?.getState().xp).toBe(10);
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();

    // Confirm resets
    dialogForm.dispatchEvent(new Event('submit', { cancelable: true }));

    expect(hudHandle?.getState().xp).toBe(0);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    const progressBar = hudContainer.querySelector('#hud-progressbar') as HTMLElement;
    expect(progressBar.getAttribute('aria-valuenow')).toBe('0');
  });

  it('progress persists across re-initialization (simulating reload)', () => {
    const firstStageArticle = root.querySelector('article.stage-row') as HTMLElement;
    const toggleBtn = firstStageArticle.querySelector(
      '.stage-toggle-btn',
    ) as HTMLButtonElement;
    toggleBtn.click();
    expect(hudHandle?.getState().xp).toBe(10);

    // Teardown and reload
    lensesHandle?.destroy();
    hudHandle?.destroy();

    setupApp();

    expect(hudHandle?.getState().xp).toBe(10);
    const progressBar = hudContainer.querySelector('#hud-progressbar') as HTMLElement;
    expect(progressBar.getAttribute('aria-valuenow')).toBe('10');
    expect(hudContainer.querySelector('#hud-xp-val')?.textContent).toBe('10/100');
  });

  it('app still works when localStorage throws (private mode or disabled)', () => {
    lensesHandle?.destroy();
    hudHandle?.destroy();

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

    expect(() => setupApp(throwingStorage)).not.toThrow();

    const firstStageArticle = root.querySelector('article.stage-row') as HTMLElement;
    const toggleBtn = firstStageArticle.querySelector(
      '.stage-toggle-btn',
    ) as HTMLButtonElement;
    expect(() => toggleBtn.click()).not.toThrow();

    expect(hudHandle?.getState().xp).toBe(10);
    const progressBar = hudContainer.querySelector('#hud-progressbar') as HTMLElement;
    expect(progressBar.getAttribute('aria-valuenow')).toBe('10');
  });
});
