// Routeur et gabarits (site public, authentification, application).
import { html, raw, $, $$, on, api, state, icon, avatar, esc, toast, fmt, img } from './core.js';

const R = (path, mod, fn, opts = {}) => ({ path, mod, fn, layout: 'app', ...opts, re: new RegExp('^' + path.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '/?$') });
const ROUTES = [
  // Site public
  R('/', 'site', 'home', { layout: 'site' }),
  R('/fonctionnalites', 'site', 'features', { layout: 'site' }),
  R('/artistes', 'site', 'artists', { layout: 'site' }),
  R('/dj/:slug', 'site', 'djPublic', { layout: 'site' }),
  R('/communaute', 'site', 'communityPage', { layout: 'site' }),
  R('/business-studio', 'site', 'studioPage', { layout: 'site' }),
  R('/organisateurs', 'site', 'organizersPage', { layout: 'site' }),
  R('/tarifs', 'site', 'pricing', { layout: 'site' }),
  R('/contact', 'site', 'contact', { layout: 'site' }),
  R('/mentions-legales', 'site', 'legal', { layout: 'site' }),
  R('/confidentialite', 'site', 'privacy', { layout: 'site' }),
  R('/connexion', 'site', 'login', { layout: 'auth' }),
  R('/inscription', 'site', 'signup', { layout: 'auth' }),
  // Application
  R('/app', 'community', 'home'),
  R('/app/fil', 'community', 'feed'),
  R('/app/membres', 'community', 'members'),
  R('/app/membres/:id', 'community', 'member'),
  R('/app/messages', 'community', 'messages'),
  R('/app/messages/:id', 'community', 'messages'),
  R('/app/notifications', 'community', 'notifications'),
  R('/app/parametres', 'settings', 'settings'),
  R('/app/djs', 'market', 'search'),
  R('/app/djs/:slug', 'market', 'djProfile'),
  R('/app/reservations/:id', 'market', 'booking'),
  R('/app/orga', 'market', 'orgDashboard', { role: 'organizer' }),
  R('/app/orga/evenements', 'market', 'orgEvents', { role: 'organizer' }),
  R('/app/orga/demandes', 'market', 'orgRequests', { role: 'organizer' }),
  R('/app/orga/favoris', 'market', 'orgFavorites', { role: 'organizer' }),
  R('/app/orga/calendrier', 'market', 'orgCalendar', { role: 'organizer' }),
  R('/app/studio', 'studio', 'dashboard', { role: 'dj' }),
  R('/app/studio/crm', 'studio', 'crm', { role: 'dj' }),
  R('/app/studio/crm/:id', 'studio', 'crmContact', { role: 'dj' }),
  R('/app/studio/reservations', 'studio', 'bookings', { role: 'dj' }),
  R('/app/studio/calendrier', 'studio', 'calendar', { role: 'dj' }),
  R('/app/studio/devis', 'studio', 'quotes', { role: 'dj' }),
  R('/app/studio/devis/:id', 'studio', 'quoteEdit', { role: 'dj' }),
  R('/app/studio/factures', 'studio', 'invoices', { role: 'dj' }),
  R('/app/studio/factures/:id', 'studio', 'invoiceEdit', { role: 'dj' }),
  R('/app/studio/finances', 'studio', 'finances', { role: 'dj' }),
  R('/app/studio/clipper', 'clipper', 'clipper', { role: 'dj' }),
  R('/app/studio/marketing', 'djmarketing', 'overview', { role: 'dj' }),
  R('/app/studio/marketing/publications', 'djmarketing', 'posts', { role: 'dj' }),
  R('/app/admin', 'admin', 'overview', { role: 'admin' }),
  R('/app/admin/crm', 'admin', 'crm', { role: 'admin' }),
  R('/app/admin/crm/:id', 'admin', 'crmContact', { role: 'admin' }),
  R('/app/admin/entreprises', 'admin', 'companies', { role: 'admin' }),
  R('/app/admin/entreprises/:id', 'admin', 'company', { role: 'admin' }),
  R('/app/admin/utilisateurs', 'admin', 'users', { role: 'admin' }),
  R('/app/admin/bookings', 'admin', 'bookings', { role: 'admin' }),
  R('/app/admin/abonnements', 'admin', 'subscriptions', { role: 'admin' }),
  R('/app/admin/support', 'admin', 'support', { role: 'admin' }),
  R('/app/admin/support/:id', 'admin', 'ticket', { role: 'admin' }),
  R('/app/admin/moderation', 'admin', 'moderation', { role: 'admin' }),
  R('/app/admin/analytics', 'admin', 'analytics', { role: 'admin' }),
  R('/app/admin/demo', 'admin', 'demo', { role: 'admin' }),
  R('/app/admin/marketing', 'marketing', 'hub', { role: 'admin' }),
  R('/app/admin/marketing/strategie', 'marketing', 'strategist', { role: 'admin' }),
  R('/app/admin/marketing/social', 'marketing', 'social', { role: 'admin' }),
  R('/app/admin/marketing/newsletters', 'marketing', 'newsletters', { role: 'admin' }),
  R('/app/admin/marketing/calendrier', 'marketing', 'calendar', { role: 'admin' }),
  R('/app/admin/marketing/automatisations', 'marketing', 'automations', { role: 'admin' }),
  R('/app/admin/marketing/campagnes', 'marketing', 'campaigns', { role: 'admin' }),
];

// ───────── Navigation
export function navigate(url, { replace = false } = {}) {
  if (url === location.pathname + location.search) return render({ keepScroll: true });
  history[replace ? 'replaceState' : 'pushState']({}, '', url);
  render();
}
window.addEventListener('popstate', () => render());
document.addEventListener('click', e => {
  const a = e.target.closest('a[href]');
  if (!a || a.target || a.hasAttribute('download') || e.metaKey || e.ctrlKey || e.shiftKey) return;
  const href = a.getAttribute('href');
  if (!href.startsWith('/') || href.startsWith('/api/') || href.startsWith('/uploads/')) return;
  e.preventDefault();
  closeMenus();
  navigate(href);
});
window.addEventListener('aftr:logout', () => { if (location.pathname.startsWith('/app')) navigate('/connexion'); });

export async function refreshMe() {
  const { user } = await api.get('/api/me');
  state.me = user;
  if (user) applyTheme(user.theme, false);
  return user;
}

// ───────── Thème jour / nuit / auto (enregistré dans le compte)
export async function applyTheme(t, save = true) {
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  if (!save) return;
  if (state.me) { await api.patch('/api/me/theme', { theme: t }); state.me.theme = t; }
  else document.cookie = `aftr_theme=${t}; Path=/; Max-Age=31536000; SameSite=Lax`;
}
const currentTheme = () => document.documentElement.getAttribute('data-theme') || 'auto';
const THEMES = [['light', 'Jour', 'sun'], ['dark', 'Nuit', 'moon'], ['auto', 'Auto', 'monitor']];
function themeSeg() {
  return html`<div class="seg" role="group" aria-label="Thème">${THEMES.map(([k, l, ic]) => html`<button type="button" data-theme-set="${k}" class="${currentTheme() === k ? 'on' : ''}" title="Mode ${l.toLowerCase()}" aria-pressed="${currentTheme() === k}">${l}</button>`)}</div>`;
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-theme-set]');
  if (!b) return;
  await applyTheme(b.dataset.themeSet);
  $$('[data-theme-set]').forEach(x => { x.classList.toggle('on', x.dataset.themeSet === b.dataset.themeSet); x.setAttribute('aria-pressed', x.dataset.themeSet === b.dataset.themeSet); });
  toast(`Mode ${THEMES.find(t => t[0] === b.dataset.themeSet)[1].toLowerCase()} enregistré${state.me ? ' dans ton compte' : ''}`);
});

// ───────── Gabarit du site public
const demoStrip = html`<div class="demo-strip">Démonstration · projet de Master 2 · toutes les données sont fictives</div>`;
function siteShell() {
  const links = [['/artistes', 'Artistes'], ['/communaute', 'Communauté'], ['/business-studio', 'Business Studio'], ['/organisateurs', 'Organisateurs'], ['/tarifs', 'Tarifs']];
  return html`${demoStrip}
  <nav class="site-nav"><div class="wrap inner">
    <a href="/" class="logo" aria-label="AFTR, accueil">AFT<i>R</i></a>
    <div class="site-links" id="site-links">${links.map(([h, l]) => html`<a href="${h}" class="${location.pathname.startsWith(h) ? 'on' : ''}">${l}</a>`)}</div>
    <div class="grow"></div>
    <span class="hide-sm">${themeSeg()}</span>
    ${state.me ? html`<a href="/app" class="btn primary">Mon espace ${icon('arrow')}</a>`
      : html`<a href="/connexion" class="btn ghost hide-sm">Connexion</a><a href="/inscription" class="btn primary">Rejoindre</a>`}
    <button class="btn icon menu-btn" id="site-menu" aria-label="Menu">${icon('menu')}</button>
  </div></nav>
  <main id="view"></main>
  <footer class="site-footer"><div class="wrap stack" style="--gap:36px">
    <div class="cols">
      <div class="stack" style="--gap:12px"><a href="/" class="logo">AFT<i>R</i></a><p>La plateforme qui connecte la culture musicale, la communauté et le business des DJs.</p>${themeSeg()}</div>
      <div><h4>Plateforme</h4><ul><li><a href="/artistes">Découvrir les DJs</a></li><li><a href="/communaute">Communauté</a></li><li><a href="/business-studio">Business Studio</a></li><li><a href="/organisateurs">Organisateurs</a></li></ul></div>
      <div><h4>AFTR</h4><ul><li><a href="/fonctionnalites">Fonctionnalités</a></li><li><a href="/tarifs">Tarifs</a></li><li><a href="/contact">Contact</a></li></ul></div>
      <div><h4>Légal</h4><ul><li><a href="/mentions-legales">Mentions légales</a></li><li><a href="/confidentialite">Confidentialité</a></li></ul></div>
    </div>
    <p class="tiny faint">Projet fictif réalisé dans le cadre d'un Master 2 en marketing digital. Photos : Unsplash (licence Unsplash). Aucune donnée réelle.</p>
  </div></footer>`;
}

// ───────── Gabarit de l'application
function navFor(me) {
  const g = [];
  g.push({ title: 'Communauté', items: [['/app/fil', 'Fil', 'feed'], ['/app/membres', 'Membres', 'users'], ['/app/messages', 'Messages', 'message', me.unreadMessages], ['/app/notifications', 'Notifications', 'bell', me.unread]] });
  g.push({ title: 'Marketplace', items: [['/app/djs', 'Trouver un DJ', 'search']] });
  if (me.roles.includes('dj')) g.push({ title: 'Business Studio', items: [['/app/studio', 'Tableau de bord', 'dashboard'], ['/app/studio/crm', 'CRM & prospects', 'contacts'], ['/app/studio/reservations', 'Réservations', 'ticket'], ['/app/studio/calendrier', 'Calendrier', 'calendar'], ['/app/studio/devis', 'Devis', 'file'], ['/app/studio/factures', 'Factures', 'receipt'], ['/app/studio/finances', 'Finances', 'wallet']] });
    g.push({ title: "Ma com' & réseaux", items: [['/app/studio/marketing', 'Stratégie & suivi', 'target'], ['/app/studio/marketing/publications', 'Publications', 'instagram'], ['/app/studio/clipper', 'Set Clipper', 'scissors']] });
  if (me.roles.includes('organizer')) g.push({ title: 'Espace organisateur', items: [['/app/orga', 'Tableau de bord', 'dashboard'], ['/app/orga/evenements', 'Événements', 'calendar'], ['/app/orga/demandes', 'Réservations', 'ticket'], ['/app/orga/favoris', 'Favoris', 'heart'], ['/app/orga/calendrier', 'Calendrier', 'clock']] });
  if (me.roles.includes('admin')) {
    g.push({ title: 'AFTR Admin', items: [['/app/admin', "Vue d'ensemble", 'dashboard'], ['/app/admin/crm', 'CRM central', 'contacts'], ['/app/admin/entreprises', 'Entreprises', 'building'], ['/app/admin/utilisateurs', 'Utilisateurs', 'users'], ['/app/admin/bookings', 'Bookings & commissions', 'euro'], ['/app/admin/abonnements', 'Abonnements', 'layers'], ['/app/admin/support', 'Support', 'help'], ['/app/admin/moderation', 'Modération', 'shield'], ['/app/admin/analytics', 'Analytics', 'chart']] });
    g.push({ title: 'Marketing Hub', items: [['/app/admin/marketing', 'Vue Marketing', 'megaphone'], ['/app/admin/marketing/strategie', 'Strategist', 'target'], ['/app/admin/marketing/social', 'Social Media Studio', 'instagram'], ['/app/admin/marketing/newsletters', 'Newsletters', 'mail'], ['/app/admin/marketing/calendrier', 'Calendrier éditorial', 'calendar'], ['/app/admin/marketing/campagnes', 'Campagnes', 'flame'], ['/app/admin/marketing/automatisations', 'Automatisations', 'zap'], ['/app/admin/demo', 'Démo', 'refresh']] });
  }
  return g;
}
function activeHref(groups) {
  const all = groups.flatMap(g => g.items.map(i => i[0]));
  return all.filter(h => location.pathname === h || location.pathname.startsWith(h + '/')).sort((a, b) => b.length - a.length)[0];
}
function displayName(me) { return me.dj?.stage_name || me.organizer?.org_name || me.name; }
function roleLabel(me) { return me.roles.map(r => ({ dj: 'DJ', organizer: 'Organisateur', admin: 'Admin' }[r])).join(' · '); }

function appShell() {
  const me = state.me, groups = navFor(me), active = activeHref(groups);
  const photo = me.dj?.photo || me.organizer?.photo || me.avatar;
  return html`
  <div class="app">
    <aside class="sidebar" id="sidebar">
      <div class="row spread"><a href="/" class="logo" aria-label="Site AFTR">AFT<i>R</i></a><span class="chip accent" title="Données fictives">DÉMO</span></div>
      ${groups.map(g => html`<nav class="nav-group" aria-label="${g.title}"><div class="eyebrow">${g.title}</div>
        ${g.items.map(([h, l, ic, count]) => html`<a href="${h}" class="nav-link ${h === active ? 'on' : ''}">${icon(ic)}${l}${count ? html`<span class="count">${count}</span>` : ''}</a>`)}</nav>`)}
      <a href="/app/parametres" class="me">${avatar(displayName(me), photo, 'sm')}<div class="grow"><div class="truncate" style="font-weight:700">${displayName(me)}</div><div class="tiny muted truncate">${roleLabel(me)}</div></div>${icon('settings')}</a>
    </aside>
    <div class="main">
      <header class="topbar">
        <button class="icon-btn mobile-menu" id="open-sidebar" aria-label="Menu">${icon('menu')}</button>
        <div class="search">${icon('search')}<input class="input" id="global-search" type="search" autocomplete="off" placeholder="${me.roles.includes('admin') ? 'Recherche globale : contacts, bookings, tickets…' : 'Rechercher un membre, un DJ, un style…'}" aria-label="Recherche"><div class="search-results" id="search-results" hidden></div></div>
        <div class="grow"></div>
        <span class="hide-sm" style="display:contents">${themeSeg()}</span>
        <div style="position:relative"><button class="icon-btn" id="notif-btn" aria-label="Notifications">${icon('bell')}${me.unread ? html`<span class="badge">${me.unread}</span>` : ''}</button><div class="popover" id="notif-pop" hidden></div></div>
        <div style="position:relative"><button class="icon-btn" id="user-btn" aria-label="Mon compte" style="padding:0;overflow:hidden">${avatar(displayName(me), photo, 'sm')}</button>
          <div class="popover menu" id="user-pop" hidden style="width:260px">
            <div class="row" style="padding:8px 10px">${avatar(displayName(me), photo)}<div class="grow"><b class="truncate" style="display:block">${displayName(me)}</b><span class="tiny muted">${me.email}</span></div></div>
            <div class="divider"></div>
            ${me.dj ? html`<a href="/dj/${me.dj.slug}">${icon('external')}Mon profil public</a>` : ''}
            <a href="/app/parametres">${icon('settings')}Paramètres</a>
            <div style="padding:8px 10px">${themeSeg()}</div>
            <div class="divider"></div>
            <button id="logout">${icon('logout')}Se déconnecter</button>
          </div></div>
      </header>
      <main class="view" id="view"></main>
    </div>
  </div>`;
}

function closeMenus() { $$('.popover').forEach(p => p.hidden = true); $('#sidebar')?.classList.remove('open'); $('.scrim')?.remove(); const sr = $('#search-results'); if (sr) sr.hidden = true; }
document.addEventListener('click', e => { if (!e.target.closest('.popover, #notif-btn, #user-btn, .search')) $$('.popover, #search-results').forEach(p => p.hidden = true); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenus(); });

function mountAppShell() {
  $('#open-sidebar').onclick = () => { $('#sidebar').classList.add('open'); const s = document.createElement('div'); s.className = 'scrim'; s.onclick = closeMenus; document.body.appendChild(s); };
  $('#user-btn').onclick = () => { $('#notif-pop').hidden = true; $('#user-pop').hidden = !$('#user-pop').hidden; };
  $('#logout').onclick = async () => { await api.post('/api/auth/logout'); state.me = null; toast('Déconnecté'); navigate('/'); };
  $('#notif-btn').onclick = async () => {
    const pop = $('#notif-pop'); $('#user-pop').hidden = true;
    if (!pop.hidden) { pop.hidden = true; return; }
    const { items } = await api.get('/api/notifications');
    pop.innerHTML = html`<div class="row spread" style="padding:8px 10px"><b>Notifications</b><a href="/app/notifications" class="tiny link">Tout voir</a></div>
      <div class="list" style="max-height:380px;overflow:auto;padding:0 10px">${items.slice(0, 8).map(n => html`<a class="item" href="${n.link || '/app/notifications'}" data-notif="${n.id}">${icon(n.kind === 'booking' ? 'ticket' : n.kind === 'follow' ? 'users' : n.kind === 'comment' ? 'comment' : 'bell')}
        <div class="grow"><div class="item-title small" style="${n.read ? 'font-weight:500' : ''}">${n.title}</div><div class="item-sub clamp-2">${n.body || ''}</div></div><span class="tiny faint nowrap">${fmt.ago(n.created_at)}</span></a>`)}
        ${items.length ? '' : html`<p class="muted small" style="padding:16px 0">Aucune notification.</p>`}</div>`.s;
    pop.hidden = false;
    if (items.some(n => !n.read)) { await api.post('/api/notifications/read'); state.me.unread = 0; $('#notif-btn .badge')?.remove(); }
  };
  // Recherche
  const input = $('#global-search'), box = $('#search-results');
  let timer;
  input.oninput = () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) { box.hidden = true; return; }
    timer = setTimeout(async () => {
      let results;
      if (state.me.roles.includes('admin')) results = (await api.get('/api/admin/search?q=' + encodeURIComponent(q))).results;
      else results = (await api.get('/api/members?q=' + encodeURIComponent(q))).items.slice(0, 8).map(m => ({ type: m.roles.includes('dj') ? 'DJ' : 'Organisateur', label: m.name, sub: [m.city, ...(m.styles || [])].filter(Boolean).join(' · '), link: `/app/membres/${m.id}`, avatar: m.avatar }));
      box.innerHTML = results.length ? results.map(r => html`<a href="${r.link}">${r.avatar !== undefined ? avatar(r.label, r.avatar, 'sm') : html`<span class="chip">${r.type}</span>`}<div class="grow"><div class="truncate" style="font-weight:600">${r.label}</div><div class="tiny muted truncate">${r.sub || ''}</div></div></a>`).join('') : '<p class="muted small" style="padding:12px">Aucun résultat.</p>';
      box.hidden = false;
    }, 200);
  };
  input.onkeydown = e => { if (e.key === 'Enter') { const a = box.querySelector('a'); if (a) { a.click(); input.value = ''; } } };
}

// ───────── Rendu
let currentLayout = null, renderToken = 0;
export async function render({ keepScroll = false } = {}) {
  const token = ++renderToken;
  document.querySelectorAll('dialog.modal[open]').forEach(d => d.close());
  const path = location.pathname;
  let route = ROUTES.find(r => r.re.test(path));
  const params = route ? (path.match(route.re).groups || {}) : {};
  const query = Object.fromEntries(new URLSearchParams(location.search));
  if (route?.layout === 'app' && !state.me) return navigate('/connexion?next=' + encodeURIComponent(path + location.search), { replace: true });
  if (route?.layout === 'auth' && state.me) return navigate(query.next || '/app', { replace: true });
  if (path === '/app') return navigate(state.me.roles.includes('dj') ? '/app/studio' : state.me.roles.includes('organizer') ? '/app/orga' : '/app/admin', { replace: true });

  const layout = route?.layout || 'site';
  const root = $('#root');
  if (layout === 'app') {
    // La barre latérale est reconstruite à chaque page : on conserve sa position de défilement
    const sidebarScroll = $('#sidebar')?.scrollTop || 0;
    root.innerHTML = appShell().s; mountAppShell();
    $('#sidebar').scrollTop = sidebarScroll;
  }
  else if (layout === 'site') { root.innerHTML = siteShell().s; $('#site-menu').onclick = () => $('#site-links').classList.toggle('open'); }
  else root.innerHTML = '<main id="view"></main>';
  currentLayout = layout;
  const view = $('#view');

  if (!route) { view.innerHTML = html`<section class="wrap page-hero"><p class="eyebrow">Erreur 404</p><h1>Page<br>introuvable</h1><p>Cette page n'existe pas ou a été déplacée.</p><div style="margin-top:24px"><a class="btn primary" href="/">Retour à l'accueil</a></div></section>`.s; return; }
  if (route.role && !state.me.roles.includes(route.role)) {
    view.innerHTML = html`<div class="empty" style="padding:80px 20px">${icon('lock')}<h3>Espace réservé</h3><p>Cet espace est réservé aux comptes ${({ dj: 'DJ', organizer: 'organisateur', admin: 'administrateur' })[route.role]}.</p>
      ${route.role !== 'admin' ? html`<a class="btn primary" href="/app/parametres">Activer ce profil dans mes paramètres</a>` : ''}</div>`.s;
    return;
  }
  view.innerHTML = '<div class="skeleton" style="height:240px"></div>';
  try {
    const mod = await import(`/js/views/${route.mod}.js`);
    const res = await mod[route.fn]({ params, query, rerender: () => render({ keepScroll: true }) });
    if (token !== renderToken) return;
    const out = res?.html ?? res;
    view.innerHTML = out?.s ?? String(out ?? '');
    view.classList.add('fade-in');
    if (res?.title) document.title = `${res.title} · AFTR`;
    else document.title = 'AFTR — La plateforme des DJs';
    res?.mount?.(view);
    if (!keepScroll) window.scrollTo(0, 0);
  } catch (e) {
    if (token !== renderToken) return;
    console.error(e);
    view.innerHTML = html`<div class="empty" style="padding:80px 20px">${icon('info')}<h3>Impossible d'afficher cette page</h3><p>${e.message}</p><button class="btn" onclick="location.reload()">Recharger</button></div>`.s;
  }
}

// Rafraîchit les compteurs (notifications, messages) régulièrement
setInterval(async () => {
  if (!state.me || document.hidden) return;
  try {
    const before = state.me;
    await refreshMe();
    if (!state.me) return;
    if (before.unread !== state.me.unread) { const b = $('#notif-btn'); if (b) { b.querySelector('.badge')?.remove(); if (state.me.unread) b.insertAdjacentHTML('beforeend', `<span class="badge">${state.me.unread}</span>`); } }
  } catch { /* hors ligne : on réessaie plus tard */ }
}, 20000);

refreshMe().catch(() => null).finally(() => render());
