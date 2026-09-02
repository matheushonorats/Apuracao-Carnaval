class SchoolManager {
    constructor(admin) {
        this.admin = admin;
    }

    renderSchools() {
        console.log('🔄 RenderSchools: Iniciando renderização...');
        const schools = this.admin.storage.getSchools();
        console.log(`📊 Escolas encontradas: ${schools.length}`);

        const container = document.getElementById('schoolsList');
        if (!container) {
            console.error('❌ RenderSchools: Container #schoolsList não encontrado!');
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
                    <div class="item-name">${this.admin.escapeHtml(school.name)}</div>
                    <div class="item-meta">Cadastrada em ${this.admin.formatDate(school.createdAt)}</div>
                </div>
                <div class="item-actions">
                    <button class="btn btn-secondary btn-icon"
                            onclick="adminPanel.schoolManager.editSchool('${school.id}')"
                            title="Editar">
                        ✏️
                    </button>
                    <button class="btn btn-danger btn-icon"
                            onclick="adminPanel.schoolManager.deleteSchool('${school.id}')"
                            title="Excluir">
                        🗑️
                    </button>
                </div>
            </div >
            `).join('');
    }

    editSchool(id) {
        const school = this.admin.storage.getSchools().find(s => s.id === id);
        if (!school) {
            console.error('editSchool: escola não encontrada:', id);
            return;
        }

        console.log('editSchool:', id, school.name);

        const form = document.getElementById('schoolForm');
        form.schoolName.value = school.name;
        form.schoolPenalty.value = school.penalty || '';

        this.admin.editingSchoolId = id;
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.textContent = '💾 Atualizar Agremiação';
        submitBtn.classList.add('btn-success');

        this.admin.showAlert(`✏️ Editando: ${school.name}. Altere os dados e clique em Atualizar.`, 'info');

        // Scroll to form
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

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
                this.admin.showAlert('❌ O nome da agremiação deve ter pelo menos 3 caracteres', 'error');
                form.schoolName.focus();
                return;
            }

            // Verificar duplicatas
            const schools = this.admin.storage.getSchools();
            const isDuplicate = schools.some(s =>
                s.name.toLowerCase() === name.toLowerCase() &&
                s.id !== this.admin.editingSchoolId
            );

            if (isDuplicate) {
                this.admin.showAlert('❌ Já existe uma agremiação com este nome', 'error');
                form.schoolName.focus();
                return;
            }

            // Validar logo se fornecido
            let logoDataURL = null;
            if (logoFile) {
                const validation = await this.admin.validateImage(logoFile);
                if (!validation.valid) {
                    this.admin.showAlert(`❌ ${validation.error}`, 'error');
                    return;
                }
                logoDataURL = await this.admin.fileToDataURL(logoFile);
            }

            // Loading state
            this.admin.setButtonLoading(submitBtn, true);

            // Salvar
            if (this.admin.editingSchoolId) {
                const updates = { name, penalty: penalty ? parseFloat(penalty) : 0 };
                if (logoDataURL) updates.logoDataURL = logoDataURL;
                this.admin.storage.updateSchool(this.admin.editingSchoolId, updates);
                this.admin.showAlert('✅ Agremiação atualizada com sucesso!', 'success');
                this.admin.editingSchoolId = null;
            } else {
                const newSchool = this.admin.storage.addSchool(name, logoDataURL);
                if (penalty) {
                    this.admin.storage.updateSchoolPenalty(newSchool.id, penalty);
                }
                this.admin.showAlert('✅ Agremiação adicionada com sucesso!', 'success');
            }

            // Resetar formulário
            form.reset();
            submitBtn.textContent = 'Adicionar Agremiação';
            submitBtn.classList.remove('btn-success');
            this.admin.editingSchoolId = null;
            this.admin.updateFileLabel('schoolLogo', 'Escolher logo...');

        } catch (error) {
            console.error('Erro ao salvar escola:', error);
            this.admin.showAlert('❌ Erro ao salvar agremiação: ' + error.message, 'error');
        } finally {
            this.admin.setButtonLoading(submitBtn, false);
        }
    }

    async deleteSchool(id) {
        const school = this.admin.storage.getSchools().find(s => s.id === id);
        if (!school) return;

        const scores = this.admin.storage.getScoresBySchool(id);
        const hasScores = scores.length > 0;

        const confirmMsg = hasScores
            ? `Tem certeza que deseja excluir "${school.name}"?\n\nTodas as ${scores.length} nota(s) desta escola serão PERDIDAS permanentemente!`
            : `Confirma a exclusão de "${school.name}"?`;

        const confirmed = await this.admin.showConfirm('⚠️ Excluir Agremiação', confirmMsg);
        if (confirmed) {
            try {
                this.admin.storage.deleteSchool(id);
                this.admin.showAlert('✅ Agremiação excluída com sucesso', 'success');
            } catch (error) {
                console.error('Erro ao excluir escola:', error);
                this.admin.showAlert('❌ Erro ao excluir agremiação', 'error');
            }
        }
    }

}
