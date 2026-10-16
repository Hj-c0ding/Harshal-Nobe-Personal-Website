import '@fontsource/silkscreen/400.css';
import '@fontsource/silkscreen/700.css';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import './styles/main.css';

import { entries } from './data/entries';
import {
  checkKonamiCode,
  openContact,
  openStage,
  unlockKonami,
  useLens,
  useSearch,
} from './lib/progress';
import { mountHud } from './ui/hud';
import { mountLenses } from './ui/lenses';

import { mountGame } from './ui/game';

const allStageIds = entries.map((e) => e.id);

// Mount Playable Canvas Game
const gameRoot = document.getElementById('game-root');
export const gameHandle = gameRoot
  ? mountGame(gameRoot, {
      onXpGain: (delta) => {
        if (hud) hud.applyDelta(delta);
      },
      onReset: () => {
        lensesHandle?.collapseAllStages();
      },
    })
  : null;

// Mount HUD
const hudRoot = document.getElementById('hud-root');
const hud = hudRoot
  ? mountHud(hudRoot, {
      onReset: () => {
        lensesHandle?.collapseAllStages();
      },
    })
  : null;

// Mount Lenses & Stage Select
const root = document.getElementById('lenses-root');
const lensesHandle = root
  ? mountLenses(root, entries, window, {
      onStageExpand: (stageId: string) => {
        if (!hud) return;
        const current = hud.getState();
        const delta = openStage(current, stageId, allStageIds);
        hud.applyDelta(delta);
        gameHandle?.applyDelta(delta);
      },
      onLensUse: (lensId: string) => {
        if (!hud) return;
        const current = hud.getState();
        const delta = useLens(current, lensId);
        hud.applyDelta(delta);
        gameHandle?.applyDelta(delta);
      },
      onSearchUse: () => {
        if (!hud) return;
        const current = hud.getState();
        const delta = useSearch(current);
        hud.applyDelta(delta);
        gameHandle?.applyDelta(delta);
      },
    })
  : null;

// Track opening contact section
const contactSection = document.getElementById('contact-section');
if (contactSection && hud) {
  const triggerContactXp = (): void => {
    const current = hud.getState();
    const delta = openContact(current);
    hud.applyDelta(delta);
    gameHandle?.applyDelta(delta);
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
    if (hud) {
      const current = hud.getState();
      const delta = unlockKonami(current);
      hud.applyDelta(delta);
      gameHandle?.applyDelta(delta);
    }
  }
});
