/**
 * StorageManager - Gerenciamento de dados locais e sincronização
 * Usa localStorage + API Local (se disponível)
 */

class StorageManager {
    constructor() {
        this.STORAGE_KEY = 'samba-scoring-data';
        this.channel = new BroadcastChannel('samba-scoring');
        this.listeners = new Set();
        
        // Detecta se está rodando dentro do Google Apps Script (Web App ou Dialog/Sidebar)
        this.isGAS = typeof google !== 'undefined' && google.script && google.script.run;
        
        this.serverUrl = '/api/data';
        this.isServerAvailable = false;
        this.lastServerHash = '';
        this.isSaving = false;
        this.syncDebounceTimer = null;

        // Inicializar dados
        this.init();
    }

    async init() {
        if (this.isGAS) {
            console.log('📦 Ambiente Google Apps Script detectado!');
            this.isServerAvailable = true; // Simular servidor ativo para controle
            
            // 1. Carregar dados do Google Planilhas
            this.loadFromGAS();
            
            // 2. Iniciar polling leve de atualização
            this.startGASPolling();
        } else {
            // 1. Tentar conectar ao servidor local Node.js
            try {
                const response = await fetch(this.serverUrl);
                if (response.ok) {
                    this.isServerAvailable = true;
                    const serverData = await response.json();

                    // Se tem dados no servidor, usa eles como verdade absoluta
                    if (serverData && Object.keys(serverData).length > 0) {
                        console.log('📦 Dados carregados do Servidor Local');
                        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(serverData));
                    } else {
                        // Servidor vazio? Envia dados locais se existirem
                        console.log('📦 Servidor vazio. Enviando dados locais...');
                        const localData = this.getData();
                        if (localData) {
                            this.syncToServer(localData);
                        } else {
                            this.initializeData();
                        }
                    }

                    // Iniciar polling local
                    this.startPolling();
                } else {
                    this.initializeData();
                }
            } catch (e) {
                console.log('⚠️ Modo Offline (Servidor não detectado). Usando apenas LocalStorage.');
                this.initializeData();
            }
        }

        // Escutar mudanças de outras abas
        this.channel.onmessage = (event) => {
            if (event.data.type === 'update') {
                this.notifyListeners(event.data.dataType);
            }
        };
    }

    /**
     * Carrega os dados da planilha via Google Apps Script
     */
    loadFromGAS() {
        google.script.run
            .withSuccessHandler((serverData) => {
                if (serverData) {
                    console.log('📦 Dados carregados do Google Sheets com sucesso!');
                    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(serverData));
                    this.lastServerHash = JSON.stringify(serverData);
                    this.notifyChange('all');
                }
            })
            .withFailureHandler((err) => {
                console.error('Erro ao carregar dados do Google Sheets:', err);
            })
            .getData();
    }

    /**
     * Polling leve para verificar se houve mudanças na planilha
     */
    startGASPolling() {
        setInterval(() => {
            if (this.isSaving) return;

            google.script.run
                .withSuccessHandler((serverLastUpdated) => {
                    const localData = this.getData();
                    const localTime = localData ? (localData.lastUpdated || 0) : 0;

                    // Se a planilha foi alterada mais recentemente do que o nosso local
                    if (serverLastUpdated && serverLastUpdated > localTime) {
                        console.log(`🔄 Nova atualização detectada na Planilha! (${serverLastUpdated} > ${localTime})`);
                        this.loadFromGAS();
                    }
                })
                .withFailureHandler((err) => {
                    // Silencioso em caso de queda temporária de internet
                })
                .getLastUpdated();
        }, 2000); // Polling seguro a cada 2 segundos para respeitar cota do Google
    }

    startPolling() {
        setInterval(async () => {
            if (this.isSaving) return; // Evitar conflito se estiver salvando

            try {
                const response = await fetch(this.serverUrl);
                if (response.ok) {
                    const serverText = await response.text();

                    // Comparação simples para ver se mudou
                    if (serverText !== this.lastServerHash) {
                        // Dados mudaram!
                        this.lastServerHash = serverText;
                        try {
                            const serverData = JSON.parse(serverText);

                            // Verificar se é diferente do local atual
                            const localData = this.getData();

                            // Lógica de conflito baseada em Timestamp (Server Wins apenas se for mais recente)
                            const serverTime = serverData.lastUpdated || 0;
                            const localTime = localData ? (localData.lastUpdated || 0) : 0;

                            if (serverTime > localTime) {
                                console.log(`🔄 Atualização recebida do servidor! (S:${serverTime} > L:${localTime})`);
                                localStorage.setItem(this.STORAGE_KEY, serverText);
                                this.notifyChange('all');
                            } else {
                                // Se o servidor tem dados antigos ou iguais, ignoramos mas atualizamos o hash
                                // para não re-processar na próxima iteração
                                console.log('⏳ Ignorando dados antigos do servidor (Race condition evitada)');
                            }
                        } catch (e) {
                            console.error('Erro ao processar atualização do servidor:', e);
                        }
                    }
                }
            } catch (e) {
                // Silencioso em caso de erro de rede momentâneo
            }
        }, 300); // Poll a cada 300ms (Mais rápido)
    }

    syncToServer(data) {
        if (this.isGAS) {
            // Sincronização Google Apps Script (Debounce)
            if (this.syncDebounceTimer) clearTimeout(this.syncDebounceTimer);
            this.syncDebounceTimer = setTimeout(() => {
                this.performGASSync(data);
            }, 500);
        } else {
            if (!this.isServerAvailable) return;

            // Cancelar envio anterior (Debounce)
            if (this.syncDebounceTimer) clearTimeout(this.syncDebounceTimer);

            // Agendar novo envio para 500ms se parar de digitar (Mais conservador)
            this.syncDebounceTimer = setTimeout(() => {
                this.performSync(data);
            }, 500);
        }
    }

    async performGASSync(data) {
        if (this.isSaving) {
            this.syncDebounceTimer = setTimeout(() => this.performGASSync(data), 100);
            return;
        }

        this.isSaving = true;

        try {
            // 1. Enviar primeiro qualquer imagem local em Base64 para o Google Drive
            await this.uploadImagesToGASDrive(data);

            // 2. Enviar a estrutura de dados atualizada para o Google Planilhas
            google.script.run
                .withSuccessHandler(() => {
                    console.log('✅ Dados salvos com sucesso no Google Sheets!');
                    this.lastServerHash = JSON.stringify(data);
                    this.isSaving = false;
                })
                .withFailureHandler((err) => {
                    console.error('❌ Erro ao salvar no Google Sheets:', err);
                    this.isSaving = false;
                })
                .saveData(data);
        } catch (e) {
            console.error('Erro no fluxo de gravação do GAS:', e);
            this.isSaving = false;
        }
    }

    /**
     * Varre o banco de dados e faz upload de quaisquer imagens Base64 carregadas localmente para o Google Drive,
     * substituindo-as por URLs públicas estáveis de forma transparente.
     */
    async uploadImagesToGASDrive(data) {
        const uploadPromises = [];

        const checkAndUpload = (obj, key, prefix) => {
            if (obj[key] && typeof obj[key] === 'string' && obj[key].startsWith('data:image')) {
                const promise = new Promise((resolve) => {
                    const extMatches = obj[key].match(/^data:image\/([^;]+);base64,/);
                    let ext = 'jpg';
                    if (extMatches && extMatches[1]) {
                        ext = extMatches[1];
                        if (ext === 'jpeg') ext = 'jpg';
                        if (ext === 'svg+xml') ext = 'svg';
                    }

                    const fileName = `${prefix}_${Date.now()}.${ext}`;
                    const base64Data = obj[key];

                    google.script.run
                        .withSuccessHandler((publicUrl) => {
                            if (publicUrl) {
                                console.log(`🖼️ Imagem [${prefix}] salva no Google Drive:`, publicUrl);
                                obj[key] = publicUrl;
                            }
                            resolve();
                        })
                        .withFailureHandler((err) => {
                            console.error(`❌ Erro no upload da imagem [${prefix}] para o Drive:`, err);
                            resolve();
                        })
                        .saveImageToDrive(base64Data, fileName);
                });
                uploadPromises.push(promise);
            }
        };

        // 1. Escanear brasões das Escolas
        if (data && data.schools) {
            data.schools.forEach(school => {
                checkAndUpload(school, 'logoDataURL', `school_${school.id}`);
            });
        }

        // 2. Escanear logos e backgrounds nas configurações
        if (data && data.settings) {
            Object.keys(data.settings).forEach(key => {
                checkAndUpload(data.settings, key, `setting_${key}`);
            });
        }

        if (uploadPromises.length > 0) {
            console.log(`📤 Detectadas ${uploadPromises.length} imagem(ns) novas em Base64. Iniciando upload para o Google Drive...`);
            await Promise.all(uploadPromises);
            
            // Grava o estado atualizado com as URLs no LocalStorage para o cliente
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
        }
    }

    async performSync(data) {
        // Se já estiver salvando, agendar para depois (Retry)
        if (this.isSaving) {
            this.syncDebounceTimer = setTimeout(() => this.performSync(data), 100);
            return;
        }

        this.isSaving = true;
        try {
            const body = JSON.stringify(data);
            this.lastServerHash = body; // Atualizar hash local para evitar re-processar meu próprio save

            const response = await fetch(this.serverUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: body
            });

            if (response.ok) {
                // Verificar se o servidor retornou dados otimizados (URLs em vez de Base64)
                const responseText = await response.text();
                try {
                    const responseData = JSON.parse(responseText);

                    let localUpdated = false;
                    const currentLocal = this.getData();

                    // Se a resposta contiver 'schools' com URLs atualizadas
                    if (responseData && responseData.schools && Array.isArray(responseData.schools)) {
                        currentLocal.schools = responseData.schools;
                        localUpdated = true;
                    }

                    // Se a resposta contiver 'settings' com URLs atualizadas (Background/Logo)
                    if (responseData && responseData.settings) {
                        // Merge settings preservando local, mas atualizando URLs
                        currentLocal.settings = { ...currentLocal.settings, ...responseData.settings };
                        localUpdated = true;
                    }

                    if (localUpdated) {
                        console.log('🖼️ Recebendo imagens otimizadas do servidor...');
                        this.saveData(currentLocal, true); // true = skipSync
                    }
                } catch (e) {
                    // Ignorar se não for JSON
                }
            }
        } catch (e) {
            console.error('Erro ao sincronizar com servidor:', e);
        } finally {
            this.isSaving = false;
        }
    }

    /**
     * Notifica mudança local e remotamente
     */
    notifyChange(dataType) {
        this.notifyListeners(dataType);
        this.channel.postMessage({ type: 'update', dataType });
    }

    /**
     * Inicializa a estrutura de dados se não existir
     */
    initializeData() {
        const existing = localStorage.getItem(this.STORAGE_KEY);
        if (!existing) {
            const initialData = {
                schools: [],
                judges: [],
                categories: [],
                scores: [],
                settings: {
                    tiebreakers: [],
                    categoriesDisplayOrder: []
                },
                displayControl: {
                    view: 'category', // 'category' ou 'ranking'
                    currentCategoryId: null,
                    currentSchoolIndex: 0 // Para rotação automática
                }
            };
            this.saveData(initialData); // Usa saveData para já tentar sincronizar se possível
        }
    }

    /**
     * Obtém todos os dados
     */
    getData() {
        const data = localStorage.getItem(this.STORAGE_KEY);
        return data ? JSON.parse(data) : null;
    }

    /**
     * Salva todos os dados
     * @param {Object} data 
     * @param {boolean} skipSync Se true, não envia para o servidor
     */
    saveData(data, skipSync = false) {
        data.lastUpdated = Date.now(); // Adicionar timestamp para controle de concorrência
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
        if (!skipSync) {
            this.syncToServer(data);
        }
    }


    /**
     * Adiciona listener para mudanças
     */
    addListener(callback) {
        this.listeners.add(callback);
    }

    /**
     * Remove listener
     */
    removeListener(callback) {
        this.listeners.delete(callback);
    }

    /**
     * Notifica listeners locais
     */
    notifyListeners(dataType) {
        this.listeners.forEach(callback => callback(dataType));
    }

    /* ===== ESCOLAS ===== */

    getSchools() {
        return this.getData()?.schools || [];
    }

    addSchool(name, logoDataURL) {
        const data = this.getData();
        const newSchool = {
            id: Date.now().toString(),
            name,
            logoDataURL: logoDataURL || null,
            order: data.schools.length,
            createdAt: new Date().toISOString()
        };
        data.schools.push(newSchool);
        this.saveData(data);
        this.notifyChange('schools');
        return newSchool;
    }

    updateSchool(id, updates) {
        const data = this.getData();
        const index = data.schools.findIndex(s => s.id === id);
        if (index !== -1) {
            data.schools[index] = { ...data.schools[index], ...updates };
            this.saveData(data);
            this.notifyChange('schools');
            return data.schools[index];
        }
        return null;
    }

    deleteSchool(id) {
        const data = this.getData();
        data.schools = data.schools.filter(s => s.id !== id);
        // Também remove as notas dessa escola
        data.scores = data.scores.filter(s => s.schoolId !== id);
        this.saveData(data);
        this.notifyChange('schools');
        this.notifyChange('scores');
    }

    /* ===== JURADOS ===== */

    getJudges() {
        return this.getData()?.judges || [];
    }

    addJudge(name, categoryIds = []) {
        const data = this.getData();
        const newJudge = {
            id: Date.now().toString(),
            name,
            categoryIds, // Vazio = julga todos os quesitos
            createdAt: new Date().toISOString()
        };
        data.judges.push(newJudge);
        this.saveData(data);
        this.notifyChange('judges');
        return newJudge;
    }

    updateJudge(id, updates) {
        const data = this.getData();
        const index = data.judges.findIndex(j => j.id === id);
        if (index !== -1) {
            data.judges[index] = { ...data.judges[index], ...updates };
            this.saveData(data);
            this.notifyChange('judges');
            return data.judges[index];
        }
        return null;
    }

    deleteJudge(id) {
        const data = this.getData();
        data.judges = data.judges.filter(j => j.id !== id);
        // Remove notas desse jurado
        data.scores = data.scores.filter(s => s.judgeId !== id);
        this.saveData(data);
        this.notifyChange('judges');
        this.notifyChange('scores');
    }

    /* ===== QUESITOS/CATEGORIAS ===== */

    getCategories() {
        return this.getData()?.categories || [];
    }

    addCategory(name, order) {
        const data = this.getData();
        const newCategory = {
            id: Date.now().toString(),
            name,
            order: order || data.categories.length + 1,
            createdAt: new Date().toISOString()
        };
        data.categories.push(newCategory);
        this.saveData(data);
        this.notifyChange('categories');
        return newCategory;
    }

    updateCategory(id, updates) {
        const data = this.getData();
        const index = data.categories.findIndex(c => c.id === id);
        if (index !== -1) {
            data.categories[index] = { ...data.categories[index], ...updates };
            this.saveData(data);
            this.notifyChange('categories');
            return data.categories[index];
        }
        return null;
    }

    deleteCategory(id) {
        const data = this.getData();
        data.categories = data.categories.filter(c => c.id !== id);
        // Remove notas desse quesito
        data.scores = data.scores.filter(s => s.categoryId !== id);
        this.saveData(data);
        this.notifyChange('categories');
        this.notifyChange('scores');
    }

    /* ===== NOTAS ===== */

    getScores() {
        return this.getData()?.scores || [];
    }

    /**
     * Salva ou atualiza uma nota
     * @param {string} schoolId 
     * @param {string} categoryId 
     * @param {string} judgeId 
     * @param {number} score 
     */
    saveScore(schoolId, categoryId, judgeId, score) {
        const data = this.getData();
        const existingIndex = data.scores.findIndex(
            s => s.schoolId === schoolId &&
                s.categoryId === categoryId &&
                s.judgeId === judgeId
        );

        const scoreData = {
            schoolId,
            categoryId,
            judgeId,
            score: parseFloat(score),
            updatedAt: new Date().toISOString()
        };

        if (existingIndex !== -1) {
            data.scores[existingIndex] = scoreData;
        } else {
            data.scores.push(scoreData);
        }

        this.saveData(data);
        this.notifyChange('scores');
    }

    /**
     * Salva múltiplas notas de uma vez
     */
    saveScores(scoresArray) {
        const data = this.getData(); // Carregar dados atuais

        scoresArray.forEach(({ schoolId, categoryId, judgeId, score }) => {
            const existingIndex = data.scores.findIndex(
                s => s.schoolId === schoolId &&
                    s.categoryId === categoryId &&
                    s.judgeId === judgeId
            );

            const scoreData = {
                schoolId,
                categoryId,
                judgeId,
                score: parseFloat(score),
                updatedAt: new Date().toISOString()
            };

            if (existingIndex !== -1) {
                data.scores[existingIndex] = scoreData;
            } else {
                data.scores.push(scoreData);
            }
        });

        this.saveData(data);
        this.notifyChange('scores');
    }

    /**
     * Obtém notas de um quesito específico
     */
    getScoresByCategory(categoryId) {
        return this.getScores().filter(s => s.categoryId === categoryId);
    }

    /**
     * Obtém notas de uma escola específica
     */
    getScoresBySchool(schoolId) {
        return this.getScores().filter(s => s.schoolId === schoolId);
    }

    /* ===== CONFIGURAÇÕES ===== */

    getSettings() {
        return this.getData()?.settings || {};
    }

    updateSettings(updates) {
        const data = this.getData();
        data.settings = { ...data.settings, ...updates };
        this.saveData(data);
        this.notifyChange('settings');
    }

    /* ===== CONTROLE DE EXIBIÇÃO ===== */

    getDisplayControl() {
        return this.getData()?.displayControl || { view: 'category', currentCategoryId: null, currentSchoolIndex: 0 };
    }

    updateDisplayControl(updates) {
        const data = this.getData();
        data.displayControl = { ...data.displayControl, ...updates };
        this.saveData(data);
        this.notifyChange('displayControl'); // Importante para o polling detectar mudança de tela
    }

    /* ===== CÁLCULOS ===== */

    /**
     * Calcula o total de uma escola em um quesito
     */
    getSchoolCategoryTotal(schoolId, categoryId) {
        const scores = this.getScores().filter(
            s => s.schoolId === schoolId && s.categoryId === categoryId
        );
        return scores.reduce((sum, s) => sum + s.score, 0);
    }

    /**
     * Calcula o total geral de uma escola
     */
    getSchoolTotal(schoolId) {
        const scores = this.getScoresBySchool(schoolId);
        const sum = scores.reduce((sum, s) => sum + s.score, 0);

        // Subtrair penalidades
        const school = this.getSchools().find(s => s.id === schoolId);
        const penalty = school && school.penalty ? parseFloat(school.penalty) : 0;

        return sum - penalty;
    }

    /**
     * Atualiza a penalidade de uma escola
     */
    updateSchoolPenalty(schoolId, penalty) {
        return this.updateSchool(schoolId, { penalty: parseFloat(penalty) });
    }

    /**
     * Obtém ranking completo das escolas
     */
    getRanking() {
        const schools = this.getSchools();
        const settings = this.getSettings();

        const ranking = schools.map(school => ({
            ...school,
            total: this.getSchoolTotal(school.id),
            categoryTotals: this.getCategories().reduce((acc, cat) => {
                acc[cat.id] = this.getSchoolCategoryTotal(school.id, cat.id);
                return acc;
            }, {})
        }));

        // Ordenar por total
        ranking.sort((a, b) => {
            if (b.total !== a.total) {
                return b.total - a.total;
            }

            // Aplicar critérios de desempate
            if (settings.tiebreakers && settings.tiebreakers.length > 0) {
                // Ordenar critérios por prioridade antes de usar
                const sortedTiebreakers = [...settings.tiebreakers].sort((x, y) => x.priority - y.priority);

                for (const tiebreaker of sortedTiebreakers) {
                    const scoreA = a.categoryTotals[tiebreaker.categoryId] || 0;
                    const scoreB = b.categoryTotals[tiebreaker.categoryId] || 0;

                    if (scoreA !== scoreB) {
                        return scoreB - scoreA;
                    }
                }
            }

            return 0;
        });

        return ranking;
    }

    /* ===== EXPORT/IMPORT ===== */

    /**
     * Exporta todos os dados como JSON
     */
    exportData() {
        const data = this.getData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `apuracao-samba-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Importa dados de um arquivo JSON
     */
    importData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    this.saveData(data);
                    this.notifyChange('all');
                    resolve(data);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    }

    /**
     * Limpa todos os dados
     */
    clearAllData() {
        if (confirm('⚠️ ATENÇÃO: Isso vai apagar TODOS os dados (Escolas, Quesitos e Notas). Tem certeza?')) {
            localStorage.removeItem(this.STORAGE_KEY);
            this.initializeData();
            this.notifyChange('all');
            return true;
        }
        return false;
    }

    /**
     * Limpa apenas as notas (preserva cadastros)
     */
    clearScoresOnly() {
        if (confirm('⚠️ ATENÇÃO: Isso vai apagar TODAS as notas lançadas.\n\n- Escolas e Quesitos SERÃO MANTIDOS.\n- Apenas as notas votadas serão zeradas.\n\nTem certeza?')) {
            const data = this.getData();
            if (data) {
                data.scores = [];
                this.saveData(data);
                this.notifyChange('all');
                return true;
            }
        }
        return false;
    }

    /**
     * Remove notas órfãs (escolas ou jurados inexistentes)
     */
    optimizeData() {
        const data = this.getData();
        if (!data || !data.scores) return 0;

        const originalCount = data.scores.length;
        // Criar Sets para busca rápida O(1)
        const validSchoolIds = new Set((data.schools || []).map(s => s.id));
        const validJudgeIds = new Set((data.judges || []).map(j => j.id));
        const validCategoryIds = new Set((data.categories || []).map(c => c.id));

        // Filtrar apenas notas órfãs
        data.scores = data.scores.filter(score =>
            validSchoolIds.has(score.schoolId) &&
            validJudgeIds.has(score.judgeId) &&
            validCategoryIds.has(score.categoryId)
        );

        const removedCount = originalCount - data.scores.length;

        if (removedCount > 0) {
            this.saveData(data);
            this.notifyChange('all');
        }
        return removedCount;
    }
}
