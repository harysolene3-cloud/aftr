// Espace de vente (commande simulée) et accès direct aux comptes de démonstration.
import { randomBytes } from 'node:crypto';
import { get, insert, run, now, addDays, today } from '../db.js';
import { route, str, oneOf, fail, createSession } from '../http.js';

// Prix de référence. DJ Pro est vendu aux DJs indépendants : prix affiché TTC. Organisateur Plus est une offre B2B : prix affiché HT.
export const VAT = 0.2;
export const OFFERS = {
  dj_pro: { label: 'DJ Pro', segment: 'dj', monthly_ttc: 14.9, yearly_ttc: 149 },
  org_plus: { label: 'Organisateur Plus', segment: 'organizer', monthly_ht: 29, yearly_ht: 290 },
};
const r2 = n => Math.round(n * 100) / 100;
export function priceOf(offer, period) {
  const o = OFFERS[offer];
  if (o.monthly_ttc) { const ttc = period === 'yearly' ? o.yearly_ttc : o.monthly_ttc; const ht = r2(ttc / (1 + VAT)); return { ht, vat: r2(ttc - ht), ttc }; }
  const ht = period === 'yearly' ? o.yearly_ht : o.monthly_ht; return { ht, vat: r2(ht * VAT), ttc: r2(ht * (1 + VAT)) };
}
export const SOURCES = ['Instagram', 'TikTok', 'LinkedIn', 'Bouche-à-oreille', 'Partenaire', 'Salon / événement', 'Recherche Google'];

route('GET', '/api/offers', () => ({ offers: Object.fromEntries(Object.entries(OFFERS).map(([k, o]) => [k, { ...o, monthly: priceOf(k, 'monthly'), yearly: priceOf(k, 'yearly') }])), sources: SOURCES }));

route('POST', '/api/orders', ({ body }) => {
  const offer = oneOf(body.offer, Object.keys(OFFERS), 'Offre');
  const period = oneOf(body.period, ['monthly', 'yearly'], 'Durée');
  const name = str(body.name, { required: true, max: 80, label: 'Nom' });
  const email = str(body.email, { required: true, max: 120, label: 'E-mail' }).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail(400, 'E-mail invalide.');
  if (body.accept !== true && body.accept !== 'on') fail(400, 'Coche la case pour confirmer que la commande est une simulation.');
  const phone = str(body.phone, { max: 30 }), city = str(body.city, { max: 80 }), company = str(body.company, { max: 120 }), source = body.source ? oneOf(body.source, SOURCES, 'Source') : null;
  const p = priceOf(offer, period), o = OFFERS[offer];
  const ref = 'CMD-' + new Date().getFullYear() + '-' + randomBytes(3).toString('hex').toUpperCase();
  // La commande crée ou met à jour la fiche du client dans le CRM, le passe en « Gagné » et planifie la prochaine action
  let c = get('SELECT * FROM admin_contacts WHERE lower(email) = ?', email);
  const contactId = c ? c.id : insert('INSERT INTO admin_contacts (name, email, phone, city, segment, stage, source, tags, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    company ? `${name} (${company})` : name, email, phone, city, o.segment, 'customer', source || 'Site web', JSON.stringify(['Commande en ligne']), 'Client créé par une commande sur le site (paiement simulé).', now());
  if (c) run("UPDATE admin_contacts SET stage = 'customer' WHERE id = ?", c.id);
  insert('INSERT INTO orders (ref, offer, period, amount_ht, vat, amount_ttc, name, email, city, company, source, contact_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ref, offer, period, p.ht, p.vat, p.ttc, name, email, city, company, source, contactId, now());
  const label = `${o.label} ${period === 'yearly' ? 'annuel' : 'mensuel'}`;
  insert('INSERT INTO admin_interactions (contact_id, admin_id, kind, body, created_at) VALUES (?, ?, ?, ?, ?)', contactId, null, 'note',
    `Commande ${ref} : ${label}, ${p.ttc.toFixed(2).replace('.', ',')} € TTC (${p.ht.toFixed(2).replace('.', ',')} € HT). Paiement simulé, aucun encaissement.`, now());
  if (c && c.stage !== 'customer') insert('INSERT INTO admin_interactions (contact_id, admin_id, kind, body, created_at) VALUES (?, ?, ?, ?, ?)', contactId, null, 'stage', 'Étape : Gagné (commande en ligne)', now());
  insert('INSERT INTO admin_tasks (contact_id, title, due_date, done, created_at) VALUES (?, ?, ?, 0, ?)', contactId, 'Appel de bienvenue : aider à configurer le compte ' + o.label, addDays(today(), 2), now());
  return { ref };
});

route('GET', '/api/orders/:ref', ({ params }) => {
  const o = get('SELECT ref, offer, period, amount_ht, vat, amount_ttc, name, email, city, company, created_at, contact_id FROM orders WHERE ref = ?', params.ref) || fail(404, 'Commande introuvable.');
  return { order: { ...o, label: OFFERS[o.offer].label } };
});

// Ouvre directement un compte de démonstration (identifiants publics, affichés sur l'écran de connexion)
const DEMO = { admin: 'admin@aftr.demo', dj: 'anjara@aftr.demo', organizer: 'contrejour@aftr.demo' };
route('POST', '/api/auth/demo', ({ body, res }) => {
  const u = get('SELECT id, theme FROM users WHERE email = ?', DEMO[oneOf(body.account, Object.keys(DEMO), 'Compte')]) || fail(404, 'Compte de démo introuvable.');
  res.setHeader('Set-Cookie', [`aftr_session=${createSession(u.id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=1209600`, `aftr_theme=${u.theme}; Path=/; Max-Age=31536000; SameSite=Lax`]);
  return { ok: true };
});
