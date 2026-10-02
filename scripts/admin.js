/**
 * AdminPanel - Gerenciador do painel administrativo
 * Implementação robusta com validações completas e tratamento de erros
 */

class AdminPanel {
    constructor() {
        this.storage = new StorageManager();
        this.currentTab = 'schools';
        this.editingSchoolId = null;
        this.editingJudgeId = null;
        this.editingCategoryId = null;

        // Bind event listeners

        // Managers
        this.schoolManager = new SchoolManager(this);
        this.judgeManager = new JudgeManager(this);
        this.categoryManager = new CategoryManager(this);
        this.scoreManager = new ScoreManager(this);
        this.displayManager = new DisplayManager(this);
        this.settingsManager = new SettingsManager(this);
        this.dashboardManager = new DashboardManager(this);

        // Bind event listeners
        this.init();
    }

    /**
     * Inicializa o painel
     */
    init() {
        try { this.setupNavigation(); } catch (e) { console.error('setupNavigation:', e); }
        try { this.setupForms(); } catch (e) { console.error('setupForms:', e); }
        try { this.setupMediaHandlers(); } catch (e) { console.error('setupMediaHandlers:', e); }

        // Listener para atualizações
        try {
            this.storage.addListener((dataType) => {
                try { this.handleDataUpdate(dataType); } catch (e) { console.error('handleDataUpdate:', e); }
            });
        } catch (e) { console.error('addListener:', e); }

        try { this.loadAllData(); } catch (e) { console.error('loadAllData:', e); }

        // Criar container de alertas se não existir
        if (!document.getElementById('alertContainer')) {
            const container = document.createElement('div');
            container.id = 'alertContainer';
            document.body.appendChild(container);
        }

        // Re-renderizar previews após StorageManager terminar de carregar do servidor
        setTimeout(() => {
            try { this.setupMediaHandlers(); } catch (e) { console.error('setupMediaHandlers retry:', e); }
        }, 1500);

        try { this.dashboardManager.setupDashboardControls(); } catch (e) { console.error('setupDashboardControls:', e); }
        try { this.dashboardManager.setupSearchInput(); } catch (e) { console.error('setupSearchInput:', e); }
        try { this.dashboardManager.setupChromaKeyHandler(); } catch (e) { console.error('setupChromaKeyHandler:', e); }
        try { this.dashboardManager.setupRevelationControls(); } catch (e) { console.error('setupRevelationControls:', e); }
        try { this.settingsManager.checkLocalStorageUsage(); } catch (e) { console.error('checkLocalStorageUsage:', e); }
        try { this.settingsManager.setupPinAuthentication(); } catch (e) { console.error('setupPinAuthentication:', e); }
        try { this.settingsManager.setupPinSettings(); } catch (e) { console.error('setupPinSettings:', e); }
        try { this.settingsManager.startAutoBackup(); } catch (e) { console.error('startAutoBackup:', e); }

        console.log('✅ AdminPanel inicializado com sucesso');
    }

    setupMediaHandlers() {
        // Logo Gestão (Central/Principal)
        this.setupImageUpload('governmentLogo', 'governmentLogo', 10);

        // Background
        this.setupImageUpload('backgroundImage', 'backgroundImage', 10);

        // Textos Personalizados
        this.setupTextHandlers();
    }

    setupTextHandlers() {
        const headerInput = document.getElementById('headerTitleInput');
        const transitionInput = document.getElementById('transitionTitleInput');
        const saveBtn = document.getElementById('saveTitlesBtn');

        if (!headerInput || !transitionInput || !saveBtn) return;

        // Carregar valores atuais
        const settings = this.storage.getSettings();
        headerInput.value = settings.headerTitle || 'Apuração do Desfile das Escolas de Samba do Carnaval';
        transitionInput.value = settings.transitionTitle || 'APURAÇÃO DO DESFILE DAS ESCOLAS DE SAMBA DO CARNAVAL 2026';

        saveBtn.addEventListener('click', () => {
            const newHeader = headerInput.value.trim();
            const newTransition = transitionInput.value.trim();

            this.storage.updateSettings({
                headerTitle: newHeader,
                transitionTitle: newTransition
            });

            this.showAlert('✅ Títulos atualizados com sucesso!', 'success');
        });
    }

    setupImageUpload(inputId, storageKey, maxSizeMB) {
        const input = document.getElementById(inputId);
        const preview = document.getElementById(`${inputId}Preview`);

        if (!input) return;

        // Carregar imagem salva das configurações sincronizadas
        const settings = this.storage.getSettings();
        const savedImage = settings[storageKey];
        if (savedImage && preview) {
            this._renderImagePreview(preview, savedImage, storageKey, inputId);
        }

        input.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (file.size > maxSizeMB * 1024 * 1024) {
                this.showAlert(`A imagem deve ser menor que ${maxSizeMB}MB`, 'error');
                input.value = '';
                return;
            }

            try {
                const base64 = await this.fileToDataURL(file);

                // Salvar nas configurações sincronizadas (vai para data.json)
                const update = {};
                update[storageKey] = base64;
                this.storage.updateSettings(update);

                if (preview) {
                    this._renderImagePreview(preview, base64, storageKey, inputId);
                }

                this.showAlert('✅ Imagem salva!', 'success');

            } catch (err) {
                console.error('Erro ao processar imagem:', err);
                this.showAlert('Erro ao processar a imagem.', 'error');
            }
        });
    }

    _renderImagePreview(container, base64, storageKey, inputId) {
        container.innerHTML = `
            <div class="flex items-center gap-md">
                <img src="${base64}" style="max-height: 100px; max-width: 300px; border-radius: 4px; object-fit: contain;">
                <button class="btn btn-danger btn-icon" onclick="window.adminPanel.removeImage('${storageKey}', '${inputId}')" title="Remover">&#128465;</button>
            </div>
        `;
    }

    async removeImage(storageKey, inputId) {
        const confirmed = await this.showConfirm('Remover Imagem', 'Você deseja realmente remover esta imagem?');
        if (confirmed) {
            const update = {};
            update[storageKey] = null;
            this.storage.updateSettings(update);

            const preview = document.getElementById(`${inputId}Preview`);
            if (preview) preview.innerHTML = '';

            const input = document.getElementById(inputId);
            if (input) input.value = '';

            this.showAlert('✅ Imagem removida', 'success');
        }
    }

    fileToDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /**
     * Configurar navegação entre abas
     */
    setupNavigation() {
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = link.dataset.tab;
                if (tab) {
                    this.switchTab(tab);
                }
            });
        });
    }

    /**
     * Trocar aba ativa
     */
    switchTab(tabName) {
        // Atualizar navegação
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.tab === tabName);
        });

        // Atualizar conteúdo
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}Tab`);
        });

        this.currentTab = tabName;

        // Resetar os estados dos formulários e IDs de edição ao mudar de aba
        this.editingSchoolId = null;
        this.editingJudgeId = null;
        this.editingCategoryId = null;

        const schoolForm = document.getElementById('schoolForm');
        if (schoolForm) {
            schoolForm.reset();
            const submitBtn = schoolForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.textContent = 'Adicionar Agremiação';
                submitBtn.classList.remove('btn-success');
            }
        }

        const judgeForm = document.getElementById('judgeForm');
        if (judgeForm) {
            judgeForm.reset();
            const submitBtn = judgeForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.textContent = 'Adicionar Jurado';
                submitBtn.classList.remove('btn-success');
            }
        }

        const categoryForm = document.getElementById('categoryForm');
        if (categoryForm) {
            categoryForm.reset();
            const submitBtn = categoryForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.textContent = 'Adicionar Quesito';
                submitBtn.classList.remove('btn-success');
            }
        }

        // Recarregar dados da aba
        this.loadTabData(tabName);
    }


    /**
     * Configurar todos os formulários
     */
    setupForms() {
        // Formulário de escolas
        const schoolForm = document.getElementById('schoolForm');
        if (schoolForm) {
            schoolForm.addEventListener('submit', (e) => this.schoolManager.handleSchoolSubmit(e));
        }

        // Formulário de jurados
        const judgeForm = document.getElementById('judgeForm');
        if (judgeForm) {
            judgeForm.addEventListener('submit', (e) => this.judgeManager.handleJudgeSubmit(e));
        }

        // Formulário de quesitos
        const categoryForm = document.getElementById('categoryForm');
        if (categoryForm) {
            categoryForm.addEventListener('submit', (e) => this.categoryManager.handleCategorySubmit(e));
        }

        // Botão de salvar notas
        const saveScoresBtn = document.getElementById('saveScoresBtn');
        if (saveScoresBtn) {
            saveScoresBtn.addEventListener('click', () => this.scoreManager.handleSaveScores());
        }

        // Seletor de quesito para lançamento
        const categorySelect = document.getElementById('scoreCategorySelect');
        if (categorySelect) {
            categorySelect.addEventListener('change', (e) => {
                this.scoreManager.loadScoresGrid(e.target.value);
                // Sincronizar display público com o quesito selecionado
                if (e.target.value) {
                    this.storage.updateDisplayControl({ currentCategoryId: e.target.value });
                }
            });
        }

        // Controle de exibição
        this.displayManager.setupDisplayControls();

        // Export/Import
        this.settingsManager.setupDataManagement();

        // Desempate
        this.settingsManager.setupTiebreakers();
    }

    /* ===== ESCOLAS ===== */









    /* ===== JURADOS ===== */











    /* ===== QUESITOS/CATEGORIAS ===== */









    /* CONTINUA NA PARTE 2... */
    /* ===== LANÇAMENTO DE NOTAS ===== */






    /* ===== CONTROLE DE EXIBIÇÃO ===== */


    // Carregar estado atual




    /* ===== CONFIGURAÇÕES ===== */









    /* ===== VALIDAÇÕES ===== */

    async validateImage(file) {
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        const maxSize = 5 * 1024 * 1024; // 5MB

        if (!validTypes.includes(file.type)) {
            return {
                valid: false,
                error: 'Formato inválido. Use JPG, PNG, GIF ou WEBP'
            };
        }

        if (file.size > maxSize) {
            return {
                valid: false,
                error: 'Arquivo muito grande. Máximo de 5MB'
            };
        }

        return { valid: true };
    }

    /* ===== UTILITÁRIOS ===== */

    handleDataUpdate(dataType) {
        if (this.currentTab === 'dashboard') {
            this.dashboardManager.renderDashboard();
        }
        // Recarregar apenas os dados afetados
        switch (dataType) {
            case 'schools':
                this.schoolManager.renderSchools();
                break;
            case 'judges':
                this.judgeManager.renderJudges();
                this.judgeManager.renderJudgeCategoryCheckboxes();
                break;
            case 'categories':
                this.categoryManager.renderCategories();
                this.judgeManager.renderJudgeCategoryCheckboxes();
                this.displayManager.populateCategorySelects();
                break;
            case 'scores':
                // Recarregar grid se estiver na aba de lançamentos
                if (this.currentTab === 'scores') {
                    const categorySelect = document.getElementById('scoreCategorySelect');
                    if (categorySelect && categorySelect.value) {
                        this.scoreManager.loadScoresGrid(categorySelect.value);
                    }
                }
                break;
            case 'displayControl':
                this.displayManager.loadDisplayControlState();
                break;
            case 'settings':
                this.renderStats();
                this.settingsManager.renderTiebreakers();
                this.settingsManager.renderBackupsHistory();
                break;
            case 'all':
                this.loadAllData();
                break;
        }
    }

    loadAllData() {
        this.schoolManager.renderSchools();
        this.judgeManager.renderJudges();
        this.categoryManager.renderCategories();
        this.judgeManager.renderJudgeCategoryCheckboxes();
        this.displayManager.populateCategorySelects();
        this.renderStats();
        this.dashboardManager.renderDashboard();
    }

    loadTabData(tabName) {
        switch (tabName) {
            case 'dashboard':
                this.dashboardManager.renderDashboard();
                break;
            case 'schools':
                this.schoolManager.renderSchools();
                break;
            case 'judges':
                this.judgeManager.renderJudges();
                this.judgeManager.renderJudgeCategoryCheckboxes();
                break;
            case 'categories':
                this.categoryManager.renderCategories();
                break;
            case 'scores':
                this.displayManager.populateCategorySelects();
                break;
            case 'display':
                this.displayManager.loadDisplayControlState();
                this.displayManager.populateCategorySelects();
                break;
            case 'settings':
                this.renderStats();
                this.settingsManager.renderBackupsHistory();
                break;
        }
    }

    renderStats() {
        const schools = this.storage.getSchools();
        const judges = this.storage.getJudges();
        const categories = this.storage.getCategories();
        const scores = this.storage.getScores();

        const statsContainer = document.getElementById('statsContainer');
        if (statsContainer) {
            statsContainer.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="value">${schools.length}</div>
                    <div class="label">Agremiações</div>
                </div>
                <div class="stat-card">
                    <div class="value">${judges.length}</div>
                    <div class="label">Jurados</div>
                </div>
                <div class="stat-card">
                    <div class="value">${categories.length}</div>
                    <div class="label">Quesitos</div>
                </div>
                <div class="stat-card">
                    <div class="value">${scores.length}</div>
                    <div class="label">Notas Lançadas</div>
                </div>
            </div>
            `;
        }
    }

    setButtonLoading(button, isLoading) {
        if (isLoading) {
            button.disabled = true;
            button.dataset.originalText = button.textContent;
            button.innerHTML = '<span class="loading"></span> Salvando...';
        } else {
            button.disabled = false;
            button.textContent = button.dataset.originalText || 'Salvar';
        }
    }

    showAlert(message, type = 'info') {
        const container = document.getElementById('alertContainer');
        if (!container) return;

        const alert = document.createElement('div');
        alert.className = `alert alert - ${type} slide -in -down`;
        alert.textContent = message;

        container.appendChild(alert);

        // Auto remove após 5 segundos
        setTimeout(() => {
            alert.style.opacity = '0';
            alert.style.transform = 'translateY(-20px)';
            setTimeout(() => alert.remove(), 300);
        }, 5000);
    }

    updateFileLabel(inputId, text) {
        const label = document.querySelector(`label[for="${inputId}"] .file-upload-text`);
        if (label) {
            label.textContent = text;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatDate(isoString) {
        if (!isoString) return 'N/A';
        const date = new Date(isoString);
        return date.toLocaleDateString('pt-BR');
    }

    generateTransparencyReport() {
        const schools = this.storage.getSchools();
        const categories = this.storage.getCategories().sort((a, b) => a.order - b.order);
        const judges = this.storage.getJudges();

        // Calcular totais e organizar dados
        const schoolsData = schools.map(school => {
            const schoolScores = this.storage.getScoresBySchool(school.id);
            const categoryDetails = categories.map(cat => {
                const catScores = schoolScores.filter(s => s.categoryId === cat.id);
                // Filtrar apenas notas existentes e válidas
                const validScores = catScores.map(s => s.score).filter(s => s !== null && s !== undefined);
                const sum = validScores.reduce((acc, curr) => acc + curr, 0);

                return {
                    name: cat.name,
                    scores: validScores, // Array de notas para listar
                    sum: sum
                };
            });

            const totalScore = categoryDetails.reduce((acc, cat) => acc + cat.sum, 0);
            const penalty = school.penalty ? parseFloat(school.penalty) : 0;
            const finalTotal = totalScore - penalty;

            return {
                name: school.name,
                categoryDetails,
                totalScore,
                penalty,
                finalTotal
            };
        }).sort((a, b) => b.finalTotal - a.finalTotal); // Ranking

        // Gerar HTML
        let html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Relatório de Apuração</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #333; max-width: 800px; margin: 0 auto; }
                    .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #333; padding-bottom: 20px; }
                    h1 { margin: 0; font-size: 24px; text-transform: uppercase; }
                    .date { color: #666; font-size: 14px; margin-top: 5px; }
                    
                    .school-section { margin-bottom: 40px; page-break-inside: avoid; border: 1px solid #ddd; padding: 20px; border-radius: 8px; }
                    .school-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px; }
                    .school-rank { font-size: 14px; font-weight: bold; color: #666; }
                    .school-name { font-size: 20px; font-weight: bold; color: #000; }
                    .school-total { font-size: 18px; font-weight: bold; color: #2c3e50; }
                    
                    table { width: 100%; border-collapse: collapse; font-size: 13px; }
                    th, td { padding: 8px; text-align: left; border-bottom: 1px solid #eee; }
                    th { font-weight: 600; color: #555; background: #f9f9f9; }
                    .scores-col { font-family: 'Consolas', monospace; color: #444; }
                    .sum-col { font-weight: bold; text-align: right; width: 60px; }
                    
                    .summary { margin-top: 15px; text-align: right; font-size: 14px; }
                    .summary-row { margin-bottom: 4px; }
                    .penalty { color: #d32f2f; }
                    .final-row { font-size: 16px; font-weight: bold; margin-top: 8px; border-top: 1px solid #ddd; padding-top: 8px; }

                    @media print {
                        body { padding: 0; max-width: 100%; }
                        .school-section { border: none; border-bottom: 1px solid #000; border-radius: 0; break-inside: avoid; }
                        .no-print { display: none; }
                        @page { size: A4 portrait; margin: 15mm; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Relatório de Apuração</h1>
                    <div class="date">Gerado em ${new Date().toLocaleString('pt-BR')}</div>
                </div>

                <button onclick="window.print()" class="no-print" style="padding: 10px 20px; margin-bottom: 20px; cursor: pointer;">🖨️ Imprimir</button>
        `;

        schoolsData.forEach((school, index) => {
            html += `
                <div class="school-section">
                    <div class="school-header">
                        <div>
                            <span class="school-rank">${index + 1}º Lugar</span><br>
                            <span class="school-name">${this.escapeHtml(school.name)}</span>
                        </div>
                        <div class="school-total">${school.finalTotal.toFixed(1)}</div>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>Quesito</th>
                                <th>Notas Atribuídas</th>
                                <th style="text-align:right">Soma</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            school.categoryDetails.forEach(cat => {
                const scoresStr = cat.scores.length > 0 ? cat.scores.map(s => s.toFixed(1)).join(' | ') : '-';
                html += `
                    <tr>
                        <td>${this.escapeHtml(cat.name)}</td>
                        <td class="scores-col">${scoresStr}</td>
                        <td class="sum-col">${cat.sum.toFixed(1)}</td>
                    </tr>
                `;
            });

            html += `
                        </tbody>
                    </table>

                    <div class="summary">
                        <div class="summary-row">Subtotal: ${school.totalScore.toFixed(1)}</div>
                        ${school.penalty > 0 ? `<div class="summary-row penalty">Penalidades: -${school.penalty.toFixed(1)}</div>` : ''}
                        <div class="final-row">Total Final: ${school.finalTotal.toFixed(1)}</div>
                    </div>
                </div>
            `;
        });

        html += `</body></html>`;

        const win = window.open('', '_blank');
        win.document.write(html);
        win.document.close();

        // Auto-print
        win.onload = function () {
            setTimeout(() => win.print(), 500);
        };
    }

    showConfirm(title, message) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'custom-modal-backdrop fade-in';
            modal.innerHTML = `
                <div class="custom-modal scale-in">
                    <div class="custom-modal-header">
                        <h3>${title}</h3>
                    </div>
                    <div class="custom-modal-body">
                        <p style="white-space: pre-line;">${message}</p>
                    </div>
                    <div class="custom-modal-footer">
                        <button class="btn btn-secondary btn-cancel">Cancelar</button>
                        <button class="btn btn-danger btn-confirm">Confirmar</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            const btnCancel = modal.querySelector('.btn-cancel');
            const btnConfirm = modal.querySelector('.btn-confirm');
            
            const close = (result) => {
                modal.classList.add('fade-out');
                modal.querySelector('.custom-modal').classList.add('scale-out');
                setTimeout(() => {
                    modal.remove();
                    resolve(result);
                }, 300);
            };
            
            btnCancel.addEventListener('click', () => close(false));
            btnConfirm.addEventListener('click', () => close(true));
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) close(false);
            });
        });
    }


















    



} // Fim da classe AdminPanel

// Inicializar quando o DOM estiver pronto
let adminPanel;
document.addEventListener('DOMContentLoaded', () => {
    adminPanel = new AdminPanel();
    window.adminPanel = adminPanel;
});
