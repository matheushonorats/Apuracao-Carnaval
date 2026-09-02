// admin.test.js
const fs = require('fs');
const path = require('path');

// Ler o código de admin.js para eval
const adminJs = fs.readFileSync(path.resolve(__dirname, '../scripts/admin.js'), 'utf8');

describe('AdminPanel setupImageUpload', () => {
    let adminPanel;
    let mockStorage;
    let AdminPanel;

    beforeEach(() => {
        // Reset DOM
        document.body.innerHTML = '';

        // Mock StorageManager e outras dependências
        mockStorage = {
            getSettings: jest.fn().mockReturnValue({}),
            updateSettings: jest.fn(),
            addListener: jest.fn()
        };

        window.StorageManager = jest.fn().mockImplementation(() => mockStorage);

        // Use a script element to evaluate the code in the context of the window
        // But since we want to access the class, let's just wrap it

        const wrapper = `
            ${adminJs}
            window.AdminPanelClass = AdminPanel;
        `;
        eval(wrapper);

        AdminPanel = window.AdminPanelClass;

        jest.spyOn(AdminPanel.prototype, 'init').mockImplementation(() => {});
        adminPanel = new AdminPanel();
        adminPanel.storage = mockStorage;
    });

    test('should return early and not throw if input element does not exist', () => {
        // Garantir que o elemento não existe
        expect(document.getElementById('nonexistent-input')).toBeNull();

        // Executar
        expect(() => {
            adminPanel.setupImageUpload('nonexistent-input', 'someKey', 10);
        }).not.toThrow();

        // Verificar que não chamou os métodos de Storage
        expect(mockStorage.getSettings).not.toHaveBeenCalled();
    });

    test('should process correctly when input exists', () => {
        // Preparar DOM
        document.body.innerHTML = '<input type="file" id="existing-input" /><div id="existing-inputPreview"></div>';
        const input = document.getElementById('existing-input');

        // Mock settings para voltar uma imagem (opcional)
        mockStorage.getSettings.mockReturnValue({'someKey': 'base64image'});

        // Spy em _renderImagePreview
        adminPanel._renderImagePreview = jest.fn();

        // Executar
        adminPanel.setupImageUpload('existing-input', 'someKey', 10);

        // Verificar
        expect(mockStorage.getSettings).toHaveBeenCalled();
        expect(adminPanel._renderImagePreview).toHaveBeenCalledWith(
            expect.any(HTMLElement),
            'base64image',
            'someKey',
            'existing-input'
        );
    });
});
