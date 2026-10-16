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

export const MAX_XP = 100;

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
  { id: 'first-steps', name: 'First Steps', description: 'Open any stage' },
  {
    id: 'full-stack-curious',
    name: 'Full-Stack Curious',
    description: 'Use the Full-stack lens',
  },
  { id: 'data-nerd', name: 'Data Nerd', description: 'Use the Data & ML lens' },
  {
    id: 'leader-of-the-pack',
    name: 'Leader of the Pack',
    description: 'Use the Leadership lens',
  },
  { id: 'completionist', name: 'Completionist', description: 'Open every stage' },
  { id: 'cloud-watcher', name: 'Cloud Watcher', description: 'Use the Cloud lens' },
  {
    id: 'secret-handshake',
    name: 'Secret Handshake',
    description: 'Konami code entered: 30 extra lives granted! (Easter egg unlocked)',
  },
] as const;

export const ACHIEVEMENT_IDS = new Set<string>(ACHIEVEMENTS.map((a) => a.id));

export interface ProgressState {
  readonly xp: number;
  readonly openedStages: readonly string[];
  readonly usedLenses: readonly string[];
  readonly searchUsed: boolean;
  readonly contactOpened: boolean;
  readonly achievements: readonly AchievementId[];
}

export const INITIAL_PROGRESS_STATE: ProgressState = Object.freeze({
  xp: 0,
  openedStages: [],
  usedLenses: [],
  searchUsed: false,
  contactOpened: false,
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

  const nextState: ProgressState = {
    ...state,
    ...fieldUpdates,
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

export function openStage(
  state: ProgressState,
  stageId: string,
  allStageIds: readonly string[],
): ProgressDelta {
  if (state.openedStages.includes(stageId)) {
    return {
      nextState: state,
      xpGained: 0,
      unlockedAchievements: [],
      levelUp: null,
    };
  }

  const nextOpened = [...state.openedStages, stageId];
  const newAchievements: AchievementId[] = [];

  if (state.openedStages.length === 0) {
    newAchievements.push('first-steps');
  }

  const allOpened =
    allStageIds.length > 0 && allStageIds.every((id) => nextOpened.includes(id));
  if (allOpened) {
    newAchievements.push('completionist');
  }

  return updateState(state, 10, newAchievements, { openedStages: nextOpened });
}

export function useLens(state: ProgressState, lensId: string): ProgressDelta {
  if (state.usedLenses.includes(lensId)) {
    return {
      nextState: state,
      xpGained: 0,
      unlockedAchievements: [],
      levelUp: null,
    };
  }

  const nextUsed = [...state.usedLenses, lensId];
  const newAchievements: AchievementId[] = [];

  if (lensId === 'fullstack') newAchievements.push('full-stack-curious');
  if (lensId === 'data') newAchievements.push('data-nerd');
  if (lensId === 'leadership') newAchievements.push('leader-of-the-pack');
  if (lensId === 'cloud') newAchievements.push('cloud-watcher');

  return updateState(state, 5, newAchievements, { usedLenses: nextUsed });
}

export function useSearch(state: ProgressState): ProgressDelta {
  if (state.searchUsed) {
    return {
      nextState: state,
      xpGained: 0,
      unlockedAchievements: [],
      levelUp: null,
    };
  }

  return updateState(state, 5, [], { searchUsed: true });
}

export function openContact(state: ProgressState): ProgressDelta {
  if (state.contactOpened) {
    return {
      nextState: state,
      xpGained: 0,
      unlockedAchievements: [],
      levelUp: null,
    };
  }

  return updateState(state, 5, [], { contactOpened: true });
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
    const openedStages = Array.isArray(parsed.openedStages)
      ? parsed.openedStages.filter((s: unknown) => typeof s === 'string')
      : [];
    const usedLenses = Array.isArray(parsed.usedLenses)
      ? parsed.usedLenses.filter((l: unknown) => typeof l === 'string')
      : [];
    const searchUsed = Boolean(parsed.searchUsed);
    const contactOpened = Boolean(parsed.contactOpened);
    const achievements = Array.isArray(parsed.achievements)
      ? parsed.achievements.filter(
          (id: unknown) => typeof id === 'string' && ACHIEVEMENT_IDS.has(id),
        )
      : [];

    return {
      xp,
      openedStages: Array.from(new Set(openedStages)),
      usedLenses: Array.from(new Set(usedLenses)),
      searchUsed,
      contactOpened,
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
