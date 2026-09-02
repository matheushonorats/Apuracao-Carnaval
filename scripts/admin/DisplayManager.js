class DisplayManager {
    constructor(admin) {
        this.admin = admin;
    }

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
            this.admin.storage.updateDisplayControl(updates);
        };

        // Listeners para os botões da aba Controle (Options grandes)
        document.querySelectorAll('.view-option').forEach(option => {
            option.addEventListener('click', () => {
                const view = option.dataset.view;
                if (view) window.changeView(view);
            });
        });

        // Restaurar estado ativo inicial a partir do storage estruturado
        const savedControl = this.admin.storage.getDisplayControl();
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
                this.admin.storage.updateDisplayControl({ currentCategoryId: e.target.value });
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

    loadDisplayControlState() {
        const control = this.admin.storage.getDisplayControl();

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
        const categories = this.admin.storage.getCategories().sort((a, b) => a.order - b.order);

        // Select de lançamento - preservar seleção atual
        const scoreSelect = document.getElementById('scoreCategorySelect');
        if (scoreSelect) {
            const savedValue = scoreSelect.value;
            scoreSelect.innerHTML = '<option value="">Selecione um quesito...</option>' +
                categories.map(c => `<option value="${c.id}">${this.admin.escapeHtml(c.name)}</option>`).join('');
            if (savedValue) scoreSelect.value = savedValue;
        }

        // Select de controle de exibição - preservar seleção atual
        const displaySelect = document.getElementById('displayCategorySelect');
        if (displaySelect) {
            const savedValue = displaySelect.value;
            displaySelect.innerHTML = '<option value="">Selecione um quesito...</option>' +
                categories.map(c => `<option value="${c.id}">${this.admin.escapeHtml(c.name)}</option>`).join('');
            if (savedValue) displaySelect.value = savedValue;
        }
    }

}
