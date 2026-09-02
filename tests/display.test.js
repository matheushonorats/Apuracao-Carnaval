/**
 * @jest-environment jsdom
 */

// Mock StorageManager
class MockStorageManager {
    constructor() {
        this.listeners = [];
        this.chromaKey = false;
        this.displayControl = {
            type: 'category',
            categoryId: 'c1',
            view: 'category',
            autoTransition: false,
            timestamp: Date.now(),
            chromaKey: this.chromaKey
        };
    }
    addListener(callback) {
        this.listeners.push(callback);
    }
    getSettings() {
        return { theme: 'dark', transitionTime: 5000, currentView: 'grid', currentCategory: 'c1' };
    }
    getData() {
        return {
            categories: [{ id: 'c1', name: 'Category 1', isTotal: false }],
            schools: [{ id: 's1', name: 'School 1' }],
            scores: {}
        };
    }
    getDisplayControl() {
        return this.displayControl;
    }
    setDisplayControl(control) {
        this.displayControl = { ...this.displayControl, ...control };
    }
    getSchools() {
        return [{ id: 's1', name: 'School 1' }];
    }
    getCategories() {
        return [{ id: 'c1', name: 'Category 1', isTotal: false }];
    }
    getScores() {
        return {};
    }
    calculateTotals() {
        return [{ schoolId: 's1', total: 0, penalties: 0, tiebreaker: 0, scores: {} }];
    }
    getJudges() {
        return [
            { id: 'j1', name: 'Judge 1' },
            { id: 'j2', name: 'Judge 2' }
        ];
    }
    getRanking() {
        return [
            { schoolId: 's1', total: 100, penalties: 0, rank: 1 }
        ];
    }
}
global.StorageManager = MockStorageManager;

const fs = require('fs');
const path = require('path');
const displayCode = fs.readFileSync(path.resolve(__dirname, '../scripts/display.js'), 'utf8');

const codeToEval = displayCode.replace(
    /document\.addEventListener\('DOMContentLoaded', \(\) => {[\s\S]*?}\);/g,
    ""
) + '\nmodule.exports = { DisplayController };';

const displayModule = { exports: {} };
const fn = new Function('module', 'exports', codeToEval);
fn(displayModule, displayModule.exports);
const { DisplayController } = displayModule.exports;

describe('DisplayController', () => {
    let displayController;

    beforeEach(() => {
        document.body.innerHTML = `
            <header class="display-header">
                <div class="header-content">
                    <h1 class="event-title">Event</h1>
                    <div id="displayClock"></div>
                    <img id="headerLogoCenter">
                </div>
            </header>
            <main class="display-main">
                <h1 class="view-title" id="viewTitle">Title</h1>
                <div class="transition-view hidden" id="transitionView">
                    <img id="transLogoCenter" class="transition-logo center">
                </div>
                <div id="categoryView" class="category-view">
                    <div id="schoolCard" class="school-card"></div>
                </div>
                <div id="rankingView" class="ranking-view hidden">
                    <div id="rankingGrid" class="ranking-grid"></div>
                </div>
            </main>
        `;

        displayController = new DisplayController();
        jest.useFakeTimers();
    });

    afterEach(() => {
        if (displayController && displayController.updateInterval) {
            clearInterval(displayController.updateInterval);
        }
        document.body.innerHTML = '';
        jest.useRealTimers();
    });

    test('should initialize correctly', () => {
        expect(displayController).toBeDefined();
        expect(displayController.storage).toBeInstanceOf(MockStorageManager);
    });

    test('should apply chroma key class to body', () => {
        displayController.storage.setDisplayControl({ chromaKey: true });
        displayController.applySettings({});
        expect(document.body.classList.contains('chroma-key')).toBeTruthy();

        displayController.storage.setDisplayControl({ chromaKey: false });
        displayController.applySettings({});
        expect(document.body.classList.contains('chroma-key')).toBeFalsy();
    });

    test('should update clock', () => {
        const clockEl = document.getElementById('displayClock');
        // Initial clock is set on setupClock
        expect(clockEl.textContent).not.toBe('');
        // advance time
        jest.advanceTimersByTime(2000);
        // It's just a text content check
    });

    test('should handle update correctly for settings', () => {
        const applySpy = jest.spyOn(displayController, 'applySettings');
        displayController.handleUpdate('settings');
        expect(applySpy).toHaveBeenCalled();
    });

    test('should render category view when control view is category', () => {
        const renderCategoryTableSpy = jest.spyOn(displayController, 'renderCategoryTable').mockImplementation(() => {});
        // Force the display controller to think data changed
        displayController.lastDataHash = null;
        displayController.storage.setDisplayControl({ view: 'category' });
        displayController.render();
        expect(renderCategoryTableSpy).toHaveBeenCalled();
    });

    test('should render ranking view when control view is ranking', () => {
        const renderRankingSpy = jest.spyOn(displayController, 'renderRankingView').mockImplementation(() => {});
        // Force the display controller to think data changed
        displayController.lastDataHash = null;
        displayController.storage.setDisplayControl({ view: 'ranking' });
        displayController.render();
        expect(renderRankingSpy).toHaveBeenCalled();
    });
});
