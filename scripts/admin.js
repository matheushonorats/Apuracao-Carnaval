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

        try { this.setupDashboardControls(); } catch (e) { console.error('setupDashboardControls:', e); }
        try { this.setupSearchInput(); } catch (e) { console.error('setupSearchInput:', e); }
        try { this.setupChromaKeyHandler(); } catch (e) { console.error('setupChromaKeyHandler:', e); }
        try { this.setupRevelationControls(); } catch (e) { console.error('setupRevelationControls:', e); }
        try { this.checkLocalStorageUsage(); } catch (e) { console.error('checkLocalStorageUsage:', e); }
        try { this.setupPinAuthentication(); } catch (e) { console.error('setupPinAuthentication:', e); }
        try { this.setupPinSettings(); } catch (e) { console.error('setupPinSettings:', e); }
        try { this.startAutoBackup(); } catch (e) { console.error('startAutoBackup:', e); }

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
            schoolForm.addEventListener('submit', (e) => this.handleSchoolSubmit(e));
        }

        // Formulário de jurados
        const judgeForm = document.getElementById('judgeForm');
        if (judgeForm) {
            judgeForm.addEventListener('submit', (e) => this.handleJudgeSubmit(e));
        }

        // Formulário de quesitos
        const categoryForm = document.getElementById('categoryForm');
        if (categoryForm) {
            categoryForm.addEventListener('submit', (e) => this.handleCategorySubmit(e));
        }

        // Botão de salvar notas
        const saveScoresBtn = document.getElementById('saveScoresBtn');
        if (saveScoresBtn) {
            saveScoresBtn.addEventListener('click', () => this.handleSaveScores());
        }

        // Seletor de quesito para lançamento
        const categorySelect = document.getElementById('scoreCategorySelect');
        if (categorySelect) {
            categorySelect.addEventListener('change', (e) => {
                this.loadScoresGrid(e.target.value);
                // Sincronizar display público com o quesito selecionado
                if (e.target.value) {
                    this.storage.updateDisplayControl({ currentCategoryId: e.target.value });
                }
            });
        }

        // Controle de exibição
        this.setupDisplayControls();

        // Export/Import
        this.setupDataManagement();

        // Desempate
        this.setupTiebreakers();
    }

    /* ===== ESCOLAS ===== */

    async handleSchoolSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');

        try {
            const name = form.schoolName.value.trim();
            const penalty = form.schoolPenalty.value;
            const logoFile = form.schoolLogo.files[0];

            // Validações
            if (!name || name.length < 3) {
                this.showAlert('❌ O nome da agremiação deve ter pelo menos 3 caracteres', 'error');
                form.schoolName.focus();
                return;
            }

            // Verificar duplicatas
            const schools = this.storage.getSchools();
            const isDuplicate = schools.some(s =>
                s.name.toLowerCase() === name.toLowerCase() &&
                s.id !== this.editingSchoolId
            );

            if (isDuplicate) {
                this.showAlert('❌ Já existe uma agremiação com este nome', 'error');
                form.schoolName.focus();
                return;
            }

            // Validar logo se fornecido
            let logoDataURL = null;
            if (logoFile) {
                const validation = await this.validateImage(logoFile);
                if (!validation.valid) {
                    this.showAlert(`❌ ${validation.error}`, 'error');
                    return;
                }
                logoDataURL = await this.fileToDataURL(logoFile);
            }

            // Loading state
            this.setButtonLoading(submitBtn, true);

            // Salvar
            if (this.editingSchoolId) {
                const updates = { name, penalty: penalty ? parseFloat(penalty) : 0 };
                if (logoDataURL) updates.logoDataURL = logoDataURL;
                this.storage.updateSchool(this.editingSchoolId, updates);
                this.showAlert('✅ Agremiação atualizada com sucesso!', 'success');
                this.editingSchoolId = null;
            } else {
                const newSchool = this.storage.addSchool(name, logoDataURL);
                if (penalty) {
                    this.storage.updateSchoolPenalty(newSchool.id, penalty);
                }
                this.showAlert('✅ Agremiação adicionada com sucesso!', 'success');
            }

            // Resetar formulário
            form.reset();
            submitBtn.textContent = 'Adicionar Agremiação';
            submitBtn.classList.remove('btn-success');
            this.editingSchoolId = null;
            this.updateFileLabel('schoolLogo', 'Escolher logo...');

        } catch (error) {
            console.error('Erro ao salvar escola:', error);
            this.showAlert('❌ Erro ao salvar agremiação: ' + error.message, 'error');
        } finally {
            this.setButtonLoading(submitBtn, false);
        }
    }

    renderSchools() {
        console.log('🔄 RenderSchools: Iniciando renderização...');
        const schools = this.storage.getSchools();
        console.log(`📊 Escolas encontradas: ${schools.length}`);

        const tbody = document.querySelector('#schools-list tbody');
        const container = tbody;
        if (!container) {
            console.error('❌ RenderSchools: Container #schools-list tbody não encontrado!');
            return;
        }

        if (schools.length === 0) {
            console.log('ℹ️ Nenhuma escola para exibir.');
            container.innerHTML = `
                <div class="empty-state">
                    <div class="icon">🎭</div>
                    <h3>Nenhuma agremiação cadastrada</h3>
                    <p>Adicione a primeira agremiação usando o formulário acima</p>
                </div>
            `;
            return;
        }

        container.innerHTML = schools.map(school => `
            <div class="item-card slide-in-up">
                <img src="${school.logoDataURL || 'assets/default-logo.png'}" 
                     alt="${school.name}" 
                     class="item-logo"
                     onerror="this.src='assets/default-logo.png'">
                <div class="item-info">
                    <div class="item-name">${this.escapeHtml(school.name)}</div>
                    <div class="item-meta">Cadastrada em ${this.formatDate(school.createdAt)}</div>
                </div>
                <div class="item-actions">
                    <button class="btn btn-secondary btn-icon" 
                            onclick="adminPanel.editSchool('${school.id}')"
                            title="Editar">
                        ✏️
                    </button>
                    <button class="btn btn-danger btn-icon" 
                            onclick="adminPanel.deleteSchool('${school.id}')"
                            title="Excluir">
                        🗑️
                    </button>
                </div>
            </div >
            `).join('');
    }

    editSchool(id) {
        const school = this.storage.getSchools().find(s => s.id === id);
        if (!school) {
            console.error('editSchool: escola não encontrada:', id);
            return;
        }

        console.log('editSchool:', id, school.name);

        const form = document.getElementById('schoolForm');
        form.schoolName.value = school.name;
        form.schoolPenalty.value = school.penalty || '';

        this.editingSchoolId = id;
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.textContent = '💾 Atualizar Agremiação';
        submitBtn.classList.add('btn-success');

        this.showAlert(`✏️ Editando: ${school.name}. Altere os dados e clique em Atualizar.`, 'info');

        // Scroll to form
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    async deleteSchool(id) {
        const school = this.storage.getSchools().find(s => s.id === id);
        if (!school) return;

        const scores = this.storage.getScoresBySchool(id);
        const hasScores = scores.length > 0;

        const confirmMsg = hasScores
            ? `Tem certeza que deseja excluir "${school.name}"?\n\nTodas as ${scores.length} nota(s) desta escola serão PERDIDAS permanentemente!`
            : `Confirma a exclusão de "${school.name}"?`;

        const confirmed = await this.showConfirm('⚠️ Excluir Agremiação', confirmMsg);
        if (confirmed) {
            try {
                this.storage.deleteSchool(id);
                this.showAlert('✅ Agremiação excluída com sucesso', 'success');
            } catch (error) {
                console.error('Erro ao excluir escola:', error);
                this.showAlert('❌ Erro ao excluir agremiação', 'error');
            }
        }
    }

    /* ===== JURADOS ===== */

    async handleJudgeSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');

        try {
            const name = form.judgeName.value.trim();
            const categoryCheckboxes = form.querySelectorAll('input[name="judgeCategories"]:checked');
            const categoryIds = Array.from(categoryCheckboxes).map(cb => cb.value);

            // Validações
            if (!name || name.length < 2) {
                this.showAlert('❌ O nome do jurado deve ter pelo menos 2 caracteres', 'error');
                form.judgeName.focus();
                return;
            }

            // Verificar duplicatas
            const judges = this.storage.getJudges();
            const isDuplicate = judges.some(j =>
                j.name.toLowerCase() === name.toLowerCase() &&
                j.id !== this.editingJudgeId
            );

            if (isDuplicate) {
                this.showAlert('❌ Já existe um jurado com este nome', 'error');
                return;
            }

            this.setButtonLoading(submitBtn, true);

            if (this.editingJudgeId) {
                this.storage.updateJudge(this.editingJudgeId, { name, categoryIds });
                this.showAlert('✅ Jurado atualizado com sucesso!', 'success');
                this.editingJudgeId = null;
            } else {
                this.storage.addJudge(name, categoryIds);
                this.showAlert('✅ Jurado adicionado com sucesso!', 'success');
            }

            form.reset();

        } catch (error) {
            console.error('Erro ao salvar jurado:', error);
            this.showAlert('❌ Erro ao salvar jurado: ' + error.message, 'error');
        } finally {
            this.setButtonLoading(submitBtn, false);
        }
    }

    renderJudges() {
        const judges = this.storage.getJudges();
        const categories = this.storage.getCategories();
        const container = document.getElementById('judgesList');

        if (!container) return;

        if (judges.length === 0) {
            container.innerHTML = `
            <div class="empty-state">
                    <div class="icon">👨‍⚖️</div>
                    <h3>Nenhum jurado cadastrado</h3>
                    <p>Adicione o primeiro jurado usando o formulário acima</p>
                </div>
            `;
            return;
        }

        container.innerHTML = judges.map(judge => {
            const judgeCats = judge.categoryIds && judge.categoryIds.length > 0
                ? categories.filter(c => judge.categoryIds.includes(c.id)).map(c => c.name).join(', ')
                : 'Todos os quesitos';

            return `
            <div class="item-card slide-in-up">
                    <div class="item-logo" style="display: flex; align-items: center; justify-content: center; font-size: 2rem;">
                        👨‍⚖️
                    </div>
                    <div class="item-info">
                        <div class="item-name">${this.escapeHtml(judge.name)}</div>
                        <div class="item-meta">${this.escapeHtml(judgeCats)}</div>
                    </div>
                    <div class="item-actions">
                        <button class="btn btn-secondary btn-icon" 
                                onclick="adminPanel.editJudge('${judge.id}')"
                                title="Editar">
                            ✏️
                        </button>
                        <button class="btn btn-danger btn-icon" 
                                onclick="adminPanel.deleteJudge('${judge.id}')"
                                title="Excluir">
                            🗑️
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    editJudge(id) {
        const judge = this.storage.getJudges().find(j => j.id === id);
        if (!judge) return;

        const form = document.getElementById('judgeForm');
        form.judgeName.value = judge.name;

        // Marcar checkboxes
        const checkboxes = form.querySelectorAll('input[name="judgeCategories"]');
        checkboxes.forEach(cb => {
            cb.checked = judge.categoryIds && judge.categoryIds.includes(cb.value);
        });

        this.editingJudgeId = id;
        form.querySelector('button[type="submit"]').textContent = 'Atualizar Jurado';

        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    async deleteJudge(id) {
        const judge = this.storage.getJudges().find(j => j.id === id);
        if (!judge) return;

        const scores = this.storage.getScores().filter(s => s.judgeId === id);
        const hasScores = scores.length > 0;

        const confirmMsg = hasScores
            ? `Tem certeza que deseja excluir "${judge.name}"?\n\nTodas as ${scores.length} nota(s) deste jurado serão PERDIDAS!`
            : `Confirma a exclusão de "${judge.name}"?`;

        const confirmed = await this.showConfirm('⚠️ Excluir Jurado', confirmMsg);
        if (confirmed) {
            try {
                this.storage.deleteJudge(id);
                this.showAlert('✅ Jurado excluído com sucesso', 'success');
            } catch (error) {
                console.error('Erro ao excluir jurado:', error);
                this.showAlert('❌ Erro ao excluir jurado', 'error');
            }
        }
    }

    renderJudgeCategoryCheckboxes() {
        const categories = this.storage.getCategories();
        const container = document.getElementById('judgeCategoriesContainer');

        if (!container) return;

        if (categories.length === 0) {
            container.innerHTML = '<p class="text-muted text-sm">Cadastre quesitos primeiro</p>';
            return;
        }

        container.innerHTML = categories.map(cat => `
            <label class="flex items-center gap-sm cursor-pointer">
                <input type="checkbox" name="judgeCategories" value="${cat.id}">
                    <span>${this.escapeHtml(cat.name)}</span>
                </label>
        `).join('');
    }

    /* ===== QUESITOS/CATEGORIAS ===== */

    async handleCategorySubmit(e) {
        e.preventDefault();
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');

        try {
            const name = form.categoryName.value.trim();
            const order = parseInt(form.categoryOrder.value) || 0;

            // Validações
            if (!name || name.length < 2) {
                this.showAlert('❌ O nome do quesito deve ter pelo menos 2 caracteres', 'error');
                form.categoryName.focus();
                return;
            }

            if (order <= 0) {
                this.showAlert('❌ A ordem deve ser um número maior que zero', 'error');
                form.categoryOrder.focus();
                return;
            }

            // Verificar duplicatas
            const categories = this.storage.getCategories();
            const isDuplicate = categories.some(c =>
                c.name.toLowerCase() === name.toLowerCase() &&
                c.id !== this.editingCategoryId
            );

            if (isDuplicate) {
                this.showAlert('❌ Já existe um quesito com este nome', 'error');
                return;
            }

            this.setButtonLoading(submitBtn, true);

            if (this.editingCategoryId) {
                this.storage.updateCategory(this.editingCategoryId, { name, order });
                this.showAlert('✅ Quesito atualizado com sucesso!', 'success');
                this.editingCategoryId = null;
            } else {
                this.storage.addCategory(name, order);
                this.showAlert('✅ Quesito adicionado com sucesso!', 'success');
            }

            form.reset();

            // Atualizar componentes que dependem de categorias
            this.renderJudgeCategoryCheckboxes();
            this.populateCategorySelects();

        } catch (error) {
            console.error('Erro ao salvar quesito:', error);
            this.showAlert('❌ Erro ao salvar quesito: ' + error.message, 'error');
        } finally {
            this.setButtonLoading(submitBtn, false);
        }
    }

    renderCategories() {
        const categories = this.storage.getCategories().sort((a, b) => a.order - b.order);

        // Atualizar checkboxes de jurados também
        this.renderJudgeCategoryCheckboxes();
        const container = document.getElementById('categoriesList');

        if (!container) return;

        if (categories.length === 0) {
            container.innerHTML = `
            <div class="empty-state">
                    <div class="icon">📋</div>
                    <h3>Nenhum quesito cadastrado</h3>
                    <p>Adicione o primeiro quesito usando o formulário acima</p>
                </div>
            `;
            return;
        }

        container.innerHTML = categories.map(cat => `
            <div class="item-card slide-in-up">
                <div class="item-logo" style="display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: bold;">
                    ${cat.order}
                </div>
                <div class="item-info">
                    <div class="item-name">${this.escapeHtml(cat.name)}</div>
                    <div class="item-meta">Ordem de exibição: ${cat.order}</div>
                </div>
                <div class="item-actions">
                    <button class="btn btn-secondary btn-icon" 
                            onclick="adminPanel.editCategory('${cat.id}')"
                            title="Editar">
                        ✏️
                    </button>
                    <button class="btn btn-danger btn-icon" 
                            onclick="adminPanel.deleteCategory('${cat.id}')"
                            title="Excluir">
                        🗑️
                    </button>
                </div>
            </div >
            `).join('');
    }

    editCategory(id) {
        const category = this.storage.getCategories().find(c => c.id === id);
        if (!category) return;

        const form = document.getElementById('categoryForm');
        form.categoryName.value = category.name;
        form.categoryOrder.value = category.order;

        this.editingCategoryId = id;
        form.querySelector('button[type="submit"]').textContent = 'Atualizar Quesito';

        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    async deleteCategory(id) {
        const category = this.storage.getCategories().find(c => c.id === id);
        if (!category) return;

        const scores = this.storage.getScoresByCategory(id);
        const hasScores = scores.length > 0;

        const confirmMsg = hasScores
            ? `Tem certeza que deseja excluir "${category.name}"?\n\nTodas as ${scores.length} nota(s) deste quesito serão PERDIDAS!`
            : `Confirma a exclusão de "${category.name}"?`;

        const confirmed = await this.showConfirm('⚠️ Excluir Quesito', confirmMsg);
        if (confirmed) {
            try {
                this.storage.deleteCategory(id);
                this.showAlert('✅ Quesito excluído com sucesso', 'success');
            } catch (error) {
                console.error('Erro ao excluir quesito:', error);
                this.showAlert('❌ Erro ao excluir quesito', 'error');
            }
        }
    }

    /* CONTINUA NA PARTE 2... */
    /* ===== LANÇAMENTO DE NOTAS ===== */

    loadScoresGrid(categoryId, focusIndex = null) {
        if (!categoryId) {
            document.getElementById('scoresGridContainer').innerHTML = `
            <p class="text-muted">Selecione um quesito acima para lançar as notas</p>
                `;
            return;
        }

        // ATUALIZAÇÃO SOLICITADA: Sincronizar display com o quesito sendo lançado
        this.storage.updateDisplayControl({ currentCategoryId: categoryId });

        // Atualizar também o select da aba de controle (visual apenas)
        const displaySelect = document.getElementById('displayCategorySelect');
        if (displaySelect) displaySelect.value = categoryId;

        const schools = this.storage.getSchools();
        const judges = this.storage.getJudges();
        const category = this.storage.getCategories().find(c => c.id === categoryId);

        if (!category) return;

        // Filtrar jurados que julgam este quesito
        const relevantJudges = judges.filter(j =>
            !j.categoryIds || j.categoryIds.length === 0 || j.categoryIds.includes(categoryId)
        );

        if (relevantJudges.length === 0) {
            document.getElementById('scoresGridContainer').innerHTML = `
                <div class="empty-state">
                <div class="icon">⚠️</div>
                <h3>Nenhum jurado disponível</h3>
                <p>Cadastre jurados que avaliam este quesito</p>
            </div>
            `;
            return;
        }

        if (schools.length === 0) {
            document.getElementById('scoresGridContainer').innerHTML = `
            <div class="empty-state">
                <div class="icon">⚠️</div>
                <h3>Nenhuma agremiação cadastrada</h3>
                <p>Cadastre agremiações primeiro</p>
            </div>
            `;
            return;
        }

        // Obter notas existentes
        const existingScores = this.storage.getScoresByCategory(categoryId);

        // Montar tabela
        let html = `
            <div class="scores-grid">
                <table class="scores-table">
                    <thead>
                        <tr>
                            <th>Agremiação</th>
                            ${relevantJudges.map(j => `<th>${this.escapeHtml(j.name)}</th>`).join('')}
                            <th>Parcial</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        `;

        schools.forEach(school => {
            html += `<tr>`;
            html += `<td>${this.escapeHtml(school.name)}</td>`;

            relevantJudges.forEach(judge => {
                const score = existingScores.find(s =>
                    s.schoolId === school.id && s.judgeId === judge.id
                );
                const value = score ? score.score : '';

                html += `
                        <td>
                            <input type="number"
                                class="input"
                                data-school="${school.id}"
                                data-judge="${judge.id}"
                                data-category="${categoryId}"
                                value="${value}"
                                min="0"
                                max="10"
                                step="0.1"
                                placeholder="0.0">
                        </td>
                        `;
            });

            // Calcular total do Quesito
            const schoolTotal = this.storage.getSchoolCategoryTotal(school.id, categoryId);

            // Calcular total GERAL (todas as notas)
            const schoolGrandTotal = this.storage.getSchoolTotal(school.id);

            html += `<td class="text-center partial-total-cell" data-school="${school.id}" style="background-color: #1e293b; color: #fff;"><strong>${schoolTotal.toFixed(1)}</strong></td>`;
            html += `<td class="text-center grand-total-cell" data-school="${school.id}" style="background-color: #0f172a; color: #fff; border-left: 1px solid #334155;"><strong>${schoolGrandTotal.toFixed(1)}</strong></td>`;

            html += `</tr>`;
        });

        html += `
                </tbody>
            </table>
        </div>
            `;

        document.getElementById('scoresGridContainer').innerHTML = html;

        // Renderizar progresso de notas do quesito
        const progressWrapper = document.getElementById('scoreCategoryProgressWrapper');
        const progressText = document.getElementById('scoreCategoryProgressText');
        const progressBar = document.getElementById('scoreCategoryProgressBar');

        if (progressWrapper && progressText && progressBar) {
            const totalExpected = schools.length * relevantJudges.length;
            const validScoresCount = existingScores.filter(s => s.score !== null && s.score !== undefined).length;
            const percentage = totalExpected > 0 ? (validScoresCount / totalExpected) * 100 : 0;

            progressText.textContent = `${validScoresCount}/${totalExpected}`;
            progressBar.style.width = `${percentage}%`;
            progressWrapper.classList.remove('hidden');
        }

        // Adicionar listeners para Enter, Focus e Blur
        const inputs = document.querySelectorAll('#scoresGridContainer input[type="number"]');
        const table = document.querySelector('#scoresGridContainer table');

        inputs.forEach((input, index) => {
            // Recalculo em tempo real (input event)
            input.addEventListener('input', () => {
                const schoolId = input.dataset.school;
                
                // Validação rápida de limite e casas decimais
                let value = input.value.trim();
                if (value !== '') {
                    let numValue = parseFloat(value);
                    if (numValue < 0) input.value = '0';
                    if (numValue > 10) input.value = '10';
                    
                    // Se tiver mais de 2 casas decimais, arredondar no input
                    if (value.includes('.') && value.split('.')[1].length > 2) {
                        input.value = numValue.toFixed(2);
                    }
                }
                
                // Recalcular soma parcial
                const schoolInputs = document.querySelectorAll(`#scoresGridContainer input[data-school="${schoolId}"]`);
                let partialSum = 0;
                schoolInputs.forEach(si => {
                    const val = parseFloat(si.value);
                    if (!isNaN(val) && val >= 0 && val <= 10) {
                        partialSum += val;
                    }
                });
                
                // Atualizar célula parcial
                const tr = input.closest('tr');
                if (tr) {
                    const partialCell = tr.querySelector('.partial-total-cell');
                    if (partialCell) {
                        partialCell.innerHTML = `<strong>${partialSum.toFixed(1)}</strong>`;
                    }
                }
                
                // Recalcular geral
                const allScores = this.storage.getScoresBySchool(schoolId);
                const otherScoresSum = allScores
                    .filter(s => s.categoryId !== categoryId)
                    .reduce((sum, s) => sum + s.score, 0);
                
                const schoolObj = this.storage.getSchools().find(s => s.id === schoolId);
                const penalty = schoolObj && schoolObj.penalty ? parseFloat(schoolObj.penalty) : 0;
                
                const grandTotal = otherScoresSum + partialSum - penalty;
                if (tr) {
                    const grandCell = tr.querySelector('.grand-total-cell');
                    if (grandCell) {
                        grandCell.innerHTML = `<strong>${grandTotal.toFixed(1)}</strong>`;
                    }
                }
            });
            // ENTER: Navegação e Salvar com Feedback
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    // Navegação Vertical
                    const nextIndex = index + relevantJudges.length;

                    // Se estiver na última linha, apenas salva e recarrega
                    // Se tiver próxima, foca nela após salvar (via handleSaveScores recarregando grid)
                    this.handleSaveScores(nextIndex);
                }
            });

            // FOCUS: Highlight
            input.addEventListener('focus', () => {
                const tr = input.closest('tr');
                if (tr) tr.classList.add('row-highlight');

                const td = input.closest('td');
                if (td && table) {
                    const cellIndex = td.cellIndex;
                    // Adicionar highlight em todas as células desta coluna
                    const rows = table.querySelectorAll('tbody tr');
                    rows.forEach(row => {
                        if (row.cells[cellIndex]) row.cells[cellIndex].classList.add('col-highlight');
                    });
                }
            });

            // BLUR: Remove Highlight + Auto-Save (Silent)
            input.addEventListener('blur', () => {
                const tr = input.closest('tr');
                if (tr) tr.classList.remove('row-highlight');

                const td = input.closest('td');
                if (td && table) {
                    const cellIndex = td.cellIndex;
                    const rows = table.querySelectorAll('tbody tr');
                    rows.forEach(row => {
                        if (row.cells[cellIndex]) row.cells[cellIndex].classList.remove('col-highlight');
                    });
                }

                // Salvar sileciosamente ao sair do campo
                // Passamos true para 'silent' para não exibir alertas nem recarregar a grid (para não perder foco se o usuário clicou rapidamente em outro campo)
                this.handleSaveScores(null, true);
            });
        });

        if (focusIndex !== null && inputs.length > 0) {
            if (focusIndex < inputs.length) {
                inputs[focusIndex].focus();
            }
        }
    }

    handleSaveScores(nextFocusIndex = null, silent = false) {
        const categorySelect = document.getElementById('scoreCategorySelect');
        const categoryId = categorySelect.value;

        if (!categoryId) {
            if (!silent) this.showAlert('⚠️ Selecione um quesito primeiro', 'warning');
            return;
        }

        const inputs = document.querySelectorAll('#scoresGridContainer input[type="number"]');
        const scoresToSave = [];
        let hasInvalidScore = false;
        let invalidCount = 0;

        // Validar todas as notas primeiro
        inputs.forEach(input => {
            const value = input.value.trim();

            // Remover destaque anterior
            input.classList.remove('input-error');

            if (value !== '') {
                const numValue = parseFloat(value);

                if (isNaN(numValue) || numValue < 0 || numValue > 10) {
                    hasInvalidScore = true;
                    invalidCount++;
                    input.classList.add('input-error');
                } else {
                    scoresToSave.push({
                        schoolId: input.dataset.school,
                        categoryId: input.dataset.category,
                        judgeId: input.dataset.judge,
                        score: numValue
                    });
                }
            }
        });

        if (hasInvalidScore) {
            if (!silent) {
                this.showAlert(
                    `❌ ${invalidCount} nota(s) inválida(s)! As notas devem estar entre 0 e 10`,
                    'error'
                );
            }
            return;
        }

        if (scoresToSave.length === 0) {
            // Se estiver limpando tudo e silent, ok.
            if (!silent) this.showAlert('⚠️ Nenhuma nota foi informada', 'warning');
            return;
        }

        try {
            this.storage.saveScores(scoresToSave);

            if (!silent) {
                this.showAlert(`✅ ${scoresToSave.length} nota(s) salva(s) com sucesso!`, 'success');
                // Recarregar grid para mostrar totais atualizados e mover foco
                this.loadScoresGrid(categoryId, nextFocusIndex);
            } else {
                console.log('✅ Auto-save realizado.');
                // Em modo silencioso, NÃO recarregamos a grid para não destruir o foco do usuário
                // O usuário verá os totais atualizados na próxima interação que recarregar a grid (Enter ou Refresh manual)
            }

        } catch (error) {
            console.error('Erro ao salvar notas:', error);
            if (!silent) this.showAlert('❌ Erro ao salvar notas', 'error');
        }
    }


    /* ===== CONTROLE DE EXIBIÇÃO ===== */

    setupDisplayControls() {
        // Sincronizar botões de visualização (Scores Tab)
        window.changeView = (viewName) => {
            // Atualizar botões na aba Scores
            document.querySelectorAll('.btn-view').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.view === viewName);
            });

            // Atualizar opções na aba Display Control (View Toggle)
            document.querySelectorAll('.view-option').forEach(option => {
                option.classList.toggle('active', option.dataset.view === viewName);
            });

            // Salvar estado no displayControl estruturado (display.js lê daqui)
            const updates = { view: viewName };
            // Ao clicar em Apuração, sincronizar com o quesito selecionado
            if (viewName === 'category') {
                const scoreSelect = document.getElementById('scoreCategorySelect');
                if (scoreSelect && scoreSelect.value) {
                    updates.currentCategoryId = scoreSelect.value;
                }
            }
            this.storage.updateDisplayControl(updates);
        };

        // Listeners para os botões da aba Controle (Options grandes)
        document.querySelectorAll('.view-option').forEach(option => {
            option.addEventListener('click', () => {
                const view = option.dataset.view;
                if (view) window.changeView(view);
            });
        });

        // Restaurar estado ativo inicial a partir do storage estruturado
        const savedControl = this.storage.getDisplayControl();
        const currentView = savedControl.view || 'category';
        // Apenas atualizar UI visual, sem re-salvar (evita loop)
        document.querySelectorAll('.btn-view').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === currentView);
        });
        document.querySelectorAll('.view-option').forEach(option => {
            option.classList.toggle('active', option.dataset.view === currentView);
        });

        const displayCategorySelect = document.getElementById('displayCategorySelect');
        const scoreCategorySelect = document.getElementById('scoreCategorySelect');

        if (displayCategorySelect) {
            displayCategorySelect.addEventListener('change', (e) => {
                this.storage.updateDisplayControl({ currentCategoryId: e.target.value });
                // Sincronizar score tab se necessário
                if (scoreCategorySelect && scoreCategorySelect.value !== e.target.value) {
                    // scoreCategorySelect.value = e.target.value; // Opcional
                }
            });
        }

        const openBtn = document.getElementById('openDisplayBtn');
        if (openBtn) {
            openBtn.addEventListener('click', () => {
                window.open('display.html', 'SambaDisplay', 'width=1280,height=720');
            });
        }
    }
    // Carregar estado atual
    loadDisplayControlState() {
        const control = this.storage.getDisplayControl();

        // Marcar vista ativa
        document.querySelectorAll('[data-view]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === control.view);
        });

        // Selecionar quesito
        const select = document.getElementById('displayCategorySelect');
        if (select && control.currentCategoryId) {
            select.value = control.currentCategoryId;
        }
    }

    populateCategorySelects() {
        const categories = this.storage.getCategories().sort((a, b) => a.order - b.order);

        // Select de lançamento - preservar seleção atual
        const scoreSelect = document.getElementById('scoreCategorySelect');
        if (scoreSelect) {
            const savedValue = scoreSelect.value;
            scoreSelect.innerHTML = '<option value="">Selecione um quesito...</option>' +
                categories.map(c => `<option value="${c.id}">${this.escapeHtml(c.name)}</option>`).join('');
            if (savedValue) scoreSelect.value = savedValue;
        }

        // Select de controle de exibição - preservar seleção atual
        const displaySelect = document.getElementById('displayCategorySelect');
        if (displaySelect) {
            const savedValue = displaySelect.value;
            displaySelect.innerHTML = '<option value="">Selecione um quesito...</option>' +
                categories.map(c => `<option value="${c.id}">${this.escapeHtml(c.name)}</option>`).join('');
            if (savedValue) displaySelect.value = savedValue;
        }
    }

    /* ===== CONFIGURAÇÕES ===== */

    setupDataManagement() {
        // Export
        const exportBtn = document.getElementById('exportDataBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                try {
                    this.storage.exportData();
                    this.showAlert('✅ Dados exportados com sucesso!', 'success');
                } catch (error) {
                    console.error('Erro ao exportar:', error);
                    this.showAlert('❌ Erro ao exportar dados', 'error');
                }
            });
        }

        // Import
        const importInput = document.getElementById('importDataInput');
        if (importInput) {
            importInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                try {
                    await this.storage.importData(file);
                    this.showAlert('✅ Dados importados com sucesso!', 'success');
                    this.loadAllData();
                } catch (error) {
                    console.error('Erro ao importar:', error);
                    this.showAlert('❌ Erro ao importar dados: ' + error.message, 'error');
                }

                e.target.value = ''; // Reset input
            });
        }

        // Clear
        const clearBtn = document.getElementById('clearDataBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', async () => {
                const confirmed = await this.showConfirm(
                    '🗑️ Zerar Notas',
                    'Tem certeza que deseja apagar TODAS as notas lançadas?\n\n- Escolas, Jurados e Quesitos cadastrados serão MANTIDOS.\n- Apenas as notas registradas serão limpas.\n- Essa ação não pode ser desfeita.'
                );
                if (confirmed) {
                    this.storage.clearScoresOnly();
                    this.showAlert('✅ Notas zeradas com sucesso (Cadastros mantidos)', 'success');
                }
            });
        }

        // Otimizar Banco
        const optimizeBtn = document.getElementById('optimizeDataBtn');
        if (optimizeBtn) {
            optimizeBtn.addEventListener('click', () => {
                const removed = this.storage.optimizeData();
                if (removed > 0) {
                    this.showAlert(`✅ Otimização completa! ${removed} registros órfãos removidos.`, 'success');
                    this.loadAllData();
                } else {
                    this.showAlert('✅ Banco de dados já está limpo e otimizado.', 'info');
                }
            });
        }



        // Reports
        const reportBtn = document.getElementById('generateReportBtn');
        if (reportBtn) {
            reportBtn.addEventListener('click', () => {
                console.log('📄 Gerando relatório...');
                this.generateTransparencyReport();
            });
        }
    }

    setupTiebreakers() {
        this.renderTiebreakers();

        const saveBtn = document.getElementById('saveTiebreakersBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveTiebreakers());
        }
    }

    renderTiebreakers() {
        const categories = this.storage.getCategories();
        const settings = this.storage.getSettings();
        const container = document.getElementById('tiebreakerContainer');

        if (!container) return;

        if (categories.length === 0) {
            container.innerHTML = '<p class="text-muted text-sm">Cadastre quesitos primeiro</p>';
            return;
        }

        const tiebreakers = settings.tiebreakers || [];

        // Mapear categorias com suas prioridades atuais
        const categoriesWithPriority = categories.map((cat, index) => {
            const tiebreaker = tiebreakers.find(t => t.categoryId === cat.id);
            // Se já tem prioridade, usa. Se não, usa ordem padrão + 100 para ficar no fim
            const priority = tiebreaker ? tiebreaker.priority : (100 + index);
            return { ...cat, priority };
        });

        // Ordenar por prioridade para exibição
        categoriesWithPriority.sort((a, b) => a.priority - b.priority);

        container.innerHTML = `
            <div class="flex flex-col gap-sm">
                ${categoriesWithPriority.map((cat) => `
                    <div class="flex items-center gap-md slide-in-up">
                        <div class="flex flex-col items-center">
                            <span class="text-xs text-muted mb-xs">Ordem</span>
                            <input type="number" 
                                   class="input text-center" 
                                   style="width: 60px;" 
                                   data-category-id="${cat.id}"
                                   value="${cat.priority}"
                                   min="1"
                                   placeholder="Ordem">
                        </div>
                        <div class="flex-1 font-medium text-lg">
                            ${this.escapeHtml(cat.name)}
                        </div>
                    </div>
                `).join('')
            }
            </div>
            <div class="mt-md p-sm bg-light rounded-md border border-light">
                <p class="text-sm text-muted">💡 Defina a ordem de 1 a N. Menor número = maior prioridade no desempate.</p>
            </div>
        `;
    }

    saveTiebreakers() {
        const inputs = document.querySelectorAll('#tiebreakerContainer input[data-category-id]');
        const tiebreakers = [];

        inputs.forEach(input => {
            const categoryId = input.dataset.categoryId;
            const priority = parseInt(input.value) || 999;

            tiebreakers.push({ categoryId, priority });
        });

        this.storage.updateSettings({ tiebreakers });
        this.showAlert('✅ Critérios de desempate salvos!', 'success');
    }

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
            this.renderDashboard();
        }
        // Recarregar apenas os dados afetados
        switch (dataType) {
            case 'schools':
                this.renderSchools();
                break;
            case 'judges':
                this.renderJudges();
                this.renderJudgeCategoryCheckboxes();
                break;
            case 'categories':
                this.renderCategories();
                this.renderJudgeCategoryCheckboxes();
                this.populateCategorySelects();
                break;
            case 'scores':
                // Recarregar grid se estiver na aba de lançamentos
                if (this.currentTab === 'scores') {
                    const categorySelect = document.getElementById('scoreCategorySelect');
                    if (categorySelect && categorySelect.value) {
                        this.loadScoresGrid(categorySelect.value);
                    }
                }
                break;
            case 'displayControl':
                this.loadDisplayControlState();
                break;
            case 'settings':
                this.renderStats();
                this.renderTiebreakers();
                this.renderBackupsHistory();
                break;
            case 'all':
                this.loadAllData();
                break;
        }
    }

    loadAllData() {
        this.renderSchools();
        this.renderJudges();
        this.renderCategories();
        this.renderJudgeCategoryCheckboxes();
        this.populateCategorySelects();
        this.renderStats();
        this.renderDashboard();
    }

    loadTabData(tabName) {
        switch (tabName) {
            case 'dashboard':
                this.renderDashboard();
                break;
            case 'schools':
                this.renderSchools();
                break;
            case 'judges':
                this.renderJudges();
                this.renderJudgeCategoryCheckboxes();
                break;
            case 'categories':
                this.renderCategories();
                break;
            case 'scores':
                this.populateCategorySelects();
                break;
            case 'display':
                this.loadDisplayControlState();
                this.populateCategorySelects();
                break;
            case 'settings':
                this.renderStats();
                this.renderBackupsHistory();
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

    setupDashboardControls() {
        const dashOpenBtn = document.getElementById('dashboardOpenDisplayBtn');
        if (dashOpenBtn) {
            dashOpenBtn.addEventListener('click', () => {
                window.open('display.html', 'SambaDisplay', 'width=1280,height=720');
            });
        }
    }

    setupSearchInput() {
        const searchInput = document.getElementById('schoolSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase().trim();
                const cards = document.querySelectorAll('#schoolsList .item-card');
                cards.forEach(card => {
                    const name = card.querySelector('.item-name').textContent.toLowerCase();
                    if (name.includes(term)) {
                        card.classList.remove('hidden');
                    } else {
                        card.classList.add('hidden');
                    }
                });
            });
        }
    }

    renderDashboard() {
        const schools = this.storage.getSchools();
        const judges = this.storage.getJudges();
        const categories = this.storage.getCategories().sort((a, b) => a.order - b.order);
        const scores = this.storage.getScores();
        
        // 1. Renderizar Stats rápidos
        const statsContainer = document.getElementById('dashboardStatsContainer');
        if (statsContainer) {
            // Calcular progresso geral
            let totalExpectedScores = 0;
            categories.forEach(cat => {
                const relevantJudges = judges.filter(j => 
                    !j.categoryIds || j.categoryIds.length === 0 || j.categoryIds.includes(cat.id)
                );
                totalExpectedScores += schools.length * relevantJudges.length;
            });
            
            const validScoresCount = scores.filter(s => s.score !== null && s.score !== undefined).length;
            const generalPercentage = totalExpectedScores > 0 ? (validScoresCount / totalExpectedScores) * 100 : 0;
            
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
                        <div class="value">${generalPercentage.toFixed(0)}%</div>
                        <div class="label">Progresso Geral (${validScoresCount}/${totalExpectedScores})</div>
                    </div>
                </div>
            `;
        }
        
        // 2. Renderizar Andamento por Quesito
        const progressList = document.getElementById('dashboardCategoriesProgressList');
        if (progressList) {
            if (categories.length === 0) {
                progressList.innerHTML = '<p class="text-muted text-sm">Nenhum quesito cadastrado.</p>';
            } else {
                progressList.innerHTML = categories.map(cat => {
                    const relevantJudges = judges.filter(j => 
                        !j.categoryIds || j.categoryIds.length === 0 || j.categoryIds.includes(cat.id)
                    );
                    const expected = schools.length * relevantJudges.length;
                    const registered = scores.filter(s => s.categoryId === cat.id && s.score !== null && s.score !== undefined).length;
                    const pct = expected > 0 ? (registered / expected) * 100 : 0;
                    
                    const isComplete = registered === expected && expected > 0;
                    const statusBadge = isComplete 
                        ? '<span class="badge badge-success">Concluído</span>' 
                        : `<span class="badge badge-primary">${registered}/${expected} notas</span>`;
                        
                    return `
                        <div style="background: rgba(255,255,255,0.02); padding: 0.75rem; border-radius: var(--radius-md); border: 1px solid rgba(255,255,255,0.05);">
                            <div class="flex justify-between items-center mb-xs" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                                <span class="font-medium">${this.escapeHtml(cat.name)}</span>
                                ${statusBadge}
                            </div>
                            <div class="progress-bar-bg" style="width: 100%; height: 4px; background: rgba(255,255,255,0.05); border-radius: 2px; overflow: hidden;">
                                <div class="progress-bar-fill" style="width: ${pct}%; height: 100%; background: ${isComplete ? 'var(--color-success)' : 'var(--gradient-primary)'}; transition: width 0.3s ease;"></div>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }
        
        // 3. Atualizar estado de exibição ativa no telão
        const activeViewText = document.getElementById('dashboardActiveViewText');
        if (activeViewText) {
            const control = this.storage.getDisplayControl();
            if (control.view === 'category') {
                const activeCat = categories.find(c => c.id === control.currentCategoryId);
                activeViewText.textContent = `Quesito: ${activeCat ? activeCat.name : 'Nenhum selecionado'}`;
            } else if (control.view === 'ranking') {
                activeViewText.textContent = 'Classificação Geral';
            } else if (control.view === 'transition') {
                activeViewText.textContent = 'Tela de Espera (Espera)';
            }
        }
    }

    setupChromaKeyHandler() {
        const chromaInput = document.getElementById('chromaKeyInput');
        if (!chromaInput) return;
        
        // Carregar valor atual
        const control = this.storage.getDisplayControl();
        chromaInput.checked = !!control.chromaKey;
        
        chromaInput.addEventListener('change', (e) => {
            this.storage.updateDisplayControl({ chromaKey: e.target.checked });
            this.showAlert(
                e.target.checked ? '💚 Modo Chroma Key ativado no telão!' : '❌ Modo Chroma Key desativado no telão!',
                'info'
            );
        });
    }

    setupRevelationControls() {
        const toggleBtn = document.getElementById('toggleRevelationBtn');
        const prevBtn = document.getElementById('revealPrevBtn');
        const nextBtn = document.getElementById('revealNextBtn');
        const allBtn = document.getElementById('revealAllBtn');
        const wrapper = document.getElementById('revelationControlsWrapper');
        const actionButtons = document.getElementById('revelationActionButtons');
        const statusText = document.getElementById('revelationStatusText');
        const select = document.getElementById('scoreCategorySelect');
        
        if (!toggleBtn || !wrapper || !select) return;
        
        // Função para atualizar visibilidade dos botões
        const updateUI = () => {
            const control = this.storage.getDisplayControl();
            const categoryId = select.value;
            const schools = this.storage.getSchools();
            const judges = this.storage.getJudges().filter(j => 
                !j.categoryIds || j.categoryIds.length === 0 || j.categoryIds.includes(categoryId)
            );
            
            const totalNotes = schools.length * judges.length;
            
            if (!categoryId || schools.length === 0 || judges.length === 0) {
                wrapper.style.display = 'none';
                return;
            }
            
            wrapper.style.display = 'block';
            
            if (control.revelationActive) {
                toggleBtn.textContent = '⏹️ Parar Modo Revelação';
                toggleBtn.className = 'btn btn-danger';
                actionButtons.style.display = 'flex';
                statusText.textContent = `Revelado: ${control.revealedNotesCount || 0}/${totalNotes} notas`;
                statusText.className = 'badge badge-success';
            } else {
                toggleBtn.textContent = '🎬 Iniciar Modo Revelação';
                toggleBtn.className = 'btn btn-secondary';
                actionButtons.style.display = 'none';
                statusText.textContent = 'Modo Revelação: Desativado';
                statusText.className = 'badge badge-primary';
            }
        };
        
        // Escutar seletores e mudanças
        select.addEventListener('change', updateUI);
        this.storage.addListener(updateUI);
        
        toggleBtn.addEventListener('click', () => {
            const control = this.storage.getDisplayControl();
            const categoryId = select.value;
            
            if (control.revelationActive) {
                // Parar revelação
                this.storage.updateDisplayControl({
                    revelationActive: false,
                    revealedNotesCount: 0
                });
            } else {
                // Iniciar revelação
                this.storage.updateDisplayControl({
                    revelationActive: true,
                    revealedNotesCount: 0,
                    view: 'category',
                    currentCategoryId: categoryId
                });
                // Garante que o telão vá para a tela de quesito se estiver em ranking
                window.changeView('category');
            }
        });
        
        nextBtn.addEventListener('click', () => {
            const control = this.storage.getDisplayControl();
            const categoryId = select.value;
            const schools = this.storage.getSchools();
            const judges = this.storage.getJudges().filter(j => 
                !j.categoryIds || j.categoryIds.length === 0 || j.categoryIds.includes(categoryId)
            );
            const totalNotes = schools.length * judges.length;
            
            if ((control.revealedNotesCount || 0) < totalNotes) {
                this.storage.updateDisplayControl({
                    revealedNotesCount: (control.revealedNotesCount || 0) + 1
                });
            }
        });
        
        prevBtn.addEventListener('click', () => {
            const control = this.storage.getDisplayControl();
            if ((control.revealedNotesCount || 0) > 0) {
                this.storage.updateDisplayControl({
                    revealedNotesCount: (control.revealedNotesCount || 0) - 1
                });
            }
        });
        
        allBtn.addEventListener('click', () => {
            const categoryId = select.value;
            const schools = this.storage.getSchools();
            const judges = this.storage.getJudges().filter(j => 
                !j.categoryIds || j.categoryIds.length === 0 || j.categoryIds.includes(categoryId)
            );
            const totalNotes = schools.length * judges.length;
            
            this.storage.updateDisplayControl({
                revealedNotesCount: totalNotes
            });
        });
        
        updateUI();
    }

    checkLocalStorageUsage() {
        let totalBytes = 0;
        for (const key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                totalBytes += (localStorage[key].length + key.length) * 2; // Estimativa UTF-16
            }
        }
        
        const limitBytes = 5 * 1024 * 1024; // 5MB limit comum
        const pct = (totalBytes / limitBytes) * 100;
        
        console.log(`💾 Uso do localStorage: ${(totalBytes / 1024).toFixed(2)} KB (${pct.toFixed(1)}%)`);
        
        if (pct >= 90) {
            this.showAlert(
                `⚠️ Armazenamento local em ${pct.toFixed(0)}% do limite! Exporte o JSON ou ative o servidor local.`,
                'warning'
            );
        }
    }

    setupPinAuthentication() {
        const settings = this.storage.getSettings();
        const overlay = document.getElementById('pinAuthOverlay');
        const pinInput = document.getElementById('pinInput');
        const submitBtn = document.getElementById('submitPinBtn');
        const errMsg = document.getElementById('pinErrorMessage');
        
        if (!overlay || !pinInput || !submitBtn) return;
        
        // Se não tiver PIN configurado nas settings, garante ocultação e sai
        if (!settings.adminPin) {
            overlay.style.display = 'none';
            return;
        }
        
        // Ativar overlay de bloqueio
        overlay.style.display = 'flex';
        pinInput.focus();
        
        const tryAuthenticate = () => {
            const enteredPin = pinInput.value.trim();
            if (enteredPin === String(settings.adminPin)) {
                overlay.classList.add('fade-out');
                overlay.querySelector('.custom-modal').classList.add('scale-out');
                setTimeout(() => {
                    overlay.style.display = 'none';
                    overlay.classList.remove('fade-out');
                    overlay.querySelector('.custom-modal').classList.remove('scale-out');
                }, 300);
                this.showAlert('🔓 Acesso autorizado!', 'success');
            } else {
                if (errMsg) errMsg.style.display = 'block';
                pinInput.value = '';
                pinInput.focus();
                
                setTimeout(() => {
                    if (errMsg) errMsg.style.display = 'none';
                }, 3000);
            }
        };
        
        submitBtn.addEventListener('click', tryAuthenticate);
        pinInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') tryAuthenticate();
        });
    }

    setupPinSettings() {
        const input = document.getElementById('adminPinInput');
        const saveBtn = document.getElementById('savePinBtn');
        if (!input || !saveBtn) return;
        
        // Carregar valor atual
        const settings = this.storage.getSettings();
        input.value = settings.adminPin || '';
        
        saveBtn.addEventListener('click', () => {
            const value = input.value.trim();
            if (value !== '' && (!/^\d{4}$/.test(value))) {
                this.showAlert('❌ O PIN deve conter exatamente 4 números!', 'error');
                return;
            }
            
            this.storage.updateSettings({ adminPin: value || null });
            this.showAlert(
                value ? '🔒 PIN de segurança administrativa configurado!' : '🔓 Proteção por PIN removida!',
                'success'
            );
        });
    }

    startAutoBackup() {
        // Executar primeiro backup automático silencioso logo após carregar (delay 30s)
        setTimeout(() => {
            try { this.generateAutoBackup(true); } catch (e) {}
        }, 30000);

        // Backup recorrente a cada 3 minutos (180000ms)
        setInterval(() => {
            try {
                this.generateAutoBackup(false);
            } catch (err) {
                console.error('[Backup] Erro no backup recorrente:', err);
            }
        }, 180000);
    }
    
    generateAutoBackup(silent = false) {
        const currentData = this.storage.getData();
        if (!currentData) return;
        
        const backupData = {
            timestamp: Date.now(),
            data: currentData
        };
        
        const b1 = localStorage.getItem('samba-backup-1');
        const b2 = localStorage.getItem('samba-backup-2');
        
        if (b2) localStorage.setItem('samba-backup-3', b2);
        if (b1) localStorage.setItem('samba-backup-2', b1);
        
        localStorage.setItem('samba-backup-1', JSON.stringify(backupData));
        
        console.log('💾 Backup automático local gerado com sucesso.');
        if (!silent) {
            this.showAlert('💾 Backup automático salvo com sucesso.', 'info');
        }
        
        if (this.currentTab === 'settings') {
            this.renderBackupsHistory();
        }
    }

    renderBackupsHistory() {
        const container = document.getElementById('backupsHistoryList');
        if (!container) return;
        
        const b1 = localStorage.getItem('samba-backup-1');
        const b2 = localStorage.getItem('samba-backup-2');
        const b3 = localStorage.getItem('samba-backup-3');
        
        const backups = [b1, b2, b3].map(b => b ? JSON.parse(b) : null).filter(Boolean);
        
        if (backups.length === 0) {
            container.innerHTML = '<p class="text-xs text-muted">Aguardando geração do primeiro backup automático...</p>';
            return;
        }
        
        window.restoreBackupIndex = (index) => {
            const backup = backups[index];
            if (!backup) return;
            
            this.showConfirm(
                '🔄 Restaurar Backup',
                `Deseja realmente restaurar os dados salvos em ${new Date(backup.timestamp).toLocaleString('pt-BR')}?\n\nOs dados atuais do painel serão substituídos.`
            ).then(confirmed => {
                if (confirmed) {
                    this.storage.saveData(backup.data);
                    this.showAlert('✅ Dados restaurados com sucesso!', 'success');
                    this.loadAllData();
                }
            });
        };
        
        container.innerHTML = backups.map((b, idx) => `
            <div class="flex items-center justify-between p-sm bg-dark rounded-md" style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.02); padding: 0.5rem 0.75rem; border-radius: var(--radius-md); border: 1px solid rgba(255,255,255,0.05);">
                <div>
                    <div class="font-medium text-sm">Backup #${idx + 1}</div>
                    <div class="text-xs text-muted">${new Date(b.timestamp).toLocaleString('pt-BR')}</div>
                </div>
                <button class="btn btn-secondary btn-sm" onclick="restoreBackupIndex(${idx})" style="padding: 0.25rem 0.5rem; font-size: var(--font-size-xs);">Restaurar</button>
            </div>
        `).join('');
    }
} // Fim da classe AdminPanel

// Inicializar quando o DOM estiver pronto
let adminPanel;
document.addEventListener('DOMContentLoaded', () => {
    adminPanel = new AdminPanel();
    window.adminPanel = adminPanel;
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdminPanel;
}
