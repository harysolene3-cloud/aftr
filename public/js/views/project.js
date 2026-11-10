// Espaces du projet : vente (offre, commande simulée, confirmation), accès au CRM,
// dossier stratégique et plan de communication.
import { html, raw, api, icon, fmt, toast, formData, $, $$, on, act, state } from '../core.js';
import { navigate, refreshMe } from '../app.js';
import { drawTemplate } from '../visual.js';

const eur = n => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(n);
export const PROMISE = "AFTR aide les DJs indépendants à décrocher plus de dates et à gérer toute leur activité au même endroit (profil, réservations, devis, factures, clips et posts réseaux), pour passer moins de temps sur l'administratif et plus derrière les platines.";

// ───────── Sources (chaque lien a été ouvert et vérifié le 10 novembre 2026)
const S = {
  insee: ['Insee, Bilan démographique 2024 (Insee Première n° 2033, janvier 2025)', 'https://www.insee.fr/fr/statistiques/8327319'],
  bpi: ['Bpifrance Création, chiffres Urssaf des auto-entrepreneurs fin 2024 (août 2025)', 'https://bpifrance-creation.fr/entrepreneur/actualites/augmentation-auto-entrepreneurs-actifs-a-fin-2024'],
  sacem: ['Banque des Territoires, étude Sacem « Les discothèques en France » (juin 2014)', 'https://www.banquedesterritoires.fr/le-nombre-de-discotheques-diminue-de-moitie-en-trente-ans'],
  ims: ['MusicTech, IMS Electronic Music Business Report (avril 2026)', 'https://musictech.com/news/industry/ims-electronic-music-business-report-2026/'],
  gigsalad: ['GigSalad, Membership pricing', 'https://help.gigsalad.com/article/148-membership-pricing'],
  gigsaladFees: ['GigSalad, Provider service fees', 'https://help.gigsalad.com/article/97-vendor-service-fees'],
  gigwell: ['Gigwell, Pricing', 'https://www.gigwell.com/pricing'],
  freebe: ['Freebe, Tarifs', 'https://www.freebe.me/tarifs'],
  indy: ['Indy, Tarifs', 'https://www.indy.fr/tarifs/'],
  opus: ['OpusClip, Pricing', 'https://www.opus.pro/pricing'],
};
const src = k => html`<a class="src" href="${S[k][1]}" target="_blank" rel="noopener" title="${S[k][0]}">source ${icon('external')}</a>`;
const est = html`<span class="nature hypothese">Estimation</span>`;
const real = html`<span class="nature reel">Donnée sourcée</span>`;
const hero = (eyebrow, title, text) => html`<section class="wrap page-hero" style="padding-bottom:24px"><p class="eyebrow accent">${eyebrow}</p><h1>${raw(title)}</h1><p>${text}</p></section>`;
export const projectNav = cur => html`<div class="wrap"><nav class="project-nav" aria-label="Espaces du projet">${[['/tarifs', '1', 'Vente', 'Offre, prix, achat'], ['/crm', '2', 'CRM', 'Clients et pipeline'], ['/strategie', '3', 'Stratégie', 'Pourquoi ce produit'], ['/communication', '4', 'Communication', 'Comment le vendre']]
  .map(([h, n, t, s]) => html`<a href="${h}" class="${cur === h ? 'on' : ''}"><b>${n}</b><span><strong>${t}</strong><small>${s}</small></span></a>`)}</nav></div>`;

// ───────── 1. Vente : offre et prix
export async function offer() {
  const { offers: O } = await api.get('/api/offers');
  const pro = O.dj_pro, plus = O.org_plus;
  const card = ({ name, price, sub, desc, inc, exc, href, label, featured }) => html`<div class="price-card ${featured ? 'featured' : ''}">
    <div><p class="eyebrow ${featured ? 'accent' : ''}">${name}</p><p class="amount" style="margin-top:10px">${price}</p><p class="small muted">${raw(sub)}</p></div><p class="muted">${desc}</p>
    <div><p class="eyebrow" style="margin-bottom:6px">Inclus</p><ul>${inc.map(i => html`<li>${icon('check')}<span>${i}</span></li>`)}</ul></div>
    <div><p class="eyebrow" style="margin-bottom:6px">Non inclus</p><ul class="not">${exc.map(i => html`<li>${icon('x')}<span>${i}</span></li>`)}</ul></div>
    <a class="btn ${featured ? 'primary' : ''}" href="${href}">${label}</a></div>`;
  const faq = [
    ['Est-ce que je paie vraiment ?', "Non. AFTR est un projet étudiant : le parcours d'achat va jusqu'à la confirmation, mais le paiement est simulé. Aucune carte bancaire n'est demandée et rien n'est encaissé."],
    ['Pourquoi le prix DJ Pro est-il affiché TTC ?', "La plupart des DJs indépendants sont micro-entrepreneurs en franchise de TVA : ils ne récupèrent pas la TVA, donc le prix qui compte pour eux est le TTC. L'offre Organisateur Plus, destinée aux entreprises, est affichée HT."],
    ['Puis-je arrêter à tout moment ?', "Oui. La formule mensuelle est sans engagement et s'arrête à la fin du mois en cours. La formule annuelle est payée en une fois et revient à 2 mois offerts."],
    ['Que se passe-t-il si je repasse en gratuit ?', 'Ton profil, tes contacts et tes documents restent accessibles en lecture. Seules les fonctions Pro (factures illimitées, Set Clipper, mise en avant) sont désactivées.'],
    ['AFTR prend-il une commission sur mes cachets ?', "Non, pas sur le DJ. Quand le paiement en ligne des réservations sera ouvert, des frais de service de 8 % seront payés par l'organisateur. Dans cette démo, les paiements entre organisateurs et DJs se font hors plateforme."],
    ['Les factures AFTR sont-elles valables ?', 'Le modèle reprend les mentions obligatoires françaises, mais dans la démo chaque PDF porte la mention « document fictif » et n\'a aucune valeur comptable.'],
    ['Comment vous contacter ?', 'Par le formulaire de contact : chaque message crée un ticket dans le support de l\'équipe AFTR.'],
  ];
  return { title: 'Offre et prix', html: html`
  ${hero('Espace de vente', 'Plus de dates.<br>Moins d\'admin.', PROMISE)}
  ${projectNav('/tarifs')}
  <section class="wrap" style="padding:28px 0 20px">
    <div class="grid g4">
      ${card({ name: 'DJ Free', price: '0 €', sub: 'pour toujours', desc: 'Pour être visible et recevoir ses premières demandes.', inc: ['Profil public et marketplace', 'Communauté et messagerie', 'Demandes de réservation illimitées', '3 devis ou factures par mois'], exc: ['CRM et relances', 'Set Clipper', 'Studio visuel', 'Mise en avant'], href: '/inscription?role=dj', label: 'Créer mon profil' })}
      ${card({ name: 'DJ Pro', price: `${eur(pro.monthly.ttc)} TTC`, sub: `par mois, soit ${eur(pro.monthly.ht)} HT<br>ou ${eur(pro.yearly.ttc)} TTC par an (2 mois offerts)`, desc: 'Pour gérer toute son activité de DJ au même endroit.', inc: ['Tout DJ Free', 'CRM, pipeline et rappels', 'Devis et factures PDF illimités', 'Calendrier et feuilles de route', 'Set Clipper : clips verticaux de tes sets', 'Studio visuel et suivi des posts', 'Mise en avant dans les recherches'], exc: ['Paiement en ligne des cachets (à venir)', 'Comptabilité et déclarations Urssaf'], href: '/commande?offre=dj_pro', label: 'Choisir DJ Pro', featured: true })}
      ${card({ name: 'Organisateur', price: '0 €', sub: 'pour toujours', desc: 'Pour réserver un DJ de temps en temps.', inc: ['Recherche de DJs', 'Demandes et devis', 'Favoris et messagerie'], exc: ['Événements illimités', 'Calendrier d\'équipe', 'Support prioritaire'], href: '/inscription?role=organizer', label: 'Créer un compte' })}
      ${card({ name: 'Organisateur Plus', price: `${eur(plus.monthly.ht)} HT`, sub: `par mois, soit ${eur(plus.monthly.ttc)} TTC<br>ou ${eur(plus.yearly.ht)} HT par an`, desc: 'Pour les clubs, bars, agences et collectifs.', inc: ['Tout Organisateur', 'Événements illimités', 'Calendrier d\'équipe', 'Historique et comparaison des devis', 'Support prioritaire'], exc: ['Gestion de la billetterie', 'Paie des DJs'], href: '/commande?offre=org_plus', label: 'Choisir Organisateur Plus' })}
    </div>
    <p class="small muted" style="margin-top:16px">Prix en euros. DJ Pro : TVA 20 % incluse. Organisateur Plus : prix HT, TVA 20 % en sus. <a class="link" href="/strategie#prix">Comment ces prix ont été fixés →</a></p>
  </section>
  <section class="wrap section" style="padding-top:20px">
    <div class="split-wide">
      <div><h2 style="margin-bottom:16px">Questions fréquentes</h2><div class="stack" style="--gap:8px">${faq.map(([q, a]) => html`<details class="faq"><summary>${q}</summary><p>${a}</p></details>`)}</div></div>
      <div class="card stack" style="--gap:12px;align-self:start"><h3>Une question avant de choisir ?</h3><p class="muted">L'équipe répond aux DJs et aux organisateurs. Ton message arrive directement dans le support AFTR.</p><a class="btn primary" href="/contact">${icon('mail')}Nous contacter</a><a class="btn" href="/commande?offre=dj_pro">${icon('arrow')}Tester l'achat (simulé)</a></div>
    </div>
  </section>` };
}

// ───────── 1 bis. Commande simulée
export async function checkout({ query }) {
  const { offers: O, sources } = await api.get('/api/offers');
  const st = { offer: O[query.offre] ? query.offre : 'dj_pro', period: query.duree === 'monthly' ? 'monthly' : 'yearly' };
  return { title: 'Commande', html: html`
  ${hero('Espace de vente · commande', 'Ta commande', 'Trois étapes : l\'offre, tes coordonnées, le paiement simulé. Rien n\'est encaissé.')}
  <section class="wrap" style="padding-bottom:70px"><form class="split-wide" id="order">
    <div class="stack" style="--gap:16px">
      <div class="card stack" style="--gap:12px"><h3><span class="step-n">1</span>Offre</h3>
        <div class="choice">${Object.entries(O).map(([k, o]) => html`<label><input type="radio" name="offer" value="${k}" ${st.offer === k ? raw('checked') : ''}><span>${o.label}</span></label>`)}</div>
        <div class="choice" id="periods"></div></div>
      <div class="card form-grid"><h3 class="full"><span class="step-n">2</span>Coordonnées</h3>
        <p class="full tiny muted">${icon('info')} Démo : utilise des informations fictives. N'entre pas tes vraies données personnelles.</p>
        <label class="field"><span>Nom et prénom</span><input class="input" name="name" required placeholder="Ex. : Léa Martin"></label>
        <label class="field"><span>E-mail</span><input class="input" type="email" name="email" required placeholder="lea.martin@exemple.fr"></label>
        <label class="field"><span>Téléphone (facultatif)</span><input class="input" name="phone" placeholder="06 00 00 00 00"></label>
        <label class="field"><span>Ville</span><input class="input" name="city" placeholder="Lyon"></label>
        <label class="field"><span>Structure (facultatif)</span><input class="input" name="company" placeholder="Nom de scène, bar, collectif…"></label>
        <label class="field full"><span>Comment as-tu connu AFTR ?</span><select class="select" name="source"><option value="">—</option>${sources.map(s => html`<option>${s}</option>`)}</select></label></div>
      <div class="card stack" style="--gap:12px"><h3><span class="step-n">3</span>Paiement simulé</h3>
        <div class="notice accent">${icon('lock')}<div><b>Aucun paiement réel.</b> Cette boutique est une démonstration : aucune carte bancaire n'est demandée et aucun montant n'est encaissé.</div></div>
        <label class="row small" style="align-items:flex-start"><input type="checkbox" name="accept" required style="margin-top:3px"> <span>Je comprends que cette commande est une simulation dans le cadre d'un projet étudiant.</span></label></div>
    </div>
    <aside class="card stack sticky" style="--gap:12px;align-self:start" id="recap"></aside>
  </form></section>`,
  mount: v => {
    const f = $('#order', v);
    const draw = () => {
      const o = O[st.offer];
      $('#periods', v).innerHTML = html`${[['yearly', `Annuel · ${eur(o.monthly_ttc ? o.yearly.ttc : o.yearly.ht)} ${o.monthly_ttc ? 'TTC' : 'HT'}`], ['monthly', `Mensuel · ${eur(o.monthly_ttc ? o.monthly.ttc : o.monthly.ht)} ${o.monthly_ttc ? 'TTC' : 'HT'}`]].map(([k, l]) => html`<label><input type="radio" name="period" value="${k}" ${st.period === k ? raw('checked') : ''}><span>${l}</span></label>`)}`.s;
      const p = o[st.period];
      $('#recap', v).innerHTML = html`<p class="eyebrow">Récapitulatif</p><h3>${o.label} · ${st.period === 'yearly' ? 'annuel' : 'mensuel'}</h3>
        <div class="row spread small"><span>Prix HT</span><b class="num">${eur(p.ht)}</b></div><div class="row spread small"><span>TVA 20 %</span><b class="num">${eur(p.vat)}</b></div>
        <div class="divider"></div><div class="row spread"><b>Total TTC</b><b class="num" style="font-size:22px">${eur(p.ttc)}</b></div>
        ${st.period === 'yearly' ? html`<p class="tiny muted">Soit 2 mois offerts par rapport au mensuel.</p>` : html`<p class="tiny muted">Sans engagement, résiliable chaque mois.</p>`}
        <button class="btn primary lg" type="submit">${icon('lock')}Payer ${eur(p.ttc)} (simulation)</button>`.s;
    };
    draw();
    f.addEventListener('change', e => { if (e.target.name === 'offer' || e.target.name === 'period') { st[e.target.name] = e.target.value; draw(); history.replaceState({}, '', `/commande?offre=${st.offer}&duree=${st.period}`); } });
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const { ref } = await act(f.querySelector('[type=submit]'), () => api.post('/api/orders', { ...formData(f), offer: st.offer, period: st.period }));
      navigate('/commande/confirmation/' + ref);
    });
  } };
}

export async function confirmation({ params }) {
  const { order: o } = await api.get('/api/orders/' + params.ref);
  return { title: 'Commande confirmée', html: html`
  <section class="wrap page-hero" style="padding-bottom:20px"><p class="eyebrow accent">Commande confirmée · paiement simulé</p><h1>Merci,<br>c'est validé !</h1><p>Ta commande <b>${o.ref}</b> est enregistrée. Aucun montant n'a été débité : il s'agit d'une démonstration.</p></section>
  <section class="wrap" style="padding-bottom:70px"><div class="split-wide">
    <div class="card stack" style="--gap:10px"><h3>Récapitulatif</h3>
      <div class="row spread small"><span>Offre</span><b>${o.label} · ${o.period === 'yearly' ? 'annuel' : 'mensuel'}</b></div>
      <div class="row spread small"><span>Client</span><b>${o.name}${o.company ? ` (${o.company})` : ''}</b></div>
      <div class="row spread small"><span>E-mail</span><b>${o.email}</b></div>
      <div class="row spread small"><span>Prix HT</span><b class="num">${eur(o.amount_ht)}</b></div>
      <div class="row spread small"><span>TVA 20 %</span><b class="num">${eur(o.vat)}</b></div>
      <div class="divider"></div><div class="row spread"><b>Total TTC (simulé)</b><b class="num" style="font-size:22px">${eur(o.amount_ttc)}</b></div>
      <p class="tiny muted">Commande du ${fmt.date(o.created_at)}.</p></div>
    <div class="card stack" style="--gap:12px;align-self:start"><h3>Et ensuite ?</h3>
      <ol class="steps-list"><li>La commande est arrivée dans le CRM : la fiche client est passée à l'étape « Gagné ».</li><li>L'équipe a une prochaine action planifiée : un appel de bienvenue sous 48 h.</li><li>Tu peux créer ton profil et commencer tout de suite.</li></ol>
      <a class="btn primary" href="/crm?contact=${o.contact_id}">${icon('contacts')}Voir ce client dans le CRM</a><a class="btn" href="/tarifs">Retour aux offres</a></div>
  </div></section>` };
}

// ───────── 2. CRM : accès direct en démo
export function crmEntry({ query }) {
  return { title: 'CRM', html: html`
  ${hero('Espace entreprise', 'Le CRM<br>d\'AFTR', 'Le CRM interne suit les prospects et les clients d\'AFTR : fiches, pipeline par étapes et tableau de bord. Il s\'ouvre sans vrai compte, avec le compte de démonstration de l\'équipe.')}
  ${projectNav('/crm')}
  <section class="wrap" style="padding:24px 0 70px"><div class="split-wide">
    <div class="card stack" style="--gap:12px"><h3>Identifiants de démo</h3>
      <div class="row spread small"><span>E-mail</span><b class="mono">admin@aftr.demo</b></div><div class="row spread small"><span>Mot de passe</span><b class="mono">aftr2026</b></div>
      <p class="tiny muted">Compte fictif de démonstration, sans aucune donnée réelle. Le bouton ci-dessous connecte directement.</p>
      <button class="btn primary lg" id="open">${icon('contacts')}Ouvrir le CRM</button></div>
    <div class="card stack" style="--gap:8px;align-self:start"><h3>Ce que tu y trouves</h3>
      <ul class="steps-list"><li>Plus de 80 contacts fictifs, avec recherche et filtres (segment, source, ville, étape).</li><li>Une fiche par contact : coordonnées, source, historique des échanges et prochaine action.</li><li>Le pipeline Nouveau → Contacté → Proposition envoyée → Gagné / Perdu, avec un bouton pour faire avancer chaque contact.</li><li>Le tableau de bord : chiffre d'affaires, clients, taux de conversion. Les commandes du site y arrivent en direct.</li></ul></div>
  </div></section>`,
  mount: v => {
    const go = async btn => {
      await act(btn, () => api.post('/api/auth/demo', { account: 'admin' }));
      await refreshMe();
      navigate(query.contact ? '/app/admin/crm/' + query.contact : '/app/admin/crm');
    };
    $('#open', v).onclick = e => go(e.currentTarget);
    if (query.contact) go($('#open', v));
  } };
}

// ───────── 3. Dossier stratégique
export function strategy() {
  const competitors = [
    ['GigSalad', 'Marketplace américaine de réservation d\'artistes', html`Pro : 359 $ / an ; Featured : 479 $ / an ; frais de 2,5 % par réservation (5 % en gratuit) ${src('gigsalad')} ${src('gigsaladFees')}`, 'En anglais, centré sur les États-Unis, sans devis ni factures françaises ni outils de contenu.'],
    ['Gigwell', 'Logiciel de booking pour agences et artistes', html`Agency : 150 $ / mois ; Artist Essentials : 250 $ / mois, frais de mise en place possibles ${src('gigwell')}`, 'Pensé pour les agences : plus de dix fois le prix de DJ Pro pour un DJ indépendant.'],
    ['Freebe', 'Facturation et suivi pour freelances', html`12,50 € / mois, soit 150 € TTC / an ${src('freebe')}`, 'Fait les factures, mais ne trouve pas de dates et ne produit aucun contenu.'],
    ['Indy', 'Comptabilité et facturation pour indépendants', html`Essentiel 0 € ; Plus dès 9 € HT / mois ${src('indy')}`, 'Outil comptable généraliste, sans marketplace ni fonctions propres aux DJs.'],
    ['OpusClip', 'Découpe de vidéos longues en clips', html`Starter 15 $ / mois ; Pro 29 $ / mois ${src('opus')}`, 'Généraliste ; le Set Clipper d\'AFTR repère les drops d\'un set et est inclus dans DJ Pro.'],
  ];
  const persona = (name, img, rows, quote) => html`<div class="card stack" style="--gap:10px"><div class="row"><span class="av lg" style="background-image:url('https://images.unsplash.com/${img}?auto=format&fit=crop&w=200&q=70')" role="img" aria-label="Photo d'illustration"></span><div><h3>${name}</h3><span class="tag">persona fictif</span></div></div>
    <dl class="dl">${rows.map(([k, v]) => html`<dt>${k}</dt><dd>${v}</dd>`)}</dl><p class="panel small">« ${quote} »</p></div>`;
  return { title: 'Dossier stratégique', html: html`
  ${hero('Dossier stratégique', 'Pourquoi<br>AFTR ?', 'Le problème, la cible, le marché, la concurrence, le prix et le modèle économique. Chaque chiffre de marché a sa source ; les autres sont des estimations, avec le calcul.')}
  ${projectNav('/strategie')}
  <section class="wrap prose-sections">
    <div class="doc-section"><h2>1. Le problème</h2>
      <p><b>Qui le vit :</b> les DJs indépendants qui jouent en club, en bar, en soirée privée ou en mariage. La plupart sont micro-entrepreneurs et gèrent seuls leur activité : trouver des dates, répondre aux demandes, faire les devis et les factures, relancer, et publier sur les réseaux pour rester visibles.</p>
      <p><b>À quelle fréquence :</b> à chaque date. Pour un DJ qui joue environ 30 fois par an, cela fait 2 à 3 fois par mois le même cycle : demande, devis, feuille de route, facture, relance, puis un post ou un clip pour montrer la soirée.</p>
      <p><b>Ce que ça coûte aujourd'hui</b> ${est}</p>
      <div class="calc"><div>Temps : 30 dates × 2 h d'administratif et de contenu par date = <b>60 h par an</b></div><div>Valorisé à 20 € de l'heure : 60 × 20 = <b>1 200 € par an</b></div><div>Outils séparés : facturation Freebe (150 € TTC / an ${src('freebe')}) + clips OpusClip Starter (15 $ / mois ${src('opus')}, soit environ 165 € / an) = <b>environ 315 € par an</b></div></div>
      <p class="small muted">Hypothèses : 30 dates par an et 2 h par date, à valider par des entretiens avec des DJs. Côté organisateurs, le problème est l'inverse : trouver vite un DJ fiable, comparer les devis et éviter les annulations.</p></div>

    <div class="doc-section"><h2>2. La cible : deux personas</h2><div class="grid g2">
      ${persona('Inès, DJ indépendante', 'photo-1594623930572-300a3011d9ae', [['Âge', '26 ans'], ['Métier', 'DJ afro, amapiano et rap, micro-entrepreneuse à Lyon, en parallèle d\'un poste en communication'], ['Activité', '25 à 35 dates par an, cachets de 200 à 500 €'], ['Budget outils', '10 à 20 € par mois'], ['Où elle s\'informe', 'Instagram, TikTok, groupes WhatsApp de DJs, tutos YouTube']], 'Je fais mes factures sur Word et j\'oublie de relancer. Et mes vidéos de sets dorment sur mon téléphone.')}
      ${persona('Karim, programmateur', 'photo-1470229722913-7c0e2dbbafd3', [['Âge', '34 ans'], ['Métier', 'Responsable de la programmation d\'un bar-club à Lille'], ['Activité', '6 à 10 soirées par mois, cachets DJ de 150 à 600 €'], ['Budget outils', 'jusqu\'à 50 € HT par mois'], ['Où il s\'informe', 'LinkedIn, Instagram, bouche-à-oreille, salons professionnels']], 'Je passe mes semaines à chercher des DJs dans mes DM et à comparer des devis par e-mail.')}
    </div></div>

    <div class="doc-section"><h2>3. Le marché</h2>
      <div class="grid g2">
        <div class="kpi"><b>247 000</b><span>mariages célébrés en France en 2024, en légère hausse ${real} ${src('insee')}</span></div>
        <div class="kpi"><b>2,9 M</b><span>auto-entrepreneurs actifs fin 2024, soit 230 000 de plus en un an : le statut de la plupart des DJs progresse ${real} ${src('bpi')}</span></div>
        <div class="kpi"><b>2 000 à 2 500</b><span>discothèques en France selon la Sacem (chiffre de 2014, le plus récent trouvé) ${real} ${src('sacem')}</span></div>
        <div class="kpi"><b>15,1 Md $</b><span>valeur mondiale de l'industrie des musiques électroniques en 2025, +7 % sur un an ${real} ${src('ims')}</span></div>
      </div>
      <h3 style="margin-top:22px">Taille du marché adressable ${est}</h3>
      <div class="calc"><div>Mariages avec DJ : 247 000 × 60 % (hypothèse) = <b>environ 148 000 prestations par an</b></div>
        <div>Clubs : 2 000 discothèques × 2 soirées DJ par semaine × 52 semaines = <b>208 000 soirées par an</b></div>
        <div>Bars, soirées étudiantes, privées et d'entreprise : hypothèse d'un volume équivalent aux clubs = <b>environ 200 000</b></div>
        <div>Total : <b>environ 556 000 prestations par an</b>. À 30 dates par DJ, cela fait vivre <b>environ 18 500 DJs actifs</b>.</div>
        <div>Marché des abonnements DJ : 18 500 × 149 € TTC par an = <b>environ 2,8 M€ par an</b>. L'objectif à 12 mois (350 DJ Pro) représente <b>moins de 2 %</b> de ce marché.</div></div>
      <h3 style="margin-top:22px">Tendances</h3>
      <ul class="steps-list"><li>Le travail indépendant progresse : +230 000 auto-entrepreneurs actifs en 2024 ${src('bpi')}.</li><li>Les musiques électroniques continuent de croître : +6 % en 2024, puis +7 % en 2025 ${src('ims')}.</li><li>Le nombre de discothèques a été divisé par deux en trente ans ${src('sacem')} : les dates se déplacent vers les bars, les événements privés et les soirées ponctuelles, plus nombreuses et plus dispersées. Il faut donc plus de prospection et d'organisation pour chaque DJ.</li></ul></div>

    <div class="doc-section"><h2>4. La concurrence</h2>
      <div class="table-wrap"><table class="table"><thead><tr><th>Concurrent</th><th>Ce qu'il fait</th><th>Prix public</th><th>Ce qui distingue AFTR</th></tr></thead><tbody>
        ${competitors.map(([n, w, p, d]) => html`<tr><td><b>${n}</b></td><td class="small">${w}</td><td class="small">${p}</td><td class="small">${d}</td></tr>`)}
        <tr><td><b>Instagram + Word + DM</b></td><td class="small">La solution actuelle de la plupart des DJs</td><td class="small">Gratuit, mais environ 60 h par an ${est}</td><td class="small">Tout est au même endroit et les demandes arrivent toutes seules.</td></tr>
      </tbody></table></div>
      <p class="small muted" style="margin-top:8px">Prix relevés sur les pages officielles le 10 novembre 2026. Les prix en dollars sont ceux affichés par les éditeurs. Aucun de ces acteurs ne travaille avec AFTR.</p></div>

    <div class="doc-section" id="prix"><h2>5. Le prix</h2>
      <p>DJ Pro est vendu <b>14,90 € TTC par mois</b> (12,42 € HT) ou <b>149 € TTC par an</b>. Organisateur Plus est vendu <b>29 € HT par mois</b> ou 290 € HT par an.</p>
      <div class="grid g3">
        <div class="card stack" style="--gap:6px"><b>Prix des concurrents</b><p class="small muted">Un DJ qui assemble seul ses outils paie environ 315 € par an pour la facturation et les clips, et 359 $ par an pour une marketplace comme GigSalad Pro. À 149 € par an, DJ Pro coûte moins que la seule facturation Freebe (150 € TTC par an) et réunit les trois usages.</p></div>
        <div class="card stack" style="--gap:6px"><b>Coûts ${est}</b><p class="small muted">Hypothèse : environ 1,50 € par abonné et par mois (hébergement, stockage des clips, frais de paiement). Sur 12,42 € HT, la marge brute est d'environ 88 %, ce qui finance l'acquisition.</p></div>
        <div class="card stack" style="--gap:6px"><b>Valeur pour le client ${est}</b><p class="small muted">Une seule date en plus par an (cachet de 200 à 500 € pour Inès) rembourse plus d'un an d'abonnement. Les 60 h d'administratif estimées valent environ 1 200 € par an.</p></div>
      </div>
      <p style="margin-top:14px"><b>Pourquoi c'est cohérent :</b> DJ Pro reste sous le seuil des 15 € par mois, accessible à une micro-entrepreneuse, et le prix est affiché TTC car elle ne récupère pas la TVA. Organisateur Plus vise des entreprises : prix HT, nettement sous Gigwell (150 $ par mois), et inférieur à un dixième d'un cachet moyen. La commission de 8 % payée par l'organisateur, prévue avec le paiement en ligne, reste sous les frais de 10 à 12 % que GigSalad facture aux organisateurs ${src('gigsaladFees')}.</p></div>

    <div class="doc-section"><h2>6. Le modèle économique</h2>
      <p>AFTR gagne de l'argent de trois façons : les <b>abonnements DJ Pro</b> (le cœur du modèle), les <b>abonnements Organisateur Plus</b>, puis, quand le paiement en ligne sera ouvert, des <b>frais de service de 8 %</b> sur les réservations, payés par l'organisateur. Les formules gratuites servent de porte d'entrée : elles remplissent la marketplace et alimentent le CRM.</p>
      <h3>Objectif à 12 mois : 5 000 € HT de revenu mensuel récurrent ${est}</h3>
      <div class="calc"><div>350 DJ Pro × 12,42 € HT = <b>4 347 € HT par mois</b></div><div>23 Organisateur Plus × 29 € HT = <b>667 € HT par mois</b></div><div>Total : <b>5 014 € HT par mois</b>, soit environ 60 000 € HT de revenu annuel récurrent à la fin de l'année 1</div>
        <div>Ce qu'il faut vendre : avec 8 % des DJs gratuits qui passent en Pro (hypothèse), il faut <b>4 375 DJs inscrits</b> ; avec 5 % pour les organisateurs, <b>460 organisateurs inscrits</b>.</div>
        <div>Chiffre d'affaires cumulé de l'année 1, avec une montée régulière de 0 à 5 014 € par mois : environ 5 014 × 12 ÷ 2 = <b>environ 30 000 € HT</b></div></div>
      <p class="small muted">Le suivi de ces objectifs se fait dans le <a class="link" href="/crm">CRM</a> (clients, conversion) et dans le <a class="link" href="/communication#kpi">plan de communication</a> (indicateurs).</p></div>

    <div class="doc-section"><h2>Sources</h2><ol class="sources">${Object.values(S).map(([t, u]) => html`<li><a href="${u}" target="_blank" rel="noopener">${t}</a> <span class="tiny muted">${u.replace(/^https:\/\//, '')}</span></li>`)}</ol>
      <p class="tiny muted">Chaque lien a été ouvert le 10 novembre 2026. Les chiffres marqués « Estimation » sont des calculs à partir d'hypothèses, détaillés à côté de chaque résultat.</p></div>
  </section>` };
}

// ───────── 4. Plan de communication
const POSTS = [
  { id: 'li1', network: 'LinkedIn', format: 'Post texte + visuel 4:5', date: '2026-11-16', time: '09:00', goal: 'Notoriété B2B', tpl: 'bandeau', size: 'post', pal: 'nuit', photo: 'unsplash:photo-1470229722913-7c0e2dbbafd3',
    texts: { kicker: 'Nouveau', title: 'Trouver un DJ fiable en 48 h', subtitle: 'AFTR, la plateforme des DJs et des organisateurs', info: 'Profils · devis · suivi', handle: 'aftr' },
    text: "Programmer une soirée, c'est souvent 15 DM, 6 devis par e-mail et un DJ qui annule la veille.\n\nOn a construit AFTR pour régler ça : une marketplace de DJs avec leurs styles, leurs extraits et leurs disponibilités, et un suivi de chaque demande jusqu'à la confirmation.\n\nVous gérez un bar, un club, une agence ou un collectif ? Le compte organisateur est gratuit.\n\n👉 Lien en commentaire.\n\n#événementiel #nightlife #DJ #programmation" },
  { id: 'ig1', network: 'Instagram', format: 'Carrousel 4:5 (6 slides)', date: '2026-11-17', time: '18:30', goal: 'Notoriété', tpl: 'typo', size: 'post', pal: 'nuit',
    texts: { kicker: 'Métier de DJ', title: '5 trucs que personne ne te dit', subtitle: 'Swipe →', info: 'Le guide AFTR', handle: '@aftr.app' },
    text: "5 trucs que personne ne te dit quand tu commences à mixer 👇\n\n1. Ton premier client, c'est souvent ton réseau.\n2. Un devis clair rassure plus qu'un long mix.\n3. Les relances font la moitié des dates.\n4. Une vidéo de 20 secondes vend mieux qu'un set de 2 heures.\n5. Une facture propre, c'est un organisateur qui te rappelle.\n\nTu veux tout gérer au même endroit ? AFTR, lien en bio.\n\nEnregistre ce post pour plus tard 🔖\n\n#dj #djlife #djfrance #nightlife #mix #afrohouse #amapiano" },
  { id: 'tt1', network: 'TikTok', format: 'Vidéo verticale 9:16, 20 s', date: '2026-11-18', time: '20:00', goal: 'Notoriété', tpl: 'citation', size: 'story', pal: 'neon',
    texts: { kicker: '', title: 'POV : tu passes plus de temps sur tes factures que sur tes mix', subtitle: 'Toi, un dimanche soir', info: 'aftr.app', handle: '@aftr.app' },
    text: "POV : tu passes plus de temps sur tes factures que sur tes mix 😮‍💨\n\n(Plan face caméra devant Word, puis transition sur les platines avec AFTR.)\n\nLe lien est en bio.\n\n#dj #djtok #djlife #microentrepreneur #fyp" },
  { id: 'li2', network: 'LinkedIn', format: 'Carrousel PDF (5 pages)', date: '2026-11-24', time: '09:00', goal: 'Génération de prospects', tpl: 'chiffre', size: 'carre', pal: 'jour',
    texts: { kicker: '4', title: 'erreurs qui coûtent une soirée', subtitle: 'Le guide des organisateurs', info: 'Organisateurs', handle: 'AFTR' },
    text: "4 erreurs qui coûtent une soirée (et comment les éviter) :\n\n1. Réserver sans avoir écouté un extrait récent du DJ.\n2. Ne pas écrire la feuille de route (horaires, matériel, contact sur place).\n3. Comparer des devis qui ne contiennent pas la même chose.\n4. Tout gérer dans les DM, sans historique.\n\nDans AFTR, chaque demande a son devis, sa feuille de route et son historique, partagés avec le DJ.\n\nVous organisez plus de 4 soirées par mois ? Parlons-en en commentaire.\n\n#événementiel #organisation #nightlife #DJ" },
  { id: 'tt2', network: 'TikTok', format: 'Tuto écran 9:16, 35 s', date: '2026-11-25', time: '20:00', goal: 'Inscriptions', tpl: 'chiffre', size: 'story', pal: 'club',
    texts: { kicker: '3 clips', title: 'avec 2 h de set, en 2 minutes', subtitle: 'Le Set Clipper d\'AFTR', info: 'Tuto', handle: '@aftr.app' },
    text: "Ton set de 2 h dort sur ton téléphone ? On en sort 3 clips verticaux en 2 minutes 🎛️\n\n1. Tu importes la vidéo.\n2. AFTR repère les drops et les montées.\n3. Tu exportes en 9:16 avec ta signature.\n\nTeste-le : lien en bio.\n\n#dj #djtok #setclipper #reels #afrohouse" },
  { id: 'ig2', network: 'Instagram', format: 'Reel 9:16 (couverture)', date: '2026-11-27', time: '19:00', goal: 'Inscriptions', tpl: 'affiche', size: 'story', pal: 'nuit', photo: 'unsplash:photo-1545128485-c400e7702796',
    texts: { kicker: 'Nouveau', title: 'Ton set en clip vertical', subtitle: 'En 2 minutes, sans montage', info: 'Set Clipper · AFTR', handle: '@aftr.app' },
    text: "Ton set en clip vertical, en 2 minutes et sans logiciel de montage 🔥\n\nLe Set Clipper d'AFTR écoute ton set, repère les meilleurs moments et les exporte en Reel avec ta signature.\n\nDispo dans DJ Pro. Lien en bio.\n\n#dj #djlife #reels #nightlife #djfrance #setclipper" },
  { id: 'tt3', network: 'TikTok', format: 'Vidéo 9:16, 15 s', date: '2026-12-02', time: '20:00', goal: 'Engagement', tpl: 'affiche', size: 'story', pal: 'sunset', photo: 'unsplash:photo-1533174072545-7a4b6ad7a6c3',
    texts: { kicker: 'Ton tour', title: 'Le drop qui a retourné la salle', subtitle: 'Montre-nous le tien', info: 'Duo ou réponse vidéo', handle: '@aftr.app' },
    text: "Montre-nous LE drop qui a retourné la salle 👇\n\nRéponds en vidéo avec ton meilleur moment de set. On repartage les 5 meilleurs vendredi.\n\n#dj #djtok #drop #nightlife #fyp" },
  { id: 'li3', network: 'LinkedIn', format: 'Post + visuel 1:1', date: '2026-12-08', time: '09:00', goal: 'Conversion B2B', tpl: 'date', size: 'carre', pal: 'nuit',
    texts: { kicker: 'Offre pro', title: 'Organisateur Plus', subtitle: '29 € HT par mois · événements illimités · calendrier d\'équipe', info: 'Pour clubs, bars et agences', handle: 'AFTR' },
    text: "Clubs, bars, agences, collectifs : Organisateur Plus arrive.\n\nÉvénements illimités, calendrier d'équipe, historique et comparaison des devis, support prioritaire. 29 € HT par mois, sans engagement.\n\nOn cherche 10 lieux partenaires pour le lancement : écrivez-nous en message privé.\n\n#événementiel #nightlife #programmation #DJ" },
  { id: 'ig3', network: 'Instagram', format: 'Post 4:5', date: '2026-12-10', time: '18:30', goal: 'Conversion', tpl: 'chiffre', size: 'post', pal: 'nuit',
    texts: { kicker: '149 €', title: 'par an pour DJ Pro', subtitle: '2 mois offerts sur la formule annuelle. CRM, devis, factures, Set Clipper.', info: 'Offre de lancement', handle: '@aftr.app' },
    text: "Tout ton business de DJ, pour 149 € par an 🎧\n\nCRM et relances, devis et factures PDF, calendrier, Set Clipper et studio visuel. Soit 2 mois offerts par rapport au mensuel (14,90 €).\n\nLien en bio pour passer Pro.\n\n#dj #djlife #djfrance #microentrepreneur #nightlife" },
];
const NET_ICON = { Instagram: 'instagram', TikTok: 'video', LinkedIn: 'users' };
const dlong = d => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

export function communication() {
  const weeks = [['Semaine 1', '2026-11-16'], ['Semaine 2', '2026-11-23'], ['Semaine 3', '2026-11-30'], ['Semaine 4', '2026-12-07']];
  const other = { '2026-11-19': 'Newsletter n° 1 : lancement', '2026-11-20': 'Messages aux 5 partenaires', '2026-11-26': 'Atelier Set Clipper (école de DJ)', '2026-12-03': 'Newsletter n° 2 : témoignages bêta', '2026-12-04': 'Live Instagram : questions-réponses', '2026-12-11': 'Soirée de lancement (lieu à confirmer)' };
  const addD = (iso, n) => { const x = new Date(iso + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const partners = [
    ['Technopol', 'Association de défense des musiques électroniques', '3 mois de DJ Pro offerts à ses adhérents DJs et un atelier « gérer son activité de DJ »', 'Un service concret pour ses adhérents et des données anonymisées sur la profession'],
    ['Trax Magazine', 'Média des musiques électroniques', 'Une série de contenus co-produits sur les coulisses du métier de DJ', 'Des sujets exclusifs et un accès à la communauté AFTR'],
    ['Shotgun', 'Billetterie de soirées', 'Le lien de billetterie affiché sur les événements AFTR et partagé par les DJs', 'Plus de billets vendus grâce à la diffusion par les DJs'],
    ['DJ Network', 'École de DJ', 'Une licence DJ Pro offerte aux élèves en fin de formation', 'L\'insertion professionnelle de ses élèves, un argument pour ses formations'],
    ['Le Sucre (Lyon)', 'Club et lieu de soirées', 'Une soirée de lancement avec des DJs de la plateforme', 'Une soirée remplie par la communauté et du contenu pour ses réseaux'],
    ['Micro-créateurs DJ', 'Créateurs de contenu (10 000 à 50 000 abonnés)', 'Un code d\'affiliation : 20 % du premier paiement de chaque abonné apporté', 'Un revenu complémentaire et un outil gratuit pour eux'],
  ];
  const first10 = [
    ['Réseau de la fondatrice', '40 DJs connus personnellement à Lyon : message personnel avec un clip de leur set offert, fait avec le Set Clipper.', '4 clients'],
    ['Ateliers en école de DJ et BDE', '2 démonstrations en direct du Set Clipper et des factures, avec le 1er mois offert sur place.', '3 clients'],
    ['Prospection Instagram', '60 messages privés à des DJs locaux de 1 000 à 10 000 abonnés, avec un clip gratuit de leur set.', '2 clients'],
    ['Organisateurs lyonnais', '15 bars et collectifs contactés sur LinkedIn puis rencontrés sur place.', '1 client Organisateur Plus'],
  ];
  const kpis = [
    ['Notoriété', 'Portée et abonnés gagnés par réseau', '+1 500 abonnés Instagram, 30 000 vues TikTok', 'Statistiques Instagram, TikTok, LinkedIn'],
    ['Engagement', 'Taux d\'engagement (likes, commentaires, partages, enregistrements ÷ portée)', '4 % sur Instagram', 'Suivi des posts dans Ma com\''],
    ['Acquisition', 'Visites du site, inscriptions, coût par inscription', '600 inscriptions, moins de 3 € par inscription', 'Analytics AFTR, sources du CRM'],
    ['Conversion', 'Part des inscrits gratuits qui passent en Pro ; taux de conversion du CRM', '8 % des DJs inscrits', 'Tableau de bord du CRM'],
    ['Revenu', 'Revenu mensuel récurrent (MRR) et chiffre d\'affaires', '1 000 € HT de MRR à 3 mois', 'Tableau de bord du CRM'],
    ['Fidélisation', 'Désabonnements mensuels', 'moins de 5 % par mois', 'Abonnements (admin)'],
  ];
  return { title: 'Plan de communication', html: html`
  ${hero('Plan de communication', 'Comment<br>vendre AFTR', 'De quoi lancer la communication dès demain : la marque, les canaux, 9 posts prêts à publier, le calendrier sur quatre semaines, les partenariats, les dix premiers clients et les indicateurs.')}
  ${projectNav('/communication')}
  <section class="wrap prose-sections">
    <div class="doc-section"><h2>1. La plateforme de marque</h2><div class="grid g2">
      <div class="card stack" style="--gap:8px"><p class="eyebrow">Nom</p><p class="logo" style="font-size:40px">AFT<i>R</i></p><p class="small muted">« After » : le moment après la soirée, quand on parle de ce qui s'est passé. AFTR, c'est le lieu où les DJs se retrouvent et où se joue la suite de leur carrière.</p></div>
      <div class="card stack" style="--gap:8px"><p class="eyebrow">Promesse</p><p style="font-size:18px;font-weight:600">${PROMISE}</p></div>
      <div class="card stack" style="--gap:8px"><p class="eyebrow">Ton</p><p>Direct, nocturne et complice. On tutoie les DJs et on vouvoie les organisateurs sur LinkedIn. Des phrases courtes, des exemples concrets, jamais de jargon.</p></div>
      <div class="card stack" style="--gap:8px"><p class="eyebrow">Trois messages clés</p><ol class="steps-list"><li><b>Plus de dates :</b> les organisateurs te trouvent par style, ville et budget.</li><li><b>Moins d'admin :</b> devis, factures et relances en quelques clics.</li><li><b>Plus de visibilité :</b> tes sets deviennent des clips et des posts prêts à publier.</li></ol></div>
    </div></div>

    <div class="doc-section"><h2>2. Les canaux</h2><div class="table-wrap"><table class="table"><thead><tr><th>Canal</th><th>Pour qui</th><th>Pourquoi ce canal</th><th>Rythme</th></tr></thead><tbody>
      <tr><td><b>Instagram</b></td><td>DJs (Inès)</td><td>C'est là qu'Inès s'informe et montre son travail : Reels, carrousels et messages privés.</td><td>2 posts par semaine</td></tr>
      <tr><td><b>TikTok</b></td><td>Jeunes DJs</td><td>Vidéos courtes de sets et tutoriels : le format du Set Clipper.</td><td>1 à 2 vidéos par semaine</td></tr>
      <tr><td><b>LinkedIn</b></td><td>Organisateurs (Karim)</td><td>Les programmateurs, agences et lieux y cherchent des solutions professionnelles.</td><td>1 post par semaine</td></tr>
      <tr><td><b>Newsletter</b></td><td>Inscrits</td><td>Transformer les inscrits gratuits en abonnés Pro (Newsletter Studio de l'admin).</td><td>Toutes les 2 semaines</td></tr>
      <tr><td><b>Partenariats et terrain</b></td><td>DJs et lieux</td><td>Écoles, associations et clubs donnent accès à des communautés déjà réunies.</td><td>2 actions par mois</td></tr>
    </tbody></table></div></div>

    <div class="doc-section"><h2>3. Neuf posts prêts à publier</h2><p class="muted" style="margin-bottom:14px">Chaque visuel est généré au bon format par le Studio visuel d'AFTR. Télécharge l'image et copie le texte : le post est prêt.</p>
      <div class="posts-grid">${POSTS.map(p => html`<article class="post-card" id="post-${p.id}">
        <canvas data-post="${p.id}" aria-label="Visuel du post ${p.network}"></canvas>
        <div class="stack" style="--gap:8px"><div class="row spread"><span class="chip">${icon(NET_ICON[p.network])}${p.network}</span><span class="tiny muted">${p.format}</span></div>
          <div class="row small" style="--gap:14px;flex-wrap:wrap"><span>${icon('calendar')} ${dlong(p.date)} · ${p.time.replace(':', ' h ')}</span><span>${icon('target')} ${p.goal}</span></div>
          <textarea class="textarea" rows="8" readonly id="txt-${p.id}">${p.text}</textarea>
          <div class="row"><button class="btn sm" data-dl="${p.id}">${icon('download')}Visuel PNG</button><button class="btn sm" data-copy="${p.id}">${icon('file')}Copier le texte</button></div></div></article>`)}</div></div>

    <div class="doc-section"><h2>4. Le calendrier éditorial (4 semaines)</h2><div class="table-wrap"><table class="table cal-table"><thead><tr><th></th>${['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => html`<th>${d}</th>`)}</tr></thead><tbody>
      ${weeks.map(([w, start]) => html`<tr><th class="small">${w}<div class="tiny muted">${fmt.dayMonth(start)}</div></th>${[0, 1, 2, 3, 4, 5, 6].map(i => { const day = addD(start, i), ps = POSTS.filter(p => p.date === day); return html`<td class="tiny">${ps.map(p => html`<a href="#post-${p.id}" class="cal-pill">${p.network} · ${p.goal}</a>`)}${other[day] ? html`<span class="cal-pill alt">${other[day]}</span>` : ''}</td>`; })}</tr>`)}
    </tbody></table></div></div>

    <div class="doc-section"><h2>5. Partenariats possibles</h2><p class="notice small" style="margin-bottom:12px">${icon('info')}<span>Partenaires <b>potentiels</b> : aucun accord n'existe à ce jour et aucun ne travaille avec AFTR. Aucun logo n'est utilisé.</span></p>
      <div class="table-wrap"><table class="table"><thead><tr><th>Partenaire</th><th>Type</th><th>Ce qu'on leur propose</th><th>Ce qu'ils y gagnent</th></tr></thead><tbody>
      ${partners.map(([n, t, o, g]) => html`<tr><td><b>${n}</b></td><td class="small">${t}</td><td class="small">${o}</td><td class="small">${g}</td></tr>`)}</tbody></table></div></div>

    <div class="doc-section"><h2>6. Trouver les dix premiers clients</h2><div class="grid g2">${first10.map(([t, d, n], i) => html`<div class="card stack" style="--gap:6px"><div class="row spread"><b>${i + 1}. ${t}</b><span class="chip accent">${n}</span></div><p class="small muted">${d}</p></div>`)}</div>
      <div class="calc" style="margin-top:14px"><div>Entonnoir ${est} : 115 contacts → 35 essais (30 %) → <b>10 clients payants</b> (environ 29 % des essais), en 6 semaines.</div><div>Offre de lancement : le premier mois offert, puis le prix normal. Chaque contact est saisi dans le <a class="link" href="/crm">CRM</a> avec sa source, pour savoir quel canal fonctionne.</div></div></div>

    <div class="doc-section" id="kpi"><h2>7. Les indicateurs</h2><div class="table-wrap"><table class="table"><thead><tr><th>Objectif</th><th>Indicateur</th><th>Cible à 3 mois ${est}</th><th>Où le mesurer</th></tr></thead><tbody>
      ${kpis.map(([o, i, c, w]) => html`<tr><td><b>${o}</b></td><td class="small">${i}</td><td class="small">${c}</td><td class="small">${w}</td></tr>`)}</tbody></table></div></div>
  </section>`,
  mount: v => {
    const canvases = Object.fromEntries($$('canvas[data-post]', v).map(c => [c.dataset.post, c]));
    POSTS.forEach(p => drawTemplate(canvases[p.id], { ...p, scale: .5 }).catch(() => {}));
    on(v, 'click', '[data-copy]', async (e, b) => { try { await navigator.clipboard.writeText($('#txt-' + b.dataset.copy, v).value); toast('Texte copié'); } catch { $('#txt-' + b.dataset.copy, v).select(); toast('Texte sélectionné : Cmd + C'); } });
    on(v, 'click', '[data-dl]', async (e, b) => {
      const p = POSTS.find(x => x.id === b.dataset.dl), c = document.createElement('canvas');
      await drawTemplate(c, { ...p, scale: 1 });
      c.toBlob(blob => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `aftr-${p.network.toLowerCase()}-${p.date}.png`; a.click(); toast('Visuel téléchargé'); }, 'image/png');
    });
  } };
}
