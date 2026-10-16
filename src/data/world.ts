export interface Position {
  readonly x: number;
  readonly y: number;
}

export interface BuildingDef {
  readonly id: string;
  readonly name: string;
  readonly tiles: readonly Position[];
  readonly door: Position;
}

export const MAP_WIDTH = 20;
export const MAP_HEIGHT = 14;

/**
 * 20 columns x 14 rows top-down tile map of HARSHAL'S CAMPUS.
 *
 * Legend:
 * '#' = Solid wall/border
 * 'T' = Solid tree
 * '~' = Solid water
 * 'B' = Solid building structure
 * 'D' = Building door (solid; interact when standing adjacent)
 * 'S' = Class board signpost (solid; interact when standing adjacent)
 * 'M' = Mailbox (solid; interact when standing adjacent)
 * 'G' = Final gate (solid until 100 XP, then walkable)
 * '.' = Walkable grass
 * '=' = Walkable stone path
 */
export const MAP_ASCII: readonly string[] = [
  '####################', // y = 0
  '#TTTTTT###G###TTTTT#', // y = 1 (Gate at 10, 1)
  '#BBB..~~..=...~~BBB#', // y = 2 (IDX left, ISU right)
  '#BDB..~~..=...~~BDB#', // y = 3 (IDX door 2,3; ISU door 17,3)
  '#==================#', // y = 4 (North walkway)
  '#..T...S..=.M...T..#', // y = 5 (Board 7,5; Mailbox 12,5)
  '#BBB......=.....BBB#', // y = 6 (Fynder left, Backline right; Spawn 10,6)
  '#BDB......=.....BDB#', // y = 7 (Fynder door 2,7; Backline door 17,7)
  '#==================#', // y = 8 (Mid-south walkway)
  '#..=......=......=.#', // y = 9 (Walkway connectors)
  '#BDB.....DB.....BDB#', // y = 10 (FBLA door 2,10; AWS door 9,10; TSA door 17,10)
  '#BBB.....BB.....BBB#', // y = 11
  '#TTT.....TT.....TTT#', // y = 12
  '####################', // y = 13
] as const;

export const SPAWN_POSITION: Position = Object.freeze({ x: 10, y: 6 });
export const BOARD_POSITION: Position = Object.freeze({ x: 7, y: 5 });
export const MAILBOX_POSITION: Position = Object.freeze({ x: 12, y: 5 });
export const GATE_POSITION: Position = Object.freeze({ x: 10, y: 1 });

export const BUILDINGS: readonly BuildingDef[] = [
  {
    id: 'idx-exchange',
    name: 'IDX Exchange',
    tiles: [
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 1, y: 3 },
      { x: 2, y: 3 },
      { x: 3, y: 3 },
    ],
    door: { x: 2, y: 3 },
  },
  {
    id: 'illinois-state',
    name: 'Illinois State University lab',
    tiles: [
      { x: 16, y: 2 },
      { x: 17, y: 2 },
      { x: 18, y: 2 },
      { x: 16, y: 3 },
      { x: 17, y: 3 },
      { x: 18, y: 3 },
    ],
    door: { x: 17, y: 3 },
  },
  {
    id: 'fynder',
    name: 'Fynder',
    tiles: [
      { x: 1, y: 6 },
      { x: 2, y: 6 },
      { x: 3, y: 6 },
      { x: 1, y: 7 },
      { x: 2, y: 7 },
      { x: 3, y: 7 },
    ],
    door: { x: 2, y: 7 },
  },
  {
    id: 'backline',
    name: 'Backline',
    tiles: [
      { x: 16, y: 6 },
      { x: 17, y: 6 },
      { x: 18, y: 6 },
      { x: 16, y: 7 },
      { x: 17, y: 7 },
      { x: 18, y: 7 },
    ],
    door: { x: 17, y: 7 },
  },
  {
    id: 'fbla',
    name: 'FBLA hall',
    tiles: [
      { x: 1, y: 10 },
      { x: 2, y: 10 },
      { x: 3, y: 10 },
      { x: 1, y: 11 },
      { x: 2, y: 11 },
      { x: 3, y: 11 },
    ],
    door: { x: 2, y: 10 },
  },
  {
    id: 'tsa',
    name: 'TSA hall',
    tiles: [
      { x: 16, y: 10 },
      { x: 17, y: 10 },
      { x: 18, y: 10 },
      { x: 16, y: 11 },
      { x: 17, y: 11 },
      { x: 18, y: 11 },
    ],
    door: { x: 17, y: 10 },
  },
  {
    id: 'aws-ccp',
    name: 'AWS tower',
    tiles: [
      { x: 9, y: 10 },
      { x: 10, y: 10 },
      { x: 9, y: 11 },
      { x: 10, y: 11 },
    ],
    door: { x: 9, y: 10 },
  },
] as const;

export const BUILDING_IDS: readonly string[] = BUILDINGS.map((b) => b.id);
