import { entries } from '../data/entries';
import {
  BOARD_POSITION,
  BUILDINGS,
  GATE_POSITION,
  MAILBOX_POSITION,
  MAP_ASCII,
  MAP_HEIGHT,
  MAP_WIDTH,
  type BuildingDef,
  type Position,
} from '../data/world';
import { filterEntries, type LensId, type LensState } from './lenses';

export type Direction =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'ArrowUp'
  | 'ArrowDown'
  | 'ArrowLeft'
  | 'ArrowRight'
  | 'w'
  | 'a'
  | 's'
  | 'd'
  | 'W'
  | 'A'
  | 'S'
  | 'D';

export interface WorldState {
  readonly x: number;
  readonly y: number;
  readonly xp?: number;
}

export type InteractableId = string; // building id, or 'board' | 'mailbox' | 'gate'

/**
 * Checks whether the final gate is open.
 * Unlocks once total XP reaches 100.
 */
export function isGateOpen(totalXp: number): boolean {
  return totalXp >= 100;
}

/**
 * Determines whether a map coordinate is walkable.
 * Solid tiles: walls (#), trees (T), water (~), buildings (B), doors (D),
 * class board (S), mailbox (M), and the gate (G) when totalXp < 100.
 * Walkable tiles: grass (.), path (=), and the gate (G) when totalXp >= 100.
 */
export function isTileWalkable(x: number, y: number, totalXp: number = 0): boolean {
  if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) {
    return false;
  }

  if (x === GATE_POSITION.x && y === GATE_POSITION.y) {
    return isGateOpen(totalXp);
  }

  const row = MAP_ASCII[y];
  if (!row) return false;
  const char = row[x];
  return char === '.' || char === '=';
}

/**
 * Attempts to move the player one tile in the given direction.
 * Blocked by solid tiles, map boundaries, and the locked gate (xp < 100).
 * Never throws: invalid direction or malformed state safely preserves position.
 */
export function tryMove(state: WorldState, direction: string): WorldState {
  if (!state || typeof state.x !== 'number' || typeof state.y !== 'number') {
    return state;
  }

  const xp = typeof state.xp === 'number' ? state.xp : 0;
  let dx = 0;
  let dy = 0;

  switch (direction) {
    case 'up':
    case 'ArrowUp':
    case 'w':
    case 'W':
      dy = -1;
      break;
    case 'down':
    case 'ArrowDown':
    case 's':
    case 'S':
      dy = 1;
      break;
    case 'left':
    case 'ArrowLeft':
    case 'a':
    case 'A':
      dx = -1;
      break;
    case 'right':
    case 'ArrowRight':
    case 'd':
    case 'D':
      dx = 1;
      break;
    default:
      return { ...state, xp };
  }

  const targetX = state.x + dx;
  const targetY = state.y + dy;

  if (!isTileWalkable(targetX, targetY, xp)) {
    return { ...state, xp };
  }

  return {
    ...state,
    x: targetX,
    y: targetY,
    xp,
  };
}

/**
 * Returns the interactable ID if the player is orthogonally adjacent
 * to a building door, the class board, the mailbox, or the gate.
 * Returns null if no interactable is adjacent, or if the tile is only diagonally adjacent.
 */
export function getAdjacentInteractable(
  state: Pick<WorldState, 'x' | 'y'>,
): InteractableId | null {
  if (!state || typeof state.x !== 'number' || typeof state.y !== 'number') {
    return null;
  }

  // Stepping directly onto the gate tile (when open)
  if (state.x === GATE_POSITION.x && state.y === GATE_POSITION.y) {
    return 'gate';
  }

  const cardinalOffsets: readonly Position[] = [
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
  ];

  for (const offset of cardinalOffsets) {
    const nx = state.x + offset.x;
    const ny = state.y + offset.y;

    // Check doors
    const building: BuildingDef | undefined = BUILDINGS.find(
      (b) => b.door.x === nx && b.door.y === ny,
    );
    if (building) {
      return building.id;
    }

    // Check Board
    if (BOARD_POSITION.x === nx && BOARD_POSITION.y === ny) {
      return 'board';
    }

    // Check Mailbox
    if (MAILBOX_POSITION.x === nx && MAILBOX_POSITION.y === ny) {
      return 'mailbox';
    }

    // Check Gate
    if (GATE_POSITION.x === nx && GATE_POSITION.y === ny) {
      return 'gate';
    }
  }

  return null;
}

/**
 * Returns building IDs matching the selected class using the lenses filter logic.
 * If 'all', null, or empty, returns an empty array (no highlight outline).
 */
export function highlightedBuildings(
  selectedClass?: LensId | 'all' | null,
): readonly string[] {
  if (!selectedClass || selectedClass === 'all') {
    return [];
  }

  const state: LensState = {
    lenses: [selectedClass],
    query: '',
  };

  return filterEntries(entries, state).map((entry) => entry.id);
}
