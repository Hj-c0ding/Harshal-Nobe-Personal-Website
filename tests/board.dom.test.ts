import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GATE_POSITION } from '../src/data/world';
import { highlightedBuildings, isGateOpen } from '../src/lib/world';
import { mountGame, type GameHandle } from '../src/ui/game';

let container: HTMLElement;
let game: GameHandle | undefined;

beforeEach(() => {
  window.localStorage.clear();

  // Minimal fake 2D canvas context
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

  document.body.innerHTML = '<div id="game-root"></div>';
  container = document.getElementById('game-root') as HTMLElement;
});

afterEach(() => {
  game?.destroy();
  game = undefined;
  document.body.innerHTML = '';
});

describe('Class Board and Game Completion DOM tests', () => {
  it('clicking each of the 4 classes awards +5 once, repeat awards 0, "All" awards 0 and clears highlight, and highlights update', () => {
    // Spawn at (7, 4) directly adjacent to board at (7, 5)
    game = mountGame(container, {
      initialState: { x: 7, y: 4, xp: 0 },
    });

    const boardDialog = container.querySelector(
      '#game-board-dialog',
    ) as HTMLDialogElement;
    expect(boardDialog).not.toBeNull();

    // Interact with board
    game.interact();

    const getClassBtn = (cls: string): HTMLButtonElement => {
      const btn = boardDialog.querySelector<HTMLButtonElement>(
        `button[data-class="${cls}"]`,
      );
      if (!btn) throw new Error(`Button with data-class="${cls}" not found`);
      return btn;
    };

    // 1. Data & ML
    const dataBtn = getClassBtn('data');
    dataBtn.click();

    expect(game.getProgress().xp).toBe(5);
    expect(game.getSelectedClass()).toBe('data');
    expect(dataBtn.getAttribute('aria-pressed')).toBe('true');
    expect(dataBtn.textContent).toContain('[Selected]');
    expect(highlightedBuildings('data')).toContain('idx-exchange');
    expect(highlightedBuildings('data')).toContain('illinois-state');
    expect(highlightedBuildings('data')).toContain('backline');

    // Repeat Data & ML
    dataBtn.click();
    expect(game.getProgress().xp).toBe(5);

    // 2. Full-stack
    const fullstackBtn = getClassBtn('fullstack');
    fullstackBtn.click();

    expect(game.getProgress().xp).toBe(10);
    expect(game.getSelectedClass()).toBe('fullstack');
    expect(fullstackBtn.getAttribute('aria-pressed')).toBe('true');
    expect(fullstackBtn.textContent).toContain('[Selected]');
    expect(dataBtn.getAttribute('aria-pressed')).toBe('false');
    expect(highlightedBuildings('fullstack')).toEqual(['fynder']);

    // Repeat Full-stack
    fullstackBtn.click();
    expect(game.getProgress().xp).toBe(10);

    // 3. Leadership
    const leadBtn = getClassBtn('leadership');
    leadBtn.click();

    expect(game.getProgress().xp).toBe(15);
    expect(game.getSelectedClass()).toBe('leadership');
    expect(leadBtn.getAttribute('aria-pressed')).toBe('true');
    expect(leadBtn.textContent).toContain('[Selected]');
    expect(fullstackBtn.getAttribute('aria-pressed')).toBe('false');
    expect(highlightedBuildings('leadership')).toContain('fbla');
    expect(highlightedBuildings('leadership')).toContain('tsa');

    // Repeat Leadership
    leadBtn.click();
    expect(game.getProgress().xp).toBe(15);

    // 4. Cloud
    const cloudBtn = getClassBtn('cloud');
    cloudBtn.click();

    expect(game.getProgress().xp).toBe(20);
    expect(game.getSelectedClass()).toBe('cloud');
    expect(cloudBtn.getAttribute('aria-pressed')).toBe('true');
    expect(cloudBtn.textContent).toContain('[Selected]');
    expect(leadBtn.getAttribute('aria-pressed')).toBe('false');
    expect(highlightedBuildings('cloud')).toContain('backline');
    expect(highlightedBuildings('cloud')).toContain('aws-ccp');

    // Repeat Cloud
    cloudBtn.click();
    expect(game.getProgress().xp).toBe(20);

    // 5. All (Show All)
    const allBtn = getClassBtn('all');
    allBtn.click();

    expect(game.getProgress().xp).toBe(20);
    expect(game.getSelectedClass()).toBe('all');
    expect(allBtn.getAttribute('aria-pressed')).toBe('true');
    expect(allBtn.textContent).toContain('[Selected]');
    expect(cloudBtn.getAttribute('aria-pressed')).toBe('false');
    expect(highlightedBuildings('all')).toEqual([]);
  });

  it('visiting all 7 buildings, all 4 classes, and mailbox gives exactly 100 XP and opens the final gate', () => {
    // 1. Visit each of the 7 buildings and interact
    // Building 1: IDX Exchange door (2, 3) -> adjacent (2, 4)
    game = mountGame(container, { initialState: { x: 2, y: 4, xp: 0 } });
    game.interact(); // enters IDX Exchange (+10)
    game.closeDialog();

    // Building 2: ISU door (17, 3) -> adjacent (17, 4)
    game.destroy();
    game = mountGame(container, { initialState: { x: 17, y: 4, xp: 10 } });
    game.interact(); // enters ISU (+10)
    game.closeDialog();

    // Building 3: Fynder door (2, 7) -> adjacent (2, 8)
    game.destroy();
    game = mountGame(container, { initialState: { x: 2, y: 8, xp: 20 } });
    game.interact(); // enters Fynder (+10)
    game.closeDialog();

    // Building 4: Backline door (17, 7) -> adjacent (17, 8)
    game.destroy();
    game = mountGame(container, { initialState: { x: 17, y: 8, xp: 30 } });
    game.interact(); // enters Backline (+10)
    game.closeDialog();

    // Building 5: FBLA door (2, 10) -> adjacent (2, 9)
    game.destroy();
    game = mountGame(container, { initialState: { x: 2, y: 9, xp: 40 } });
    game.interact(); // enters FBLA (+10)
    game.closeDialog();

    // Building 6: TSA door (17, 10) -> adjacent (17, 9)
    game.destroy();
    game = mountGame(container, { initialState: { x: 17, y: 9, xp: 50 } });
    game.interact(); // enters TSA (+10)
    game.closeDialog();

    // Building 7: AWS tower door (9, 10) -> adjacent (9, 9)
    game.destroy();
    game = mountGame(container, { initialState: { x: 9, y: 9, xp: 60 } });
    game.interact(); // enters AWS (+10)
    game.closeDialog();

    // Mailbox: (12, 5) -> adjacent (12, 4)
    game.destroy();
    game = mountGame(container, { initialState: { x: 12, y: 4, xp: 70 } });
    game.interact(); // opens mailbox (+10)
    game.closeDialog();

    expect(game.getProgress().xp).toBe(80);

    // Class Board: (7, 5) -> adjacent (7, 4)
    game.destroy();
    game = mountGame(container, { initialState: { x: 7, y: 4, xp: 80 } });
    game.interact();

    const boardDialog = container.querySelector(
      '#game-board-dialog',
    ) as HTMLDialogElement;
    boardDialog.querySelector<HTMLButtonElement>('button[data-class="data"]')?.click();
    boardDialog
      .querySelector<HTMLButtonElement>('button[data-class="fullstack"]')
      ?.click();
    boardDialog
      .querySelector<HTMLButtonElement>('button[data-class="leadership"]')
      ?.click();
    boardDialog.querySelector<HTMLButtonElement>('button[data-class="cloud"]')?.click();
    game.closeDialog();

    // Exactly 100 XP reached!
    expect(game.getProgress().xp).toBe(100);
    expect(isGateOpen(game.getProgress().xp)).toBe(true);

    // Gate at (10, 1). Move adjacent south at (10, 2)
    game.destroy();
    game = mountGame(container, { initialState: { x: 10, y: 2, xp: 100 } });

    // Move UP onto the gate
    game.move('up');
    expect(game.getState().x).toBe(GATE_POSITION.x);
    expect(game.getState().y).toBe(GATE_POSITION.y);

    // Ending dialog opened
    const endingDialog = container.querySelector(
      '#game-ending-dialog',
    ) as HTMLDialogElement;
    expect(endingDialog).not.toBeNull();
    expect(endingDialog.querySelector('.dialog-message')?.textContent).toContain(
      'You explored everything. Thanks for visiting.',
    );
  });
});
