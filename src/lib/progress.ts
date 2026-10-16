export type LevelName = 'Rookie' | 'Scout' | 'Builder' | 'Engineer' | 'Maxed Out';

export interface LevelThreshold {
  readonly level: LevelName;
  readonly minXp: number;
}

export const LEVEL_THRESHOLDS: readonly LevelThreshold[] = [
  { level: 'Rookie', minXp: 0 },
  { level: 'Scout', minXp: 20 },
  { level: 'Builder', minXp: 45 },
  { level: 'Engineer', minXp: 75 },
  { level: 'Maxed Out', minXp: 100 },
] as const;

export const TOTAL_BUILDINGS = 7;
export const TOTAL_CLASSES = 4;
export const XP_PER_BUILDING = 10;
export const XP_PER_CLASS = 5;
export const XP_MAILBOX = 10;

/**
 * Max XP is computed from data: 7 buildings x 10 + 4 classes x 5 + 1 mailbox x 10 = exactly 100.
 */
export const MAX_XP =
  TOTAL_BUILDINGS * XP_PER_BUILDING + TOTAL_CLASSES * XP_PER_CLASS + XP_MAILBOX;

export type AchievementId =
  | 'first-steps'
  | 'full-stack-curious'
  | 'data-nerd'
  | 'leader-of-the-pack'
  | 'completionist'
  | 'cloud-watcher'
  | 'secret-handshake';

export interface Achievement {
  readonly id: AchievementId;
  readonly name: string;
  readonly description: string;
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: 'first-steps', name: 'First Steps', description: 'Enter any building' },
  {
    id: 'full-stack-curious',
    name: 'Full-Stack Curious',
    description: 'Choose the Full-stack class',
  },
  { id: 'data-nerd', name: 'Data Nerd', description: 'Choose the Data & ML class' },
  {
    id: 'leader-of-the-pack',
    name: 'Leader of the Pack',
    description: 'Choose the Leadership class',
  },
  { id: 'completionist', name: 'Completionist', description: 'Explore all 7 buildings' },
  { id: 'cloud-watcher', name: 'Cloud Watcher', description: 'Choose the Cloud class' },
  {
    id: 'secret-handshake',
    name: 'Secret Handshake',
    description: 'Konami code entered: 30 extra lives granted! (Easter egg unlocked)',
  },
] as const;

export const ACHIEVEMENT_IDS = new Set<string>(ACHIEVEMENTS.map((a) => a.id));

export const VALID_CLASSES = ['data', 'fullstack', 'leadership', 'cloud'] as const;
export type ValidClassId = (typeof VALID_CLASSES)[number];

export interface ProgressState {
  readonly xp: number;
  readonly visitedBuildings: readonly string[];
  /** Alias for visitedBuildings for reader mode compatibility */
  readonly openedStages: readonly string[];
  readonly chosenClasses: readonly string[];
  /** Alias for chosenClasses for reader mode compatibility */
  readonly usedLenses: readonly string[];
  readonly mailboxOpened: boolean;
  /** Alias for mailboxOpened for reader mode compatibility */
  readonly contactOpened: boolean;
  readonly searchUsed: boolean;
  readonly achievements: readonly AchievementId[];
}

export const INITIAL_PROGRESS_STATE: ProgressState = Object.freeze({
  xp: 0,
  visitedBuildings: [],
  openedStages: [],
  chosenClasses: [],
  usedLenses: [],
  mailboxOpened: false,
  contactOpened: false,
  searchUsed: false,
  achievements: [],
});

export const STORAGE_KEY = 'cartridge-progress-v1';

export function getLevel(xp: number): LevelName {
  let currentLevel: LevelName = 'Rookie';
  for (const item of LEVEL_THRESHOLDS) {
    if (xp >= item.minXp) {
      currentLevel = item.level;
    }
  }
  return currentLevel;
}

export interface ProgressDelta {
  readonly nextState: ProgressState;
  readonly xpGained: number;
  readonly unlockedAchievements: readonly AchievementId[];
  readonly levelUp: LevelName | null;
}

function updateState(
  state: ProgressState,
  addedXp: number,
  newAchievements: AchievementId[],
  fieldUpdates: Partial<ProgressState>,
): ProgressDelta {
  const nextXp = Math.min(MAX_XP, state.xp + addedXp);
  const oldLevel = getLevel(state.xp);
  const nextLevel = getLevel(nextXp);

  const existingAchievements = new Set(state.achievements);
  const genuinelyNewAchievements: AchievementId[] = [];
  for (const ach of newAchievements) {
    if (!existingAchievements.has(ach)) {
      genuinelyNewAchievements.push(ach);
      existingAchievements.add(ach);
    }
  }

  const nextVisited = fieldUpdates.visitedBuildings ?? state.visitedBuildings;
  const nextClasses = fieldUpdates.chosenClasses ?? state.chosenClasses;
  const nextMailbox = fieldUpdates.mailboxOpened ?? state.mailboxOpened;

  const nextState: ProgressState = {
    ...state,
    ...fieldUpdates,
    visitedBuildings: nextVisited,
    openedStages: nextVisited,
    chosenClasses: nextClasses,
    usedLenses: nextClasses,
    mailboxOpened: nextMailbox,
    contactOpened: nextMailbox,
    xp: nextXp,
    achievements: Array.from(existingAchievements),
  };

  const levelUp = nextLevel !== oldLevel ? nextLevel : null;

  return {
    nextState,
    xpGained: nextXp - state.xp,
    unlockedAchievements: genuinelyNewAchievements,
    levelUp,
  };
}

/**
 * Enters a building. Awards +10 XP on the first visit (repeats = 0).
 * Unlocks "First Steps" on first building, and "Completionist" when all buildings are visited.
 */
export function visitBuilding(
  state: ProgressState,
  buildingId: string,
  allBuildingIds: readonly string[] = [],
): ProgressDelta {
  if (state.visitedBuildings.includes(buildingId)) {
    return {
      nextState: state,
      xpGained: 0,
      unlockedAchievements: [],
      levelUp: null,
    };
  }

  const nextVisited = [...state.visitedBuildings, buildingId];
  const newAchievements: AchievementId[] = [];

  if (state.visitedBuildings.length === 0) {
    newAchievements.push('first-steps');
  }

  const allDone =
    allBuildingIds.length > 0 && allBuildingIds.every((id) => nextVisited.includes(id));
  if (allDone) {
    newAchievements.push('completionist');
  }

  return updateState(state, XP_PER_BUILDING, newAchievements, {
    visitedBuildings: nextVisited,
  });
}

/** Alias for backward compatibility with reader mode stage expansion */
export const openStage = visitBuilding;

/**
 * Chooses a class on the Class Board signpost (or lens).
 * Awards +5 XP on the first selection for each of the 4 classes (repeats = 0).
 * Unlocks class-specific achievements:
 * - 'fullstack' -> 'full-stack-curious'
 * - 'data' -> 'data-nerd'
 * - 'leadership' -> 'leader-of-the-pack'
 * - 'cloud' -> 'cloud-watcher'
 */
export function chooseClass(state: ProgressState, classId: string): ProgressDelta {
  if (classId === 'all' || !VALID_CLASSES.includes(classId as ValidClassId)) {
    return {
      nextState: state,
      xpGained: 0,
      unlockedAchievements: [],
      levelUp: null,
    };
  }

  if (state.chosenClasses.includes(classId)) {
    return {
      nextState: state,
      xpGained: 0,
      unlockedAchievements: [],
      levelUp: null,
    };
  }

  const nextClasses = [...state.chosenClasses, classId];
  const newAchievements: AchievementId[] = [];

  if (classId === 'fullstack') newAchievements.push('full-stack-curious');
  if (classId === 'data') newAchievements.push('data-nerd');
  if (classId === 'leadership') newAchievements.push('leader-of-the-pack');
  if (classId === 'cloud') newAchievements.push('cloud-watcher');

  return updateState(state, XP_PER_CLASS, newAchievements, {
    chosenClasses: nextClasses,
  });
}

/** Alias for backward compatibility with reader mode lens toggle */
export const useLens = chooseClass;

/**
 * Opens the Mailbox (or contact info).
 * Awards +10 XP on the first interaction (repeats = 0).
 */
export function openMailbox(state: ProgressState): ProgressDelta {
  if (state.mailboxOpened) {
    return {
      nextState: state,
      xpGained: 0,
      unlockedAchievements: [],
      levelUp: null,
    };
  }

  return updateState(state, XP_MAILBOX, [], { mailboxOpened: true });
}

/** Alias for backward compatibility with reader mode contact opening */
export const openContact = openMailbox;

/** Kept for backwards compatibility; search no longer awards XP in the 100 XP game table. */
export function useSearch(state: ProgressState): ProgressDelta {
  if (state.searchUsed) {
    return {
      nextState: state,
      xpGained: 0,
      unlockedAchievements: [],
      levelUp: null,
    };
  }

  return updateState(state, 0, [], { searchUsed: true });
}

export const KONAMI_CODE = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
] as const;

export function checkKonamiCode(buffer: readonly string[]): boolean {
  if (buffer.length < KONAMI_CODE.length) return false;
  const slice = buffer.slice(-KONAMI_CODE.length);
  return KONAMI_CODE.every((key, i) => slice[i]?.toLowerCase() === key.toLowerCase());
}

export function unlockKonami(state: ProgressState): ProgressDelta {
  if (state.achievements.includes('secret-handshake')) {
    return {
      nextState: state,
      xpGained: 0,
      unlockedAchievements: [],
      levelUp: null,
    };
  }

  return updateState(state, 0, ['secret-handshake'], {});
}

export function serializeProgress(state: ProgressState): string {
  return JSON.stringify(state);
}

export function deserializeProgress(raw: string | null): ProgressState {
  if (!raw) return { ...INITIAL_PROGRESS_STATE };
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return { ...INITIAL_PROGRESS_STATE };
    }

    const xp =
      typeof parsed.xp === 'number' && parsed.xp >= 0 ? Math.min(MAX_XP, parsed.xp) : 0;

    const rawBuildings = Array.isArray(parsed.visitedBuildings)
      ? parsed.visitedBuildings
      : Array.isArray(parsed.openedStages)
        ? parsed.openedStages
        : [];
    const visitedBuildings: string[] = Array.from(
      new Set(rawBuildings.filter((s: unknown): s is string => typeof s === 'string')),
    );

    const rawClasses = Array.isArray(parsed.chosenClasses)
      ? parsed.chosenClasses
      : Array.isArray(parsed.usedLenses)
        ? parsed.usedLenses
        : [];
    const chosenClasses: string[] = Array.from(
      new Set(rawClasses.filter((l: unknown): l is string => typeof l === 'string')),
    );

    const mailboxOpened = Boolean(parsed.mailboxOpened ?? parsed.contactOpened);
    const searchUsed = Boolean(parsed.searchUsed);

    const achievements = Array.isArray(parsed.achievements)
      ? parsed.achievements.filter(
          (id: unknown) => typeof id === 'string' && ACHIEVEMENT_IDS.has(id),
        )
      : [];

    return {
      xp,
      visitedBuildings,
      openedStages: visitedBuildings,
      chosenClasses,
      usedLenses: chosenClasses,
      mailboxOpened,
      contactOpened: mailboxOpened,
      searchUsed,
      achievements: Array.from(new Set(achievements as AchievementId[])),
    };
  } catch {
    return { ...INITIAL_PROGRESS_STATE };
  }
}

export function loadProgress(storage: Storage | null = null): ProgressState {
  if (!storage) return { ...INITIAL_PROGRESS_STATE };
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return deserializeProgress(raw);
  } catch {
    return { ...INITIAL_PROGRESS_STATE };
  }
}

export function saveProgress(state: ProgressState, storage: Storage | null = null): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, serializeProgress(state));
  } catch {
    // Ignore storage write failures (private mode, quota, or storage disabled)
  }
}

export function clearProgress(storage: Storage | null = null): void {
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}
