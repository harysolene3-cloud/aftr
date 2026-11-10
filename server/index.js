import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { openDb, ROOT, UPLOAD_DIR } from './db.js';
import { seed } from './seed.js';
import { match, sessionUser, requireRole, readBody, sendJson, HttpError } from './http.js';
import './routes/auth.js';
import './routes/public.js';
import './routes/community.js';
import './routes/marketplace.js';
import './routes/studio.js';
import './routes/admin.js';
import './routes/marketing.js';
import './routes/djmarketing.js';

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = join(ROOT, 'public');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav',
  '.json': 'application/json', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

const { isNew } = openDb();
if (isNew) { seed(); console.log('Base créée avec les données de démonstration.'); }

async function serveFile(res, file, req) {
  try {
    const s = await stat(file);
    if (!s.isFile()) return false;
    const type = TYPES[extname(file).toLowerCase()] || 'application/octet-stream';
    const range = req.headers.range;
    // Les vidéos et l'audio ont besoin des requêtes partielles pour la lecture et le déplacement dans le temps
    if (range && /^(video|audio)\//.test(type)) {
      const [a, b] = range.replace('bytes=', '').split('-');
      const start = Number(a), end = b ? Number(b) : s.size - 1;
      const buf = (await readFile(file)).subarray(start, end + 1);
      res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${s.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': buf.length });
      res.end(buf);
      return true;
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': s.size, 'Cache-Control': type.startsWith('text/html') ? 'no-store' : 'no-cache' });
    res.end(await readFile(file));
    return true;
  } catch { return false; }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = decodeURIComponent(url.pathname);
  try {
    if (path.startsWith('/api/')) {
      const r = match(req.method, path);
      if (!r) return sendJson(res, 404, { error: 'Route inconnue.' });
      const user = sessionUser(req);
      requireRole(user, r.role);
      let body = {};
      if (r.raw) body = await readBody(req, 80_000_000);
      else if (req.method !== 'GET') {
        const buf = await readBody(req);
        body = buf.length ? JSON.parse(buf.toString('utf8')) : {};
      }
      const ctx = { req, res, user, params: r.params, query: Object.fromEntries(url.searchParams), body };
      const out = await r.handler(ctx);
      if (res.writableEnded) return;
      return sendJson(res, 200, out ?? { ok: true });
    }
    if (path.startsWith('/uploads/')) {
      const file = normalize(join(UPLOAD_DIR, path.slice('/uploads/'.length)));
      if (file.startsWith(UPLOAD_DIR) && await serveFile(res, file, req)) return;
      res.writeHead(404); return res.end('Introuvable');
    }
    const file = normalize(join(PUBLIC_DIR, path));
    if (file.startsWith(PUBLIC_DIR) && extname(file) && await serveFile(res, file, req)) return;
    // Application monopage : toutes les autres adresses renvoient le shell
    await serveFile(res, join(PUBLIC_DIR, 'index.html'), req);
  } catch (e) {
    if (e instanceof HttpError) return sendJson(res, e.status, { error: e.message });
    if (e instanceof SyntaxError) return sendJson(res, 400, { error: 'Requête mal formée.' });
    console.error(e);
    sendJson(res, 500, { error: 'Erreur interne du serveur.' });
  }
});

server.listen(PORT, () => {
  console.log(`\n  AFTR est lancé : http://localhost:${PORT}\n`);
});
