const fs = require('fs');
const path = require('path');

const DisplayController = require('../scripts/display.js');

describe('DisplayController', () => {
    let displayController;

    beforeEach(() => {
        // Set up DOM environment
        document.body.innerHTML = `
            <div id="schoolCard"></div>
        `;

        window.StorageManager = class StorageManager {
            constructor() {}
            addListener() {}
            getSettings() { return {}; }
            getDisplayControl() { return {}; }
        };

        const origInit = DisplayController.prototype.init;
        DisplayController.prototype.init = jest.fn();

        displayController = new DisplayController();
    });

    describe('processNextReveal', () => {
        it('should return null when there are no score cells', () => {
            document.body.innerHTML = `
                <table class="scores-table">
                    <tbody>
                        <tr><td>No cells</td></tr>
                    </tbody>
                </table>
            `;
            expect(displayController.processNextReveal()).toBeNull();
        });

        it('should return null when all cells are revealed (no "?")', () => {
            document.body.innerHTML = `
                <table class="scores-table">
                    <tbody>
                        <tr>
                            <td class="score-cell">10.0</td>
                            <td class="score-cell">9.5</td>
                        </tr>
                        <tr>
                            <td class="score-cell">9.8</td>
                            <td class="score-cell">10.0</td>
                        </tr>
                    </tbody>
                </table>
            `;
            expect(displayController.processNextReveal()).toBeNull();
        });

        it('should return the first unrevealed cell (from left to right, top to bottom)', () => {
            document.body.innerHTML = `
                <table class="scores-table">
                    <tbody>
                        <tr>
                            <td class="score-cell" id="cell-1-1">10.0</td>
                            <td class="score-cell" id="cell-1-2">?</td>
                            <td class="score-cell" id="cell-1-3">?</td>
                        </tr>
                        <tr>
                            <td class="score-cell" id="cell-2-1">?</td>
                            <td class="score-cell" id="cell-2-2">?</td>
                            <td class="score-cell" id="cell-2-3">?</td>
                        </tr>
                    </tbody>
                </table>
            `;

            const nextCell = displayController.processNextReveal();
            expect(nextCell).not.toBeNull();
            expect(nextCell.id).toBe('cell-1-2');

            // Now reveal it and check next
            nextCell.textContent = '9.5';

            const nextCell2 = displayController.processNextReveal();
            expect(nextCell2).not.toBeNull();
            expect(nextCell2.id).toBe('cell-1-3');

            nextCell2.textContent = '10.0';

            const nextCell3 = displayController.processNextReveal();
            expect(nextCell3).not.toBeNull();
            expect(nextCell3.id).toBe('cell-2-1');
        });

        it('should handle cells with whitespace around "?"', () => {
            document.body.innerHTML = `
                <table class="scores-table">
                    <tbody>
                        <tr>
                            <td class="score-cell" id="cell-1-1">
                                ?
                            </td>
                        </tr>
                    </tbody>
                </table>
            `;
            const nextCell = displayController.processNextReveal();
            expect(nextCell).not.toBeNull();
            expect(nextCell.id).toBe('cell-1-1');
        });
    });
});
