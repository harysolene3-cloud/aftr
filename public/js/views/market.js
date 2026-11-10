// Marketplace et espace organisateur : recherche, profil, demandes, événements, favoris.
import { html, raw, api, state, icon, bg, fmt, avatar, toast, modal, confirmBox, formData, empty, notice, $, on, act, select, chip, BOOKING, today, addDays, stars } from '../core.js';
import { navigate } from '../app.js';
import { djCard, djProfileBody, bookingRow, bindPresskit } from './parts.js';
import { filters, mountFilters } from './site.js';
import { calendarGrid } from './studio.js';

const EVENT_TYPES = ['Club', 'Bar / Rooftop', 'Soirée privée', 'Mariage', 'Entreprise', 'Festival', 'Soirée étudiante'];
const isOrg = () => state.me.roles.includes('organizer');

export async function search({ query }) {
  const q = new URLSearchParams(Object.entries(query).filter(([, v]) => v)).toString();
  const { items, facets } = await api.get('/api/djs?' + q);
  return { title: 'Trouver un DJ', html: html`
  <div class="space-hero"><div class="ph" ${bg('unsplash:photo-1574155267225-3b5423dd45d9', 1600)}></div><p class="eyebrow">DJ Marketplace</p><h1>Trouver un DJ</h1><p>Filtre par style, ville, type d'événement, budget, expérience et disponibilité à ta date.</p></div>
  ${isOrg() ? '' : html`<div style="margin-bottom:16px">${notice('Mode découverte.', 'Pour envoyer une demande de réservation, active le profil organisateur dans tes paramètres.', 'info')}</div>`}
  ${filters(facets, query)}
  <p class="small muted" style="margin:18px 0">${items.length} DJ${items.length > 1 ? 's' : ''}${query.date ? ` disponible${items.length > 1 ? 's' : ''} le ${fmt.date(query.date)}` : ''}</p>
  ${items.length ? html`<div class="grid auto-fill" style="--min:230px">${items.map(d => djCard(d, `/app/djs/${d.slug}${query.date ? '?date=' + query.date : ''}`))}</div>` : empty('Aucun DJ ne correspond', 'Élargis un filtre ou choisis une autre date.')}`,
  mount: v => mountFilters(v) };
}

export async function djProfile({ params, query, rerender }) {
  const { dj } = await api.get('/api/djs/' + params.slug);
  const own = dj.user_id === state.me.id;
  const actions = html`
    ${own ? html`<a class="btn primary lg" href="/app/parametres">${icon('edit')}Modifier mon profil</a>` : ''}
    ${!own && isOrg() ? html`<button class="btn primary lg" id="book">${icon('ticket')}Demander une réservation</button>` : ''}
    ${!own ? html`<button class="btn lg" id="msg">${icon('message')}Message</button><button class="btn lg" id="follow">${dj.is_following ? 'Abonné ✓' : 'Suivre'}</button>` : ''}
    ${!own && isOrg() ? html`<button class="btn lg icon" id="fav" title="Favori" aria-pressed="${dj.is_favorite}" style="${dj.is_favorite ? 'color:var(--bad)' : ''}">${icon('heart')}</button>` : ''}`;
  return { title: dj.stage_name, html: html`<a href="/app/djs" class="back">${icon('back')}Marketplace</a><div style="margin:0 -28px">${djProfileBody(dj, { actions })}</div>`,
    mount: v => {
      bindPresskit(v, dj);
      $('#book', v)?.addEventListener('click', () => bookingModal(dj, query.date));
      $('#msg', v)?.addEventListener('click', async () => { const { id } = await api.post('/api/conversations', { members: [dj.user_id] }); navigate('/app/messages/' + id); });
      $('#follow', v)?.addEventListener('click', async e => { const { following } = await api.post(`/api/members/${dj.user_id}/follow`); e.currentTarget.textContent = following ? 'Abonné ✓' : 'Suivre'; });
      $('#fav', v)?.addEventListener('click', async e => { const b = e.currentTarget; const { favorite } = await api.post(`/api/favorites/${dj.user_id}`); b.style.color = favorite ? 'var(--bad)' : ''; toast(favorite ? 'Ajouté aux favoris' : 'Retiré des favoris'); });
    } };
}

async function bookingModal(dj, date) {
  const { items: events } = await api.get('/api/events');
  const upcoming = events.filter(e => e.date >= today() && e.status !== 'cancelled');
  await modal({ title: `Réserver ${dj.stage_name}`, width: 640, body: html`<form class="form-grid" id="book-form">
    ${upcoming.length ? html`<label class="field full"><span>Associer à un de mes événements (facultatif)</span><select class="select" name="event_id"><option value="">— Aucun —</option>${upcoming.map(e => html`<option value="${e.id}" data-event='${JSON.stringify(e)}'>${e.title} · ${fmt.dateShort(e.date)}</option>`)}</select></label>` : ''}
    <label class="field full"><span>Nom de l'événement</span><input class="input" name="event_title" required></label>
    <label class="field"><span>Date</span><input class="input" type="date" name="date" min="${today()}" required value="${date || ''}"></label>
    <label class="field"><span>Type d'événement</span>${select('event_type', EVENT_TYPES, dj.event_types[0] || 'Club')}</label>
    <label class="field"><span>Début</span><input class="input" type="time" name="start_time" value="23:00"></label>
    <label class="field"><span>Fin</span><input class="input" type="time" name="end_time" value="03:00"></label>
    <label class="field"><span>Ville</span><input class="input" name="city" required></label>
    <label class="field"><span>Lieu</span><input class="input" name="venue"></label>
    <label class="field full"><span>Budget proposé (€)</span><input class="input" type="number" name="budget" min="0" required value="${dj.price_min || ''}"></label>
    <label class="field full"><span>Message au DJ</span><textarea class="textarea" name="message" placeholder="Public, ambiance, matériel sur place…"></textarea></label>
    <p class="full tiny muted" id="avail-hint"></p>
    <div class="full modal-f"><button type="button" class="btn" data-close>Annuler</button><button class="btn primary">Envoyer la demande</button></div></form>`,
  mount: (d, close) => {
    const f = d.querySelector('form');
    const hint = () => { const day = dj.availability.find(a => a.date === f.date.value); $('#avail-hint', d).textContent = !f.date.value ? '' : day ? (day.busy ? '⚠️ Ce DJ est indiqué indisponible à cette date. Tu peux quand même envoyer la demande.' : '✓ Disponible à cette date d\'après son calendrier.') : ''; };
    f.date.addEventListener('change', hint); hint();
    f.event_id?.addEventListener('change', () => {
      const opt = f.event_id.selectedOptions[0]; if (!opt?.dataset.event) return;
      const e = JSON.parse(opt.dataset.event);
      f.event_title.value = e.title; f.date.value = e.date; f.city.value = e.city || ''; f.venue.value = e.venue || ''; if (e.budget) f.budget.value = e.budget; if (e.event_type) f.event_type.value = e.event_type; if (e.start_time) f.start_time.value = e.start_time; if (e.end_time) f.end_time.value = e.end_time; hint();
    });
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const { id } = await act(f.querySelector('.primary'), () => api.post('/api/bookings', { ...formData(f), dj_id: dj.user_id }), `Demande envoyée à ${dj.stage_name}`);
      close(); navigate('/app/reservations/' + id);
    });
  } });
}

// ───────── Détail d'une réservation (vue DJ ou organisateur)
export async function booking({ params, rerender }) {
  const { booking: b } = await api.get('/api/bookings/' + params.id);
  const isDj = b.viewer === 'dj';
  const steps = ['pending', 'quoted', 'confirmed', 'completed'];
  const reached = b.status === 'declined' || b.status === 'cancelled' ? -1 : steps.indexOf(b.status);
  const other = isDj ? { name: b.organizer.org_name, photo: b.organizer.photo, id: b.organizer_id } : { name: b.dj.stage_name, photo: b.dj.photo, id: b.dj_id };
  let actions = '';
  if (isDj && ['pending', 'quoted'].includes(b.status)) actions = html`<button class="btn primary" data-act="quote">${icon('file')}${b.status === 'quoted' ? 'Modifier le devis' : 'Proposer un devis'}</button><button class="btn danger" data-act="decline">Décliner</button>`;
  if (isDj && b.status === 'confirmed' && b.date <= today()) actions = html`<button class="btn primary" data-act="complete">${icon('check')}Marquer comme réalisée</button>`;
  if (isDj && ['confirmed', 'completed'].includes(b.status)) actions = html`${actions}${b.invoice ? html`<a class="btn" href="/app/studio/factures/${b.invoice.id}">${icon('receipt')}Facture ${b.invoice.number}</a>` : html`<button class="btn" data-act="invoice">${icon('receipt')}Créer la facture</button>`}`;
  if (!isDj && b.status === 'quoted') actions = html`<button class="btn primary" data-act="accept">${icon('check')}Accepter le devis de ${fmt.eur(b.quote_amount)}</button><button class="btn danger" data-act="refuse_quote">Refuser</button>`;
  if (!isDj && ['pending', 'quoted', 'confirmed'].includes(b.status)) actions = html`${actions}<button class="btn ghost danger" data-act="cancel">Annuler la demande</button>`;
  if (!isDj && b.status === 'completed' && !b.review) actions = html`<button class="btn primary" data-act="review">${icon('star')}Laisser un avis</button>`;

  return { title: b.event_title, html: html`
  <a href="${isDj ? '/app/studio/reservations' : '/app/orga/demandes'}" class="back">${icon('back')}Réservations</a>
  <div class="view-h"><div><p class="eyebrow accent">Réservation #${b.id}</p><h1>${b.event_title}</h1><p>${fmt.date(b.date)} · ${b.city}${b.venue ? ` · ${b.venue}` : ''}</p></div>${chip(BOOKING, b.status)}</div>
  <div class="split">
    <div class="stack" style="--gap:18px">
      <div class="card">
        <div class="row" style="justify-content:space-between;gap:0">${steps.map((s, i) => html`<div class="stack" style="--gap:6px;flex:1;text-align:center;justify-items:center"><span class="av sm" style="${i <= reached ? 'background:var(--accent);color:var(--accent-ink);border-color:var(--accent)' : ''}">${i <= reached ? icon('check') : i + 1}</span><span class="tiny ${i <= reached ? '' : 'muted'}">${BOOKING[s][0]}</span></div>`)}</div>
        ${reached < 0 ? html`<div style="margin-top:14px">${notice(b.status === 'declined' ? 'Demande refusée.' : 'Demande annulée.', b.history.at(-1)?.note || '', 'info')}</div>` : ''}
      </div>
      ${actions ? html`<div class="card row">${actions}</div>` : ''}
      ${!b.dj_available && ['pending', 'quoted'].includes(b.status) ? notice('Attention :', 'la date est déjà occupée dans le calendrier du DJ.', 'info', 'accent') : ''}
      <div class="card stack" style="--gap:14px">
        <h3 style="font-size:16px">Détails</h3>
        <div class="grid g2" style="--gap:12px">
          ${[['Date', fmt.date(b.date)], ['Horaires', `${b.start_time || '—'} → ${b.end_time || '—'}`], ['Type', b.event_type || '—'], ['Lieu', `${b.venue || '—'}, ${b.city}`], ['Budget proposé', fmt.eur(b.budget)], ['Devis du DJ', b.quote_amount ? fmt.eur(b.quote_amount) : 'Pas encore de devis']]
            .map(([k, val]) => html`<div><div class="eyebrow">${k}</div><div style="font-weight:600;margin-top:4px">${val}</div></div>`)}
        </div>
        ${b.message ? html`<div class="panel"><div class="eyebrow" style="margin-bottom:6px">Message de l'organisateur</div><p>${b.message}</p></div>` : ''}
        ${b.quote_message ? html`<div class="panel"><div class="eyebrow" style="margin-bottom:6px">Message du DJ avec le devis</div><p>${b.quote_message}</p></div>` : ''}
        ${b.review ? html`<div class="panel"><div class="eyebrow" style="margin-bottom:6px">Avis</div>${stars(b.review.rating)}<p>${b.review.body || ''}</p></div>` : ''}
      </div>
      ${['quoted', 'confirmed', 'completed'].includes(b.status) ? html`<form class="card stack" id="roadmap" style="--gap:12px"><div class="row spread"><h3 style="font-size:16px">Feuille de route</h3><span class="tiny muted">Partagée entre le DJ et l'organisateur</span></div>
        <div class="form-grid">
          <label class="field full"><span>Adresse exacte</span><input class="input" name="address" value="${b.address || ''}" placeholder="${b.venue || ''}"></label>
          <label class="field"><span>Heure d'arrivée</span><input class="input" type="time" name="arrival_time" value="${b.arrival_time || ''}"></label>
          <label class="field"><span>Contact sur place</span><input class="input" name="onsite_contact" value="${b.onsite_contact || ''}" placeholder="Nom, téléphone"></label>
          <label class="field full"><span>Rider / matériel</span><input class="input" name="rider" value="${b.rider || ''}" placeholder="Ex. : 2 CDJ-3000 + DJM-900"></label>
          <label class="field full"><span>Notes (loges, parking, frais…)</span><textarea class="textarea" name="roadmap_notes">${b.roadmap_notes || ''}</textarea></label>
        </div><div><button class="btn primary">Enregistrer la feuille de route</button></div></form>` : ''}
    </div>
    <aside class="stack sticky" style="--gap:16px">
      <div class="card stack" style="--gap:12px">
        <div class="row">${avatar(other.name, other.photo, 'lg')}<div class="grow"><p class="eyebrow">${isDj ? 'Organisateur' : 'DJ'}</p><b style="font-size:18px">${other.name}</b></div></div>
        <button class="btn" id="msg">${icon('message')}Envoyer un message</button>
        ${!isDj ? html`<a class="btn ghost" href="/app/djs/${b.dj.slug}">Voir le profil</a>` : ''}
        ${isDj && b.quote ? html`<a class="btn ghost" href="/app/studio/devis/${b.quote.id}">${icon('file')}Devis ${b.quote.number} dans le Studio</a>` : ''}
      </div>
      <div class="card"><div class="card-h"><h3>Historique</h3></div><div class="timeline">${b.history.map(h => html`<div class="t done"><span class="dot"></span><div><b class="small">${h.note || BOOKING[h.status]?.[0]}</b><div class="tiny muted">${h.actor || ''} · ${fmt.dateShort(h.created_at)} ${fmt.time(h.created_at)}</div></div></div>`)}</div></div>
    </aside>
  </div>`,
  mount: v => {
    $('#msg', v).onclick = async () => { const { id } = await api.post('/api/conversations', { members: [other.id] }); navigate('/app/messages/' + id); };
    $('#roadmap', v)?.addEventListener('submit', async e => { e.preventDefault(); await act(e.target.querySelector('button'), () => api.patch(`/api/bookings/${b.id}/roadmap`, formData(e.target)), 'Feuille de route enregistrée'); });
    on(v, 'click', '[data-act]', async (e, btn) => {
      const a = btn.dataset.act;
      const send = async (body, msg) => { await act(btn, () => api.post(`/api/bookings/${b.id}/action`, { action: a, ...body }), msg); rerender(); };
      if (a === 'quote') return modal({ title: 'Proposer un devis', width: 520, body: html`<form class="stack" id="q"><label class="field"><span>Montant (€)</span><input class="input" type="number" name="amount" min="1" required value="${b.quote_amount || b.budget || ''}"></label>
          <label class="field"><span>Message</span><textarea class="textarea" name="message" placeholder="Durée du set, matériel, déplacement…">${b.quote_message || ''}</textarea></label>
          <p class="tiny muted">Le devis est aussi créé dans ton Business Studio (Devis).</p><div class="modal-f"><button type="button" class="btn" data-close>Annuler</button><button class="btn primary">Envoyer le devis</button></div></form>`,
        mount: (d, close) => d.querySelector('form').addEventListener('submit', async ev => { ev.preventDefault(); await send(formData(ev.target), 'Devis envoyé à l\'organisateur'); close(); }) });
      if (a === 'review') return modal({ title: 'Laisser un avis', width: 480, body: html`<form class="stack"><div class="choice">${[5, 4, 3, 2, 1].map(n => html`<label><input type="radio" name="rating" value="${n}" ${n === 5 ? raw('checked') : ''}><span>${'★'.repeat(n)}</span></label>`)}</div>
          <textarea class="textarea" name="message" placeholder="Comment s'est passée la soirée ?"></textarea><div class="modal-f"><button type="button" class="btn" data-close>Annuler</button><button class="btn primary">Publier l'avis</button></div></form>`,
        mount: (d, close) => d.querySelector('form').addEventListener('submit', async ev => { ev.preventDefault(); await send(formData(ev.target), 'Avis publié sur le profil du DJ'); close(); }) });
      if (a === 'invoice') { const { id } = await act(btn, () => api.post(`/api/studio/bookings/${b.id}/invoice`), 'Facture créée en brouillon'); return navigate('/app/studio/factures/' + id); }
      const confirmText = { decline: 'Décliner cette demande ?', refuse_quote: 'Refuser ce devis ?', cancel: 'Annuler cette réservation ? Le DJ sera notifié.' }[a];
      if (confirmText && !await confirmBox(confirmText, { ok: 'Confirmer', danger: true })) return;
      send({}, { accept: 'Booking confirmé 🎉', decline: 'Demande déclinée', refuse_quote: 'Devis refusé', cancel: 'Réservation annulée', complete: 'Prestation marquée comme réalisée' }[a]);
    });
  } };
}

// ───────── Espace organisateur
export async function orgDashboard() {
  const o = await api.get('/api/organizer/overview');
  const org = state.me.organizer;
  return { title: 'Espace organisateur', html: html`
  <div class="space-hero"><div class="ph" ${bg(org.photo || 'unsplash:photo-1545128485-c400e7702796', 1600)}></div><p class="eyebrow">Espace organisateur</p><h1>${org.org_name}</h1><p>${org.org_type || 'Organisateur'} · ${state.me.city || ''}</p>
    <div class="row" style="margin-top:16px"><a class="btn primary" href="/app/djs">${icon('search')}Trouver un DJ</a><a class="btn" style="background:rgba(255,255,255,.1);color:#fff;border-color:rgba(255,255,255,.3)" href="/app/orga/evenements">${icon('plus')}Nouvel événement</a></div></div>
  <div class="kpis" style="margin-bottom:22px">
    <div class="kpi ${o.counts.quoted ? 'accent' : ''}"><b>${o.counts.quoted}</b><span>devis à examiner</span></div>
    <div class="kpi"><b>${o.counts.pending}</b><span>demandes en attente de réponse</span></div>
    <div class="kpi"><b>${o.counts.confirmed}</b><span>bookings confirmés</span></div>
    <div class="kpi"><b>${o.counts.favorites}</b><span>DJs en favoris</span></div>
  </div>
  <div class="split-wide">
    <div class="card"><div class="card-h"><h3>Mes réservations</h3><a class="tiny link" href="/app/orga/demandes">Toutes</a></div>
      ${o.requests.length ? html`<div class="list">${o.requests.map(r => bookingRow(r, `/app/reservations/${r.id}`, 'org'))}</div>` : empty('Aucune demande', 'Cherche un DJ pour envoyer ta première demande.', html`<a class="btn primary" href="/app/djs">Trouver un DJ</a>`)}</div>
    <div class="card"><div class="card-h"><h3>Prochains événements</h3><a class="tiny link" href="/app/orga/evenements">Gérer</a></div>
      ${o.events.length ? html`<div class="list">${o.events.map(e => { const d = new Date(e.date + 'T12:00:00'); return html`<div class="item"><div class="date-block"><b>${d.getDate()}</b><span>${d.toLocaleDateString('fr-FR', { month: 'short' })}</span></div><div class="grow"><div class="item-title truncate">${e.title}</div><div class="item-sub">${e.city || ''} · ${e.event_type || ''}</div></div>${e.status === 'dj_found' ? html`<span class="chip ok">DJ trouvé</span>` : html`<a class="btn sm" href="/app/djs?date=${e.date}${e.styles[0] ? '&style=' + encodeURIComponent(e.styles[0]) : ''}">Trouver un DJ</a>`}</div>`; })}</div>` : empty('Aucun événement à venir', '')}</div>
  </div>` };
}

export async function orgRequests({ query }) {
  const { items } = await api.get('/api/bookings?side=organizer');
  const tab = query.statut || 'all';
  const list = items.filter(r => tab === 'all' || (tab === 'open' ? ['pending', 'quoted'].includes(r.status) : tab === 'done' ? ['completed', 'declined', 'cancelled'].includes(r.status) : r.status === tab));
  return { title: 'Réservations', html: html`
  <div class="view-h"><div><p class="eyebrow accent">Espace organisateur</p><h1>Réservations</h1><p>Toutes tes demandes et leur avancement. Les statuts se mettent à jour quand le DJ répond.</p></div><a class="btn primary" href="/app/djs">${icon('plus')}Nouvelle demande</a></div>
  <div class="seg" style="margin-bottom:16px">${[['all', 'Toutes'], ['open', 'En cours'], ['confirmed', 'Confirmées'], ['done', 'Historique']].map(([k, l]) => html`<a href="?statut=${k}" class="${tab === k ? 'on' : ''}">${l}</a>`)}</div>
  <div class="card">${list.length ? html`<div class="list">${list.map(r => bookingRow(r, `/app/reservations/${r.id}`, 'org'))}</div>` : empty('Rien ici', '')}</div>` };
}

export async function orgFavorites() {
  const { items } = await api.get('/api/favorites');
  return { title: 'Favoris', html: html`
  <div class="view-h"><div><p class="eyebrow accent">Espace organisateur</p><h1>Favoris</h1><p>Les DJs que tu as mis de côté.</p></div></div>
  ${items.length ? html`<div class="grid auto-fill" style="--min:230px">${items.map(d => djCard(d, `/app/djs/${d.slug}`))}</div>` : empty('Aucun favori', 'Ajoute des DJs en favoris depuis leur profil (icône cœur).', html`<a class="btn primary" href="/app/djs">Parcourir la marketplace</a>`)}` };
}

export async function orgEvents({ rerender }) {
  const { items } = await api.get('/api/events');
  const upcoming = items.filter(e => e.date >= today()), past = items.filter(e => e.date < today());
  const card = e => html`<div class="card flush" style="display:grid;grid-template-columns:180px 1fr">
    <div class="ph" ${bg(e.photo, 500)} style="min-height:170px"></div>
    <div class="stack" style="padding:18px;--gap:8px;min-width:0">
      <div class="row spread"><span class="mono muted">${fmt.dateShort(e.date)} · ${e.start_time || ''}</span>${e.status === 'dj_found' ? html`<span class="chip ok">DJ trouvé</span>` : e.status === 'cancelled' ? html`<span class="chip off">Annulé</span>` : e.status === 'done' ? html`<span class="chip solid">Terminé</span>` : html`<span class="chip warn">DJ recherché</span>`}</div>
      <h3 style="font-size:20px">${e.title}</h3>
      <p class="small muted">${e.venue || ''}${e.city ? ` · ${e.city}` : ''} · ${e.event_type || ''}${e.capacity ? ` · ${e.capacity} pers.` : ''}${e.budget ? ` · budget ${fmt.eur(e.budget)}` : ''}</p>
      <div class="tags">${e.styles.map(s => html`<span class="tag">${s}</span>`)}</div>
      ${e.requests.length ? html`<div class="row small">${e.requests.map(r => html`<a href="/app/reservations/${r.id}" class="chip">${r.dj?.stage_name} · ${BOOKING[r.status][0]}</a>`)}</div>` : ''}
      <div class="row">${e.date >= today() && e.status === 'planning' ? html`<a class="btn sm primary" href="/app/djs?date=${e.date}${e.styles[0] ? '&style=' + encodeURIComponent(e.styles[0]) : ''}">Trouver un DJ</a>` : ''}<button class="btn sm" data-edit="${e.id}">${icon('edit')}Modifier</button><button class="btn sm ghost danger" data-del="${e.id}">${icon('trash')}</button></div>
    </div></div>`;
  return { title: 'Événements', html: html`
  <div class="view-h"><div><p class="eyebrow accent">Espace organisateur</p><h1>Événements</h1></div><button class="btn primary" id="new-event">${icon('plus')}Nouvel événement</button></div>
  <div class="stack" style="--gap:14px">${upcoming.length ? upcoming.map(card) : empty('Aucun événement à venir', 'Crée ton prochain événement pour y associer des demandes de DJs.')}</div>
  ${past.length ? html`<h2 class="eyebrow" style="margin:28px 0 12px">Passés</h2><div class="stack" style="--gap:14px;opacity:.8">${past.map(card)}</div>` : ''}`,
  mount: v => {
    $('#new-event', v).onclick = () => eventModal(null, rerender);
    on(v, 'click', '[data-edit]', (e, b) => eventModal(items.find(x => x.id === Number(b.dataset.edit)), rerender));
    on(v, 'click', '[data-del]', async (e, b) => { if (await confirmBox('Supprimer cet événement ?', { ok: 'Supprimer', danger: true })) { await api.del('/api/events/' + b.dataset.del); toast('Événement supprimé'); rerender(); } });
  } };
}
const EVENT_PHOTOS = [['unsplash:photo-1545128485-c400e7702796', 'Club'], ['unsplash:photo-1720623784273-f9388b9aa535', 'Rooftop'], ['unsplash:photo-1768054186550-4bdbb8f2640e', 'Fête'], ['unsplash:photo-1533174072545-7a4b6ad7a6c3', 'Festival'], ['unsplash:photo-1777734448523-6b441c719d8d', 'Lumières']];
function eventModal(e, done) {
  e = e || { styles: [], status: 'planning', photo: EVENT_PHOTOS[0][0] };
  return modal({ title: e.id ? 'Modifier l\'événement' : 'Nouvel événement', width: 640, body: html`<form class="form-grid">
    <label class="field full"><span>Titre</span><input class="input" name="title" required value="${e.title || ''}"></label>
    <label class="field"><span>Date</span><input class="input" type="date" name="date" required value="${e.date || ''}"></label>
    <label class="field"><span>Type</span>${select('event_type', EVENT_TYPES, e.event_type || 'Club')}</label>
    <label class="field"><span>Début</span><input class="input" type="time" name="start_time" value="${e.start_time || '22:00'}"></label>
    <label class="field"><span>Fin</span><input class="input" type="time" name="end_time" value="${e.end_time || '04:00'}"></label>
    <label class="field"><span>Ville</span><input class="input" name="city" value="${e.city || state.me.city || ''}"></label>
    <label class="field"><span>Lieu</span><input class="input" name="venue" value="${e.venue || ''}"></label>
    <label class="field"><span>Capacité</span><input class="input" type="number" name="capacity" value="${e.capacity || ''}"></label>
    <label class="field"><span>Budget DJ (€)</span><input class="input" type="number" name="budget" value="${e.budget || ''}"></label>
    <label class="field full"><span>Styles recherchés (séparés par des virgules)</span><input class="input" name="styles" value="${e.styles.join(', ')}"></label>
    <label class="field full"><span>Description</span><textarea class="textarea" name="description">${e.description || ''}</textarea></label>
    <div class="field full"><span class="label">Visuel</span><div class="choice">${EVENT_PHOTOS.map(([p, l]) => html`<label><input type="radio" name="photo" value="${p}" ${e.photo === p ? raw('checked') : ''}><span>${l}</span></label>`)}</div></div>
    ${e.id ? html`<label class="field"><span>Statut</span>${select('status', [['planning', 'DJ recherché'], ['dj_found', 'DJ trouvé'], ['done', 'Terminé'], ['cancelled', 'Annulé']], e.status)}</label>` : ''}
    <div class="full modal-f"><button type="button" class="btn" data-close>Annuler</button><button class="btn primary">Enregistrer</button></div></form>`,
  mount: (d, close) => d.querySelector('form').addEventListener('submit', async ev => {
    ev.preventDefault();
    const body = formData(ev.target);
    await act(ev.target.querySelector('.primary'), () => e.id ? api.patch('/api/events/' + e.id, body) : api.post('/api/events', body), 'Événement enregistré');
    close(); done();
  }) });
}

export async function orgCalendar({ query }) {
  const month = query.mois || today().slice(0, 7);
  const [{ items: events }, { items: reqs }] = await Promise.all([api.get('/api/events'), api.get('/api/bookings?side=organizer')]);
  const entries = [
    ...events.map(e => ({ date: e.date, label: e.title, cls: e.status === 'dj_found' ? 'ok' : 'accent', href: '/app/orga/evenements' })),
    ...reqs.filter(r => ['pending', 'quoted', 'confirmed'].includes(r.status) && !r.event_id).map(r => ({ date: r.date, label: `${r.dj.stage_name} · ${r.event_title}`, cls: r.status === 'confirmed' ? '' : 'pending', href: `/app/reservations/${r.id}` })),
  ];
  return { title: 'Calendrier', html: html`
  <div class="view-h"><div><p class="eyebrow accent">Espace organisateur</p><h1>Calendrier</h1></div><div class="legend"><span><i style="background:var(--accent)"></i>Événement, DJ recherché</span><span><i style="background:var(--ok-soft)"></i>DJ trouvé</span><span><i style="background:var(--warn-soft)"></i>Demande en cours</span></div></div>
  ${calendarGrid(month, entries, '/app/orga/calendrier')}` };
}
