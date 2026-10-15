import { describe, expect, it } from 'vitest';
import {
  checkKonamiCode,
  clearProgress,
  deserializeProgress,
  getLevel,
  INITIAL_PROGRESS_STATE,
  loadProgress,
  MAX_XP,
  openContact,
  openStage,
  saveProgress,
  serializeProgress,
  unlockKonami,
  useLens,
  useSearch,
  type ProgressState,
} from '../src/lib/progress';

describe('Progress Engine Unit Tests', () => {
  const allStages = ['s1', 's2', 's3', 's4', 's5', 's6', 's7'];

  it('first stage open grants +10 and unlocks First Steps', () => {
    const delta = openStage(INITIAL_PROGRESS_STATE, 's1', allStages);
    expect(delta.xpGained).toBe(10);
    expect(delta.nextState.xp).toBe(10);
    expect(delta.unlockedAchievements).toContain('first-steps');
    expect(delta.nextState.achievements).toContain('first-steps');
    expect(delta.nextState.openedStages).toEqual(['s1']);
  });

  it('repeat open grants 0 XP and no new achievements', () => {
    const delta1 = openStage(INITIAL_PROGRESS_STATE, 's1', allStages);
    const delta2 = openStage(delta1.nextState, 's1', allStages);
    expect(delta2.xpGained).toBe(0);
    expect(delta2.nextState.xp).toBe(10);
    expect(delta2.unlockedAchievements).toHaveLength(0);
  });

  it('first use of each lens grants +5, repeat grants 0', () => {
    let state = INITIAL_PROGRESS_STATE;
    const delta1 = useLens(state, 'fullstack');
    expect(delta1.xpGained).toBe(5);
    expect(delta1.nextState.xp).toBe(5);
    expect(delta1.unlockedAchievements).toContain('full-stack-curious');
    state = delta1.nextState;

    const deltaRepeat = useLens(state, 'fullstack');
    expect(deltaRepeat.xpGained).toBe(0);
    expect(deltaRepeat.nextState.xp).toBe(5);
    expect(deltaRepeat.unlockedAchievements).toHaveLength(0);

    const deltaData = useLens(state, 'data');
    expect(deltaData.xpGained).toBe(5);
    expect(deltaData.unlockedAchievements).toContain('data-nerd');
    state = deltaData.nextState;

    const deltaLead = useLens(state, 'leadership');
    expect(deltaLead.xpGained).toBe(5);
    expect(deltaLead.unlockedAchievements).toContain('leader-of-the-pack');
    state = deltaLead.nextState;

    const deltaCloud = useLens(state, 'cloud');
    expect(deltaCloud.xpGained).toBe(5);
    expect(deltaCloud.unlockedAchievements).toContain('cloud-watcher');
    state = deltaCloud.nextState;

    expect(state.xp).toBe(20);
  });

  it('first use of search grants +5, repeat grants 0', () => {
    const d1 = useSearch(INITIAL_PROGRESS_STATE);
    expect(d1.xpGained).toBe(5);
    expect(d1.nextState.xp).toBe(5);
    expect(d1.nextState.searchUsed).toBe(true);

    const d2 = useSearch(d1.nextState);
    expect(d2.xpGained).toBe(0);
    expect(d2.nextState.xp).toBe(5);
  });

  it('first opening of contact grants +5, repeat grants 0', () => {
    const d1 = openContact(INITIAL_PROGRESS_STATE);
    expect(d1.xpGained).toBe(5);
    expect(d1.nextState.xp).toBe(5);
    expect(d1.nextState.contactOpened).toBe(true);

    const d2 = openContact(d1.nextState);
    expect(d2.xpGained).toBe(0);
    expect(d2.nextState.xp).toBe(5);
  });

  it('level thresholds map to the right level at boundaries (19, 20, 44, 45, 99, 100)', () => {
    expect(getLevel(0)).toBe('Rookie');
    expect(getLevel(19)).toBe('Rookie');
    expect(getLevel(20)).toBe('Scout');
    expect(getLevel(44)).toBe('Scout');
    expect(getLevel(45)).toBe('Builder');
    expect(getLevel(74)).toBe('Builder');
    expect(getLevel(75)).toBe('Engineer');
    expect(getLevel(99)).toBe('Engineer');
    expect(getLevel(100)).toBe('Maxed Out');
  });

  it('XP never exceeds the max of 100', () => {
    const state: ProgressState = {
      ...INITIAL_PROGRESS_STATE,
      xp: 95,
    };
    const delta = openStage(state, 'stageX', allStages);
    expect(delta.xpGained).toBe(5);
    expect(delta.nextState.xp).toBe(MAX_XP);

    const deltaOver = openStage(delta.nextState, 'stageY', allStages);
    expect(deltaOver.xpGained).toBe(0);
    expect(deltaOver.nextState.xp).toBe(MAX_XP);
  });

  it('Completionist unlocks only after every stage is opened', () => {
    let state = INITIAL_PROGRESS_STATE;
    const stagesToOpen = allStages.slice(0, -1);
    const lastStage = allStages[allStages.length - 1];
    expect(lastStage).toBeDefined();
    if (!lastStage) return;

    for (const stageId of stagesToOpen) {
      const d = openStage(state, stageId, allStages);
      state = d.nextState;
      expect(state.achievements).not.toContain('completionist');
    }
    const finalDelta = openStage(state, lastStage, allStages);
    expect(finalDelta.unlockedAchievements).toContain('completionist');
    expect(finalDelta.nextState.achievements).toContain('completionist');
  });

  it('Konami sequence unlocks Secret Handshake only with the exact sequence', () => {
    const valid = [
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
    ];
    expect(checkKonamiCode(valid)).toBe(true);

    // With prefix
    expect(checkKonamiCode(['x', 'y', ...valid])).toBe(true);

    // Wrong order
    expect(
      checkKonamiCode([
        'ArrowUp',
        'ArrowDown',
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'ArrowLeft',
        'ArrowRight',
        'b',
        'a',
      ]),
    ).toBe(false);

    // Partial sequence
    expect(checkKonamiCode(valid.slice(0, 9))).toBe(false);

    // Unlocking
    const d1 = unlockKonami(INITIAL_PROGRESS_STATE);
    expect(d1.unlockedAchievements).toContain('secret-handshake');
    expect(d1.nextState.achievements).toContain('secret-handshake');

    const d2 = unlockKonami(d1.nextState);
    expect(d2.unlockedAchievements).toHaveLength(0);
  });

  it('serialize/deserialize round-trip', () => {
    const state: ProgressState = {
      xp: 45,
      openedStages: ['s1', 's2'],
      usedLenses: ['data'],
      searchUsed: true,
      contactOpened: false,
      achievements: ['first-steps', 'data-nerd'],
    };
    const serialized = serializeProgress(state);
    const restored = deserializeProgress(serialized);
    expect(restored).toEqual(state);
  });

  it('corrupt JSON, wrong types, and unknown achievement IDs fall back to a fresh state without throwing', () => {
    expect(deserializeProgress('invalid json {{{')).toEqual(INITIAL_PROGRESS_STATE);
    expect(deserializeProgress(null)).toEqual(INITIAL_PROGRESS_STATE);
    expect(deserializeProgress('42')).toEqual(INITIAL_PROGRESS_STATE);
    expect(deserializeProgress('{"xp": "lots"}')).toEqual({
      ...INITIAL_PROGRESS_STATE,
      xp: 0,
    });
    expect(
      deserializeProgress(
        JSON.stringify({
          xp: 150,
          achievements: ['fake-achievement', 'first-steps'],
          openedStages: ['s1', 123],
        }),
      ),
    ).toEqual({
      xp: 100,
      openedStages: ['s1'],
      usedLenses: [],
      searchUsed: false,
      contactOpened: false,
      achievements: ['first-steps'],
    });
  });

  it('reset / clear returns the initial state', () => {
    const store = new Map<string, string>();
    const mockStorage: Storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
      clear: () => {
        store.clear();
      },
      length: 0,
      key: () => null,
    };

    const state: ProgressState = {
      xp: 35,
      openedStages: ['s1'],
      usedLenses: ['data'],
      searchUsed: true,
      contactOpened: true,
      achievements: ['first-steps', 'data-nerd'],
    };

    saveProgress(state, mockStorage);
    expect(loadProgress(mockStorage)).toEqual(state);

    clearProgress(mockStorage);
    expect(loadProgress(mockStorage)).toEqual(INITIAL_PROGRESS_STATE);
  });
});
