import { describe, expect, it } from 'vitest';
import {
  checkKonamiCode,
  chooseClass,
  clearProgress,
  deserializeProgress,
  getLevel,
  INITIAL_PROGRESS_STATE,
  loadProgress,
  MAX_XP,
  openContact,
  openMailbox,
  openStage,
  saveProgress,
  serializeProgress,
  TOTAL_BUILDINGS,
  TOTAL_CLASSES,
  unlockKonami,
  useLens,
  useSearch,
  visitBuilding,
  XP_MAILBOX,
  XP_PER_BUILDING,
  XP_PER_CLASS,
  type ProgressState,
} from '../src/lib/progress';

describe('Progress Engine Unit Tests', () => {
  const allBuildings = [
    'idx-exchange',
    'illinois-state',
    'fynder',
    'backline',
    'fbla',
    'tsa',
    'aws-ccp',
  ];

  it('computes max XP from data: 7 buildings x 10 + 4 classes x 5 + 1 mailbox x 10 = exactly 100', () => {
    expect(TOTAL_BUILDINGS).toBe(7);
    expect(TOTAL_CLASSES).toBe(4);
    expect(XP_PER_BUILDING).toBe(10);
    expect(XP_PER_CLASS).toBe(5);
    expect(XP_MAILBOX).toBe(10);
    expect(
      TOTAL_BUILDINGS * XP_PER_BUILDING + TOTAL_CLASSES * XP_PER_CLASS + XP_MAILBOX,
    ).toBe(MAX_XP);
    expect(MAX_XP).toBe(100);
  });

  it('first building visit grants +10 and unlocks First Steps', () => {
    const delta = visitBuilding(INITIAL_PROGRESS_STATE, 'idx-exchange', allBuildings);
    expect(delta.xpGained).toBe(10);
    expect(delta.nextState.xp).toBe(10);
    expect(delta.unlockedAchievements).toContain('first-steps');
    expect(delta.nextState.achievements).toContain('first-steps');
    expect(delta.nextState.visitedBuildings).toEqual(['idx-exchange']);
    expect(delta.nextState.openedStages).toEqual(['idx-exchange']);
  });

  it('repeat building visit grants 0 XP and no new achievements', () => {
    const delta1 = visitBuilding(INITIAL_PROGRESS_STATE, 'idx-exchange', allBuildings);
    const delta2 = visitBuilding(delta1.nextState, 'idx-exchange', allBuildings);
    expect(delta2.xpGained).toBe(0);
    expect(delta2.nextState.xp).toBe(10);
    expect(delta2.unlockedAchievements).toHaveLength(0);
  });

  it('first choice of each of the 4 classes grants +5, repeat grants 0, and "all" grants 0', () => {
    let state = INITIAL_PROGRESS_STATE;

    // Full-stack
    const delta1 = chooseClass(state, 'fullstack');
    expect(delta1.xpGained).toBe(5);
    expect(delta1.nextState.xp).toBe(5);
    expect(delta1.unlockedAchievements).toContain('full-stack-curious');
    state = delta1.nextState;

    // Repeat Full-stack
    const deltaRepeat = chooseClass(state, 'fullstack');
    expect(deltaRepeat.xpGained).toBe(0);
    expect(deltaRepeat.nextState.xp).toBe(5);
    expect(deltaRepeat.unlockedAchievements).toHaveLength(0);

    // Data & ML
    const deltaData = chooseClass(state, 'data');
    expect(deltaData.xpGained).toBe(5);
    expect(deltaData.unlockedAchievements).toContain('data-nerd');
    state = deltaData.nextState;

    // Leadership
    const deltaLead = chooseClass(state, 'leadership');
    expect(deltaLead.xpGained).toBe(5);
    expect(deltaLead.unlockedAchievements).toContain('leader-of-the-pack');
    state = deltaLead.nextState;

    // Cloud
    const deltaCloud = chooseClass(state, 'cloud');
    expect(deltaCloud.xpGained).toBe(5);
    expect(deltaCloud.unlockedAchievements).toContain('cloud-watcher');
    state = deltaCloud.nextState;

    // 'all' class choice grants 0 XP and no achievement
    const deltaAll = chooseClass(state, 'all');
    expect(deltaAll.xpGained).toBe(0);
    expect(deltaAll.unlockedAchievements).toHaveLength(0);

    // Unknown class grants 0 XP
    const deltaUnknown = chooseClass(state, 'nonexistent');
    expect(deltaUnknown.xpGained).toBe(0);

    expect(state.xp).toBe(20);
    expect(state.chosenClasses).toHaveLength(4);
  });

  it('first opening of mailbox grants +10, repeat grants 0', () => {
    const d1 = openMailbox(INITIAL_PROGRESS_STATE);
    expect(d1.xpGained).toBe(10);
    expect(d1.nextState.xp).toBe(10);
    expect(d1.nextState.mailboxOpened).toBe(true);
    expect(d1.nextState.contactOpened).toBe(true);

    const d2 = openMailbox(d1.nextState);
    expect(d2.xpGained).toBe(0);
    expect(d2.nextState.xp).toBe(10);
  });

  it('completing every game objective awards exactly 100 XP (maxed out)', () => {
    let state = INITIAL_PROGRESS_STATE;

    // 7 buildings -> 70 XP
    for (const bId of allBuildings) {
      state = visitBuilding(state, bId, allBuildings).nextState;
    }
    expect(state.xp).toBe(70);

    // 4 classes -> 20 XP
    for (const cId of ['data', 'fullstack', 'leadership', 'cloud']) {
      state = chooseClass(state, cId).nextState;
    }
    expect(state.xp).toBe(90);

    // 1 mailbox -> 10 XP
    state = openMailbox(state).nextState;
    expect(state.xp).toBe(100);
    expect(getLevel(state.xp)).toBe('Maxed Out');
  });

  it('level thresholds map to the right level at boundaries (19, 20, 44, 45, 74, 75, 99, 100)', () => {
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
    const delta = visitBuilding(state, 'stageX', allBuildings);
    expect(delta.xpGained).toBe(5);
    expect(delta.nextState.xp).toBe(MAX_XP);

    const deltaOver = visitBuilding(delta.nextState, 'stageY', allBuildings);
    expect(deltaOver.xpGained).toBe(0);
    expect(deltaOver.nextState.xp).toBe(MAX_XP);
  });

  it('Completionist unlocks only after every building (all 7) is visited', () => {
    let state = INITIAL_PROGRESS_STATE;
    const firstSix = allBuildings.slice(0, -1);
    const lastBuilding = allBuildings[allBuildings.length - 1];
    expect(lastBuilding).toBeDefined();
    if (!lastBuilding) return;

    for (const bId of firstSix) {
      const d = visitBuilding(state, bId, allBuildings);
      state = d.nextState;
      expect(state.achievements).not.toContain('completionist');
    }

    const finalDelta = visitBuilding(state, lastBuilding, allBuildings);
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
      visitedBuildings: ['idx-exchange', 'illinois-state'],
      openedStages: ['idx-exchange', 'illinois-state'],
      chosenClasses: ['data'],
      usedLenses: ['data'],
      mailboxOpened: false,
      contactOpened: false,
      searchUsed: true,
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
          visitedBuildings: ['b1', 123],
        }),
      ),
    ).toEqual({
      xp: 100,
      visitedBuildings: ['b1'],
      openedStages: ['b1'],
      chosenClasses: [],
      usedLenses: [],
      mailboxOpened: false,
      contactOpened: false,
      searchUsed: false,
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
      visitedBuildings: ['s1'],
      openedStages: ['s1'],
      chosenClasses: ['data'],
      usedLenses: ['data'],
      mailboxOpened: true,
      contactOpened: true,
      searchUsed: true,
      achievements: ['first-steps', 'data-nerd'],
    };

    saveProgress(state, mockStorage);
    expect(loadProgress(mockStorage)).toEqual(state);

    clearProgress(mockStorage);
    expect(loadProgress(mockStorage)).toEqual(INITIAL_PROGRESS_STATE);
  });

  it('reader mode aliases (openStage, useLens, openContact, useSearch) behave identically', () => {
    const d1 = openStage(INITIAL_PROGRESS_STATE, 'fynder', allBuildings);
    expect(d1.xpGained).toBe(10);
    expect(d1.nextState.openedStages).toContain('fynder');
    expect(d1.nextState.visitedBuildings).toContain('fynder');

    const d2 = useLens(d1.nextState, 'fullstack');
    expect(d2.xpGained).toBe(5);
    expect(d2.nextState.usedLenses).toContain('fullstack');
    expect(d2.nextState.chosenClasses).toContain('fullstack');

    const d3 = openContact(d2.nextState);
    expect(d3.xpGained).toBe(10);
    expect(d3.nextState.contactOpened).toBe(true);
    expect(d3.nextState.mailboxOpened).toBe(true);

    const d4 = useSearch(d3.nextState);
    expect(d4.xpGained).toBe(0);
    expect(d4.nextState.searchUsed).toBe(true);
  });
});
