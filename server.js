const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// Clientes SSE (Server-Sent Events) ativos
const sseClients = new Set();

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// Authentication Setup
const TOKEN_FILE = path.join(__dirname, '.admin_token');
let ADMIN_TOKEN = process.env.ADMIN_TOKEN;
if (!ADMIN_TOKEN) {
    if (fs.existsSync(TOKEN_FILE)) {
        ADMIN_TOKEN = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
    } else {
        ADMIN_TOKEN = crypto.randomBytes(16).toString('hex');
        fs.writeFileSync(TOKEN_FILE, ADMIN_TOKEN);
    }
}

/**
 * Get local IP address to display to user
 */
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    const candidates = [];

    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                candidates.push(iface.address);
            }
        }
    }

    // Prioridade: 192.168.x.x > 10.x.x.x > 172.x.x.x > Outros
    const best = candidates.find(ip => ip.startsWith('192.168.')) ||
        candidates.find(ip => ip.startsWith('10.')) ||
        candidates.find(ip => /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) ||
        candidates[0];

    return best || '127.0.0.1';
}

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
    try {
        fs.mkdirSync(UPLOADS_DIR);
        console.log('📁 Created uploads directory');
    } catch (e) {
        console.error('❌ Error creating uploads directory:', e);
    }
}

// Helper: Extract Base64 images to files
function processImages(data) {
    let changed = false;
    const processField = (obj, key, prefix) => {
        // Log para debug se for string grande
        if (typeof obj[key] === 'string' && obj[key].length > 1000) {
            console.log(`[DEBUG] Analisando ${prefix} (${obj[key].length} chars). Inicio: ${obj[key].substring(0, 50)}`);

            // Check regex match manually to debug
            const matchTest = obj[key].match(/^data:image\/([^;]+);base64,(.+)$/);
            if (!matchTest) {
                console.log(`[DEBUG] ❌ FALHA NO REGEX para ${prefix}`);
            }
        }

        if (obj[key] && typeof obj[key] === 'string' && obj[key].startsWith('data:image')) {
            try {
                // Detect extension (Robust Regex)
                const matches = obj[key].match(/^data:image\/([^;]+);base64,(.+)$/);
                if (matches && matches.length === 3) {
                    let ext = matches[1];
                    if (ext === 'jpeg') ext = 'jpg';
                    if (ext === 'svg+xml') ext = 'svg';

                    const buffer = Buffer.from(matches[2], 'base64');
                    // Filename: prefix + timestamp
                    const fileName = `${prefix}_${Date.now()}.${ext}`;
                    const filePath = path.join(UPLOADS_DIR, fileName);

                    fs.writeFileSync(filePath, buffer);

                    // Update field with URL
                    obj[key] = `/uploads/${fileName}`;
                    console.log(`🖼️ Extracted image for ${prefix}: ${fileName}`);
                    changed = true;
                }
            } catch (e) {
                console.error(`❌ Error processing image for ${prefix}:`, e.message);
            }
        }
    };

    if (data && data.schools) {
        data.schools.forEach(school => {
            // Process logoDataURL for each school
            processField(school, 'logoDataURL', `school_${school.id}`);
        });
    }

    // 2. Process Settings (Background, Logos)
    if (data && data.settings) {
        Object.keys(data.settings).forEach(key => {
            // Process any string field in settings (background, logos)
            processField(data.settings, key, `setting_${key}`);
        });
    }

    return changed;
}

// In-memory cache
let cachedData = null;

// Load initial data & Migrate if needed
if (fs.existsSync(DATA_FILE)) {
    try {
        const rawData = fs.readFileSync(DATA_FILE, 'utf8');
        try {
            const data = JSON.parse(rawData);
            // Run migration on startup
            if (processImages(data)) {
                cachedData = JSON.stringify(data);
                fs.writeFileSync(DATA_FILE, cachedData);
                console.log('✅ MIGRATION: Optimized data.json (Images -> Files)');
            } else {
                cachedData = rawData;
            }
        } catch (e) {
            console.error('Error parsing initial data JSON:', e);
            cachedData = rawData;
        }
    } catch (e) {
        console.error('Error loading initial data:', e);
    }
}

const server = http.createServer((req, res) => {
    // ... (CORS headers skipped in replacement, keeping existing context)
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // SSE: Conexão de Eventos em tempo real
    if (req.url === '/api/events' && req.method === 'GET') {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        });
        
        sseClients.add(res);
        console.log(`📡 Novo cliente SSE conectado. Clientes ativos: ${sseClients.size}`);
        
        // Ping de keep-alive a cada 20 segundos
        const pingInterval = setInterval(() => {
            res.write(': keepalive\n\n');
        }, 20000);

        req.on('close', () => {
            clearInterval(pingInterval);
            sseClients.delete(res);
            console.log(`📡 Cliente SSE desconectado. Clientes ativos: ${sseClients.size}`);
        });
        return;
    }

    // API: Get Data (FROM MEMORY)
    if (req.url === '/api/data' && req.method === 'GET') {
        if (cachedData) {
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
            });
            res.end(cachedData);
        } else {
            // If no cache, try reading file (fallback) or return null
            if (fs.existsSync(DATA_FILE)) {
                fs.readFile(DATA_FILE, (err, content) => {
                    if (err) {
                        res.writeHead(500);
                        res.end(JSON.stringify({ error: 'Error reading data' }));
                    } else {
                        cachedData = content; // Update cache
                        res.writeHead(200, {
                            'Content-Type': 'application/json',
                            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                            'Pragma': 'no-cache',
                            'Expires': '0',
                        });
                        res.end(content);
                    }
                });
            } else {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(null));
            }
        }
        return;
    }

    // API: Save Data (UPDATE MEMORY + DISK)
    if (req.url === '/api/data' && req.method === 'POST') {
        // Authentication Check
        const authHeader = req.headers['authorization'];
        if (!authHeader || authHeader !== `Bearer ${ADMIN_TOKEN}`) {
            console.log(`\n🚫 [POST] Tentativa de salvamento negada (Token Inválido)`);
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized: Invalid or missing token' }));
            return;
        }

        const startTime = Date.now();
        const contentLength = req.headers['content-length'];
        console.log(`\n📥 [POST] Recebendo dados... Tamanho: ${(contentLength / 1024).toFixed(2)} KB`);

        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                // Parse received data
                const data = JSON.parse(body);
                console.log(`⏱️  [PARSE] JSON Parse concluído em ${Date.now() - startTime}ms`);

                // Process images (optimize payload)
                const optimized = processImages(data);

                // Update Cache
                const finalBody = optimized ? JSON.stringify(data) : body;
                cachedData = finalBody;

                const processTime = Date.now() - startTime;
                console.log(`🧩 [PROCESS] Otimização: ${optimized ? 'SIM' : 'NÃO'} | Tempo: ${processTime}ms`);
                console.log(`💾 [SIZE] Final Body: ${(finalBody.length / 1024).toFixed(2)} KB`);

                // Write to disk async
                fs.writeFile(DATA_FILE, finalBody, (err) => {
                    if (err) {
                        console.error('Error saving data:', err);
                    } else {
                        console.log(`✅ [DISK] Data saved successfully (${Date.now() - startTime}ms total)`);
                    }
                });

                // Notificar todos os clientes SSE conectados sobre a atualização
                if (sseClients.size > 0) {
                    console.log(`📣 Notificando ${sseClients.size} cliente(s) conectados via SSE...`);
                    sseClients.forEach(client => {
                        try {
                            client.write('data: update\n\n');
                        } catch (err) {
                            sseClients.delete(client);
                        }
                    });
                }

                // Return optimized data if changed, so client can update local references
                if (optimized) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(finalBody);
                } else {
                    res.writeHead(200);
                    res.end('Data saved');
                }

            } catch (e) {
                console.error('Invalid JSON:', e.message);
                res.writeHead(400);
                res.end('Invalid JSON data');
            }
        });
        return;
    }

    // Static File Serving
    let filePath = '.' + req.url;
    if (filePath === './') filePath = './index.html';

    // Remove query params if any
    filePath = filePath.split('?')[0];

    const extname = path.extname(filePath);
    let contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                // If 404, try serving 404.html or just index.html (SPA-like)? 
                // For now, simple 404
                res.writeHead(404);
                res.end('File not found: ' + filePath);
            } else {
                res.writeHead(500);
                res.end('Server Error: ' + error.code);
            }
        } else {
            // Caching Strategy
            const headers = {
                'Content-Type': contentType
            };

            // Custom Cache for Uploads (Immutable)
            if (filePath.startsWith('./uploads/') || filePath.includes('\\uploads\\')) {
                // 1 Year Cache
                headers['Cache-Control'] = 'public, max-age=31536000, immutable';
            } else {
                // No Cache for App Files (Hot Reload support)
                headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
                headers['Pragma'] = 'no-cache';
                headers['Expires'] = '0';
            }

            res.writeHead(200, headers);
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    const ip = getLocalIP();
    console.log('---------------------------------------------------');
    console.log(`✅ SSAMBA Server iniciado!`);
    console.log(`🏠 Acesso Local:   http://localhost:${PORT}`);
    console.log(`📡 Acesso na Rede: http://${ip}:${PORT}`);
    console.log(`🔑 Token de Admin: ${ADMIN_TOKEN} (necessário para salvar dados)`);
    console.log('---------------------------------------------------');
    // Open admin panel safely (optional, batch file does it)
});
