const fs = require('fs');
const path = require('path');

const adminScriptPath = path.resolve(__dirname, '../admin.js');
const adminScriptContent = fs.readFileSync(adminScriptPath, 'utf8');

describe('AdminPanel renderJudges', () => {
    let AdminPanel;

    beforeEach(() => {
        // Reset DOM
        document.body.innerHTML = `
            <div id="judgesList"></div>
            <div id="alertContainer"></div>
        `;

        // Mock StorageManager
        window.StorageManager = class {
            constructor() {
                this.judges = [];
                this.categories = [];
            }
            getSchools() { return []; }
            getScores() { return []; }
            getJudges() { return this.judges; }
            getCategories() { return this.categories; }
            getDisplayControl() { return {}; }
            addListener() {}
            getSettings() { return {}; }
        };

        // Execute the script to define the class in our scope
        const scriptCode = adminScriptContent.replace(/let adminPanel;[\s\S]*/, '') + '\nwindow.AdminPanel = AdminPanel;';
        eval(scriptCode);

        AdminPanel = window.AdminPanel;

        // Suppress console logs during tests to avoid noise
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        delete window.StorageManager;
        delete window.AdminPanel;
        jest.restoreAllMocks();
    });

    test('should render empty state when no judges exist', () => {
        const panel = new AdminPanel();
        panel.storage.judges = [];

        panel.renderJudges();

        const container = document.getElementById('judgesList');
        expect(container.innerHTML).toContain('Nenhum jurado cadastrado');
    });

    test('should render judges correctly', () => {
        const panel = new AdminPanel();
        panel.storage.categories = [
            { id: 'c1', name: 'Bateria' },
            { id: 'c2', name: 'Samba-Enredo' }
        ];
        panel.storage.judges = [
            { id: 'j1', name: 'João Silva', categoryIds: ['c1'] },
            { id: 'j2', name: 'Maria Santos', categoryIds: ['c1', 'c2'] },
            { id: 'j3', name: 'Pedro Costa', categoryIds: [] } // Todos os quesitos
        ];

        panel.renderJudges();

        const container = document.getElementById('judgesList');
        expect(container.innerHTML).not.toContain('Nenhum jurado cadastrado');

        // Check Judge 1
        expect(container.innerHTML).toContain('João Silva');
        expect(container.innerHTML).toContain('Bateria');

        // Check Judge 2
        expect(container.innerHTML).toContain('Maria Santos');
        expect(container.innerHTML).toContain('Bateria, Samba-Enredo');

        // Check Judge 3
        expect(container.innerHTML).toContain('Pedro Costa');
        expect(container.innerHTML).toContain('Todos os quesitos');
    });

    test('should return early if container does not exist', () => {
        document.body.innerHTML = ''; // Remove container

        const panel = new AdminPanel();
        panel.storage.judges = [{ id: 'j1', name: 'Test' }];

        // Should not throw
        expect(() => panel.renderJudges()).not.toThrow();
    });
});
