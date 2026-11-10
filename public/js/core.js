// Outils partagés de l'interface : gabarits HTML sûrs, appels API, formats, composants.

// ───────── Gabarits HTML échappés par défaut
export class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = s => new Raw(s ?? '');
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtVal = v => v == null || v === false ? '' : v instanceof Raw ? v.s : Array.isArray(v) ? v.map(fmtVal).join('') : esc(v);
export function html(strings, ...vals) {
  let out = '';
  strings.forEach((s, i) => { out += s; if (i < vals.length) out += fmtVal(vals[i]); });
  return new Raw(out);
}

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export function on(root, event, selector, fn) {
  root.addEventListener(event, e => { const t = e.target.closest(selector); if (t && root.contains(t)) fn(e, t); });
}

// ───────── État global
export const state = { me: null };

// ───────── API
export class ApiError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
async function request(method, url, body) {
  const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (!res.ok) {
    if (res.status === 401 && !url.startsWith('/api/auth')) { state.me = null; window.dispatchEvent(new CustomEvent('aftr:logout')); }
    throw new ApiError(res.status, data?.error || 'Une erreur est survenue.');
  }
  return data;
}
export const api = {
  get: url => request('GET', url),
  post: (url, body = {}) => request('POST', url, body),
  patch: (url, body = {}) => request('PATCH', url, body),
  put: (url, body = {}) => request('PUT', url, body),
  del: url => request('DELETE', url),
  async upload(file) {
    const res = await fetch('/api/uploads', { method: 'POST', headers: { 'X-Filename': encodeURIComponent(file.name), 'Content-Type': 'application/octet-stream' }, body: file });
    const data = await res.json();
    if (!res.ok) throw new ApiError(res.status, data.error);
    return data;
  },
};

/** Exécute une action avec retour visuel : désactive le bouton, affiche l'erreur éventuelle. */
export async function act(btn, fn, success) {
  const prev = btn?.disabled;
  if (btn) btn.disabled = true;
  try { const r = await fn(); if (success) toast(success); return r; }
  catch (e) { toast(e.message, 'error'); throw e; }
  finally { if (btn) btn.disabled = prev; }
}

// ───────── Formats
const LOCALE = 'fr-FR';
export const fmt = {
  eur: n => new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'EUR', maximumFractionDigits: Number(n) % 1 ? 2 : 0 }).format(Number(n) || 0),
  num: n => new Intl.NumberFormat(LOCALE).format(n || 0),
  date: d => d ? new Date(d.length === 10 ? d + 'T12:00:00' : d).toLocaleDateString(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' }) : '—',
  dateShort: d => d ? new Date(d.length === 10 ? d + 'T12:00:00' : d).toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' }) : '—',
  dayMonth: d => d ? new Date(d.length === 10 ? d + 'T12:00:00' : d).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' }) : '—',
  time: d => new Date(d).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' }),
  ago(d) {
    const s = (Date.now() - new Date(d).getTime()) / 1000;
    if (s < 60) return "à l'instant";
    if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
    if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
    if (s < 86400 * 7) return `il y a ${Math.floor(s / 86400)} j`;
    return fmt.dayMonth(d);
  },
  until(d) {
    const days = Math.round((new Date(d + 'T12:00:00') - new Date(today() + 'T12:00:00')) / 86400000);
    return days === 0 ? "aujourd'hui" : days === 1 ? 'demain' : days > 0 ? `dans ${days} j` : `il y a ${-days} j`;
  },
  initials: s => String(s || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2),
  tc: s => { s = Math.max(0, s || 0); const m = Math.floor(s / 60), r = Math.floor(s % 60); return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`; },
  bytes: n => n > 1e6 ? `${(n / 1e6).toFixed(1)} Mo` : `${Math.round(n / 1e3)} Ko`,
};
export const today = () => new Date().toISOString().slice(0, 10);
export const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// ───────── Images : références « unsplash:… » ou fichiers envoyés
export function img(ref, w = 800) {
  if (!ref) return '';
  if (ref.startsWith('unsplash:')) return `https://images.unsplash.com/${ref.slice(9)}?auto=format&fit=crop&w=${w}&q=72`;
  return ref;
}
export const bg = (ref, w) => ref ? raw(`style="background-image:url('${esc(img(ref, w))}')"`) : raw('');

export function avatar(name, ref, cls = '') {
  return ref ? html`<span class="av ${cls}" ${bg(ref, 200)} role="img" aria-label="${name}"></span>`
    : html`<span class="av ${cls}" aria-hidden="true">${fmt.initials(name)}</span>`;
}

// Forme d'onde décorative, stable pour une même graine (identité visuelle des sets)
export function waveform(seed = 'aftr', bars = 48, cls = 'wave') {
  let h = 0; for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const rnd = () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296; };
  const w = 4, gap = 2, W = bars * (w + gap);
  const rects = Array.from({ length: bars }, (_, i) => {
    const env = Math.sin((i / bars) * Math.PI) * 0.55 + 0.45;
    const v = Math.max(0.12, Math.min(1, env * (0.45 + rnd() * 0.7)));
    const height = v * 28;
    return `<rect x="${i * (w + gap)}" y="${(28 - height) / 2}" width="${w}" height="${height}" rx="2"/>`;
  }).join('');
  return raw(`<svg class="${cls}" viewBox="0 0 ${W} 28" preserveAspectRatio="none" fill="currentColor" aria-hidden="true">${rects}</svg>`);
}

// ───────── Icônes (tracés inspirés de Lucide, MIT)
const P = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
  feed: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 8h10M7 12h10M7 16h6"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.6c2.6.1 4.6 1.9 5.3 4.9"/>',
  message: '<path d="M4 5h16v11H8l-4 4z"/>',
  bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 21h4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  disc: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/>',
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  contacts: '<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M8 17c.6-2 2.1-3 4-3s3.4 1 4 3"/>',
  ticket: '<path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z"/><path d="M13 6v12" stroke-dasharray="2 2"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  file: '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4M9 13h6M9 17h6"/>',
  receipt: '<path d="M5 3h14v18l-2.5-1.5L14 21l-2-1.5L10 21l-2.5-1.5L5 21z"/><path d="M9 8h6M9 12h6"/>',
  wallet: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M16 15h2"/><path d="M6 6V4h12v2"/>',
  scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.5 7.5 20 18M8.5 16.5 20 6"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  heart: '<path d="M12 20s-7.5-4.6-9.2-9.5C1.6 7 3.8 4 7 4c2 0 3.4 1 5 3 1.6-2 3-3 5-3 3.2 0 5.4 3 4.2 6.5C19.5 15.4 12 20 12 20z"/>',
  flame: '<path d="M12 21c-4 0-7-2.8-7-6.5 0-4.4 4.3-6.4 4-11.5 3.3 1.8 5.4 4.6 5.4 7.7.9-.6 1.6-1.6 1.8-2.8C17.9 9.6 19 11.8 19 14.5 19 18.2 16 21 12 21z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  logout: '<path d="M9 21H5V3h4M16 17l5-5-5-5M21 12H9"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  megaphone: '<path d="M3 10v4h3l7 5V5L6 10z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17.5h.01"/>',
  building: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1M10 21v-3h4v3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 1 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  play: '<path d="M7 4.5v15l13-7.5z" fill="currentColor"/>',
  pause: '<path d="M7 4h3.5v16H7zM13.5 4H17v16h-3.5z" fill="currentColor"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 17v3h16v-3"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5M4 17v3h16v-3"/>',
  share: '<path d="M4 12v8h16v-8M12 3v13M7 8l5-5 5 5"/>',
  repost: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
  flag: '<path d="M5 21V4h11l-1.5 4L16 12H5"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  video: '<rect x="2.5" y="6" width="13.5" height="12" rx="2"/><path d="m16 10 5.5-3v10L16 14"/>',
  comment: '<path d="M21 12a8 8 0 0 1-11.6 7.2L4 20.5l1.3-4.6A8 8 0 1 1 21 12z"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
  plug: '<path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0zM12 17v5"/>',
  euro: '<path d="M18 6.5A7 7 0 1 0 18 17.5M4 10h10M4 14h10"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.7-4.3L3 9M3 4v5h5M4 13a8 8 0 0 0 14.7 4.3L21 15M21 20v-5h-5"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>',
};
export function icon(name, cls = '') {
  return raw(`<svg class="${cls}" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || P.info}</svg>`);
}

// ───────── Retours visuels
export function toast(message, kind = '') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = (kind === 'error' ? '' : icon('check').s) + esc(message);
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), kind === 'error' ? 5000 : 2800);
}

/** Fenêtre modale. `mount(root, close)` branche les événements. Renvoie une promesse résolue à la fermeture. */
export function modal({ title, body, width = 560, mount }) {
  return new Promise(resolve => {
    const d = document.createElement('dialog');
    d.className = 'modal';
    d.style.setProperty('--w', width + 'px');
    d.innerHTML = html`<div class="modal-h"><h2>${title}</h2><button class="btn ghost icon sm" data-close aria-label="Fermer">${icon('x')}</button></div><div class="modal-b">${body}</div>`.s;
    document.body.appendChild(d);
    let result;
    const close = r => { result = r; d.close(); };
    d.addEventListener('close', () => { d.remove(); resolve(result); });
    d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-close]')) close(); });
    d.showModal();
    mount?.(d, close);
  });
}
export function confirmBox(text, { ok = 'Confirmer', danger = false } = {}) {
  return modal({
    title: 'Confirmation', width: 440,
    body: html`<p>${text}</p><div class="modal-f"><button class="btn" data-close>Annuler</button><button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${ok}</button></div>`,
    mount: (d, close) => d.querySelector('[data-ok]').addEventListener('click', () => close(true)),
  }).then(Boolean);
}

export function formData(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === 'checkbox') {
      if (form.querySelectorAll(`[name="${el.name}"]`).length > 1) { (out[el.name] ||= []); if (el.checked) out[el.name].push(el.value); }
      else out[el.name] = el.checked;
    } else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
    else out[el.name] = el.value;
  }
  return out;
}

// ───────── Petits composants
export const empty = (title, text, action) => html`<div class="empty">${icon('disc')}<h3>${title}</h3>${text ? html`<p>${text}</p>` : ''}${action || ''}</div>`;
export const notice = (title, text, ic = 'plug', cls = '') => html`<div class="notice ${cls}">${icon(ic)}<div><b>${title}</b> ${text}</div></div>`;
export const stars = n => raw('<span class="stars" aria-label="' + n + ' sur 5">' + '★'.repeat(Math.round(n)) + '<span style="opacity:.25">' + '★'.repeat(5 - Math.round(n)) + '</span></span>');
export function select(name, options, value, attrs = '') {
  return html`<select ${raw(/class=/.test(attrs) ? '' : 'class="select"')} name="${name}" ${raw(attrs)}>${options.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return html`<option value="${v}" ${String(v) === String(value ?? '') ? raw('selected') : ''}>${l}</option>`; })}</select>`;
}

export const BOOKING = {
  pending: ['Demande reçue', 'warn'], quoted: ['Devis proposé', 'info'], confirmed: ['Confirmé', 'ok'],
  declined: ['Refusé', 'bad'], cancelled: ['Annulé', 'off'], completed: ['Réalisé', 'solid'],
};
export const DOC_STATUS = {
  draft: ['Brouillon', 'off'], sent: ['Envoyé', 'info'], accepted: ['Accepté', 'ok'], declined: ['Refusé', 'bad'], paid: ['Payée', 'ok'], overdue: ['En retard', 'bad'],
};
export const CAL_STATUS = {
  idea: ['Idée', 'off'], draft: ['Brouillon', ''], review: ['À valider', 'warn'], approved: ['Validé', 'info'], scheduled: ['Programmé', 'accent'], published: ['Publié', 'ok'], archived: ['Archivé', 'off'], outbox: ['Boîte d\'envoi · non envoyée', 'warn'],
};
export function chip(map, status) { const [label, cls] = map[status] || [status, '']; return html`<span class="chip ${cls}"><span class="dot"></span>${label}</span>`; }
