class JudgeManager {
    constructor(admin) {
        this.admin = admin;
    }

    renderJudges() {
        const judges = this.admin.storage.getJudges();
        const categories = this.admin.storage.getCategories();
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
                        <div class="item-name">${this.admin.escapeHtml(judge.name)}</div>
                        <div class="item-meta">${this.admin.escapeHtml(judgeCats)}</div>
                    </div>
                    <div class="item-actions">
                        <button class="btn btn-secondary btn-icon"
                                onclick="adminPanel.judgeManager.editJudge('${judge.id}')"
                                title="Editar">
                            ✏️
                        </button>
                        <button class="btn btn-danger btn-icon"
                                onclick="adminPanel.judgeManager.deleteJudge('${judge.id}')"
                                title="Excluir">
                            🗑️
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    editJudge(id) {
        const judge = this.admin.storage.getJudges().find(j => j.id === id);
        if (!judge) return;

        const form = document.getElementById('judgeForm');
        form.judgeName.value = judge.name;

        // Marcar checkboxes
        const checkboxes = form.querySelectorAll('input[name="judgeCategories"]');
        checkboxes.forEach(cb => {
            cb.checked = judge.categoryIds && judge.categoryIds.includes(cb.value);
        });

        this.admin.editingJudgeId = id;
        form.querySelector('button[type="submit"]').textContent = 'Atualizar Jurado';

        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

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
                this.admin.showAlert('❌ O nome do jurado deve ter pelo menos 2 caracteres', 'error');
                form.judgeName.focus();
                return;
            }

            // Verificar duplicatas
            const judges = this.admin.storage.getJudges();
            const isDuplicate = judges.some(j =>
                j.name.toLowerCase() === name.toLowerCase() &&
                j.id !== this.admin.editingJudgeId
            );

            if (isDuplicate) {
                this.admin.showAlert('❌ Já existe um jurado com este nome', 'error');
                return;
            }

            this.admin.setButtonLoading(submitBtn, true);

            if (this.admin.editingJudgeId) {
                this.admin.storage.updateJudge(this.admin.editingJudgeId, { name, categoryIds });
                this.admin.showAlert('✅ Jurado atualizado com sucesso!', 'success');
                this.admin.editingJudgeId = null;
            } else {
                this.admin.storage.addJudge(name, categoryIds);
                this.admin.showAlert('✅ Jurado adicionado com sucesso!', 'success');
            }

            form.reset();

        } catch (error) {
            console.error('Erro ao salvar jurado:', error);
            this.admin.showAlert('❌ Erro ao salvar jurado: ' + error.message, 'error');
        } finally {
            this.admin.setButtonLoading(submitBtn, false);
        }
    }

    async deleteJudge(id) {
        const judge = this.admin.storage.getJudges().find(j => j.id === id);
        if (!judge) return;

        const scores = this.admin.storage.getScores().filter(s => s.judgeId === id);
        const hasScores = scores.length > 0;

        const confirmMsg = hasScores
            ? `Tem certeza que deseja excluir "${judge.name}"?\n\nTodas as ${scores.length} nota(s) deste jurado serão PERDIDAS!`
            : `Confirma a exclusão de "${judge.name}"?`;

        const confirmed = await this.admin.showConfirm('⚠️ Excluir Jurado', confirmMsg);
        if (confirmed) {
            try {
                this.admin.storage.deleteJudge(id);
                this.admin.showAlert('✅ Jurado excluído com sucesso', 'success');
            } catch (error) {
                console.error('Erro ao excluir jurado:', error);
                this.admin.showAlert('❌ Erro ao excluir jurado', 'error');
            }
        }
    }

    renderJudgeCategoryCheckboxes() {
        const categories = this.admin.storage.getCategories();
        const container = document.getElementById('judgeCategoriesContainer');

        if (!container) return;

        if (categories.length === 0) {
            container.innerHTML = '<p class="text-muted text-sm">Cadastre quesitos primeiro</p>';
            return;
        }

        container.innerHTML = categories.map(cat => `
            <label class="flex items-center gap-sm cursor-pointer">
                <input type="checkbox" name="judgeCategories" value="${cat.id}">
                    <span>${this.admin.escapeHtml(cat.name)}</span>
                </label>
        `).join('');
    }

}
