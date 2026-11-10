// « Ma com' » : stratégie marketing du DJ, suivi des publications et des abonnés.
import { html, raw, api, state, icon, fmt, toast, modal, confirmBox, formData, empty, notice, $, on, act, select, chip, today, addDays } from '../core.js';
import { navigate } from '../app.js';

const NETWORKS = ['Instagram', 'TikTok', 'YouTube', 'Facebook'];
const FORMATS = ['Reel', 'Vidéo courte', 'Carrousel', 'Photo', 'Story', 'Live'];
const POST_STATUS = { idea: ['Idée', 'off'], planned: ['Programmée', 'accent'], published: ['Publiée', 'ok'] };
const NATURE = { reel: 'Tes données', hypothese: 'Hypothèse', methode: 'Conseil' };
const num = n => n == null ? '—' : fmt.num(n);
const dec = n => n == null ? '—' : String(n).replace('.', ',');
const notConnected = notice('Comptes non connectés.', 'AFTR ne lit pas encore Instagram ni TikTok : tu saisis toi-même tes publications et leurs statistiques (vues, likes…), et AFTR calcule le reste.', 'plug');

function postModal(p, { gigs = [], clips = [] }, done) {
  p = p || { network: 'Instagram', format: 'Reel', status: 'planned', planned_date: addDays(today(), 1) };
  return modal({ title: p.id ? p.title : 'Nouvelle publication', width: 680, body: html`<form class="form-grid">
    <label class="field full"><span>Titre</span><input class="input" name="title" required value="${p.title || ''}" placeholder="Ex. : Récap 5 ans Plavace"></label>
    <label class="field"><span>Réseau</span>${select('network', NETWORKS, p.network)}</label>
    <label class="field"><span>Format</span>${select('format', FORMATS, p.format)}</label>
    <label class="field"><span>Statut</span>${select('status', Object.entries(POST_STATUS).map(([k, [l]]) => [k, l]), p.status)}</label>
    <label class="field"><span>Date prévue</span><input class="input" type="date" name="planned_date" value="${p.planned_date || ''}"></label>
    <label class="field"><span>Date de publication</span><input class="input" type="date" name="published_date" value="${p.published_date || ''}"></label>
    <label class="field"><span>Lien de la publication</span><input class="input" name="link" value="${p.link || ''}" placeholder="https://instagram.com/p/…"></label>
    <label class="field"><span>Date liée</span><select class="select" name="gig_id"><option value="">—</option>${gigs.map(g => html`<option value="${g.id}" ${String(p.gig_id) === String(g.id) ? raw('selected') : ''}>${g.title} · ${fmt.dayMonth(g.date)}</option>`)}</select></label>
    <label class="field"><span>Clip du Set Clipper</span><select class="select" name="clip_id"><option value="">—</option>${clips.map(c => html`<option value="${c.id}" ${String(p.clip_id) === String(c.id) ? raw('selected') : ''}>${c.title} (${c.format})</option>`)}</select></label>
    <label class="field full"><span>Légende</span><textarea class="textarea" name="caption">${p.caption || ''}</textarea></label>
    <p class="full eyebrow" style="margin-top:4px">Statistiques (à recopier depuis l'application du réseau)</p>
    ${[['views', 'Vues'], ['likes', 'Likes'], ['comments', 'Commentaires'], ['shares', 'Partages'], ['saves', 'Enregistrements'], ['followers_gained', 'Abonnés gagnés']].map(([k, l]) => html`<label class="field"><span>${l}</span><input class="input" type="number" min="0" name="${k}" value="${p[k] ?? ''}"></label>`)}
    <div class="full row spread">${p.id ? html`<button type="button" class="btn ghost danger" data-del>${icon('trash')}Supprimer</button>` : html`<span></span>`}
      <div class="row"><button type="button" class="btn" data-close>Annuler</button><button class="btn primary">Enregistrer</button></div></div></form>`,
  mount: (d, close) => {
    const f = d.querySelector('form');
    f.addEventListener('submit', async e => { e.preventDefault(); await act(f.querySelector('.primary'), () => p.id ? api.patch('/api/studio/posts/' + p.id, formData(f)) : api.post('/api/studio/posts', formData(f)), 'Publication enregistrée'); close(); done(); });
    d.querySelector('[data-del]')?.addEventListener('click', async () => { if (await confirmBox('Supprimer cette publication ?', { ok: 'Supprimer', danger: true })) { await api.del('/api/studio/posts/' + p.id); close(); done(); } });
  } });
}

function sparkline(series) {
  if (series.length < 2) return '';
  const min = Math.min(...series.map(s => s.count)), max = Math.max(...series.map(s => s.count)), W = 160, H = 40;
  const pts = series.map((s, i) => `${(i / (series.length - 1) * W).toFixed(1)},${(H - 4 - (s.count - min) / Math.max(1, max - min) * (H - 8)).toFixed(1)}`);
  return raw(`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true"><polyline points="${pts.join(' ')}" fill="none" stroke="var(--accent-text)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${pts.at(-1).split(',')[0]}" cy="${pts.at(-1).split(',')[1]}" r="3.5" fill="var(--accent-text)"/></svg>`);
}

// ───────── Vue d'ensemble
export async function overview({ rerender }) {
  const [m, lists] = await Promise.all([api.get('/api/studio/marketing'), api.get('/api/studio/posts')]);
  const s = m.settings, t = m.totals;
  const maxEng = Math.max(1, ...m.by_network.map(x => x.engagement || 0), ...m.by_format.map(x => x.engagement || 0));
  return { title: "Ma com'", html: html`
  <div class="view-h"><div><p class="eyebrow accent">Business Studio</p><h1>Ma com' & réseaux</h1><p>Ta stratégie, tes publications et tes abonnés au même endroit, reliés à tes dates et à tes clips.</p></div>
    <div class="row"><a class="btn" href="/app/studio/clipper">${icon('scissors')}Set Clipper</a><button class="btn primary" id="new-post">${icon('plus')}Publication</button></div></div>
  <div class="stack" style="--gap:10px;margin-bottom:18px">${notConnected}
    ${m.has_examples ? html`<div class="notice accent">${icon('info')}<div class="grow"><b>Données d'exemple.</b> Les publications et abonnés marqués « exemple » servent à montrer l'outil : ce ne sont pas tes vraies statistiques. Une publication que tu modifies devient la tienne.</div><button class="btn sm" id="purge">Supprimer les exemples</button></div>` : ''}</div>
  <div class="kpis" style="margin-bottom:20px">
    <div class="kpi accent"><b>${num(t.views)}</b><span>vues sur ${t.published} publication${t.published > 1 ? 's' : ''}</span></div>
    <div class="kpi"><b>${t.engagement != null ? dec(t.engagement) + ' %' : '—'}</b><span>engagement moyen</span></div>
    <div class="kpi"><b>+${num(t.followers_gained)}</b><span>abonnés gagnés grâce aux posts</span></div>
    <div class="kpi"><b>${dec(t.per_week)} / ${s.posts_per_week || 3}</b><span>publications par semaine (objectif)</span></div>
  </div>
  <div class="split-wide" style="margin-bottom:18px">
    <form class="card stack" id="goal" style="--gap:12px"><div class="card-h" style="margin:0"><h3>Ma stratégie</h3><span class="tiny muted">Règles appliquées à tes données, sans IA</span></div>
      <div class="form-grid" style="grid-template-columns:2fr 1fr 1fr">
        <label class="field"><span>Objectif</span>${select('goal', Object.entries(m.goals), s.goal || 'dates_city')}</label>
        <label class="field"><span>Ville visée</span><input class="input" name="target_city" value="${s.target_city || ''}" placeholder="Paris"></label>
        <label class="field"><span>Posts / semaine</span><input class="input" type="number" min="1" max="21" name="posts_per_week" value="${s.posts_per_week || 3}"></label>
      </div>
      <div class="list">${m.recos.map(r => html`<div class="item small" style="align-items:flex-start"><span class="nature ${r.nature}">${NATURE[r.nature]}</span><span class="grow">${r.text}</span></div>`)}</div>
      <div><button class="btn primary">Mettre à jour ma stratégie</button></div>
    </form>
    <div class="card"><div class="card-h"><h3>Abonnés</h3><button class="btn sm" id="add-followers">${icon('plus')}Relevé</button></div>
      ${m.followers.length ? html`<div class="list">${m.followers.map(f => html`<div class="item"><div class="grow"><div class="row" style="--gap:8px"><b>${f.network}</b>${f.example ? html`<span class="tag">exemple</span>` : ''}</div><div class="display" style="font-size:34px">${fmt.num(f.count)}</div>
        <div class="tiny ${f.delta >= 0 ? '' : 'muted'}" style="color:${f.delta >= 0 ? 'var(--ok)' : 'var(--bad)'}">${f.delta >= 0 ? '+' : ''}${fmt.num(f.delta)} depuis le ${fmt.dayMonth(f.since)}</div></div>${sparkline(f.series)}</div>`)}</div>`
        : empty('Aucun relevé', 'Note ton nombre d\'abonnés de temps en temps pour suivre ta progression.')}</div>
  </div>
  <div class="grid g2" style="margin-bottom:18px">
    <div class="card"><div class="card-h"><h3>Idées tirées de tes dates</h3><span class="tiny muted">Annonce avant, récap après</span></div>
      ${m.ideas.length ? html`<div class="list">${m.ideas.map((i, k) => html`<div class="item"><span class="chip">${i.network}</span><div class="grow"><div class="item-title small">${i.title}</div><div class="item-sub">${fmt.dateShort(i.date)} · ${i.why}</div></div><button class="btn sm" data-idea="${k}">Planifier</button></div>`)}</div>` : empty('Pas d\'idée pour l\'instant', 'Les idées apparaissent autour de tes prochaines dates.')}</div>
    <div class="card"><div class="card-h"><h3>Publications programmées</h3><a class="tiny link" href="/app/studio/marketing/publications">Toutes</a></div>
      ${m.upcoming.length ? html`<div class="list">${m.upcoming.map(p => html`<div class="item"><span class="chip">${p.network}</span><div class="grow"><div class="item-title small">${p.title}</div><div class="item-sub">${fmt.dateShort(p.planned_date)} · ${p.format || ''}</div></div><button class="btn sm" data-publish="${p.id}">Publiée ✓</button></div>`)}</div>` : empty('Rien de programmé', '')}</div>
  </div>
  <div class="grid g2">
    <div class="card"><div class="card-h"><h3>Ce qui marche le mieux</h3><span class="tiny muted">Taux d'engagement</span></div>
      ${m.by_network.length ? html`<div class="stack" style="--gap:10px">${[...m.by_network.map(x => ({ ...x, lbl: x.key })), ...m.by_format.map(x => ({ ...x, lbl: x.key, f: 1 }))].map(x => html`<div class="hbar"><span class="truncate">${x.f ? '◦ ' : ''}${x.lbl}</span><div class="track"><div class="fill ${x.f ? '' : 'accent'}" style="width:${(x.engagement || 0) / maxEng * 100}%"></div></div><span class="mono">${dec(x.engagement)} %</span></div>`)}</div>
        <p class="tiny muted" style="margin-top:10px">En jaune : réseaux. ◦ : formats. Engagement = (likes + commentaires + partages + enregistrements) / vues.</p>` : empty('Pas encore de statistiques', 'Renseigne les vues et likes de tes publications.')}</div>
    <div class="card"><div class="card-h"><h3>Top publications</h3></div>
      ${m.best.length ? html`<div class="list">${m.best.map((p, i) => html`<div class="item"><span class="display" style="font-size:30px;width:28px">${i + 1}</span><div class="grow"><div class="item-title small">${p.title} ${p.is_example ? html`<span class="tag">exemple</span>` : ''}</div><div class="item-sub">${p.network} · ${p.format || ''} · ${fmt.dayMonth(p.published_date)}</div></div><div style="text-align:right"><b class="mono">${fmt.num(p.views)}</b><div class="tiny muted">${dec(p.engagement)} %</div></div></div>`)}</div>` : empty('Aucune publication suivie', '')}</div>
  </div>`,
  mount: v => {
    $('#new-post', v).onclick = () => postModal(null, lists, rerender);
    $('#purge', v)?.addEventListener('click', async e => { if (await confirmBox('Supprimer toutes les publications et relevés d\'exemple ?', { ok: 'Supprimer', danger: true })) { await api.del('/api/studio/marketing/examples'); toast('Exemples supprimés'); rerender(); } });
    $('#goal', v).addEventListener('submit', async e => { e.preventDefault(); await act(e.target.querySelector('.primary'), () => api.put('/api/studio/marketing/goal', formData(e.target)), 'Stratégie mise à jour'); rerender(); });
    on(v, 'click', '[data-idea]', (e, b) => { const i = m.ideas[Number(b.dataset.idea)]; postModal({ network: i.network, format: i.format, title: i.title, gig_id: i.gig_id, status: 'planned', planned_date: i.date }, lists, rerender); });
    on(v, 'click', '[data-publish]', async (e, b) => { await act(b, () => api.patch('/api/studio/posts/' + b.dataset.publish, { status: 'published', published_date: today() }), 'Marquée comme publiée : ajoute ses stats dans Publications'); rerender(); });
    $('#add-followers', v).onclick = () => modal({ title: 'Nouveau relevé d\'abonnés', width: 420, body: html`<form class="stack"><label class="field"><span>Réseau</span>${select('network', NETWORKS, 'Instagram')}</label><label class="field"><span>Abonnés</span><input class="input" type="number" min="0" name="count" required></label><label class="field"><span>Date</span><input class="input" type="date" name="date" value="${today()}"></label><div class="modal-f"><button type="button" class="btn" data-close>Annuler</button><button class="btn primary">Enregistrer</button></div></form>`,
      mount: (d, close) => d.querySelector('form').addEventListener('submit', async e => { e.preventDefault(); await act(e.target.querySelector('.primary'), () => api.post('/api/studio/followers', formData(e.target)), 'Relevé enregistré'); close(); rerender(); }) });
  } };
}

// ───────── Publications
export async function posts({ query, rerender }) {
  const lists = await api.get('/api/studio/posts');
  const tab = query.statut || 'all';
  const items = lists.items.filter(p => tab === 'all' || p.status === tab);
  return { title: 'Publications', html: html`
  <a href="/app/studio/marketing" class="back">${icon('back')}Ma com'</a>
  <div class="view-h"><div><h1>Publications</h1><p>Idées, posts programmés et posts publiés avec leurs statistiques.</p></div><button class="btn primary" id="new-post">${icon('plus')}Publication</button></div>
  <div style="margin-bottom:14px">${notConnected}</div>
  <div class="seg" style="margin-bottom:14px">${[['all', 'Toutes'], ['idea', 'Idées'], ['planned', 'Programmées'], ['published', 'Publiées']].map(([k, l]) => html`<a href="?statut=${k}" class="${tab === k ? 'on' : ''}">${l} (${k === 'all' ? lists.items.length : lists.items.filter(p => p.status === k).length})</a>`)}</div>
  ${items.length ? html`<div class="table-wrap"><table class="table"><thead><tr><th>Publication</th><th>Réseau</th><th>Date</th><th>Statut</th><th style="text-align:right">Vues</th><th style="text-align:right">Likes</th><th style="text-align:right">Engagement</th><th style="text-align:right">Abonnés</th></tr></thead><tbody>
    ${items.map(p => html`<tr data-post="${p.id}" style="cursor:pointer"><td><b>${p.title}</b> ${p.is_example ? html`<span class="tag">exemple</span>` : ''}<div class="tiny muted">${[p.format, p.gig_title && `date : ${p.gig_title}`, p.clip_title && `clip : ${p.clip_title}`].filter(Boolean).join(' · ')}</div></td>
      <td>${p.network}</td><td class="small">${fmt.dayMonth(p.published_date || p.planned_date)}</td><td>${chip(POST_STATUS, p.status)}</td>
      <td class="num" style="text-align:right">${num(p.views)}</td><td class="num" style="text-align:right">${num(p.likes)}</td><td class="num" style="text-align:right">${p.engagement != null ? dec(p.engagement) + ' %' : '—'}</td><td class="num" style="text-align:right">${p.followers_gained != null ? '+' + p.followers_gained : '—'}</td></tr>`)}
  </tbody></table></div>` : empty('Aucune publication', 'Ajoute une idée ou une publication pour commencer le suivi.')}`,
  mount: v => {
    $('#new-post', v).onclick = () => postModal(null, lists, rerender);
    on(v, 'click', 'tr[data-post]', (e, tr) => postModal(lists.items.find(p => String(p.id) === tr.dataset.post), lists, rerender));
  } };
}
