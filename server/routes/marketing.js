// Marketing Hub et Analytics. Les « générateurs » sont des moteurs à base de règles et de modèles
// alimentés par les données réelles d'AFTR : ce n'est pas de l'IA générative (aucune clé IA configurée).
import { get, all, run, insert, now, J, tx, today, addDays } from '../db.js';
import { route, fail, notify, str, int, date, oneOf } from '../http.js';
import { profileCompleteness, PLANS } from './admin.js';

const opt = { role: 'admin' };
const CAL_STATUSES = ['idea', 'draft', 'review', 'approved', 'scheduled', 'published', 'archived'];
const pct = (a, b) => b ? Math.round(a / b * 1000) / 10 : 0;

// ───────── Analytics (tout est calculé depuis la base)
export function analytics() {
  const t = today(), d7 = addDays(t, -7), d30 = addDays(t, -30), d60 = addDays(t, -60);
  const users = all('SELECT u.id, u.created_at, u.last_active_at, u.source, (SELECT GROUP_CONCAT(role) FROM user_roles WHERE user_id = u.id) roles FROM users u')
    .map(u => ({ ...u, roles: (u.roles || '').split(',') })).filter(u => !u.roles.includes('admin'));
  const weeks = Array.from({ length: 12 }, (_, i) => { const end = addDays(t, -7 * (11 - i)); const start = addDays(end, -6); return { start, end }; });
  const reqs = all('SELECT status, created_at, budget, quote_amount FROM booking_requests');
  const decided = reqs.filter(r => r.status !== 'pending');
  const won = reqs.filter(r => ['confirmed', 'completed'].includes(r.status));
  const sources = {};
  for (const u of users) sources[u.source || 'Direct'] = (sources[u.source || 'Direct'] || 0) + 1;
  const active30 = users.filter(u => u.last_active_at >= d30).length;
  const old = users.filter(u => u.created_at < d30);
  const posts30 = get('SELECT COUNT(*) n FROM posts WHERE created_at >= ?', d30).n;
  const comments30 = get('SELECT COUNT(*) n FROM comments WHERE created_at >= ?', d30).n;
  const reactions30 = get('SELECT COUNT(*) n FROM reactions WHERE created_at >= ?', d30).n;
  const campaigns = all('SELECT * FROM campaigns ORDER BY start_date DESC').map(c => {
    const signups = c.source_key ? users.filter(u => u.source === c.source_key && (!c.start_date || u.created_at.slice(0, 10) >= c.start_date) && (!c.end_date || u.created_at.slice(0, 10) <= c.end_date)) : [];
    return { ...c, signups: signups.length, organizers: signups.filter(u => u.roles.includes('organizer')).length, djs: signups.filter(u => u.roles.includes('dj')).length,
      cost_per_signup: c.budget && signups.length ? Math.round(c.budget / signups.length) : null };
  });
  return {
    totals: {
      users: users.length, djs: users.filter(u => u.roles.includes('dj')).length, organizers: users.filter(u => u.roles.includes('organizer')).length,
      new_30: users.filter(u => u.created_at >= d30).length, new_prev_30: users.filter(u => u.created_at >= d60 && u.created_at < d30).length,
      active_7: users.filter(u => u.last_active_at >= d7).length, active_30: active30,
    },
    signups_by_week: weeks.map(w => ({ week: w.start, djs: users.filter(u => u.created_at.slice(0, 10) >= w.start && u.created_at.slice(0, 10) <= w.end && u.roles.includes('dj')).length,
      organizers: users.filter(u => u.created_at.slice(0, 10) >= w.start && u.created_at.slice(0, 10) <= w.end && u.roles.includes('organizer') && !u.roles.includes('dj')).length })),
    bookings: {
      requests: reqs.length, confirmed: won.length, response_rate: pct(decided.length, reqs.length), conversion: pct(won.length, reqs.length),
      by_status: Object.fromEntries(['pending', 'quoted', 'confirmed', 'completed', 'declined', 'cancelled'].map(s => [s, reqs.filter(r => r.status === s).length])),
      value: won.reduce((s, r) => s + (r.quote_amount || r.budget || 0), 0),
    },
    sources: Object.entries(sources).sort((a, b) => b[1] - a[1]).map(([source, n]) => ({ source, n, share: pct(n, users.length) })),
    engagement: { posts_30: posts30, comments_30: comments30, reactions_30: reactions30, per_active_user: active30 ? Math.round((posts30 + comments30 + reactions30) / active30 * 10) / 10 : 0 },
    retention: { base: old.length, retained: old.filter(u => u.last_active_at >= d30).length, rate: pct(old.filter(u => u.last_active_at >= d30).length, old.length) },
    subscriptions: { paying: all("SELECT plan FROM subscriptions WHERE status = 'active'").filter(s => PLANS[s.plan].price > 0).length },
    campaigns,
  };
}
route('GET', '/api/admin/analytics', () => analytics(), opt);

// ───────── AI Marketing Strategist (moteur de règles, données réelles + hypothèses explicites)
const METRICS = {
  organizer_signups: { label: 'inscriptions d\'organisateurs', segment: 'organizer' },
  dj_signups: { label: 'inscriptions de DJs', segment: 'dj' },
  bookings: { label: 'bookings confirmés', segment: 'organizer' },
  engagement: { label: 'interactions dans la communauté', segment: 'dj' },
};
// Hypothèses de performance par canal (non mesurées sur AFTR : repères sectoriels à valider)
const CHANNELS = {
  Instagram: { fit: { dj: 3, organizer: 2 }, why: 'Format visuel adapté aux sets, coulisses et profils d\'artistes.', hyp: 'Taux d\'engagement visé de 3 à 5 % sur les Reels.' },
  TikTok: { fit: { dj: 3, organizer: 1 }, why: 'Diffusion organique forte des extraits de sets et des transitions.', hyp: 'Un clip sur dix dépasse la portée habituelle du compte.' },
  LinkedIn: { fit: { dj: 1, organizer: 3 }, why: 'Atteint les agences événementielles, services RH et wedding planners.', hyp: 'Taux de réponse de 10 à 15 % sur des messages personnalisés.' },
  Facebook: { fit: { dj: 1, organizer: 2 }, why: 'Groupes locaux d\'organisateurs, associations et BDE.', hyp: 'Publications dans 5 à 10 groupes ciblés par mois.' },
  Newsletter: { fit: { dj: 2, organizer: 2 }, why: 'Canal possédé pour activer la base existante.', hyp: 'Taux d\'ouverture visé de 30 à 40 % (non mesurable tant que l\'envoi n\'est pas connecté).' },
  Partenariats: { fit: { dj: 2, organizer: 3 }, why: 'Clubs, écoles et collectifs peuvent recommander AFTR à leur réseau.', hyp: 'Deux à trois partenariats actifs génèrent un flux régulier d\'inscriptions.' },
};

route('POST', '/api/admin/strategist', ({ body }) => {
  const metric = oneOf(body.metric, Object.keys(METRICS), 'Indicateur');
  const target = int(body.target_pct, { required: true, min: 1, max: 500, label: 'Objectif (%)' });
  const weeks = int(body.weeks, { required: true, min: 2, max: 52, label: 'Durée (semaines)' });
  const budget = int(body.budget, { label: 'Budget' }) || 0;
  const objective = str(body.objective, { required: true, max: 300, label: 'Objectif' });
  const a = analytics();
  const m = METRICS[metric];
  const t = today(), d30 = addDays(t, -30);

  // Données réelles
  const baselineMap = {
    organizer_signups: all("SELECT u.created_at FROM users u JOIN user_roles r ON r.user_id = u.id AND r.role = 'organizer' WHERE u.created_at >= ?", d30).length,
    dj_signups: all("SELECT u.created_at FROM users u JOIN user_roles r ON r.user_id = u.id AND r.role = 'dj' WHERE u.created_at >= ?", d30).length,
    bookings: get("SELECT COUNT(*) n FROM booking_history WHERE status = 'confirmed' AND created_at >= ?", d30).n,
    engagement: a.engagement.posts_30 + a.engagement.comments_30 + a.engagement.reactions_30,
  };
  const baseline = baselineMap[metric];
  const periodBase = Math.round(baseline * weeks / 4.3);
  const goal = Math.max(Math.ceil(periodBase * (1 + target / 100)), periodBase + 1);
  const segSources = all(`SELECT u.source, COUNT(*) n FROM users u JOIN user_roles r ON r.user_id = u.id AND r.role = ? GROUP BY u.source ORDER BY n DESC`, m.segment);
  const orgTypes = all('SELECT org_type, COUNT(*) n FROM organizer_profiles WHERE org_type IS NOT NULL GROUP BY org_type ORDER BY n DESC');
  const topStyles = Object.entries(all('SELECT styles FROM dj_profiles').flatMap(r => J(r.styles)).reduce((acc, s) => (acc[s] = (acc[s] || 0) + 1, acc), {})).sort((x, y) => y[1] - x[1]).slice(0, 4);
  const cities = all('SELECT city, COUNT(*) n FROM users WHERE city IS NOT NULL GROUP BY city ORDER BY n DESC LIMIT 4');
  const incomplete = all("SELECT user_id FROM dj_profiles").filter(r => profileCompleteness(r.user_id) < 60).length;

  const facts = [
    { label: `${m.label[0].toUpperCase() + m.label.slice(1)} sur les 30 derniers jours`, value: String(baseline), nature: 'reel' },
    { label: 'Membres inscrits', value: `${a.totals.users} (${a.totals.djs} DJs, ${a.totals.organizers} organisateurs)`, nature: 'reel' },
    { label: 'Utilisateurs actifs (30 j)', value: `${a.totals.active_30}`, nature: 'reel' },
    { label: 'Demandes de réservation → booking confirmé', value: `${a.bookings.conversion} %`, nature: 'reel' },
    { label: 'Première source d\'acquisition du segment', value: segSources[0] ? `${segSources[0].source || 'Direct'} (${segSources[0].n} inscrits)` : 'Aucune donnée', nature: 'reel' },
    { label: 'Profils DJ complétés à moins de 60 %', value: String(incomplete), nature: 'reel' },
  ];
  const ranked = Object.entries(CHANNELS).map(([name, c]) => {
    const measured = segSources.find(s => (s.source || '').toLowerCase().includes(name.toLowerCase()));
    return { name, score: c.fit[m.segment] * 2 + (measured ? Math.min(3, measured.n / 3) : 0), why: c.why, hypothesis: c.hyp, measured: measured ? `${measured.n} inscrits de ce segment viennent déjà de ce canal` : null };
  }).sort((x, y) => y.score - x.score);
  const channels = ranked.slice(0, 4);
  const perChannel = budget ? Math.round(budget / channels.length) : 0;
  const phase = n => Math.max(1, Math.round(weeks * n));
  const plan = [
    { weeks: `S1 à S${phase(0.25)}`, title: 'Préparer', actions: ['Mettre à jour les messages clés et les visuels', `Construire une liste de prospects ${m.segment === 'organizer' ? (orgTypes.map(o => o.org_type).slice(0, 3).join(', ') || 'organisateurs') : 'DJs'} dans le CRM`, 'Créer les contenus de lancement dans le Social Media Studio'] },
    { weeks: `S${phase(0.25) + 1} à S${phase(0.75)}`, title: 'Activer', actions: channels.map(c => `${c.name} : ${c.why.toLowerCase()}`) },
    { weeks: `S${phase(0.75) + 1} à S${weeks}`, title: 'Optimiser', actions: ['Comparer les inscriptions par source dans Analytics', 'Réallouer le budget vers le canal le plus performant', 'Relancer les prospects non convertis'] },
  ];
  const calendar = channels.flatMap((c, i) => [0, 1].map(k => ({ date: addDays(t, 3 + i * 2 + k * Math.max(7, Math.round(weeks * 7 / 2))), network: c.name, title: `${c.name} — ${k ? 'relance' : 'lancement'} : ${objective.slice(0, 60)}` })))
    .sort((x, y) => x.date.localeCompare(y.date));
  const result = {
    summary: `Objectif : passer de ${periodBase} à ${goal} ${m.label} sur ${weeks} semaines (+${target} %).`,
    situation: { facts, reading: [
      baseline === 0 ? `Aucune ${m.label.replace(/s$/, '')} récente : l'objectif part d'une base très faible, les premiers résultats seront à interpréter avec prudence.` : `La base actuelle (${baseline} sur 30 jours) permet de suivre la progression semaine par semaine.`,
      `La communauté est concentrée sur ${cities.map(c => c.city).join(', ') || 'quelques villes'} : commencer par ces marchés limite la dispersion.`,
      `Styles les plus représentés : ${topStyles.map(s => s[0]).join(', ')}.`,
    ] },
    objectives: [
      { text: `Atteindre ${goal} ${m.label} en ${weeks} semaines`, nature: 'calcul' },
      { text: `Soit environ ${Math.ceil(goal / weeks)} par semaine`, nature: 'calcul' },
      metric !== 'bookings' ? { text: `Maintenir le taux de conversion demande → booking au-dessus de ${a.bookings.conversion} %`, nature: 'reel' } : { text: 'Répondre à 100 % des demandes en moins de 48 h', nature: 'hypothese' },
    ],
    targets: m.segment === 'organizer'
      ? orgTypes.map(o => ({ name: o.org_type, detail: `${o.n} déjà inscrits sur AFTR`, nature: 'reel' })).concat([{ name: 'Wedding planners et agences', detail: 'Besoins récurrents, panier élevé', nature: 'hypothese' }])
      : [{ name: 'DJs émergents (moins de 3 ans d\'expérience)', detail: 'Cherchent visibilité et premières dates', nature: 'hypothese' }, { name: 'DJs confirmés', detail: 'Cherchent des outils de gestion (devis, factures)', nature: 'hypothese' },
        ...topStyles.slice(0, 2).map(s => ({ name: `Communauté ${s[0]}`, detail: `${s[1]} DJs déjà présents`, nature: 'reel' }))],
    segmentation: [
      { name: 'Par ville', detail: cities.map(c => `${c.city} (${c.n})`).join(', '), nature: 'reel' },
      { name: 'Par niveau d\'activité', detail: `${a.totals.active_30} actifs / ${a.totals.users - a.totals.active_30} inactifs sur 30 jours`, nature: 'reel' },
      { name: 'Par source', detail: a.sources.slice(0, 4).map(s => `${s.source} ${s.share} %`).join(' · '), nature: 'reel' },
    ],
    positioning: m.segment === 'organizer'
      ? 'Pour les organisateurs : « Le bon DJ, au bon prix, sans relancer dix personnes ». Mettre en avant la recherche par style et budget, les avis et le suivi du devis au booking.'
      : 'Pour les DJs : « Ta communauté et ton business au même endroit ». Mettre en avant la visibilité auprès des organisateurs et les outils devis/factures.',
    channels: channels.map(c => ({ ...c, budget: perChannel || null })),
    recommendations: [
      { text: incomplete ? `Relancer les ${incomplete} DJs au profil incomplet : un profil complet rend la marketplace plus convaincante pour les organisateurs.` : 'Les profils DJ sont complets : capitaliser dessus dans les visuels.', nature: 'reel' },
      { text: `Doubler l'effort sur ${segSources[0]?.source || 'le canal principal'}, qui apporte déjà le plus d'inscrits de ce segment.`, nature: segSources[0] ? 'reel' : 'hypothese' },
      { text: 'Utiliser les clips du Set Clipper comme contenu principal sur Instagram et TikTok.', nature: 'hypothese' },
      { text: 'Suivre chaque action avec une source d\'inscription dédiée pour mesurer son effet dans Analytics.', nature: 'methode' },
    ],
    plan, calendar,
    kpis: [
      { name: m.label, baseline: periodBase, target: goal, nature: 'calcul' },
      { name: 'Utilisateurs actifs (30 j)', baseline: a.totals.active_30, target: Math.ceil(a.totals.active_30 * 1.1), nature: 'calcul' },
      { name: 'Conversion demande → booking', baseline: `${a.bookings.conversion} %`, target: `${Math.min(100, Math.round(a.bookings.conversion + 5))} %`, nature: 'hypothese' },
      budget ? { name: 'Coût par inscription', baseline: '—', target: `${Math.round(budget / Math.max(1, goal - periodBase))} €`, nature: 'calcul' } : null,
    ].filter(Boolean),
  };
  const id = insert('INSERT INTO strategies (objective, params, result, created_at) VALUES (?, ?, ?, ?)', objective, JSON.stringify({ metric, target, weeks, budget }), JSON.stringify(result), now());
  return { id, result };
}, opt);
route('GET', '/api/admin/strategies', () => ({ items: all('SELECT * FROM strategies ORDER BY created_at DESC').map(s => ({ ...s, params: J(s.params, {}), result: J(s.result, {}) })) }), opt);
route('POST', '/api/admin/strategies/:id/calendar', ({ params }) => {
  const s = get('SELECT * FROM strategies WHERE id = ?', params.id) || fail(404, 'Stratégie introuvable.');
  const items = J(s.result, {}).calendar || [];
  const net = n => ['Instagram', 'TikTok', 'LinkedIn', 'Facebook'].includes(n) ? n : 'Instagram';
  tx(() => { for (const c of items) insert("INSERT INTO marketing_contents (network, topic, objective, idea, scheduled_date, status, created_at) VALUES (?, ?, ?, ?, ?, 'idea', ?)", net(c.network), c.title, s.objective, c.title, c.date, now()); });
  return { added: items.length };
}, opt);

// ───────── Social Media Studio (modèles + données réelles)
const NETWORK_RULES = {
  Instagram: { day: 4, hour: '18:30', tags: ['#DJ', '#DJlife', '#Nightlife', '#ClubCulture'] },
  TikTok: { day: 5, hour: '19:00', tags: ['#DJ', '#DJTok', '#Mix', '#Transition'] },
  LinkedIn: { day: 2, hour: '09:00', tags: ['#Événementiel', '#Musique', '#Entrepreneuriat'] },
  Facebook: { day: 3, hour: '13:00', tags: ['#Soirée', '#DJ', '#Événement'] },
};
const TONES = {
  Inspirant: { open: 'Chaque grande soirée commence par une rencontre.', close: 'La nuit vous appartient.' },
  Fun: { open: 'Ton prochain set mérite mieux qu\'un DM perdu.', close: 'On se retrouve sur le dancefloor 🕺' },
  Expert: { open: 'Trouver le bon DJ prend en moyenne plusieurs échanges.', close: 'Des outils pensés par et pour le milieu.' },
  Communautaire: { open: 'Ici, les DJs partagent, s\'entraident et se recommandent.', close: 'Rejoins le mouvement.' },
};
function nextDay(dow) { const d = new Date(); d.setDate(d.getDate() + ((dow - d.getDay() + 7) % 7 || 7)); return d.toISOString().slice(0, 10); }

route('POST', '/api/admin/social/generate', ({ body }) => {
  const network = oneOf(body.network, Object.keys(NETWORK_RULES), 'Réseau');
  const tone = oneOf(body.tone || 'Inspirant', Object.keys(TONES), 'Ton');
  const topic = str(body.topic, { required: true, max: 160, label: 'Sujet' });
  const target = str(body.target, { max: 120 }) || 'DJs et organisateurs';
  const objective = str(body.objective, { max: 120 }) || 'Notoriété';
  const format = str(body.format, { max: 40 }) || (network === 'TikTok' ? 'Vidéo courte' : network === 'LinkedIn' ? 'Post texte' : 'Carrousel');
  const djs = get("SELECT COUNT(*) n FROM user_roles WHERE role = 'dj'").n;
  const style = Object.entries(all('SELECT styles FROM dj_profiles').flatMap(r => J(r.styles)).reduce((a, s) => (a[s] = (a[s] || 0) + 1, a), {})).sort((a, b) => b[1] - a[1])[0]?.[0];
  const ev = get("SELECT title, city, date FROM events WHERE date >= ? AND status != 'cancelled' ORDER BY date LIMIT 1", today());
  const tn = TONES[tone], rule = NETWORK_RULES[network];
  const ctaByObjective = { 'Inscriptions': 'Crée ton profil gratuitement sur AFTR (lien en bio).', 'Notoriété': 'Abonne-toi pour suivre les DJs de la communauté.', 'Engagement': 'Dis-nous en commentaire : quel est ton morceau de fin de soirée ?', 'Réservations': 'Trouve ton DJ en 3 filtres sur AFTR.' };
  const cta = ctaByObjective[objective] || 'Découvre AFTR.';
  const hookByNet = {
    Instagram: `${topic} : ce que personne ne te dit 👇`,
    TikTok: `POV : ${topic.toLowerCase()}`,
    LinkedIn: `${topic} — 3 enseignements après avoir accompagné ${djs} DJs.`,
    Facebook: `${topic} : on vous explique tout.`,
  };
  const caption = [tn.open, '', `${topic}.`, `Sur AFTR, ${djs} DJs${style ? `, dont beaucoup en ${style},` : ''} construisent leur réseau et leurs dates.`,
    ev ? `Prochain rendez-vous : ${ev.title} à ${ev.city}.` : null, '', cta, tn.close].filter(v => v !== null).join('\n');
  const tags = [...rule.tags, style ? '#' + style.replace(/[^\p{L}\p{N}]/gu, '') : null, '#AFTR'].filter(Boolean);
  return { content: {
    network, topic, target, objective, tone, format,
    idea: `${format} sur « ${topic} » pour ${target.toLowerCase()} — ${objective.toLowerCase()}.`,
    hook: hookByNet[network], caption, cta, hashtags: tags.join(' '),
    visual: network === 'TikTok' ? 'Clip vertical issu du Set Clipper : 3 s de montée, cut sur le drop, texte du hook en surimpression.'
      : network === 'LinkedIn' ? 'Photo en coulisses (préparation d\'un set) avec un chiffre clé de la plateforme en grand.'
      : 'Carrousel 4 visuels : photo de DJ plein cadre, puis 3 cartes texte jaune sur noir.',
    scheduled_date: nextDay(rule.day), recommended_time: rule.hour,
    method: 'Généré par modèles et données AFTR (pas d\'IA générative). Créneau recommandé : heuristique générale, non mesurée sur AFTR.',
  } };
}, opt);

const contentFields = body => [
  oneOf(body.network, Object.keys(NETWORK_RULES), 'Réseau'), str(body.topic, { max: 160 }), str(body.target, { max: 120 }), str(body.objective, { max: 120 }),
  str(body.tone, { max: 40 }), str(body.format, { max: 40 }), str(body.idea, { max: 500 }), str(body.hook, { max: 300 }), str(body.caption, { max: 3000 }),
  str(body.cta, { max: 300 }), str(body.hashtags, { max: 500 }), str(body.visual, { max: 500 }), date(body.scheduled_date), oneOf(body.status || 'draft', CAL_STATUSES, 'Statut'),
  body.visual_url && /^\/uploads\/[a-f0-9]+\.png$/.test(body.visual_url) ? body.visual_url : null,
];
route('GET', '/api/admin/contents', () => ({ items: all('SELECT * FROM marketing_contents ORDER BY COALESCE(scheduled_date, created_at) DESC') }), opt);
route('POST', '/api/admin/contents', ({ body }) => ({
  id: insert(`INSERT INTO marketing_contents (network, topic, target, objective, tone, format, idea, hook, caption, cta, hashtags, visual, scheduled_date, status, visual_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, ...contentFields(body), now()),
}), opt);
route('PATCH', '/api/admin/contents/:id', ({ params, body }) => {
  const c = get('SELECT * FROM marketing_contents WHERE id = ?', params.id) || fail(404, 'Contenu introuvable.');
  run(`UPDATE marketing_contents SET network = ?, topic = ?, target = ?, objective = ?, tone = ?, format = ?, idea = ?, hook = ?, caption = ?, cta = ?, hashtags = ?, visual = ?, scheduled_date = ?, status = ?, visual_url = ? WHERE id = ?`, ...contentFields({ ...c, ...body }), c.id);
  return { ok: true };
}, opt);
route('DELETE', '/api/admin/contents/:id', ({ params }) => { run('DELETE FROM marketing_contents WHERE id = ?', params.id); return { ok: true }; }, opt);

// ───────── Newsletter Studio
export function segmentUsers(segment) {
  const base = all(`SELECT u.id, u.email, u.name, u.created_at, u.last_active_at, (SELECT GROUP_CONCAT(role) FROM user_roles WHERE user_id = u.id) roles FROM users u WHERE u.suspended = 0`)
    .map(u => ({ ...u, roles: (u.roles || '').split(',') })).filter(u => !u.roles.includes('admin'));
  const d30 = addDays(today(), -30), d14 = addDays(today(), -14);
  switch (segment) {
    case 'djs': return base.filter(u => u.roles.includes('dj'));
    case 'organizers': return base.filter(u => u.roles.includes('organizer'));
    case 'inactive': return base.filter(u => !u.last_active_at || u.last_active_at < d30);
    case 'incomplete': return base.filter(u => u.roles.includes('dj') && profileCompleteness(u.id) < 60);
    case 'new': return base.filter(u => u.created_at >= d14);
    default: return base;
  }
}
export const SEGMENT_LABELS = { all: 'Tous les membres', djs: 'DJs', organizers: 'Organisateurs', inactive: 'Inactifs depuis 30 jours', incomplete: 'DJs au profil incomplet', new: 'Inscrits depuis 14 jours' };
route('GET', '/api/admin/segments', () => ({ items: Object.entries(SEGMENT_LABELS).map(([key, label]) => ({ key, label, count: segmentUsers(key).length })) }), opt);

const nlFields = body => [
  str(body.subject, { required: true, max: 160, label: 'Objet' }), str(body.preheader, { max: 200 }), str(body.body, { max: 10000 }),
  str(body.cta_label, { max: 60 }), str(body.cta_url, { max: 300 }), oneOf(body.segment || 'all', Object.keys(SEGMENT_LABELS), 'Segment'), date(body.scheduled_date),
];
route('GET', '/api/admin/newsletters', () => ({ items: all('SELECT * FROM newsletters ORDER BY created_at DESC').map(n => ({ ...n, segment_label: SEGMENT_LABELS[n.segment], audience: segmentUsers(n.segment).length })) }), opt);
route('POST', '/api/admin/newsletters', ({ body }) => ({ id: insert("INSERT INTO newsletters (subject, preheader, body, cta_label, cta_url, segment, scheduled_date, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?)", ...nlFields(body), now()) }), opt);
route('PATCH', '/api/admin/newsletters/:id', ({ params, body }) => {
  const n = get('SELECT * FROM newsletters WHERE id = ?', params.id) || fail(404, 'Newsletter introuvable.');
  if (n.status === 'outbox') fail(400, 'Cette newsletter est déjà dans la boîte d\'envoi.');
  run('UPDATE newsletters SET subject = ?, preheader = ?, body = ?, cta_label = ?, cta_url = ?, segment = ?, scheduled_date = ?, status = ? WHERE id = ?',
    ...nlFields({ ...n, ...body }), oneOf(body.status || n.status, CAL_STATUSES.concat('outbox'), 'Statut'), n.id);
  return { ok: true };
}, opt);
route('DELETE', '/api/admin/newsletters/:id', ({ params }) => { run('DELETE FROM newsletters WHERE id = ?', params.id); return { ok: true }; }, opt);
// Aucun service d'envoi n'est connecté : la newsletter est placée dans la boîte d'envoi interne, NON ENVOYÉE.
route('POST', '/api/admin/newsletters/:id/outbox', ({ params }) => {
  const n = get('SELECT * FROM newsletters WHERE id = ?', params.id) || fail(404, 'Newsletter introuvable.');
  if (n.status === 'outbox') fail(400, 'Déjà dans la boîte d\'envoi.');
  const people = segmentUsers(n.segment);
  tx(() => {
    for (const p of people) insert('INSERT INTO outbox (to_email, subject, body, origin, created_at) VALUES (?, ?, ?, ?, ?)', p.email, n.subject, n.body, `newsletter #${n.id}`, now());
    run("UPDATE newsletters SET status = 'outbox', outbox_at = ?, recipients = ? WHERE id = ?", now(), people.length, n.id);
  });
  return { recipients: people.length };
}, opt);

// ───────── Campagnes
route('GET', '/api/admin/campaigns', () => ({ items: analytics().campaigns }), opt);
route('POST', '/api/admin/campaigns', ({ body }) => ({
  id: insert('INSERT INTO campaigns (name, objective, channel, source_key, start_date, end_date, budget, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    str(body.name, { required: true, max: 120, label: 'Nom' }), str(body.objective, { max: 200 }), str(body.channel, { max: 60 }), str(body.source_key, { max: 60 }),
    date(body.start_date), date(body.end_date), int(body.budget, { label: 'Budget' }), oneOf(body.status || 'draft', CAL_STATUSES, 'Statut'), now()),
}), opt);
route('PATCH', '/api/admin/campaigns/:id', ({ params, body }) => {
  run('UPDATE campaigns SET status = COALESCE(?, status), start_date = COALESCE(?, start_date) WHERE id = ?', body.status ? oneOf(body.status, CAL_STATUSES, 'Statut') : null, date(body.start_date), params.id);
  return { ok: true };
}, opt);

// ───────── Content Calendar : publications, newsletters, campagnes et événements
route('GET', '/api/admin/calendar', ({ query }) => {
  const from = query.from || today().slice(0, 8) + '01', to = query.to || addDays(from, 41);
  return { items: [
    ...all('SELECT id, network, topic, idea, scheduled_date, status FROM marketing_contents WHERE scheduled_date BETWEEN ? AND ?', from, to).map(c => ({ kind: 'content', id: c.id, title: c.topic || c.idea, sub: c.network, date: c.scheduled_date, status: c.status })),
    ...all('SELECT id, subject, scheduled_date, status FROM newsletters WHERE scheduled_date BETWEEN ? AND ?', from, to).map(n => ({ kind: 'newsletter', id: n.id, title: n.subject, sub: 'Newsletter', date: n.scheduled_date, status: n.status })),
    ...all('SELECT id, name, start_date, status, channel FROM campaigns WHERE start_date BETWEEN ? AND ?', from, to).map(c => ({ kind: 'campaign', id: c.id, title: c.name, sub: `Campagne · ${c.channel || ''}`, date: c.start_date, status: c.status })),
    ...all(`SELECT e.id, e.title, e.date, e.city, o.org_name FROM events e JOIN organizer_profiles o ON o.user_id = e.organizer_id WHERE e.date BETWEEN ? AND ? AND e.status != 'cancelled'`, from, to)
      .map(e => ({ kind: 'event', id: e.id, title: e.title, sub: `Événement · ${e.org_name}`, date: e.date, status: null })),
  ].sort((a, b) => a.date.localeCompare(b.date)) };
}, opt);
route('PATCH', '/api/admin/calendar/:kind/:id', ({ params, body }) => {
  const table = { content: 'marketing_contents', newsletter: 'newsletters', campaign: 'campaigns' }[params.kind] || fail(400, 'Type non modifiable.');
  const col = params.kind === 'campaign' ? 'start_date' : 'scheduled_date';
  if (body.status) run(`UPDATE ${table} SET status = ? WHERE id = ?`, oneOf(body.status, CAL_STATUSES, 'Statut'), params.id);
  if (body.date) run(`UPDATE ${table} SET ${col} = ? WHERE id = ?`, date(body.date), params.id);
  return { ok: true };
}, opt);

// ───────── Automatisations : règles réellement évaluées sur la base
const recentlyNotified = (userId, kind, days = 7) => !!get('SELECT 1 FROM notifications WHERE user_id = ? AND kind = ? AND created_at >= ?', userId, kind, addDays(today(), -days));
const RULES = {
  welcome: () => {
    const users = all('SELECT id, email, name FROM users WHERE created_at >= ?', addDays(today(), -7)).filter(u => !recentlyNotified(u.id, 'welcome', 30));
    for (const u of users) { notify(u.id, 'welcome', 'Bienvenue sur AFTR', 'Commence par compléter ton profil et suivre quelques membres.', '/app/parametres'); insert('INSERT INTO outbox (to_email, subject, body, origin, created_at) VALUES (?, ?, ?, ?, ?)', u.email, 'Bienvenue sur AFTR', `Bonjour ${u.name}, bienvenue dans la communauté AFTR.`, 'automation:welcome', now()); }
    return { matched: users.length, detail: `${users.length} message(s) de bienvenue` };
  },
  incomplete_profile: () => {
    const users = all('SELECT user_id id FROM dj_profiles').filter(u => profileCompleteness(u.id) < 60 && !recentlyNotified(u.id, 'profile'));
    for (const u of users) notify(u.id, 'profile', 'Ton profil est incomplet', `Il est complété à ${profileCompleteness(u.id)} %. Ajoute photo, tarifs et extraits pour apparaître en haut de la marketplace.`, '/app/parametres');
    return { matched: users.length, detail: `${users.length} DJ(s) relancé(s)` };
  },
  prospect_follow_up: () => {
    const rows = all(`SELECT c.id, c.name FROM admin_contacts c WHERE c.stage IN ('lead','contacted') AND c.user_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM admin_interactions i WHERE i.contact_id = c.id AND i.created_at >= ?)
      AND NOT EXISTS (SELECT 1 FROM admin_tasks t WHERE t.contact_id = c.id AND t.done = 0)`, addDays(today(), -14));
    for (const c of rows) insert('INSERT INTO admin_tasks (contact_id, title, due_date, created_at) VALUES (?, ?, ?, ?)', c.id, `Relancer ${c.name}`, addDays(today(), 2), now());
    return { matched: rows.length, detail: `${rows.length} tâche(s) de relance créée(s) dans le CRM` };
  },
  booking_follow_up: () => {
    const pending = all("SELECT id, dj_id, event_title FROM booking_requests WHERE status = 'pending' AND created_at <= ?", addDays(today(), -3)).filter(r => !recentlyNotified(r.dj_id, 'reminder', 3));
    const quoted = all("SELECT id, organizer_id, event_title FROM booking_requests WHERE status = 'quoted' AND updated_at <= ?", addDays(today(), -5)).filter(r => !recentlyNotified(r.organizer_id, 'reminder', 3));
    for (const r of pending) notify(r.dj_id, 'reminder', 'Une demande attend ta réponse', r.event_title, `/app/reservations/${r.id}`);
    for (const r of quoted) notify(r.organizer_id, 'reminder', 'Un devis attend ta décision', r.event_title, `/app/reservations/${r.id}`);
    return { matched: pending.length + quoted.length, detail: `${pending.length} DJ(s) et ${quoted.length} organisateur(s) relancés` };
  },
  review_request: () => {
    const rows = all("SELECT r.id, r.organizer_id, r.event_title FROM booking_requests r WHERE r.status = 'completed' AND NOT EXISTS (SELECT 1 FROM reviews v WHERE v.request_id = r.id)").filter(r => !recentlyNotified(r.organizer_id, 'review'));
    for (const r of rows) notify(r.organizer_id, 'review', 'Laisse un avis', `Comment s'est passée la prestation pour ${r.event_title} ?`, `/app/reservations/${r.id}`);
    return { matched: rows.length, detail: `${rows.length} demande(s) d'avis` };
  },
  reactivation: () => {
    const users = segmentUsers('inactive').filter(u => !get("SELECT 1 FROM outbox WHERE to_email = ? AND origin = 'automation:reactivation' AND created_at >= ?", u.email, addDays(today(), -30)));
    for (const u of users) insert('INSERT INTO outbox (to_email, subject, body, origin, created_at) VALUES (?, ?, ?, ?, ?)', u.email, 'Il se passe des choses sur AFTR', `Bonjour ${u.name}, de nouveaux DJs et événements t'attendent.`, 'automation:reactivation', now());
    return { matched: users.length, detail: `${users.length} e-mail(s) de réactivation placés dans la boîte d'envoi (non envoyés)` };
  },
};
route('GET', '/api/admin/automations', () => ({
  items: all('SELECT * FROM automations ORDER BY id').map(a => ({ ...a, runs: all('SELECT * FROM automation_runs WHERE automation_id = ? ORDER BY created_at DESC LIMIT 5', a.id) })),
}), opt);
route('PATCH', '/api/admin/automations/:id', ({ params, body }) => { run('UPDATE automations SET enabled = ? WHERE id = ?', body.enabled ? 1 : 0, params.id); return { ok: true }; }, opt);
route('POST', '/api/admin/automations/:id/run', ({ params }) => {
  const a = get('SELECT * FROM automations WHERE id = ?', params.id) || fail(404, 'Automatisation introuvable.');
  if (!a.enabled) fail(400, 'Active cette automatisation avant de la lancer.');
  const r = tx(() => RULES[a.key]());
  insert('INSERT INTO automation_runs (automation_id, matched, detail, created_at) VALUES (?, ?, ?, ?)', a.id, r.matched, r.detail, now());
  run('UPDATE automations SET last_run_at = ? WHERE id = ?', now(), a.id);
  return r;
}, opt);
