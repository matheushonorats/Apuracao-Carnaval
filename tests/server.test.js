const fs = require('fs');

describe('server.js loadData error handling', () => {
    let serverModule;
    let consoleLogSpy;
    let consoleErrorSpy;

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        jest.mock('fs', () => {
            const originalModule = jest.requireActual('fs');
            return {
                ...originalModule,
                existsSync: jest.fn().mockImplementation((path) => {
                    return true;
                }),
                readFileSync: jest.fn(),
                mkdirSync: jest.fn(),
                writeFileSync: jest.fn(),
                readFile: jest.fn(),
                writeFile: jest.fn()
            };
        });
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
    });

    it('should gracefully handle fs.readFileSync throwing an error and leave cachedData untouched', () => {
        const mockedFs = require('fs');
        const mockError = new Error('Mock readFileSync error');
        mockedFs.readFileSync.mockImplementation((path) => {
            if (path.includes('data.json')) {
                throw mockError;
            }
            return '{}';
        });

        serverModule = require('../server.js');

        // Reset cachedData explicitly and run loadData to test it directly
        serverModule.setCachedData(null);
        serverModule.loadData();

        expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Erro ao ler arquivo de dados:', mockError);
        expect(serverModule.getCachedData()).toBeNull();
    });

    it('should successfully load data when fs.readFileSync works', () => {
        const mockedFs = require('fs');
        const mockData = { schools: [] };

        mockedFs.readFileSync.mockImplementation((path) => {
            if (path.includes('data.json')) {
                return JSON.stringify(mockData);
            }
            return '{}';
        });

        serverModule = require('../server.js');

        // Reset cachedData explicitly and run loadData to test it directly
        serverModule.setCachedData(null);
        serverModule.loadData();

        expect(consoleLogSpy).toHaveBeenCalledWith('✅ Dados carregados com sucesso');
        expect(serverModule.getCachedData()).toEqual(JSON.stringify(mockData));
    });

    it('should gracefully handle JSON.parse throwing an error', () => {
        const mockedFs = require('fs');

        mockedFs.readFileSync.mockImplementation((path) => {
            if (path.includes('data.json')) {
                return 'invalid json';
            }
            return '{}';
        });

        serverModule = require('../server.js');

        // Reset cachedData explicitly and run loadData to test it directly
        serverModule.setCachedData(null);
        serverModule.loadData();

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error parsing initial data JSON:', expect.any(SyntaxError));
        expect(serverModule.getCachedData()).toBe('invalid json');
    });
});
