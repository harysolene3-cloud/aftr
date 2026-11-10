// « Ma com' » : stratégie marketing personnelle du DJ, suivi de ses publications et de ses abonnés.
// Les statistiques sont saisies par le DJ : aucun compte Instagram / TikTok n'est connecté.
// Comme le reste du Business Studio, ces données sont privées (owner_id).
import { get, all, run, insert, now, today, addDays } from '../db.js';
import { route, fail, str, int, date, oneOf } from '../http.js';

const opt = { role: 'dj' };
const NETWORKS = ['Instagram', 'TikTok', 'YouTube', 'Facebook'];
const FORMATS = ['Reel', 'Vidéo courte', 'Carrousel', 'Photo', 'Story', 'Live'];
const GOALS = {
  dates_city: 'Décrocher des dates dans une nouvelle ville',
  followers: 'Gagner des abonnés',
  fill: 'Remplir mon calendrier',
  brand: 'Construire mon image d\'artiste',
};
const engagement = p => p.views ? ((p.likes || 0) + (p.comments || 0) + (p.shares || 0) + (p.saves || 0)) / p.views : null;
const pct = x => x == null ? null : Math.round(x * 1000) / 10;
const fr = n => String(n).replace('.', ',');

function postFields(body) {
  return [
    oneOf(body.network, NETWORKS, 'Réseau'), body.format ? oneOf(body.format, FORMATS, 'Format') : null,
    str(body.title, { required: true, max: 160, label: 'Titre' }), str(body.caption, { max: 2200 }), str(body.link, { max: 300 }),
    body.clip_id ? Number(body.clip_id) : null, body.gig_id ? Number(body.gig_id) : null,
    oneOf(body.status || 'idea', ['idea', 'planned', 'published'], 'Statut'), date(body.planned_date), date(body.published_date),
    ...['views', 'likes', 'comments', 'shares', 'saves', 'followers_gained'].map(k => int(body[k], { label: 'Statistique' })),
  ];
}
const own = (id, userId) => get('SELECT * FROM studio_posts WHERE id = ? AND owner_id = ?', id, userId) || fail(404, 'Publication introuvable.');

route('GET', '/api/studio/posts', ({ user }) => ({
  items: all(`SELECT p.*, c.title clip_title, c.file clip_file, g.title gig_title FROM studio_posts p
    LEFT JOIN studio_clips c ON c.id = p.clip_id LEFT JOIN studio_gigs g ON g.id = p.gig_id
    WHERE p.owner_id = ? ORDER BY COALESCE(p.published_date, p.planned_date, substr(p.created_at, 1, 10)) DESC`, user.id)
    .map(p => ({ ...p, engagement: pct(engagement(p)) })),
  gigs: all("SELECT id, title, date FROM studio_gigs WHERE owner_id = ? AND status != 'cancelled' ORDER BY date DESC", user.id),
  clips: all('SELECT id, title, format FROM studio_clips WHERE owner_id = ? ORDER BY created_at DESC', user.id),
}), opt);

route('POST', '/api/studio/posts', ({ user, body }) => ({
  id: insert(`INSERT INTO studio_posts (owner_id, network, format, title, caption, link, clip_id, gig_id, status, planned_date, published_date, views, likes, comments, shares, saves, followers_gained, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, user.id, ...postFields(body), now()),
}), opt);
route('PATCH', '/api/studio/posts/:id', ({ user, params, body }) => {
  const p = own(params.id, user.id);
  const merged = { ...p, ...body };
  if (body.status === 'published' && !merged.published_date) merged.published_date = today();
  run(`UPDATE studio_posts SET network = ?, format = ?, title = ?, caption = ?, link = ?, clip_id = ?, gig_id = ?, status = ?, planned_date = ?, published_date = ?,
    views = ?, likes = ?, comments = ?, shares = ?, saves = ?, followers_gained = ?, is_example = 0 WHERE id = ? AND owner_id = ?`, ...postFields(merged), p.id, user.id);
  return { ok: true };
}, opt);
route('DELETE', '/api/studio/posts/:id', ({ user, params }) => { own(params.id, user.id); run('DELETE FROM studio_posts WHERE id = ? AND owner_id = ?', params.id, user.id); return { ok: true }; }, opt);

route('POST', '/api/studio/followers', ({ user, body }) => ({
  id: insert('INSERT INTO studio_followers (owner_id, network, date, count) VALUES (?, ?, ?, ?)', user.id, oneOf(body.network, NETWORKS, 'Réseau'),
    date(body.date) || today(), int(body.count, { required: true, max: 100_000_000, label: 'Abonnés' })),
}), opt);

route('DELETE', '/api/studio/marketing/examples', ({ user }) => {
  run('DELETE FROM studio_posts WHERE owner_id = ? AND is_example = 1', user.id);
  run('DELETE FROM studio_followers WHERE owner_id = ? AND is_example = 1', user.id);
  return { ok: true };
}, opt);

route('PUT', '/api/studio/marketing/goal', ({ user, body }) => {
  run(`INSERT INTO studio_marketing (owner_id, goal, target_city, posts_per_week) VALUES (?, ?, ?, ?)
    ON CONFLICT(owner_id) DO UPDATE SET goal = excluded.goal, target_city = excluded.target_city, posts_per_week = excluded.posts_per_week`,
    user.id, oneOf(body.goal, Object.keys(GOALS), 'Objectif'), str(body.target_city, { max: 80 }), int(body.posts_per_week, { min: 1, max: 21, label: 'Rythme' }) || 3);
  return { ok: true };
}, opt);

// Vue d'ensemble : chiffres calculés depuis les publications saisies, idées tirées des dates, recommandations par règles
route('GET', '/api/studio/marketing', ({ user }) => {
  const t = today();
  const posts = all('SELECT * FROM studio_posts WHERE owner_id = ?', user.id);
  const published = posts.filter(p => p.status === 'published');
  const withViews = published.filter(p => p.views);
  const sum = k => published.reduce((s, p) => s + (p[k] || 0), 0);
  const rate = list => { const v = list.reduce((s, p) => s + (p.views || 0), 0); return v ? pct(list.reduce((s, p) => s + (p.likes || 0) + (p.comments || 0) + (p.shares || 0) + (p.saves || 0), 0) / v) : null; };
  const group = key => Object.entries(withViews.reduce((acc, p) => { (acc[p[key] || '—'] ||= []).push(p); return acc; }, {}))
    .map(([k, list]) => ({ key: k, posts: list.length, avg_views: Math.round(list.reduce((s, p) => s + p.views, 0) / list.length), engagement: rate(list) }))
    .sort((a, b) => (b.engagement || 0) - (a.engagement || 0));
  const last28 = published.filter(p => p.published_date && p.published_date >= addDays(t, -28)).length;
  const settings = get('SELECT * FROM studio_marketing WHERE owner_id = ?', user.id) || { goal: null, posts_per_week: 3 };

  // Abonnés : dernier relevé par réseau et évolution sur 30 jours
  const snaps = all('SELECT * FROM studio_followers WHERE owner_id = ? ORDER BY date', user.id);
  const followers = NETWORKS.map(n => {
    const s = snaps.filter(x => x.network === n);
    if (!s.length) return null;
    const last = s.at(-1), ref = [...s].reverse().find(x => x.date <= addDays(last.date, -30)) || s[0];
    return { network: n, count: last.count, date: last.date, delta: last.count - ref.count, since: ref.date, series: s.map(x => ({ date: x.date, count: x.count })), example: s.some(x => x.is_example) };
  }).filter(Boolean);

  // Idées de publications à partir des dates (annonce avant, récap après)
  const gigs = all("SELECT * FROM studio_gigs WHERE owner_id = ? AND status IN ('confirmed','option','done') AND date BETWEEN ? AND ?", user.id, addDays(t, -14), addDays(t, 30));
  const reqs = all("SELECT id, event_title title, date, city FROM booking_requests WHERE dj_id = ? AND status IN ('confirmed','completed') AND date BETWEEN ? AND ?", user.id, addDays(t, -14), addDays(t, 30));
  const linked = new Set(posts.map(p => p.gig_id).filter(Boolean));
  const ideas = [];
  for (const g of [...gigs.map(g => ({ ...g, gig_id: g.id })), ...reqs]) {
    const where = [g.venue, g.city].filter(Boolean).join(', ');
    if (g.date >= t && !(g.gig_id && linked.has(g.gig_id))) ideas.push({ date: addDays(g.date, -3) < t ? t : addDays(g.date, -3), network: 'Instagram', format: 'Carrousel', gig_id: g.gig_id || null, title: `Annonce : ${g.title}`, why: `Ta date du ${g.date.split('-').reverse().join('/')}${where ? ` (${where})` : ''} approche : annonce-la 3 jours avant en identifiant l'organisateur.` });
    if (g.date < t || g.date <= addDays(t, 7)) ideas.push({ date: addDays(g.date, 1) < t ? t : addDays(g.date, 1), network: 'TikTok', format: 'Vidéo courte', gig_id: g.gig_id || null, title: `Récap : ${g.title}`, why: 'Le lendemain d\'une date : un clip vertical du meilleur moment (Set Clipper) et un merci à l\'orga.' });
  }
  ideas.sort((a, b) => a.date.localeCompare(b.date));

  // Recommandations : chaque ligne indique si elle s'appuie sur tes données ou sur une hypothèse
  const recos = [];
  const target = settings.posts_per_week || 3;
  const perWeek = Math.round(last28 / 4 * 10) / 10;
  recos.push(perWeek < target
    ? { nature: 'reel', text: `Tu publies ${fr(perWeek)} fois par semaine (28 derniers jours) pour un objectif de ${target}. Planifie tes prochaines idées ci-dessous pour tenir le rythme.` }
    : { nature: 'reel', text: `Rythme tenu : ${fr(perWeek)} publications par semaine pour un objectif de ${target}.` });
  const byNet = group('network'), byFormat = group('format');
  if (byNet.length > 1) recos.push({ nature: 'reel', text: `${byNet[0].key} t'apporte le meilleur engagement (${fr(byNet[0].engagement)} %) contre ${fr(byNet.at(-1).engagement)} % sur ${byNet.at(-1).key}. Mets-y tes contenus les plus forts.` });
  if (byFormat.length) recos.push({ nature: 'reel', text: `Ton format le plus engageant : ${byFormat[0].key} (${fr(byFormat[0].engagement)} % d'engagement, ${byFormat[0].avg_views} vues en moyenne).` });
  const clips = get('SELECT COUNT(*) n FROM studio_clips WHERE owner_id = ?', user.id).n;
  if (!clips) recos.push({ nature: 'methode', text: 'Tu n\'as encore exporté aucun clip : passe un de tes sets dans le Set Clipper pour préparer tes vidéos courtes.' });
  const goal = settings.goal;
  if (goal === 'dates_city' && settings.target_city) {
    const city = settings.target_city;
    const played = all("SELECT COUNT(*) n FROM studio_gigs WHERE owner_id = ? AND status = 'done' AND lower(city) = lower(?)", user.id, city)[0].n;
    const prospects = all("SELECT name FROM studio_contacts WHERE owner_id = ? AND lower(city) = lower(?) AND stage NOT IN ('won','lost')", user.id, city);
    recos.push({ nature: 'reel', text: `${city} : ${played} date${played > 1 ? 's' : ''} déjà jouée${played > 1 ? 's' : ''}, ${prospects.length} orga${prospects.length > 1 ? 's' : ''} en prospection${prospects.length ? ` (${prospects.map(p => p.name).join(', ')})` : ''}.` });
    recos.push({ nature: 'hypothese', text: `Publie des extraits qui parlent au public de ${city} (hashtags locaux, soirées de la ville) et envoie ton press kit aux orgas juste après une publication qui marche.` });
  }
  if (goal === 'followers') recos.push({ nature: 'hypothese', text: 'Les vidéos courtes et les collaborations (B2B, posts communs avec un autre DJ) sont les leviers les plus rapides pour gagner des abonnés.' });
  if (goal === 'fill') {
    const free = Array.from({ length: 6 }, (_, i) => addDays(t, (6 - new Date(t).getDay() + 7) % 7 + i * 7)).filter(sat => !get("SELECT 1 FROM studio_gigs WHERE owner_id = ? AND date = ? AND status != 'cancelled' UNION SELECT 1 FROM booking_requests WHERE dj_id = ? AND date = ? AND status IN ('confirmed','completed')", user.id, sat, user.id, sat));
    recos.push({ nature: 'reel', text: `${free.length} samedi${free.length > 1 ? 's' : ''} libre${free.length > 1 ? 's' : ''} sur les 6 prochaines semaines. Une story « dispos » avec ces dates et ton press kit peut déclencher des demandes.` });
  }
  if (goal === 'brand') recos.push({ nature: 'hypothese', text: 'Garde une identité constante : mêmes couleurs, même typo sur les clips (signature AFTR désactivable), et un format récurrent (ex. « le drop de la semaine »).' });

  return {
    settings, goals: GOALS, recos,
    totals: { published: published.length, planned: posts.filter(p => p.status === 'planned').length, ideas: posts.filter(p => p.status === 'idea').length, views: sum('views'), followers_gained: sum('followers_gained'), engagement: rate(withViews), per_week: perWeek },
    by_network: byNet, by_format: byFormat,
    best: withViews.sort((a, b) => b.views - a.views).slice(0, 3).map(p => ({ ...p, engagement: pct(engagement(p)) })),
    upcoming: posts.filter(p => p.status === 'planned' && p.planned_date >= t).sort((a, b) => a.planned_date.localeCompare(b.planned_date)).slice(0, 6),
    followers, ideas: ideas.slice(0, 8),
    has_examples: posts.some(p => p.is_example) || snaps.some(s => s.is_example),
  };
}, opt);
