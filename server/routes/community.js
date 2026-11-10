import { get, all, run, insert, now, J, tx } from '../db.js';
import { route, fail, notify, str, int, oneOf } from '../http.js';

const KINDS = ['post', 'track', 'question', 'gear', 'collab'];

function authorOf(id) {
  return get(`SELECT u.id, u.name, u.avatar, u.city, d.stage_name, d.slug, d.photo, o.org_name
    FROM users u LEFT JOIN dj_profiles d ON d.user_id = u.id LEFT JOIN organizer_profiles o ON o.user_id = u.id WHERE u.id = ?`, id);
}
export function displayName(a) { return a?.stage_name || a?.org_name || a?.name; }

function hydrate(p, viewerId) {
  const a = authorOf(p.author_id);
  const out = {
    id: p.id, kind: p.kind, body: p.body, media: J(p.media), track: J(p.track, null), created_at: p.created_at,
    author: { id: a.id, name: displayName(a), avatar: a.photo || a.avatar, city: a.city, slug: a.slug },
    reactions: get('SELECT COUNT(*) n FROM reactions WHERE post_id = ?', p.id).n,
    reacted: !!get('SELECT 1 FROM reactions WHERE post_id = ? AND user_id = ?', p.id, viewerId),
    shares: get('SELECT COUNT(*) n FROM posts WHERE shared_post_id = ?', p.id).n,
    comments: all(`SELECT c.id, c.body, c.created_at, c.author_id FROM comments c WHERE c.post_id = ? ORDER BY c.created_at`, p.id)
      .map(c => { const ca = authorOf(c.author_id); return { ...c, author: { id: ca.id, name: displayName(ca), avatar: ca.photo || ca.avatar } }; }),
  };
  if (p.shared_post_id) {
    const s = get('SELECT * FROM posts WHERE id = ? AND hidden = 0', p.shared_post_id);
    if (s) { const sa = authorOf(s.author_id); out.shared = { id: s.id, body: s.body, media: J(s.media), track: J(s.track, null), kind: s.kind, author: { id: sa.id, name: displayName(sa), avatar: sa.photo || sa.avatar } }; }
  }
  return out;
}

route('GET', '/api/feed', ({ user, query }) => {
  const filter = query.filter || 'all';
  let sql = 'SELECT * FROM posts WHERE hidden = 0', p = [];
  if (filter === 'following') { sql += ' AND (author_id IN (SELECT followee_id FROM follows WHERE follower_id = ?) OR author_id = ?)'; p.push(user.id, user.id); }
  else if (KINDS.includes(filter)) { sql += ' AND kind = ?'; p.push(filter); }
  if (query.author) { sql += ' AND author_id = ?'; p.push(Number(query.author)); }
  sql += ' ORDER BY created_at DESC LIMIT 40';
  return { items: all(sql, ...p).map(x => hydrate(x, user.id)) };
}, { role: 'user' });

route('POST', '/api/posts', ({ user, body }) => {
  const kind = oneOf(body.kind || 'post', KINDS, 'Type de publication');
  const text = str(body.body, { max: 2000, label: 'Texte' });
  const media = (Array.isArray(body.media) ? body.media : []).slice(0, 4).map(m => ({ type: oneOf(m.type, ['image', 'video', 'audio'], 'Média'), url: str(m.url, { required: true, max: 300 }) }));
  let track = null;
  if (kind === 'track') {
    track = { title: str(body.track?.title, { required: true, max: 100, label: 'Titre du morceau' }), artist: str(body.track?.artist, { max: 80 }), bpm: int(body.track?.bpm, { max: 220 }), link: str(body.track?.link, { max: 300 }) };
    // Règle de partage : l'auteur doit déclarer détenir les droits ou l'autorisation
    if (!body.rights) fail(400, 'Coche la déclaration de droits avant de partager un morceau.');
  }
  if (!text && !media.length && !track) fail(400, 'Ta publication est vide.');
  const id = insert('INSERT INTO posts (author_id, kind, body, media, track, created_at) VALUES (?, ?, ?, ?, ?, ?)', user.id, kind, text, JSON.stringify(media), track ? JSON.stringify(track) : null, now());
  return { post: hydrate(get('SELECT * FROM posts WHERE id = ?', id), user.id) };
}, { role: 'user' });

route('DELETE', '/api/posts/:id', ({ user, params }) => {
  const p = get('SELECT author_id FROM posts WHERE id = ?', params.id);
  if (!p || p.author_id !== user.id) fail(403, 'Tu ne peux supprimer que tes propres publications.');
  run('DELETE FROM posts WHERE id = ?', params.id);
  return { ok: true };
}, { role: 'user' });

route('POST', '/api/posts/:id/react', ({ user, params }) => {
  const p = get('SELECT author_id FROM posts WHERE id = ? AND hidden = 0', params.id) || fail(404, 'Publication introuvable.');
  if (get('SELECT 1 FROM reactions WHERE post_id = ? AND user_id = ?', params.id, user.id)) run('DELETE FROM reactions WHERE post_id = ? AND user_id = ?', params.id, user.id);
  else {
    run('INSERT INTO reactions (post_id, user_id, created_at) VALUES (?, ?, ?)', params.id, user.id, now());
    if (p.author_id !== user.id) notify(p.author_id, 'reaction', `${user.name} a réagi à ta publication`, null, '/app/fil');
  }
  return { reactions: get('SELECT COUNT(*) n FROM reactions WHERE post_id = ?', params.id).n };
}, { role: 'user' });

route('POST', '/api/posts/:id/comments', ({ user, params, body }) => {
  const p = get('SELECT author_id FROM posts WHERE id = ? AND hidden = 0', params.id) || fail(404, 'Publication introuvable.');
  insert('INSERT INTO comments (post_id, author_id, body, created_at) VALUES (?, ?, ?, ?)', params.id, user.id, str(body.body, { required: true, max: 1000, label: 'Commentaire' }), now());
  if (p.author_id !== user.id) notify(p.author_id, 'comment', `${user.name} a commenté ta publication`, str(body.body, { max: 1000 }).slice(0, 120), '/app/fil');
  return { post: hydrate(get('SELECT * FROM posts WHERE id = ?', params.id), user.id) };
}, { role: 'user' });

route('POST', '/api/posts/:id/share', ({ user, params, body }) => {
  const p = get('SELECT author_id FROM posts WHERE id = ? AND hidden = 0', params.id) || fail(404, 'Publication introuvable.');
  const id = insert('INSERT INTO posts (author_id, kind, body, shared_post_id, created_at) VALUES (?, ?, ?, ?, ?)', user.id, 'post', str(body.body, { max: 500 }), params.id, now());
  if (p.author_id !== user.id) notify(p.author_id, 'share', `${user.name} a partagé ta publication`, null, '/app/fil');
  return { post: hydrate(get('SELECT * FROM posts WHERE id = ?', id), user.id) };
}, { role: 'user' });

route('POST', '/api/posts/:id/report', ({ user, params, body }) => {
  get('SELECT 1 FROM posts WHERE id = ?', params.id) || fail(404, 'Publication introuvable.');
  const reason = oneOf(body.reason, ['Droits d\'auteur', 'Contenu inapproprié', 'Spam', 'Harcèlement', 'Autre'], 'Motif');
  insert('INSERT INTO reports (post_id, reporter_id, reason, created_at) VALUES (?, ?, ?, ?)', params.id, user.id, reason, now());
  return { ok: true };
}, { role: 'user' });

// ───────── Membres et abonnements
route('GET', '/api/members', ({ user, query }) => {
  const q = `%${(query.q || '').trim()}%`;
  const rows = all(`SELECT u.id, u.name, u.avatar, u.city, d.stage_name, d.slug, d.photo, d.styles, o.org_name,
      (SELECT GROUP_CONCAT(role) FROM user_roles WHERE user_id = u.id) roles,
      (SELECT COUNT(*) FROM follows WHERE followee_id = u.id) followers,
      EXISTS (SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = u.id) following
    FROM users u LEFT JOIN dj_profiles d ON d.user_id = u.id LEFT JOIN organizer_profiles o ON o.user_id = u.id
    WHERE u.suspended = 0 AND u.id != ? AND (u.name LIKE ? OR d.stage_name LIKE ? OR u.city LIKE ? OR d.styles LIKE ? OR o.org_name LIKE ?)
      AND NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = u.id AND role = 'admin')
    ORDER BY (d.user_id IS NULL), followers DESC LIMIT 60`, user.id, user.id, q, q, q, q, q);
  return { items: rows.map(r => ({ ...r, name: r.stage_name || r.org_name || r.name, avatar: r.photo || r.avatar, styles: J(r.styles), roles: (r.roles || '').split(','), following: !!r.following })) };
}, { role: 'user' });

route('GET', '/api/members/:id', ({ user, params }) => {
  const a = authorOf(params.id) || fail(404, 'Membre introuvable.');
  const u = get('SELECT bio, created_at FROM users WHERE id = ?', a.id);
  const dj = get('SELECT styles FROM dj_profiles WHERE user_id = ?', a.id);
  return { member: {
    id: a.id, name: displayName(a), avatar: a.photo || a.avatar, city: a.city, bio: u.bio, slug: a.slug, created_at: u.created_at,
    roles: all('SELECT role FROM user_roles WHERE user_id = ?', a.id).map(r => r.role), styles: J(dj?.styles),
    followers: get('SELECT COUNT(*) n FROM follows WHERE followee_id = ?', a.id).n,
    following_count: get('SELECT COUNT(*) n FROM follows WHERE follower_id = ?', a.id).n,
    following: !!get('SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?', user.id, a.id),
    posts: all('SELECT * FROM posts WHERE author_id = ? AND hidden = 0 ORDER BY created_at DESC LIMIT 20', a.id).map(p => hydrate(p, user.id)),
  } };
}, { role: 'user' });

route('POST', '/api/members/:id/follow', ({ user, params }) => {
  const id = Number(params.id);
  if (id === user.id) fail(400, 'Tu ne peux pas te suivre toi-même.');
  get('SELECT 1 FROM users WHERE id = ?', id) || fail(404, 'Membre introuvable.');
  const exists = get('SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?', user.id, id);
  if (exists) run('DELETE FROM follows WHERE follower_id = ? AND followee_id = ?', user.id, id);
  else { run('INSERT INTO follows (follower_id, followee_id, created_at) VALUES (?, ?, ?)', user.id, id, now()); notify(id, 'follow', `${user.name} te suit désormais`, null, `/app/membres/${user.id}`); }
  return { following: !exists, followers: get('SELECT COUNT(*) n FROM follows WHERE followee_id = ?', id).n };
}, { role: 'user' });

// ───────── Messagerie
function conversationFor(convId, userId) {
  get('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?', convId, userId) || fail(403, 'Conversation inaccessible.');
  const c = get('SELECT * FROM conversations WHERE id = ?', convId);
  const members = all('SELECT user_id FROM conversation_members WHERE conversation_id = ?', convId).map(m => { const a = authorOf(m.user_id); return { id: a.id, name: displayName(a), avatar: a.photo || a.avatar }; });
  const others = members.filter(m => m.id !== userId);
  return { ...c, members, title: c.title || others.map(o => o.name).join(', ') || 'Conversation', avatar: c.is_group ? null : others[0]?.avatar };
}

route('GET', '/api/conversations', ({ user }) => ({
  items: all(`SELECT c.id, cm.last_read_at, (SELECT MAX(created_at) FROM messages WHERE conversation_id = c.id) last_at
      FROM conversations c JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = ? ORDER BY last_at DESC`, user.id)
    .map(r => {
      const c = conversationFor(r.id, user.id);
      const last = get('SELECT body, sender_id, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1', r.id);
      const unread = get('SELECT COUNT(*) n FROM messages WHERE conversation_id = ? AND sender_id != ? AND (? IS NULL OR created_at > ?)', r.id, user.id, r.last_read_at, r.last_read_at).n;
      return { ...c, last, unread };
    }),
}), { role: 'user' });

route('GET', '/api/conversations/:id', ({ user, params }) => {
  const c = conversationFor(params.id, user.id);
  run('UPDATE conversation_members SET last_read_at = ? WHERE conversation_id = ? AND user_id = ?', now(), params.id, user.id);
  return { conversation: c, messages: all('SELECT id, sender_id, body, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at', params.id) };
}, { role: 'user' });

route('POST', '/api/conversations', ({ user, body }) => {
  const ids = [...new Set((body.members || []).map(Number).filter(n => n && n !== user.id))];
  if (!ids.length) fail(400, 'Choisis au moins un membre.');
  for (const id of ids) get('SELECT 1 FROM users WHERE id = ?', id) || fail(404, 'Membre introuvable.');
  if (ids.length === 1) {
    const existing = get(`SELECT c.id FROM conversations c WHERE c.is_group = 0
      AND EXISTS (SELECT 1 FROM conversation_members WHERE conversation_id = c.id AND user_id = ?)
      AND EXISTS (SELECT 1 FROM conversation_members WHERE conversation_id = c.id AND user_id = ?)`, user.id, ids[0]);
    if (existing) return { id: existing.id };
  }
  const id = tx(() => {
    const id = insert('INSERT INTO conversations (title, is_group, created_at) VALUES (?, ?, ?)', ids.length > 1 ? str(body.title, { max: 80 }) || 'Groupe' : null, ids.length > 1 ? 1 : 0, now());
    for (const m of [user.id, ...ids]) run('INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)', id, m);
    return id;
  });
  return { id };
}, { role: 'user' });

route('POST', '/api/conversations/:id/messages', ({ user, params, body }) => {
  const c = conversationFor(params.id, user.id);
  const text = str(body.body, { required: true, max: 3000, label: 'Message' });
  insert('INSERT INTO messages (conversation_id, sender_id, body, created_at) VALUES (?, ?, ?, ?)', params.id, user.id, text, now());
  run('UPDATE conversation_members SET last_read_at = ? WHERE conversation_id = ? AND user_id = ?', now(), params.id, user.id);
  return { ok: true, members: c.members.length };
}, { role: 'user' });
