// Marketing Hub : stratégie, contenus sociaux, newsletters, calendrier éditorial, campagnes, automatisations.
import { html, raw, api, state, icon, bg, fmt, toast, modal, confirmBox, formData, empty, notice, $, $$, on, act, select, chip, CAL_STATUS, today, addDays } from '../core.js';
import { navigate } from '../app.js';
import { calendarGrid } from './studio.js';

const STATUSES = ['idea', 'draft', 'review', 'approved', 'scheduled', 'published', 'archived'];
const NETWORKS = ['Instagram', 'TikTok', 'LinkedIn', 'Facebook'];
const noAI = notice('IA non configurée.', 'Aucune clé d\'API d\'intelligence artificielle n\'est connectée. Les propositions sont produites par un moteur de règles et de modèles de texte, alimenté par les données réelles d\'AFTR.', 'plug');
const nature = n => html`<span class="nature ${n}">${{ reel: 'Donnée réelle', hypothese: 'Hypothèse', calcul: 'Calcul', methode: 'Méthode' }[n] || n}</span>`;

// ───────── Vue Marketing
export async function hub() {
  const [a, c, n, au] = await Promise.all([api.get('/api/admin/analytics'), api.get('/api/admin/contents'), api.get('/api/admin/newsletters'), api.get('/api/admin/automations')]);
  const upcoming = c.items.filter(x => x.scheduled_date >= today() && !['archived', 'published'].includes(x.status)).sort((x, y) => x.scheduled_date.localeCompare(y.scheduled_date)).slice(0, 5);
  const tools = [['/app/admin/marketing/strategie', 'target', 'Marketing Strategist', 'Un objectif → analyse, cibles, canaux, plan et KPIs.'], ['/app/admin/marketing/social', 'instagram', 'Social Media Studio', 'Idées, accroches, légendes, hashtags pour 4 réseaux.'],
    ['/app/admin/marketing/newsletters', 'mail', 'Newsletter Studio', 'Rédaction, segments, aperçu, boîte d\'envoi.'], ['/app/admin/marketing/calendrier', 'calendar', 'Calendrier éditorial', 'Publications, newsletters, campagnes, événements.'],
    ['/app/admin/marketing/campagnes', 'flame', 'Campagnes', 'Budget, période, inscriptions attribuées.'], ['/app/admin/marketing/automatisations', 'zap', 'Automatisations', 'Bienvenue, relances, avis, réactivation.']];
  return { title: 'Marketing Hub', html: html`
  <div class="space-hero"><div class="ph" ${bg('unsplash:photo-1777734448523-6b441c719d8d', 1600)}></div><p class="eyebrow">Marketing Hub</p><h1>Stratégie & contenus</h1><p>Piloter la croissance d'AFTR à partir des données de la plateforme.</p></div>
  <div class="kpis" style="margin-bottom:20px">
    <div class="kpi accent"><b>${a.totals.new_30}</b><span>inscriptions sur 30 j</span></div>
    <div class="kpi"><b>${a.sources[0]?.source || '—'}</b><span>première source (${a.sources[0]?.share || 0} %)</span></div>
    <div class="kpi"><b>${c.items.filter(x => x.status === 'scheduled').length}</b><span>publications programmées</span></div>
    <div class="kpi"><b>${n.items.filter(x => x.status === 'outbox').length}</b><span>newsletters en boîte d'envoi</span></div>
    <div class="kpi"><b>${au.items.filter(x => x.enabled).length} / ${au.items.length}</b><span>automatisations actives</span></div>
  </div>
  <div class="grid g3" style="margin-bottom:20px">${tools.map(([h, ic, t, p]) => html`<a class="feature" href="${h}"><span class="ico">${icon(ic)}</span><h3>${t}</h3><p>${p}</p></a>`)}</div>
  <div class="card"><div class="card-h"><h3>Prochaines publications</h3><a class="tiny link" href="/app/admin/marketing/calendrier">Calendrier</a></div>
    ${upcoming.length ? html`<div class="list">${upcoming.map(x => html`<div class="item"><span class="chip">${x.network}</span><div class="grow"><div class="item-title truncate">${x.topic || x.idea}</div><div class="item-sub">${fmt.dateShort(x.scheduled_date)}</div></div>${chip(CAL_STATUS, x.status)}</div>`)}</div>` : empty('Rien de programmé', '')}</div>` };
}

// ───────── Marketing Strategist
export async function strategist({ query, rerender }) {
  const { items } = await api.get('/api/admin/strategies');
  const current = items.find(s => String(s.id) === query.id) || items[0];
  const r = current?.result;
  return { title: 'Marketing Strategist', html: html`
  <div class="view-h"><div><p class="eyebrow accent">Marketing Hub</p><h1>Marketing Strategist</h1><p>Renseigne un objectif : l'outil propose une stratégie complète en séparant les données réelles d'AFTR, les calculs et les hypothèses.</p></div></div>
  ${noAI}
  <div class="split" style="margin-top:18px;grid-template-columns:360px minmax(0,1fr)">
    <aside class="stack" style="--gap:16px">
      <form class="card stack" id="strat" style="--gap:12px">
        <label class="field"><span>Objectif marketing</span><textarea class="textarea" name="objective" required style="min-height:70px">Augmenter les inscriptions des organisateurs de 20 % en deux mois</textarea></label>
        <label class="field"><span>Indicateur visé</span>${select('metric', [['organizer_signups', 'Inscriptions d\'organisateurs'], ['dj_signups', 'Inscriptions de DJs'], ['bookings', 'Bookings confirmés'], ['engagement', 'Engagement communauté']], 'organizer_signups')}</label>
        <div class="form-grid"><label class="field"><span>Hausse visée (%)</span><input class="input" type="number" name="target_pct" value="20" min="1" required></label><label class="field"><span>Durée (semaines)</span><input class="input" type="number" name="weeks" value="8" min="2" required></label></div>
        <label class="field"><span>Budget (€, facultatif)</span><input class="input" type="number" name="budget" value="500"></label>
        <button class="btn primary">${icon('target')}Construire la stratégie</button></form>
      ${items.length ? html`<div class="card"><div class="card-h"><h3>Stratégies enregistrées</h3></div><div class="list">${items.map(s => html`<a class="item" href="?id=${s.id}" style="${s.id === current?.id ? 'font-weight:700' : ''}"><div class="grow"><div class="small truncate">${s.objective}</div><div class="tiny muted">${fmt.ago(s.created_at)}</div></div></a>`)}</div></div>` : ''}
    </aside>
    <div class="card">${r ? html`
      <div class="strategy-section"><p class="eyebrow accent">Synthèse</p><h2 style="font-size:24px">${r.summary}</h2><p class="small muted">${current.objective}</p></div>
      <div class="strategy-section"><h3>1. Analyse de la situation</h3><div class="list">${r.situation.facts.map(f => html`<div class="item"><div class="grow small">${f.label}</div><b>${f.value}</b>${nature(f.nature)}</div>`)}</div><ul class="small" style="margin:6px 0 0;padding-left:18px">${r.situation.reading.map(x => html`<li>${x}</li>`)}</ul></div>
      <div class="strategy-section"><h3>2. Objectifs</h3>${r.objectives.map(o => html`<div class="row small">${nature(o.nature)}<span>${o.text}</span></div>`)}</div>
      <div class="strategy-section"><h3>3. Cibles</h3><div class="grid g2" style="--gap:8px">${r.targets.map(t => html`<div class="panel stack" style="--gap:4px"><div class="row spread"><b>${t.name}</b>${nature(t.nature)}</div><span class="small muted">${t.detail}</span></div>`)}</div></div>
      <div class="strategy-section"><h3>4. Segmentation</h3>${r.segmentation.map(s => html`<div class="row small"><b style="min-width:150px">${s.name}</b><span class="grow">${s.detail}</span>${nature(s.nature)}</div>`)}</div>
      <div class="strategy-section"><h3>5. Positionnement</h3><p>${r.positioning}</p></div>
      <div class="strategy-section"><h3>6. Canaux de communication</h3><div class="grid g2" style="--gap:8px">${r.channels.map(c => html`<div class="panel stack" style="--gap:6px"><div class="row spread"><b>${c.name}</b>${c.budget ? html`<span class="mono small">${fmt.eur(c.budget)}</span>` : ''}</div><p class="small">${c.why}</p>${c.measured ? html`<div class="row tiny">${nature('reel')}${c.measured}</div>` : ''}<div class="row tiny">${nature('hypothese')}${c.hypothesis}</div></div>`)}</div></div>
      <div class="strategy-section"><h3>7. Recommandations</h3>${r.recommendations.map(x => html`<div class="row small" style="align-items:flex-start">${nature(x.nature)}<span class="grow">${x.text}</span></div>`)}</div>
      <div class="strategy-section"><h3>8. Plan d'action</h3><div class="grid g3" style="--gap:8px">${r.plan.map(p => html`<div class="panel stack" style="--gap:6px"><span class="eyebrow">${p.weeks}</span><b>${p.title}</b><ul class="small" style="margin:0;padding-left:16px">${p.actions.map(a => html`<li>${a}</li>`)}</ul></div>`)}</div></div>
      <div class="strategy-section"><div class="row spread"><h3>9. Calendrier</h3><button class="btn sm" id="to-cal" data-id="${current.id}">${icon('calendar')}Ajouter au calendrier éditorial</button></div><div class="list">${r.calendar.map(c => html`<div class="item"><span class="mono small" style="min-width:110px">${fmt.dateShort(c.date)}</span><span class="grow small">${c.title}</span></div>`)}</div></div>
      <div class="strategy-section"><h3>10. KPIs</h3><div class="table-wrap"><table class="table"><thead><tr><th>Indicateur</th><th>Point de départ</th><th>Cible</th><th>Nature</th></tr></thead><tbody>${r.kpis.map(k => html`<tr><td>${k.name}</td><td class="num">${k.baseline}</td><td class="num"><b>${k.target}</b></td><td>${nature(k.nature)}</td></tr>`)}</tbody></table></div></div>`
      : empty('Aucune stratégie', 'Renseigne un objectif à gauche.')}</div>
  </div>`,
  mount: v => {
    $('#strat', v).addEventListener('submit', async e => { e.preventDefault(); const { id } = await act(e.target.querySelector('button'), () => api.post('/api/admin/strategist', formData(e.target)), 'Stratégie générée'); navigate('/app/admin/marketing/strategie?id=' + id); });
    $('#to-cal', v)?.addEventListener('click', async e => { const { added } = await act(e.currentTarget, () => api.post(`/api/admin/strategies/${e.currentTarget.dataset.id}/calendar`)); toast(`${added} idée(s) ajoutée(s) au calendrier`); });
  } };
}

// ───────── Social Media Studio
export async function social({ rerender }) {
  const { items } = await api.get('/api/admin/contents');
  return { title: 'Social Media Studio', html: html`
  <div class="view-h"><div><p class="eyebrow accent">Marketing Hub</p><h1>Social Media Studio</h1><p>Génère une proposition, ajuste-la, enregistre-la et programme-la dans le calendrier.</p></div></div>
  ${noAI}
  <div class="split-wide" style="margin-top:18px">
    <div class="stack" style="--gap:16px">
      <form class="card form-grid" id="gen">
        <label class="field"><span>Réseau</span>${select('network', NETWORKS, 'Instagram')}</label>
        <label class="field"><span>Format</span>${select('format', ['Carrousel', 'Reel', 'Vidéo courte', 'Post texte', 'Story', 'Photo'], 'Reel')}</label>
        <label class="field full"><span>Sujet</span><input class="input" name="topic" required value="Les coulisses d'une soirée afro house"></label>
        <label class="field"><span>Cible</span><input class="input" name="target" value="Organisateurs de soirées"></label>
        <label class="field"><span>Objectif</span>${select('objective', ['Notoriété', 'Inscriptions', 'Engagement', 'Réservations'], 'Inscriptions')}</label>
        <label class="field"><span>Ton</span>${select('tone', ['Inspirant', 'Fun', 'Expert', 'Communautaire'], 'Inspirant')}</label>
        <div class="field" style="align-self:end"><button class="btn primary">${icon('sparkle')}Générer une proposition</button></div>
      </form>
      <form class="card stack" id="draft" hidden style="--gap:12px"></form>
    </div>
    <div class="card"><div class="card-h"><h3>Contenus enregistrés</h3><span class="tiny muted">${items.length}</span></div>
      <div class="list">${items.map(c => html`<div class="item"><span class="chip">${c.network}</span><div class="grow"><div class="item-title small truncate">${c.topic || c.idea}</div><div class="item-sub">${c.scheduled_date ? fmt.dateShort(c.scheduled_date) : 'sans date'}</div></div>
        <select class="select sm" data-status="${c.id}" style="width:130px">${STATUSES.map(s => html`<option value="${s}" ${c.status === s ? raw('selected') : ''}>${CAL_STATUS[s][0]}</option>`)}</select>
        <button class="btn sm ghost" data-open="${c.id}" aria-label="Modifier">${icon('edit')}</button><button class="btn sm ghost danger" data-del="${c.id}" aria-label="Supprimer">${icon('trash')}</button></div>`)}</div></div>
  </div>`,
  mount: v => {
    const draft = $('#draft', v);
    const showDraft = c => {
      draft.hidden = false;
      draft.innerHTML = html`<div class="row spread"><h3 style="font-size:16px">${c.id ? 'Modifier le contenu' : 'Proposition'}</h3>${c.method ? html`<span class="tiny muted">${c.method}</span>` : ''}</div>
        <input type="hidden" name="id" value="${c.id || ''}">${['network', 'topic', 'target', 'objective', 'tone', 'format'].map(k => html`<input type="hidden" name="${k}" value="${c[k] || ''}">`)}
        <label class="field"><span>Idée de publication</span><input class="input" name="idea" value="${c.idea || ''}"></label>
        <label class="field"><span>Accroche</span><input class="input" name="hook" value="${c.hook || ''}"></label>
        <label class="field"><span>Légende</span><textarea class="textarea" name="caption" rows="7">${c.caption || ''}</textarea></label>
        <div class="form-grid"><label class="field"><span>Appel à l'action</span><input class="input" name="cta" value="${c.cta || ''}"></label><label class="field"><span>Hashtags</span><input class="input" name="hashtags" value="${c.hashtags || ''}"></label></div>
        <label class="field"><span>Idée de visuel</span><input class="input" name="visual" value="${c.visual || ''}"></label>
        <div class="form-grid"><label class="field"><span>Date de publication${c.recommended_time ? ` (recommandé : ${c.recommended_time})` : ''}</span><input class="input" type="date" name="scheduled_date" value="${c.scheduled_date || ''}"></label>
          <label class="field"><span>Statut</span>${select('status', STATUSES.map(s => [s, CAL_STATUS[s][0]]), c.status || 'draft')}</label></div>
        <div class="row"><button class="btn primary">${icon('check')}Enregistrer${c.id ? '' : ' et ajouter au calendrier'}</button></div>`.s;
      draft.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    $('#gen', v).addEventListener('submit', async e => { e.preventDefault(); const { content } = await act(e.target.querySelector('button'), () => api.post('/api/admin/social/generate', formData(e.target))); showDraft(content); });
    draft.addEventListener('submit', async e => { e.preventDefault(); const d = formData(draft); await act(draft.querySelector('.primary'), () => d.id ? api.patch('/api/admin/contents/' + d.id, d) : api.post('/api/admin/contents', d), 'Contenu enregistré'); rerender(); });
    on(v, 'click', '[data-open]', (e, b) => showDraft(items.find(x => x.id === Number(b.dataset.open))));
    on(v, 'change', '[data-status]', async (e, s) => { await api.patch('/api/admin/contents/' + s.dataset.status, { status: s.value }); toast('Statut mis à jour'); });
    on(v, 'click', '[data-del]', async (e, b) => { if (await confirmBox('Supprimer ce contenu ?', { ok: 'Supprimer', danger: true })) { await api.del('/api/admin/contents/' + b.dataset.del); rerender(); } });
  } };
}

// ───────── Newsletter Studio
export async function newsletters({ query, rerender }) {
  const [{ items }, { items: segments }] = await Promise.all([api.get('/api/admin/newsletters'), api.get('/api/admin/segments')]);
  const cur = query.id === 'nouvelle' ? { segment: 'all', status: 'draft' } : items.find(n => String(n.id) === query.id) || items[0] || { segment: 'all', status: 'draft' };
  const locked = cur.status === 'outbox';
  const preview = n => html`<div class="mail-preview"><div class="mail-meta"><div><b>Objet :</b> ${n.subject || '—'}</div><div class="muted">${n.preheader || ''}</div><div class="tiny muted">À : ${segments.find(s => s.key === n.segment)?.label} (${segments.find(s => s.key === n.segment)?.count} destinataires)</div></div>
    <div class="mail-body"><header>AFTR</header><div class="content">${n.body || ''}${n.cta_label ? html`<span class="cta">${n.cta_label}</span>` : ''}<p class="tiny" style="color:#999">Tu reçois cet e-mail car tu es membre d'AFTR. Se désinscrire.</p></div></div></div>`;
  return { title: 'Newsletter Studio', html: html`
  <div class="view-h"><div><p class="eyebrow accent">Marketing Hub</p><h1>Newsletter Studio</h1></div><a class="btn primary" href="?id=nouvelle">${icon('plus')}Nouvelle newsletter</a></div>
  ${notice('Aucun service d\'envoi connecté.', 'Une newsletter « envoyée » est placée dans la boîte d\'envoi interne, avec un message par destinataire, et reste signalée comme non envoyée. Aucun résultat d\'ouverture ou de clic ne peut donc être mesuré.', 'plug')}
  <div class="split" style="grid-template-columns:280px minmax(0,1fr);margin-top:18px">
    <aside class="card"><div class="card-h"><h3>Campagnes</h3></div><div class="list">${items.map(n => html`<a class="item" href="?id=${n.id}" style="${n.id === cur.id ? 'font-weight:700' : ''}"><div class="grow"><div class="small truncate">${n.subject}</div><div class="tiny muted">${n.segment_label} · ${n.audience}</div></div>${chip(CAL_STATUS, n.status)}</a>`)}</div></aside>
    <div class="split-wide">
      <form class="card stack" id="nl" style="--gap:12px"><fieldset ${locked ? raw('disabled') : ''} class="stack" style="border:0;padding:0;margin:0;--gap:12px;min-width:0">
        <label class="field"><span>Objet</span><input class="input" name="subject" required value="${cur.subject || ''}"></label>
        <label class="field"><span>Préheader</span><input class="input" name="preheader" value="${cur.preheader || ''}"></label>
        <label class="field"><span>Contenu</span><textarea class="textarea" name="body" rows="9">${cur.body || ''}</textarea></label>
        <div class="form-grid"><label class="field"><span>Bouton (CTA)</span><input class="input" name="cta_label" value="${cur.cta_label || ''}"></label><label class="field"><span>Lien du bouton</span><input class="input" name="cta_url" value="${cur.cta_url || ''}"></label></div>
        <div class="form-grid"><label class="field"><span>Segment</span>${select('segment', segments.map(s => [s.key, `${s.label} (${s.count})`]), cur.segment)}</label><label class="field"><span>Date prévue</span><input class="input" type="date" name="scheduled_date" value="${cur.scheduled_date || ''}"></label></div>
        <label class="field"><span>Statut</span>${select('status', STATUSES.map(s => [s, CAL_STATUS[s][0]]), cur.status === 'outbox' ? 'published' : cur.status)}</label></fieldset>
        ${locked ? html`<div class="notice accent">${icon('mail')}<div><b>Dans la boîte d'envoi depuis le ${fmt.date(cur.outbox_at)}.</b> ${cur.recipients} destinataires · non envoyée. Résultats : aucun (envoi non connecté).</div></div>`
          : html`<div class="row"><button class="btn">${icon('check')}Enregistrer</button>${cur.id ? html`<button type="button" class="btn primary" id="outbox">${icon('mail')}Placer dans la boîte d'envoi</button><button type="button" class="btn ghost danger" id="del">${icon('trash')}</button>` : ''}</div>`}
      </form>
      <div class="sticky" id="nl-preview">${preview(cur)}</div>
    </div>
  </div>`,
  mount: v => {
    const f = $('#nl', v);
    f.addEventListener('input', () => $('#nl-preview', v).innerHTML = preview(formData(f)).s);
    f.addEventListener('change', () => $('#nl-preview', v).innerHTML = preview(formData(f)).s);
    f.addEventListener('submit', async e => { e.preventDefault(); const d = formData(f); const r = await act(f.querySelector('button'), () => cur.id ? api.patch('/api/admin/newsletters/' + cur.id, d) : api.post('/api/admin/newsletters', d), 'Newsletter enregistrée'); navigate('/app/admin/marketing/newsletters?id=' + (r.id || cur.id)); });
    $('#outbox', v)?.addEventListener('click', async e => {
      if (!await confirmBox('Placer cette newsletter dans la boîte d\'envoi interne ? Elle ne sera pas réellement envoyée : aucun service d\'emailing n\'est connecté.', { ok: 'Placer dans la boîte d\'envoi' })) return;
      await api.patch('/api/admin/newsletters/' + cur.id, formData(f));
      const { recipients } = await act(e.target, () => api.post(`/api/admin/newsletters/${cur.id}/outbox`));
      toast(`${recipients} messages en boîte d'envoi (non envoyés)`); rerender();
    });
    $('#del', v)?.addEventListener('click', async () => { if (await confirmBox('Supprimer cette newsletter ?', { ok: 'Supprimer', danger: true })) { await api.del('/api/admin/newsletters/' + cur.id); navigate('/app/admin/marketing/newsletters'); } });
  } };
}

// ───────── Calendrier éditorial
export async function calendar({ query, rerender }) {
  const month = query.mois || today().slice(0, 7);
  const { items } = await api.get(`/api/admin/calendar?from=${addDays(month + '-01', -7)}&to=${addDays(month + '-01', 45)}`);
  const cls = { content: 'info', newsletter: 'accent', campaign: 'ok', event: 'task' };
  const inMonth = items.filter(i => i.date.startsWith(month));
  return { title: 'Calendrier éditorial', html: html`
  <div class="view-h"><div><p class="eyebrow accent">Marketing Hub</p><h1>Calendrier éditorial</h1></div>
    <div class="legend"><span><i style="background:var(--info-soft)"></i>Publication</span><span><i style="background:var(--accent)"></i>Newsletter</span><span><i style="background:var(--ok-soft)"></i>Campagne</span><span><i style="background:var(--surface-2);border:1px solid var(--line)"></i>Événement</span></div></div>
  ${calendarGrid(month, items.map(i => ({ date: i.date, label: i.title, cls: cls[i.kind], href: i.kind === 'newsletter' ? `/app/admin/marketing/newsletters?id=${i.id}` : i.kind === 'content' ? '/app/admin/marketing/social' : i.kind === 'campaign' ? '/app/admin/marketing/campagnes' : '#' })), '/app/admin/marketing/calendrier')}
  <div class="card" style="margin-top:18px"><div class="card-h"><h3>Éléments du mois</h3><span class="tiny muted">Change le statut ou la date directement</span></div>
    ${inMonth.length ? html`<div class="list">${inMonth.map(i => html`<div class="item"><span class="chip">${i.sub}</span><div class="grow item-title small truncate">${i.title}</div>
      ${i.kind !== 'event' ? html`<input class="input sm" type="date" value="${i.date}" data-date="${i.kind}/${i.id}" style="width:150px" aria-label="Date"><select class="select sm" data-st="${i.kind}/${i.id}" style="width:140px" aria-label="Statut">${STATUSES.map(s => html`<option value="${s}" ${i.status === s ? raw('selected') : ''}>${CAL_STATUS[s][0]}</option>`)}${i.status === 'outbox' ? html`<option selected value="outbox">Boîte d'envoi</option>` : ''}</select>` : html`<span class="small muted">${fmt.dateShort(i.date)}</span>`}</div>`)}</div>` : empty('Rien ce mois-ci', '')}</div>`,
  mount: v => {
    on(v, 'change', '[data-st]', async (e, s) => { if (s.value === 'outbox') return; await api.patch('/api/admin/calendar/' + s.dataset.st, { status: s.value }); toast('Statut mis à jour'); rerender(); });
    on(v, 'change', '[data-date]', async (e, d) => { await api.patch('/api/admin/calendar/' + d.dataset.date, { date: d.value }); toast('Date mise à jour'); rerender(); });
  } };
}

// ───────── Campagnes
export async function campaigns({ rerender }) {
  const { items } = await api.get('/api/admin/campaigns');
  return { title: 'Campagnes', html: html`
  <div class="view-h"><div><p class="eyebrow accent">Marketing Hub</p><h1>Campagnes</h1><p>Les inscriptions sont attribuées à une campagne via la source déclarée à l'inscription pendant sa période.</p></div><button class="btn primary" id="new">${icon('plus')}Nouvelle campagne</button></div>
  <div class="table-wrap"><table class="table"><thead><tr><th>Campagne</th><th>Objectif</th><th>Canal</th><th>Période</th><th>Budget</th><th>Inscriptions</th><th>Coût / inscr.</th><th>Statut</th></tr></thead><tbody>
    ${items.map(c => html`<tr><td><b>${c.name}</b><div class="tiny muted mono">source : ${c.source_key || '—'}</div></td><td class="small">${c.objective || ''}</td><td class="small">${c.channel || ''}</td><td class="small">${fmt.dayMonth(c.start_date)} → ${fmt.dayMonth(c.end_date)}</td><td class="num">${c.budget ? fmt.eur(c.budget) : '—'}</td><td class="num">${c.signups}</td><td class="num">${c.cost_per_signup ? fmt.eur(c.cost_per_signup) : '—'}</td>
      <td><select class="select sm" data-st="${c.id}" style="width:130px">${STATUSES.map(s => html`<option value="${s}" ${c.status === s ? raw('selected') : ''}>${CAL_STATUS[s][0]}</option>`)}</select></td></tr>`)}</tbody></table></div>`,
  mount: v => {
    on(v, 'change', '[data-st]', async (e, s) => { await api.patch('/api/admin/campaigns/' + s.dataset.st, { status: s.value }); toast('Statut mis à jour'); });
    $('#new', v).onclick = () => modal({ title: 'Nouvelle campagne', width: 600, body: html`<form class="form-grid">
      <label class="field full"><span>Nom</span><input class="input" name="name" required></label>
      <label class="field"><span>Objectif</span><input class="input" name="objective" placeholder="Inscriptions d'organisateurs"></label><label class="field"><span>Canal</span><input class="input" name="channel" placeholder="Instagram"></label>
      <label class="field"><span>Début</span><input class="input" type="date" name="start_date" value="${today()}"></label><label class="field"><span>Fin</span><input class="input" type="date" name="end_date" value="${addDays(today(), 30)}"></label>
      <label class="field"><span>Budget (€)</span><input class="input" type="number" name="budget"></label><label class="field"><span>Source d'inscription suivie</span><input class="input" name="source_key" placeholder="Ex. : Instagram"></label>
      <div class="full modal-f"><button type="button" class="btn" data-close>Annuler</button><button class="btn primary">Créer</button></div></form>`,
      mount: (d, close) => d.querySelector('form').addEventListener('submit', async e => { e.preventDefault(); await act(e.target.querySelector('.primary'), () => api.post('/api/admin/campaigns', formData(e.target)), 'Campagne créée'); close(); rerender(); }) });
  } };
}

// ───────── Automatisations
export async function automations({ rerender }) {
  const { items } = await api.get('/api/admin/automations');
  return { title: 'Automatisations', html: html`
  <div class="view-h"><div><p class="eyebrow accent">Marketing Hub</p><h1>Automatisations</h1><p>Chaque règle est réellement évaluée sur la base quand tu la lances : elle crée des notifications dans AFTR, des tâches dans le CRM ou des e-mails dans la boîte d'envoi interne (non envoyés).</p></div></div>
  <div class="grid g2">${items.map(a => html`<div class="card stack" style="--gap:12px">
    <div class="row spread"><h3 style="font-size:17px">${a.name}</h3><label class="check"><input type="checkbox" data-toggle="${a.id}" ${a.enabled ? raw('checked') : ''}><span>${a.enabled ? 'Active' : 'Inactive'}</span></label></div>
    <p class="small muted">${a.description}</p>
    <div class="row spread"><span class="tiny muted">${a.last_run_at ? `Dernière exécution ${fmt.ago(a.last_run_at)}` : 'Jamais exécutée'}</span><button class="btn sm primary" data-run="${a.id}" ${a.enabled ? '' : raw('disabled')}>${icon('zap')}Exécuter maintenant</button></div>
    ${a.runs.length ? html`<div class="list">${a.runs.slice(0, 3).map(r => html`<div class="item small"><span class="mono tiny muted" style="min-width:90px">${fmt.dateShort(r.created_at)}</span><span class="grow">${r.detail}</span></div>`)}</div>` : ''}
  </div>`)}</div>`,
  mount: v => {
    on(v, 'change', '[data-toggle]', async (e, c) => { await api.patch('/api/admin/automations/' + c.dataset.toggle, { enabled: c.checked }); rerender(); });
    on(v, 'click', '[data-run]', async (e, b) => { const r = await act(b, () => api.post(`/api/admin/automations/${b.dataset.run}/run`)); toast(r.detail); rerender(); });
  } };
}
