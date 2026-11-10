// Site public : accueil, présentation, découverte des DJs, tarifs, contact, connexion.
import { html, raw, api, icon, bg, fmt, state, toast, formData, select, empty, notice, $, on, act, avatar } from '../core.js';
import { navigate, refreshMe } from '../app.js';
import { djCard, djProfileBody, bindPresskit } from './parts.js';
import { projectNav, PROMISE } from './project.js';

const PH = id => `unsplash:photo-${id}`;
const HERO = PH('1688591677634-58dfdc60d62d');
const IMG = { community: PH('1545128485-c400e7702796'), market: PH('1648090322527-138e464a299e'), studio: PH('1594623930572-300a3011d9ae'), org: PH('1470229722913-7c0e2dbbafd3'),
  crowd: PH('1578736641330-3155e606cd40'), vinyl: PH('1603048588665-791ca8aea617'), lights: PH('1777734448523-6b441c719d8d'), hands: PH('1506157786151-b8491531f063'), festival: PH('1533174072545-7a4b6ad7a6c3') };

const cta = html`<section class="wrap section"><div class="cta-band">
  <p class="eyebrow" style="color:rgba(18,19,24,.7)">Rejoindre AFTR</p>
  <h2>Ton prochain set commence ici</h2>
  <p style="max-width:52ch;font-size:17px">Crée ton profil gratuitement, rejoins la communauté et reçois tes premières demandes de réservation.</p>
  <div class="row"><a class="btn dark lg" href="/inscription?role=dj">Créer mon profil DJ</a><a class="btn lg" href="/inscription?role=organizer" style="background:transparent;border-color:var(--ink);color:var(--ink)">Je suis organisateur</a></div>
</div></section>`;

// ───────── Accueil
export async function home() {
  const [stats, djs, events] = await Promise.all([api.get('/api/public/stats'), api.get('/api/djs'), api.get('/api/public/events')]);
  const styles = djs.facets.styles;
  return { html: html`
  <section class="hero">
    <div class="ph" ${bg(HERO, 2000)}></div>
    <div class="wrap hero-inner">
      <p class="eyebrow" style="color:var(--accent)">Communauté · Marketplace · Business Studio</p>
      <h1>Mix.<br>Connecte.<br><em>Booke.</em></h1>
      <p class="lead">AFTR réunit au même endroit la communauté des DJs, une marketplace pour les organisateurs d'événements et les outils pro pour gérer son activité : prospects, devis, factures et clips pour les réseaux.</p>
      <div class="row"><a class="btn primary lg" href="/inscription?role=dj">Créer mon profil DJ ${icon('arrow')}</a><a class="btn lg" href="/artistes">Découvrir les artistes</a></div>
      <div class="hero-stats">
        <div><b class="num">${stats.djs}</b><span>DJs inscrits</span></div>
        <div><b class="num">${stats.organizers}</b><span>Organisateurs</span></div>
        <div><b class="num">${stats.bookings}</b><span>Bookings confirmés</span></div>
        <div><b class="num">${stats.styles}</b><span>Styles musicaux</span></div>
      </div>
      <p class="tiny" style="color:rgba(255,255,255,.45)">Chiffres calculés en direct sur la base de démonstration (données fictives).</p>
    </div>
  </section>
  <section class="wrap" style="padding-top:28px"><p class="eyebrow accent" style="margin-bottom:8px">Le projet en 4 espaces</p><p style="max-width:80ch;font-size:17px;margin-bottom:6px"><b>${PROMISE}</b></p></section>
  ${projectNav('/')}
  <div class="marquee" aria-hidden="true" style="margin-top:20px"><div class="marquee-track">${[...styles, ...styles].map(s => html`<span>${s}</span>`)}</div></div>

  <section class="wrap section">
    <div class="section-h"><h2>Un seul endroit pour toute la nuit</h2><p>AFTR n'est pas qu'une plateforme de réservation. C'est l'environnement où les DJs développent leur réseau, leur visibilité et leur activité.</p></div>
    <div class="grid g4">
      ${[['Community', 'Le réseau social des DJs', IMG.community, ['Fil, photos, vidéos, edits', 'Conseils, matériel, collabs', 'Messagerie privée et groupes'], '/communaute'],
         ['Marketplace', 'Trouver le bon DJ', IMG.market, ['Recherche par style, ville, budget', 'Profils, extraits et avis', 'Demandes suivies jusqu\'au booking'], '/artistes'],
         ['Business Studio', 'Gérer son activité', IMG.studio, ['CRM et relances', 'Devis et factures en PDF', 'Set Clipper pour les réseaux'], '/business-studio'],
         ['Organisateurs', 'Réserver sans galérer', IMG.org, ['Événements et favoris', 'Devis comparés au même endroit', 'Calendrier et historique'], '/organisateurs']]
        .map(([t, s, ph, items, href], i) => html`<a class="space-card" href="${href}"><div class="ph" ${bg(ph, 900)}></div><span class="num-tag">0${i + 1} / 04</span><div class="body"><p class="eyebrow" style="color:var(--accent)">${s}</p><h3>${t}</h3><ul>${items.map(x => html`<li>${x}</li>`)}</ul></div></a>`)}
    </div>
  </section>

  <section class="wrap section" style="padding-top:0">
    <div class="section-h"><h2>Artistes à découvrir</h2><a class="btn" href="/artistes">Voir les ${djs.items.length} profils ${icon('arrow')}</a></div>
    <div class="grid g4">${djs.items.slice(0, 4).map(d => djCard(d, `/dj/${d.slug}`))}</div>
  </section>

  <section class="section dark">
    <div class="wrap">
      <div class="section-h"><h2>Organiser une soirée en trois étapes</h2><p>De la recherche au booking confirmé, chaque étape est suivie et visible des deux côtés.</p></div>
      <div class="grid g3">
        ${[['search', 'Cherche', 'Filtre par style, ville, type d\'événement, budget et disponibilité à la date de ta soirée.'],
           ['ticket', 'Demande', 'Envoie ta demande en une minute. Le DJ est notifié et te répond par un devis.'],
           ['check', 'Booke', 'Accepte le devis : le booking est confirmé, la date est bloquée dans le calendrier du DJ.']]
          .map(([ic, t, p], i) => html`<div class="card stack" style="--gap:12px"><span class="eyebrow accent">Étape ${i + 1}</span><div class="row">${icon(ic)}<h3 class="display" style="font-size:40px">${t}</h3></div><p class="muted">${p}</p></div>`)}
      </div>
    </div>
  </section>

  <section class="wrap section">
    <div class="split-wide">
      <div class="stack" style="--gap:18px">
        <p class="eyebrow accent">Business Studio</p>
        <h2 class="display" style="font-size:clamp(44px,6vw,80px)">Ton bureau,<br>entre deux sets</h2>
        <p class="muted" style="font-size:17px;max-width:50ch">Prospects, relances, devis, factures, revenus : tout ce qui se passe après la fermeture du club, rangé au même endroit et visible de toi seul.</p>
        <div class="grid g2">
          ${[['contacts', 'CRM personnel', 'Pipeline en 9 étapes, notes, tâches et relances.'], ['file', 'Devis & factures', 'PDF générés, numérotés, statuts de paiement.'], ['wallet', 'Finances', 'Chiffre d\'affaires, paiements reçus et en attente.'], ['scissors', 'Set Clipper', 'Détection des drops et export de clips 9:16, 1:1 ou 16:9.']]
            .map(([ic, t, p]) => html`<div class="feature"><span class="ico">${icon(ic)}</span><h3>${t}</h3><p>${p}</p></div>`)}
        </div>
        <div><a class="btn primary" href="/business-studio">Découvrir le Business Studio</a></div>
      </div>
      <div class="ph no-shade" ${bg(IMG.vinyl, 1100)} style="border-radius:var(--r-xl);min-height:560px"></div>
    </div>
  </section>

  ${events.items.length ? html`<section class="wrap section" style="padding-top:0">
    <div class="section-h"><h2>Prochains événements</h2><p>Publiés par les organisateurs de la communauté.</p></div>
    <div class="grid g3">${events.items.map(e => { const d = new Date(e.date + 'T12:00:00'); return html`<div class="event-card"><div class="ph no-shade" ${bg(e.photo, 300)}></div><div class="stack" style="--gap:4px;min-width:0"><span class="mono muted">${d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} · ${e.city}</span><b class="truncate">${e.title}</b><span class="small muted truncate">${e.org_name}</span><div class="tags">${e.styles.slice(0, 2).map(s => html`<span class="tag">${s}</span>`)}</div></div></div>`; })}</div>
  </section>` : ''}
  ${cta}` };
}

// ───────── Fonctionnalités
export function features() {
  const block = (eyebrow, title, text, items, photo, reverse) => html`<section class="wrap section" style="padding-top:0"><div class="split-wide" style="${reverse ? 'direction:rtl' : ''}">
    <div class="stack" style="--gap:16px;direction:ltr"><p class="eyebrow accent">${eyebrow}</p><h2 class="display" style="font-size:clamp(40px,5vw,68px)">${title}</h2><p class="muted" style="font-size:17px">${text}</p>
      <div class="grid g2">${items.map(([ic, t, p]) => html`<div class="feature"><span class="ico">${icon(ic)}</span><h3>${t}</h3><p>${p}</p></div>`)}</div></div>
    <div class="ph no-shade" ${bg(photo, 1000)} style="border-radius:var(--r-xl);min-height:480px;direction:ltr"></div></div></section>`;
  return { title: 'Fonctionnalités', html: html`
  <section class="wrap page-hero"><p class="eyebrow accent">Fonctionnalités</p><h1>Tout ce qu'il faut<br>après minuit</h1><p>Quatre espaces connectés : la communauté, la marketplace, le Business Studio des DJs et l'espace des organisateurs. Les données passent de l'un à l'autre sans ressaisie.</p></section>
  ${block('DJ Community', 'Le réseau des DJs', 'Un réseau social pensé pour la musique : on y partage ses dates, ses edits, ses questions et on y trouve ses futurs partenaires de B2B.',
    [['feed', 'Fil d\'actualité', 'Textes, photos, vidéos et morceaux.'], ['message', 'Messagerie', 'Conversations privées et de groupe.'], ['users', 'Abonnements', 'Suis les DJs qui t\'inspirent.'], ['shield', 'Modération', 'Signalements et règles de droits d\'auteur.']], IMG.community)}
  ${block('DJ Marketplace', 'Trouver, demander, booker', 'Les organisateurs filtrent les profils et suivent chaque demande jusqu\'au booking. Les changements de statut apparaissent des deux côtés.',
    [['search', 'Recherche fine', 'Style, ville, événement, budget, date, expérience.'], ['star', 'Avis', 'Notes laissées après chaque prestation réalisée.'], ['ticket', 'Demandes suivies', 'Demande, devis, confirmation, historique.'], ['calendar', 'Disponibilités', 'Synchronisées avec le calendrier du DJ.']], IMG.market, true)}
  ${block('DJ Business Studio', 'Gérer son activité', 'Un espace privé : aucun autre membre, ni l\'équipe AFTR, n\'a accès aux prospects, devis et factures d\'un DJ.',
    [['contacts', 'CRM', 'Contacts, pipeline, notes, tâches.'], ['receipt', 'Facturation', 'Devis et factures PDF numérotés.'], ['wallet', 'Finances', 'Revenus et paiements en attente.'], ['scissors', 'Set Clipper', 'Clips vidéo à partir de ses sets.']], IMG.studio)}
  ${cta}` };
}

// ───────── Artistes
export async function artists({ query }) {
  const q = new URLSearchParams(Object.entries(query).filter(([, v]) => v)).toString();
  const { items, facets } = await api.get('/api/djs?' + q);
  return { title: 'Artistes', html: html`
  <section class="wrap page-hero" style="padding-bottom:20px"><p class="eyebrow accent">Découvrir</p><h1>Les artistes</h1><p>Des profils fictifs de démonstration, aux styles et aux villes variés. Pour envoyer une demande, connecte-toi avec un compte organisateur.</p></section>
  <section class="wrap" style="padding-bottom:80px">
    ${filters(facets, query)}
    <p class="small muted" style="margin:18px 0">${items.length} profil${items.length > 1 ? 's' : ''}</p>
    ${items.length ? html`<div class="grid g4">${items.map(d => djCard(d, `/dj/${d.slug}`))}</div>` : empty('Aucun DJ ne correspond', 'Élargis un filtre pour voir plus de profils.')}
  </section>`, mount: v => mountFilters(v) };
}

export function filters(facets, query, base = location.pathname) {
  return html`<form class="card row" id="dj-filters" data-base="${base}" style="--gap:12px;align-items:end">
    <label class="field grow" style="min-width:150px"><span>Recherche</span><input class="input" name="q" value="${query.q || ''}" placeholder="Nom, style…"></label>
    <label class="field" style="min-width:150px"><span>Style</span>${select('style', [['', 'Tous'], ...facets.styles], query.style)}</label>
    <label class="field" style="min-width:140px"><span>Ville</span>${select('city', [['', 'Toutes'], ...facets.cities], query.city)}</label>
    <label class="field" style="min-width:160px"><span>Événement</span>${select('event_type', [['', 'Tous'], ...facets.event_types], query.event_type)}</label>
    <label class="field" style="min-width:130px"><span>Budget max</span>${select('budget', [['', 'Tous'], ['400', '400 €'], ['500', '500 €'], ['650', '650 €'], ['800', '800 €'], ['1000', '1 000 €']], query.budget)}</label>
    <label class="field" style="min-width:130px"><span>Expérience</span>${select('experience', [['', 'Toute'], ['3', '3 ans et +'], ['5', '5 ans et +'], ['10', '10 ans et +']], query.experience)}</label>
    <label class="field" style="min-width:150px"><span>Disponible le</span><input class="input" type="date" name="date" value="${query.date || ''}"></label>
    ${Object.values(query).some(Boolean) ? html`<a class="btn ghost" href="${base}">Effacer</a>` : ''}
  </form>`;
}
export function mountFilters(v) {
  const f = $('#dj-filters', v);
  const go = () => { const p = new URLSearchParams(Object.entries(formData(f)).filter(([, x]) => x)); navigate(f.dataset.base + (p.toString() ? '?' + p : '')); };
  f.addEventListener('change', go);
  f.addEventListener('submit', e => { e.preventDefault(); go(); });
}

export async function djPublic({ params }) {
  const { dj } = await api.get('/api/djs/' + params.slug);
  const isOrg = state.me?.roles.includes('organizer');
  const actions = html`<a class="btn primary lg" href="${state.me ? `/app/djs/${dj.slug}` : `/connexion?next=/app/djs/${dj.slug}`}">${icon('ticket')}${isOrg || !state.me ? 'Demander une réservation' : 'Ouvrir dans l\'application'}</a>
    ${!state.me ? html`<span class="small muted">Connexion organisateur requise pour réserver.</span>` : ''}`;
  return { title: dj.stage_name, html: djProfileBody(dj, { actions }), mount: v => bindPresskit(v, dj) };
}

// ───────── Pages de présentation
function presentation({ eyebrow, title, text, photo, items, steps, ctaHref, ctaLabel }) {
  return html`
  <section class="hero" style="min-height:min(70vh,620px)"><div class="ph" ${bg(photo, 2000)}></div><div class="wrap hero-inner">
    <p class="eyebrow" style="color:var(--accent)">${eyebrow}</p><h1 style="font-size:clamp(56px,9vw,128px)">${raw(title)}</h1><p class="lead">${text}</p>
    <div class="row"><a class="btn primary lg" href="${ctaHref}">${ctaLabel} ${icon('arrow')}</a></div></div></section>
  <section class="wrap section"><div class="grid g3">${items.map(([ic, t, p]) => html`<div class="feature"><span class="ico">${icon(ic)}</span><h3>${t}</h3><p>${p}</p></div>`)}</div></section>
  ${steps ? html`<section class="section dark"><div class="wrap"><div class="grid g3">${steps.map(([t, p], i) => html`<div class="stack" style="--gap:10px"><span class="display" style="font-size:72px;color:var(--accent)">${i + 1}</span><h3 style="font-size:22px">${t}</h3><p class="muted">${p}</p></div>`)}</div></div></section>` : ''}
  ${cta}`;
}
export const communityPage = () => ({ title: 'Communauté', html: presentation({
  eyebrow: 'DJ Community', title: 'La scène,<br>en ligne', photo: IMG.community, ctaHref: '/inscription?role=dj', ctaLabel: 'Rejoindre la communauté',
  text: 'Partage tes dates, tes edits et tes découvertes. Pose tes questions sur le matériel, trouve un partenaire de B2B, échange en privé.',
  items: [['feed', 'Fil d\'actualité', 'Publications avec texte, photos, vidéos et morceaux, filtrables par type.'], ['music', 'Remix, edits & découvertes', 'Partage tes morceaux avec une déclaration de droits obligatoire.'], ['help', 'Conseils & matériel', 'Des fils dédiés aux questions techniques et au matériel.'],
    ['users', 'Collaborations', 'Annonces de recherche de collaborateurs et B2B.'], ['message', 'Messagerie & groupes', 'Conversations privées et de groupe.'], ['shield', 'Modération', 'Signalements traités par l\'équipe AFTR, règles de droits d\'auteur.']],
  steps: [['Crée ton profil', 'Nom de scène, styles, ville, photos et extraits.'], ['Suis la scène', 'Abonne-toi aux DJs et organisateurs qui t\'intéressent.'], ['Partage', 'Publie, commente, réagis, échange en privé.']] }) });
export const studioPage = () => ({ title: 'Business Studio', html: presentation({
  eyebrow: 'DJ Business Studio', title: 'Ton business,<br>sans tableur', photo: IMG.studio, ctaHref: '/inscription?role=dj', ctaLabel: 'Essayer le Business Studio',
  text: 'Un espace privé pour gérer ses prospects, ses bookings, ses devis et ses factures, et transformer ses sets en clips pour les réseaux.',
  items: [['contacts', 'CRM personnel', 'Contacts, entreprises, notes, tags, tâches, relances et pipeline en 9 étapes.'], ['ticket', 'Bookings', 'Demandes reçues, prestations confirmées, historique et statuts.'], ['calendar', 'Calendrier', 'Bookings, tâches et dates bloquées sur une seule vue.'],
    ['file', 'Devis PDF', 'Lignes de prestation, totaux automatiques, statuts de suivi.'], ['receipt', 'Factures PDF', 'Numérotation, coordonnées client, suivi des paiements.'], ['scissors', 'Set Clipper', 'Analyse audio du set, détection des drops, export de clips MP4.']],
  steps: [['Centralise', 'Tes contacts et demandes arrivent au même endroit.'], ['Transforme', 'Un devis accepté devient une facture en un clic.'], ['Suis', 'Revenus, paiements en attente, factures en retard.']] }) });
export const organizersPage = () => ({ title: 'Organisateurs', html: presentation({
  eyebrow: 'Organizer Space', title: 'Le bon DJ,<br>au bon prix', photo: IMG.org, ctaHref: '/inscription?role=organizer', ctaLabel: 'Créer un compte organisateur',
  text: 'Club, collectif, agence, BDE, wedding planner ou entreprise : trouve un DJ, compare les devis et suis tes réservations sans relancer dix personnes.',
  items: [['search', 'Recherche', 'Filtres par style, localisation, type d\'événement, budget, disponibilité et expérience.'], ['heart', 'Favoris', 'Garde une liste des DJs qui te plaisent.'], ['calendar', 'Événements', 'Crée tes événements et associe-leur des demandes.'],
    ['file', 'Suivi des devis', 'Accepte ou refuse les devis reçus.'], ['message', 'Messagerie', 'Échange directement avec les DJs.'], ['star', 'Avis', 'Note les prestations réalisées.']],
  steps: [['Publie ton événement', 'Date, lieu, styles, budget.'], ['Envoie tes demandes', 'Aux DJs disponibles à ta date.'], ['Confirme', 'Accepte le devis : c\'est booké.']] }) });

export async function pricing() {
  const check = icon('check');
  const plan = (name, price, period, desc, items, featured, href, label) => html`<div class="price-card ${featured ? 'featured' : ''}">
    <div><p class="eyebrow ${featured ? 'accent' : ''}">${name}</p><p class="amount" style="margin-top:10px">${price}</p><p class="small muted">${period}</p></div><p class="muted">${desc}</p>
    <ul>${items.map(i => html`<li>${check}<span>${i}</span></li>`)}</ul><a class="btn ${featured ? 'primary' : ''}" href="${href}">${label}</a></div>`;
  return { title: 'Tarifs', html: html`
  <section class="wrap page-hero"><p class="eyebrow accent">Tarifs</p><h1>Simple.<br>Sans engagement.</h1><p>Des formules gratuites pour commencer, des formules payantes pour aller plus loin.</p></section>
  <section class="wrap" style="padding-bottom:40px">
    ${notice('Paiement non activé.', 'Dans cette démonstration, aucun paiement n\'est encaissé : les abonnements sont gérés dans l\'admin mais aucun moyen de paiement n\'est connecté.', 'plug')}
    <div class="grid g4" style="margin-top:20px">
      ${plan('DJ Free', '0 €', 'pour toujours', 'Pour rejoindre la communauté et être visible.', ['Profil public et marketplace', 'Communauté et messagerie', 'Demandes de réservation illimitées', '3 devis / factures par mois'], false, '/inscription?role=dj', 'Créer mon profil')}
      ${plan('DJ Pro', '12 €', 'par mois', 'Pour gérer toute son activité.', ['Tout DJ Free', 'CRM et pipeline complets', 'Devis et factures illimités', 'Set Clipper', 'Mise en avant dans les recherches'], true, '/inscription?role=dj', 'Commencer')}
      ${plan('Organisateur', '0 €', 'pour toujours', 'Pour réserver ponctuellement.', ['Recherche de DJs', 'Demandes et devis', 'Favoris', 'Messagerie'], false, '/inscription?role=organizer', 'Créer un compte')}
      ${plan('Organisateur Plus', '29 €', 'par mois', 'Pour les clubs, agences et collectifs.', ['Tout Organisateur', 'Événements illimités', 'Calendrier d\'équipe', 'Support prioritaire'], false, '/contact', 'Nous contacter')}
    </div>
    <p class="small muted" style="margin-top:18px">Commission de service de 8 % sur les bookings confirmés (modèle économique étudié ; dans la démo, les paiements entre organisateurs et DJs se font hors plateforme).</p>
  </section>${cta}` };
}

export function contact() {
  return { title: 'Contact', html: html`
  <section class="wrap page-hero" style="padding-bottom:30px"><p class="eyebrow accent">Contact</p><h1>Parlons-en</h1><p>Une question, un partenariat, un souci de compte ? Le message arrive directement dans le support de l'équipe AFTR (espace admin).</p></section>
  <section class="wrap" style="padding-bottom:80px"><div class="split-wide">
    <form class="card form-grid" id="contact-form">
      <label class="field"><span>Nom</span><input class="input" name="name" required value="${state.me?.name || ''}"></label>
      <label class="field"><span>E-mail</span><input class="input" type="email" name="email" required value="${state.me?.email || ''}"></label>
      <label class="field"><span>Catégorie</span>${select('category', ['Question', 'Compte', 'Réservation', 'Partenariat', 'Presse', 'Autre'], 'Question')}</label>
      <label class="field"><span>Objet</span><input class="input" name="subject" required></label>
      <label class="field full"><span>Message</span><textarea class="textarea" name="message" rows="6" required></textarea></label>
      <div class="full row spread"><span class="tiny muted">Aucun e-mail n'est envoyé : le message crée un ticket dans le support AFTR.</span><button class="btn primary" type="submit">Envoyer le message</button></div>
    </form>
    <div class="ph no-shade" ${bg(IMG.lights, 900)} style="border-radius:var(--r-xl);min-height:380px"></div>
  </div></section>`,
  mount: v => $('#contact-form', v).addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    await act(f.querySelector('[type=submit]'), () => api.post('/api/contact', formData(f)));
    f.innerHTML = html`<div class="full empty">${icon('check')}<h3>Message envoyé</h3><p>Ton message a créé un ticket dans le support AFTR. L'équipe te répondra depuis l'espace admin.</p><a class="btn" href="/">Retour à l'accueil</a></div>`.s;
  }) };
}

export const legal = () => ({ title: 'Mentions légales', html: html`<section class="wrap page-hero"><p class="eyebrow">Légal</p><h1>Mentions<br>légales</h1></section>
  <section class="wrap prose" style="padding-bottom:80px">
    <p><b>AFTR est un projet fictif</b> réalisé dans le cadre d'un Master 2 en marketing digital. Il ne s'agit pas d'un service commercial : aucune société n'exploite cette plateforme.</p>
    <h2>Éditeur</h2><p>Projet étudiant, non immatriculé. Contact : via le <a href="/contact">formulaire de contact</a>.</p>
    <h2>Hébergement</h2><p>Application exécutée localement pour la démonstration.</p>
    <h2>Contenus</h2><p>Les profils, organisations, événements, avis, documents et chiffres présentés sont fictifs, à l'exception du profil de la DJ Anjara, utilisé avec l'accord de l'artiste, qui est aussi l'autrice du projet. Toute ressemblance avec des personnes ou structures existantes serait fortuite. Les photographies proviennent d'Unsplash et sont utilisées selon la licence Unsplash ; elles n'illustrent pas les personnes fictives réelles.</p>
    <h2>Documents générés</h2><p>Les devis et factures produits par le Business Studio portent la mention « document fictif » et n'ont aucune valeur comptable ni légale. Ils n'ont pas fait l'objet d'une vérification réglementaire.</p>
  </section>` });
export const privacy = () => ({ title: 'Confidentialité', html: html`<section class="wrap page-hero"><p class="eyebrow">Légal</p><h1>Politique de<br>confidentialité</h1></section>
  <section class="wrap prose" style="padding-bottom:80px">
    <p>Cette politique décrit le fonctionnement prévu d'AFTR. Dans la démonstration, toutes les données sont fictives et stockées localement.</p>
    <h2>Données traitées</h2><p>Compte (nom, e-mail, ville), profil public, publications, messages, demandes de réservation, et pour les DJs les données de leur Business Studio (contacts, devis, factures).</p>
    <h2>Cloisonnement</h2><p>Les données du Business Studio d'un DJ sont privées. Elles ne sont accessibles ni aux autres membres, ni à l'équipe AFTR : le CRM interne d'AFTR ne s'appuie que sur l'activité des membres sur la plateforme (inscription, demandes de réservation, abonnements, support).</p>
    <h2>Messagerie</h2><p>Les messages sont stockés sur le serveur et ne sont pas chiffrés de bout en bout.</p>
    <h2>Préférences</h2><p>Le choix du mode jour, nuit ou automatique est enregistré dans le compte et dans un cookie technique.</p>
    <h2>Vos droits</h2><p>Accès, rectification et suppression : via le <a href="/contact">formulaire de contact</a>.</p>
  </section>` });

// ───────── Connexion / inscription
function authLayout(title, photo, form) {
  return html`<div class="auth">
    <div class="auth-art"><div class="ph" ${bg(photo, 1400)}></div><a href="/" class="logo" style="color:#fff">AFT<i>R</i></a><div class="stack" style="--gap:14px"><h2>${raw(title)}</h2><p style="color:rgba(255,255,255,.7);max-width:44ch">La plateforme des DJs, des organisateurs et de la culture club.</p></div></div>
    <div class="auth-form"><div>${form}</div></div></div>`;
}
export function login({ query }) {
  const accounts = [['anjara@aftr.demo', 'Anjara', 'DJ · Business Studio, communauté', '/img/anjara-avatar.jpg'], ['contrejour@aftr.demo', 'Collectif Contre-Jour', 'Organisateur · recherche et réservations', 'unsplash:photo-1545128485-c400e7702796'],
    ['dida@aftr.demo', 'DIDA', 'DJ + organisateur (double rôle)', 'unsplash:photo-1648090326914-fcf7ad3f5aa1'], ['admin@aftr.demo', 'Équipe AFTR', 'Administrateur · CRM, Marketing Hub', null]];
  return { title: 'Connexion', html: authLayout('Bon retour<br>parmi nous', IMG.crowd, html`
    <div><a href="/" class="back">${icon('back')}Retour au site</a><h1 class="display" style="font-size:56px">Connexion</h1></div>
    <form class="stack" id="login-form" style="--gap:14px">
      <label class="field"><span>E-mail</span><input class="input" type="email" name="email" required autocomplete="username"></label>
      <label class="field"><span>Mot de passe</span><input class="input" type="password" name="password" required autocomplete="current-password"></label>
      <button class="btn primary lg" type="submit">Se connecter</button>
      <p class="small muted">Pas encore de compte ? <a class="link" href="/inscription">Rejoindre AFTR</a></p>
    </form>
    <div class="hr-label">Comptes de démonstration</div>
    <div class="demo-accounts">${accounts.map(([email, name, sub, photo]) => html`<button class="demo-acc" data-email="${email}">${avatar(name, photo, 'sm')}<div class="grow"><b>${name}</b><div class="tiny muted">${sub}</div></div>${icon('arrow')}</button>`)}</div>
    <p class="tiny muted">Mot de passe des comptes de démonstration : <kbd>aftr2026</kbd></p>`),
  mount: v => {
    const f = $('#login-form', v);
    const submit = async btn => {
      await act(btn, () => api.post('/api/auth/login', formData(f)));
      await refreshMe();
      toast(`Bienvenue ${state.me.dj?.stage_name || state.me.organizer?.org_name || state.me.name}`);
      navigate(query.next || '/app');
    };
    f.addEventListener('submit', e => { e.preventDefault(); submit(f.querySelector('[type=submit]')); });
    on(v, 'click', '[data-email]', (e, b) => { f.email.value = b.dataset.email; f.password.value = 'aftr2026'; submit(b); });
  } };
}
export function signup({ query }) {
  return { title: 'Inscription', html: authLayout('Rejoins<br>la scène', IMG.hands, html`
    <div><a href="/" class="back">${icon('back')}Retour au site</a><h1 class="display" style="font-size:56px">Créer un compte</h1><p class="muted">Gratuit. Tu pourras ajouter un second profil plus tard.</p></div>
    <form class="stack" id="signup-form" style="--gap:14px">
      <div class="field"><span class="label">Je suis</span><div class="choice">
        <label><input type="checkbox" name="roles" value="dj" ${query.role !== 'organizer' ? raw('checked') : ''}><span>DJ</span></label>
        <label><input type="checkbox" name="roles" value="organizer" ${query.role === 'organizer' ? raw('checked') : ''}><span>Organisateur</span></label></div></div>
      <label class="field"><span>Nom et prénom</span><input class="input" name="name" required></label>
      <label class="field" data-for="dj"><span>Nom de scène</span><input class="input" name="stage_name" placeholder="Ex. : NOVA"></label>
      <label class="field" data-for="organizer"><span>Nom de l'organisation</span><input class="input" name="org_name" placeholder="Ex. : Collectif Minuit"></label>
      <div class="form-grid">
        <label class="field"><span>Ville</span><input class="input" name="city"></label>
        <label class="field"><span>Comment nous as-tu connus ?</span>${select('source', ['Instagram', 'TikTok', 'LinkedIn', 'Google', 'Bouche-à-oreille', 'Partenariat', 'Autre'], 'Instagram')}</label>
      </div>
      <label class="field"><span>E-mail</span><input class="input" type="email" name="email" required autocomplete="email"></label>
      <label class="field"><span>Mot de passe (8 caractères min.)</span><input class="input" type="password" name="password" minlength="8" required autocomplete="new-password"></label>
      <button class="btn primary lg" type="submit">Créer mon compte</button>
      <p class="tiny muted">En créant un compte, tu acceptes les règles de la communauté et la <a class="link" href="/confidentialite">politique de confidentialité</a>. Environnement de démonstration : le compte est créé dans la base locale.</p>
      <p class="small muted">Déjà inscrit ? <a class="link" href="/connexion">Se connecter</a></p>
    </form>`),
  mount: v => {
    const f = $('#signup-form', v);
    const sync = () => { const roles = formData(f).roles; $$v('[data-for]').forEach(el => el.hidden = !roles.includes(el.dataset.for)); };
    const $$v = s => [...v.querySelectorAll(s)];
    f.addEventListener('change', sync); sync();
    f.addEventListener('submit', async e => {
      e.preventDefault();
      await act(f.querySelector('[type=submit]'), () => api.post('/api/auth/signup', formData(f)));
      await refreshMe();
      toast('Compte créé. Bienvenue sur AFTR !');
      navigate('/app/parametres');
    });
  } };
}
