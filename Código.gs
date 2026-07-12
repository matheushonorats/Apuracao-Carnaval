/**
 * SSAMBA - Google Sheets Integration Backend
 * Este arquivo contém o código do Google Apps Script (GAS) que rodará nos servidores do Google.
 * Ele serve a interface (Painel Admin e Telão) e gerencia as tabelas da planilha como banco de dados.
 */

// Nome da pasta padrão no Drive para salvar imagens
const DRIVE_FOLDER_NAME = "Apuracao_Imagens";

/**
 * Roteamento do Web App
 */
function doGet(e) {
  const page = (e && e.parameter && e.parameter.page) || 'admin';
  
  if (page === 'display') {
    return HtmlService.createTemplateFromFile('display')
      .evaluate()
      .setTitle('SSAMBA - Display Público')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('SSAMBA - Painel de Apuração')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Função utilitária para incluir arquivos HTML (CSS/JS) no template
 */
function include(filename) {
  try {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  } catch (err) {
    return `<!-- Erro ao incluir ${filename}: ${err.message} -->`;
  }
}

/**
 * Cria o menu personalizado na barra superior do Google Planilhas
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🏆 Apuração Samba')
    .addItem('⚙️ Abrir Painel Admin', 'showAdminDialog')
    .addItem('🖥️ Abrir Telão Público', 'showDisplayDialog')
    .addSeparator()
    .addItem('🛠️ Inicializar Tabelas', 'initSpreadsheet')
    .addToUi();
}

function showAdminDialog() {
  const html = HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setWidth(1000)
    .setHeight(700);
  SpreadsheetApp.getUi().showModalDialog(html, 'SSAMBA - Painel de Apuração');
}

function showDisplayDialog() {
  const html = HtmlService.createTemplateFromFile('display')
    .evaluate()
    .setWidth(1000)
    .setHeight(700);
  SpreadsheetApp.getUi().showModalDialog(html, 'SSAMBA - Telão Público');
}

/**
 * Inicializa a estrutura da planilha se ela for nova ou estiver incompleta
 */
function initSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const tables = {
    "Escolas": ["id", "name", "logoDataURL", "order", "createdAt", "penalty"],
    "Quesitos": ["id", "name", "order", "createdAt"],
    "Jurados": ["id", "name", "categoryIds", "createdAt"],
    "Notas": ["schoolId", "categoryId", "judgeId", "score", "updatedAt"],
    "Configuracoes": ["Chave", "Valor"]
  };
  
  for (const name in tables) {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(tables[name]);
      
      // Estilizar cabeçalho de forma premium (azul-marinho, texto branco, negrito)
      const range = sheet.getRange(1, 1, 1, tables[name].length);
      range.setBackground("#1a202c")
           .setFontColor("#ffffff")
           .setFontWeight("bold")
           .setHorizontalAlignment("center");
      
      sheet.setFrozenRows(1);
      sheet.autoResizeColumns(1, tables[name].length);
      
      // Popular configurações básicas se for a aba correspondente
      if (name === "Configuracoes") {
        sheet.appendRow(["headerTitle", "Apuração do Desfile das Escolas de Samba"]);
        sheet.appendRow(["transitionTitle", "APURAÇÃO DO DESFILE DAS ESCOLAS DE SAMBA"]);
        sheet.appendRow(["lastUpdated", Date.now().toString()]);
        sheet.appendRow(["tiebreakers", "[]"]);
        sheet.appendRow(["displayControl", JSON.stringify({ view: 'category', currentCategoryId: null, currentSchoolIndex: 0 })]);
      }
    }
  }
}

/**
 * Obtém todos os dados da Planilha estruturados em formato JSON idêntico ao original
 */
function getData() {
  initSpreadsheet(); // Garantir que está tudo criado
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Helper para ler planilha e retornar array de objetos
  const readSheet = (sheetName) => {
    const sheet = ss.getSheetByName(sheetName);
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];
    
    const headers = data[0];
    const rows = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const obj = {};
      let hasData = false;
      
      for (let j = 0; j < headers.length; j++) {
        const val = row[j];
        if (val !== "" && val !== null && val !== undefined) {
          hasData = true;
        }
        obj[headers[j]] = val;
      }
      
      if (hasData) {
        rows.push(obj);
      }
    }
    return rows;
  };
  
  // 1. Carregar Dados Brutos
  const rawSchools = readSheet("Escolas");
  const rawCategories = readSheet("Quesitos");
  const rawJudges = readSheet("Jurados");
  const rawScores = readSheet("Notas");
  const rawConfigs = readSheet("Configuracoes");
  
  // 2. Mapear e Converter Tipos (para bater 100% com o frontend original)
  const schools = rawSchools.map(s => ({
    id: String(s.id),
    name: String(s.name),
    logoDataURL: s.logoDataURL ? String(s.logoDataURL) : null,
    order: Number(s.order || 0),
    createdAt: String(s.createdAt || ''),
    penalty: s.penalty !== undefined && s.penalty !== "" ? Number(s.penalty) : 0
  }));
  
  const categories = rawCategories.map(c => ({
    id: String(c.id),
    name: String(c.name),
    order: Number(c.order || 0),
    createdAt: String(c.createdAt || '')
  }));
  
  const judges = rawJudges.map(j => {
    let catIds = [];
    try {
      if (j.categoryIds) {
        catIds = JSON.parse(j.categoryIds);
      }
    } catch (e) {
      if (String(j.categoryIds).trim()) {
        catIds = String(j.categoryIds).split(',').map(s => s.trim());
      }
    }
    return {
      id: String(j.id),
      name: String(j.name),
      categoryIds: Array.isArray(catIds) ? catIds.map(String) : [],
      createdAt: String(j.createdAt || '')
    };
  });
  
  const scores = rawScores.map(s => ({
    schoolId: String(s.schoolId),
    categoryId: String(s.categoryId),
    judgeId: String(s.judgeId),
    score: Number(s.score || 0),
    updatedAt: String(s.updatedAt || '')
  }));
  
  // 3. Montar Configurações e displayControl
  const settings = {
    tiebreakers: [],
    categoriesDisplayOrder: [],
    headerTitle: "Apuração do Desfile",
    transitionTitle: "APURAÇÃO",
    governmentLogo: null,
    backgroundImage: null
  };
  
  let displayControl = { view: 'category', currentCategoryId: null, currentSchoolIndex: 0 };
  let lastUpdated = Date.now();
  
  rawConfigs.forEach(c => {
    const key = c.Chave;
    const val = c.Valor;
    
    if (key === 'lastUpdated') {
      lastUpdated = Number(val || Date.now());
    } else if (key === 'tiebreakers') {
      try { settings.tiebreakers = JSON.parse(val); } catch (e) {}
    } else if (key === 'categoriesDisplayOrder') {
      try { settings.categoriesDisplayOrder = JSON.parse(val); } catch (e) {}
    } else if (key === 'displayControl') {
      try { displayControl = JSON.parse(val); } catch (e) {}
    } else if (key === 'governmentLogo' || key === 'backgroundImage' || key === 'headerTitle' || key === 'transitionTitle') {
      settings[key] = val ? String(val) : null;
    }
  });
  
  return {
    schools,
    categories,
    judges,
    scores,
    settings,
    displayControl,
    lastUpdated
  };
}

/**
 * Retorna apenas o timestamp da última alteração de forma ultra veloz
 */
function getLastUpdated() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Configuracoes");
  if (!sheet) return Date.now();
  
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === "lastUpdated") {
      return Number(data[i][1] || Date.now());
    }
  }
  return Date.now();
}

/**
 * Salva a estrutura completa enviada pelo frontend de volta na planilha
 */
function saveData(data) {
  if (!data) return false;
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  initSpreadsheet(); // Garantir que está tudo criado
  
  // Adiciona timestamp de controle
  const newTimestamp = Date.now();
  data.lastUpdated = newTimestamp;
  
  // Helper para limpar aba e gravar novos dados de forma otimizada
  const writeSheet = (sheetName, headers, list, transformFn) => {
    const sheet = ss.getSheetByName(sheetName);
    sheet.clearContents();
    
    const rows = [headers];
    list.forEach(item => {
      rows.push(transformFn(item));
    });
    
    sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
    sheet.autoResizeColumns(1, headers.length);
  };
  
  // 1. Gravar Escolas
  writeSheet(
    "Escolas",
    ["id", "name", "logoDataURL", "order", "createdAt", "penalty"],
    data.schools || [],
    s => [s.id, s.name, s.logoDataURL || "", s.order || 0, s.createdAt || "", s.penalty || 0]
  );
  
  // 2. Gravar Quesitos
  writeSheet(
    "Quesitos",
    ["id", "name", "order", "createdAt"],
    data.categories || [],
    c => [c.id, c.name, c.order || 0, c.createdAt || ""]
  );
  
  // 3. Gravar Jurados
  writeSheet(
    "Jurados",
    ["id", "name", "categoryIds", "createdAt"],
    data.judges || [],
    j => [j.id, j.name, JSON.stringify(j.categoryIds || []), j.createdAt || ""]
  );
  
  // 4. Gravar Notas
  writeSheet(
    "Notas",
    ["schoolId", "categoryId", "judgeId", "score", "updatedAt"],
    data.scores || [],
    s => [s.schoolId, s.categoryId, s.judgeId, s.score || 0, s.updatedAt || ""]
  );
  
  // 5. Gravar Configurações
  const sheetConfigs = ss.getSheetByName("Configuracoes");
  sheetConfigs.clearContents();
  
  const configRows = [
    ["Chave", "Valor"],
    ["lastUpdated", String(newTimestamp)],
    ["headerTitle", data.settings.headerTitle || ""],
    ["transitionTitle", data.settings.transitionTitle || ""],
    ["governmentLogo", data.settings.governmentLogo || ""],
    ["backgroundImage", data.settings.backgroundImage || ""],
    ["tiebreakers", JSON.stringify(data.settings.tiebreakers || [])],
    ["categoriesDisplayOrder", JSON.stringify(data.settings.categoriesDisplayOrder || [])],
    ["displayControl", JSON.stringify(data.displayControl || {})]
  ];
  
  sheetConfigs.getRange(1, 1, configRows.length, 2).setValues(configRows);
  
  return true;
}

/**
 * Salva uma imagem em Base64 no Google Drive do usuário e retorna a URL pública de acesso direto.
 * Isso evita salvar arquivos Base64 imensos dentro das células da Planilha.
 */
function saveImageToDrive(base64Data, fileName) {
  try {
    // 1. Tratar a string Base64 extraindo cabeçalhos se existirem
    const matches = base64Data.match(/^data:image\/([^;]+);base64,(.+)$/);
    let mimeType = "image/jpeg";
    let bytes;
    
    if (matches && matches.length === 3) {
      mimeType = `image/${matches[1]}`;
      bytes = Utilities.base64Decode(matches[2]);
    } else {
      bytes = Utilities.base64Decode(base64Data);
    }
    
    // 2. Localizar ou criar a pasta no Google Drive
    const folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
    let folder;
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(DRIVE_FOLDER_NAME);
    }
    
    // 3. Criar o blob e salvar o arquivo
    const blob = Utilities.newBlob(bytes, mimeType, fileName);
    const file = folder.createFile(blob);
    
    // 4. Conceder permissão de leitura a qualquer pessoa com o link
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    // 5. Retornar um link direto de visualização robusto
    const fileId = file.getId();
    const directUrl = `https://docs.google.com/uc?export=view&id=${fileId}`;
    
    return directUrl;
  } catch (err) {
    Logger.log("Erro ao salvar imagem no Drive: " + err.message);
    throw new Error("Falha no upload para o Google Drive: " + err.message);
  }
}
