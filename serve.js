/**
 * CDS Industrial - Servidor de arquivos estáticos
 * Não precisa de npm install - usa apenas módulos nativos do Node.js
 */
const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT    = 3000;
const DIST    = path.join(__dirname, 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.mjs':  'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.webp': 'image/webp',
};

const server = http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0]; // remove query string

  // Normalise
  let filePath = path.join(DIST, urlPath);

  // If directory, try index.html inside it
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  // SPA fallback: if file not found, serve index.html
  if (!fs.existsSync(filePath)) {
    filePath = path.join(DIST, 'index.html');
  }

  const ext  = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('  ==========================================');
  console.log('    CDS INDUSTRIAL - Sistema iniciado!');
  console.log('  ==========================================');
  console.log('');
  console.log('  Acesse: http://localhost:' + PORT);
  console.log('');
  console.log('  Pressione Ctrl+C para encerrar.');
  console.log('');
});
