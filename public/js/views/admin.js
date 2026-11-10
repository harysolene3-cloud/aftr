// AFTR Admin : CRM central, utilisateurs, bookings, abonnements, support, modération, analytics, démo.
// Aucun écran ici n'accède aux CRM, devis ou factures personnels des DJs.
import { html, raw, api, state, icon, bg, fmt, avatar, toast, modal, confirmBox, formData, empty, notice, $, $$, on, act, select, chip, BOOKING, today } from '../core.js';
import { navigate } from '../app.js';

export const CRM_STAGES = [['lead', 'Nouveau'], ['contacted', 'Contacté'], ['demo', 'Proposition envoyée'], ['customer', 'Gagné'], ['lost', 'Perdu']];
const NEXT = { lead: 'contacted', contacted: 'demo', demo: 'customer' };
const eur2 = n => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0);
export const SEGMENTS = [['dj', 'DJ'], ['organizer', 'Organisateur'], ['venue', 'Lieu'], ['partner', 'Partenaire'], ['press', 'Presse']];
const stageL = s => CRM_STAGES.find(x => x[0] === s)?.[1] || s;
const segL = s => SEGMENTS.find(x => x[0] === s)?.[1] || s;
const PLAN_L = { dj_free: 'DJ Free', dj_pro: 'DJ Pro', org_free: 'Organisateur Free', org_plus: 'Organisateur Plus' };
const rowLink = v => on(v, 'click', 'tr[data-href]', (e, tr) => navigate(tr.dataset.href));

// ───────── Vue d'ensemble
export async function overview() {
  const o = await api.get('/api/admin/overview');
  return { title: 'Admin', html: html`
  <div class="space-hero"><div class="ph" ${bg('unsplash:photo-1470229722913-7c0e2dbbafd3', 1600)}></div><p class="eyebrow">AFTR Admin · back-office interne</p><h1>Vue d'ensemble</h1><p>Chiffres calculés en direct depuis la base de démonstration.</p></div>
  <div class="kpis" style="margin-bottom:22px">
    <div class="kpi accent"><b>${o.users}</b><span>membres · +${o.new_30} sur 30 j</span></div>
    <div class="kpi"><b>${o.active_30}</b><span>actifs sur 30 jours</span></div>
    <div class="kpi"><b>${o.djs} / ${o.organizers}</b><span>DJs / organisateurs</span></div>
    <div class="kpi"><b>${o.bookings_confirmed}</b><span>bookings confirmés · ${o.requests_open} en cours</span></div>
    <div class="kpi"><b>${fmt.eur(o.gmv)}</b><span>volume réservé · commission théorique ${fmt.eur(o.commission)}</span></div>
    <div class="kpi"><b>${fmt.eur(o.mrr)}</b><span>revenu mensuel des abonnements (paiement non activé)</span></div>
  </div>
  <div class="grid g3">
    <div class="card"><div class="card-h"><h3>Dernières réservations</h3><a class="tiny link" href="/app/admin/bookings">Toutes</a></div>
      <div class="list">${o.latest_requests.map(r => html`<div class="item"><div class="grow"><div class="item-title truncate">${r.event_title}</div><div class="item-sub truncate">${r.stage_name} ← ${r.org_name} · ${fmt.dayMonth(r.date)}</div></div>${chip(BOOKING, r.status)}</div>`)}</div></div>
    <div class="card"><div class="card-h"><h3>Nouveaux membres</h3><a class="tiny link" href="/app/admin/utilisateurs">Tous</a></div>
      <div class="list">${o.latest_users.map(u => html`<div class="item">${avatar(u.dj?.stage_name || u.organizer?.org_name || u.name, u.dj?.photo || u.organizer?.photo, 'sm')}<div class="grow"><div class="item-title truncate">${u.dj?.stage_name || u.organizer?.org_name || u.name}</div><div class="item-sub">${u.roles.join(' · ')} · ${u.source || 'Direct'}</div></div><span class="tiny faint">${fmt.ago(u.created_at)}</span></div>`)}</div></div>
    <div class="card"><div class="card-h"><h3>À traiter</h3></div>
      <div class="list">
        <a class="item" href="/app/admin/support">${icon('help')}<div class="grow item-title">Tickets de support ouverts</div><span class="chip ${o.tickets_open ? 'warn' : ''}">${o.tickets_open}</span></a>
        <a class="item" href="/app/admin/moderation">${icon('shield')}<div class="grow item-title">Signalements à examiner</div><span class="chip ${o.reports_open ? 'bad' : ''}">${o.reports_open}</span></a>
        ${o.tasks.map(t => html`<a class="item" href="${t.contact_id ? '/app/admin/crm/' + t.contact_id : '/app/admin/crm'}">${icon('clock')}<div class="grow"><div class="item-title small">${t.title}</div><div class="item-sub">${t.contact || ''} · ${t.due_date ? fmt.until(t.due_date) : ''}</div></div></a>`)}
      </div></div>
  </div>` };
}

// ───────── CRM central
export async function crm({ query }) {
  const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v)).toString();
  const { items, facets, pipeline, kpis: k, orders } = await api.get('/api/admin/contacts?' + qs);
  const vue = query.vue === 'liste' ? 'liste' : 'pipeline';
  const link = extra => '?' + new URLSearchParams(Object.entries({ ...query, ...extra }).filter(([, x]) => x));
  return { title: 'CRM central', html: html`
  <div class="view-h"><div><p class="eyebrow accent">AFTR Admin</p><h1>CRM central</h1><p>Membres de la plateforme et prospects de l'équipe. Les fiches reflètent l'activité sur AFTR, jamais les données privées du Business Studio des DJs.</p></div>
    <div class="row"><div class="seg"><a href="${link({ vue: 'pipeline' })}" class="${vue === 'pipeline' ? 'on' : ''}">Pipeline</a><a href="${link({ vue: 'liste' })}" class="${vue === 'liste' ? 'on' : ''}">Liste</a></div><a class="btn" href="/api/admin/contacts.csv?${qs}" download>${icon('download')}Exporter CSV</a><button class="btn" id="import">${icon('upload')}Importer CSV</button><button class="btn primary" id="new">${icon('plus')}Nouveau contact</button></div></div>
  <div class="kpis" style="margin-bottom:16px">
    <div class="kpi"><b>${eur2(k.revenue_ht)}</b><span>chiffre d'affaires HT · ${k.orders} commandes (paiement simulé)</span></div>
    <div class="kpi"><b>${k.customers}</b><span>clients payants (étape « Gagné »)</span></div>
    <div class="kpi"><b>${String(k.conversion).replace('.', ',')} %</b><span>taux de conversion : clients / ${k.contacts} contacts</span></div>
    <div class="kpi"><b>${String(k.win_rate).replace('.', ',')} %</b><span>taux de signature : gagnés / (gagnés + perdus)</span></div>
    <div class="kpi"><b>${eur2(k.mrr)}</b><span>revenu mensuel récurrent HT (abonnements actifs)</span></div>
  </div>
  ${orders.length ? html`<div class="card" style="margin-bottom:16px"><div class="card-h"><h3>Dernières commandes du site</h3><a class="tiny link" href="/tarifs">Passer une commande test →</a></div><div class="list">${orders.slice(0, 4).map(o => html`<a class="item" href="/app/admin/crm/${o.contact_id}"><span class="chip ok">${o.ref}</span><div class="grow"><div class="item-title truncate">${o.name}</div><div class="item-sub">${o.offer === 'dj_pro' ? 'DJ Pro' : 'Organisateur Plus'} ${o.period === 'yearly' ? 'annuel' : 'mensuel'} · ${fmt.ago(o.created_at)}</div></div><b class="num">${eur2(o.amount_ht)} HT</b></a>`)}</div></div>` : ''}
  <div class="row" style="margin-bottom:14px;--gap:8px">${CRM_STAGES.map(([k, l]) => html`<a class="chip ${query.stage === k ? 'solid' : ''}" href="${link({ stage: query.stage === k ? '' : k })}">${l} · ${pipeline[k]}</a>`)}</div>
  <form class="card row" id="seg" style="--gap:10px;align-items:end;margin-bottom:16px">
    <label class="field grow" style="min-width:160px"><span>Recherche</span><input class="input sm" name="q" value="${query.q || ''}"></label>
    <label class="field"><span>Segment</span>${select('segment', [['', 'Tous'], ...SEGMENTS], query.segment, 'class="select sm"')}</label>
    <label class="field"><span>Source</span>${select('source', [['', 'Toutes'], ...facets.sources], query.source, 'class="select sm"')}</label>
    <label class="field"><span>Ville</span>${select('city', [['', 'Toutes'], ...facets.cities], query.city, 'class="select sm"')}</label>
    <label class="field"><span>Activité</span>${select('activity', [['', 'Toutes'], ['active', 'Actifs 30 j'], ['inactive', 'Inactifs 30 j']], query.activity, 'class="select sm"')}</label>
    <label class="field"><span>Formule</span>${select('plan', [['', 'Toutes'], ...Object.entries(PLAN_L)], query.plan, 'class="select sm"')}</label>
    <input type="hidden" name="stage" value="${query.stage || ''}">
    <span class="small muted">${items.length} contacts</span>
  </form>
  ${vue === 'pipeline' ? html`<div class="kanban">${CRM_STAGES.filter(([s]) => !query.stage || query.stage === s).map(([s, l]) => { const col = items.filter(c => c.stage === s); return html`<div class="kcol"><div class="kcol-h"><b>${l}</b><span class="tiny muted">${col.length}</span></div>
    ${col.slice(0, 40).map(c => html`<div class="kcard" style="cursor:default"><a href="/app/admin/crm/${c.id}" class="item-title small truncate">${c.name}</a><div class="tiny muted truncate">${segL(c.segment)} · ${c.source || 'source inconnue'}</div>
      ${c.next ? html`<div class="tiny truncate" title="Prochaine action">${icon('clock')} ${c.next.title} · ${fmt.dayMonth(c.next.due_date)}</div>` : ''}
      <div class="row" style="--gap:6px">${NEXT[s] ? html`<button class="btn sm" data-advance="${c.id}" data-to="${NEXT[s]}">→ ${stageL(NEXT[s])}</button>` : ''}${s !== 'lost' && s !== 'customer' ? html`<button class="btn sm ghost" data-advance="${c.id}" data-to="lost" aria-label="Marquer perdu">Perdu</button>` : ''}</div></div>`)}
    ${col.length > 40 ? html`<a class="tiny link" href="${link({ vue: 'liste', stage: s })}">+ ${col.length - 40} autres dans la liste</a>` : ''}</div>`; })}</div>` : html`
  <div class="table-wrap"><table class="table"><thead><tr><th>Contact</th><th>Segment</th><th>Étape</th><th>Source</th><th>Prochaine action</th><th>Dernière activité</th></tr></thead><tbody>
    ${items.map(c => html`<tr data-href="/app/admin/crm/${c.id}"><td><div class="row nowrap">${avatar(c.name, c.avatar, 'sm')}<div><b>${c.name}</b><div class="tiny muted">${c.email || ''}${c.company ? ` · ${c.company.name}` : ''}</div></div></div></td>
      <td>${segL(c.segment)}${c.user_id ? html` <span class="chip" title="Compte membre">membre</span>` : ''}</td><td><span class="chip ${c.stage === 'customer' ? 'ok' : c.stage === 'lost' ? 'off' : ''}">${stageL(c.stage)}</span></td>
      <td class="small">${c.source || '—'}</td><td class="small">${c.next ? `${c.next.title} · ${fmt.dayMonth(c.next.due_date)}` : '—'}</td><td class="small">${c.last_active_at ? fmt.ago(c.last_active_at) : '—'}</td></tr>`)}
  </tbody></table></div>`}`,
  mount: v => {
    rowLink(v);
    on(v, 'click', '[data-advance]', async (e, b) => { await act(b, () => api.patch('/api/admin/contacts/' + b.dataset.advance, { stage: b.dataset.to }), `Contact passé en « ${stageL(b.dataset.to)} »`); navigate(location.pathname + location.search); });
    const f = $('#seg', v);
    f.addEventListener('change', () => navigate('/app/admin/crm?' + new URLSearchParams(Object.entries({ ...formData(f), vue: query.vue }).filter(([, x]) => x))));
    f.addEventListener('submit', e => { e.preventDefault(); f.dispatchEvent(new Event('change')); });
    $('#new', v).onclick = () => contactModal(null, id => navigate('/app/admin/crm/' + id));
    $('#import', v).onclick = importModal;
  } };
}
async function contactModal(c, done) {
  const { items: companies } = await api.get('/api/admin/companies');
  c = c || { tags: [], stage: 'lead', segment: 'organizer' };
  return modal({ title: c.id ? 'Modifier le contact' : 'Nouveau contact', width: 620, body: html`<form class="form-grid">
    <label class="field"><span>Nom</span><input class="input" name="name" required value="${c.name || ''}"></label>
    <label class="field"><span>E-mail</span><input class="input" type="email" name="email" value="${c.email || ''}"></label>
    <label class="field"><span>Téléphone</span><input class="input" name="phone" value="${c.phone || ''}"></label>
    <label class="field"><span>Ville</span><input class="input" name="city" value="${c.city || ''}"></label>
    <label class="field"><span>Segment</span>${select('segment', SEGMENTS, c.segment)}</label>
    <label class="field"><span>Étape</span>${select('stage', CRM_STAGES, c.stage)}</label>
    <label class="field"><span>Entreprise</span>${select('company_id', [['', '—'], ...companies.map(x => [x.id, x.name])], c.company_id ?? c.company?.id)}</label>
    <label class="field"><span>Source</span><input class="input" name="source" value="${c.source || ''}"></label>
    <label class="field full"><span>Tags (virgules)</span><input class="input" name="tags" value="${c.tags.join(', ')}"></label>
    <label class="field full"><span>Notes</span><textarea class="textarea" name="notes">${c.notes || ''}</textarea></label>
    <div class="full modal-f"><button type="button" class="btn" data-close>Annuler</button><button class="btn primary">Enregistrer</button></div></form>`,
  mount: (d, close) => d.querySelector('form').addEventListener('submit', async e => {
    e.preventDefault(); const body = formData(e.target);
    const r = await act(e.target.querySelector('.primary'), () => c.id ? api.patch('/api/admin/contacts/' + c.id, body) : api.post('/api/admin/contacts', body), 'Contact enregistré');
    close(); done(r.id || c.id);
  }) });
}
function importModal() {
  return modal({ title: 'Importer des contacts (CSV)', body: html`<form class="stack">
    <p class="small muted">Première ligne : en-têtes. Colonnes reconnues : <span class="mono">nom</span> (obligatoire), <span class="mono">email, telephone, ville, segment, source, tags</span>. Séparateur « ; » ou « , ». Les e-mails déjà présents sont ignorés.</p>
    <input type="file" accept=".csv,text/csv" name="file" class="input" required style="padding-top:8px">
    <div class="modal-f"><button type="button" class="btn" data-close>Annuler</button><button class="btn primary">Importer</button></div></form>`,
  mount: (d, close) => d.querySelector('form').addEventListener('submit', async e => {
    e.preventDefault();
    const csv = await e.target.file.files[0].text();
    const r = await act(e.target.querySelector('.primary'), () => api.post('/api/admin/contacts/import', { csv }));
    toast(`${r.created} contact(s) importé(s), ${r.skipped} ignoré(s)`); close(); navigate('/app/admin/crm');
  }) });
}

export async function crmContact({ params, rerender }) {
  const { contact: c } = await api.get('/api/admin/contacts/' + params.id);
  const p = c.platform;
  return { title: c.name, html: html`
  <a href="/app/admin/crm" class="back">${icon('back')}CRM central</a>
  <div class="view-h"><div class="row">${avatar(c.name, c.avatar, 'lg')}<div><h1 style="font-size:46px">${c.name}</h1><p>${segL(c.segment)}${c.company ? ` · ${c.company.name}` : ''} · ${c.city || ''} · source : ${c.source || '—'}</p></div></div>
    <div class="row"><select class="select" id="stage" style="width:190px" aria-label="Étape">${CRM_STAGES.map(([k, l]) => html`<option value="${k}" ${c.stage === k ? raw('selected') : ''}>${l}</option>`)}</select><button class="btn" id="edit">${icon('edit')}Modifier</button>
      ${!c.user_id ? html`<button class="btn ghost danger" id="del">${icon('trash')}</button>` : ''}</div></div>
  <div class="split">
    <div class="stack" style="--gap:18px">
      ${p ? html`<div class="card"><div class="card-h"><h3>Activité sur AFTR</h3><span class="chip">compte membre</span></div>
        <div class="kpis" style="margin-bottom:14px">
          ${p.completeness != null ? html`<div class="kpi"><b>${p.completeness} %</b><span>profil DJ complété</span></div>` : ''}
          <div class="kpi"><b>${p.requests.length}</b><span>demandes de réservation</span></div>
          <div class="kpi"><b>${p.posts}</b><span>publications</span></div>
          <div class="kpi"><b>${p.followers}</b><span>abonnés</span></div>
          ${p.reviews.n ? html`<div class="kpi"><b>★ ${(p.reviews.avg).toFixed(1)}</b><span>${p.reviews.n} avis</span></div>` : ''}
        </div>
        ${p.requests.length ? html`<div class="list">${p.requests.map(r => html`<div class="item"><div class="grow"><div class="item-title truncate">${r.event_title}</div><div class="item-sub">${r.as_dj ? `reçue de ${r.org_name}` : `envoyée à ${r.stage_name}`} · ${fmt.date(r.date)} · ${fmt.eur(r.quote_amount || r.budget)}</div></div>${chip(BOOKING, r.status)}</div>`)}</div>` : html`<p class="small muted">Aucune demande de réservation.</p>`}
        ${p.tickets.length ? html`<div class="divider" style="margin:12px 0"></div><p class="eyebrow" style="margin-bottom:8px">Tickets de support</p>${p.tickets.map(t => html`<a class="row small" href="/app/admin/support/${t.id}" style="padding:4px 0">${icon('help')}${t.subject} <span class="chip">${t.status}</span></a>`)}` : ''}
        <p class="tiny muted" style="margin-top:12px">${icon('lock')} Les prospects, notes, devis et factures du Business Studio de ce membre sont privés et ne sont pas accessibles depuis l'admin.</p>
      </div>` : ''}
      <form class="card stack" id="interaction" style="--gap:10px"><h3 style="font-size:16px">Ajouter une interaction</h3>
        <div class="choice">${[['note', 'Note'], ['call', 'Appel'], ['email', 'E-mail'], ['meeting', 'Rendez-vous']].map(([k, l], i) => html`<label><input type="radio" name="kind" value="${k}" ${i === 0 ? raw('checked') : ''}><span>${l}</span></label>`)}</div>
        <textarea class="textarea" name="body" required></textarea><div><button class="btn primary">Ajouter</button></div></form>
      <div class="card"><div class="card-h"><h3>Historique des interactions avec AFTR</h3></div>
        ${c.interactions.length ? html`<div class="timeline">${c.interactions.map(i => html`<div class="t done"><span class="dot"></span><div><b class="small">${{ note: 'Note', call: 'Appel', email: 'E-mail', meeting: 'Rendez-vous', stage: 'Changement d\'étape' }[i.kind]}</b> <span class="tiny muted">${i.admin || ''} · ${fmt.dateShort(i.created_at)}</span><p>${i.body}</p></div></div>`)}</div>` : html`<p class="small muted">Aucune interaction enregistrée.</p>`}
        ${c.campaigns.length ? html`<div class="divider" style="margin:12px 0"></div><p class="eyebrow" style="margin-bottom:8px">Messages en boîte d'envoi (non envoyés)</p>${c.campaigns.map(m => html`<div class="small" style="padding:3px 0">${icon('mail')} ${m.subject} · ${fmt.dayMonth(m.created_at)}</div>`)}` : ''}</div>
    </div>
    <aside class="stack sticky" style="--gap:16px">
      <div class="card stack" style="--gap:8px">${[['mail', c.email], ['message', c.phone], ['pin', c.city]].filter(x => x[1]).map(([i, t]) => html`<div class="row small">${icon(i)}${t}</div>`)}
        ${c.tags.length ? html`<div class="tags">${c.tags.map(t => html`<span class="tag">${t}</span>`)}</div>` : ''}${c.notes ? html`<div class="panel small">${c.notes}</div>` : ''}
        ${c.user?.plans?.length ? html`<div class="small">Formule : ${c.user.plans.map(x => PLAN_L[x.plan]).join(', ')}</div>` : ''}
        ${c.user?.dj ? html`<a class="btn sm" href="/app/djs/${c.user.dj.slug}">Voir le profil public</a>` : ''}</div>
      <div class="card"><div class="card-h"><h3>Prochaine action & rappels</h3></div>
        <div class="list">${c.tasks.map(t => html`<label class="item check"><input type="checkbox" data-task="${t.id}" ${t.done ? raw('checked') : ''}><div class="grow" style="${t.done ? 'opacity:.5;text-decoration:line-through' : ''}"><div class="small" style="font-weight:600">${t.title}</div><div class="tiny muted">${t.due_date ? fmt.date(t.due_date) : ''}</div></div></label>`)}</div>
        <form class="row" id="task" style="margin-top:10px"><input class="input sm grow" name="title" required placeholder="Nouvelle tâche"><input class="input sm" type="date" name="due_date" style="width:140px"><button class="btn sm">Ajouter</button></form></div>
    </aside>
  </div>`,
  mount: v => {
    $('#stage', v).onchange = async e => { await api.patch('/api/admin/contacts/' + c.id, { stage: e.target.value }); toast('Étape mise à jour'); rerender(); };
    $('#edit', v).onclick = () => contactModal(c, rerender);
    $('#del', v)?.addEventListener('click', async () => { if (await confirmBox('Supprimer ce contact ?', { ok: 'Supprimer', danger: true })) { await api.del('/api/admin/contacts/' + c.id); navigate('/app/admin/crm'); } });
    $('#interaction', v).addEventListener('submit', async e => { e.preventDefault(); await act(e.target.querySelector('button'), () => api.post(`/api/admin/contacts/${c.id}/interactions`, formData(e.target)), 'Interaction ajoutée'); rerender(); });
    $('#task', v).addEventListener('submit', async e => { e.preventDefault(); await act(e.target.querySelector('button'), () => api.post('/api/admin/tasks', { ...formData(e.target), contact_id: c.id }), 'Tâche ajoutée'); rerender(); });
    on(v, 'change', '[data-task]', async (e, cb) => { await api.patch('/api/admin/tasks/' + cb.dataset.task, { done: cb.checked }); rerender(); });
  } };
}

export async function companies({ rerender }) {
  const { items } = await api.get('/api/admin/companies');
  return { title: 'Entreprises', html: html`
  <div class="view-h"><div><p class="eyebrow accent">AFTR Admin</p><h1>Entreprises</h1><p>Clubs, agences, festivals, partenaires et médias suivis par l'équipe.</p></div><button class="btn primary" id="new">${icon('plus')}Nouvelle entreprise</button></div>
  <div class="table-wrap"><table class="table"><thead><tr><th>Nom</th><th>Type</th><th>Ville</th><th>Contacts</th></tr></thead><tbody>
    ${items.map(c => html`<tr data-href="/app/admin/entreprises/${c.id}"><td><b>${c.name}</b></td><td>${c.kind || '—'}</td><td>${c.city || '—'}</td><td class="num">${c.contacts}</td></tr>`)}</tbody></table></div>`,
  mount: v => {
    rowLink(v);
    $('#new', v).onclick = () => modal({ title: 'Nouvelle entreprise', body: html`<form class="form-grid">
      <label class="field full"><span>Nom</span><input class="input" name="name" required></label><label class="field"><span>Type</span><input class="input" name="kind" placeholder="Club, agence…"></label>
      <label class="field"><span>Ville</span><input class="input" name="city"></label><label class="field full"><span>Site web</span><input class="input" name="website"></label>
      <label class="field full"><span>Notes</span><textarea class="textarea" name="notes"></textarea></label>
      <div class="full modal-f"><button type="button" class="btn" data-close>Annuler</button><button class="btn primary">Enregistrer</button></div></form>`,
      mount: (d, close) => d.querySelector('form').addEventListener('submit', async e => { e.preventDefault(); await act(e.target.querySelector('.primary'), () => api.post('/api/admin/companies', formData(e.target)), 'Entreprise ajoutée'); close(); rerender(); }) });
  } };
}
export async function company({ params }) {
  const { company: c } = await api.get('/api/admin/companies/' + params.id);
  return { title: c.name, html: html`<a href="/app/admin/entreprises" class="back">${icon('back')}Entreprises</a>
  <div class="view-h"><div><h1>${c.name}</h1><p>${[c.kind, c.city, c.website].filter(Boolean).join(' · ')}</p></div></div>
  ${c.notes ? html`<div class="card" style="margin-bottom:16px">${c.notes}</div>` : ''}
  <div class="card"><div class="card-h"><h3>Contacts</h3></div>${c.contacts.length ? html`<div class="list">${c.contacts.map(x => html`<a class="item" href="/app/admin/crm/${x.id}">${avatar(x.name, x.avatar, 'sm')}<div class="grow"><div class="item-title">${x.name}</div><div class="item-sub">${x.email || ''}</div></div><span class="chip">${stageL(x.stage)}</span></a>`)}</div>` : empty('Aucun contact rattaché', '')}</div>` };
}

// ───────── Utilisateurs
export async function users({ query, rerender }) {
  const { items } = await api.get(`/api/admin/users?role=${query.role || ''}&q=${encodeURIComponent(query.q || '')}`);
  return { title: 'Utilisateurs', html: html`
  <div class="view-h"><div><p class="eyebrow accent">AFTR Admin</p><h1>Utilisateurs</h1><p>${items.length} comptes. Gestion des rôles et suspension.</p></div>
    <form id="uf" class="row"><input class="input sm" name="q" value="${query.q || ''}" placeholder="Nom, e-mail…">${select('role', [['', 'Tous les rôles'], ['dj', 'DJ'], ['organizer', 'Organisateur'], ['admin', 'Admin']], query.role, 'class="select sm"')}</form></div>
  <div class="table-wrap"><table class="table"><thead><tr><th>Membre</th><th>Rôles</th><th>Profil</th><th>Source</th><th>Inscription</th><th>Dernière activité</th><th></th></tr></thead><tbody>
    ${items.map(u => html`<tr style="${u.suspended ? 'opacity:.5' : ''}"><td><div class="row nowrap">${avatar(u.dj?.stage_name || u.name, u.dj?.photo || u.organizer?.photo, 'sm')}<div><b>${u.dj?.stage_name || u.organizer?.org_name || u.name}</b><div class="tiny muted">${u.email}</div></div></div></td>
      <td><div class="tags">${u.roles.map(r => html`<span class="tag">${r}</span>`)}</div></td>
      <td>${u.completeness != null ? html`<div class="progress" style="width:80px" title="${u.completeness} %"><div style="width:${u.completeness}%"></div></div>` : '—'}</td>
      <td class="small">${u.source || '—'}</td><td class="small">${fmt.dayMonth(u.created_at)}</td><td class="small">${u.last_active_at ? fmt.ago(u.last_active_at) : '—'}</td>
      <td><div class="row nowrap"><button class="btn sm" data-roles="${u.id}">Rôles</button><button class="btn sm ${u.suspended ? '' : 'ghost danger'}" data-suspend="${u.id}" data-s="${u.suspended ? 0 : 1}">${u.suspended ? 'Réactiver' : 'Suspendre'}</button></div></td></tr>`)}
  </tbody></table></div>`,
  mount: v => {
    const f = $('#uf', v);
    f.addEventListener('change', () => navigate('/app/admin/utilisateurs?' + new URLSearchParams(formData(f))));
    f.addEventListener('submit', e => { e.preventDefault(); f.dispatchEvent(new Event('change')); });
    on(v, 'click', '[data-suspend]', async (e, b) => {
      const s = b.dataset.s === '1';
      if (s && !await confirmBox('Suspendre ce compte ? Le membre sera déconnecté et ne pourra plus se connecter.', { ok: 'Suspendre', danger: true })) return;
      await act(b, () => api.patch('/api/admin/users/' + b.dataset.suspend, { suspended: s }), s ? 'Compte suspendu' : 'Compte réactivé'); rerender();
    });
    on(v, 'click', '[data-roles]', (e, b) => { const u = items.find(x => x.id === Number(b.dataset.roles));
      modal({ title: 'Rôles du compte', width: 420, body: html`<form class="stack"><div class="choice">${[['dj', 'DJ'], ['organizer', 'Organisateur'], ['admin', 'Administrateur']].map(([k, l]) => html`<label><input type="checkbox" name="roles" value="${k}" ${u.roles.includes(k) ? raw('checked') : ''}><span>${l}</span></label>`)}</div>
        <div class="modal-f"><button type="button" class="btn" data-close>Annuler</button><button class="btn primary">Enregistrer</button></div></form>`,
        mount: (d, close) => d.querySelector('form').addEventListener('submit', async ev => { ev.preventDefault(); await act(ev.target.querySelector('.primary'), () => api.patch('/api/admin/users/' + u.id, formData(ev.target)), 'Rôles mis à jour'); close(); rerender(); }) }); });
  } };
}

// ───────── Bookings & commissions
export async function bookings({ query }) {
  const { items, counts, commission_rate } = await api.get('/api/admin/bookings?status=' + (query.status || ''));
  const won = items.filter(r => ['confirmed', 'completed'].includes(r.status));
  return { title: 'Bookings', html: html`
  <div class="view-h"><div><p class="eyebrow accent">AFTR Admin</p><h1>Bookings & commissions</h1><p>Toutes les réservations passées par la marketplace.</p></div></div>
  ${notice('Paiements hors plateforme.', `Les montants sont ceux des devis acceptés. La commission de ${commission_rate * 100} % est théorique : aucun paiement n'est encaissé par AFTR dans cette version.`, 'plug')}
  <div class="row" style="margin:16px 0;--gap:8px"><a class="chip ${!query.status ? 'solid' : ''}" href="?">Toutes</a>${Object.entries(counts).map(([k, n]) => html`<a class="chip ${query.status === k ? 'solid' : ''}" href="?status=${k}">${BOOKING[k][0]} · ${n}</a>`)}</div>
  <div class="kpis" style="margin-bottom:16px"><div class="kpi"><b>${fmt.eur(won.reduce((s, r) => s + r.amount, 0))}</b><span>volume confirmé (filtre actuel)</span></div><div class="kpi accent"><b>${fmt.eur(won.reduce((s, r) => s + r.commission, 0))}</b><span>commission théorique</span></div></div>
  <div class="table-wrap"><table class="table"><thead><tr><th>#</th><th>Événement</th><th>DJ</th><th>Organisateur</th><th>Date</th><th>Montant</th><th>Commission</th><th>Statut</th></tr></thead><tbody>
    ${items.map(r => html`<tr id="b${r.id}" style="${String(r.id) === query.id ? 'background:var(--accent-soft)' : ''}"><td class="mono">${r.id}</td><td><b>${r.event_title}</b><div class="tiny muted">${r.city}</div></td><td>${r.stage_name}</td><td>${r.org_name}</td><td class="small">${fmt.dayMonth(r.date)}</td><td class="num">${fmt.eur(r.amount)}</td><td class="num">${r.commission ? fmt.eur(r.commission) : '—'}</td><td>${chip(BOOKING, r.status)}</td></tr>`)}
  </tbody></table></div>`, mount: v => query.id && $('#b' + query.id, v)?.scrollIntoView({ block: 'center' }) };
}

// ───────── Abonnements
export async function subscriptions({ rerender }) {
  const s = await api.get('/api/admin/subscriptions');
  return { title: 'Abonnements', html: html`
  <div class="view-h"><div><p class="eyebrow accent">AFTR Admin</p><h1>Abonnements</h1></div></div>
  ${notice('Paiement non activé.', 'Aucun moyen de paiement n\'est connecté : changer une formule ici ne déclenche aucun prélèvement. Le revenu mensuel est calculé sur les formules actives.', 'plug')}
  <div class="kpis" style="margin:16px 0"><div class="kpi accent"><b>${fmt.eur(s.mrr)}</b><span>revenu mensuel théorique</span></div>${Object.entries(s.by_plan).map(([k, n]) => html`<div class="kpi"><b>${n}</b><span>${PLAN_L[k]} · ${fmt.eur(s.plans[k].price)}/mois</span></div>`)}</div>
  <div class="table-wrap"><table class="table"><thead><tr><th>Membre</th><th>Formule</th><th>Statut</th><th>Depuis</th></tr></thead><tbody>
    ${s.items.map(x => html`<tr><td><b>${x.name}</b><div class="tiny muted">${x.email}</div></td>
      <td>${select('plan', Object.entries(PLAN_L), x.plan, `class="select sm" data-sub="${x.id}" style="width:180px"`)}</td>
      <td>${select('status', [['active', 'Actif'], ['trial', 'Essai'], ['cancelled', 'Résilié']], x.status, `class="select sm" data-sub="${x.id}" style="width:120px"`)}</td><td class="small">${fmt.date(x.started_at)}</td></tr>`)}
  </tbody></table></div>`,
  mount: v => on(v, 'change', '[data-sub]', async (e, el) => { await api.patch('/api/admin/subscriptions/' + el.dataset.sub, { [el.name]: el.value }); toast('Abonnement mis à jour'); rerender(); }) };
}

// ───────── Support
export async function support() {
  const { items } = await api.get('/api/admin/tickets');
  const st = { open: ['Ouvert', 'warn'], pending: ['En attente client', 'info'], resolved: ['Résolu', 'ok'] };
  return { title: 'Support', html: html`
  <div class="view-h"><div><p class="eyebrow accent">AFTR Admin</p><h1>Support</h1><p>Tickets créés depuis le formulaire de contact et par les membres.</p></div></div>
  <div class="table-wrap"><table class="table"><thead><tr><th>Sujet</th><th>Demandeur</th><th>Catégorie</th><th>Priorité</th><th>Statut</th><th>Créé</th></tr></thead><tbody>
    ${items.map(t => html`<tr data-href="/app/admin/support/${t.id}"><td><b>${t.subject}</b><div class="tiny muted">${t.messages} message(s)</div></td><td>${t.name || '—'}<div class="tiny muted">${t.email || ''}</div></td><td>${t.category || '—'}</td><td>${{ low: 'Basse', normal: 'Normale', high: 'Haute' }[t.priority]}</td><td>${chip(st, t.status)}</td><td class="small">${fmt.ago(t.created_at)}</td></tr>`)}
  </tbody></table></div>`, mount: rowLink };
}
export async function ticket({ params, rerender }) {
  const { ticket: t } = await api.get('/api/admin/tickets/' + params.id);
  return { title: t.subject, html: html`<a href="/app/admin/support" class="back">${icon('back')}Support</a>
  <div class="view-h"><div><p class="eyebrow accent">Ticket #${t.id} · ${t.category || ''}</p><h1 style="font-size:42px">${t.subject}</h1><p>${t.name || ''} · ${t.email || ''}${t.contact ? html` · <a class="link" href="/app/admin/crm/${t.contact.id}">fiche CRM</a>` : ''}</p></div>
    <div class="row">${select('status', [['open', 'Ouvert'], ['pending', 'En attente client'], ['resolved', 'Résolu']], t.status, 'class="select" id="st" style="width:180px"')}${select('priority', [['low', 'Priorité basse'], ['normal', 'Priorité normale'], ['high', 'Priorité haute']], t.priority, 'class="select" id="pr" style="width:180px"')}</div></div>
  <div class="card stack" style="--gap:12px;max-width:780px">${t.messages.map(m => html`<div class="msg ${m.author === 'aftr' ? 'me' : 'them'}" style="max-width:85%">${m.body}<small>${m.author === 'aftr' ? 'Équipe AFTR' : t.name} · ${fmt.dateShort(m.created_at)} ${fmt.time(m.created_at)}</small></div>`)}
    <form id="reply" class="stack" style="--gap:8px"><textarea class="textarea" name="body" required placeholder="Ta réponse…"></textarea>
      <div class="row spread"><span class="tiny muted">${t.user_id ? 'Le membre recevra une notification dans AFTR.' : 'Aucun e-mail envoyé : la réponse est placée dans la boîte d\'envoi interne (non envoyée).'}</span><button class="btn primary">Répondre</button></div></form></div>`,
  mount: v => {
    $('#reply', v).addEventListener('submit', async e => { e.preventDefault(); await act(e.target.querySelector('button'), () => api.post(`/api/admin/tickets/${t.id}/reply`, formData(e.target)), 'Réponse enregistrée'); rerender(); });
    $('#st', v).onchange = async e => { await api.patch('/api/admin/tickets/' + t.id, { status: e.target.value }); toast('Statut mis à jour'); };
    $('#pr', v).onchange = async e => { await api.patch('/api/admin/tickets/' + t.id, { priority: e.target.value }); toast('Priorité mise à jour'); };
  } };
}

// ───────── Modération
export async function moderation({ rerender }) {
  const { items } = await api.get('/api/admin/reports');
  return { title: 'Modération', html: html`
  <div class="view-h"><div><p class="eyebrow accent">AFTR Admin</p><h1>Modération</h1><p>Publications signalées par la communauté.</p></div></div>
  ${items.length ? html`<div class="stack" style="--gap:12px">${items.map(r => html`<div class="card row" style="align-items:flex-start">
    <div class="grow stack" style="--gap:6px"><div class="row"><span class="chip ${r.status === 'open' ? 'bad' : 'off'}">${r.reason}</span><span class="small muted">signalé par ${r.reporter} · ${fmt.ago(r.created_at)}</span></div>
      <p><b>${r.author}</b> : ${r.post_body || '(sans texte)'}</p>${r.hidden ? html`<span class="tiny muted">Publication retirée</span>` : ''}</div>
    ${r.status === 'open' ? html`<div class="row"><button class="btn sm" data-d="dismissed" data-id="${r.id}">Conserver</button><button class="btn sm primary" data-d="removed" data-id="${r.id}">Retirer la publication</button></div>` : html`<span class="chip">${r.status === 'removed' ? 'Retirée' : 'Conservée'}</span>`}</div>`)}</div>` : empty('Aucun signalement', '')}`,
  mount: v => on(v, 'click', '[data-d]', async (e, b) => { await act(b, () => api.patch('/api/admin/reports/' + b.dataset.id, { decision: b.dataset.d }), b.dataset.d === 'removed' ? 'Publication retirée, auteur notifié' : 'Signalement classé'); rerender(); }) };
}

// ───────── Analytics
export async function analytics() {
  const a = await api.get('/api/admin/analytics');
  const maxW = Math.max(1, ...a.signups_by_week.map(w => w.djs + w.organizers));
  const maxS = Math.max(1, ...a.sources.map(s => s.n));
  const evo = a.totals.new_prev_30 ? Math.round((a.totals.new_30 - a.totals.new_prev_30) / a.totals.new_prev_30 * 100) : null;
  return { title: 'Analytics', html: html`
  <div class="view-h"><div><p class="eyebrow accent">AFTR Admin</p><h1>Analytics</h1><p>Tous les indicateurs sont recalculés depuis la base à chaque affichage : ils évoluent quand les données changent.</p></div></div>
  <div class="kpis" style="margin-bottom:20px">
    <div class="kpi accent"><b>${a.totals.new_30}</b><span>inscriptions sur 30 j${evo != null ? ` · ${evo >= 0 ? '+' : ''}${evo} % vs 30 j précédents` : ''}</span></div>
    <div class="kpi"><b>${a.totals.active_7} / ${a.totals.active_30}</b><span>actifs 7 j / 30 j</span></div>
    <div class="kpi"><b>${a.totals.djs} / ${a.totals.organizers}</b><span>DJs / organisateurs</span></div>
    <div class="kpi"><b>${a.bookings.conversion} %</b><span>conversion demande → booking</span></div>
    <div class="kpi"><b>${a.engagement.per_active_user}</b><span>interactions / actif (30 j)</span></div>
    <div class="kpi"><b>${a.retention.rate} %</b><span>fidélisation : inscrits &gt; 30 j encore actifs</span></div>
  </div>
  <div class="split-wide" style="margin-bottom:18px">
    <div class="card"><div class="card-h"><h3>Inscriptions par semaine</h3><div class="legend"><span><i style="background:var(--text)"></i>DJs</span><span><i style="background:var(--accent)"></i>Organisateurs</span></div></div>
      <div class="bars" style="height:180px;margin-bottom:24px">${a.signups_by_week.map(w => html`<div class="bar" title="${w.djs} DJs, ${w.organizers} organisateurs"><div class="seg-b" style="height:${w.organizers / maxW * 100}%;border-radius:4px 4px 0 0"></div><div class="seg-a" style="height:${w.djs / maxW * 100}%;border-radius:0"></div><small>${fmt.dayMonth(w.week)}</small></div>`)}</div></div>
    <div class="card"><div class="card-h"><h3>Sources d'acquisition</h3></div><div class="stack" style="--gap:10px">${a.sources.map(s => html`<div class="hbar"><span class="truncate">${s.source}</span><div class="track"><div class="fill" style="width:${s.n / maxS * 100}%"></div></div><span class="mono">${s.share} %</span></div>`)}</div></div>
  </div>
  <div class="grid g2" style="margin-bottom:18px">
    <div class="card"><div class="card-h"><h3>Bookings</h3><span class="tiny muted">${a.bookings.requests} demandes · réponse ${a.bookings.response_rate} %</span></div>
      <div class="stack" style="--gap:10px">${Object.entries(a.bookings.by_status).map(([k, n]) => html`<div class="hbar"><span>${BOOKING[k][0]}</span><div class="track"><div class="fill ${k === 'confirmed' || k === 'completed' ? 'accent' : ''}" style="width:${n / Math.max(1, a.bookings.requests) * 100}%"></div></div><span class="mono">${n}</span></div>`)}</div></div>
    <div class="card"><div class="card-h"><h3>Engagement communauté (30 j)</h3></div>
      <div class="kpis"><div class="kpi"><b>${a.engagement.posts_30}</b><span>publications</span></div><div class="kpi"><b>${a.engagement.comments_30}</b><span>commentaires</span></div><div class="kpi"><b>${a.engagement.reactions_30}</b><span>réactions</span></div></div></div>
  </div>
  <div class="card"><div class="card-h"><h3>Performance des campagnes</h3><a class="tiny link" href="/app/admin/marketing/campagnes">Gérer</a></div>
    <div class="table-wrap" style="border:0"><table class="table"><thead><tr><th>Campagne</th><th>Canal</th><th>Période</th><th>Inscriptions attribuées</th><th>Dont organisateurs</th><th>Budget</th><th>Coût / inscription</th></tr></thead><tbody>
      ${a.campaigns.map(c => html`<tr><td><b>${c.name}</b></td><td>${c.channel || '—'}</td><td class="small">${fmt.dayMonth(c.start_date)} → ${fmt.dayMonth(c.end_date)}</td><td class="num">${c.signups}</td><td class="num">${c.organizers}</td><td class="num">${c.budget ? fmt.eur(c.budget) : '—'}</td><td class="num">${c.cost_per_signup ? fmt.eur(c.cost_per_signup) : '—'}</td></tr>`)}
    </tbody></table></div><p class="tiny muted" style="margin-top:8px">Attribution : source déclarée à l'inscription pendant la période de la campagne.</p></div>` };
}

// ───────── Démo
export async function demo() {
  const { items } = await api.get('/api/admin/outbox');
  return { title: 'Démo', html: html`
  <div class="view-h"><div><p class="eyebrow accent">AFTR Admin</p><h1>Démonstration</h1><p>Outils pour préparer la soutenance.</p></div></div>
  <div class="grid g2">
    <div class="card stack" style="--gap:12px"><h3 style="font-size:18px">Réinitialiser les données</h3>
      <p class="muted">Remet la base dans son état initial : profils, réservations, CRM, campagnes. Les dates sont recalculées par rapport à aujourd'hui. Toutes les sessions sont déconnectées.</p>
      <div><button class="btn primary" id="reset">${icon('refresh')}Réinitialiser la démo</button></div></div>
    <div class="card stack" style="--gap:10px"><h3 style="font-size:18px">Comptes de démonstration</h3>
      <div class="list small">${[['anjara@aftr.demo', 'DJ'], ['contrejour@aftr.demo', 'Organisateur'], ['dida@aftr.demo', 'DJ + organisateur'], ['admin@aftr.demo', 'Administrateur']].map(([e, r]) => html`<div class="item"><span class="mono grow">${e}</span><span class="chip">${r}</span></div>`)}</div>
      <p class="tiny muted">Mot de passe commun : <kbd>aftr2026</kbd></p></div>
  </div>
  <div class="card" style="margin-top:18px"><div class="card-h"><h3>Boîte d'envoi interne</h3><span class="chip warn">Non envoyée · aucun service d'emailing connecté</span></div>
    ${items.length ? html`<div class="table-wrap" style="border:0;max-height:420px;overflow:auto"><table class="table"><thead><tr><th>Destinataire</th><th>Objet</th><th>Origine</th><th>Date</th></tr></thead><tbody>${items.map(m => html`<tr><td class="small">${m.to_email}</td><td>${m.subject}</td><td class="small mono">${m.origin}</td><td class="small">${fmt.ago(m.created_at)}</td></tr>`)}</tbody></table></div>` : empty('Boîte vide', '')}</div>`,
  mount: v => $('#reset', v).onclick = async e => {
    if (!await confirmBox('Réinitialiser toutes les données de démonstration ? Les modifications faites pendant la démo seront effacées.', { ok: 'Réinitialiser', danger: true })) return;
    await act(e.target, () => api.post('/api/admin/demo/reset'));
    state.me = null; toast('Démo réinitialisée'); navigate('/connexion');
  } };
}
