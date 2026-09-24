const StorageManager = require('../scripts/storage.js');

describe('StorageManager.updateSchool', () => {
    let storageManager;

    beforeEach(() => {
        // Clear local storage
        localStorage.clear();

        // Mock BroadcastChannel
        global.BroadcastChannel = class {
            constructor(name) {
                this.name = name;
            }
            postMessage(msg) {}
            close() {}
        };

        storageManager = new StorageManager();

        // Mock notifyChange and saveData to prevent side effects
        jest.spyOn(storageManager, 'notifyChange').mockImplementation(() => {});
        jest.spyOn(storageManager, 'syncToServer').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should update an existing school and return the updated object', () => {
        // Setup initial data
        const school1 = { id: '1', name: 'School 1', logoDataURL: null, order: 0 };
        const data = {
            schools: [school1],
            judges: [],
            categories: [],
            scores: [],
            settings: {}
        };
        storageManager.saveData(data);

        // Update the school
        const updates = { name: 'Updated School 1' };
        const result = storageManager.updateSchool('1', updates);

        // Verify the result
        expect(result).toEqual({ ...school1, ...updates });

        // Verify the data was saved correctly
        const storedData = storageManager.getData();
        expect(storedData.schools[0].name).toBe('Updated School 1');

        // Verify notifyChange was called
        expect(storageManager.notifyChange).toHaveBeenCalledWith('schools');
    });

    it('should preserve properties not included in updates', () => {
        // Setup initial data
        const school1 = { id: '2', name: 'School 2', logoDataURL: 'data:image/png;base64,...', order: 1 };
        const data = {
            schools: [school1],
            judges: [],
            categories: [],
            scores: [],
            settings: {}
        };
        storageManager.saveData(data);

        // Update the school
        const updates = { order: 2 };
        const result = storageManager.updateSchool('2', updates);

        // Verify the result preserved logoDataURL and name
        expect(result.name).toBe('School 2');
        expect(result.logoDataURL).toBe('data:image/png;base64,...');
        expect(result.order).toBe(2);
    });

    it('should return null if the school ID does not exist', () => {
        // Setup initial data
        const data = {
            schools: [],
            judges: [],
            categories: [],
            scores: [],
            settings: {}
        };
        storageManager.saveData(data);

        // Try to update a non-existent school
        const result = storageManager.updateSchool('999', { name: 'Fake' });

        // Verify the result
        expect(result).toBeNull();

        // Verify notifyChange was NOT called
        expect(storageManager.notifyChange).not.toHaveBeenCalled();
    });
});
