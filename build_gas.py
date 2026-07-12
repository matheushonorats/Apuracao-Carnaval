#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SSAMBA - Google Apps Script Build Compiler
Este script compila os arquivos do projeto (HTML, CSS, JS) e gera uma pasta
'dist_gas/' com arquivos prontos para serem colados diretamente no editor do Google Apps Script.
Ele também converte imagens estáticas locais (como logos) em Base64 para garantir carregamento autônomo na nuvem.
"""

import os
import re
import base64
import shutil

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
DIST_DIR = os.path.join(ROOT_DIR, "dist_gas")

def get_base64_img(relative_path):
    """Lê um arquivo de imagem e retorna sua string Base64 Data URL"""
    full_path = os.path.join(ROOT_DIR, relative_path)
    if not os.path.exists(full_path):
        # Tentar procurar em caminhos alternativos
        if relative_path == "assets/icone.png":
            alt_path = os.path.join(ROOT_DIR, "logo.png")
            if os.path.exists(alt_path):
                full_path = alt_path
            else:
                return ""
        else:
            return ""
            
    ext = os.path.splitext(full_path)[1].lower().replace(".", "")
    if ext == "svg":
        mime = "image/svg+xml"
    elif ext == "jpg" or ext == "jpeg":
        mime = "image/jpeg"
    else:
        mime = "image/png"
        
    try:
        with open(full_path, "rb") as f:
            encoded = base64.b64encode(f.read()).decode("utf-8")
            return f"data:{mime};base64,{encoded}"
    except Exception as e:
        print(f"⚠️ Erro ao converter imagem {relative_path}: {e}")
        return ""

def read_file(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        return f.read()

def write_file(filepath, content):
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

def compile_gas():
    print("🚀 Iniciando compilação do SSAMBA para Google Apps Script...")
    
    # 1. Recriar diretório dist_gas
    if os.path.exists(DIST_DIR):
        shutil.rmtree(DIST_DIR)
    os.makedirs(DIST_DIR)
    
    # 2. Copiar Código.gs diretamente
    shutil.copy2(os.path.join(ROOT_DIR, "Código.gs"), os.path.join(DIST_DIR, "Código.gs"))
    print("✅ Copiado: Código.gs")
    
    # 3. Compilar arquivos CSS de styles/ para arquivos HTML estruturados (Stylesheets do GAS)
    css_files = {
        "styles_shared_css.html": "styles/shared.css",
        "styles_admin_css.html": "styles/admin.css",
        "styles_display_css.html": "styles/display.css"
    }
    
    for gas_name, local_path in css_files.items():
        full_path = os.path.join(ROOT_DIR, local_path)
        if os.path.exists(full_path):
            content = read_file(full_path)
            # Adicionar tags de estilo
            html_wrapped = f"<style>\n{content}\n</style>"
            write_file(os.path.join(DIST_DIR, gas_name), html_wrapped)
            print(f"✅ Compilado CSS: {local_path} -> {gas_name}")
            
    # 4. Compilar arquivos JS de scripts/ para arquivos HTML estruturados (Scripts do GAS)
    js_files = {
        "scripts_storage_js.html": "scripts/storage.js",
        "scripts_admin_js.html": "scripts/admin.js",
        "scripts_display_js.html": "scripts/display.js"
    }
    
    for gas_name, local_path in js_files.items():
        full_path = os.path.join(ROOT_DIR, local_path)
        if os.path.exists(full_path):
            content = read_file(full_path)
            # Adicionar tags de script
            html_wrapped = f"<script>\n{content}\n</script>"
            write_file(os.path.join(DIST_DIR, gas_name), html_wrapped)
            print(f"✅ Compilado JS: {local_path} -> {gas_name}")
            
    # 5. Inlining de imagens no HTML
    print("📦 Convertendo imagens locais para Base64...")
    icone_base64 = get_base64_img("assets/icone.png")
    
    # 6. Compilar index.html (Admin)
    index_html = read_file(os.path.join(ROOT_DIR, "index.html"))
    
    # Substituir CSS imports por chamadas template include
    index_compiled = re.sub(
        r'<link rel="stylesheet" href="styles/shared.css">',
        r"<?!= include('styles_shared_css'); ?>",
        index_html
    )
    index_compiled = re.sub(
        r'<link rel="stylesheet" href="styles/admin.css">',
        r"<?!= include('styles_admin_css'); ?>",
        index_compiled
    )
    
    # Substituir JS imports por chamadas template include
    index_compiled = re.sub(
        r'<script src="scripts/storage.js"></script>',
        r"<?!= include('scripts_storage_js'); ?>",
        index_compiled
    )
    index_compiled = re.sub(
        r'<script src="scripts/admin.js"></script>',
        r"<?!= include('scripts_admin_js'); ?>",
        index_compiled
    )
    
    # Substituir Favicon e Imagens Estáticas locais
    index_compiled = re.sub(
        r'<link rel="icon" type="image/png" href="assets/icone.png">',
        r'<!-- Favicon gerenciado pelo Google Sheets -->',
        index_compiled
    )
    
    if icone_base64:
        # Substituir imagens estáticas de logo
        index_compiled = index_compiled.replace('src="assets/icone.png"', f'src="{icone_base64}"')
        
    write_file(os.path.join(DIST_DIR, "index.html"), index_compiled)
    print("✅ Compilado e Vinculado: index.html")
    
    # 7. Compilar display.html (Telão)
    display_html = read_file(os.path.join(ROOT_DIR, "display.html"))
    
    # Substituir CSS imports por chamadas template include
    display_compiled = re.sub(
        r'<link rel="stylesheet" href="styles/shared.css">',
        r"<?!= include('styles_shared_css'); ?>",
        display_html
    )
    display_compiled = re.sub(
        r'<link rel="stylesheet" href="styles/display.css">',
        r"<?!= include('styles_display_css'); ?>",
        display_compiled
    )
    
    # Substituir JS imports por chamadas template include
    display_compiled = re.sub(
        r'<script src="scripts/storage.js"></script>',
        r"<?!= include('scripts_storage_js'); ?>",
        display_compiled
    )
    display_compiled = re.sub(
        r'<script src="scripts/display.js"></script>',
        r"<?!= include('scripts_display_js'); ?>",
        display_compiled
    )
    
    # Substituir Favicon e Imagens Estáticas locais
    display_compiled = re.sub(
        r'<link rel="icon" type="image/png" href="assets/icone.png">',
        r'<!-- Favicon gerenciado pelo Google Sheets -->',
        display_compiled
    )
    
    if icone_base64:
        display_compiled = display_compiled.replace('src="assets/icone.png"', f'src="{icone_base64}"')
        
    write_file(os.path.join(DIST_DIR, "display.html"), display_compiled)
    print("✅ Compilado e Vinculado: display.html")
    
    print("\n🎉 Compilação concluída com sucesso!")
    print(f"📁 Os arquivos prontos para copiar estão na pasta: {DIST_DIR}\n")

if __name__ == "__main__":
    compile_gas()
