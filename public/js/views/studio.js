// DJ Business Studio : tableau de bord, CRM, réservations, calendrier, devis, factures, finances.
import { html, raw, api, state, icon, bg, fmt, avatar, toast, modal, confirmBox, formData, empty, notice, $, $$, on, act, select, chip, BOOKING, DOC_STATUS, today, addDays } from '../core.js';
import { navigate } from '../app.js';
import { bookingRow } from './parts.js';

export const STAGES = [['new', 'Nouveau prospect'], ['to_contact', 'À contacter'], ['contacted', 'Contacté'], ['waiting', 'En attente'], ['follow_up', 'Relance nécessaire'], ['quote_sent', 'Devis envoyé'], ['negotiation', 'En négociation'], ['won', 'Confirmé'], ['lost', 'Perdu']];
const stageLabel = s => STAGES.find(x => x[0] === s)?.[1] || s;
const stageCls = s => ({ won: 'ok', lost: 'off', follow_up: 'bad', quote_sent: 'info', negotiation: 'warn' }[s] || '');

// ───────── Calendrier partagé (DJ et organisateur)
export function calendarGrid(month, entries, base, { blocked = [], clickable = false } = {}) {
  const first = new Date(month + '-01T12:00:00');
  const start = addDays(month + '-01', -((first.getDay() + 6) % 7));
  const prev = new Date(first); prev.setMonth(prev.getMonth() - 1);
  const next = new Date(first); next.setMonth(next.getMonth() + 1);
  const ym = d => d.toISOString().slice(0, 7);
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const blockedSet = new Map(blocked.map(b => [b.date, b.reason]));
  return html`
  <div class="row spread" style="margin-bottom:12px"><div class="row"><a class="btn icon sm" href="${base}?mois=${ym(prev)}" aria-label="Mois précédent">${icon('back')}</a><h2 class="display" style="font-size:34px;min-width:230px;text-align:center;text-transform:capitalize">${first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</h2><a class="btn icon sm" href="${base}?mois=${ym(next)}" aria-label="Mois suivant">${icon('arrow')}</a></div>
    <a class="btn sm" href="${base}">Aujourd'hui</a></div>
  <div class="cal">${['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => html`<div class="dow">${d}</div>`)}
    ${days.map(d => html`<div class="day ${d.slice(0, 7) !== month ? 'out' : ''} ${d === today() ? 'today' : ''} ${blockedSet.has(d) ? 'blocked' : ''}" ${clickable ? raw(`data-day="${d}" role="button" tabindex="0" style="cursor:pointer"`) : ''}>
      <span class="d">${Number(d.slice(8))}</span>
      ${blockedSet.has(d) ? html`<span class="tiny muted">${blockedSet.get(d)}</span>` : ''}
      ${entries.filter(e => e.date === d).map(e => html`<a class="ev ${e.cls || ''}" href="${e.href || '#'}" title="${e.label}">${e.label}</a>`)}
    </div>`)}</div>`;
}

// ───────── Tableau de bord
function monthCard(m) {
  const total = m.real + m.planned, scale = Math.max(m.goal || 0, total, 1);
  const label = new Date(m.label + '-15').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return html`<div class="card" style="margin-bottom:18px;display:grid;grid-template-columns:auto minmax(0,1fr);gap:12px 32px;align-items:center">
    <div><p class="eyebrow">Chiffre d'affaires · ${label}</p><p class="display" style="font-size:52px;margin-top:6px">${fmt.eur(total)}</p></div>
    <div class="stack" style="--gap:10px">
      <div class="goal-meter" role="img" aria-label="Réalisé ${fmt.eur(m.real)}, prévu ${fmt.eur(m.planned)}"><div class="r" style="width:${m.real / scale * 100}%"></div><div class="p" style="left:${m.real / scale * 100}%;width:${m.planned / scale * 100}%"></div>${m.goal ? html`<div class="g" style="left:calc(${Math.min(100, m.goal / scale * 100)}% - 2px)"></div>` : ''}</div>
      <div class="legend"><span><i style="background:var(--accent)"></i>Réalisé <b class="mono">${fmt.eur(m.real)}</b></span><span><i style="background:repeating-linear-gradient(135deg,var(--accent) 0 2px,transparent 2px 4px);border:1px solid var(--accent)"></i>Prévu <b class="mono">${fmt.eur(m.planned)}</b></span>
        ${m.goal ? html`<span>Objectif <b class="mono">${fmt.eur(m.goal)}</b> · ${Math.round(total / m.goal * 100)} %</span>` : ''}<button class="btn ghost sm" id="goal">${m.goal ? 'Modifier l\'objectif' : '+ Objectif mensuel'}</button></div>
    </div></div>`;
}
export async function dashboard({ rerender }) {
  const o = await api.get('/api/studio/overview');
  const dj = state.me.dj;
  const totalPipe = Object.values(o.pipeline).reduce((a, b) => a + b, 0) || 1;
  return { title: 'Business Studio', html: html`
  <div class="space-hero"><div class="ph" ${bg(dj.cover || dj.photo, 1600)}></div><p class="eyebrow">Business Studio</p><h1>Salut ${dj.stage_name}</h1>
    <p>${o.pending.length ? `${o.pending.length} demande${o.pending.length > 1 ? 's' : ''} attend${o.pending.length > 1 ? 'ent' : ''} ta réponse.` : 'Aucune demande en attente.'} ${o.follow_ups.length ? `${o.follow_ups.length} relance${o.follow_ups.length > 1 ? 's' : ''} à faire.` : ''}</p>
    <div class="row" style="margin-top:16px"><a class="btn primary" href="/app/studio/devis/nouveau">${icon('plus')}Nouveau devis</a><a class="btn" style="background:rgba(255,255,255,.1);color:#fff;border-color:rgba(255,255,255,.3)" href="/app/studio/clipper">${icon('scissors')}Set Clipper</a></div></div>
  ${o.reminders.length ? html`<div class="reminders">${o.reminders.map(r => html`<a href="${r.link}" class="${r.hot ? 'hot' : ''}">${icon(r.kind === 'invoice' || r.kind === 'late' ? 'receipt' : r.kind === 'prospect' ? 'contacts' : 'clock')}${r.label}</a>`)}</div>` : ''}
  ${monthCard(o.month)}
  <div class="kpis" style="margin-bottom:22px">
    <div class="kpi accent"><b class="num">${fmt.eur(o.money.paid_month)}</b><span>encaissé ce mois-ci</span></div>
    <div class="kpi"><b class="num">${fmt.eur(o.money.waiting)}</b><span>en attente de paiement${o.money.overdue ? ` · ${o.money.overdue} en retard` : ''}</span></div>
    <div class="kpi"><b class="num">${fmt.eur(o.money.confirmed_value)}</b><span>de bookings confirmés à venir</span></div>
    <div class="kpi"><b class="num">${o.pending.length}</b><span>demande${o.pending.length > 1 ? 's' : ''} à traiter</span></div>
  </div>
  <div class="grid g2" style="margin-bottom:18px">
    <div class="card"><div class="card-h"><h3>Demandes à traiter</h3><a class="tiny link" href="/app/studio/reservations">Toutes</a></div>
      ${o.pending.length ? html`<div class="list">${o.pending.map(r => bookingRow(r, `/app/reservations/${r.id}`, 'dj'))}</div>` : empty('Tout est à jour', 'Les nouvelles demandes de la marketplace arrivent ici.')}</div>
    <div class="card"><div class="card-h"><h3>Prochaines dates</h3><a class="tiny link" href="/app/studio/calendrier">Calendrier</a></div>
      ${o.upcoming.length ? html`<div class="list">${o.upcoming.map(r => r.kind === 'gig' ? gigRow(r) : bookingRow(r, `/app/reservations/${r.id}`, 'dj'))}</div>` : empty('Aucune date confirmée', '')}</div>
  </div>
  <div class="grid g2">
    <div class="card"><div class="card-h"><h3>Tâches & rappels</h3><a class="tiny link" href="/app/studio/crm">CRM</a></div>
      ${o.tasks.length ? html`<div class="list">${o.tasks.map(t => html`<label class="item check"><input type="checkbox" data-task="${t.id}"><div class="grow"><div class="item-title">${t.title}</div><div class="item-sub">${t.contact || 'Personnel'} · ${t.due_date ? fmt.until(t.due_date) : 'sans échéance'}</div></div>${t.due_date && t.due_date < today() ? html`<span class="chip bad">En retard</span>` : ''}</label>`)}</div>` : empty('Aucune tâche', '')}
      ${o.follow_ups.length ? html`<div class="divider" style="margin:12px 0"></div><p class="eyebrow" style="margin-bottom:8px">Relances prévues</p><div class="list">${o.follow_ups.map(c => html`<a class="item" href="/app/studio/crm/${c.id}"><div class="grow"><div class="item-title">${c.name}</div><div class="item-sub">${c.company || ''} · ${stageLabel(c.stage)}</div></div><span class="chip ${c.next_follow_up < today() ? 'bad' : 'warn'}">${fmt.until(c.next_follow_up)}</span></a>`)}</div>` : ''}
    </div>
    <div class="card"><div class="card-h"><h3>Pipeline commercial</h3><a class="tiny link" href="/app/studio/crm">Ouvrir</a></div>
      <div class="stack" style="--gap:10px">${STAGES.map(([k, l]) => html`<div class="hbar"><span class="truncate">${l}</span><div class="track"><div class="fill ${k === 'won' ? 'accent' : ''}" style="width:${o.pipeline[k] / totalPipe * 100}%"></div></div><span class="mono">${o.pipeline[k]}</span></div>`)}</div></div>
  </div>`,
  mount: v => {
    on(v, 'change', '[data-task]', async (e, c) => { await api.patch('/api/studio/tasks/' + c.dataset.task, { done: c.checked }); c.closest('.item').style.opacity = .4; toast('Tâche terminée'); });
    $('#goal', v).onclick = () => modal({ title: 'Objectif mensuel', width: 400, body: html`<form class="stack"><label class="field"><span>Chiffre d'affaires visé par mois (€)</span><input class="input" type="number" min="0" name="monthly_goal" value="${o.month.goal || ''}" required></label><div class="modal-f"><button type="button" class="btn" data-close>Annuler</button><button class="btn primary">Enregistrer</button></div></form>`,
      mount: (d, close) => d.querySelector('form').addEventListener('submit', async e => { e.preventDefault(); await act(e.target.querySelector('.primary'), () => api.put('/api/studio/settings', formData(e.target)), 'Objectif enregistré'); close(); rerender(); }) });
  } };
}

// ───────── CRM
export async function crm({ query, rerender }) {
  const view = query.vue || 'pipeline';
  const { items, tags } = await api.get(`/api/studio/contacts?q=${encodeURIComponent(query.q || '')}&tag=${encodeURIComponent(query.tag || '')}`);
  const totalOpen = items.filter(c => !['won', 'lost'].includes(c.stage)).reduce((s, c) => s + (c.value || 0), 0);
  return { title: 'CRM', html: html`
  <div class="view-h"><div><p class="eyebrow accent">Business Studio · privé</p><h1>CRM & prospects</h1><p>${items.length} contacts · ${fmt.eur(totalOpen)} de potentiel en cours. Ces données ne sont visibles que par toi.</p></div>
    <div class="row"><button class="btn" id="tpl">${icon('message')}Messages types</button><button class="btn primary" id="new-contact">${icon('plus')}Nouveau contact</button></div></div>
  <div class="row spread" style="margin-bottom:16px">
    <div class="seg"><a href="?vue=pipeline" class="${view === 'pipeline' ? 'on' : ''}">Pipeline</a><a href="?vue=liste" class="${view === 'liste' ? 'on' : ''}">Liste</a></div>
    <form class="row" id="crm-filter"><input class="input sm" name="q" value="${query.q || ''}" placeholder="Nom, entreprise, ville…" style="width:220px"><select class="select sm" name="tag" style="width:160px"><option value="">Tous les tags</option>${tags.map(t => html`<option ${query.tag === t ? raw('selected') : ''}>${t}</option>`)}</select><input type="hidden" name="vue" value="${view}"></form>
  </div>
  ${view === 'pipeline' ? html`<div class="kanban" id="kanban">${STAGES.map(([k, l]) => { const col = items.filter(c => c.stage === k); return html`<div class="kcol" data-stage="${k}">
      <div class="kcol-h"><b>${l}</b><span class="mono muted">${col.length}</span></div>
      ${col.map(c => html`<a class="kcard" href="/app/studio/crm/${c.id}" draggable="true" data-id="${c.id}"><b class="truncate">${c.name}</b><span class="small muted truncate">${c.company || ''}${c.city ? ` · ${c.city}` : ''}</span>
        <div class="row spread"><span class="mono">${c.value ? fmt.eur(c.value) : ''}</span>${c.next_follow_up ? html`<span class="chip ${c.next_follow_up < today() ? 'bad' : ''}">${icon('clock')}${fmt.dayMonth(c.next_follow_up)}</span>` : ''}</div></a>`)}
    </div>`; })}</div><p class="tiny muted" style="margin-top:8px">Glisse une carte d'une colonne à l'autre pour changer son étape.</p>`
  : html`<div class="table-wrap"><table class="table"><thead><tr><th>Contact</th><th>Entreprise</th><th>Étape</th><th>Tags</th><th>Valeur</th><th>Relance</th></tr></thead><tbody>
      ${items.map(c => html`<tr data-href="/app/studio/crm/${c.id}"><td><b>${c.name}</b><div class="tiny muted">${c.job || ''}</div></td><td>${c.company || '—'}<div class="tiny muted">${c.city || ''}</div></td><td><span class="chip ${stageCls(c.stage)}">${stageLabel(c.stage)}</span></td><td><div class="tags">${c.tags.map(t => html`<span class="tag">${t}</span>`)}</div></td><td class="num">${c.value ? fmt.eur(c.value) : '—'}</td><td>${c.next_follow_up ? fmt.dayMonth(c.next_follow_up) : '—'}</td></tr>`)}
    </tbody></table></div>`}`,
  mount: v => {
    $('#new-contact', v).onclick = () => contactModal(null, id => navigate('/app/studio/crm/' + id));
    $('#tpl', v).onclick = () => templatesModal(null);
    const f = $('#crm-filter', v);
    f.addEventListener('change', () => navigate('/app/studio/crm?' + new URLSearchParams(formData(f))));
    f.addEventListener('submit', e => { e.preventDefault(); navigate('/app/studio/crm?' + new URLSearchParams(formData(f))); });
    on(v, 'click', 'tr[data-href]', (e, tr) => navigate(tr.dataset.href));
    const k = $('#kanban', v);
    if (k) {
      let dragId = null;
      on(k, 'dragstart', '.kcard', (e, c) => { dragId = c.dataset.id; c.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
      on(k, 'dragend', '.kcard', (e, c) => c.classList.remove('dragging'));
      on(k, 'dragover', '.kcol', (e, col) => { e.preventDefault(); col.classList.add('drop'); });
      on(k, 'dragleave', '.kcol', (e, col) => col.classList.remove('drop'));
      on(k, 'drop', '.kcol', async (e, col) => {
        e.preventDefault(); col.classList.remove('drop');
        if (!dragId) return;
        await api.patch('/api/studio/contacts/' + dragId, { stage: col.dataset.stage });
        toast(`Étape : ${stageLabel(col.dataset.stage)}`); rerender();
      });
    }
  } };
}

function contactModal(c, done) {
  c = c || { tags: [], stage: 'new' };
  return modal({ title: c.id ? 'Modifier le contact' : 'Nouveau contact', width: 620, body: html`<form class="form-grid">
    <label class="field"><span>Nom</span><input class="input" name="name" required value="${c.name || ''}"></label>
    <label class="field"><span>Entreprise / organisation</span><input class="input" name="company" value="${c.company || ''}"></label>
    <label class="field"><span>Fonction</span><input class="input" name="job" value="${c.job || ''}"></label>
    <label class="field"><span>Ville</span><input class="input" name="city" value="${c.city || ''}"></label>
    <label class="field"><span>E-mail</span><input class="input" type="email" name="email" value="${c.email || ''}"></label>
    <label class="field"><span>Téléphone</span><input class="input" name="phone" value="${c.phone || ''}"></label>
    <label class="field"><span>Étape</span>${select('stage', STAGES, c.stage)}</label>
    <label class="field"><span>Valeur estimée (€)</span><input class="input" type="number" name="value" value="${c.value || ''}"></label>
    <label class="field"><span>Tags (séparés par des virgules)</span><input class="input" name="tags" value="${c.tags.join(', ')}"></label>
    <label class="field"><span>Prochaine relance</span><input class="input" type="date" name="next_follow_up" value="${c.next_follow_up || ''}"></label>
    <label class="field full"><span>Notes</span><textarea class="textarea" name="notes">${c.notes || ''}</textarea></label>
    <div class="full modal-f"><button type="button" class="btn" data-close>Annuler</button><button class="btn primary">Enregistrer</button></div></form>`,
  mount: (d, close) => d.querySelector('form').addEventListener('submit', async e => {
    e.preventDefault();
    const body = formData(e.target);
    const r = await act(e.target.querySelector('.primary'), () => c.id ? api.patch('/api/studio/contacts/' + c.id, body) : api.post('/api/studio/contacts', body), 'Contact enregistré');
    close(); done(r.id || c.id);
  }) });
}

export async function crmContact({ params, rerender }) {
  const { contact: c } = await api.get('/api/studio/contacts/' + params.id);
  const ic = { note: 'edit', call: 'message', email: 'mail', meeting: 'users', stage: 'arrow' };
  return { title: c.name, html: html`
  <a href="/app/studio/crm" class="back">${icon('back')}CRM</a>
  <div class="view-h"><div class="row">${avatar(c.name, null, 'lg')}<div><h1 style="font-size:46px">${c.name}</h1><p>${[c.job, c.company, c.city].filter(Boolean).join(' · ')}</p></div></div>
    <div class="row"><select class="select" id="stage" style="width:200px" aria-label="Étape">${STAGES.map(([k, l]) => html`<option value="${k}" ${c.stage === k ? raw('selected') : ''}>${l}</option>`)}</select>
    <button class="btn" id="tpl">${icon('message')}Messages types</button><button class="btn" id="edit">${icon('edit')}Modifier</button><a class="btn primary" href="/app/studio/devis/nouveau?contact=${c.id}">${icon('file')}Créer un devis</a></div></div>
  <div class="split">
    <div class="stack" style="--gap:18px">
      <form class="card stack" id="activity" style="--gap:10px"><h3 style="font-size:16px">Ajouter un échange</h3>
        <div class="choice">${[['note', 'Note'], ['call', 'Appel'], ['email', 'E-mail'], ['meeting', 'Rendez-vous']].map(([k, l], i) => html`<label><input type="radio" name="kind" value="${k}" ${i === 0 ? raw('checked') : ''}><span>${l}</span></label>`)}</div>
        <textarea class="textarea" name="body" required placeholder="Résumé de l'échange, prochaine étape…"></textarea><div><button class="btn primary">Ajouter à l'historique</button></div></form>
      <div class="card"><div class="card-h"><h3>Historique des échanges</h3><span class="tiny muted">${c.activities.length}</span></div>
        <div class="timeline">${c.activities.map(a => html`<div class="t done"><span class="dot"></span><div><div class="row" style="--gap:8px">${icon(ic[a.kind] || 'edit', '')}<b class="small">${{ note: 'Note', call: 'Appel', email: 'E-mail', meeting: 'Rendez-vous', stage: 'Changement d\'étape' }[a.kind]}</b><span class="tiny muted">${fmt.dateShort(a.created_at)}</span></div><p style="margin-top:4px">${a.kind === 'stage' ? 'Étape : ' + stageLabel(a.body.replace('Étape : ', '')) : a.body}</p></div></div>`)}</div></div>
    </div>
    <aside class="stack sticky" style="--gap:16px">
      <div class="card stack" style="--gap:10px">
        ${[['mail', c.email], ['message', c.phone], ['pin', c.city], ['euro', c.value ? `Valeur estimée : ${fmt.eur(c.value)}` : null], ['clock', c.next_follow_up ? `Relance : ${fmt.date(c.next_follow_up)}` : null]].filter(x => x[1]).map(([i, t]) => html`<div class="row small" style="--gap:10px">${icon(i)}<span>${t}</span></div>`)}
        ${c.tags.length ? html`<div class="tags">${c.tags.map(t => html`<span class="tag">${t}</span>`)}</div>` : ''}
        ${c.notes ? html`<div class="panel small">${c.notes}</div>` : ''}
      </div>
      <div class="card"><div class="card-h"><h3>Tâches</h3></div>
        <div class="list">${c.tasks.map(t => html`<label class="item check"><input type="checkbox" data-task="${t.id}" ${t.done ? raw('checked') : ''}><div class="grow" style="${t.done ? 'text-decoration:line-through;opacity:.5' : ''}"><div class="small" style="font-weight:600">${t.title}</div><div class="tiny muted">${t.due_date ? fmt.date(t.due_date) : ''}</div></div></label>`)}</div>
        <form class="row" id="task" style="margin-top:10px"><input class="input sm grow" name="title" placeholder="Nouvelle tâche" required><input class="input sm" type="date" name="due_date" style="width:140px"><button class="btn sm">Ajouter</button></form></div>
      ${c.quotes.length || c.invoices.length ? html`<div class="card"><div class="card-h"><h3>Documents</h3></div><div class="list">
        ${c.quotes.map(q => html`<a class="item" href="/app/studio/devis/${q.id}">${icon('file')}<div class="grow"><b class="small">${q.number}</b><div class="tiny muted truncate">${q.title}</div></div><span class="mono small">${fmt.eur(q.ttc)}</span>${chip(DOC_STATUS, q.status)}</a>`)}
        ${c.invoices.map(q => html`<a class="item" href="/app/studio/factures/${q.id}">${icon('receipt')}<div class="grow"><b class="small">${q.number}</b><div class="tiny muted truncate">${q.title}</div></div><span class="mono small">${fmt.eur(q.ttc)}</span>${chip(DOC_STATUS, q.status)}</a>`)}</div></div>` : ''}
      <button class="btn ghost danger" id="del">${icon('trash')}Supprimer ce contact</button>
    </aside>
  </div>`,
  mount: v => {
    $('#stage', v).onchange = async e => { await api.patch('/api/studio/contacts/' + c.id, { stage: e.target.value }); toast('Étape mise à jour'); rerender(); };
    $('#edit', v).onclick = () => contactModal(c, rerender);
    $('#tpl', v).onclick = () => templatesModal(c);
    $('#activity', v).addEventListener('submit', async e => { e.preventDefault(); await act(e.target.querySelector('button'), () => api.post(`/api/studio/contacts/${c.id}/activities`, formData(e.target)), 'Échange ajouté'); rerender(); });
    $('#task', v).addEventListener('submit', async e => { e.preventDefault(); await act(e.target.querySelector('button'), () => api.post('/api/studio/tasks', { ...formData(e.target), contact_id: c.id }), 'Tâche ajoutée'); rerender(); });
    on(v, 'change', '[data-task]', async (e, cb) => { await api.patch('/api/studio/tasks/' + cb.dataset.task, { done: cb.checked }); rerender(); });
    $('#del', v).onclick = async () => { if (await confirmBox(`Supprimer ${c.name} et tout son historique ?`, { ok: 'Supprimer', danger: true })) { await api.del('/api/studio/contacts/' + c.id); toast('Contact supprimé'); navigate('/app/studio/crm'); } };
  } };
}

// ───────── Réservations : demandes AFTR + dates hors plateforme
const GIG_STATUS = { option: ['Option', 'warn'], confirmed: ['Confirmée', 'ok'], done: ['Effectuée', 'solid'], cancelled: ['Annulée', 'off'] };
export function gigRow(g) {
  const d = new Date(g.date + 'T12:00:00');
  return html`<a class="item" href="/app/studio/reservations?gig=${g.id}">
    <div class="date-block" style="background:var(--surface-2);color:var(--text)"><b>${d.getDate()}</b><span>${d.toLocaleDateString('fr-FR', { month: 'short' })}</span></div>
    <div class="grow"><div class="item-title truncate">${g.title}</div><div class="item-sub truncate">${[g.venue, g.city].filter(Boolean).join(', ') || '—'} · ${g.client_name || 'Hors plateforme'} · ${fmt.until(g.date)}</div></div>
    <span class="mono muted nowrap">${g.fee != null ? fmt.eur(g.fee) : 'à fixer'}</span>${chip(GIG_STATUS, g.status)}</a>`;
}
export async function bookings({ query, rerender }) {
  const [{ items }, { items: gigs }, { items: contacts }] = await Promise.all([api.get('/api/bookings?side=dj'), api.get('/api/studio/gigs'), api.get('/api/studio/contacts')]);
  const tab = query.statut || 'open';
  const filters = { open: ['pending', 'quoted'], confirmed: ['confirmed'], history: ['completed', 'declined', 'cancelled'] };
  const list = items.filter(r => tab === 'all' || filters[tab].includes(r.status));
  const count = k => items.filter(r => filters[k].includes(r.status)).length;
  const t = today();
  const upcoming = gigs.filter(g => g.date >= t && g.status !== 'done').sort((a, b) => a.date.localeCompare(b.date));
  const past = gigs.filter(g => !upcoming.includes(g));
  return { title: 'Réservations', html: html`
  <div class="view-h"><div><p class="eyebrow accent">Business Studio</p><h1>Réservations</h1><p>Les demandes reçues via la marketplace AFTR et les dates de ton réseau personnel, avec leur feuille de route.</p></div><button class="btn primary" id="new-gig">${icon('plus')}Ajouter une date</button></div>
  <h2 class="eyebrow" style="margin-bottom:10px">Demandes via AFTR</h2>
  <div class="seg" style="margin-bottom:12px">${[['open', `À traiter (${count('open')})`], ['confirmed', `Confirmées (${count('confirmed')})`], ['history', 'Historique'], ['all', 'Toutes']].map(([k, l]) => html`<a href="?statut=${k}" class="${tab === k ? 'on' : ''}">${l}</a>`)}</div>
  <div class="card" style="margin-bottom:26px">${list.length ? html`<div class="list">${list.map(r => bookingRow(r, `/app/reservations/${r.id}`, 'dj'))}</div>` : empty('Rien ici pour le moment', '')}</div>
  <div class="grid g2">
    <div class="card"><div class="card-h"><h3>Mes prochaines dates</h3><span class="tiny muted">${upcoming.length}</span></div>${upcoming.length ? html`<div class="list">${upcoming.map(gigRow)}</div>` : empty('Aucune date à venir', '')}</div>
    <div class="card"><div class="card-h"><h3>Dates passées</h3><span class="tiny muted">${past.length}</span></div>${past.length ? html`<div class="list" style="max-height:520px;overflow:auto">${past.map(gigRow)}</div>` : empty('Aucune date passée', '')}</div>
  </div>`,
  mount: v => {
    $('#new-gig', v).onclick = () => gigModal(null, contacts, rerender);
    if (query.gig) { const g = gigs.find(x => String(x.id) === query.gig); if (g) gigModal(g, contacts, () => navigate('/app/studio/reservations', { replace: true })); }
  } };
}
function gigModal(g, contacts, done) {
  g = g || { status: 'confirmed' };
  return modal({ title: g.id ? g.title : 'Nouvelle date', width: 680, body: html`<form class="form-grid">
    <label class="field full"><span>Nom de la soirée</span><input class="input" name="title" required value="${g.title || ''}"></label>
    <label class="field"><span>Organisateur (CRM)</span><select class="select" name="contact_id"><option value="">—</option>${contacts.map(c => html`<option value="${c.id}" ${String(g.contact_id) === String(c.id) ? raw('selected') : ''}>${c.name}</option>`)}</select></label>
    <label class="field"><span>Statut</span>${select('status', Object.entries(GIG_STATUS).map(([k, [l]]) => [k, l]), g.status)}</label>
    <label class="field"><span>Date</span><input class="input" type="date" name="date" required value="${g.date || ''}"></label>
    <label class="field"><span>Cachet (€)</span><input class="input" type="number" min="0" step="1" name="fee" value="${g.fee ?? ''}"></label>
    <label class="field"><span>Début du set</span><input class="input" type="time" name="start_time" value="${g.start_time || ''}"></label>
    <label class="field"><span>Fin du set</span><input class="input" type="time" name="end_time" value="${g.end_time || ''}"></label>
    <p class="full eyebrow" style="margin-top:6px">Feuille de route</p>
    <label class="field"><span>Lieu</span><input class="input" name="venue" value="${g.venue || ''}"></label>
    <label class="field"><span>Ville</span><input class="input" name="city" value="${g.city || ''}"></label>
    <label class="field full"><span>Adresse</span><input class="input" name="address" value="${g.address || ''}"></label>
    <label class="field"><span>Heure d'arrivée</span><input class="input" type="time" name="arrival_time" value="${g.arrival_time || ''}"></label>
    <label class="field"><span>Contact sur place</span><input class="input" name="onsite_contact" value="${g.onsite_contact || ''}"></label>
    <label class="field full"><span>Rider / matériel</span><input class="input" name="rider" value="${g.rider || ''}"></label>
    <label class="field full"><span>Notes (loges, frais, partage de soirée…)</span><textarea class="textarea" name="notes">${g.notes || ''}</textarea></label>
    <div class="full row spread">${g.id ? html`<div class="row">${g.invoice_id ? html`<a class="btn sm" href="/app/studio/factures/${g.invoice_id}">${icon('receipt')}Voir la facture</a>` : g.status !== 'cancelled' ? html`<button type="button" class="btn sm" data-invoice>${icon('receipt')}Créer la facture</button>` : ''}<button type="button" class="btn sm ghost danger" data-del>${icon('trash')}</button></div>` : html`<span></span>`}
      <div class="row"><button type="button" class="btn" data-close>Annuler</button><button class="btn primary">Enregistrer</button></div></div></form>`,
  mount: (d, close) => {
    const f = d.querySelector('form');
    f.addEventListener('submit', async e => { e.preventDefault(); await act(f.querySelector('.primary'), () => g.id ? api.patch('/api/studio/gigs/' + g.id, formData(f)) : api.post('/api/studio/gigs', formData(f)), 'Date enregistrée'); close(); done(); });
    d.querySelector('[data-invoice]')?.addEventListener('click', async e => { const { id } = await act(e.currentTarget, () => api.post(`/api/studio/gigs/${g.id}/invoice`), 'Facture créée en brouillon'); close(); navigate('/app/studio/factures/' + id); });
    d.querySelector('[data-del]')?.addEventListener('click', async () => { if (await confirmBox('Supprimer cette date ?', { ok: 'Supprimer', danger: true })) { await api.del('/api/studio/gigs/' + g.id); close(); done(); } });
  } });
}

// ───────── Calendrier
export async function calendar({ query, rerender }) {
  const month = query.mois || today().slice(0, 7);
  const from = addDays(month + '-01', -7), to = addDays(month + '-01', 45);
  const c = await api.get(`/api/studio/calendar?from=${from}&to=${to}`);
  const entries = [
    ...c.bookings.map(b => ({ date: b.date, label: `${b.start_time || ''} ${b.event_title}`, cls: b.status === 'confirmed' || b.status === 'completed' ? '' : 'pending', href: `/app/reservations/${b.id}` })),
    ...c.gigs.map(g => ({ date: g.date, label: `${g.start_time || ''} ${g.title}`, cls: g.status === 'option' ? 'pending' : g.status === 'cancelled' ? 'task' : 'accent', href: `/app/studio/reservations?gig=${g.id}` })),
    ...c.tasks.map(t => ({ date: t.due_date, label: `☐ ${t.title}`, cls: 'task', href: '/app/studio' })),
  ];
  return { title: 'Calendrier', html: html`
  <div class="view-h"><div><p class="eyebrow accent">Business Studio</p><h1>Calendrier</h1><p>Clique sur un jour pour le bloquer ou le débloquer. Les jours bloqués apparaissent indisponibles sur ton profil et dans la recherche.</p></div>
    <div class="legend"><span><i style="background:var(--text)"></i>Booking AFTR</span><span><i style="background:var(--accent)"></i>Date hors plateforme</span><span><i style="background:var(--warn-soft)"></i>Demande en cours</span><span><i style="background:var(--surface-2);border:1px solid var(--line)"></i>Tâche</span></div></div>
  ${calendarGrid(month, entries, '/app/studio/calendrier', { blocked: c.blocked, clickable: true })}`,
  mount: v => {
    const toggle = async day => {
      if (day.target?.closest?.('a')) return;
      const d = day.dataset.day, isBlocked = c.blocked.some(b => b.date === d);
      if (!isBlocked && c.bookings.some(b => b.date === d && b.status === 'confirmed')) return toast('Un booking est confirmé ce jour-là.', 'error');
      await api.post('/api/studio/blocked', { date: d, reason: 'Indisponible' });
      toast(isBlocked ? `${fmt.date(d)} : disponible` : `${fmt.date(d)} : bloqué`); rerender();
    };
    on(v, 'click', '[data-day]', (e, el) => { if (!e.target.closest('a')) toggle(el); });
    on(v, 'keydown', '[data-day]', (e, el) => { if (e.key === 'Enter') toggle(el); });
  } };
}

// ───────── Devis & factures
function docList(kind, items) {
  const isQ = kind === 'quotes';
  const base = isQ ? '/app/studio/devis' : '/app/studio/factures';
  return items.length ? html`<div class="table-wrap"><table class="table"><thead><tr><th>Numéro</th><th>Client</th><th>Objet</th><th>${isQ ? 'Créé le' : 'Échéance'}</th><th style="text-align:right">Total TTC</th><th>Statut</th></tr></thead><tbody>
    ${items.map(d => html`<tr data-href="${base}/${d.id}"><td class="mono"><b>${d.number}</b></td><td>${d.client_name}</td><td class="truncate" style="max-width:260px">${d.title}</td><td>${fmt.dayMonth(isQ ? d.created_at : d.due_date)}</td><td class="num" style="text-align:right;font-weight:700">${fmt.eur(d.ttc)}</td><td>${chip(DOC_STATUS, d.status)}</td></tr>`)}
  </tbody></table></div>` : empty(isQ ? 'Aucun devis' : 'Aucune facture', '');
}
export async function quotes() {
  const { items } = await api.get('/api/studio/quotes');
  return { title: 'Devis', html: html`
  <div class="view-h"><div><p class="eyebrow accent">Business Studio</p><h1>Devis</h1><p>Les devis envoyés depuis une demande de la marketplace apparaissent aussi ici.</p></div><a class="btn primary" href="/app/studio/devis/nouveau">${icon('plus')}Nouveau devis</a></div>
  <div class="kpis" style="margin-bottom:18px">${['draft', 'sent', 'accepted', 'declined'].map(s => html`<div class="kpi"><b>${items.filter(i => i.status === s).length}</b><span>${DOC_STATUS[s][0].toLowerCase()}${s === 'sent' ? ` · ${fmt.eur(items.filter(i => i.status === s).reduce((a, i) => a + i.ttc, 0))}` : ''}</span></div>`)}</div>
  ${docList('quotes', items)}`, mount: v => on(v, 'click', 'tr[data-href]', (e, tr) => navigate(tr.dataset.href)) };
}
export async function invoices() {
  const { items } = await api.get('/api/studio/invoices');
  return { title: 'Factures', html: html`
  <div class="view-h"><div><p class="eyebrow accent">Business Studio</p><h1>Factures</h1><p>Numérotation continue. Les factures en retard sont détectées automatiquement à l'échéance.</p></div><div class="row"><button class="btn" id="settings">${icon('settings')}Mes informations</button><a class="btn primary" href="/app/studio/factures/nouveau">${icon('plus')}Nouvelle facture</a></div></div>
  <div class="kpis" style="margin-bottom:18px">${['draft', 'sent', 'paid', 'overdue'].map(s => html`<div class="kpi ${s === 'overdue' && items.some(i => i.status === s) ? 'accent' : ''}"><b>${fmt.eur(items.filter(i => i.status === s).reduce((a, i) => a + i.ttc, 0))}</b><span>${DOC_STATUS[s][0].toLowerCase()} (${items.filter(i => i.status === s).length})</span></div>`)}</div>
  ${docList('invoices', items)}`, mount: v => { on(v, 'click', 'tr[data-href]', (e, tr) => navigate(tr.dataset.href)); $('#settings', v).onclick = settingsModal; } };
}
async function settingsModal() {
  const { settings: s } = await api.get('/api/studio/settings');
  return modal({ title: 'Mes informations de facturation', width: 560, body: html`<form class="form-grid">
    <label class="field full"><span>Nom ou raison sociale</span><input class="input" name="legal_name" value="${s.legal_name || ''}"></label>
    <label class="field full"><span>Adresse</span><input class="input" name="address" value="${s.address || ''}"></label>
    <label class="field"><span>SIRET</span><input class="input" name="siret" value="${s.siret || ''}"></label>
    <label class="field"><span>Statut juridique</span>${select('legal_status', [['', '—'], 'micro-entreprise', 'portage salarial', 'intermittence (GUSO)'], s.legal_status)}</label>
    <label class="field"><span>Objectif mensuel (€)</span><input class="input" type="number" min="0" name="monthly_goal" value="${s.monthly_goal || ''}"></label>
    <label class="field"><span>Régime de TVA</span>${select('vat_mode', [['franchise', 'Franchise en base (micro)'], ['vat', 'Assujetti à la TVA']], s.vat_mode)}</label>
    <label class="field full"><span>IBAN (affiché sur les factures)</span><input class="input" name="iban" value="${s.iban || ''}"></label>
    <p class="full tiny muted">Démonstration : n'indique pas de vraies coordonnées bancaires.</p>
    <div class="full modal-f"><button type="button" class="btn" data-close>Annuler</button><button class="btn primary">Enregistrer</button></div></form>`,
  mount: (d, close) => d.querySelector('form').addEventListener('submit', async e => { e.preventDefault(); await act(e.target.querySelector('.primary'), () => api.put('/api/studio/settings', formData(e.target)), 'Informations enregistrées'); close(); }) });
}

const totals = (lines, vat) => { const ht = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unit_price) || 0), 0); return { ht, vat: Math.round(ht * vat) / 100, ttc: ht + Math.round(ht * vat) / 100 }; };

async function docEditor(kind, { params, query, rerender }) {
  const isQ = kind === 'quotes', isNew = params.id === 'nouveau';
  const base = isQ ? '/app/studio/devis' : '/app/studio/factures';
  const [{ items: contacts }, { settings }] = await Promise.all([api.get('/api/studio/contacts'), api.get('/api/studio/settings')]);
  let doc;
  if (isNew) {
    const c = contacts.find(x => x.id === Number(query.contact));
    doc = { client_name: c?.company || c?.name || '', client_email: c?.email || '', contact_id: c?.id || '', title: '', event_date: '', vat_rate: settings.vat_mode === 'vat' ? 20 : 0, lines: [{ label: 'DJ set (3 h)', qty: 1, unit_price: state.me.dj?.price_min || 500 }], status: 'draft', notes: '' };
  } else doc = (await api.get(`/api/studio/${kind}/${params.id}`))[isQ ? 'quote' : 'invoice'];
  const locked = !isQ && doc.status === 'paid';
  const statuses = isQ ? ['draft', 'sent', 'accepted', 'declined'] : ['draft', 'sent', 'paid', 'overdue'];
  const lineRow = (l, i) => html`<div class="line-row" data-line="${i}"><input class="input sm" name="label" value="${l.label}" placeholder="Prestation" required aria-label="Désignation"><input class="input sm" name="qty" type="number" min="0" step="0.5" value="${l.qty}" aria-label="Quantité"><input class="input sm" name="unit_price" type="number" min="0" step="0.01" value="${l.unit_price}" aria-label="Prix unitaire HT"><span class="mono line-total" style="text-align:right">${fmt.eur(l.qty * l.unit_price)}</span><button type="button" class="btn ghost sm icon" data-remove aria-label="Supprimer la ligne">${icon('x')}</button></div>`;
  const preview = d => { const t = totals(d.lines, d.vat_rate); return html`<div class="doc-preview"><div class="doc-h"><b>AFTR</b><div style="text-align:right"><div class="display" style="font-size:24px">${isQ ? 'Devis' : 'Facture'}</div><div class="mono" style="opacity:.7">${doc.number || 'Numéro attribué à l\'enregistrement'}</div></div></div>
    <div class="doc-b"><div class="wm">Document fictif<br>Démonstration</div>
      <div class="grid g2" style="--gap:12px"><div><div class="eyebrow">Émetteur</div><b>${settings.legal_name || state.me.dj.stage_name}</b><div class="tiny">${settings.address || ''}</div></div><div><div class="eyebrow">Client</div><b>${d.client_name || '—'}</b><div class="tiny">${d.client_address || ''} ${d.client_email || ''}</div></div></div>
      <div><b style="font-size:15px">${d.title || 'Objet du document'}</b>${d.event_date ? html`<div class="tiny">Prestation le ${fmt.date(d.event_date)}</div>` : ''}</div>
      <table><thead><tr><th>Désignation</th><th class="r">Qté</th><th class="r">PU HT</th><th class="r">Total HT</th></tr></thead><tbody>${d.lines.map(l => html`<tr><td>${l.label}</td><td class="r">${l.qty}</td><td class="r">${fmt.eur(l.unit_price)}</td><td class="r">${fmt.eur(l.qty * l.unit_price)}</td></tr>`)}
        <tr><td colspan="3" class="r">Total HT</td><td class="r">${fmt.eur(t.ht)}</td></tr><tr><td colspan="3" class="r">TVA ${d.vat_rate ? d.vat_rate + ' %' : ''}</td><td class="r">${d.vat_rate ? fmt.eur(t.vat) : '—'}</td></tr><tr class="total"><td colspan="3" class="r">${isQ ? 'Total TTC' : 'Net à payer'}</td><td class="r">${fmt.eur(t.ttc)}</td></tr></tbody></table>
      ${!Number(d.vat_rate) ? html`<p class="tiny">TVA non applicable, art. 293 B du CGI.</p>` : ''}
    </div></div>`; };

  return { title: isNew ? (isQ ? 'Nouveau devis' : 'Nouvelle facture') : doc.number, html: html`
  <a href="${base}" class="back">${icon('back')}${isQ ? 'Devis' : 'Factures'}</a>
  <div class="view-h"><div><p class="eyebrow accent">${isQ ? 'Devis' : 'Facture'}</p><h1>${isNew ? (isQ ? 'Nouveau devis' : 'Nouvelle facture') : doc.number}</h1>${!isNew ? html`<p>Créé le ${fmt.date(doc.created_at)}${doc.request_id ? html` · lié à <a class="link" href="/app/reservations/${doc.request_id}">une réservation AFTR</a>` : ''}</p>` : ''}</div>
    ${!isNew ? html`<div class="row">
      <label class="row small" style="--gap:6px">Statut <select class="select sm" id="status" style="width:170px">${statuses.map(s => html`<option value="${s}" ${doc.status === s ? raw('selected') : ''}>${DOC_STATUS[s][0]}</option>`)}</select></label>
      <a class="btn" href="/api/studio/${kind}/${doc.id}/pdf" target="_blank" rel="noopener">${icon('download')}PDF</a>
      ${isQ ? (doc.invoice ? html`<a class="btn primary" href="/app/studio/factures/${doc.invoice.id}">${icon('receipt')}Facture ${doc.invoice.number}</a>` : html`<button class="btn primary" id="to-invoice">${icon('receipt')}Convertir en facture</button>`) : ''}
    </div>` : ''}</div>
  ${notice('Document fictif.', 'Les PDF portent un filigrane de démonstration et n\'ont pas de valeur comptable ou légale : ils n\'ont pas fait l\'objet d\'une vérification réglementaire.', 'info')}
  <div class="split-wide" style="margin-top:18px">
    <form class="card stack" id="doc-form" style="--gap:16px">
      <fieldset ${locked ? raw('disabled') : ''} style="border:0;padding:0;margin:0;min-width:0" class="stack">
      <div class="form-grid">
        <label class="field"><span>Contact du CRM</span><select class="select" name="contact_id"><option value="">— Aucun —</option>${contacts.map(c => html`<option value="${c.id}" data-c='${JSON.stringify({ n: c.company || c.name, e: c.email })}' ${String(doc.contact_id) === String(c.id) ? raw('selected') : ''}>${c.name}${c.company ? ` · ${c.company}` : ''}</option>`)}</select></label>
        <label class="field"><span>Client (nom affiché)</span><input class="input" name="client_name" required value="${doc.client_name}"></label>
        <label class="field"><span>E-mail du client</span><input class="input" name="client_email" value="${doc.client_email || ''}"></label>
        <label class="field"><span>Adresse du client</span><input class="input" name="client_address" value="${doc.client_address || ''}"></label>
        <label class="field full"><span>Objet</span><input class="input" name="title" required value="${doc.title}" placeholder="Ex. : DJ set — soirée de lancement"></label>
        <label class="field"><span>Date de la prestation</span><input class="input" type="date" name="event_date" value="${doc.event_date || ''}"></label>
        <label class="field"><span>TVA</span>${select('vat_rate', [['0', 'Non applicable (franchise)'], ['10', '10 %'], ['20', '20 %']], String(doc.vat_rate || 0))}</label>
        ${!isQ ? html`<label class="field"><span>Date d'émission</span><input class="input" type="date" name="issue_date" value="${doc.issue_date || today()}"></label><label class="field"><span>Échéance</span><input class="input" type="date" name="due_date" value="${doc.due_date || addDays(today(), 30)}"></label>`
          : html`<label class="field"><span>Valable jusqu'au</span><input class="input" type="date" name="valid_until" value="${doc.valid_until || addDays(today(), 30)}"></label>`}
      </div>
      <div class="stack" style="--gap:8px"><div class="line-row tiny muted" style="font-weight:600"><span>Prestations</span><span>Qté</span><span>PU HT (€)</span><span class="line-total" style="text-align:right">Total</span><span></span></div>
        <div class="lines-editor" id="lines">${doc.lines.map(lineRow)}</div>
        <button type="button" class="btn sm" id="add-line" style="justify-self:start">${icon('plus')}Ajouter une ligne</button></div>
      <label class="field"><span>Notes (affichées sur le document)</span><textarea class="textarea" name="notes">${doc.notes || ''}</textarea></label>
      </fieldset>
      <div class="row spread">${!isNew && doc.status === 'draft' ? html`<button type="button" class="btn ghost danger" id="del">${icon('trash')}Supprimer</button>` : html`<span></span>`}
        ${locked ? html`<span class="small muted">Facture payée : elle n'est plus modifiable.</span>` : html`<button class="btn primary">${isNew ? 'Créer' : 'Enregistrer'}</button>`}</div>
    </form>
    <div class="sticky" id="preview">${preview(doc)}</div>
  </div>`,
  mount: v => {
    const f = $('#doc-form', v), lines = $('#lines', v);
    const read = () => ({ ...formData(f), lines: $$('[data-line]', lines).map(r => ({ label: r.querySelector('[name=label]').value, qty: Number(r.querySelector('[name=qty]').value), unit_price: Number(r.querySelector('[name=unit_price]').value) })) });
    const refresh = () => { const d = read(); $$('[data-line]', lines).forEach((r, i) => r.querySelector('.line-total').textContent = fmt.eur(d.lines[i].qty * d.lines[i].unit_price)); $('#preview', v).innerHTML = preview({ ...d, vat_rate: Number(d.vat_rate) }).s; };
    f.addEventListener('input', refresh);
    f.contact_id.addEventListener('change', () => { const o = f.contact_id.selectedOptions[0]; if (o.dataset.c) { const c = JSON.parse(o.dataset.c); f.client_name.value = c.n; f.client_email.value = c.e || ''; refresh(); } });
    $('#add-line', v).onclick = () => { lines.insertAdjacentHTML('beforeend', lineRow({ label: '', qty: 1, unit_price: 0 }, lines.children.length).s); lines.lastElementChild.querySelector('input').focus(); refresh(); };
    on(lines, 'click', '[data-remove]', (e, b) => { if (lines.children.length > 1) { b.closest('[data-line]').remove(); refresh(); } });
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const body = read();
      const r = await act(f.querySelector('.primary'), () => isNew ? api.post(`/api/studio/${kind}`, body) : api.patch(`/api/studio/${kind}/${doc.id}`, body), isNew ? 'Document créé' : 'Modifications enregistrées');
      if (isNew) navigate(`${base}/${r.id}`, { replace: true }); else rerender();
    });
    $('#status', v)?.addEventListener('change', async e => { await api.patch(`/api/studio/${kind}/${doc.id}`, { status: e.target.value }); toast(`Statut : ${DOC_STATUS[e.target.value][0]}`); rerender(); });
    $('#to-invoice', v)?.addEventListener('click', async e => { const { id } = await act(e.currentTarget, () => api.post(`/api/studio/quotes/${doc.id}/invoice`), 'Facture créée à partir du devis'); navigate('/app/studio/factures/' + id); });
    $('#del', v)?.addEventListener('click', async () => { if (await confirmBox('Supprimer ce brouillon ?', { ok: 'Supprimer', danger: true })) { await api.del(`/api/studio/${kind}/${doc.id}`); toast('Document supprimé'); navigate(base); } });
  } };
}
export const quoteEdit = ctx => docEditor('quotes', ctx);
export const invoiceEdit = ctx => docEditor('invoices', ctx);

// ───────── Finances
export async function finances() {
  const f = await api.get('/api/studio/finances');
  const max = Math.max(1, ...f.by_month.map(m => m.paid));
  const paid = f.invoices.filter(i => i.status === 'paid');
  return { title: 'Finances', html: html`
  <div class="view-h"><div><p class="eyebrow accent">Business Studio</p><h1>Finances</h1><p>Calculé à partir de tes factures. Les paiements se font hors plateforme : marque une facture comme payée quand tu as reçu le virement.</p></div></div>
  <div class="kpis" style="margin-bottom:20px">
    <div class="kpi accent"><b>${fmt.eur(f.paid_year)}</b><span>chiffre d'affaires encaissé ${f.year}</span></div>
    <div class="kpi"><b>${fmt.eur(f.waiting)}</b><span>en attente de paiement</span></div>
    <div class="kpi"><b>${fmt.eur(f.overdue)}</b><span>en retard</span></div>
    <div class="kpi"><b>${fmt.eur(f.average)}</b><span>revenu moyen par prestation</span></div>
  </div>
  <div class="split-wide">
    <div class="card"><div class="card-h"><h3>Encaissements ${f.year}</h3><span class="tiny muted">par mois de paiement</span></div>
      <div class="bars" style="height:200px;margin-bottom:26px">${f.by_month.map(m => html`<div class="bar" title="${fmt.eur(m.paid)}"><div class="seg-b" style="height:${m.paid / max * 100}%;border-radius:4px 4px 0 0"></div><small>${new Date(m.month + '-15').toLocaleDateString('fr-FR', { month: 'short' })}</small></div>`)}</div></div>
    <div class="card"><div class="card-h"><h3>Revenus par prestation</h3></div>
      ${paid.length ? html`<div class="list">${paid.map(i => html`<a class="item" href="/app/studio/factures/${i.id}"><div class="grow"><div class="item-title truncate">${i.title}</div><div class="item-sub">${i.client_name} · payée le ${fmt.dayMonth(i.paid_at)}</div></div><b class="num">${fmt.eur(i.ttc)}</b></a>`)}</div>` : empty('Aucun paiement reçu', '')}</div>
  </div>
  <h2 class="eyebrow" style="margin:26px 0 12px">Paiements en attente</h2>
  ${docList('invoices', f.invoices.filter(i => ['sent', 'overdue'].includes(i.status)))}`,
  mount: v => on(v, 'click', 'tr[data-href]', (e, tr) => navigate(tr.dataset.href)) };
}

// ───────── Messages types : variables remplies avec le contact et le press kit du DJ
function fillTemplate(body, c) {
  const dj = state.me.dj || {};
  const vars = { prenom: 'l\u2019équipe', orga: c?.name || '[orga]', soiree: c?.name || '[soirée]', dj: dj.stage_name || '', insta: dj.instagram || '[ton Instagram]', presskit: dj.presskit_url || '[lien du press kit]', mix: dj.mix_url || dj.presskit_url || '[lien de ton mix]' };
  return body.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);
}
async function templatesModal(contact) {
  const { items } = await api.get('/api/studio/templates');
  await modal({ title: contact ? `Messages pour ${contact.name}` : 'Messages types', width: 680, body: html`
    <p class="small muted">Variables : <span class="mono">{prenom} {orga} {soiree} {dj} {insta} {presskit} {mix}</span>. ${contact ? 'Elles sont remplies avec ce contact et ton press kit.' : 'Modifie un message puis enregistre-le.'}</p>
    <div class="stack" style="--gap:14px">${items.map(t => contact
      ? html`<div class="panel stack" style="--gap:8px"><b>${t.name}</b><p style="white-space:pre-wrap">${fillTemplate(t.body, contact)}</p><button class="btn sm" data-copy="${t.id}" style="justify-self:start">${icon('file')}Copier le message</button></div>`
      : html`<form class="panel stack" data-tpl="${t.id}" style="--gap:8px"><input class="input sm" name="name" value="${t.name}" required><textarea class="textarea" name="body" rows="4" required>${t.body}</textarea><div class="row"><button class="btn sm primary">Enregistrer</button><button type="button" class="btn sm ghost danger" data-del-tpl="${t.id}">${icon('trash')}</button></div></form>`)}
      ${contact ? '' : html`<form class="panel stack" data-tpl="new" style="--gap:8px"><b class="small">Nouveau message</b><input class="input sm" name="name" placeholder="Nom" required><textarea class="textarea" name="body" rows="3" required></textarea><div><button class="btn sm">Ajouter</button></div></form>`}</div>`,
  mount: (d, close) => {
    on(d, 'click', '[data-copy]', async (e, b) => {
      const t = items.find(x => String(x.id) === b.dataset.copy);
      try { await navigator.clipboard.writeText(fillTemplate(t.body, contact)); toast('Message copié'); } catch { toast('Copie impossible : sélectionne le texte à la main.', 'error'); }
      api.post(`/api/studio/contacts/${contact.id}/activities`, { kind: 'note', body: `Message « ${t.name} » préparé.` });
    });
    on(d, 'submit', '[data-tpl]', async (e, f) => { e.preventDefault(); const body = formData(f);
      await act(f.querySelector('button'), () => f.dataset.tpl === 'new' ? api.post('/api/studio/templates', body) : api.patch('/api/studio/templates/' + f.dataset.tpl, body), 'Message enregistré');
      if (f.dataset.tpl === 'new') { close(); templatesModal(null); } });
    on(d, 'click', '[data-del-tpl]', async (e, b) => { await api.del('/api/studio/templates/' + b.dataset.delTpl); b.closest('form').remove(); toast('Message supprimé'); });
  } });
}
