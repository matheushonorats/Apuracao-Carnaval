class CategoryManager {
    constructor(admin) {
        this.admin = admin;
    }

    renderCategories() {
        const categories = this.admin.storage.getCategories().sort((a, b) => a.order - b.order);

        // Atualizar checkboxes de jurados também
        this.admin.judgeManager.renderJudgeCategoryCheckboxes();
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
                    <div class="item-name">${this.admin.escapeHtml(cat.name)}</div>
                    <div class="item-meta">Ordem de exibição: ${cat.order}</div>
                </div>
                <div class="item-actions">
                    <button class="btn btn-secondary btn-icon"
                            onclick="adminPanel.categoryManager.editCategory('${cat.id}')"
                            title="Editar">
                        ✏️
                    </button>
                    <button class="btn btn-danger btn-icon"
                            onclick="adminPanel.categoryManager.deleteCategory('${cat.id}')"
                            title="Excluir">
                        🗑️
                    </button>
                </div>
            </div >
            `).join('');
    }

    editCategory(id) {
        const category = this.admin.storage.getCategories().find(c => c.id === id);
        if (!category) return;

        const form = document.getElementById('categoryForm');
        form.categoryName.value = category.name;
        form.categoryOrder.value = category.order;

        this.admin.editingCategoryId = id;
        form.querySelector('button[type="submit"]').textContent = 'Atualizar Quesito';

        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    async handleCategorySubmit(e) {
        e.preventDefault();
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');

        try {
            const name = form.categoryName.value.trim();
            const order = parseInt(form.categoryOrder.value) || 0;

            // Validações
            if (!name || name.length < 2) {
                this.admin.showAlert('❌ O nome do quesito deve ter pelo menos 2 caracteres', 'error');
                form.categoryName.focus();
                return;
            }

            if (order <= 0) {
                this.admin.showAlert('❌ A ordem deve ser um número maior que zero', 'error');
                form.categoryOrder.focus();
                return;
            }

            // Verificar duplicatas
            const categories = this.admin.storage.getCategories();
            const isDuplicate = categories.some(c =>
                c.name.toLowerCase() === name.toLowerCase() &&
                c.id !== this.admin.editingCategoryId
            );

            if (isDuplicate) {
                this.admin.showAlert('❌ Já existe um quesito com este nome', 'error');
                return;
            }

            this.admin.setButtonLoading(submitBtn, true);

            if (this.admin.editingCategoryId) {
                this.admin.storage.updateCategory(this.admin.editingCategoryId, { name, order });
                this.admin.showAlert('✅ Quesito atualizado com sucesso!', 'success');
                this.admin.editingCategoryId = null;
            } else {
                this.admin.storage.addCategory(name, order);
                this.admin.showAlert('✅ Quesito adicionado com sucesso!', 'success');
            }

            form.reset();

            // Atualizar componentes que dependem de categorias
            this.admin.judgeManager.renderJudgeCategoryCheckboxes();
            this.admin.populateCategorySelects();

        } catch (error) {
            console.error('Erro ao salvar quesito:', error);
            this.admin.showAlert('❌ Erro ao salvar quesito: ' + error.message, 'error');
        } finally {
            this.admin.setButtonLoading(submitBtn, false);
        }
    }

    async deleteCategory(id) {
        const category = this.admin.storage.getCategories().find(c => c.id === id);
        if (!category) return;

        const scores = this.admin.storage.getScoresByCategory(id);
        const hasScores = scores.length > 0;

        const confirmMsg = hasScores
            ? `Tem certeza que deseja excluir "${category.name}"?\n\nTodas as ${scores.length} nota(s) deste quesito serão PERDIDAS!`
            : `Confirma a exclusão de "${category.name}"?`;

        const confirmed = await this.admin.showConfirm('⚠️ Excluir Quesito', confirmMsg);
        if (confirmed) {
            try {
                this.admin.storage.deleteCategory(id);
                this.admin.showAlert('✅ Quesito excluído com sucesso', 'success');
            } catch (error) {
                console.error('Erro ao excluir quesito:', error);
                this.admin.showAlert('❌ Erro ao excluir quesito', 'error');
            }
        }
    }

}
