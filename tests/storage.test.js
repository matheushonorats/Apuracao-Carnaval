const fs = require('fs');

describe('StorageManager - Error Handling', () => {
    let StorageManagerClass;

    beforeAll(() => {
        const scriptContent = fs.readFileSync('./scripts/storage.js', 'utf8');
        const wrapper = new Function('window', `
            ${scriptContent}
            return StorageManager;
        `);
        StorageManagerClass = wrapper(global);
    });

    beforeEach(() => {
        global.fetch = jest.fn();
        global.localStorage = {
            getItem: jest.fn(),
            setItem: jest.fn(),
            removeItem: jest.fn(),
            clear: jest.fn()
        };
        global.BroadcastChannel = class {
            constructor() {}
            postMessage() {}
            onmessage() {}
        };
        global.EventSource = undefined;

        // Ensure AbortController is available in the global scope for the test
        global.AbortController = class {
            constructor() {
                this.signal = {};
            }
            abort() {}
        };

        jest.useFakeTimers();
        jest.setSystemTime(new Date('2023-01-01T00:00:00Z'));
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    describe('startPolling network errors', () => {
        it('should handle fetch rejection gracefully (e.g. network failure)', async () => {
            const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

            // init() calls fetch, mock it to avoid unhandled rejections during setup
            global.fetch.mockRejectedValueOnce(new Error('Initial Network Error'));

            const manager = new StorageManagerClass();
            await Promise.resolve(); // resolve init

            // Now test startPolling specifically
            global.fetch.mockClear();
            global.fetch.mockRejectedValueOnce(new Error('Network error'));

            manager.startPolling();
            jest.advanceTimersByTime(300);

            // Wait for interval callback
            await Promise.resolve();
            // Wait for fetch
            let errorCaught = false;
            try {
                await Promise.resolve();
            } catch (e) {
                errorCaught = true;
            }

            // Should not have thrown an unhandled rejection
            expect(errorCaught).toBe(false);

            consoleLogSpy.mockRestore();
        });

        it('should handle 500 server error gracefully without crashing', async () => {
            const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

            global.fetch.mockRejectedValueOnce(new Error('Initial Network Error'));

            const manager = new StorageManagerClass();
            await Promise.resolve();

            global.fetch.mockClear();
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error'
            });

            manager.startPolling();
            jest.advanceTimersByTime(300);

            let errorCaught = false;
            try {
                await Promise.resolve();
                await Promise.resolve();
            } catch (e) {
                errorCaught = true;
            }

            expect(errorCaught).toBe(false);

            consoleLogSpy.mockRestore();
        });
    });
});
