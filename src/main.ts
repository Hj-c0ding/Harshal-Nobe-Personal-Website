import '@fontsource/silkscreen/400.css';
import '@fontsource/silkscreen/700.css';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import './styles/main.css';

import { entries } from './data/entries';
import { checkKonamiCode } from './lib/progress';
import { createProgressStore } from './lib/store';
import { mountHud } from './ui/hud';
import { mountLenses } from './ui/lenses';

import { mountGame } from './ui/game';

// The ONE progress store for the whole page. Canvas game, HUD and reader mode
// all read and write through it; nothing else holds a copy of progress.
const store = createProgressStore({ storage: window.localStorage });

// Mount Playable Canvas Game
const gameRoot = document.getElementById('game-root');
export const gameHandle = gameRoot ? mountGame(gameRoot, { store }) : null;

// Mount HUD
const hudRoot = document.getElementById('hud-root');
mountHud(hudRoot ?? document.createElement('div'), { store });

// Mount Lenses & Stage Select (reader mode)
const root = document.getElementById('lenses-root');
const lensesHandle = root
  ? mountLenses(root, entries, window, {
      onStageExpand: (stageId: string) => {
        store.dispatch({ type: 'visitBuilding', buildingId: stageId });
      },
      onLensUse: (lensId: string) => {
        store.dispatch({ type: 'chooseClass', classId: lensId });
      },
    })
  : null;

// Any reset (from either New Game button) also collapses reader-mode stages.
store.subscribe((_state, delta) => {
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
