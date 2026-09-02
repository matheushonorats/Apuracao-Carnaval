class DashboardManager {
    constructor(admin) {
        this.admin = admin;
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
        const schools = this.admin.storage.getSchools();
        const judges = this.admin.storage.getJudges();
        const categories = this.admin.storage.getCategories().sort((a, b) => a.order - b.order);
        const scores = this.admin.storage.getScores();

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
                                <span class="font-medium">${this.admin.escapeHtml(cat.name)}</span>
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
            const control = this.admin.storage.getDisplayControl();
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
        const control = this.admin.storage.getDisplayControl();
        chromaInput.checked = !!control.chromaKey;

        chromaInput.addEventListener('change', (e) => {
            this.admin.storage.updateDisplayControl({ chromaKey: e.target.checked });
            this.admin.showAlert(
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
            const control = this.admin.storage.getDisplayControl();
            const categoryId = select.value;
            const schools = this.admin.storage.getSchools();
            const judges = this.admin.storage.getJudges().filter(j =>
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
        this.admin.storage.addListener(updateUI);

        toggleBtn.addEventListener('click', () => {
            const control = this.admin.storage.getDisplayControl();
            const categoryId = select.value;

            if (control.revelationActive) {
                // Parar revelação
                this.admin.storage.updateDisplayControl({
                    revelationActive: false,
                    revealedNotesCount: 0
                });
            } else {
                // Iniciar revelação
                this.admin.storage.updateDisplayControl({
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
            const control = this.admin.storage.getDisplayControl();
            const categoryId = select.value;
            const schools = this.admin.storage.getSchools();
            const judges = this.admin.storage.getJudges().filter(j =>
                !j.categoryIds || j.categoryIds.length === 0 || j.categoryIds.includes(categoryId)
            );
            const totalNotes = schools.length * judges.length;

            if ((control.revealedNotesCount || 0) < totalNotes) {
                this.admin.storage.updateDisplayControl({
                    revealedNotesCount: (control.revealedNotesCount || 0) + 1
                });
            }
        });

        prevBtn.addEventListener('click', () => {
            const control = this.admin.storage.getDisplayControl();
            if ((control.revealedNotesCount || 0) > 0) {
                this.admin.storage.updateDisplayControl({
                    revealedNotesCount: (control.revealedNotesCount || 0) - 1
                });
            }
        });

        allBtn.addEventListener('click', () => {
            const categoryId = select.value;
            const schools = this.admin.storage.getSchools();
            const judges = this.admin.storage.getJudges().filter(j =>
                !j.categoryIds || j.categoryIds.length === 0 || j.categoryIds.includes(categoryId)
            );
            const totalNotes = schools.length * judges.length;

            this.admin.storage.updateDisplayControl({
                revealedNotesCount: totalNotes
            });
        });

        updateUI();
    }

}
