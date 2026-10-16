import { describe, expect, it } from 'vitest';
import {
  BOARD_POSITION,
  BUILDINGS,
  GATE_POSITION,
  MAILBOX_POSITION,
  MAP_HEIGHT,
  MAP_WIDTH,
  SPAWN_POSITION,
} from '../data/world';
import {
  getAdjacentInteractable,
  highlightedBuildings,
  isGateOpen,
  isTileWalkable,
  tryMove,
  type WorldState,
} from './world';

describe('World Logic and Navigation Tests', () => {
  it('spawn tile is walkable', () => {
    expect(isTileWalkable(SPAWN_POSITION.x, SPAWN_POSITION.y, 0)).toBe(true);
  });

  it('normal move onto walkable tile', () => {
    const start: WorldState = { x: 10, y: 6, xp: 0 };
    // Tile (10, 5) is a stone path
    const next = tryMove(start, 'up');
    expect(next).toEqual({ x: 10, y: 5, xp: 0 });

    // WASD and Arrow keys also work
    expect(tryMove(start, 'ArrowUp')).toEqual({ x: 10, y: 5, xp: 0 });
    expect(tryMove(start, 'w')).toEqual({ x: 10, y: 5, xp: 0 });
    expect(tryMove(start, 'W')).toEqual({ x: 10, y: 5, xp: 0 });
  });

  it('blocked by wall (position unchanged)', () => {
    // (1, 4) is walkable path; (0, 4) is perimeter wall '#'
    const start: WorldState = { x: 1, y: 4, xp: 0 };
    const next = tryMove(start, 'left');
    expect(next).toEqual({ x: 1, y: 4, xp: 0 });
  });

  it('blocked at each map edge (all 4 directions, edge case)', () => {
    // Left edge (x = 0) moving left
    expect(tryMove({ x: 0, y: 5, xp: 0 }, 'left')).toEqual({ x: 0, y: 5, xp: 0 });

    // Right edge (x = MAP_WIDTH - 1) moving right
    expect(tryMove({ x: MAP_WIDTH - 1, y: 5, xp: 0 }, 'right')).toEqual({
      x: MAP_WIDTH - 1,
      y: 5,
      xp: 0,
    });

    // Top edge (y = 0) moving up
    expect(tryMove({ x: 10, y: 0, xp: 0 }, 'up')).toEqual({ x: 10, y: 0, xp: 0 });

    // Bottom edge (y = MAP_HEIGHT - 1) moving down
    expect(tryMove({ x: 10, y: MAP_HEIGHT - 1, xp: 0 }, 'down')).toEqual({
      x: 10,
      y: MAP_HEIGHT - 1,
      xp: 0,
    });
  });

  it('cannot walk through a building structure or door', () => {
    // (2, 4) is walkway directly south of IDX door (2, 3) and walls (1, 3), (3, 3)
    const inFrontOfDoor: WorldState = { x: 2, y: 4, xp: 0 };
    // Moving into door tile (2, 3) is blocked because door is solid
    expect(tryMove(inFrontOfDoor, 'up')).toEqual({ x: 2, y: 4, xp: 0 });

    // Moving into wall tile (1, 3) from (1, 4) is blocked
    expect(tryMove({ x: 1, y: 4, xp: 0 }, 'up')).toEqual({ x: 1, y: 4, xp: 0 });
  });

  it('gate blocks at 99 XP and allows at 100', () => {
    expect(isGateOpen(99)).toBe(false);
    expect(isGateOpen(100)).toBe(true);

    // Gate is at (10, 1). Tile directly south is (10, 2).
    const inFrontOfGate99: WorldState = { x: 10, y: 2, xp: 99 };
    const blockedMove = tryMove(inFrontOfGate99, 'up');
    expect(blockedMove).toEqual({ x: 10, y: 2, xp: 99 });

    const inFrontOfGate100: WorldState = { x: 10, y: 2, xp: 100 };
    const allowedMove = tryMove(inFrontOfGate100, 'up');
    expect(allowedMove).toEqual({ x: 10, y: 1, xp: 100 });
  });

  it('adjacent to a door returns that building id for all 7 buildings', () => {
    // IDX Exchange: door at (2, 3) -> adjacent south at (2, 4)
    expect(getAdjacentInteractable({ x: 2, y: 4 })).toBe('idx-exchange');

    // Illinois State: door at (17, 3) -> adjacent south at (17, 4)
    expect(getAdjacentInteractable({ x: 17, y: 4 })).toBe('illinois-state');

    // Fynder: door at (2, 7) -> adjacent south at (2, 8)
    expect(getAdjacentInteractable({ x: 2, y: 8 })).toBe('fynder');

    // Backline: door at (17, 7) -> adjacent south at (17, 8)
    expect(getAdjacentInteractable({ x: 17, y: 8 })).toBe('backline');

    // FBLA hall: door at (2, 10) -> adjacent north at (2, 9)
    expect(getAdjacentInteractable({ x: 2, y: 9 })).toBe('fbla');

    // TSA hall: door at (17, 10) -> adjacent north at (17, 9)
    expect(getAdjacentInteractable({ x: 17, y: 9 })).toBe('tsa');

    // AWS tower: door at (9, 10) -> adjacent north at (9, 9)
    expect(getAdjacentInteractable({ x: 9, y: 9 })).toBe('aws-ccp');
  });

  it('adjacent to board, mailbox, and gate returns the correct interactable', () => {
    // Board is at (7, 5). Adjacent tile (7, 4) should return 'board'
    expect(getAdjacentInteractable({ x: 7, y: 4 })).toBe('board');

    // Mailbox is at (12, 5). Adjacent tile (12, 4) should return 'mailbox'
    expect(getAdjacentInteractable({ x: 12, y: 4 })).toBe('mailbox');

    // Gate is at (10, 1). Adjacent tile (10, 2) should return 'gate'
    expect(getAdjacentInteractable({ x: 10, y: 2 })).toBe('gate');
  });

  it('two tiles away returns null', () => {
    // (2, 5) is two tiles south of IDX door (2, 3)
    expect(getAdjacentInteractable({ x: 2, y: 5 })).toBeNull();

    // Spawn (10, 6) is not adjacent to any interactable
    expect(getAdjacentInteractable(SPAWN_POSITION)).toBeNull();
  });

  it('diagonal adjacency does NOT count', () => {
    // Door of IDX is at (2, 3). Tile (3, 4) is diagonally adjacent (dx=1, dy=1).
    expect(getAdjacentInteractable({ x: 3, y: 4 })).toBeNull();
    // Tile (1, 4) is diagonally adjacent to door (2, 3).
    expect(getAdjacentInteractable({ x: 1, y: 4 })).toBeNull();
  });

  it('invalid direction input is ignored safely without throwing', () => {
    const start: WorldState = { x: 10, y: 6, xp: 0 };
    expect(tryMove(start, 'jump')).toEqual(start);
    expect(tryMove(start, '')).toEqual(start);
    expect(tryMove(start, 'unknown-direction')).toEqual(start);
  });

  it('every building has a reachable door (BFS from spawn over walkable tiles reaches a tile adjacent to every door, board, mailbox, and gate)', () => {
    // BFS traversal
    const visited = new Set<string>();
    const queue: Array<{ x: number; y: number }> = [{ ...SPAWN_POSITION }];
    visited.add(`${SPAWN_POSITION.x},${SPAWN_POSITION.y}`);

    const reachableTiles: Array<{ x: number; y: number }> = [];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break;
      reachableTiles.push(current);

      const neighbors = [
        { x: current.x, y: current.y - 1 },
        { x: current.x, y: current.y + 1 },
        { x: current.x - 1, y: current.y },
        { x: current.x + 1, y: current.y },
      ];

      for (const neighbor of neighbors) {
        const key = `${neighbor.x},${neighbor.y}`;
        if (!visited.has(key) && isTileWalkable(neighbor.x, neighbor.y, 0)) {
          visited.add(key);
          queue.push(neighbor);
        }
      }
    }

    // Helper: is target adjacent to any reachable tile?
    const isTargetReachable = (target: { x: number; y: number }): boolean => {
      return reachableTiles.some(
        (tile) => Math.abs(tile.x - target.x) + Math.abs(tile.y - target.y) === 1,
      );
    };

    // Assert every building door is reached
    expect(BUILDINGS).toHaveLength(7);
    for (const building of BUILDINGS) {
      const reached = isTargetReachable(building.door);
      expect(
        reached,
        `Building "${building.name}" door at (${building.door.x}, ${building.door.y}) must be reachable from spawn`,
      ).toBe(true);
    }

    // Assert Board is reached
    expect(isTargetReachable(BOARD_POSITION)).toBe(true);

    // Assert Mailbox is reached
    expect(isTargetReachable(MAILBOX_POSITION)).toBe(true);

    // Assert Gate is reached
    expect(isTargetReachable(GATE_POSITION)).toBe(true);
  });

  it('highlightedBuildings correctly filters by class using lenses logic', () => {
    // Data & ML
    const dataBuildings = highlightedBuildings('data');
    expect(dataBuildings).toContain('idx-exchange');
    expect(dataBuildings).toContain('illinois-state');
    expect(dataBuildings).toContain('backline');
    expect(dataBuildings).not.toContain('fynder');

    // Full-stack
    const fullstackBuildings = highlightedBuildings('fullstack');
    expect(fullstackBuildings).toEqual(['fynder']);

    // Leadership
    const leadBuildings = highlightedBuildings('leadership');
    expect(leadBuildings).toContain('fbla');
    expect(leadBuildings).toContain('tsa');

    // Cloud
    const cloudBuildings = highlightedBuildings('cloud');
    expect(cloudBuildings).toContain('backline');
    expect(cloudBuildings).toContain('aws-ccp');

    // 'all', null, undefined return empty array (no highlight outline)
    expect(highlightedBuildings('all')).toEqual([]);
    expect(highlightedBuildings(null)).toEqual([]);
    expect(highlightedBuildings(undefined)).toEqual([]);
  });

  it('locked gate cannot be bypassed (BFS from spawn with the gate treated as solid must NOT reach any tile beyond the gate)', () => {
    const visited = new Set<string>();
    const queue: Array<{ x: number; y: number }> = [{ ...SPAWN_POSITION }];
    visited.add(`${SPAWN_POSITION.x},${SPAWN_POSITION.y}`);

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break;

      const neighbors = [
        { x: current.x, y: current.y - 1 },
        { x: current.x, y: current.y + 1 },
        { x: current.x - 1, y: current.y },
        { x: current.x + 1, y: current.y },
      ];

      for (const neighbor of neighbors) {
        const key = `${neighbor.x},${neighbor.y}`;
        // XP is 0, so gate is solid
        if (!visited.has(key) && isTileWalkable(neighbor.x, neighbor.y, 0)) {
          visited.add(key);
          queue.push(neighbor);
        }
      }
    }

    // Gate tile (10, 1) itself cannot be reached while locked
    expect(visited.has(`${GATE_POSITION.x},${GATE_POSITION.y}`)).toBe(false);

    // No tile beyond/behind the gate line (y <= 0) can be reached
    for (const key of visited) {
      const parts = key.split(',');
      const yStr = parts[1];
      if (yStr !== undefined) {
        const y = parseInt(yStr, 10);
        expect(y).toBeGreaterThan(0);
      }
    }
  });
});
