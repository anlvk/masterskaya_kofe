'use strict';

// Простой сервер для лэндинга без внешних зависимостей. Нужен Node.js 18 или новее.
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Контакты берём из config.json. Читаем при каждом запросе страницы,
// поэтому после правки конфига перезапуск не нужен.
async function renderIndex() {
  const [html, rawConfig] = await Promise.all([
    fs.readFile(path.join(PUBLIC_DIR, 'index.html'), 'utf8'),
    fs.readFile(path.join(__dirname, 'config.json'), 'utf8'),
  ]);
  const config = JSON.parse(rawConfig);
  const values = {
    INSTAGRAM_URL: config.instagramUrl,
    INSTAGRAM_HANDLE: config.instagramHandle,
    PHONE_TEXT: config.phoneText,
    PHONE_TEL: config.phoneTel,
  };
  return html.replace(/\{\{([A-Z_]+)\}\}/g, (match, key) =>
    key in values ? escapeHtml(values[key]) : match
  );
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
  res.end(body);
}

async function handle(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    return send(res, 400, 'Bad Request');
  }

  if (pathname === '/healthz') {
    return send(res, 200, 'ok', { 'Content-Type': 'text/plain; charset=utf-8' });
  }

  if (pathname === '/' || pathname === '/index.html') {
    try {
      const html = await renderIndex();
      return send(res, 200, req.method === 'HEAD' ? '' : html, {
        'Content-Type': TYPES['.html'],
        'Cache-Control': 'no-cache',
      });
    } catch (err) {
      console.error('Не удалось собрать страницу:', err.message);
      return send(res, 500, 'Ошибка сервера', { 'Content-Type': 'text/plain; charset=utf-8' });
    }
  }

  // Защита от выхода за пределы public/
  const filePath = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (filePath !== PUBLIC_DIR && !filePath.startsWith(PUBLIC_DIR + path.sep)) {
    return send(res, 403, 'Forbidden');
  }

  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) throw new Error('not a file');
    const type = TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    const body = req.method === 'HEAD' ? '' : await fs.readFile(filePath);
    return send(res, 200, body, {
      'Content-Type': type,
      'Content-Length': stat.size,
      'Cache-Control': 'public, max-age=3600',
    });
  } catch {
    return send(res, 404, 'Страница не найдена', { 'Content-Type': 'text/plain; charset=utf-8' });
  }
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error(err);
    if (!res.headersSent) send(res, 500, 'Ошибка сервера');
    else res.end();
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Мастерская кофе: http://localhost:${PORT}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
