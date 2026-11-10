// DJ Community : fil, membres, messagerie, notifications.
import { html, raw, api, state, icon, bg, fmt, avatar, toast, modal, confirmBox, formData, empty, $, $$, on, act, waveform, img, select } from '../core.js';
import { navigate } from '../app.js';

const KINDS = { post: 'Publication', track: 'Morceau', question: 'Conseil', gear: 'Matériel', collab: 'Collab' };

// ───────── Publication
function media(list) {
  if (!list?.length) return '';
  return html`<div class="post-media ${list.length > 1 ? 'n2' : ''}">${list.map(m => m.type === 'image' ? html`<div class="ph" ${bg(m.url, 1000)} role="img" aria-label="Photo"></div>`
    : m.type === 'video' ? html`<video src="${m.url}" controls preload="metadata"></video>` : html`<audio src="${m.url}" controls preload="none"></audio>`)}</div>`;
}
function trackCard(t) {
  if (!t) return '';
  return html`<div class="track-card"><span class="disc" aria-hidden="true"></span><div style="min-width:0"><b class="truncate" style="display:block">${t.title}</b><span class="mono" style="opacity:.7">${t.artist || ''}${t.bpm ? ` · ${t.bpm} BPM` : ''}</span></div>${waveform(t.title, 56)}${t.link ? html`<a class="btn sm" href="${t.link}" target="_blank" rel="noopener">${icon('external')}Écouter</a>` : ''}</div>`;
}
export function postHtml(p) {
  const mine = p.author.id === state.me.id;
  const shown = p.comments.slice(-2);
  return html`<article class="card post" data-post="${p.id}">
    <div class="post-h">
      <a href="/app/membres/${p.author.id}">${avatar(p.author.name, p.author.avatar)}</a>
      <div class="grow"><a href="/app/membres/${p.author.id}" style="font-weight:700">${p.author.name}</a><div class="tiny muted">${p.author.city || ''} · ${fmt.ago(p.created_at)}</div></div>
      ${p.kind !== 'post' ? html`<span class="kind-label">${KINDS[p.kind]}</span>` : ''}
    </div>
    ${p.body ? html`<div class="post-body">${p.body}</div>` : ''}
    ${trackCard(p.track)}
    ${media(p.media)}
    ${p.shared ? html`<div class="shared"><div class="row">${avatar(p.shared.author.name, p.shared.author.avatar, 'xs')}<b class="small">${p.shared.author.name}</b></div>${p.shared.body ? html`<div class="post-body small">${p.shared.body}</div>` : ''}${trackCard(p.shared.track)}${media(p.shared.media)}</div>` : ''}
    <div class="post-actions">
      <button data-react class="${p.reacted ? 'on' : ''}" aria-pressed="${p.reacted}">${icon('flame')}<span>${p.reactions}</span></button>
      <button data-toggle-comments>${icon('comment')}${p.comments.length}</button>
      <button data-share>${icon('repost')}${p.shares || ''} Partager</button>
      <span class="grow"></span>
      ${mine ? html`<button data-delete title="Supprimer">${icon('trash')}</button>` : html`<button data-report title="Signaler">${icon('flag')}</button>`}
    </div>
    <div class="stack" style="--gap:8px" data-comments>
      ${p.comments.length > 2 ? html`<button class="btn ghost sm" data-all-comments style="justify-self:start">Voir les ${p.comments.length} commentaires</button>` : ''}
      ${shown.map(c => commentHtml(c))}
      <form class="row nowrap" data-comment-form>${avatar(state.me.dj?.stage_name || state.me.name, state.me.dj?.photo || state.me.avatar, 'xs')}<input class="input sm grow" name="body" placeholder="Écrire un commentaire…" aria-label="Commentaire" required><button class="btn sm" type="submit">Envoyer</button></form>
    </div>
  </article>`;
}
const commentHtml = c => html`<div class="comment">${avatar(c.author.name, c.author.avatar, 'xs')}<div class="bubble"><a href="/app/membres/${c.author.id}" style="font-weight:700">${c.author.name}</a> <span class="tiny faint">${fmt.ago(c.created_at)}</span><div>${c.body}</div></div></div>`;

export function bindPosts(root, posts, reload) {
  const find = el => posts.find(p => p.id === Number(el.closest('[data-post]').dataset.post));
  const replace = (el, post) => { const i = posts.findIndex(p => p.id === post.id); posts[i] = post; el.closest('[data-post]').outerHTML = postHtml(post).s; };
  on(root, 'click', '[data-react]', async (e, b) => {
    const p = find(b);
    const { reactions } = await api.post(`/api/posts/${p.id}/react`);
    p.reacted = !p.reacted; p.reactions = reactions;
    b.classList.toggle('on', p.reacted); b.setAttribute('aria-pressed', p.reacted); b.querySelector('span').textContent = reactions;
  });
  on(root, 'click', '[data-toggle-comments]', (e, b) => b.closest('[data-post]').querySelector('[data-comment-form] input').focus());
  on(root, 'click', '[data-all-comments]', (e, b) => { const p = find(b); const box = b.closest('[data-comments]'); b.remove(); box.querySelectorAll('.comment').forEach(c => c.remove()); box.insertAdjacentHTML('afterbegin', p.comments.map(c => commentHtml(c).s).join('')); });
  on(root, 'submit', '[data-comment-form]', async (e, f) => {
    e.preventDefault();
    const p = find(f);
    const { post } = await act(f.querySelector('button'), () => api.post(`/api/posts/${p.id}/comments`, formData(f)));
    replace(f, post);
  });
  root.addEventListener('submit', e => { if (e.target.matches('[data-comment-form]')) e.preventDefault(); }, true);
  on(root, 'click', '[data-share]', async (e, b) => {
    const p = find(b);
    await modal({ title: 'Partager sur ton fil', body: html`<form class="stack" id="share-form"><textarea class="textarea" name="body" placeholder="Ajoute un mot (facultatif)"></textarea><div class="modal-f"><button class="btn" type="button" data-close>Annuler</button><button class="btn primary">Partager</button></div></form>`,
      mount: (d, close) => d.querySelector('form').addEventListener('submit', async ev => { ev.preventDefault(); await act(ev.target.querySelector('.primary'), () => api.post(`/api/posts/${p.id}/share`, formData(ev.target)), 'Publication partagée'); close(); reload(); }) });
  });
  on(root, 'click', '[data-report]', async (e, b) => {
    const p = find(b);
    await modal({ title: 'Signaler cette publication', width: 460, body: html`<form class="stack" id="report-form"><p class="muted small">Le signalement est transmis à l'équipe de modération AFTR.</p>
      <div class="choice">${["Droits d'auteur", 'Contenu inapproprié', 'Spam', 'Harcèlement', 'Autre'].map((r, i) => html`<label><input type="radio" name="reason" value="${r}" ${i === 0 ? raw('checked') : ''}><span>${r}</span></label>`)}</div>
      <div class="modal-f"><button class="btn" type="button" data-close>Annuler</button><button class="btn primary">Signaler</button></div></form>`,
      mount: (d, close) => d.querySelector('form').addEventListener('submit', async ev => { ev.preventDefault(); await act(ev.target.querySelector('.primary'), () => api.post(`/api/posts/${p.id}/report`, formData(ev.target)), 'Signalement envoyé à la modération'); close(); }) });
  });
  on(root, 'click', '[data-delete]', async (e, b) => {
    const p = find(b);
    if (!await confirmBox('Supprimer définitivement cette publication ?', { ok: 'Supprimer', danger: true })) return;
    await api.del(`/api/posts/${p.id}`); b.closest('[data-post]').remove(); toast('Publication supprimée');
  });
}

// ───────── Fil
export async function feed({ query, rerender }) {
  const filter = query.filtre || 'all';
  const [{ items }, members] = await Promise.all([api.get('/api/feed?filter=' + filter), api.get('/api/members?q=')]);
  const suggestions = members.items.filter(m => !m.following && m.roles.includes('dj') && m.avatar).slice(0, 5);
  const me = state.me;
  const tabs = [['all', 'Tout'], ['following', 'Abonnements'], ['track', 'Morceaux'], ['question', 'Conseils'], ['gear', 'Matériel'], ['collab', 'Collabs']];
  return { title: 'Fil', html: html`
  <div class="view-h"><div><p class="eyebrow accent">DJ Community</p><h1>Le fil</h1></div></div>
  <div class="split">
    <div class="stack" style="--gap:18px">
      <form class="card composer" id="composer">
        <div class="row nowrap">${avatar(me.dj?.stage_name || me.name, me.dj?.photo || me.avatar)}<textarea class="textarea grow" name="body" placeholder="Une date, un edit, une question pour la communauté ?" aria-label="Texte de la publication"></textarea></div>
        <div class="choice" role="radiogroup" aria-label="Type">${Object.entries(KINDS).map(([k, l], i) => html`<label><input type="radio" name="kind" value="${k}" ${i === 0 ? raw('checked') : ''}><span>${l}</span></label>`)}</div>
        <div class="form-grid" data-track hidden>
          <label class="field"><span>Titre du morceau</span><input class="input" name="track_title"></label>
          <label class="field"><span>Artiste</span><input class="input" name="track_artist"></label>
          <label class="field"><span>BPM</span><input class="input" type="number" name="track_bpm" min="40" max="220"></label>
          <label class="field"><span>Lien d'écoute (facultatif)</span><input class="input" name="track_link" placeholder="https://"></label>
          <label class="check full"><input type="checkbox" name="rights"><span>Je détiens les droits sur ce contenu ou l'autorisation de le partager. Les morceaux d'autres artistes sans autorisation seront retirés.</span></label>
        </div>
        <div data-previews class="row"></div>
        <div class="row spread">
          <label class="btn ghost sm" style="cursor:pointer">${icon('image')}Photo, vidéo ou audio<input type="file" name="files" accept="image/*,video/mp4,video/webm,audio/*" multiple hidden></label>
          <button class="btn primary" type="submit">Publier</button>
        </div>
      </form>
      <div class="seg" role="tablist">${tabs.map(([k, l]) => html`<a href="/app/fil${k === 'all' ? '' : '?filtre=' + k}" class="${filter === k ? 'on' : ''}">${l}</a>`)}</div>
      <div class="stack" id="posts" style="--gap:18px">${items.length ? items.map(postHtml) : empty('Rien pour l\'instant', filter === 'following' ? 'Suis des membres pour voir leurs publications ici.' : 'Sois le premier à publier.')}</div>
    </div>
    <aside class="stack sticky" style="--gap:16px">
      <div class="card"><div class="card-h"><h3>DJs à suivre</h3><a href="/app/membres" class="tiny link">Tous</a></div>
        <div class="list">${suggestions.map(m => html`<div class="item"><a href="/app/membres/${m.id}">${avatar(m.name, m.avatar, 'sm')}</a><div class="grow"><a href="/app/membres/${m.id}" class="item-title truncate" style="display:block">${m.name}</a><div class="item-sub truncate">${m.styles.join(', ')} · ${m.city}</div></div><button class="btn sm" data-follow="${m.id}">Suivre</button></div>`)}</div>
        ${suggestions.length ? '' : html`<p class="small muted">Tu suis déjà tout le monde 🎧</p>`}</div>
      <div class="card stack" style="--gap:10px"><h3 style="font-size:16px">Règles de partage</h3>
        <p class="small muted">Partage uniquement des morceaux dont tu détiens les droits ou que l'artiste t'autorise à diffuser. Les contenus signalés sont examinés par l'équipe AFTR.</p></div>
    </aside>
  </div>`,
  mount: v => {
    bindPosts(v, items, rerender);
    const f = $('#composer', v);
    let files = [];
    f.addEventListener('change', e => {
      if (e.target.name === 'kind') $('[data-track]', f).hidden = e.target.value !== 'track';
      if (e.target.name === 'files') {
        files = [...e.target.files].slice(0, 4);
        $('[data-previews]', f).innerHTML = files.map(fl => html`<span class="chip">${icon(fl.type.startsWith('image') ? 'image' : fl.type.startsWith('video') ? 'video' : 'music')}${fl.name} · ${fmt.bytes(fl.size)}</span>`.s).join('');
      }
    });
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const d = formData(f), btn = f.querySelector('[type=submit]');
      await act(btn, async () => {
        const media = [];
        for (const fl of files) { btn.textContent = `Envoi de ${fl.name}…`; const up = await api.upload(fl); media.push({ type: up.kind, url: up.url }); }
        await api.post('/api/posts', { kind: d.kind, body: d.body, media, rights: d.rights, track: d.kind === 'track' ? { title: d.track_title, artist: d.track_artist, bpm: d.track_bpm, link: d.track_link } : null });
      }, 'Publication en ligne').finally(() => { btn.textContent = 'Publier'; });
      rerender();
    });
    on(v, 'click', '[data-follow]', async (e, b) => { await api.post(`/api/members/${b.dataset.follow}/follow`); b.textContent = 'Suivi ✓'; b.disabled = true; toast('Abonnement ajouté'); });
  } };
}

// ───────── Membres
export async function members({ query }) {
  const { items } = await api.get('/api/members?q=' + encodeURIComponent(query.q || ''));
  return { title: 'Membres', html: html`
  <div class="view-h"><div><p class="eyebrow accent">DJ Community</p><h1>Membres</h1><p>DJs et organisateurs de la communauté. Suis-les pour voir leurs publications dans ton fil.</p></div>
    <form id="member-search" class="row"><input class="input" name="q" value="${query.q || ''}" placeholder="Nom, ville, style…" style="width:260px" aria-label="Rechercher"><button class="btn">${icon('search')}Rechercher</button></form></div>
  ${items.length ? html`<div class="grid auto-fill" style="--min:250px">${items.map(m => html`<div class="card stack" style="--gap:12px;text-align:center;justify-items:center">
      <a href="/app/membres/${m.id}">${avatar(m.name, m.avatar, 'lg')}</a>
      <div><a href="/app/membres/${m.id}" style="font-weight:800;font-size:17px">${m.name}</a><div class="small muted">${m.roles.includes('dj') ? 'DJ' : 'Organisateur'} · ${m.city || '—'}</div></div>
      <div class="tags" style="justify-content:center">${(m.styles || []).slice(0, 2).map(s => html`<span class="tag">${s}</span>`)}</div>
      <div class="tiny muted">${m.followers} abonnés</div>
      <div class="row" style="justify-content:center"><button class="btn sm ${m.following ? '' : 'primary'}" data-follow="${m.id}">${m.following ? 'Abonné ✓' : 'Suivre'}</button><button class="btn sm" data-message="${m.id}">${icon('message')}Message</button></div>
    </div>`)}</div>` : empty('Aucun membre trouvé', 'Essaie un autre nom, une ville ou un style.')}`,
  mount: v => {
    $('#member-search', v).addEventListener('submit', e => { e.preventDefault(); navigate('/app/membres?q=' + encodeURIComponent(formData(e.target).q)); });
    bindSocial(v);
  } };
}
export function bindSocial(v) {
  on(v, 'click', '[data-follow]', async (e, b) => {
    const { following } = await api.post(`/api/members/${b.dataset.follow}/follow`);
    b.textContent = following ? 'Abonné ✓' : 'Suivre'; b.classList.toggle('primary', !following);
    toast(following ? 'Abonnement ajouté' : 'Abonnement retiré');
  });
  on(v, 'click', '[data-message]', async (e, b) => { const { id } = await api.post('/api/conversations', { members: [Number(b.dataset.message)] }); navigate('/app/messages/' + id); });
}

export async function member({ params, rerender }) {
  const { member: m } = await api.get('/api/members/' + params.id);
  const isMe = m.id === state.me.id;
  return { title: m.name, html: html`
  <a href="/app/membres" class="back">${icon('back')}Membres</a>
  <div class="card" style="padding:0;overflow:hidden;margin-bottom:22px">
    <div class="ph" ${bg(m.avatar, 1400)} style="height:180px;filter:saturate(1.1)"></div>
    <div class="row" style="padding:0 24px 22px;margin-top:-44px;align-items:end;position:relative">
      ${avatar(m.name, m.avatar, 'xl')}
      <div class="grow" style="padding-bottom:6px"><h1 class="display" style="font-size:48px">${m.name}</h1><div class="small muted">${m.roles.map(r => ({ dj: 'DJ', organizer: 'Organisateur' }[r])).filter(Boolean).join(' · ')} · ${m.city || '—'} · membre depuis ${fmt.date(m.created_at)}</div></div>
      <div class="row">
        <span class="small"><b>${m.followers}</b> abonnés · <b>${m.following_count}</b> abonnements</span>
        ${isMe ? html`<a class="btn" href="/app/parametres">Modifier mon profil</a>` : html`<button class="btn ${m.following ? '' : 'primary'}" data-follow="${m.id}">${m.following ? 'Abonné ✓' : 'Suivre'}</button><button class="btn" data-message="${m.id}">${icon('message')}Message</button>`}
        ${m.slug ? html`<a class="btn" href="/app/djs/${m.slug}">Profil artiste</a>` : ''}
      </div>
    </div>
  </div>
  <div class="split">
    <div class="stack" style="--gap:18px" id="posts">${m.posts.length ? m.posts.map(postHtml) : empty('Aucune publication', '')}</div>
    <aside class="card stack sticky" style="--gap:10px"><h3 style="font-size:16px">À propos</h3><p class="muted">${m.bio || 'Pas encore de bio.'}</p>${m.styles.length ? html`<div class="tags">${m.styles.map(s => html`<span class="tag">${s}</span>`)}</div>` : ''}</aside>
  </div>`,
  mount: v => { bindSocial(v); bindPosts($('#posts', v), m.posts, rerender); } };
}

// ───────── Messagerie
let pollTimer;
export async function messages({ params }) {
  clearInterval(pollTimer);
  const { items } = await api.get('/api/conversations');
  const current = params.id ? await api.get('/api/conversations/' + params.id) : null;
  const meId = state.me.id;
  const msgHtml = (m, members) => { const who = members.find(x => x.id === m.sender_id); return html`<div class="msg ${m.sender_id === meId ? 'me' : 'them'}">${current.conversation.is_group && m.sender_id !== meId ? html`<b class="tiny" style="display:block">${who?.name}</b>` : ''}${m.body}<small>${fmt.dateShort(m.created_at)} · ${fmt.time(m.created_at)}</small></div>`; };
  return { title: 'Messages', html: html`
  <div class="view-h" style="margin-bottom:16px"><div><p class="eyebrow accent">DJ Community</p><h1>Messages</h1></div><button class="btn primary" id="new-conv">${icon('plus')}Nouvelle conversation</button></div>
  <div class="chat">
    <div class="chat-list">${items.length ? items.map(c => html`<a href="/app/messages/${c.id}" class="${current?.conversation.id === c.id ? 'on' : ''}">
        ${c.is_group ? html`<span class="av">${icon('users')}</span>` : avatar(c.title, c.avatar)}
        <div class="grow"><div class="row spread nowrap"><b class="truncate">${c.title}</b><span class="tiny faint nowrap">${c.last ? fmt.ago(c.last.created_at) : ''}</span></div>
        <div class="small muted truncate">${c.last ? (c.last.sender_id === meId ? 'Toi : ' : '') + c.last.body : 'Nouvelle conversation'}</div></div>
        ${c.unread ? html`<span class="chip accent">${c.unread}</span>` : ''}</a>`) : html`<p class="muted small" style="padding:20px">Aucune conversation.</p>`}</div>
    <div class="chat-main">${current ? html`
      <div class="chat-h">${current.conversation.is_group ? html`<span class="av">${icon('users')}</span>` : avatar(current.conversation.title, current.conversation.avatar)}<div class="grow"><b>${current.conversation.title}</b><div class="tiny muted">${current.conversation.members.length} participants</div></div></div>
      <div class="chat-msgs" id="msgs">${current.messages.map(m => msgHtml(m, current.conversation.members))}</div>
      <form class="chat-form" id="msg-form"><input class="input grow" name="body" placeholder="Écrire un message…" autocomplete="off" required aria-label="Message"><button class="btn primary">Envoyer</button></form>`
      : empty('Choisis une conversation', 'Ou démarre-en une nouvelle avec un membre de la communauté.')}</div>
  </div>`,
  mount: v => {
    $('#new-conv', v).onclick = () => newConversation();
    if (!current) return;
    const box = $('#msgs', v); box.scrollTop = box.scrollHeight;
    let count = current.messages.length;
    const refresh = async () => {
      if (!document.contains(box)) return clearInterval(pollTimer);
      const r = await api.get('/api/conversations/' + params.id);
      if (r.messages.length !== count) { count = r.messages.length; box.innerHTML = r.messages.map(m => msgHtml(m, r.conversation.members).s).join(''); box.scrollTop = box.scrollHeight; }
    };
    pollTimer = setInterval(refresh, 4000);
    const f = $('#msg-form', v);
    f.addEventListener('submit', async e => {
      e.preventDefault();
      await act(f.querySelector('button'), () => api.post(`/api/conversations/${params.id}/messages`, formData(f)));
      f.reset(); await refresh(); f.body.focus();
    });
    f.body.focus();
  } };
}
async function newConversation() {
  const { items } = await api.get('/api/members?q=');
  await modal({ title: 'Nouvelle conversation', body: html`<form class="stack" id="nc">
    <input class="input" id="nc-filter" placeholder="Filtrer les membres…" aria-label="Filtrer">
    <div class="list" style="max-height:320px;overflow:auto">${items.map(m => html`<label class="item check" data-name="${m.name.toLowerCase()}"><input type="checkbox" name="members" value="${m.id}">${avatar(m.name, m.avatar, 'sm')}<div class="grow"><b>${m.name}</b><div class="tiny muted">${m.city || ''}</div></div></label>`)}</div>
    <label class="field"><span>Nom du groupe (si plusieurs membres)</span><input class="input" name="title" placeholder="Ex. : B2B Lyon"></label>
    <div class="modal-f"><button type="button" class="btn" data-close>Annuler</button><button class="btn primary">Démarrer</button></div></form>`,
    mount: (d, close) => {
      d.querySelector('#nc-filter').oninput = e => d.querySelectorAll('[data-name]').forEach(el => el.hidden = !el.dataset.name.includes(e.target.value.toLowerCase()));
      d.querySelector('form').addEventListener('submit', async e => {
        e.preventDefault();
        const data = formData(e.target);
        const { id } = await act(e.target.querySelector('.primary'), () => api.post('/api/conversations', { members: data.members.map(Number), title: data.title }));
        close(); navigate('/app/messages/' + id);
      });
    } });
}

// ───────── Notifications
export async function notifications({ rerender }) {
  const { items } = await api.get('/api/notifications');
  const ic = { booking: 'ticket', follow: 'users', comment: 'comment', reaction: 'flame', share: 'repost', review: 'star', reminder: 'clock', profile: 'contacts', welcome: 'sparkle', support: 'help', moderation: 'shield' };
  return { title: 'Notifications', html: html`
  <div class="view-h"><div><p class="eyebrow accent">Activité</p><h1>Notifications</h1></div>${items.some(n => !n.read) ? html`<button class="btn" id="read-all">${icon('check')}Tout marquer comme lu</button>` : ''}</div>
  <div class="card">${items.length ? html`<div class="list">${items.map(n => html`<a class="item" href="${n.link || '#'}" data-id="${n.id}" style="${n.read ? '' : 'background:linear-gradient(90deg,var(--accent-soft),transparent 40%);margin:0 -20px;padding-inline:20px'}">
      <span class="av sm" style="color:var(--text)">${icon(ic[n.kind] || 'bell')}</span>
      <div class="grow"><div class="item-title">${n.title}</div>${n.body ? html`<div class="item-sub">${n.body}</div>` : ''}</div><span class="tiny faint nowrap">${fmt.ago(n.created_at)}</span></a>`)}</div>`
    : empty('Aucune notification', 'Les demandes, commentaires et nouveaux abonnés apparaîtront ici.')}</div>`,
  mount: v => {
    const b = $('#read-all', v);
    if (b) b.onclick = async () => { await api.post('/api/notifications/read'); state.me.unread = 0; rerender(); };
    on(v, 'click', '[data-id]', (e, a) => api.post('/api/notifications/read', { id: Number(a.dataset.id) }));
  } };
}
