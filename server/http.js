// Mini-routeur HTTP sans dépendance : routes JSON, cookies, sessions, contrôle des rôles.
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { get, run, all, now, DATA_DIR } from './db.js';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const fail = (status, message) => { throw new HttpError(status, message); };

const routes = [];
/**
 * Déclare une route. `opts.role` : 'user' (connecté), 'dj', 'organizer', 'admin' ou undefined (public).
 */
export function route(method, path, handler, opts = {}) {
  const keys = [];
  const re = new RegExp('^' + path.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, re, keys, handler, role: opts.role, raw: opts.raw });
}

export function match(method, pathname) {
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = pathname.match(r.re);
    if (m) return { ...r, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
  }
  return null;
}

// ───────── Mots de passe et sessions
export function hashPassword(pw) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + scryptSync(pw, salt, 32).toString('hex');
}
export function checkPassword(pw, stored) {
  const [salt, hash] = stored.split(':');
  const a = Buffer.from(hash, 'hex'), b = scryptSync(pw, salt, 32);
  return a.length === b.length && timingSafeEqual(a, b);
}
// Sessions signées (HMAC) : le jeton porte l'identifiant et l'expiration, sans table à consulter.
// Indispensable sur Vercel, où chaque instance a sa propre base temporaire.
// Le secret vient de AFTR_SECRET, sinon d'un fichier généré une fois dans le dossier de données.
function loadSecret() {
  if (process.env.AFTR_SECRET) return process.env.AFTR_SECRET;
  const file = join(DATA_DIR, '.secret');
  try { return readFileSync(file, 'utf8'); } catch {}
  const s = randomBytes(32).toString('hex');
  mkdirSync(DATA_DIR, { recursive: true }); writeFileSync(file, s);
  return s;
}
const SECRET = loadSecret();
const sign = payload => createHmac('sha256', SECRET).update(payload).digest('base64url');

export function createSession(userId) {
  const payload = `${userId}.${Date.now() + 1000 * 60 * 60 * 24 * 14}`;
  return payload + '.' + sign(payload);
}
function verifySession(token) {
  const [id, exp, mac] = token.split('.');
  if (!mac) return null;
  const a = Buffer.from(mac), b = Buffer.from(sign(`${id}.${exp}`));
  if (a.length !== b.length || !timingSafeEqual(a, b) || Number(exp) < Date.now()) return null;
  return Number(id);
}
export function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map(c => c.trim().split('=')).filter(p => p[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
}
export function sessionUser(req) {
  const token = parseCookies(req.headers.cookie).aftr_session;
  if (!token) return null;
  const userId = verifySession(token);
  if (!userId) return null;
  const u = get('SELECT id, email, name, avatar, city, theme, suspended FROM users WHERE id = ?', userId);
  if (!u || u.suspended) return null;
  u.roles = all('SELECT role FROM user_roles WHERE user_id = ?', u.id).map(r => r.role);
  u.token = token;
  run('UPDATE users SET last_active_at = ? WHERE id = ?', now(), u.id);
  return u;
}

export function requireRole(user, role) {
  if (!role) return;
  if (!user) fail(401, 'Connexion requise.');
  if (role !== 'user' && !user.roles.includes(role)) fail(403, "Cet espace n'est pas accessible avec ton compte.");
}

export async function readBody(req, limit = 2_000_000) {
  const chunks = []; let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) fail(413, 'Fichier ou contenu trop volumineux.');
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

export function sendJson(res, status, data, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(data));
}

// Notifications in-app (réelles, stockées en base)
export function notify(userId, kind, title, body, link) {
  run('INSERT INTO notifications (user_id, kind, title, body, link, created_at) VALUES (?, ?, ?, ?, ?, ?)', userId, kind, title, body ?? null, link ?? null, now());
}

// Validation minimale des champs de formulaire
export function str(v, { required = false, max = 2000, label = 'Champ' } = {}) {
  const s = (v ?? '').toString().trim();
  if (required && !s) fail(400, `${label} : ce champ est obligatoire.`);
  if (s.length > max) fail(400, `${label} : ${max} caractères maximum.`);
  return s || null;
}
export function int(v, { min = 0, max = 10_000_000, label = 'Nombre', required = false } = {}) {
  if (v === '' || v == null) { if (required) fail(400, `${label} : ce champ est obligatoire.`); return null; }
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < min || n > max) fail(400, `${label} : valeur invalide.`);
  return n;
}
export function oneOf(v, list, label = 'Valeur') {
  if (!list.includes(v)) fail(400, `${label} : valeur non reconnue.`);
  return v;
}
export function date(v, { required = false, label = 'Date' } = {}) {
  if (!v) { if (required) fail(400, `${label} : ce champ est obligatoire.`); return null; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) fail(400, `${label} : format de date invalide.`);
  return v;
}
