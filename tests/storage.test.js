const StorageManager = require('../scripts/storage');

// Mock localStorage
const localStorageMock = (function() {
  let store = {};
  return {
    getItem: function(key) {
      return store[key] || null;
    },
    setItem: function(key, value) {
      store[key] = value.toString();
    },
    removeItem: function(key) {
      delete store[key];
    },
    clear: function() {
      store = {};
    }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock BroadcastChannel
class MockBroadcastChannel {
  constructor(name) {
    this.name = name;
  }
  postMessage(data) {}
  close() {}
}

Object.defineProperty(window, 'BroadcastChannel', {
  value: MockBroadcastChannel
});

// Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(JSON.stringify({}))
  })
);

describe('StorageManager', () => {
  let storage;

  beforeEach(() => {
    window.localStorage.clear();
    jest.clearAllMocks();
    jest.useFakeTimers();
    storage = new StorageManager();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('should initialize with default data', () => {
    const data = storage.getData();
    expect(data).toBeTruthy();
    expect(data.schools).toEqual([]);
    expect(data.judges).toEqual([]);
    expect(data.categories).toEqual([]);
    expect(data.scores).toEqual([]);
  });

  describe('Schools', () => {
    test('should add a school', () => {
      const school = storage.addSchool('GRES Test', null);

      expect(school).toBeTruthy();
      expect(school.name).toBe('GRES Test');
      expect(school.id).toBeTruthy();

      const schools = storage.getSchools();
      expect(schools.length).toBe(1);
      expect(schools[0].name).toBe('GRES Test');
    });

    test('should update a school', () => {
      const school = storage.addSchool('GRES Test', null);

      const updated = storage.updateSchool(school.id, { name: 'GRES Test Updated' });

      expect(updated.name).toBe('GRES Test Updated');

      const schools = storage.getSchools();
      expect(schools[0].name).toBe('GRES Test Updated');
    });

    test('should delete a school and its scores', () => {
      const school = storage.addSchool('GRES Test', null);
      const category = storage.addCategory('Bateria', 1);
      const judge = storage.addJudge('Judge 1');

      storage.saveScore(school.id, category.id, judge.id, 9.8);

      expect(storage.getScores().length).toBe(1);

      storage.deleteSchool(school.id);

      expect(storage.getSchools().length).toBe(0);
      expect(storage.getScores().length).toBe(0);
    });
  });

  describe('Judges', () => {
    test('should add a judge', () => {
      const judge = storage.addJudge('Judge 1', []);
      expect(judge.name).toBe('Judge 1');
      expect(storage.getJudges().length).toBe(1);
    });

    test('should delete a judge and its scores', () => {
      const school = storage.addSchool('GRES Test', null);
      const category = storage.addCategory('Bateria', 1);
      const judge = storage.addJudge('Judge 1');

      storage.saveScore(school.id, category.id, judge.id, 9.8);

      storage.deleteJudge(judge.id);

      expect(storage.getJudges().length).toBe(0);
      expect(storage.getScores().length).toBe(0);
    });
  });

  describe('Categories', () => {
    test('should add a category', () => {
      const category = storage.addCategory('Bateria', 1);
      expect(category.name).toBe('Bateria');
      expect(storage.getCategories().length).toBe(1);
    });

    test('should delete a category and its scores', () => {
      const school = storage.addSchool('GRES Test', null);
      const category = storage.addCategory('Bateria', 1);
      const judge = storage.addJudge('Judge 1');

      storage.saveScore(school.id, category.id, judge.id, 9.8);

      storage.deleteCategory(category.id);

      expect(storage.getCategories().length).toBe(0);
      expect(storage.getScores().length).toBe(0);
    });
  });

  describe('Scores', () => {
    test('should save and update score', () => {
      const school = storage.addSchool('GRES Test', null);
      const category = storage.addCategory('Bateria', 1);
      const judge = storage.addJudge('Judge 1');

      storage.saveScore(school.id, category.id, judge.id, 9.8);
      expect(storage.getScores().length).toBe(1);
      expect(storage.getScores()[0].score).toBe(9.8);

      storage.saveScore(school.id, category.id, judge.id, 10);
      expect(storage.getScores().length).toBe(1);
      expect(storage.getScores()[0].score).toBe(10);
    });

    test('should calculate total properly with penalty', async () => {
      const school = storage.addSchool('GRES Test', null);
      const category = storage.addCategory('Bateria', 1);

      const judge = storage.addJudge('Judge 1');
      // Force unique IDs because Jest fake timers make Date.now() return the same value
      const data = storage.getData();
      data.judges[0].id = 'j1';
      storage.saveData(data);
      judge.id = 'j1';

      const judge2 = storage.addJudge('Judge 2');
      const data2 = storage.getData();
      data2.judges[1].id = 'j2';
      storage.saveData(data2);
      judge2.id = 'j2';

      storage.saveScore(school.id, category.id, judge.id, 9.8);
      storage.saveScore(school.id, category.id, judge2.id, 10);

      expect(storage.getSchoolTotal(school.id)).toBe(19.8);

      storage.updateSchoolPenalty(school.id, 0.5);

      expect(storage.getSchoolTotal(school.id)).toBe(19.3);
    });
  });

  describe('Ranking', () => {
    test('should generate correct ranking with tiebreakers', () => {
      const s1 = storage.addSchool('S1', null);
      const s2 = storage.addSchool('S2', null);

      const c1 = storage.addCategory('C1', 1);
      const c2 = storage.addCategory('C2', 2);

      const j1 = storage.addJudge('J1');

      // S1: 10 + 9.8 = 19.8
      storage.saveScore(s1.id, c1.id, j1.id, 10);
      storage.saveScore(s1.id, c2.id, j1.id, 9.8);

      // S2: 9.8 + 10 = 19.8
      storage.saveScore(s2.id, c1.id, j1.id, 9.8);
      storage.saveScore(s2.id, c2.id, j1.id, 10);

      storage.updateSettings({
        tiebreakers: [
          { categoryId: c1.id, priority: 1 },
          { categoryId: c2.id, priority: 2 }
        ]
      });

      const ranking = storage.getRanking();

      expect(ranking[0].id).toBe(s1.id); // S1 wins because it has 10 in C1 which is priority 1
      expect(ranking[1].id).toBe(s2.id);
    });
  });

  describe('Data Operations', () => {
    test('should clear scores only', () => {
      const school = storage.addSchool('GRES Test', null);
      const category = storage.addCategory('Bateria', 1);
      const judge = storage.addJudge('Judge 1');

      storage.saveScore(school.id, category.id, judge.id, 9.8);

      storage.clearScoresOnly();

      expect(storage.getSchools().length).toBe(1);
      expect(storage.getScores().length).toBe(0);
    });

    test('should optimize data by removing orphan scores', () => {
      const school = storage.addSchool('GRES Test', null);
      const category = storage.addCategory('Bateria', 1);
      const judge = storage.addJudge('Judge 1');

      storage.saveScore(school.id, category.id, judge.id, 9.8);

      // Manually add an orphan score for testing
      const data = storage.getData();
      data.scores.push({
        schoolId: 'non-existent',
        categoryId: category.id,
        judgeId: judge.id,
        score: 10
      });
      storage.saveData(data);

      expect(storage.getScores().length).toBe(2);

      const removed = storage.optimizeData();

      expect(removed).toBe(1);
      expect(storage.getScores().length).toBe(1);
      expect(storage.getScores()[0].schoolId).toBe(school.id);
    });
  });
});
