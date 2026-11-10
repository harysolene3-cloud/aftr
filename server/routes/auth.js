import { writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { get, all, run, insert, now, tx, J, UPLOAD_DIR } from '../db.js';
import { route, fail, hashPassword, checkPassword, createSession, notify, str, int, oneOf } from '../http.js';

const COOKIE = (token, maxAge) => `aftr_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
const THEME_COOKIE = t => `aftr_theme=${t}; Path=/; SameSite=Lax; Max-Age=31536000`;

export function slugify(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'dj';
}

export function me(userId) {
  const u = get('SELECT id, email, name, avatar, city, bio, theme, created_at FROM users WHERE id = ?', userId);
  u.roles = all('SELECT role FROM user_roles WHERE user_id = ?', userId).map(r => r.role);
  const dj = get('SELECT * FROM dj_profiles WHERE user_id = ?', userId);
  if (dj) u.dj = { ...dj, styles: J(dj.styles), event_types: J(dj.event_types), gallery: J(dj.gallery), tracks: J(dj.tracks), experiences: J(dj.experiences) };
  u.organizer = get('SELECT * FROM organizer_profiles WHERE user_id = ?', userId) || null;
  u.unread = get('SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND read = 0', userId).n;
  u.unreadMessages = get(`SELECT COUNT(*) n FROM messages m JOIN conversation_members cm ON cm.conversation_id = m.conversation_id
    WHERE cm.user_id = ? AND m.sender_id != ? AND (cm.last_read_at IS NULL OR m.created_at > cm.last_read_at)`, userId, userId).n;
  return u;
}

route('GET', '/api/me', ({ user }) => ({ user: user ? me(user.id) : null }));

route('POST', '/api/auth/login', ({ body, res }) => {
  const email = str(body.email, { required: true, label: 'E-mail' }).toLowerCase();
  const u = get('SELECT id, password_hash, suspended, theme FROM users WHERE email = ?', email);
  if (!u || !checkPassword(String(body.password || ''), u.password_hash)) fail(401, 'E-mail ou mot de passe incorrect.');
  if (u.suspended) fail(403, 'Ce compte est suspendu. Contacte le support AFTR.');
  const token = createSession(u.id);
  res.setHeader('Set-Cookie', [COOKIE(token, 1209600), THEME_COOKIE(u.theme)]);
  return { user: me(u.id) };
});

route('POST', '/api/auth/logout', ({ user, res }) => {
  if (user) run('DELETE FROM sessions WHERE token = ?', user.token);
  res.setHeader('Set-Cookie', COOKIE('', 0));
  return { ok: true };
});

route('POST', '/api/auth/signup', ({ body, res }) => {
  const name = str(body.name, { required: true, max: 80, label: 'Nom' });
  const email = str(body.email, { required: true, max: 160, label: 'E-mail' }).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail(400, 'E-mail : adresse invalide.');
  const password = String(body.password || '');
  if (password.length < 8) fail(400, 'Mot de passe : 8 caractères minimum.');
  const roles = (Array.isArray(body.roles) ? body.roles : []).filter(r => ['dj', 'organizer'].includes(r));
  if (!roles.length) fail(400, 'Choisis au moins un profil : DJ ou organisateur.');
  if (get('SELECT 1 FROM users WHERE email = ?', email)) fail(409, 'Un compte existe déjà avec cet e-mail.');
  const city = str(body.city, { max: 80 });
  const source = str(body.source, { max: 40 }) || 'Direct';
  const id = tx(() => {
    const id = insert('INSERT INTO users (email, password_hash, name, city, source, created_at, last_active_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      email, hashPassword(password), name, city, source, now(), now());
    for (const r of roles) run('INSERT INTO user_roles (user_id, role) VALUES (?, ?)', id, r);
    if (roles.includes('dj')) createDjProfile(id, str(body.stage_name, { max: 60 }) || name);
    if (roles.includes('organizer')) run('INSERT INTO organizer_profiles (user_id, org_name, org_type) VALUES (?, ?, ?)', id, str(body.org_name, { max: 80 }) || name, str(body.org_type, { max: 40 }));
    for (const r of roles) run('INSERT INTO subscriptions (user_id, plan, status, started_at) VALUES (?, ?, ?, ?)', id, r === 'dj' ? 'dj_free' : 'org_free', 'active', now());
    // Le CRM interne référence chaque nouvel utilisateur (données d'inscription uniquement)
    insert('INSERT INTO admin_contacts (user_id, name, email, city, segment, stage, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      id, name, email, city, roles.includes('dj') ? 'dj' : 'organizer', 'customer', source, now());
    notify(id, 'welcome', 'Bienvenue sur AFTR', 'Complète ton profil pour être visible dans la communauté et la marketplace.', '/app/parametres');
    return id;
  });
  const token = createSession(id);
  res.setHeader('Set-Cookie', [COOKIE(token, 1209600), THEME_COOKIE('auto')]);
  return { user: me(id) };
});

export function createDjProfile(userId, stageName) {
  let slug = slugify(stageName), i = 1;
  while (get('SELECT 1 FROM dj_profiles WHERE slug = ?', slug)) slug = slugify(stageName) + '-' + (++i);
  run('INSERT INTO dj_profiles (user_id, stage_name, slug) VALUES (?, ?, ?)', userId, stageName, slug);
}

route('PATCH', '/api/me/theme', ({ user, body, res }) => {
  const theme = oneOf(body.theme, ['auto', 'light', 'dark'], 'Thème');
  run('UPDATE users SET theme = ? WHERE id = ?', theme, user.id);
  res.setHeader('Set-Cookie', THEME_COOKIE(theme));
  return { theme };
}, { role: 'user' });

route('PATCH', '/api/me', ({ user, body }) => {
  const name = str(body.name, { required: true, max: 80, label: 'Nom' });
  run('UPDATE users SET name = ?, city = ?, bio = ?, avatar = COALESCE(?, avatar) WHERE id = ?',
    name, str(body.city, { max: 80 }), str(body.bio, { max: 600 }), str(body.avatar, { max: 300 }), user.id);
  return { user: me(user.id) };
}, { role: 'user' });

route('PATCH', '/api/me/dj', ({ user, body }) => {
  const list = (v, max = 12) => (Array.isArray(v) ? v : String(v || '').split(',')).map(s => String(s).trim()).filter(Boolean).slice(0, max);
  const tracks = (Array.isArray(body.tracks) ? body.tracks : []).slice(0, 8).map(t => ({ title: str(t.title, { max: 80 }), kind: str(t.kind, { max: 20 }), bpm: int(t.bpm, { max: 220 }), url: str(t.url, { max: 300 }) })).filter(t => t.title);
  run(`UPDATE dj_profiles SET stage_name = ?, styles = ?, event_types = ?, price_min = ?, price_max = ?, experience_years = ?,
       photo = COALESCE(?, photo), cover = COALESCE(?, cover), gallery = ?, tracks = ?, experiences = ?, marketplace_visible = ?,
       tagline = ?, instagram = ?, presskit_url = ?, booking_email = ?, mix_url = ? WHERE user_id = ?`,
    str(body.stage_name, { required: true, max: 60, label: 'Nom de scène' }), JSON.stringify(list(body.styles)), JSON.stringify(list(body.event_types)),
    int(body.price_min, { label: 'Tarif minimum' }), int(body.price_max, { label: 'Tarif maximum' }), int(body.experience_years, { max: 60, label: 'Expérience' }),
    str(body.photo, { max: 300 }), str(body.cover, { max: 300 }), JSON.stringify(list(body.gallery, 12)), JSON.stringify(tracks), JSON.stringify(list(body.experiences, 10)),
    body.marketplace_visible ? 1 : 0, str(body.tagline, { max: 300 }), str(body.instagram, { max: 80 }), str(body.presskit_url, { max: 300 }), str(body.booking_email, { max: 160 }), str(body.mix_url, { max: 300 }), user.id);
  return { user: me(user.id) };
}, { role: 'dj' });

route('PATCH', '/api/me/organizer', ({ user, body }) => {
  run('UPDATE organizer_profiles SET org_name = ?, org_type = ?, description = ?, photo = COALESCE(?, photo) WHERE user_id = ?',
    str(body.org_name, { required: true, max: 80, label: "Nom de l'organisation" }), str(body.org_type, { max: 40 }), str(body.description, { max: 600 }), str(body.photo, { max: 300 }), user.id);
  return { user: me(user.id) };
}, { role: 'organizer' });

// Un utilisateur peut activer un second rôle (DJ ↔ organisateur)
route('POST', '/api/me/roles', ({ user, body }) => {
  const role = oneOf(body.role, ['dj', 'organizer'], 'Rôle');
  if (user.roles.includes(role)) return { user: me(user.id) };
  tx(() => {
    run('INSERT INTO user_roles (user_id, role) VALUES (?, ?)', user.id, role);
    if (role === 'dj' && !get('SELECT 1 FROM dj_profiles WHERE user_id = ?', user.id)) createDjProfile(user.id, user.name);
    if (role === 'organizer' && !get('SELECT 1 FROM organizer_profiles WHERE user_id = ?', user.id)) run('INSERT INTO organizer_profiles (user_id, org_name) VALUES (?, ?)', user.id, user.name);
    run('INSERT INTO subscriptions (user_id, plan, status, started_at) VALUES (?, ?, ?, ?)', user.id, role === 'dj' ? 'dj_free' : 'org_free', 'active', now());
  });
  return { user: me(user.id) };
}, { role: 'user' });

// Envoi de fichiers (photos, vidéos, audio, clips). Corps brut, nom dans l'en-tête.
const ALLOWED = { '.jpg': 'image', '.jpeg': 'image', '.png': 'image', '.webp': 'image', '.mp4': 'video', '.webm': 'video', '.mp3': 'audio', '.m4a': 'audio', '.wav': 'audio' };
route('POST', '/api/uploads', async ({ req, body }) => {
  const name = decodeURIComponent(req.headers['x-filename'] || 'fichier');
  const ext = extname(name).toLowerCase();
  if (!ALLOWED[ext]) fail(400, 'Format non accepté. Formats autorisés : JPG, PNG, WebP, MP4, WebM, MP3, M4A, WAV.');
  if (!body.length) fail(400, 'Fichier vide.');
  const file = randomBytes(12).toString('hex') + ext;
  await writeFile(join(UPLOAD_DIR, file), body);
  return { url: '/uploads/' + file, kind: ALLOWED[ext], size: body.length };
}, { role: 'user', raw: true });

// ───────── Notifications
route('GET', '/api/notifications', ({ user }) =>
  ({ items: all('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 60', user.id) }), { role: 'user' });
route('POST', '/api/notifications/read', ({ user, body }) => {
  if (body.id) run('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?', body.id, user.id);
  else run('UPDATE notifications SET read = 1 WHERE user_id = ?', user.id);
  return { ok: true };
}, { role: 'user' });
