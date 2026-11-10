import { get, all, insert, now, J, today, addDays } from '../db.js';
import { route, fail, str, oneOf } from '../http.js';

export function djCard(row) {
  return {
    id: row.user_id, slug: row.slug, stage_name: row.stage_name, city: row.city,
    styles: J(row.styles), event_types: J(row.event_types),
    price_min: row.price_min, price_max: row.price_max, experience_years: row.experience_years,
    photo: row.photo, cover: row.cover, accent: row.accent,
    rating: row.rating ? Math.round(row.rating * 10) / 10 : null, reviews: row.reviews || 0,
    bookings: row.bookings || 0, is_demo: row.is_demo,
  };
}

const DJ_SELECT = `SELECT d.*, u.city, u.is_demo,
  (SELECT AVG(rating) FROM reviews r WHERE r.dj_id = d.user_id) rating,
  (SELECT COUNT(*) FROM reviews r WHERE r.dj_id = d.user_id) reviews,
  (SELECT COUNT(*) FROM booking_requests b WHERE b.dj_id = d.user_id AND b.status IN ('confirmed','completed')) bookings
  FROM dj_profiles d JOIN users u ON u.id = d.user_id WHERE u.suspended = 0 AND d.marketplace_visible = 1`;

export function isAvailable(djId, date) {
  return !get(`SELECT 1 FROM dj_blocked_dates WHERE dj_id = ? AND date = ?
    UNION SELECT 1 FROM booking_requests WHERE dj_id = ? AND date = ? AND status IN ('confirmed','completed')`, djId, date, djId, date);
}

route('GET', '/api/djs', ({ query }) => {
  let rows = all(DJ_SELECT + ' ORDER BY bookings DESC, d.stage_name');
  const q = (query.q || '').toLowerCase().trim();
  rows = rows.map(djCard).filter(d =>
    (!q || d.stage_name.toLowerCase().includes(q) || d.styles.some(s => s.toLowerCase().includes(q))) &&
    (!query.style || d.styles.includes(query.style)) &&
    (!query.city || d.city === query.city) &&
    (!query.event_type || d.event_types.includes(query.event_type)) &&
    (!query.budget || (d.price_min ?? 0) <= Number(query.budget)) &&
    (!query.experience || (d.experience_years ?? 0) >= Number(query.experience)) &&
    (!query.date || isAvailable(d.id, query.date)));
  const facets = all(DJ_SELECT).map(djCard);
  return {
    items: rows,
    facets: {
      styles: [...new Set(facets.flatMap(d => d.styles))].sort((a, b) => a.localeCompare(b, 'fr')),
      cities: [...new Set(facets.map(d => d.city).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr')),
      event_types: [...new Set(facets.flatMap(d => d.event_types))].sort((a, b) => a.localeCompare(b, 'fr')),
    },
  };
});

route('GET', '/api/djs/:slug', ({ params, user }) => {
  const row = get(DJ_SELECT + ' AND d.slug = ?', params.slug);
  if (!row) fail(404, 'Profil introuvable.');
  const u = get('SELECT id, name, bio, avatar, created_at FROM users WHERE id = ?', row.user_id);
  const dj = { ...djCard(row), bio: u.bio, user_id: u.id, member_since: u.created_at, is_demo: row.is_demo,
    gallery: J(row.gallery), tracks: J(row.tracks), experiences: J(row.experiences) };
  Object.assign(dj, { tagline: row.tagline, instagram: row.instagram, presskit_url: row.presskit_url, booking_email: row.booking_email, mix_url: row.mix_url });
  // « Ils m'ont programmé·e » : dates réalisées (hors plateforme et via AFTR), choix affiché par le DJ dans son press kit
  const seen = new Set();
  dj.played = [
    ...all("SELECT title, city, date FROM studio_gigs WHERE owner_id = ? AND status = 'done'", row.user_id),
    ...all("SELECT event_title title, city, date FROM booking_requests WHERE dj_id = ? AND status = 'completed'", row.user_id),
  ].sort((x, y) => y.date.localeCompare(x.date)).filter(p => { const k = p.title.toLowerCase().replace(/[^a-z0-9]/g, ''); if (seen.has(k)) return false; seen.add(k); return true; });
  dj.reviews_list = all(`SELECT r.rating, r.body, r.created_at, COALESCE(o.org_name, u.name) author FROM reviews r
    JOIN users u ON u.id = r.author_id LEFT JOIN organizer_profiles o ON o.user_id = u.id WHERE r.dj_id = ? ORDER BY r.created_at DESC`, row.user_id);
  // Disponibilités sur 8 semaines : dates bloquées + bookings confirmés
  const busy = new Set([
    ...all('SELECT date FROM dj_blocked_dates WHERE dj_id = ?', row.user_id).map(r => r.date),
    ...all("SELECT date FROM booking_requests WHERE dj_id = ? AND status IN ('confirmed','completed')", row.user_id).map(r => r.date),
  ]);
  dj.availability = Array.from({ length: 56 }, (_, i) => { const d = addDays(today(), i); return { date: d, busy: busy.has(d) }; });
  dj.followers = get('SELECT COUNT(*) n FROM follows WHERE followee_id = ?', row.user_id).n;
  dj.posts = all(`SELECT id, body, media, kind, created_at FROM posts WHERE author_id = ? AND hidden = 0 AND shared_post_id IS NULL ORDER BY created_at DESC LIMIT 6`, row.user_id)
    .map(p => ({ ...p, media: J(p.media) }));
  if (user) {
    dj.is_favorite = !!get('SELECT 1 FROM favorites WHERE organizer_id = ? AND dj_id = ?', user.id, row.user_id);
    dj.is_following = !!get('SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?', user.id, row.user_id);
  }
  return { dj };
});

// Chiffres de la page d'accueil, calculés depuis la base
route('GET', '/api/public/stats', () => ({
  djs: get("SELECT COUNT(*) n FROM user_roles WHERE role = 'dj'").n,
  organizers: get("SELECT COUNT(*) n FROM user_roles WHERE role = 'organizer'").n,
  bookings: get("SELECT COUNT(*) n FROM booking_requests WHERE status IN ('confirmed','completed')").n,
  cities: get('SELECT COUNT(DISTINCT city) n FROM users WHERE city IS NOT NULL').n,
  posts: get('SELECT COUNT(*) n FROM posts').n,
  styles: [...new Set(all('SELECT styles FROM dj_profiles').flatMap(r => J(r.styles)))].length,
}));

route('GET', '/api/public/events', () => ({
  items: all(`SELECT e.id, e.title, e.date, e.city, e.venue, e.event_type, e.photo, e.styles, o.org_name FROM events e
    JOIN organizer_profiles o ON o.user_id = e.organizer_id WHERE e.date >= ? AND e.status != 'cancelled' ORDER BY e.date LIMIT 6`, today())
    .map(e => ({ ...e, styles: J(e.styles) })),
}));

// Formulaire de contact : crée un vrai ticket de support visible dans l'admin
route('POST', '/api/contact', ({ body, user }) => {
  const name = str(body.name, { required: true, max: 80, label: 'Nom' });
  const email = str(body.email, { required: true, max: 160, label: 'E-mail' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail(400, 'E-mail : adresse invalide.');
  const subject = str(body.subject, { required: true, max: 120, label: 'Objet' });
  const message = str(body.message, { required: true, max: 3000, label: 'Message' });
  const category = oneOf(body.category || 'Question', ['Question', 'Compte', 'Réservation', 'Partenariat', 'Presse', 'Autre'], 'Catégorie');
  const id = insert('INSERT INTO support_tickets (user_id, name, email, subject, category, created_at) VALUES (?, ?, ?, ?, ?, ?)', user?.id ?? null, name, email, subject, category, now());
  insert('INSERT INTO ticket_messages (ticket_id, author, body, created_at) VALUES (?, ?, ?, ?)', id, 'client', message, now());
  return { ok: true, ticket: id };
});
