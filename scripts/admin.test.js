const fs = require('fs');
const path = require('path');

// Read the code from scripts/admin.js
const adminJsPath = path.resolve(__dirname, 'admin.js');
const adminJsCode = fs.readFileSync(adminJsPath, 'utf8');

describe('AdminPanel', () => {
    let originalConsoleError;
    let originalConsoleLog;

    beforeEach(() => {
        // Setup simple DOM structure that AdminPanel expects
        document.body.innerHTML = `
            <div id="alertContainer"></div>

            <!-- Navigation -->
            <a class="nav-link active" data-tab="schools">Escolas</a>
            <a class="nav-link" data-tab="judges">Jurados</a>
            <div class="tab-content active" id="schoolsTab"></div>
            <div class="tab-content" id="judgesTab"></div>

            <!-- Forms -->
            <form id="schoolForm">
                <input id="schoolName" name="schoolName" type="text" />
                <input id="schoolPenalty" name="schoolPenalty" type="number" />
                <input id="schoolLogo" name="schoolLogo" type="file" />
                <button type="submit">Adicionar Agremiação</button>
            </form>

            <form id="judgeForm">
                <input name="judgeName" type="text" />
                <button type="submit">Adicionar Jurado</button>
            </form>

            <form id="categoryForm">
                <input name="categoryName" type="text" />
                <input name="categoryOrder" type="number" />
                <button type="submit">Adicionar Quesito</button>
            </form>

            <!-- Other containers -->
            <div id="schoolsList"></div>
            <div id="judgesList"></div>
            <div id="categoriesList"></div>
            <div id="judgeCategoriesContainer"></div>
            <div id="statsContainer"></div>
            <div id="dashboardStatsContainer"></div>
            <div id="dashboardCategoriesProgressList"></div>
            <div id="dashboardActiveViewText"></div>
            <div id="scoreCategorySelect"></div>
            <div id="displayCategorySelect"></div>
            <div id="tiebreakerContainer"></div>
            <div id="backupsHistoryList"></div>

            <!-- Other inputs -->
            <input id="headerTitleInput" />
            <input id="transitionTitleInput" />
            <button id="saveTitlesBtn"></button>
            <input id="governmentLogo" />
            <div id="governmentLogoPreview"></div>
            <input id="backgroundImage" />
            <div id="backgroundImagePreview"></div>
            <button id="saveScoresBtn"></button>
            <button id="exportDataBtn"></button>
            <input id="importDataInput" type="file" />
            <button id="clearDataBtn"></button>
            <button id="optimizeDataBtn"></button>
            <button id="generateReportBtn"></button>
            <button id="saveTiebreakersBtn"></button>
            <button id="dashboardOpenDisplayBtn"></button>
            <input id="schoolSearchInput" />
            <input id="chromaKeyInput" type="checkbox" />
            <button id="toggleRevelationBtn"></button>
            <button id="revealPrevBtn"></button>
            <button id="revealNextBtn"></button>
            <button id="revealAllBtn"></button>
            <div id="revelationControlsWrapper"></div>
            <div id="revelationActionButtons"></div>
            <div id="revelationStatusText"></div>
            <div id="pinAuthOverlay"></div>
            <input id="pinInput" />
            <button id="submitPinBtn"></button>
            <div id="pinErrorMessage"></div>
            <input id="adminPinInput" />
            <button id="savePinBtn"></button>
            <button id="openDisplayBtn"></button>
        `;

        // Mock StorageManager
        window.StorageManager = class StorageManager {
            constructor() {}
            addListener() {}
            getSchools() { return []; }
            getJudges() { return []; }
            getCategories() { return []; }
            getScores() { return []; }
            getSettings() { return {}; }
            getDisplayControl() { return {}; }
            addSchool() { return { id: 's1' }; }
            updateSchool() {}
            deleteSchool() {}
            updateSchoolPenalty() {}
        };

        // Suppress console logs during testing
        originalConsoleError = console.error;
        originalConsoleLog = console.log;
        console.error = jest.fn();
        console.log = jest.fn();

        // Evaluate the code in current context
        // This will define the AdminPanel class
        // Extract AdminPanel class from the code to make it accessible
        const extractClass = new Function(adminJsCode + '\nreturn AdminPanel;');
        window.AdminPanel = extractClass();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        delete window.StorageManager;
        delete window.AdminPanel;
        delete window.adminPanel;

        console.error = originalConsoleError;
        console.log = originalConsoleLog;
    });

    test('should initialize AdminPanel successfully', () => {
        const panel = new window.AdminPanel();
        expect(panel.currentTab).toBe('schools');
        expect(panel.editingSchoolId).toBeNull();
    });

    test('should handle tab switching', () => {
        const panel = new window.AdminPanel();

        // Initial state
        expect(panel.currentTab).toBe('schools');
        expect(document.querySelector('.nav-link[data-tab="schools"]').classList.contains('active')).toBe(true);
        expect(document.querySelector('#schoolsTab').classList.contains('active')).toBe(true);
        expect(document.querySelector('#judgesTab').classList.contains('active')).toBe(false);

        // Switch tab
        panel.switchTab('judges');

        // Check new state
        expect(panel.currentTab).toBe('judges');
        expect(document.querySelector('.nav-link[data-tab="schools"]').classList.contains('active')).toBe(false);
        expect(document.querySelector('.nav-link[data-tab="judges"]').classList.contains('active')).toBe(true);
        expect(document.querySelector('#schoolsTab').classList.contains('active')).toBe(false);
        expect(document.querySelector('#judgesTab').classList.contains('active')).toBe(true);
    });

    test('should handle school submission successfully', async () => {
        const panel = new window.AdminPanel();
        panel.showAlert = jest.fn();

        const form = document.getElementById('schoolForm');

        // Mock the form event target properties
        const mockForm = {
            schoolName: { value: 'Nova Escola', focus: jest.fn() },
            schoolPenalty: { value: '0' },
            schoolLogo: { files: [] },
            reset: jest.fn(),
            querySelector: () => ({
                classList: { remove: jest.fn() },
                dataset: {}
            })
        };

        // Mock addSchool
        panel.storage.addSchool = jest.fn().mockReturnValue({ id: 's1' });

        // Trigger submit
        const event = {
            preventDefault: jest.fn(),
            target: mockForm
        };

        await panel.handleSchoolSubmit(event);

        expect(panel.storage.addSchool).toHaveBeenCalledWith('Nova Escola', null);
        expect(panel.showAlert).toHaveBeenCalledWith('✅ Agremiação adicionada com sucesso!', 'success');
        expect(mockForm.reset).toHaveBeenCalled(); // Form should reset
    });

    test('should show error if school name is too short', async () => {
        const panel = new window.AdminPanel();
        panel.showAlert = jest.fn();

        const mockForm = {
            schoolName: { value: 'A', focus: jest.fn() }, // Too short
            schoolPenalty: { value: '0' },
            schoolLogo: { files: [] },
            querySelector: () => ({
                classList: { remove: jest.fn() },
                dataset: {}
            })
        };

        // Trigger submit
        const event = {
            preventDefault: jest.fn(),
            target: mockForm
        };

        await panel.handleSchoolSubmit(event);

        expect(panel.showAlert).toHaveBeenCalledWith('❌ O nome da agremiação deve ter pelo menos 3 caracteres', 'error');
    });
});
