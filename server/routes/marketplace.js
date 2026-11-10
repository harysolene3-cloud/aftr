import { get, all, run, insert, now, J, tx, today } from '../db.js';
import { route, fail, notify, str, int, date, oneOf } from '../http.js';
import { djCard, isAvailable } from './public.js';
import { nextNumber } from './studio.js';

export const EVENT_TYPES = ['Club', 'Bar / Rooftop', 'Soirée privée', 'Mariage', 'Entreprise', 'Festival', 'Soirée étudiante'];
export const STATUS_LABEL = { pending: 'Demande reçue', quoted: 'Devis proposé', confirmed: 'Confirmé', declined: 'Refusé', cancelled: 'Annulé', completed: 'Réalisé' };

function requestFor(id, user) {
  const r = get('SELECT * FROM booking_requests WHERE id = ?', id) || fail(404, 'Réservation introuvable.');
  if (r.dj_id !== user.id && r.organizer_id !== user.id) fail(403, "Cette réservation ne te concerne pas.");
  return r;
}

function hydrate(r) {
  const dj = get('SELECT d.stage_name, d.slug, d.photo, u.city FROM dj_profiles d JOIN users u ON u.id = d.user_id WHERE d.user_id = ?', r.dj_id);
  const org = get('SELECT o.org_name, o.org_type, o.photo, u.name, u.email FROM organizer_profiles o JOIN users u ON u.id = o.user_id WHERE o.user_id = ?', r.organizer_id);
  return { ...r, dj, organizer: org, status_label: STATUS_LABEL[r.status],
    review: get('SELECT rating, body FROM reviews WHERE request_id = ?', r.id) || null };
}

function log(requestId, actorId, status, note) {
  insert('INSERT INTO booking_history (request_id, actor_id, status, note, created_at) VALUES (?, ?, ?, ?, ?)', requestId, actorId, status, note ?? null, now());
}

route('POST', '/api/bookings', ({ user, body }) => {
  const dj = get('SELECT user_id, stage_name FROM dj_profiles WHERE user_id = ?', Number(body.dj_id)) || fail(404, 'DJ introuvable.');
  if (dj.user_id === user.id) fail(400, 'Tu ne peux pas te réserver toi-même.');
  const d = date(body.date, { required: true, label: "Date de l'événement" });
  if (d < today()) fail(400, "La date de l'événement est déjà passée.");
  let event = null;
  if (body.event_id) event = get('SELECT * FROM events WHERE id = ? AND organizer_id = ?', Number(body.event_id), user.id) || fail(404, 'Événement introuvable.');
  const id = tx(() => {
    const id = insert(`INSERT INTO booking_requests (dj_id, organizer_id, event_id, event_title, event_type, date, start_time, end_time, city, venue, budget, message, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      dj.user_id, user.id, event?.id ?? null, str(body.event_title, { required: true, max: 120, label: "Nom de l'événement" }),
      body.event_type ? oneOf(body.event_type, EVENT_TYPES, "Type d'événement") : null, d,
      str(body.start_time, { max: 5 }), str(body.end_time, { max: 5 }), str(body.city, { required: true, max: 80, label: 'Ville' }), str(body.venue, { max: 120 }),
      int(body.budget, { required: true, label: 'Budget' }), str(body.message, { max: 2000 }), now(), now());
    log(id, user.id, 'pending', 'Demande envoyée');
    notify(dj.user_id, 'booking', 'Nouvelle demande de réservation', `${str(body.event_title, { max: 120 })} · ${d}`, `/app/reservations/${id}`);
    return id;
  });
  return { id, available: isAvailable(dj.user_id, d) };
}, { role: 'organizer' });

route('GET', '/api/bookings', ({ user, query }) => {
  const side = query.side === 'organizer' ? 'organizer_id' : 'dj_id';
  if (side === 'dj_id' && !user.roles.includes('dj')) fail(403, 'Réservé aux DJs.');
  if (side === 'organizer_id' && !user.roles.includes('organizer')) fail(403, 'Réservé aux organisateurs.');
  return { items: all(`SELECT * FROM booking_requests WHERE ${side} = ? ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'quoted' THEN 1 WHEN 'confirmed' THEN 2 ELSE 3 END, date`, user.id).map(hydrate) };
}, { role: 'user' });

route('GET', '/api/bookings/:id', ({ user, params }) => {
  const r = requestFor(params.id, user);
  const history = all(`SELECT h.status, h.note, h.created_at, u.name actor FROM booking_history h LEFT JOIN users u ON u.id = h.actor_id WHERE h.request_id = ? ORDER BY h.created_at`, r.id);
  const quote = r.dj_id === user.id ? get('SELECT id, number, status FROM studio_quotes WHERE request_id = ? AND owner_id = ?', r.id, user.id) : null;
  const invoice = r.dj_id === user.id ? get('SELECT id, number, status FROM studio_invoices WHERE request_id = ? AND owner_id = ?', r.id, user.id) : null;
  return { booking: { ...hydrate(r), history, quote, invoice, viewer: r.dj_id === user.id ? 'dj' : 'organizer', dj_available: isAvailable(r.dj_id, r.date) } };
}, { role: 'user' });

route('POST', '/api/bookings/:id/action', ({ user, params, body }) => {
  const r = requestFor(params.id, user);
  const isDj = r.dj_id === user.id, action = body.action;
  const set = (status, extra = {}) => {
    const cols = Object.keys(extra);
    run(`UPDATE booking_requests SET status = ?, updated_at = ?${cols.map(c => `, ${c} = ?`).join('')} WHERE id = ?`, status, now(), ...cols.map(c => extra[c]), r.id);
  };
  const other = isDj ? r.organizer_id : r.dj_id;
  const link = `/app/reservations/${r.id}`;
  tx(() => {
    if (action === 'quote' && isDj && ['pending', 'quoted'].includes(r.status)) {
      const amount = int(body.amount, { required: true, min: 1, label: 'Montant' });
      const msg = str(body.message, { max: 1500 });
      set('quoted', { quote_amount: amount, quote_message: msg });
      // Le devis est aussi créé dans le Business Studio du DJ
      const org = get('SELECT o.org_name, u.email FROM organizer_profiles o JOIN users u ON u.id = o.user_id WHERE o.user_id = ?', r.organizer_id);
      const existing = get('SELECT id FROM studio_quotes WHERE request_id = ? AND owner_id = ?', r.id, user.id);
      const lines = JSON.stringify([{ label: `Prestation DJ — ${r.event_title}`, qty: 1, unit_price: amount }]);
      if (existing) run("UPDATE studio_quotes SET lines = ?, status = 'sent', notes = ? WHERE id = ?", lines, msg, existing.id);
      else insert(`INSERT INTO studio_quotes (owner_id, number, request_id, client_name, client_email, title, event_date, lines, vat_rate, status, notes, valid_until, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'sent', ?, date('now', '+30 day'), ?)`, user.id, nextNumber('DEV', user.id), r.id, org.org_name, org.email, r.event_title, r.date, lines, msg, now());
      log(r.id, user.id, 'quoted', `Devis proposé : ${amount} €`);
      notify(other, 'booking', 'Tu as reçu un devis', `${r.event_title} · ${amount} €`, link);
    } else if (action === 'decline' && isDj && ['pending', 'quoted'].includes(r.status)) {
      set('declined'); log(r.id, user.id, 'declined', str(body.message, { max: 500 }) || 'Refusé par le DJ');
      run("UPDATE studio_quotes SET status = 'declined' WHERE request_id = ? AND owner_id = ?", r.id, user.id);
      notify(other, 'booking', 'Demande déclinée', r.event_title, link);
    } else if (action === 'accept' && !isDj && r.status === 'quoted') {
      if (!isAvailable(r.dj_id, r.date)) fail(409, "Le DJ n'est plus disponible à cette date.");
      set('confirmed'); log(r.id, user.id, 'confirmed', 'Devis accepté, booking confirmé');
      run("UPDATE studio_quotes SET status = 'accepted' WHERE request_id = ?", r.id);
      if (r.event_id) run("UPDATE events SET status = 'dj_found' WHERE id = ?", r.event_id);
      notify(other, 'booking', 'Booking confirmé 🎉', `${r.event_title} · ${r.date}`, link);
    } else if (action === 'refuse_quote' && !isDj && r.status === 'quoted') {
      set('declined'); log(r.id, user.id, 'declined', "Devis refusé par l'organisateur");
      run("UPDATE studio_quotes SET status = 'declined' WHERE request_id = ?", r.id);
      notify(other, 'booking', 'Devis refusé', r.event_title, link);
    } else if (action === 'cancel' && !isDj && ['pending', 'quoted', 'confirmed'].includes(r.status)) {
      set('cancelled'); log(r.id, user.id, 'cancelled', str(body.message, { max: 500 }) || "Annulé par l'organisateur");
      notify(other, 'booking', 'Réservation annulée', r.event_title, link);
    } else if (action === 'complete' && isDj && r.status === 'confirmed') {
      if (r.date > today()) fail(400, "La prestation n'a pas encore eu lieu.");
      set('completed'); log(r.id, user.id, 'completed', 'Prestation réalisée');
      notify(other, 'review', 'Laisse un avis', `Comment s'est passée la prestation de ${r.event_title} ?`, link);
    } else if (action === 'review' && !isDj && r.status === 'completed') {
      if (get('SELECT 1 FROM reviews WHERE request_id = ?', r.id)) fail(409, 'Tu as déjà laissé un avis.');
      insert('INSERT INTO reviews (dj_id, author_id, request_id, rating, body, created_at) VALUES (?, ?, ?, ?, ?, ?)', r.dj_id, user.id, r.id, int(body.rating, { min: 1, max: 5, required: true, label: 'Note' }), str(body.message, { max: 1000 }), now());
      notify(other, 'review', 'Nouvel avis reçu', r.event_title, link);
    } else fail(400, "Cette action n'est pas possible à ce stade de la réservation.");
  });
  return { ok: true };
}, { role: 'user' });

// Feuille de route : modifiable par le DJ et l'organisateur concernés
route('PATCH', '/api/bookings/:id/roadmap', ({ user, params, body }) => {
  const r = requestFor(params.id, user);
  run('UPDATE booking_requests SET address = ?, arrival_time = ?, rider = ?, onsite_contact = ?, roadmap_notes = ?, updated_at = ? WHERE id = ?',
    str(body.address, { max: 200 }), str(body.arrival_time, { max: 5 }), str(body.rider, { max: 500 }), str(body.onsite_contact, { max: 200 }), str(body.roadmap_notes, { max: 2000 }), now(), r.id);
  notify(r.dj_id === user.id ? r.organizer_id : r.dj_id, 'booking', 'Feuille de route mise à jour', r.event_title, `/app/reservations/${r.id}`);
  return { ok: true };
}, { role: 'user' });

// ───────── Événements de l'organisateur
const eventFields = body => [
  str(body.title, { required: true, max: 120, label: 'Titre' }), date(body.date, { required: true }),
  str(body.start_time, { max: 5 }), str(body.end_time, { max: 5 }), str(body.city, { max: 80 }), str(body.venue, { max: 120 }),
  body.event_type ? oneOf(body.event_type, EVENT_TYPES, 'Type') : null,
  JSON.stringify((Array.isArray(body.styles) ? body.styles : String(body.styles || '').split(',')).map(s => s.trim()).filter(Boolean)),
  int(body.capacity, { label: 'Capacité' }), int(body.budget, { label: 'Budget' }), str(body.description, { max: 2000 }), str(body.photo, { max: 300 }),
];

route('GET', '/api/events', ({ user }) => ({
  items: all('SELECT * FROM events WHERE organizer_id = ? ORDER BY date', user.id).map(e => ({ ...e, styles: J(e.styles),
    requests: all('SELECT id, dj_id, status FROM booking_requests WHERE event_id = ?', e.id).map(r => ({ ...r, dj: get('SELECT stage_name, photo FROM dj_profiles WHERE user_id = ?', r.dj_id) })) })),
}), { role: 'organizer' });

route('POST', '/api/events', ({ user, body }) => {
  const id = insert(`INSERT INTO events (organizer_id, title, date, start_time, end_time, city, venue, event_type, styles, capacity, budget, description, photo, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, user.id, ...eventFields(body), now());
  return { id };
}, { role: 'organizer' });

route('PATCH', '/api/events/:id', ({ user, params, body }) => {
  get('SELECT 1 FROM events WHERE id = ? AND organizer_id = ?', params.id, user.id) || fail(404, 'Événement introuvable.');
  run(`UPDATE events SET title = ?, date = ?, start_time = ?, end_time = ?, city = ?, venue = ?, event_type = ?, styles = ?, capacity = ?, budget = ?, description = ?, photo = COALESCE(?, photo), status = ? WHERE id = ?`,
    ...eventFields(body), oneOf(body.status || 'planning', ['planning', 'dj_found', 'done', 'cancelled'], 'Statut'), params.id);
  return { ok: true };
}, { role: 'organizer' });

route('DELETE', '/api/events/:id', ({ user, params }) => {
  run('DELETE FROM events WHERE id = ? AND organizer_id = ?', params.id, user.id);
  return { ok: true };
}, { role: 'organizer' });

// ───────── Favoris
route('GET', '/api/favorites', ({ user }) => ({
  items: all(`SELECT d.*, u.city, f.created_at fav_at, (SELECT AVG(rating) FROM reviews r WHERE r.dj_id = d.user_id) rating,
    (SELECT COUNT(*) FROM reviews r WHERE r.dj_id = d.user_id) reviews FROM favorites f JOIN dj_profiles d ON d.user_id = f.dj_id JOIN users u ON u.id = d.user_id WHERE f.organizer_id = ? ORDER BY f.created_at DESC`, user.id).map(djCard),
}), { role: 'organizer' });

route('POST', '/api/favorites/:djId', ({ user, params }) => {
  const id = Number(params.djId);
  get('SELECT 1 FROM dj_profiles WHERE user_id = ?', id) || fail(404, 'DJ introuvable.');
  const exists = get('SELECT 1 FROM favorites WHERE organizer_id = ? AND dj_id = ?', user.id, id);
  if (exists) run('DELETE FROM favorites WHERE organizer_id = ? AND dj_id = ?', user.id, id);
  else run('INSERT INTO favorites (organizer_id, dj_id, created_at) VALUES (?, ?, ?)', user.id, id, now());
  return { favorite: !exists };
}, { role: 'organizer' });

// ───────── Tableau de bord organisateur
route('GET', '/api/organizer/overview', ({ user }) => {
  const reqs = all('SELECT * FROM booking_requests WHERE organizer_id = ? ORDER BY updated_at DESC', user.id).map(hydrate);
  return {
    events: all("SELECT * FROM events WHERE organizer_id = ? AND date >= ? AND status != 'cancelled' ORDER BY date LIMIT 5", user.id, today()).map(e => ({ ...e, styles: J(e.styles) })),
    requests: reqs.slice(0, 6),
    counts: {
      pending: reqs.filter(r => r.status === 'pending').length,
      quoted: reqs.filter(r => r.status === 'quoted').length,
      confirmed: reqs.filter(r => r.status === 'confirmed').length,
      favorites: get('SELECT COUNT(*) n FROM favorites WHERE organizer_id = ?', user.id).n,
    },
  };
}, { role: 'organizer' });
