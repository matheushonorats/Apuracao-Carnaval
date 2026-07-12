# 🎭 Guia Rápido - Sistema de Apuração

## ✅ Sistema Corrigido e Funcionando!

**Erros corrigidos:**
- ✅ Erro de sintaxe no `admin.js` (linha 858)
- ✅ Propriedade CSS faltante no `admin.css`  
- ✅ Container de alertas adicionado

---

## 🚀 Como Usar AGORA

### 1. Acesse o Sistema
**Abra no navegador:** http://localhost:8080

### 2. Cadastre Dados (Passo a Passo)

#### A) Cadastrar Escolas
1. Já está na aba "🏫 Escolas"
2. Digite o nome (ex: "Unidos da Tijuca")
3. *Opcional:* Escolha uma logo (JPG, PNG, GIF, WEBP até 5MB)
4. Clique "Adicionar Escola"
5. **Repita** para todas as escolas

#### B) Cadastrar Jurados
1. Clique na aba "👨‍⚖️ Jurados"
2. Digite o nome do jurado
3. *Opcional:* Marque quesitos específicos (ou deixe vazio = julga todos)
4. Clique "Adicionar Jurado"
5. **Repita** para todos os jurados

#### C) Cadastrar Quesitos
1. Clique na aba "📋 Quesitos"
2. Digite o nome (ex: "Bateria")
3. Digite a ordem (1, 2, 3, 4...)
4. Clique "Adicionar Quesito"
5. **Repita** para todos os quesitos

**Sugestão de quesitos:**
- Ordem 1: Bateria
- Ordem 2: Harmonia
- Ordem 3: Evolução
- Ordem 4: Fantasias
- Ordem 5: Comissão de Frente
- Ordem 6: Enredo
- Ordem 7: Alegorias e Adereços
- Ordem 8: Mestre-Sala e Porta-Bandeira

#### D) Lançar Notas
1. Clique na aba "✍️ Lançamentos"
2. Selecione um quesito
3. Preencha a grade com notas de 0 a 10
4. Clique "Salvar Notas"
5. **Repita** para cada quesito

### 3. Visualizar Classificação

#### No Painel Admin:
1. Vá na aba "⚙️ Configurações"
2. Veja as estatísticas no topo

#### Na Tela Pública:
1. Vá na aba "📺 Controle"
2. Clique em "Abrir Tela Pública"
3. Alterne entre:
   - **Vista de Quesito** (escolas rotacionam a cada 10s)
   - **🏆 Ranking Geral** (aqui está a CLASSIFICAÇÃO completa!)

---

## 🏆 ONDE ESTÁ A CLASSIFICAÇÃO?

A classificação está em **2 lugares**:

### 1. Display Público - Ranking Geral
- Abra o display público (aba Controle > Abrir Tela Pública)
- Clique em "Ranking Geral"
- **Mostra:**
  - 🥇 1º lugar com medalha de ouro
  - 🥈 2º lugar com medalha de prata
  - 🥉 3º lugar com medalha de bronze
  - Demais posições em ordem decrescente
  - Total de pontos de cada escola

### 2. Painel Admin - Estatísticas
- Aba "Configurações"
- Veja totais por escola
- Exporte para JSON se quiser

---

## 💾 Backup dos Dados

**Importante**: Seus dados estão salvos no navegador!

- **Exportar**: Configurações > "📥 Exportar Dados (JSON)"
- **Importar**: Configurações > "📤 Importar Dados (JSON)"
- **Limpar**: Configurações > "🗑️ Limpar Todos os Dados" (cuidado!)

---

## ✨ Dicas

1. **Cadastre tudo primeiro**: Escolas → Jurados → Quesitos → Notas
2. **Teste antes do evento**: Lance notas fake para testar
3. **Use F11**: No display público, pressione F11 para tela cheia
4. **Backup regular**: Exporte os dados a cada quesito lançado
5. **Dois computadores**: Admin em um, Display em outro (ou dois monitores)

---

## 🎉 Pronto para Usar!

O sistema está **100% funcional** e rodando em:
- **Painel Admin**: http://localhost:8080
- **Display Público**: http://localhost:8080/display.html

**Bom Carnaval!** 🎭🎊
