import { BUILDINGS } from '../data/world';
import {
  chooseClass,
  clearProgress,
  deserializeProgress,
  INITIAL_PROGRESS_STATE,
  loadProgress,
  openMailbox,
  saveProgress,
  serializeProgress,
  unlockKonami,
  visitBuilding,
  type ProgressDelta,
  type ProgressState,
} from './progress';

/**
 * Every progress change in the app is one of these actions. Each maps to exactly
 * one pure function in progress.ts, so game mode and reader mode award identical XP.
 */
export type ProgressAction =
  | { readonly type: 'visitBuilding'; readonly buildingId: string }
  | { readonly type: 'chooseClass'; readonly classId: string }
  | { readonly type: 'openMailbox' }
  | { readonly type: 'unlockKonami' };

/**
 * Listener receives the new state plus the delta that produced it.
 * `delta` is null when the change came from reset().
 */
export type ProgressListener = (
  state: ProgressState,
  delta: ProgressDelta | null,
) => void;

export interface ProgressStore {
  getState(): ProgressState;
  dispatch(action: ProgressAction): ProgressDelta;
  /**
   * Commits a delta that was computed from getState() by one of the pure
   * progress functions. The state is re-derived (xp recomputed from flags)
   * before it is stored, so a commit can never introduce an inconsistent xp.
   */
  commit(delta: ProgressDelta): void;
  reset(): void;
  subscribe(listener: ProgressListener): () => void;
}

export interface ProgressStoreOptions {
  storage?: Storage | null;
  allBuildingIds?: readonly string[];
}

const DEFAULT_BUILDING_IDS: readonly string[] = BUILDINGS.map((b) => b.id);

export function createProgressStore(options: ProgressStoreOptions = {}): ProgressStore {
  const storage = options.storage ?? null;
  const allBuildingIds = options.allBuildingIds ?? DEFAULT_BUILDING_IDS;
  let state: ProgressState = loadProgress(storage);
  const listeners = new Set<ProgressListener>();

  const notify = (delta: ProgressDelta | null): void => {
    for (const listener of Array.from(listeners)) {
      listener(state, delta);
    }
  };

  const reduce = (current: ProgressState, action: ProgressAction): ProgressDelta => {
    switch (action.type) {
      case 'visitBuilding':
        return visitBuilding(current, action.buildingId, allBuildingIds);
      case 'chooseClass':
        return chooseClass(current, action.classId);
      case 'openMailbox':
        return openMailbox(current);
      case 'unlockKonami':
        return unlockKonami(current);
    }
  };

  const commit = (delta: ProgressDelta): void => {
    if (delta.nextState === state) return;
    // Round-trip through the deserializer so xp is always computeXp(flags).
    const next = deserializeProgress(serializeProgress(delta.nextState));
    const prevXp = state.xp;
    state = next;
    saveProgress(state, storage);
    notify({ ...delta, nextState: next, xpGained: Math.max(0, next.xp - prevXp) });
  };

  return {
    getState: () => state,
    dispatch: (action) => {
      const delta = reduce(state, action);
      commit(delta);
      return delta;
    },
    commit,
    reset: () => {
      clearProgress(storage);
      state = { ...INITIAL_PROGRESS_STATE };
      notify(null);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
