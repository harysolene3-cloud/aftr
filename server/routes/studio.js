// DJ Business Studio. Toutes les requêtes sont filtrées par owner_id = utilisateur connecté :
// un DJ ne voit que ses propres données, et aucun administrateur n'y a accès.
import { get, all, run, insert, now, J, tx, today, addDays } from '../db.js';
import { route, fail, str, int, date, oneOf } from '../http.js';
import { documentPdf, totals } from '../pdf.js';

export const STAGES = ['new', 'to_contact', 'contacted', 'waiting', 'follow_up', 'quote_sent', 'negotiation', 'won', 'lost'];
const opt = { role: 'dj' };

export function nextNumber(prefix, ownerId) {
  const table = prefix === 'DEV' ? 'studio_quotes' : 'studio_invoices';
  const year = new Date().getFullYear();
  const last = get(`SELECT number FROM ${table} WHERE owner_id = ? AND number LIKE ? ORDER BY number DESC LIMIT 1`, ownerId, `${prefix}-${year}-%`);
  const n = last ? Number(last.number.split('-')[2]) + 1 : 1;
  return `${prefix}-${year}-${String(n).padStart(3, '0')}`;
}
const own = (table, id, userId) => get(`SELECT * FROM ${table} WHERE id = ? AND owner_id = ?`, id, userId) || fail(404, 'Élément introuvable.');

// ───────── Tableau de bord
route('GET', '/api/studio/overview', ({ user }) => {
  refreshOverdue(user.id);
  const reqs = all('SELECT * FROM booking_requests WHERE dj_id = ?', user.id);
  const t = today(), month = t.slice(0, 7);
  const gigs = all("SELECT * FROM studio_gigs WHERE owner_id = ? AND status != 'cancelled'", user.id);
  // Prochaines dates : bookings AFTR confirmés + dates hors plateforme confirmées ou en option
  const upcoming = [
    ...reqs.filter(r => r.status === 'confirmed' && r.date >= t).map(r => ({ ...r, kind: 'aftr', organizer: get('SELECT org_name, photo FROM organizer_profiles WHERE user_id = ?', r.organizer_id) })),
    ...gigs.filter(g => g.date >= t && g.status !== 'done').map(g => ({ ...g, kind: 'gig' })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const inv = invoicesWithTotals(user.id);
  // Chiffre d'affaires du mois : réalisé (dates passées) et prévu (dates à venir)
  const monthItems = [
    ...reqs.filter(r => ['confirmed', 'completed'].includes(r.status) && r.date.startsWith(month)).map(r => ({ date: r.date, amount: r.quote_amount || r.budget || 0 })),
    ...gigs.filter(g => ['confirmed', 'done'].includes(g.status) && g.date.startsWith(month)).map(g => ({ date: g.date, amount: g.fee || 0 })),
  ];
  const settings = get('SELECT monthly_goal FROM studio_settings WHERE owner_id = ?', user.id) || {};
  const reminders = [
    ...upcoming.filter(x => x.date === t).map(x => ({ kind: 'tonight', label: `Ce soir : ${x.title || x.event_title}`, link: x.kind === 'gig' ? `/app/studio/reservations?gig=${x.id}` : `/app/reservations/${x.id}` })),
    ...upcoming.filter(x => x.date === addDays(t, 1)).map(x => ({ kind: 'tomorrow', label: `Demain : ${x.title || x.event_title}`, link: x.kind === 'gig' ? `/app/studio/reservations?gig=${x.id}` : `/app/reservations/${x.id}` })),
  ];
  const toSend = inv.filter(i => i.status === 'draft' && i.event_date && i.event_date < t);
  if (toSend.length) reminders.push({ kind: 'invoice', label: `${toSend.length} facture${toSend.length > 1 ? 's' : ''} à envoyer`, link: '/app/studio/factures' });
  const late = inv.filter(i => i.status === 'overdue');
  if (late.length) reminders.push({ kind: 'late', hot: true, label: `${late.length} facture${late.length > 1 ? 's' : ''} en retard`, link: '/app/studio/factures' });
  const relance = get("SELECT COUNT(*) n FROM studio_contacts WHERE owner_id = ? AND stage = 'follow_up'", user.id).n;
  if (relance) reminders.push({ kind: 'prospect', label: `${relance} orga${relance > 1 ? 's' : ''} à relancer`, link: '/app/studio/crm' });
  return {
    reminders,
    month: { label: month, real: monthItems.filter(x => x.date < t).reduce((a, x) => a + x.amount, 0), planned: monthItems.filter(x => x.date >= t).reduce((a, x) => a + x.amount, 0), goal: settings.monthly_goal || null },
    pending: reqs.filter(r => r.status === 'pending').map(r => ({ ...r, organizer: get('SELECT org_name, photo FROM organizer_profiles WHERE user_id = ?', r.organizer_id) })),
    upcoming: upcoming.slice(0, 5),
    tasks: all(`SELECT t.*, c.name contact FROM studio_tasks t LEFT JOIN studio_contacts c ON c.id = t.contact_id WHERE t.owner_id = ? AND t.done = 0 ORDER BY t.due_date LIMIT 6`, user.id),
    follow_ups: all(`SELECT id, name, company, stage, next_follow_up FROM studio_contacts WHERE owner_id = ? AND next_follow_up IS NOT NULL AND next_follow_up <= ? AND stage NOT IN ('won','lost') ORDER BY next_follow_up`, user.id, addDays(today(), 3)),
    money: {
      paid_month: inv.filter(i => i.status === 'paid' && (i.paid_at || '').startsWith(month)).reduce((s, i) => s + i.ttc, 0),
      waiting: inv.filter(i => ['sent', 'overdue'].includes(i.status)).reduce((s, i) => s + i.ttc, 0),
      overdue: inv.filter(i => i.status === 'overdue').length,
      confirmed_value: upcoming.filter(x => x.kind === 'aftr' || x.status === 'confirmed').reduce((s, r) => s + (r.quote_amount || r.budget || r.fee || 0), 0),
    },
    pipeline: Object.fromEntries(STAGES.map(s => [s, get('SELECT COUNT(*) n FROM studio_contacts WHERE owner_id = ? AND stage = ?', user.id, s).n])),
  };
}, opt);

// ───────── CRM personnel
route('GET', '/api/studio/contacts', ({ user, query }) => {
  const q = `%${(query.q || '').trim()}%`;
  let rows = all(`SELECT c.*, (SELECT COUNT(*) FROM studio_tasks t WHERE t.contact_id = c.id AND t.done = 0) open_tasks
    FROM studio_contacts c WHERE owner_id = ? AND (name LIKE ? OR company LIKE ? OR city LIKE ? OR tags LIKE ?) ORDER BY updated_at DESC`, user.id, q, q, q, q)
    .map(c => ({ ...c, tags: J(c.tags) }));
  if (query.tag) rows = rows.filter(c => c.tags.includes(query.tag));
  return { items: rows, tags: [...new Set(all('SELECT tags FROM studio_contacts WHERE owner_id = ?', user.id).flatMap(r => J(r.tags)))].sort() };
}, opt);

const contactFields = body => [
  str(body.name, { required: true, max: 100, label: 'Nom' }), str(body.company, { max: 100 }), str(body.job, { max: 80 }),
  str(body.email, { max: 160 }), str(body.phone, { max: 40 }), str(body.city, { max: 80 }),
  JSON.stringify((Array.isArray(body.tags) ? body.tags : String(body.tags || '').split(',')).map(s => s.trim()).filter(Boolean).slice(0, 8)),
  oneOf(body.stage || 'new', STAGES, 'Étape'), int(body.value, { label: 'Valeur estimée' }), str(body.notes, { max: 3000 }), date(body.next_follow_up),
];

route('POST', '/api/studio/contacts', ({ user, body }) => {
  const id = insert(`INSERT INTO studio_contacts (owner_id, name, company, job, email, phone, city, tags, stage, value, notes, next_follow_up, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, user.id, ...contactFields(body), now(), now());
  insert('INSERT INTO studio_activities (owner_id, contact_id, kind, body, created_at) VALUES (?, ?, ?, ?, ?)', user.id, id, 'note', 'Contact créé', now());
  return { id };
}, opt);

route('GET', '/api/studio/contacts/:id', ({ user, params }) => {
  const c = own('studio_contacts', params.id, user.id);
  return { contact: { ...c, tags: J(c.tags),
    activities: all('SELECT * FROM studio_activities WHERE contact_id = ? AND owner_id = ? ORDER BY created_at DESC', c.id, user.id),
    tasks: all('SELECT * FROM studio_tasks WHERE contact_id = ? AND owner_id = ? ORDER BY done, due_date', c.id, user.id),
    quotes: all('SELECT id, number, title, status, lines, vat_rate FROM studio_quotes WHERE contact_id = ? AND owner_id = ?', c.id, user.id).map(q => ({ ...q, ...totals(J(q.lines), q.vat_rate) })),
    invoices: all('SELECT id, number, title, status, lines, vat_rate FROM studio_invoices WHERE contact_id = ? AND owner_id = ?', c.id, user.id).map(q => ({ ...q, ...totals(J(q.lines), q.vat_rate) })),
  } };
}, opt);

route('PATCH', '/api/studio/contacts/:id', ({ user, params, body }) => {
  const c = own('studio_contacts', params.id, user.id);
  const f = contactFields({ ...c, tags: J(c.tags), ...body });
  run(`UPDATE studio_contacts SET name = ?, company = ?, job = ?, email = ?, phone = ?, city = ?, tags = ?, stage = ?, value = ?, notes = ?, next_follow_up = ?, updated_at = ? WHERE id = ? AND owner_id = ?`, ...f, now(), c.id, user.id);
  if (body.stage && body.stage !== c.stage) insert('INSERT INTO studio_activities (owner_id, contact_id, kind, body, created_at) VALUES (?, ?, ?, ?, ?)', user.id, c.id, 'stage', `Étape : ${body.stage}`, now());
  return { ok: true };
}, opt);

route('DELETE', '/api/studio/contacts/:id', ({ user, params }) => { own('studio_contacts', params.id, user.id); run('DELETE FROM studio_contacts WHERE id = ? AND owner_id = ?', params.id, user.id); return { ok: true }; }, opt);

route('POST', '/api/studio/contacts/:id/activities', ({ user, params, body }) => {
  const c = own('studio_contacts', params.id, user.id);
  insert('INSERT INTO studio_activities (owner_id, contact_id, kind, body, created_at) VALUES (?, ?, ?, ?, ?)', user.id, c.id,
    oneOf(body.kind || 'note', ['note', 'call', 'email', 'meeting'], 'Type'), str(body.body, { required: true, max: 2000, label: 'Contenu' }), now());
  run('UPDATE studio_contacts SET updated_at = ? WHERE id = ?', now(), c.id);
  return { ok: true };
}, opt);

// ───────── Tâches et rappels
route('GET', '/api/studio/tasks', ({ user }) => ({ items: all(`SELECT t.*, c.name contact FROM studio_tasks t LEFT JOIN studio_contacts c ON c.id = t.contact_id WHERE t.owner_id = ? ORDER BY t.done, t.due_date`, user.id) }), opt);
route('POST', '/api/studio/tasks', ({ user, body }) => {
  if (body.contact_id) own('studio_contacts', body.contact_id, user.id);
  const id = insert('INSERT INTO studio_tasks (owner_id, contact_id, title, due_date, created_at) VALUES (?, ?, ?, ?, ?)', user.id, body.contact_id || null, str(body.title, { required: true, max: 200, label: 'Tâche' }), date(body.due_date), now());
  return { id };
}, opt);
route('PATCH', '/api/studio/tasks/:id', ({ user, params, body }) => {
  own('studio_tasks', params.id, user.id);
  run('UPDATE studio_tasks SET done = ? WHERE id = ? AND owner_id = ?', body.done ? 1 : 0, params.id, user.id);
  return { ok: true };
}, opt);
route('DELETE', '/api/studio/tasks/:id', ({ user, params }) => { run('DELETE FROM studio_tasks WHERE id = ? AND owner_id = ?', params.id, user.id); return { ok: true }; }, opt);

// ───────── Devis et factures
const parseLines = lines => {
  const out = (Array.isArray(lines) ? lines : []).map(l => ({ label: str(l.label, { required: true, max: 200, label: 'Désignation' }), qty: Number(l.qty) || 1, unit_price: Math.round((Number(l.unit_price) || 0) * 100) / 100 }));
  if (!out.length) fail(400, 'Ajoute au moins une prestation.');
  return JSON.stringify(out);
};
const docFields = body => [
  body.contact_id ? Number(body.contact_id) : null,
  str(body.client_name, { required: true, max: 120, label: 'Client' }), str(body.client_email, { max: 160 }), str(body.client_address, { max: 300 }),
  str(body.title, { required: true, max: 160, label: 'Objet' }), date(body.event_date), parseLines(body.lines),
  Number(body.vat_rate) === 20 ? 20 : Number(body.vat_rate) === 10 ? 10 : 0, str(body.notes, { max: 2000 }),
];
const withTotals = d => ({ ...d, lines: J(d.lines), ...totals(J(d.lines), d.vat_rate) });

function refreshOverdue(ownerId) {
  run("UPDATE studio_invoices SET status = 'overdue' WHERE owner_id = ? AND status = 'sent' AND due_date < ?", ownerId, today());
}
function invoicesWithTotals(ownerId) { return all('SELECT * FROM studio_invoices WHERE owner_id = ? ORDER BY issue_date DESC, id DESC', ownerId).map(withTotals); }

route('GET', '/api/studio/quotes', ({ user }) => ({ items: all('SELECT * FROM studio_quotes WHERE owner_id = ? ORDER BY created_at DESC', user.id).map(withTotals) }), opt);
route('GET', '/api/studio/quotes/:id', ({ user, params }) => {
  const q = withTotals(own('studio_quotes', params.id, user.id));
  q.invoice = get('SELECT id, number FROM studio_invoices WHERE quote_id = ? AND owner_id = ?', q.id, user.id) || null;
  return { quote: q };
}, opt);
route('POST', '/api/studio/quotes', ({ user, body }) => {
  const f = docFields(body);
  if (f[0]) own('studio_contacts', f[0], user.id);
  const id = insert(`INSERT INTO studio_quotes (owner_id, number, contact_id, client_name, client_email, client_address, title, event_date, lines, vat_rate, notes, valid_until, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`, user.id, nextNumber('DEV', user.id), ...f, date(body.valid_until) || addDays(today(), 30), now());
  if (f[0]) insert('INSERT INTO studio_activities (owner_id, contact_id, kind, body, created_at) VALUES (?, ?, ?, ?, ?)', user.id, f[0], 'note', `Devis créé : ${f[4]}`, now());
  return { id };
}, opt);
route('PATCH', '/api/studio/quotes/:id', ({ user, params, body }) => {
  const q = own('studio_quotes', params.id, user.id);
  if (body.status && Object.keys(body).length === 1) {
    run('UPDATE studio_quotes SET status = ? WHERE id = ?', oneOf(body.status, ['draft', 'sent', 'accepted', 'declined'], 'Statut'), q.id);
    if (body.status === 'sent' && q.contact_id) run("UPDATE studio_contacts SET stage = 'quote_sent', updated_at = ? WHERE id = ? AND stage NOT IN ('won','lost','negotiation')", now(), q.contact_id);
    if (body.status === 'accepted' && q.contact_id) run("UPDATE studio_contacts SET stage = 'won', updated_at = ? WHERE id = ?", now(), q.contact_id);
    return { ok: true };
  }
  run(`UPDATE studio_quotes SET contact_id = ?, client_name = ?, client_email = ?, client_address = ?, title = ?, event_date = ?, lines = ?, vat_rate = ?, notes = ?, valid_until = ? WHERE id = ?`,
    ...docFields(body), date(body.valid_until) || q.valid_until, q.id);
  return { ok: true };
}, opt);
route('DELETE', '/api/studio/quotes/:id', ({ user, params }) => { own('studio_quotes', params.id, user.id); run('DELETE FROM studio_quotes WHERE id = ?', params.id); return { ok: true }; }, opt);

route('POST', '/api/studio/quotes/:id/invoice', ({ user, params }) => {
  const q = own('studio_quotes', params.id, user.id);
  const existing = get('SELECT id FROM studio_invoices WHERE quote_id = ? AND owner_id = ?', q.id, user.id);
  if (existing) return { id: existing.id };
  const id = tx(() => {
    const id = insert(`INSERT INTO studio_invoices (owner_id, number, quote_id, contact_id, request_id, client_name, client_email, client_address, title, event_date, lines, vat_rate, status, issue_date, due_date, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`, user.id, nextNumber('FAC', user.id), q.id, q.contact_id, q.request_id, q.client_name, q.client_email, q.client_address,
      q.title, q.event_date, q.lines, q.vat_rate, today(), addDays(today(), 30), null, now());
    run("UPDATE studio_quotes SET status = 'accepted' WHERE id = ?", q.id);
    return id;
  });
  return { id };
}, opt);

route('GET', '/api/studio/invoices', ({ user }) => { refreshOverdue(user.id); return { items: invoicesWithTotals(user.id) }; }, opt);
route('GET', '/api/studio/invoices/:id', ({ user, params }) => { refreshOverdue(user.id); return { invoice: withTotals(own('studio_invoices', params.id, user.id)) }; }, opt);
route('POST', '/api/studio/invoices', ({ user, body }) => {
  const f = docFields(body);
  if (f[0]) own('studio_contacts', f[0], user.id);
  const issue = date(body.issue_date) || today();
  const id = insert(`INSERT INTO studio_invoices (owner_id, number, contact_id, client_name, client_email, client_address, title, event_date, lines, vat_rate, notes, status, issue_date, due_date, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`, user.id, nextNumber('FAC', user.id), ...f, issue, date(body.due_date) || addDays(issue, 30), now());
  return { id };
}, opt);
route('PATCH', '/api/studio/invoices/:id', ({ user, params, body }) => {
  const inv = own('studio_invoices', params.id, user.id);
  if (body.status && Object.keys(body).length === 1) {
    const status = oneOf(body.status, ['draft', 'sent', 'paid', 'overdue'], 'Statut');
    run('UPDATE studio_invoices SET status = ?, paid_at = ? WHERE id = ?', status, status === 'paid' ? today() : null, inv.id);
    return { ok: true };
  }
  if (inv.status === 'paid') fail(400, 'Une facture payée ne peut plus être modifiée.');
  run(`UPDATE studio_invoices SET contact_id = ?, client_name = ?, client_email = ?, client_address = ?, title = ?, event_date = ?, lines = ?, vat_rate = ?, notes = ?, issue_date = ?, due_date = ? WHERE id = ?`,
    ...docFields(body), date(body.issue_date) || inv.issue_date, date(body.due_date) || inv.due_date, inv.id);
  return { ok: true };
}, opt);
route('DELETE', '/api/studio/invoices/:id', ({ user, params }) => {
  const inv = own('studio_invoices', params.id, user.id);
  if (inv.status !== 'draft') fail(400, 'Seuls les brouillons peuvent être supprimés. Une facture émise se conserve.');
  run('DELETE FROM studio_invoices WHERE id = ?', inv.id); return { ok: true };
}, opt);

// Facture depuis un booking confirmé / réalisé
route('POST', '/api/studio/bookings/:id/invoice', ({ user, params }) => {
  const r = get("SELECT * FROM booking_requests WHERE id = ? AND dj_id = ? AND status IN ('confirmed','completed')", params.id, user.id) || fail(404, 'Booking confirmé introuvable.');
  const existing = get('SELECT id FROM studio_invoices WHERE request_id = ? AND owner_id = ?', r.id, user.id);
  if (existing) return { id: existing.id };
  const quote = get('SELECT id FROM studio_quotes WHERE request_id = ? AND owner_id = ?', r.id, user.id);
  const org = get('SELECT o.org_name, u.email FROM organizer_profiles o JOIN users u ON u.id = o.user_id WHERE o.user_id = ?', r.organizer_id);
  const id = insert(`INSERT INTO studio_invoices (owner_id, number, quote_id, request_id, client_name, client_email, title, event_date, lines, vat_rate, status, issue_date, due_date, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'draft', ?, ?, ?)`, user.id, nextNumber('FAC', user.id), quote?.id ?? null, r.id, org.org_name, org.email, r.event_title, r.date,
    JSON.stringify([{ label: `Prestation DJ — ${r.event_title}`, qty: 1, unit_price: r.quote_amount || r.budget || 0 }]), today(), addDays(today(), 30), now());
  return { id };
}, opt);

function seller(userId) {
  const s = get('SELECT * FROM studio_settings WHERE owner_id = ?', userId) || {};
  const d = get('SELECT d.stage_name, u.email FROM dj_profiles d JOIN users u ON u.id = d.user_id WHERE d.user_id = ?', userId);
  return { ...d, ...s };
}
route('GET', '/api/studio/:kind/:id/pdf', ({ user, params, res }) => {
  const kind = oneOf(params.kind, ['quotes', 'invoices'], 'Document');
  const doc = withTotals(own(kind === 'quotes' ? 'studio_quotes' : 'studio_invoices', params.id, user.id));
  const buf = documentPdf(kind === 'quotes' ? 'quote' : 'invoice', doc, seller(user.id));
  res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${doc.number}.pdf"`, 'Content-Length': buf.length });
  res.end(buf);
}, opt);

route('GET', '/api/studio/settings', ({ user }) => ({ settings: get('SELECT * FROM studio_settings WHERE owner_id = ?', user.id) || {} }), opt);
route('PUT', '/api/studio/settings', ({ user, body }) => {
  const cur = get('SELECT * FROM studio_settings WHERE owner_id = ?', user.id) || {};
  const b = { ...cur, ...body };
  run(`INSERT INTO studio_settings (owner_id, legal_name, address, siret, iban, vat_mode, legal_status, monthly_goal) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(owner_id) DO UPDATE SET legal_name = excluded.legal_name, address = excluded.address, siret = excluded.siret, iban = excluded.iban, vat_mode = excluded.vat_mode, legal_status = excluded.legal_status, monthly_goal = excluded.monthly_goal`,
    user.id, str(b.legal_name, { max: 120 }), str(b.address, { max: 300 }), str(b.siret, { max: 20 }), str(b.iban, { max: 40 }), oneOf(b.vat_mode || 'franchise', ['franchise', 'vat'], 'TVA'),
    b.legal_status ? oneOf(b.legal_status, ['micro-entreprise', 'portage salarial', 'intermittence (GUSO)'], 'Statut') : null, int(b.monthly_goal, { label: 'Objectif mensuel' }));
  return { ok: true };
}, opt);

// ───────── Finances (calculées depuis les factures)
route('GET', '/api/studio/finances', ({ user }) => {
  refreshOverdue(user.id);
  const inv = invoicesWithTotals(user.id);
  const year = today().slice(0, 4);
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
  return {
    year,
    paid_year: inv.filter(i => i.status === 'paid' && (i.paid_at || '').startsWith(year)).reduce((s, i) => s + i.ttc, 0),
    waiting: inv.filter(i => i.status === 'sent').reduce((s, i) => s + i.ttc, 0),
    overdue: inv.filter(i => i.status === 'overdue').reduce((s, i) => s + i.ttc, 0),
    drafts: inv.filter(i => i.status === 'draft').reduce((s, i) => s + i.ttc, 0),
    by_month: months.map(m => ({ month: m, paid: inv.filter(i => i.status === 'paid' && (i.paid_at || '').startsWith(m)).reduce((s, i) => s + i.ttc, 0) })),
    average: (() => { const p = inv.filter(i => i.status === 'paid'); return p.length ? Math.round(p.reduce((s, i) => s + i.ttc, 0) / p.length) : 0; })(),
    invoices: inv,
  };
}, opt);

// ───────── Calendrier : bookings, demandes, tâches, dates bloquées
route('GET', '/api/studio/calendar', ({ user, query }) => {
  const from = query.from || today().slice(0, 8) + '01', to = query.to || addDays(from, 41);
  return {
    bookings: all("SELECT id, event_title, date, start_time, city, status FROM booking_requests WHERE dj_id = ? AND date BETWEEN ? AND ? AND status IN ('pending','quoted','confirmed','completed')", user.id, from, to),
    tasks: all('SELECT id, title, due_date, done FROM studio_tasks WHERE owner_id = ? AND due_date BETWEEN ? AND ?', user.id, from, to),
    gigs: all('SELECT id, title, date, start_time, city, status FROM studio_gigs WHERE owner_id = ? AND date BETWEEN ? AND ?', user.id, from, to),
    blocked: all('SELECT date, reason FROM dj_blocked_dates WHERE dj_id = ? AND date BETWEEN ? AND ?', user.id, from, to),
  };
}, opt);
route('POST', '/api/studio/blocked', ({ user, body }) => {
  const d = date(body.date, { required: true });
  if (get('SELECT 1 FROM dj_blocked_dates WHERE dj_id = ? AND date = ?', user.id, d)) run('DELETE FROM dj_blocked_dates WHERE dj_id = ? AND date = ?', user.id, d);
  else run('INSERT INTO dj_blocked_dates (dj_id, date, reason) VALUES (?, ?, ?)', user.id, d, str(body.reason, { max: 80 }) || 'Indisponible');
  return { ok: true };
}, opt);

// ───────── Set Clipper : historique des clips exportés
route('GET', '/api/studio/clips', ({ user }) => ({ items: all('SELECT * FROM studio_clips WHERE owner_id = ? ORDER BY created_at DESC', user.id) }), opt);
route('POST', '/api/studio/clips', ({ user, body }) => {
  const id = insert(`INSERT INTO studio_clips (owner_id, title, source_name, start_s, end_s, format, moment_kind, file, mime, size, caption, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    user.id, str(body.title, { required: true, max: 120 }), str(body.source_name, { max: 200 }), Number(body.start_s) || 0, Number(body.end_s) || 0,
    oneOf(body.format, ['9:16', '1:1', '16:9'], 'Format'), str(body.moment_kind, { max: 40 }), str(body.file, { max: 300 }), str(body.mime, { max: 80 }), int(body.size, { max: 1e10 }), str(body.caption, { max: 2000 }), now());
  return { id };
}, opt);
route('DELETE', '/api/studio/clips/:id', ({ user, params }) => { run('DELETE FROM studio_clips WHERE id = ? AND owner_id = ?', params.id, user.id); return { ok: true }; }, opt);

// ───────── Dates hors plateforme (réseau personnel) et feuille de route
const GIG_STATUSES = ['option', 'confirmed', 'done', 'cancelled'];
const gigFields = body => [
  body.contact_id ? Number(body.contact_id) : null, str(body.title, { required: true, max: 160, label: 'Nom de la soirée' }), str(body.client_name, { max: 120 }),
  date(body.date, { required: true }), str(body.start_time, { max: 5 }), str(body.end_time, { max: 5 }), str(body.arrival_time, { max: 5 }),
  str(body.venue, { max: 120 }), str(body.address, { max: 200 }), str(body.city, { max: 80 }),
  body.fee === '' || body.fee == null ? null : Math.max(0, Number(body.fee) || 0), oneOf(body.status || 'confirmed', GIG_STATUSES, 'Statut'),
  str(body.rider, { max: 500 }), str(body.onsite_contact, { max: 200 }), str(body.notes, { max: 2000 }),
];
route('GET', '/api/studio/gigs', ({ user }) => ({
  items: all('SELECT g.*, (SELECT id FROM studio_invoices i WHERE i.gig_id = g.id AND i.owner_id = g.owner_id) invoice_id FROM studio_gigs g WHERE owner_id = ? ORDER BY date DESC', user.id),
}), opt);
route('POST', '/api/studio/gigs', ({ user, body }) => {
  const f = gigFields(body);
  if (f[0]) own('studio_contacts', f[0], user.id);
  return { id: insert(`INSERT INTO studio_gigs (owner_id, contact_id, title, client_name, date, start_time, end_time, arrival_time, venue, address, city, fee, status, rider, onsite_contact, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, user.id, ...f, now()) };
}, opt);
route('PATCH', '/api/studio/gigs/:id', ({ user, params, body }) => {
  const g = own('studio_gigs', params.id, user.id);
  const f = gigFields({ ...g, ...body });
  if (f[0]) own('studio_contacts', f[0], user.id);
  run(`UPDATE studio_gigs SET contact_id = ?, title = ?, client_name = ?, date = ?, start_time = ?, end_time = ?, arrival_time = ?, venue = ?, address = ?, city = ?, fee = ?, status = ?, rider = ?, onsite_contact = ?, notes = ? WHERE id = ? AND owner_id = ?`, ...f, g.id, user.id);
  return { ok: true };
}, opt);
route('DELETE', '/api/studio/gigs/:id', ({ user, params }) => { own('studio_gigs', params.id, user.id); run('DELETE FROM studio_gigs WHERE id = ? AND owner_id = ?', params.id, user.id); return { ok: true }; }, opt);
route('POST', '/api/studio/gigs/:id/invoice', ({ user, params }) => {
  const g = own('studio_gigs', params.id, user.id);
  const existing = get('SELECT id FROM studio_invoices WHERE gig_id = ? AND owner_id = ?', g.id, user.id);
  if (existing) return { id: existing.id };
  const c = g.contact_id ? get('SELECT name, email FROM studio_contacts WHERE id = ?', g.contact_id) : null;
  return { id: insert(`INSERT INTO studio_invoices (owner_id, number, contact_id, gig_id, client_name, client_email, title, event_date, lines, vat_rate, status, issue_date, due_date, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'draft', ?, ?, ?)`, user.id, nextNumber('FAC', user.id), g.contact_id, g.id, g.client_name || c?.name || g.title, c?.email || null, g.title, g.date,
    JSON.stringify([{ label: `DJ set — ${g.title}`, qty: 1, unit_price: g.fee || 0 }]), today(), addDays(today(), 30), now()) };
}, opt);

// ───────── Messages types (prospection)
route('GET', '/api/studio/templates', ({ user }) => ({ items: all('SELECT * FROM studio_templates WHERE owner_id = ? ORDER BY id', user.id) }), opt);
route('POST', '/api/studio/templates', ({ user, body }) => ({ id: insert('INSERT INTO studio_templates (owner_id, name, body) VALUES (?, ?, ?)', user.id, str(body.name, { required: true, max: 80, label: 'Nom' }), str(body.body, { required: true, max: 3000, label: 'Message' })) }), opt);
route('PATCH', '/api/studio/templates/:id', ({ user, params, body }) => { own('studio_templates', params.id, user.id); run('UPDATE studio_templates SET name = ?, body = ? WHERE id = ? AND owner_id = ?', str(body.name, { required: true, max: 80, label: 'Nom' }), str(body.body, { required: true, max: 3000, label: 'Message' }), params.id, user.id); return { ok: true }; }, opt);
route('DELETE', '/api/studio/templates/:id', ({ user, params }) => { run('DELETE FROM studio_templates WHERE id = ? AND owner_id = ?', params.id, user.id); return { ok: true }; }, opt);
