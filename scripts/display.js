/**
 * DisplayController - Controlador da visualização pública
 * Exibe tabela de apuração ou ranking
 */

class DisplayController {
    constructor() {
        this.storage = new StorageManager();
        this.lastView = null;
        this.lastCategoryId = null;
        this.lastScoresHash = null; // Para detectar mudanças de notas (geral)
        this.previousScores = new Map(); // Para rastrear valores individuais e animar
        this.completedRows = new Set(); // Rastrear linhas (escolas) que já completaram todas as notas
        this.isFirstRender = true; // Evitar flash no carregamento inicial

        // Escutar mudanças do admin
        this.storage.addListener((dataType) => this.handleUpdate(dataType));

        // Carregar e renderizar
        this.init();
    }

    init() {
        this.render();
        const settings = this.storage.getSettings();
        this.applySettings(settings);
    }

    startUpdateLoop() {
        if (this.updateInterval) clearInterval(this.updateInterval);
        this.updateInterval = setInterval(() => this.render(), 200); // Real-time poll (was 1000ms)
    }

    handleUpdate(dataType) {
        // Se as configurações mudaram, aplicar imediatamente
        if (dataType === 'settings') {
            const settings = this.storage.getSettings();
            this.applySettings(settings);
            this.updateHeaderLogos();
            this.updateTransitionLogos();
            this.updateBackground();
        }

        // THROTTLE RENDER: Evitar renderizar mais que 1 vez a cada 500ms
        if (this.renderTimer) return; // Já tem uma renderização agendada

        this.renderTimer = setTimeout(() => {
            this.render();
            this.renderTimer = null;
        }, 100); // Faster render response (was 500ms)
    }

    render(animateView = false) {
        // Reiniciar intervalo para evitar corte de animação (race condition)
        this.startUpdateLoop();

        const control = this.storage.getDisplayControl();
        const newView = control.view || 'category';
        const newCategoryId = control.currentCategoryId;

        // Se a view mudou, forçar animação
        if (this.currentView !== newView) {
            animateView = true;
            this.currentView = newView;
        }

        // Detectar mudança de vista ou categoria
        const viewChanged = this.lastView !== newView;
        const categoryChanged = this.lastCategoryId !== newCategoryId;

        // --- PREVENT FLICKER / REDUNDANT RENDER ---
        // Se a view ou categoria mudou, renderizar
        // Se não mudou, verificar se os DADOS mudaram (hash)

        // Criar hash abrangente do estado atual (Escolas + Notas + Configs)
        const currentDataState = JSON.stringify({
            schools: this.storage.getSchools(),
            scores: this.storage.getScores(),
            // settings: this.storage.getSettings() // Settings handled by event listener separately
        });

        const dataChanged = this.lastDataHash !== currentDataState;

        // Se nada visual mudou, abortar (Isso para o flicker de imagens)
        if (!viewChanged && !categoryChanged && !dataChanged && !animateView && !this.isFirstRender) {
            return;
        }

        this.lastDataHash = currentDataState;
        this.lastView = newView;
        this.lastCategoryId = newCategoryId;
        this.isFirstRender = false;

        // Elementos DOM
        const transitionView = document.getElementById('transitionView');
        const viewTitle = document.getElementById('viewTitle');
        const categoryView = document.getElementById('categoryView');
        const rankingView = document.getElementById('rankingView');
        const displayHeader = document.querySelector('.display-header');

        // Lógica de Renderização e Visibilidade
        if (newView === 'transition') {
            // VIEW TRANSIÇÃO
            if (displayHeader) displayHeader.style.opacity = '0';
            if (viewTitle) viewTitle.style.opacity = '0';

            if (transitionView) {
                transitionView.classList.remove('hidden');
                // Pequeno delay para permitir transição de opacidade se desejar, ou direto
                setTimeout(() => transitionView.classList.add('active'), 10);
                this.updateTransitionLogos();
            }

            if (categoryView) categoryView.classList.add('hidden');
            if (rankingView) rankingView.classList.add('hidden');

        } else {
            // OUTRAS VIEWS (Ranking / Quesito)
            if (displayHeader) displayHeader.style.opacity = '1';
            if (viewTitle) viewTitle.style.opacity = '1';

            if (transitionView) {
                transitionView.classList.remove('active');
                // Aguarda transição de opacidade antes de esconder display (opcional, aqui direto para limpar)
                transitionView.classList.add('hidden');
            }

            if (newView === 'category') {
                if (rankingView) rankingView.classList.add('hidden');
                this.renderCategoryTable(viewChanged || categoryChanged);
            } else if (newView === 'ranking') {
                if (categoryView) categoryView.classList.add('hidden');
                // Ranking view não depende da categoria selecionada, então não re-anima se apenas a categoria mudar
                this.renderRankingView(viewChanged);
            }

            // Atualizar logos do cabeçalho sempre que não estiver em transição
            this.updateHeaderLogos();
            this.updateBackground();
        }
    }

    updateHeaderLogos() {
        // Obter configurações atualizadas (incluindo logos sincronizados e textos)
        const settings = this.storage.getSettings();

        // TEXTOS
        const headerTitleEl = document.querySelector('.event-title');
        if (headerTitleEl) {
            headerTitleEl.textContent = settings.headerTitle || 'Apuração do Desfile das Escolas de Samba do Carnaval';
        }

        const transitionTitleEl = document.querySelector('.transition-title');
        if (transitionTitleEl) {
            transitionTitleEl.textContent = settings.transitionTitle || 'APURAÇÃO DO DESFILE DAS ESCOLAS DE SAMBA DO CARNAVAL 2026';
        }

        // LOGOS
        const setLogo = (id, key) => {
            const img = document.getElementById(id);
            const src = settings[key]; // Ler das configurações sincronizadas
            if (img) {
                if (src) {
                    img.src = src;
                    img.style.display = 'block';
                } else {
                    img.style.display = 'none';
                }
            }
        };

        setLogo('headerLogoCenter', 'governmentLogo');
    }

    updateBackground() {
        const settings = this.storage.getSettings();

        if (settings.backgroundImage) {
            document.body.style.backgroundImage = `url('${settings.backgroundImage}')`;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundPosition = 'center';
            document.body.style.backgroundAttachment = 'fixed';
            document.body.style.backgroundRepeat = 'no-repeat';
        } else {
            document.body.style.backgroundImage = '';
            // Se necessário, reforce o gradiente, embora o CSS deva assumir
        }
    }

    updateTransitionLogos() {
        const settings = this.storage.getSettings();

        const setLogo = (id, key) => {
            const img = document.getElementById(id);
            const src = settings[key];
            if (img) {
                if (src) {
                    img.src = src;
                    img.style.display = 'block';
                } else {
                    img.style.display = 'none';
                }
            }
        };

        setLogo('transLogoCenter', 'governmentLogo');
    }

    renderCategoryTable(animateView = false) {
        const categoryView = document.getElementById('categoryView');
        const rankingView = document.getElementById('rankingView');

        // Transição de telas
        if (categoryView.classList.contains('hidden')) {
            categoryView.classList.remove('hidden');
            // Forçar reflow para reiniciar animações CSS se necessário
            void categoryView.offsetWidth;
        }
        rankingView.classList.add('hidden');

        const control = this.storage.getDisplayControl();
        const category = this.storage.getCategories().find(c => c.id === control.currentCategoryId);

        if (!category) {
            document.getElementById('viewTitle').textContent = 'Selecione um quesito';
            document.getElementById('schoolCard').innerHTML = `
                <div class="empty-state">
                    <h2>Aguardando seleção de quesito...</h2>
                </div>
            `;
            return;
        }

        // Atualizar título
        document.getElementById('viewTitle').textContent = category.name;

        // Obter dados
        const schools = this.storage.getSchools();
        const judges = this.storage.getJudges().filter(j =>
            !j.categoryIds || j.categoryIds.length === 0 || j.categoryIds.includes(category.id)
        );

        if (schools.length === 0) {
            document.getElementById('schoolCard').innerHTML = `
                <div class="empty-state">
                    <h2>Nenhuma agremiação cadastrada</h2>
                </div>
            `;
            return;
        }

        // Identificar o líder (maior Total Geral)
        // Usar lógica similar ao ranking final
        const schoolsWithTotal = schools.map(s => ({
            ...s,
            grandTotal: this.storage.getSchoolTotal(s.id)
        }));

        schoolsWithTotal.sort((a, b) => b.grandTotal - a.grandTotal);
        const leaderId = schoolsWithTotal.length > 0 ? schoolsWithTotal[0].id : null;


        // Construir HTML da tabela
        const containerClass = animateView ? 'scores-table-container fade-in' : 'scores-table-container';

        const html = `
            <div class="${containerClass}">
                <table class="scores-table">
                    <thead>
                        <tr>
                            <th class="school-col">Agremiação</th>
                            ${judges.map(j => `<th class="judge-col">${this.escapeHtml(j.name)}</th>`).join('')}
                            <th class="total-col">Parcial</th>
                            <th class="total-col">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${schools.map(school => {
            const scores = this.storage.getScoresByCategory(category.id).filter(s => s.schoolId === school.id);
            const total = this.storage.getSchoolCategoryTotal(school.id, category.id);
            const grandTotal = this.storage.getSchoolTotal(school.id);

            // Animação de Totais
            const totalKey = `total_${school.id}_${category.id}`;
            const grandTotalKey = `grand_${school.id}`;

            const prevTotal = this.previousScores.get(totalKey);
            const prevGrandTotal = this.previousScores.get(grandTotalKey);

            // Se mudou, vamos animar
            let totalClass = '';
            let grandTotalClass = '';

            // Verifica se mudou (e não é a primeira vez)
            if (prevTotal !== undefined && prevTotal !== total) {
                totalClass = 'animate-glitch';
            }
            this.previousScores.set(totalKey, total);

            if (prevGrandTotal !== undefined && prevGrandTotal !== grandTotal) {
                grandTotalClass = 'animate-glitch';
            }

            this.previousScores.set(grandTotalKey, grandTotal);

            // Renderizar linha da escola
            return `
                                <tr>
                                    <td class="school-cell">
                                        <img src="${school.logoDataURL || 'assets/default-logo.svg'}" 
                                             alt="${school.name}" 
                                             class="table-logo"
                                             onerror="this.src='assets/default-logo.svg'">
                                        <span>${this.escapeHtml(school.name)}</span>
                                    </td>
                                    ${judges.map(judge => {
                const score = scores.find(s => s.judgeId === judge.id);

                // Lógica de Animação de Nota
                const scoreKey = `${school.id}_${judge.id}_${category.id}`;
                const currentVal = score ? score.score : null;
                const prevVal = this.previousScores.get(scoreKey);

                let animClass = '';
                if (currentVal !== prevVal) {
                    if (currentVal !== null && prevVal !== undefined) {
                        animClass = 'number-update';
                    }
                    this.previousScores.set(scoreKey, currentVal);
                }
                if (prevVal === undefined && currentVal !== null) {
                    this.previousScores.set(scoreKey, currentVal);
                }

                return `<td class="score-cell ${animClass}">${score ? score.score.toFixed(2) : '-'}</td>`;
            }).join('')}
                                    <td class="total-cell ${totalClass}" 
                                        data-val="${total}" 
                                        data-prev="${prevTotal !== undefined ? prevTotal : total}">
                                        ${total.toFixed(2)}
                                    </td>
                                    <td class="total-cell ${grandTotalClass}"
                                        data-val="${grandTotal}"
                                        data-prev="${prevGrandTotal !== undefined ? prevGrandTotal : grandTotal}">
                                        ${grandTotal.toFixed(2)}
                                    </td>
                                </tr>
                            `;
        }).join('')}
                    </tbody>
                </table>
            </div>
        `;

        document.getElementById('schoolCard').innerHTML = html;

        // VERIFICAÇÃO DE FINALIZAÇÃO DE COLUNA (JUIZ)
        // O usuário quer que o flash ocorra SOMENTE quando a última nota de um jurado for lançada.
        // Ou seja, quando a coluna daquele jurado estiver completa.

        let shouldFlashLeader = false;

        judges.forEach(judge => {
            // Verificar se este juiz deu nota para TODAS as escolas nesta categoria
            const scoresForJudge = this.storage.getScoresByCategory(category.id).filter(s => s.judgeId === judge.id && s.score !== null && s.score !== undefined);
            const isJudgeComplete = scoresForJudge.length === schools.length;

            const judgeKey = `${category.id}_${judge.id}`;

            if (isJudgeComplete) {
                const storageKey = `JUDGE_${judgeKey}`;
                if (!this.completedRows.has(storageKey)) {
                    this.completedRows.add(storageKey);
                    shouldFlashLeader = true;
                }
            } else {
                // Se deixou de estar completo (ex: excluiu nota), remove
                const storageKey = `JUDGE_${judgeKey}`;
                if (this.completedRows.has(storageKey)) {
                    this.completedRows.delete(storageKey);
                }
            }
        });

        // Se acabamos de completar uma coluna E não é renderização inicial
        if (shouldFlashLeader && !this.isFirstRender) {
            this.highlightLeader();
        }

        // Disparar animação via JS para os elementos marcados
        this.triggerGlitchAnimation();

        // Marcar que já renderizou a primeira vez
        this.isFirstRender = false;
    }

    triggerGlitchAnimation() {
        const elements = document.querySelectorAll('.animate-glitch');
        let maxDuration = 0;

        elements.forEach(el => {
            const targetVal = parseFloat(el.getAttribute('data-val'));
            const startVal = parseFloat(el.getAttribute('data-prev'));

            if (isNaN(targetVal) || isNaN(startVal)) return;

            // Duração da animação em ms
            const duration = 1500;
            maxDuration = Math.max(maxDuration, duration);
            const startTime = performance.now();

            // Texto original
            const originalText = targetVal.toFixed(2);

            const animate = (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // Função de easing suave
                const ease = 1 - Math.pow(1 - progress, 3);

                // Valor atual interpolado
                const current = startVal + (targetVal - startVal) * ease;

                // Efeito Glitch: caracteres aleatórios ocasionalmente
                if (progress < 1) {
                    if (Math.random() > 0.7) {
                        // Glitch visual
                        el.style.textShadow = `2px 0 ${Math.random() > 0.5 ? 'red' : 'cyan'}, -2px 0 ${Math.random() > 0.5 ? 'blue' : 'yellow'} `;
                        el.style.transform = `translate(${Math.random() * 2 - 1}px, ${Math.random() * 2 - 1}px)`;
                    } else {
                        el.style.textShadow = '0 0 10px rgba(255, 215, 0, 0.5)';
                        el.style.transform = 'none';
                    }

                    el.textContent = current.toFixed(2);
                    requestAnimationFrame(animate);
                } else {
                    // Finalizar
                    el.textContent = originalText;
                    el.style.textShadow = '';
                    el.style.transform = '';
                    el.classList.remove('animate-glitch');
                    el.classList.add('pulse-finish'); // Adiciona pulso final
                }
            };

            requestAnimationFrame(animate);
        });
    }

    highlightLeader() {
        // Encontrar quem é o líder atual (baseado nos dados do storage)
        const ranking = this.storage.getRanking();
        if (ranking.length === 0) return;

        const leaderId = ranking[0].id; // O primeiro do array já está ordenado com desempates

        // Encontrar a linha da escola líder na tabela
        const rows = document.querySelectorAll('.scores-table tbody tr');
        rows.forEach(row => {
            // Tenta achar o nome da escola na linha
            const nameCell = row.querySelector('.school-cell span');
            if (nameCell && nameCell.textContent === ranking[0].name) {
                // Remover classe de flash anterior se houver
                row.classList.remove('flash-leader');
                void row.offsetWidth; // force reflow
                row.classList.add('flash-leader');
            }
        });
    }

    renderRankingView(animateView = false) {
        const categoryView = document.getElementById('categoryView');
        const rankingView = document.getElementById('rankingView');
        const transitionView = document.getElementById('transitionView');

        categoryView.classList.add('hidden');
        if (transitionView) transitionView.classList.add('hidden');

        // Transição de entrada
        if (rankingView.classList.contains('hidden')) {
            rankingView.classList.remove('hidden');
            // Forçar reflow
            void rankingView.offsetWidth;
        }

        // Atualizar título
        document.getElementById('viewTitle').textContent = 'Classificação Geral';

        // Obter ranking
        const ranking = this.storage.getRanking();

        // Evitar renderização desnecessária se os dados não mudaram (evita "blink")
        const rankingHash = JSON.stringify(ranking);
        if (!animateView && this.lastRankingHash === rankingHash) {
            return;
        }
        this.lastRankingHash = rankingHash;

        if (ranking.length === 0) {
            document.getElementById('rankingGrid').innerHTML = `
                <div class="empty-state">
                    <h2>Nenhuma agremiação com notas</h2>
                </div>
            `;
            return;
        }

        // Renderizar ranking
        const html = ranking.map((school, index) => {
            const position = index + 1;
            let positionClass = '';
            let medal = '';

            if (position === 1) {
                positionClass = 'gold';
                medal = '🥇';
            } else if (position === 2) {
                positionClass = 'silver';
                medal = '🥈';
            } else if (position === 3) {
                positionClass = 'bronze';
                medal = '🥉';
            }

            // Adicionar animação escalonada apenas se for troca de view
            // Usamos style inline para o delay (Acelerado: 0.05s por item)
            const animStyle = animateView
                ? `animation: slideInRight 0.4s ease-out forwards; animation-delay: ${index * 0.05}s; opacity: 0;`
                : '';

            return `
                <div class="ranking-item" style="${animStyle}">
                    <div class="position ${positionClass}">${medal || position + 'º'}</div>
                    <img src="${school.logoDataURL || 'assets/default-logo.svg'}" 
                         alt="${school.name}" 
                         class="ranking-logo"
                         onerror="this.src='assets/default-logo.svg'">
                    <div class="ranking-school-name">${this.escapeHtml(school.name)}</div>
                    <div class="ranking-score">${school.total.toFixed(2)}</div>
                </div>
            `;
        }).join('');

        document.getElementById('rankingGrid').innerHTML = html;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    handleUpdate(dataType) {
        // Recarregar visualização quando dados mudam
        this.render();

        if (dataType === 'settings') {
            const settings = this.storage.getSettings();
            this.applySettings(settings);
        }
    }

    applySettings(settings) {
        // Atualizar fundo usando método centralizado
        this.updateBackground();

        // Atualizar logos do header (garantir que atualize quando settings mudar)
        this.updateHeaderLogos();
    }
}

// Inicializar quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    window.displayController = new DisplayController();
});
