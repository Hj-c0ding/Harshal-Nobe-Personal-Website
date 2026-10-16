import '@fontsource/silkscreen/400.css';
import '@fontsource/silkscreen/700.css';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import './styles/main.css';

import { entries } from './data/entries';
import { ACHIEVEMENTS, checkKonamiCode } from './lib/progress';
import { createProgressStore } from './lib/store';
import { mountHud } from './ui/hud';
import { mountLenses } from './ui/lenses';
import { mountGame } from './ui/game';

// The ONE progress store for the whole page. Canvas game, HUD and reader mode
// all read and write through it; nothing else holds a copy of progress.
export const store = createProgressStore({ storage: window.localStorage });

// Mount Playable Canvas Game
const gameRoot = document.getElementById('game-root');
export const gameHandle = gameRoot ? mountGame(gameRoot, { store }) : null;

// Mount HUD (for Reader Mode)
const hudRoot = document.getElementById('hud-root');
export const hudHandle = mountHud(hudRoot ?? document.createElement('div'), { store });

// Mount Lenses & Stage Select (reader mode)
const root = document.getElementById('lenses-root');
export const lensesHandle = root
  ? mountLenses(root, entries, window, {
      onStageExpand: (stageId: string) => {
        store.dispatch({ type: 'visitBuilding', buildingId: stageId });
      },
      onLensUse: (lensId: string) => {
        store.dispatch({ type: 'chooseClass', classId: lensId });
      },
    })
  : null;

// Reader Mode Toggle logic
export function toggleReaderMode(forceState?: boolean): boolean {
  const skipBtn = document.getElementById('skip-to-reader-link');
  const gRoot = document.getElementById('game-root');
  const rMode = document.getElementById('reader-mode');
  const hRoot = document.getElementById('hud-root');

  const currentlyReader = skipBtn?.getAttribute('aria-pressed') === 'true';
  const nextIsReader = forceState !== undefined ? forceState : !currentlyReader;

  if (skipBtn) {
    skipBtn.setAttribute('aria-pressed', String(nextIsReader));
    skipBtn.textContent = nextIsReader
      ? 'Return to game'
      : 'Skip the game: read everything';
  }
  if (gRoot) gRoot.hidden = nextIsReader;
  if (rMode) rMode.hidden = !nextIsReader;
  if (hRoot) hRoot.hidden = !nextIsReader;

  return nextIsReader;
}

const skipBtn = document.getElementById('skip-to-reader-link');
skipBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  toggleReaderMode();
});

const readerReturnBtn = document.getElementById('reader-return-btn');
readerReturnBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  toggleReaderMode(false);
});

// Sync hash with view mode
const checkHashMode = (): void => {
  const hash = window.location.hash;
  if (
    hash === '#reader-mode' ||
    hash === '#work' ||
    hash === '#about' ||
    hash === '#contact-section'
  ) {
    toggleReaderMode(true);
  }
};
checkHashMode();
window.addEventListener('hashchange', checkHashMode);

// Trophies list rendering in Reader Mode
export function renderReaderTrophies(): void {
  const list = document.getElementById('reader-trophies-list');
  const count = document.getElementById('reader-trophies-count');
  if (!list) return;
  const s = store.getState();
  if (count) count.textContent = String(s.achievements.length);

  list.innerHTML = ACHIEVEMENTS.map((ach) => {
    const unlocked = s.achievements.includes(ach.id);
    return `
      <li class="trophy-item ${unlocked ? 'is-unlocked' : 'is-locked'}">
        <span class="trophy-badge" aria-hidden="true">${unlocked ? '🏆' : '🔒'}</span>
        <span class="trophy-details">
          <strong class="trophy-name">${ach.name}</strong>: 
          <span class="trophy-desc">${ach.description}</span>
        </span>
        <span class="trophy-status">${unlocked ? '[UNLOCKED]' : '[LOCKED]'}</span>
      </li>
    `;
  }).join('');
}
renderReaderTrophies();

// Any reset (from either New Game button) also collapses reader-mode stages.
store.subscribe((_state, delta) => {
  renderReaderTrophies();
  if (delta === null) lensesHandle?.collapseAllStages();
});

// Reader-mode contact section is the same objective as the game mailbox:
// both dispatch openMailbox (+10 once).
const contactSection = document.getElementById('contact-section');
if (contactSection) {
  const triggerContactXp = (): void => {
    store.dispatch({ type: 'openMailbox' });
  };

  // Trigger on click, focusin, or scroll into view
  contactSection.addEventListener('click', triggerContactXp);
  contactSection.addEventListener('focusin', triggerContactXp);

  contactSection.querySelectorAll('a, button').forEach((elem) => {
    elem.addEventListener('click', triggerContactXp);
  });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((intersections) => {
      for (const entry of intersections) {
        if (entry.isIntersecting) {
          triggerContactXp();
        }
      }
    });
    observer.observe(contactSection);
  }
}

// Global Konami Code Listener
const keyHistory: string[] = [];
window.addEventListener('keydown', (e: KeyboardEvent) => {
  keyHistory.push(e.key);
  if (keyHistory.length > 20) {
    keyHistory.shift();
  }

  if (checkKonamiCode(keyHistory)) {
    store.dispatch({ type: 'unlockKonami' });
  }
});
