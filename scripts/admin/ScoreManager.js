class ScoreManager {
    constructor(admin) {
        this.admin = admin;
    }

    loadScoresGrid(categoryId, focusIndex = null) {
        if (!categoryId) {
            document.getElementById('scoresGridContainer').innerHTML = `
            <p class="text-muted">Selecione um quesito acima para lançar as notas</p>
                `;
            return;
        }

        // ATUALIZAÇÃO SOLICITADA: Sincronizar display com o quesito sendo lançado
        this.admin.storage.updateDisplayControl({ currentCategoryId: categoryId });

        // Atualizar também o select da aba de controle (visual apenas)
        const displaySelect = document.getElementById('displayCategorySelect');
        if (displaySelect) displaySelect.value = categoryId;

        const schools = this.admin.storage.getSchools();
        const judges = this.admin.storage.getJudges();
        const category = this.admin.storage.getCategories().find(c => c.id === categoryId);

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
        const existingScores = this.admin.storage.getScoresByCategory(categoryId);

        // Montar tabela
        let html = `
            <div class="scores-grid">
                <table class="scores-table">
                    <thead>
                        <tr>
                            <th>Agremiação</th>
                            ${relevantJudges.map(j => `<th>${this.admin.escapeHtml(j.name)}</th>`).join('')}
                            <th>Parcial</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        `;

        schools.forEach(school => {
            html += `<tr>`;
            html += `<td>${this.admin.escapeHtml(school.name)}</td>`;

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
            const schoolTotal = this.admin.storage.getSchoolCategoryTotal(school.id, categoryId);

            // Calcular total GERAL (todas as notas)
            const schoolGrandTotal = this.admin.storage.getSchoolTotal(school.id);

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
                const allScores = this.admin.storage.getScoresBySchool(schoolId);
                const otherScoresSum = allScores
                    .filter(s => s.categoryId !== categoryId)
                    .reduce((sum, s) => sum + s.score, 0);

                const schoolObj = this.admin.storage.getSchools().find(s => s.id === schoolId);
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
            if (!silent) this.admin.showAlert('⚠️ Selecione um quesito primeiro', 'warning');
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
                this.admin.showAlert(
                    `❌ ${invalidCount} nota(s) inválida(s)! As notas devem estar entre 0 e 10`,
                    'error'
                );
            }
            return;
        }

        if (scoresToSave.length === 0) {
            // Se estiver limpando tudo e silent, ok.
            if (!silent) this.admin.showAlert('⚠️ Nenhuma nota foi informada', 'warning');
            return;
        }

        try {
            this.admin.storage.saveScores(scoresToSave);

            if (!silent) {
                this.admin.showAlert(`✅ ${scoresToSave.length} nota(s) salva(s) com sucesso!`, 'success');
                // Recarregar grid para mostrar totais atualizados e mover foco
                this.loadScoresGrid(categoryId, nextFocusIndex);
            } else {
                console.log('✅ Auto-save realizado.');
                // Em modo silencioso, NÃO recarregamos a grid para não destruir o foco do usuário
                // O usuário verá os totais atualizados na próxima interação que recarregar a grid (Enter ou Refresh manual)
            }

        } catch (error) {
            console.error('Erro ao salvar notas:', error);
            if (!silent) this.admin.showAlert('❌ Erro ao salvar notas', 'error');
        }
    }

}
