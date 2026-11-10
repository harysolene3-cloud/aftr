// AFTR Admin. Ce fichier ne lit JAMAIS les tables studio_* (CRM personnels des DJs, devis, factures).
// Le CRM interne repose uniquement sur l'activité professionnelle des membres sur la plateforme.
import { get, all, run, insert, now, J, tx, today, addDays, openDb } from '../db.js';
import { route, fail, notify, str, int, date, oneOf } from '../http.js';
import { seed } from '../seed.js';
import { STATUS_LABEL } from './marketplace.js';

const opt = { role: 'admin' };
export const PLANS = { dj_free: { label: 'DJ Free', price: 0 }, dj_pro: { label: 'DJ Pro', price: 12 }, org_free: { label: 'Organisateur Free', price: 0 }, org_plus: { label: 'Organisateur Plus', price: 29 } };
export const COMMISSION = 0.08;
const CRM_STAGES = ['lead', 'contacted', 'demo', 'negotiation', 'customer', 'lost'];
const SEGMENTS = ['dj', 'organizer', 'venue', 'partner', 'press'];

function log(user, action, detail) { insert('INSERT INTO audit_log (admin_id, action, detail, created_at) VALUES (?, ?, ?, ?)', user.id, action, detail ?? null, now()); }

function userSummary(id) {
  const u = get('SELECT id, name, email, city, avatar, source, created_at, last_active_at, suspended FROM users WHERE id = ?', id);
  if (!u) return null;
  u.roles = all('SELECT role FROM user_roles WHERE user_id = ?', id).map(r => r.role);
  u.dj = get('SELECT stage_name, slug, photo, styles, price_min FROM dj_profiles WHERE user_id = ?', id) || null;
  if (u.dj) u.dj.styles = J(u.dj.styles);
  u.organizer = get('SELECT org_name, org_type, photo FROM organizer_profiles WHERE user_id = ?', id) || null;
  u.plans = all('SELECT plan, status FROM subscriptions WHERE user_id = ?', id);
  return u;
}

export function profileCompleteness(userId) {
  const d = get('SELECT d.*, u.bio, u.city FROM dj_profiles d JOIN users u ON u.id = d.user_id WHERE d.user_id = ?', userId);
  if (!d) return null;
  const checks = [d.photo, d.bio, d.city, J(d.styles).length, d.price_min, J(d.tracks).length, J(d.gallery).length, J(d.event_types).length];
  return Math.round(checks.filter(Boolean).length / checks.length * 100);
}

// ───────── Vue d'ensemble
route('GET', '/api/admin/overview', () => {
  const d30 = addDays(today(), -30);
  const confirmed = all("SELECT budget, quote_amount FROM booking_requests WHERE status IN ('confirmed','completed')");
  const gmv = confirmed.reduce((s, r) => s + (r.quote_amount || r.budget || 0), 0);
  return {
    users: get('SELECT COUNT(*) n FROM users').n,
    new_30: get('SELECT COUNT(*) n FROM users WHERE created_at >= ?', d30).n,
    active_30: get('SELECT COUNT(*) n FROM users WHERE last_active_at >= ?', d30).n,
    djs: get("SELECT COUNT(*) n FROM user_roles WHERE role = 'dj'").n,
    organizers: get("SELECT COUNT(*) n FROM user_roles WHERE role = 'organizer'").n,
    requests_open: get("SELECT COUNT(*) n FROM booking_requests WHERE status IN ('pending','quoted')").n,
    bookings_confirmed: confirmed.length,
    gmv, commission: Math.round(gmv * COMMISSION),
    mrr: all("SELECT plan FROM subscriptions WHERE status = 'active'").reduce((s, r) => s + PLANS[r.plan].price, 0),
    tickets_open: get("SELECT COUNT(*) n FROM support_tickets WHERE status != 'resolved'").n,
    reports_open: get("SELECT COUNT(*) n FROM reports WHERE status = 'open'").n,
    tasks: all(`SELECT t.*, c.name contact FROM admin_tasks t LEFT JOIN admin_contacts c ON c.id = t.contact_id WHERE t.done = 0 ORDER BY t.due_date LIMIT 6`),
    latest_users: all('SELECT id FROM users ORDER BY created_at DESC LIMIT 5').map(r => userSummary(r.id)),
    latest_requests: all('SELECT r.id, r.event_title, r.date, r.status, d.stage_name, o.org_name FROM booking_requests r JOIN dj_profiles d ON d.user_id = r.dj_id JOIN organizer_profiles o ON o.user_id = r.organizer_id ORDER BY r.updated_at DESC LIMIT 6')
      .map(r => ({ ...r, status_label: STATUS_LABEL[r.status] })),
  };
}, opt);

// ───────── CRM central
function contactRow(c) {
  const u = c.user_id ? userSummary(c.user_id) : null;
  const company = c.company_id ? get('SELECT id, name FROM admin_companies WHERE id = ?', c.company_id) : null;
  const requests = c.user_id ? get('SELECT COUNT(*) n FROM booking_requests WHERE dj_id = ? OR organizer_id = ?', c.user_id, c.user_id).n : 0;
  return { ...c, tags: J(c.tags), user: u, company, requests, avatar: u?.dj?.photo || u?.organizer?.photo || u?.avatar || null, last_active_at: u?.last_active_at || null };
}

function filteredContacts(query) {
  let sql = 'SELECT * FROM admin_contacts WHERE 1 = 1', p = [];
  if (query.q) { sql += ' AND (name LIKE ? OR email LIKE ? OR city LIKE ? OR tags LIKE ?)'; const q = `%${query.q}%`; p.push(q, q, q, q); }
  if (query.segment) { sql += ' AND segment = ?'; p.push(query.segment); }
  if (query.stage) { sql += ' AND stage = ?'; p.push(query.stage); }
  if (query.source) { sql += ' AND source = ?'; p.push(query.source); }
  if (query.city) { sql += ' AND city = ?'; p.push(query.city); }
  sql += ' ORDER BY created_at DESC';
  let rows = all(sql, ...p).map(contactRow);
  if (query.activity === 'inactive') rows = rows.filter(c => c.user && (!c.last_active_at || c.last_active_at < addDays(today(), -30)));
  if (query.activity === 'active') rows = rows.filter(c => c.last_active_at && c.last_active_at >= addDays(today(), -30));
  if (query.plan) rows = rows.filter(c => c.user?.plans.some(pl => pl.plan === query.plan));
  return rows;
}

route('GET', '/api/admin/contacts', ({ query }) => ({
  items: filteredContacts(query),
  facets: {
    sources: all('SELECT DISTINCT source FROM admin_contacts WHERE source IS NOT NULL ORDER BY source').map(r => r.source),
    cities: all('SELECT DISTINCT city FROM admin_contacts WHERE city IS NOT NULL ORDER BY city').map(r => r.city),
  },
  pipeline: Object.fromEntries(CRM_STAGES.map(s => [s, get('SELECT COUNT(*) n FROM admin_contacts WHERE stage = ?', s).n])),
}), opt);

route('GET', '/api/admin/contacts/:id', ({ params }) => {
  const c = get('SELECT * FROM admin_contacts WHERE id = ?', params.id) || fail(404, 'Contact introuvable.');
  const row = contactRow(c);
  // Vue « plateforme » : uniquement les interactions professionnelles avec AFTR
  if (c.user_id) {
    const uid = c.user_id;
    row.platform = {
      completeness: profileCompleteness(uid),
      requests: all(`SELECT r.id, r.event_title, r.date, r.status, r.budget, r.quote_amount, r.dj_id = ? as as_dj, d.stage_name, o.org_name
        FROM booking_requests r JOIN dj_profiles d ON d.user_id = r.dj_id JOIN organizer_profiles o ON o.user_id = r.organizer_id WHERE r.dj_id = ? OR r.organizer_id = ? ORDER BY r.date DESC`, uid, uid, uid)
        .map(r => ({ ...r, status_label: STATUS_LABEL[r.status] })),
      events: get('SELECT COUNT(*) n FROM events WHERE organizer_id = ?', uid).n,
      posts: get('SELECT COUNT(*) n FROM posts WHERE author_id = ?', uid).n,
      followers: get('SELECT COUNT(*) n FROM follows WHERE followee_id = ?', uid).n,
      reviews: get('SELECT COUNT(*) n, AVG(rating) avg FROM reviews WHERE dj_id = ?', uid),
      reports_received: get('SELECT COUNT(*) n FROM reports r JOIN posts p ON p.id = r.post_id WHERE p.author_id = ?', uid).n,
      tickets: all('SELECT id, subject, status, created_at FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC', uid),
    };
  }
  row.interactions = all('SELECT i.*, u.name admin FROM admin_interactions i LEFT JOIN users u ON u.id = i.admin_id WHERE contact_id = ? ORDER BY created_at DESC', c.id);
  row.tasks = all('SELECT * FROM admin_tasks WHERE contact_id = ? ORDER BY done, due_date', c.id);
  row.campaigns = all("SELECT id, to_email, subject, created_at FROM outbox WHERE to_email = ? ORDER BY created_at DESC LIMIT 10", c.email || '');
  return { contact: row };
}, opt);

const contactFields = body => [
  str(body.name, { required: true, max: 120, label: 'Nom' }), str(body.email, { max: 160 }), str(body.phone, { max: 40 }), str(body.city, { max: 80 }),
  oneOf(body.segment || 'organizer', SEGMENTS, 'Segment'), oneOf(body.stage || 'lead', CRM_STAGES, 'Étape'), str(body.source, { max: 60 }),
  JSON.stringify((Array.isArray(body.tags) ? body.tags : String(body.tags || '').split(',')).map(s => s.trim()).filter(Boolean).slice(0, 10)),
  str(body.notes, { max: 3000 }), body.company_id ? Number(body.company_id) : null,
];
route('POST', '/api/admin/contacts', ({ user, body }) => {
  const id = insert('INSERT INTO admin_contacts (name, email, phone, city, segment, stage, source, tags, notes, company_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', ...contactFields(body), now());
  log(user, 'crm.contact.create', body.name);
  return { id };
}, opt);
route('PATCH', '/api/admin/contacts/:id', ({ user, params, body }) => {
  const c = get('SELECT * FROM admin_contacts WHERE id = ?', params.id) || fail(404, 'Contact introuvable.');
  run('UPDATE admin_contacts SET name = ?, email = ?, phone = ?, city = ?, segment = ?, stage = ?, source = ?, tags = ?, notes = ?, company_id = ? WHERE id = ?',
    ...contactFields({ ...c, tags: J(c.tags), ...body }), c.id);
  if (body.stage && body.stage !== c.stage) insert('INSERT INTO admin_interactions (contact_id, admin_id, kind, body, created_at) VALUES (?, ?, ?, ?, ?)', c.id, user.id, 'stage', `Étape : ${body.stage}`, now());
  return { ok: true };
}, opt);
route('DELETE', '/api/admin/contacts/:id', ({ user, params }) => {
  const c = get('SELECT * FROM admin_contacts WHERE id = ?', params.id) || fail(404, 'Contact introuvable.');
  if (c.user_id) fail(400, 'Ce contact correspond à un compte membre : il ne peut pas être supprimé du CRM.');
  run('DELETE FROM admin_contacts WHERE id = ?', c.id); log(user, 'crm.contact.delete', c.name); return { ok: true };
}, opt);
route('POST', '/api/admin/contacts/:id/interactions', ({ user, params, body }) => {
  get('SELECT 1 FROM admin_contacts WHERE id = ?', params.id) || fail(404, 'Contact introuvable.');
  insert('INSERT INTO admin_interactions (contact_id, admin_id, kind, body, created_at) VALUES (?, ?, ?, ?, ?)', params.id, user.id,
    oneOf(body.kind || 'note', ['note', 'call', 'email', 'meeting'], 'Type'), str(body.body, { required: true, max: 2000, label: 'Contenu' }), now());
  return { ok: true };
}, opt);

// Tâches et rappels de l'équipe
route('GET', '/api/admin/tasks', () => ({ items: all('SELECT t.*, c.name contact FROM admin_tasks t LEFT JOIN admin_contacts c ON c.id = t.contact_id ORDER BY t.done, t.due_date') }), opt);
route('POST', '/api/admin/tasks', ({ body }) => ({ id: insert('INSERT INTO admin_tasks (contact_id, title, due_date, created_at) VALUES (?, ?, ?, ?)', body.contact_id || null, str(body.title, { required: true, max: 200, label: 'Tâche' }), date(body.due_date), now()) }), opt);
route('PATCH', '/api/admin/tasks/:id', ({ params, body }) => { run('UPDATE admin_tasks SET done = ? WHERE id = ?', body.done ? 1 : 0, params.id); return { ok: true }; }, opt);

// Entreprises
route('GET', '/api/admin/companies', () => ({
  items: all('SELECT c.*, (SELECT COUNT(*) FROM admin_contacts WHERE company_id = c.id) contacts FROM admin_companies c ORDER BY name'),
}), opt);
route('POST', '/api/admin/companies', ({ body }) => ({
  id: insert('INSERT INTO admin_companies (name, kind, city, website, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    str(body.name, { required: true, max: 120, label: 'Nom' }), str(body.kind, { max: 60 }), str(body.city, { max: 80 }), str(body.website, { max: 200 }), str(body.notes, { max: 2000 }), now()),
}), opt);
route('GET', '/api/admin/companies/:id', ({ params }) => {
  const c = get('SELECT * FROM admin_companies WHERE id = ?', params.id) || fail(404, 'Entreprise introuvable.');
  return { company: { ...c, contacts: all('SELECT * FROM admin_contacts WHERE company_id = ?', c.id).map(contactRow) } };
}, opt);

// Export / import CSV
const csvCell = v => { const s = v == null ? '' : String(v); return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
route('GET', '/api/admin/contacts.csv', ({ query, res }) => {
  const rows = filteredContacts(query);
  const head = ['nom', 'email', 'telephone', 'ville', 'segment', 'etape', 'source', 'tags', 'entreprise', 'compte_membre', 'derniere_activite'];
  const csv = '﻿' + [head.join(';'), ...rows.map(c => [c.name, c.email, c.phone, c.city, c.segment, c.stage, c.source, c.tags.join(','), c.company?.name, c.user_id ? 'oui' : 'non', c.last_active_at?.slice(0, 10)].map(csvCell).join(';'))].join('\n');
  res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="aftr-crm-${today()}.csv"` });
  res.end(csv);
}, opt);

export function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  text = text.replace(/^﻿/, '');
  const sep = (text.split('\n')[0].match(/;/g) || []).length >= (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim()));
}
route('POST', '/api/admin/contacts/import', ({ user, body }) => {
  const rows = parseCsv(String(body.csv || ''));
  if (rows.length < 2) fail(400, "Le fichier ne contient pas de lignes à importer. La première ligne doit contenir les en-têtes (nom, email, ...).");
  const head = rows[0].map(h => h.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''));
  const col = (...names) => head.findIndex(h => names.includes(h));
  const iName = col('nom', 'name'); if (iName < 0) fail(400, 'Colonne « nom » introuvable.');
  const iEmail = col('email', 'e-mail', 'mail'), iCity = col('ville', 'city'), iSeg = col('segment'), iSrc = col('source'), iPhone = col('telephone', 'phone'), iTags = col('tags');
  let created = 0, skipped = 0;
  tx(() => {
    for (const r of rows.slice(1)) {
      const name = r[iName]?.trim(); if (!name) { skipped++; continue; }
      const email = iEmail >= 0 ? r[iEmail]?.trim() || null : null;
      if (email && get('SELECT 1 FROM admin_contacts WHERE email = ?', email)) { skipped++; continue; }
      const seg = iSeg >= 0 && SEGMENTS.includes(r[iSeg]?.trim()) ? r[iSeg].trim() : 'organizer';
      insert('INSERT INTO admin_contacts (name, email, phone, city, segment, stage, source, tags, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        name.slice(0, 120), email, iPhone >= 0 ? r[iPhone] || null : null, iCity >= 0 ? r[iCity] || null : null, seg, 'lead', iSrc >= 0 ? r[iSrc] || 'Import CSV' : 'Import CSV',
        JSON.stringify(iTags >= 0 ? (r[iTags] || '').split(',').map(s => s.trim()).filter(Boolean) : []), now());
      created++;
    }
  });
  log(user, 'crm.import', `${created} contacts`);
  return { created, skipped };
}, opt);

// Recherche globale
route('GET', '/api/admin/search', ({ query }) => {
  const q = `%${(query.q || '').trim()}%`;
  if ((query.q || '').trim().length < 2) return { results: [] };
  return { results: [
    ...all('SELECT id, name, email, segment FROM admin_contacts WHERE name LIKE ? OR email LIKE ? LIMIT 8', q, q).map(r => ({ type: 'Contact', label: r.name, sub: r.email || r.segment, link: `/app/admin/crm/${r.id}` })),
    ...all('SELECT id, name, city FROM admin_companies WHERE name LIKE ? LIMIT 5', q).map(r => ({ type: 'Entreprise', label: r.name, sub: r.city, link: `/app/admin/entreprises/${r.id}` })),
    ...all('SELECT id, event_title, date, status FROM booking_requests WHERE event_title LIKE ? OR city LIKE ? LIMIT 6', q, q).map(r => ({ type: 'Booking', label: r.event_title, sub: `${r.date} · ${STATUS_LABEL[r.status]}`, link: `/app/admin/bookings?id=${r.id}` })),
    ...all('SELECT id, subject, status FROM support_tickets WHERE subject LIKE ? OR email LIKE ? LIMIT 5', q, q).map(r => ({ type: 'Ticket', label: r.subject, sub: r.status, link: `/app/admin/support/${r.id}` })),
    ...all('SELECT id, subject, status FROM newsletters WHERE subject LIKE ? LIMIT 4', q).map(r => ({ type: 'Newsletter', label: r.subject, sub: r.status, link: `/app/admin/marketing/newsletters?id=${r.id}` })),
  ] };
}, opt);

// ───────── Utilisateurs
route('GET', '/api/admin/users', ({ query }) => {
  let rows = all('SELECT id FROM users ORDER BY created_at DESC').map(r => userSummary(r.id));
  if (query.role) rows = rows.filter(u => u.roles.includes(query.role));
  if (query.q) { const q = query.q.toLowerCase(); rows = rows.filter(u => [u.name, u.email, u.city, u.dj?.stage_name, u.organizer?.org_name].some(v => v?.toLowerCase().includes(q))); }
  return { items: rows.map(u => ({ ...u, completeness: profileCompleteness(u.id) })) };
}, opt);
route('PATCH', '/api/admin/users/:id', ({ user, params, body }) => {
  const id = Number(params.id);
  const u = get('SELECT id, name FROM users WHERE id = ?', id) || fail(404, 'Utilisateur introuvable.');
  if (body.suspended !== undefined) {
    if (id === user.id) fail(400, 'Tu ne peux pas suspendre ton propre compte.');
    run('UPDATE users SET suspended = ? WHERE id = ?', body.suspended ? 1 : 0, id);
    if (body.suspended) run('DELETE FROM sessions WHERE user_id = ?', id);
    log(user, body.suspended ? 'user.suspend' : 'user.unsuspend', u.name);
  }
  if (Array.isArray(body.roles)) {
    const roles = body.roles.filter(r => ['dj', 'organizer', 'admin'].includes(r));
    if (!roles.length) fail(400, 'Un compte doit garder au moins un rôle.');
    if (id === user.id && !roles.includes('admin')) fail(400, 'Tu ne peux pas retirer ton propre rôle administrateur.');
    tx(() => {
      run('DELETE FROM user_roles WHERE user_id = ?', id);
      for (const r of roles) run('INSERT INTO user_roles (user_id, role) VALUES (?, ?)', id, r);
      if (roles.includes('dj') && !get('SELECT 1 FROM dj_profiles WHERE user_id = ?', id)) run('INSERT INTO dj_profiles (user_id, stage_name, slug) VALUES (?, ?, ?)', id, u.name, 'dj-' + id);
      if (roles.includes('organizer') && !get('SELECT 1 FROM organizer_profiles WHERE user_id = ?', id)) run('INSERT INTO organizer_profiles (user_id, org_name) VALUES (?, ?)', id, u.name);
    });
    log(user, 'user.roles', `${u.name} : ${roles.join(', ')}`);
  }
  return { ok: true };
}, opt);

// ───────── Bookings, transactions et commissions (données marketplace)
route('GET', '/api/admin/bookings', ({ query }) => {
  let sql = `SELECT r.*, d.stage_name, d.photo dj_photo, o.org_name FROM booking_requests r JOIN dj_profiles d ON d.user_id = r.dj_id JOIN organizer_profiles o ON o.user_id = r.organizer_id`;
  const p = [];
  if (query.status) { sql += ' WHERE r.status = ?'; p.push(query.status); }
  const items = all(sql + ' ORDER BY r.date DESC', ...p).map(r => ({ ...r, status_label: STATUS_LABEL[r.status], amount: r.quote_amount || r.budget || 0,
    commission: ['confirmed', 'completed'].includes(r.status) ? Math.round((r.quote_amount || r.budget || 0) * COMMISSION) : 0,
    history: all('SELECT status, note, created_at FROM booking_history WHERE request_id = ? ORDER BY created_at', r.id) }));
  const counts = Object.fromEntries(Object.keys(STATUS_LABEL).map(s => [s, get('SELECT COUNT(*) n FROM booking_requests WHERE status = ?', s).n]));
  return { items, counts, commission_rate: COMMISSION };
}, opt);

// ───────── Abonnements (paiement non activé : aucun prélèvement réel)
route('GET', '/api/admin/subscriptions', () => {
  const items = all('SELECT s.*, u.name, u.email FROM subscriptions s JOIN users u ON u.id = s.user_id ORDER BY s.started_at DESC').map(s => ({ ...s, plan_label: PLANS[s.plan].label, price: PLANS[s.plan].price }));
  return { items, plans: PLANS, mrr: items.filter(s => s.status === 'active').reduce((sum, s) => sum + s.price, 0),
    by_plan: Object.fromEntries(Object.keys(PLANS).map(k => [k, items.filter(s => s.plan === k && s.status === 'active').length])) };
}, opt);
route('PATCH', '/api/admin/subscriptions/:id', ({ user, params, body }) => {
  const s = get('SELECT * FROM subscriptions WHERE id = ?', params.id) || fail(404, 'Abonnement introuvable.');
  const plan = oneOf(body.plan || s.plan, Object.keys(PLANS), 'Formule'), status = oneOf(body.status || s.status, ['active', 'trial', 'cancelled'], 'Statut');
  run('UPDATE subscriptions SET plan = ?, status = ? WHERE id = ?', plan, status, s.id);
  log(user, 'subscription.update', `#${s.id} ${plan} ${status}`);
  return { ok: true };
}, opt);

// ───────── Support
route('GET', '/api/admin/tickets', () => ({
  items: all('SELECT t.*, (SELECT COUNT(*) FROM ticket_messages WHERE ticket_id = t.id) messages FROM support_tickets t ORDER BY CASE status WHEN \'open\' THEN 0 WHEN \'pending\' THEN 1 ELSE 2 END, created_at DESC'),
}), opt);
route('GET', '/api/admin/tickets/:id', ({ params }) => {
  const t = get('SELECT * FROM support_tickets WHERE id = ?', params.id) || fail(404, 'Ticket introuvable.');
  return { ticket: { ...t, messages: all('SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at', t.id), contact: get('SELECT id FROM admin_contacts WHERE email = ? OR (user_id IS NOT NULL AND user_id = ?)', t.email || '', t.user_id ?? -1) } };
}, opt);
route('POST', '/api/admin/tickets/:id/reply', ({ user, params, body }) => {
  const t = get('SELECT * FROM support_tickets WHERE id = ?', params.id) || fail(404, 'Ticket introuvable.');
  const text = str(body.body, { required: true, max: 3000, label: 'Réponse' });
  tx(() => {
    insert('INSERT INTO ticket_messages (ticket_id, author, body, created_at) VALUES (?, ?, ?, ?)', t.id, 'aftr', text, now());
    run("UPDATE support_tickets SET status = 'pending' WHERE id = ? AND status = 'open'", t.id);
    // Membre : notification in-app réelle. Visiteur : e-mail placé dans la boîte d'envoi interne (non envoyé).
    if (t.user_id) notify(t.user_id, 'support', 'Réponse du support AFTR', t.subject, '/app/notifications');
    if (t.email) insert('INSERT INTO outbox (to_email, subject, body, origin, created_at) VALUES (?, ?, ?, ?, ?)', t.email, `Re : ${t.subject}`, text, 'support', now());
  });
  return { ok: true };
}, opt);
route('PATCH', '/api/admin/tickets/:id', ({ params, body }) => {
  run('UPDATE support_tickets SET status = COALESCE(?, status), priority = COALESCE(?, priority) WHERE id = ?',
    body.status ? oneOf(body.status, ['open', 'pending', 'resolved'], 'Statut') : null, body.priority ? oneOf(body.priority, ['low', 'normal', 'high'], 'Priorité') : null, params.id);
  return { ok: true };
}, opt);

// ───────── Modération
route('GET', '/api/admin/reports', () => ({
  items: all(`SELECT r.*, p.body post_body, p.media, p.hidden, p.kind, u.name author, ru.name reporter FROM reports r JOIN posts p ON p.id = r.post_id
    JOIN users u ON u.id = p.author_id JOIN users ru ON ru.id = r.reporter_id ORDER BY r.status = 'open' DESC, r.created_at DESC`).map(r => ({ ...r, media: J(r.media) })),
}), opt);
route('PATCH', '/api/admin/reports/:id', ({ user, params, body }) => {
  const r = get('SELECT * FROM reports WHERE id = ?', params.id) || fail(404, 'Signalement introuvable.');
  const decision = oneOf(body.decision, ['dismissed', 'removed'], 'Décision');
  tx(() => {
    run('UPDATE reports SET status = ? WHERE post_id = ? AND status = \'open\'', decision, r.post_id);
    if (decision === 'removed') {
      run('UPDATE posts SET hidden = 1 WHERE id = ?', r.post_id);
      const p = get('SELECT author_id FROM posts WHERE id = ?', r.post_id);
      notify(p.author_id, 'moderation', 'Une de tes publications a été retirée', `Motif : ${r.reason}. Consulte les règles de la communauté.`, '/app/fil');
    }
  });
  log(user, 'moderation.' + decision, `post #${r.post_id}`);
  return { ok: true };
}, opt);

// ───────── Boîte d'envoi interne
route('GET', '/api/admin/outbox', () => ({ items: all('SELECT * FROM outbox ORDER BY created_at DESC LIMIT 200') }), opt);

// ───────── Réinitialisation de la démonstration
route('POST', '/api/admin/demo/reset', ({ res }) => {
  openDb({ fresh: true });
  seed();
  res.setHeader('Set-Cookie', 'aftr_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  return { ok: true };
}, opt);
