
const AdminPanel = require('../scripts/admin.js');

// Mock for StorageManager as AdminPanel relies on it heavily
global.StorageManager = class {
    constructor() {
        this.listeners = [];
        this.schools = [];
    }
    addListener(fn) {
        this.listeners.push(fn);
    }
    getSchools() {
        return this.schools;
    }
    setSchools(schools) {
        this.schools = schools;
    }
    // Stub other methods called during init
    getDisplayControl() { return {}; }
    getJudges() { return []; }
    getCategories() { return []; }
    getCriteria() { return []; }
    getSettings() { return {}; }
};

describe('AdminPanel - renderSchools', () => {
    let adminPanel;

    beforeEach(() => {
        // Mock body for alertContainer check and schools-list
        document.body.innerHTML = `
            <table id="schools-list"><tbody></tbody></table>
        `;

        // Suppress console statements for cleaner test output
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});

        adminPanel = new AdminPanel();

        // Mock escapeHtml and formatDate
        adminPanel.escapeHtml = jest.fn(str => str);
        adminPanel.formatDate = jest.fn(() => '01/01/2023');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('should do nothing if #schools-list tbody container is not found', () => {
        document.body.innerHTML = ''; // Remove the container
        adminPanel.renderSchools();
        expect(document.querySelector('#schools-list tbody')).toBeNull();
    });

    test('should render empty state if no schools are found', () => {
        adminPanel.storage.setSchools([]);
        adminPanel.renderSchools();

        const container = document.querySelector('#schools-list tbody');
        expect(container.innerHTML).toContain('Nenhuma agremiação cadastrada');
        expect(container.innerHTML).toContain('empty-state');
    });

    test('should render schools list if schools are present', () => {
        const mockSchools = [
            { id: 'school-1', name: 'Escola Um', logoDataURL: 'data:image/png;base64,123', createdAt: new Date().toISOString() },
            { id: 'school-2', name: 'Escola Dois', logoDataURL: '', createdAt: new Date().toISOString() }
        ];
        adminPanel.storage.setSchools(mockSchools);

        adminPanel.renderSchools();

        const container = document.querySelector('#schools-list tbody');
        // Validate items are rendered
        expect(container.innerHTML).toContain('Escola Um');
        expect(container.innerHTML).toContain('Escola Dois');

        // Validate correct edit and delete hooks are present
        expect(container.innerHTML).toContain("adminPanel.editSchool('school-1')");
        expect(container.innerHTML).toContain("adminPanel.deleteSchool('school-2')");

        // Validate logo rendering handling
        expect(container.innerHTML).toContain('data:image/png;base64,123'); // first school has logo
        expect(container.innerHTML).toContain('assets/default-logo.png'); // second school uses default
    });
});
