class SettingsManager {
    constructor(admin) {
        this.admin = admin;
    }

    setupDataManagement() {
        // Export
        const exportBtn = document.getElementById('exportDataBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                try {
                    this.admin.storage.exportData();
                    this.admin.showAlert('✅ Dados exportados com sucesso!', 'success');
                } catch (error) {
                    console.error('Erro ao exportar:', error);
                    this.admin.showAlert('❌ Erro ao exportar dados', 'error');
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
                    await this.admin.storage.importData(file);
                    this.admin.showAlert('✅ Dados importados com sucesso!', 'success');
                    this.admin.loadAllData();
                } catch (error) {
                    console.error('Erro ao importar:', error);
                    this.admin.showAlert('❌ Erro ao importar dados: ' + error.message, 'error');
                }

                e.target.value = ''; // Reset input
            });
        }

        // Clear
        const clearBtn = document.getElementById('clearDataBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', async () => {
                const confirmed = await this.admin.showConfirm(
                    '🗑️ Zerar Notas',
                    'Tem certeza que deseja apagar TODAS as notas lançadas?\n\n- Escolas, Jurados e Quesitos cadastrados serão MANTIDOS.\n- Apenas as notas registradas serão limpas.\n- Essa ação não pode ser desfeita.'
                );
                if (confirmed) {
                    this.admin.storage.clearScoresOnly();
                    this.admin.showAlert('✅ Notas zeradas com sucesso (Cadastros mantidos)', 'success');
                }
            });
        }

        // Otimizar Banco
        const optimizeBtn = document.getElementById('optimizeDataBtn');
        if (optimizeBtn) {
            optimizeBtn.addEventListener('click', () => {
                const removed = this.admin.storage.optimizeData();
                if (removed > 0) {
                    this.admin.showAlert(`✅ Otimização completa! ${removed} registros órfãos removidos.`, 'success');
                    this.admin.loadAllData();
                } else {
                    this.admin.showAlert('✅ Banco de dados já está limpo e otimizado.', 'info');
                }
            });
        }



        // Reports
        const reportBtn = document.getElementById('generateReportBtn');
        if (reportBtn) {
            reportBtn.addEventListener('click', () => {
                console.log('📄 Gerando relatório...');
                this.admin.generateTransparencyReport();
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
        const categories = this.admin.storage.getCategories();
        const settings = this.admin.storage.getSettings();
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
                            ${this.admin.escapeHtml(cat.name)}
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

        this.admin.storage.updateSettings({ tiebreakers });
        this.admin.showAlert('✅ Critérios de desempate salvos!', 'success');
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
            this.admin.showAlert(
                `⚠️ Armazenamento local em ${pct.toFixed(0)}% do limite! Exporte o JSON ou ative o servidor local.`,
                'warning'
            );
        }
    }

    setupPinAuthentication() {
        const settings = this.admin.storage.getSettings();
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
                this.admin.showAlert('🔓 Acesso autorizado!', 'success');
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
        const settings = this.admin.storage.getSettings();
        input.value = settings.adminPin || '';

        saveBtn.addEventListener('click', () => {
            const value = input.value.trim();
            if (value !== '' && (!/^\d{4}$/.test(value))) {
                this.admin.showAlert('❌ O PIN deve conter exatamente 4 números!', 'error');
                return;
            }

            this.admin.storage.updateSettings({ adminPin: value || null });
            this.admin.showAlert(
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
        const currentData = this.admin.storage.getData();
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
            this.admin.showAlert('💾 Backup automático salvo com sucesso.', 'info');
        }

        if (this.admin.currentTab === 'settings') {
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

        window.adminPanel.settingsManager.restoreBackupIndex = (index) => {
            const backup = backups[index];
            if (!backup) return;

            this.admin.showConfirm(
                '🔄 Restaurar Backup',
                `Deseja realmente restaurar os dados salvos em ${new Date(backup.timestamp).toLocaleString('pt-BR')}?\n\nOs dados atuais do painel serão substituídos.`
            ).then(confirmed => {
                if (confirmed) {
                    this.admin.storage.saveData(backup.data);
                    this.admin.showAlert('✅ Dados restaurados com sucesso!', 'success');
                    this.admin.loadAllData();
                }
            });
        };

        container.innerHTML = backups.map((b, idx) => `
            <div class="flex items-center justify-between p-sm bg-dark rounded-md" style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.02); padding: 0.5rem 0.75rem; border-radius: var(--radius-md); border: 1px solid rgba(255,255,255,0.05);">
                <div>
                    <div class="font-medium text-sm">Backup #${idx + 1}</div>
                    <div class="text-xs text-muted">${new Date(b.timestamp).toLocaleString('pt-BR')}</div>
                </div>
                <button class="btn btn-secondary btn-sm" onclick="adminPanel.settingsManager.restoreBackupIndex(${idx})" style="padding: 0.25rem 0.5rem; font-size: var(--font-size-xs);">Restaurar</button>
            </div>
        `).join('');
    }

}
