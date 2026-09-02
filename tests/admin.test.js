const { expect } = require('chai');
const sinon = require('sinon');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const adminScriptPath = path.join(__dirname, '../scripts/admin.js');
let adminScript = fs.readFileSync(adminScriptPath, 'utf-8');
adminScript += '\nwindow.AdminPanel = AdminPanel;';

describe('AdminPanel Media Handlers Error Handling', () => {
    let window, document, AdminPanel, panel;

    beforeEach(() => {
        const dom = new JSDOM(`<!DOCTYPE html><html><body>
            <input type="file" id="test-upload" />
            <div id="test-uploadPreview"></div>
            <div id="alertContainer"></div>
        </body></html>`, { runScripts: "dangerously" });
        window = dom.window;
        document = window.document;
        global.window = window;
        global.document = document;

        sinon.stub(console, 'log');
        sinon.stub(console, 'error');
        sinon.stub(console, 'warn');

        window.StorageManager = class {
            constructor() { this.listeners = []; }
            addListener(fn) { this.listeners.push(fn); }
            getSettings() { return {}; }
            updateSettings() {}
            getData() { return null; }
            getDisplayControl() { return {}; }
            getSchools() { return []; }
            getJudges() { return []; }
        };

        window.changeView = sinon.spy();

        const scriptEl = document.createElement('script');
        scriptEl.textContent = adminScript;
        document.body.appendChild(scriptEl);

        AdminPanel = window.AdminPanel;

        // Use stub to block startAutoBackup which has setInterval
        const originalInit = AdminPanel.prototype.init;
        AdminPanel.prototype.init = function() {
            this.startAutoBackup = sinon.stub();
            originalInit.call(this);
        };

        panel = new AdminPanel();
    });

    afterEach(() => {
        sinon.restore();
    });

    it('should handle invalid IDs gracefully in setupImageUpload', () => {
        expect(() => {
            panel.setupImageUpload('non-existent-id', 'testKey', 10);
        }).to.not.throw();
    });

    it('should catch errors when file processing fails', async () => {
        const input = document.getElementById('test-upload');
        const alertStub = sinon.stub(panel, 'showAlert');
        const fileToDataURLStub = sinon.stub(panel, 'fileToDataURL').rejects(new Error('Mock File Processing Error'));

        panel.setupImageUpload('test-upload', 'testKey', 10);

        const file = new window.File(["dummy content"], "test.png", { type: "image/png" });

        Object.defineProperty(input, 'files', {
            value: [file]
        });

        const event = new window.Event('change');
        input.dispatchEvent(event);

        // Wait a small amount for the async handler to complete
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(fileToDataURLStub.calledOnce).to.be.true;
        expect(alertStub.calledWith('Erro ao processar a imagem.', 'error')).to.be.true;
        expect(console.error.calledWith('Erro ao processar imagem:', sinon.match.any)).to.be.true;
    });
});
