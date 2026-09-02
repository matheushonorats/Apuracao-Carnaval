const fs = require('fs');

global.localStorage = {
    store: {},
    getItem: function(key) { return this.store[key] || null; },
    setItem: function(key, value) { this.store[key] = value.toString(); },
    removeItem: function(key) { delete this.store[key]; },
    clear: function() { this.store = {}; }
};

const dummyData = {
    schools: Array.from({length: 20}, (_, i) => ({id: i.toString(), name: `School ${i}`, penalty: 0})),
    categories: Array.from({length: 10}, (_, i) => ({id: i.toString(), name: `Category ${i}`})),
    judges: Array.from({length: 50}, (_, i) => ({id: i.toString(), name: `Judge ${i}`})),
    scores: [],
    settings: { tiebreakers: [] },
    lastUpdated: Date.now()
};
for (const school of dummyData.schools) {
    for (const category of dummyData.categories) {
        for (const judge of dummyData.judges) {
            dummyData.scores.push({
                schoolId: school.id,
                categoryId: category.id,
                judgeId: judge.id,
                score: Math.random() * 10
            });
        }
    }
}
localStorage.setItem('samba-scoring-data', JSON.stringify(dummyData));

class StorageManagerOriginal {
    constructor() {
        this.STORAGE_KEY = 'samba-scoring-data';
    }
    getData() {
        try {
            const dataStr = localStorage.getItem(this.STORAGE_KEY);
            return dataStr ? JSON.parse(dataStr) : null;
        } catch (e) {
            console.error('Erro ao ler do localStorage:', e);
            return null;
        }
    }
}

class StorageManagerOptimized {
    constructor() {
        this.STORAGE_KEY = 'samba-scoring-data';
        this._cachedDataStr = undefined;
        this._cachedData = undefined;
    }
    getData() {
        try {
            const dataStr = localStorage.getItem(this.STORAGE_KEY);

            // Retorna do cache se a string for a mesma (evita JSON.parse custoso)
            if (this._cachedDataStr !== undefined && this._cachedDataStr === dataStr) {
                return this._cachedData;
            }

            const parsed = dataStr ? JSON.parse(dataStr) : null;

            // Atualiza o cache
            this._cachedDataStr = dataStr;
            this._cachedData = parsed;

            return parsed;
        } catch (e) {
            console.error('Erro ao ler do localStorage:', e);
            return null;
        }
    }
}

const smOriginal = new StorageManagerOriginal();
const smOptimized = new StorageManagerOptimized();

const iterations = 10000;

console.log("Original...");
const startOriginal = performance.now();
for (let i = 0; i < iterations; i++) {
    smOriginal.getData();
}
const endOriginal = performance.now();

console.log("Optimized...");
const startOptimized = performance.now();
for (let i = 0; i < iterations; i++) {
    smOptimized.getData();
}
const endOptimized = performance.now();

const timeOriginal = endOriginal - startOriginal;
const timeOptimized = endOptimized - startOptimized;

console.log(`Original Time taken for ${iterations} getData calls: ${timeOriginal.toFixed(2)} ms`);
console.log(`Optimized Time taken for ${iterations} getData calls: ${timeOptimized.toFixed(2)} ms`);
console.log(`Improvement: ${((timeOriginal - timeOptimized) / timeOriginal * 100).toFixed(2)}%`);
process.exit(0);
