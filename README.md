# 🏆 SSAMBA — Sistema de Apuração de Escolas de Samba

O **SSAMBA** é um sistema completo, moderno e de alta performance projetado para a apuração de desfiles de escolas de samba. Ele foi construído para rodar de forma híbrida: **100% offline** (via `localStorage` e `BroadcastChannel`), com **servidor Node.js local** (para múltiplos dispositivos na mesma rede local) ou **integrado ao Google Sheets/Google Drive** (via Google Apps Script).

---

## 📋 Especificações Técnicas

O sistema é dividido em três camadas principais:

### 1. Frontend (Interface do Usuário)
- **Painel Administrativo (`index.html`)**: Tela de controle para cadastro de agremiações, jurados, quesitos, gerenciamento de notas (lançamentos com salvamento automático no blur/foco) e parametrização do display.
- **Display Público (`display.html`)**: Tela de exibição de alta qualidade visual, otimizada para projetores (F11 fullscreen). Alterna dinamicamente entre:
  - **Tela de Transição (Espera)**: Exibe logos institucionais e o título do evento.
  - **Vista de Quesito**: Exibição da tabela dinâmica com as notas lançadas em tempo real por jurado, totais parciais e gerais.
  - **Ranking Geral**: Classificação ordenada das agremiações com destaques e medalhas para o pódio (1º, 2º e 3º).

### 2. Lógica & Estado (`scripts/`)
- **`storage.js` (`StorageManager`)**: Gerenciador central de dados. Controla a persistência local, o canal de comunicação em tempo real (`BroadcastChannel` API com nome `samba-scoring`) e sincroniza com o backend.
- **`admin.js` (`AdminPanel`)**: Controla a navegação por abas do painel admin, valida os dados de entrada (imagens, limites de notas) e renderiza as tabelas de inserção.
- **`display.js` (`DisplayController`)**: Controla o comportamento do telão, executa animações de transição de dados interpolados (efeito de contagem glitch), pulso final e efeito de destaque (flash) no líder do quesito.

### 3. Persistência & Sincronização (Backend Híbrido)
- **Modo Local Offline**: Usa apenas `localStorage` e `BroadcastChannel` para comunicação entre abas no mesmo navegador.
- **Modo Servidor Local (`server.js`)**: Servidor HTTP em Vanilla Node.js que persiste os dados em `data.json`.
  - Otimiza as imagens enviadas em Base64 extraindo-as para arquivos físicos na pasta `/uploads`, reduzindo drasticamente o tamanho do payload e prevenindo o estouro de limites do `localStorage`.
- **Modo Google Apps Script (`Código.gs`)**: Permite rodar o sistema diretamente dentro da nuvem do Google Sheets.
  - Salva as informações em 5 abas da planilha: `Escolas`, `Quesitos`, `Jurados`, `Notas` e `Configuracoes`.
  - Faz o upload de logos diretamente para o Google Drive (pasta `Apuracao_Imagens`) e retorna URLs públicas.

---

## ⚖️ Regras de Negócio

1. **Validação de Notas**:
   - As notas devem estar estritamente no intervalo de **0.0 a 10.0** (permitindo frações de 0.1).
   - O salvamento é automático (auto-save) ao sair do campo (`blur`) ou pressionar `Enter` na grid de lançamentos.

2. **Cálculo da Pontuação Geral**:
   - O total do quesito de uma agremiação é a soma simples de todas as notas dos jurados associados àquele quesito.
   - O total geral da agremiação é a soma de todos os totais de quesitos, **subtraindo-se as penalidades** registradas.
   - \[\text{Total Geral} = \sum(\text{Notas dos Quesitos}) - \text{Penalidades}\]

3. **Critérios de Desempate**:
   - Em caso de empate na nota geral final, a ordenação é resolvida com base em uma lista de quesitos prioritários definida nas configurações.
   - O sistema percorre as prioridades cadastradas e compara as notas parciais das agremiações empatadas no respectivo quesito. A que tiver a maior nota no quesito prioritário ganha a posição.

4. **Eventos do Telão**:
   - **Flash no Líder**: Quando a última nota pendente de um jurado em um quesito específico é lançada (completando a coluna inteira de um jurado), a linha da escola que está liderando a apuração pisca com um efeito dourado (`flash-leader`) para gerar emoção.
   - **Animações de Totais**: Mudanças nos totais parciais e finais utilizam uma contagem interpolada com efeito glitch visual (`animate-glitch`) para não mudar o valor estaticamente.

---

## 🚀 Como Executar Localmente

Você pode iniciar o servidor web local de duas formas rápidas:

**Via Node.js (Recomendado)**:
```bash
node server.js
```
Acesse no seu navegador: `http://localhost:3000` (o terminal também exibirá o IP da rede local para acesso por outros dispositivos, como tablets para os jurados).

**Via Python**:
```bash
python -m http.server 8080
```
Acesse no seu navegador: `http://localhost:8080`

---

## 📝 Anotações de Desenvolvimento & Roadmap

### Bugs Críticos Diagnosticados (Próximas Correções)
- A função `handleUpdate` no `display.js` está declarada duas vezes (uma no topo e outra no rodapé do arquivo), o que anula o controle de throttle e provoca renderizações desnecessárias.
- O polling padrão do display está rodando de forma excessiva a cada 200ms, causando uso elevado de CPU desnecessariamente; deve-se usar o BroadcastChannel como gatilho prioritário e aliviar o loop.
- O controle de edição (`editingId`) é compartilhado globalmente entre abas de Escolas, Jurados e Quesitos no admin, podendo causar colisão se o usuário mudar de aba enquanto edita.

### Melhorias Planejadas (Roadmap)
- **Modo Revelação**: Adicionar controle para revelação dramática de notas uma a uma no telão.
- **Painel de Progresso**: Exibir um mini-dashboard de apuração no admin para ver quais quesitos estão pendentes de notas de forma consolidada.
- **Substituição de Confirmações**: Trocar os `confirm()` padrões do browser por modais carnavalescos e dinâmicos integrados ao design.
