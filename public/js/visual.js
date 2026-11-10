// Studio visuel : crée l'image d'une publication (modèles d'inspiration ou création libre) et sa légende,
// directement dans le navigateur (Canvas). Aucune IA : mise en page par modèles, couleurs extraites d'une image d'inspiration.
import { html, api, icon, toast, modal, $, $$, img } from './core.js';

// Photos d'ambiance libres de droits (Unsplash), proposées à tout le monde
export const CLUB_PHOTOS = ['unsplash:photo-1545128485-c400e7702796', 'unsplash:photo-1470229722913-7c0e2dbbafd3', 'unsplash:photo-1574155267225-3b5423dd45d9', 'unsplash:photo-1533174072545-7a4b6ad7a6c3'];
export const SIZES = { post: [1080, 1350, 'Post 4:5'], carre: [1080, 1080, 'Carré 1:1'], story: [1080, 1920, 'Story / couverture Reel 9:16'] };
const PALETTES = {
  nuit: { name: 'Nuit AFTR', bg: '#0E0E12', bg2: '#24242C', fg: '#F5F3EE', accent: '#FFD23F' },
  jour: { name: 'Jour', bg: '#F3F0E8', bg2: '#E2DCCD', fg: '#121216', accent: '#E3A600' },
  neon: { name: 'Néon', bg: '#130A26', bg2: '#3A1170', fg: '#FFFFFF', accent: '#FF3EA5' },
  sunset: { name: 'Coucher de soleil', bg: '#2A0F0A', bg2: '#7A2A12', fg: '#FFEFD9', accent: '#FF8A1F' },
  club: { name: 'Club vert', bg: '#06140F', bg2: '#0D3B2A', fg: '#EFFFF7', accent: '#3DFFA2' },
};
const D = '"Big Shoulders Display", Impact, sans-serif', S = '"Hanken Grotesk", Arial, sans-serif', M = '"JetBrains Mono", Menlo, monospace';

// ───────── Outils de dessin
function fit(ctx, text, maxW, maxLines, size, weight = 800, family = D, upper = true) {
  text = upper ? String(text || '').toUpperCase() : String(text || '');
  for (; size > 18; size -= 4) {
    ctx.font = `${weight} ${size}px ${family}`;
    const lines = [];
    for (const para of text.split('\n')) {
      let line = '';
      for (const w of para.split(/\s+/).filter(Boolean)) {
        const t = line ? line + ' ' + w : w;
        if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
      }
      lines.push(line);
    }
    if (lines.length <= maxLines && lines.every(l => ctx.measureText(l).width <= maxW)) return { lines, size };
  }
  return { lines: [text], size };
}
function writeLines(ctx, { lines, size }, x, y, lh = .95, align = 'left') {
  ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  lines.forEach((l, i) => ctx.fillText(l, x, y + size * .82 + i * size * lh));
  return y + lines.length * size * lh;
}
function cover(ctx, im, x, y, w, h) {
  const r = Math.max(w / im.naturalWidth, h / im.naturalHeight), iw = im.naturalWidth * r, ih = im.naturalHeight * r;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.drawImage(im, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih); ctx.restore();
}
function pill(ctx, text, x, y, p, size = 30) {
  if (!text) return y;
  ctx.font = `600 ${size}px ${M}`; const w = ctx.measureText(text.toUpperCase()).width + size * 1.4, h = size * 1.9;
  ctx.fillStyle = p.accent; ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill();
  ctx.fillStyle = contrastOn(p.accent); ctx.textAlign = 'left'; ctx.fillText(text.toUpperCase(), x + size * .7, y + h * .66);
  return y + h;
}
function mono(ctx, text, x, y, color, size = 30, align = 'left') {
  if (!text) return; ctx.font = `500 ${size}px ${M}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(text, x, y);
}
function shade(ctx, W, H, from, to, alpha) {
  const g = ctx.createLinearGradient(0, H * from, 0, H * to);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${alpha})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function background(ctx, W, H, p, kind = 'solid') {
  if (kind === 'gradient') { const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, p.bg2); g.addColorStop(1, p.bg); ctx.fillStyle = g; }
  else ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, W, H);
}
const lum = hex => { const [r, g, b] = rgb(hex).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const hex = ([r, g, b]) => '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
const contrastOn = c => lum(c) > .4 ? '#111114' : '#FFFFFF';
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + .05) / (y + .05); };

// ───────── Modèles d'inspiration : chacun dessine le visuel complet à partir des textes, de la palette et de la photo
const TEMPLATES = {
  affiche: { name: 'Affiche soirée', hint: 'Photo plein cadre, titre géant en bas', draw(ctx, W, H, t, p, photo) {
    photo ? cover(ctx, photo, 0, 0, W, H) : background(ctx, W, H, p, 'gradient');
    shade(ctx, W, H, .25, 1, .88);
    pill(ctx, t.kicker, 72, 72, p);
    const m = 72, title = fit(ctx, t.title, W - m * 2, 3, Math.round(W * .2));
    ctx.font = `600 ${Math.round(W * .036)}px ${S}`;
    const infoY = H - 120, subY = infoY - (t.subtitle ? 70 : 0);
    const titleH = title.lines.length * title.size * .95;
    ctx.fillStyle = '#FFFFFF'; ctx.font = `800 ${title.size}px ${D}`; writeLines(ctx, title, m, subY - titleH - 30);
    if (t.subtitle) { ctx.fillStyle = p.accent; ctx.font = `700 ${Math.round(W * .04)}px ${S}`; ctx.textAlign = 'left'; ctx.fillText(t.subtitle, m, subY); }
    mono(ctx, t.info, m, infoY + 40, '#FFFFFFCC', 30);
    mono(ctx, t.handle, W - m, infoY + 40, '#FFFFFFCC', 30, 'right');
  } },
  date: { name: 'Date à retenir', hint: 'Grosse date en couleur, fond uni', draw(ctx, W, H, t, p, photo) {
    background(ctx, W, H, p);
    const m = 80;
    if (photo) { cover(ctx, photo, W * .52, 0, W * .48, H); ctx.fillStyle = p.bg + '55'; ctx.fillRect(W * .52, 0, W * .48, H); }
    const w = photo ? W * .52 - m * 1.4 : W - m * 2;
    ctx.fillStyle = p.accent; const k = fit(ctx, t.kicker || 'Bientôt', w, 3, Math.round(W * .22), 900);
    ctx.font = `900 ${k.size}px ${D}`; let y = writeLines(ctx, k, m, m, .9);
    ctx.fillStyle = p.accent; ctx.fillRect(m, y + 30, 120, 10);
    ctx.fillStyle = p.fg; const ti = fit(ctx, t.title, w, 4, Math.round(W * .09));
    ctx.font = `800 ${ti.size}px ${D}`; y = writeLines(ctx, ti, m, y + 80);
    if (t.subtitle) { ctx.fillStyle = p.fg; const s = fit(ctx, t.subtitle, w, 3, Math.round(W * .038), 500, S, false); ctx.font = `500 ${s.size}px ${S}`; writeLines(ctx, s, m, y + 30, 1.3); }
    mono(ctx, t.info, m, H - m - 46, p.fg, 30);
    mono(ctx, t.handle, m, H - m, p.accent, 30);
  } },
  bandeau: { name: 'Bandeau photo', hint: 'Photo en haut, bandeau de texte en bas', draw(ctx, W, H, t, p, photo) {
    background(ctx, W, H, p);
    const ph = H * .6, m = 72;
    photo ? cover(ctx, photo, 0, 0, W, ph) : background(ctx, W, ph, p, 'gradient');
    ctx.fillStyle = p.accent; ctx.fillRect(0, ph, W, 14);
    if (t.kicker) pill(ctx, t.kicker, m, ph - 100, p, 28);
    ctx.fillStyle = p.fg; const ti = fit(ctx, t.title, W - m * 2, 2, Math.round(W * .12));
    ctx.font = `800 ${ti.size}px ${D}`; let y = writeLines(ctx, ti, m, ph + 60);
    if (t.subtitle) { const s = fit(ctx, t.subtitle, W - m * 2, 2, Math.round(W * .036), 500, S, false); ctx.font = `500 ${s.size}px ${S}`; y = writeLines(ctx, s, m, y + 20, 1.3); }
    ctx.fillStyle = p.fg + '33'; ctx.fillRect(m, H - m - 70, W - m * 2, 2);
    mono(ctx, t.info, m, H - m, p.fg, 30); mono(ctx, t.handle, W - m, H - m, p.accent, 30, 'right');
  } },
  citation: { name: 'Citation', hint: 'Une phrase forte, guillemets géants', draw(ctx, W, H, t, p, photo) {
    background(ctx, W, H, p, 'gradient');
    if (photo) { ctx.globalAlpha = .22; cover(ctx, photo, 0, 0, W, H); ctx.globalAlpha = 1; }
    const m = 96;
    ctx.fillStyle = p.accent; ctx.font = `900 ${Math.round(W * .42)}px ${D}`; ctx.textAlign = 'left'; ctx.fillText('“', m - 20, H * .3);
    ctx.fillStyle = p.fg; const q = fit(ctx, t.title, W - m * 2, 6, Math.round(W * .1), 800);
    const qh = q.lines.length * q.size * 1.02;
    ctx.font = `800 ${q.size}px ${D}`; const y = writeLines(ctx, q, m, (H - qh) / 2 + 40, 1.02);
    if (t.subtitle) { ctx.fillStyle = p.accent; ctx.font = `700 ${Math.round(W * .036)}px ${S}`; ctx.fillText('— ' + t.subtitle, m, y + 70); }
    mono(ctx, t.handle, m, H - m, p.fg, 30); mono(ctx, t.info, W - m, H - m, p.fg + 'AA', 26, 'right');
  } },
  chiffre: { name: 'Chiffre clé', hint: 'Un nombre énorme, une phrase', draw(ctx, W, H, t, p, photo) {
    background(ctx, W, H, p);
    if (photo) { cover(ctx, photo, 0, H * .62, W, H * .38); ctx.fillStyle = p.bg + '66'; ctx.fillRect(0, H * .62, W, H * .38); }
    const m = 80;
    if (t.info) mono(ctx, t.info.toUpperCase(), m, m + 30, p.fg + 'AA', 28);
    ctx.fillStyle = p.accent; const n = fit(ctx, t.kicker || '100 %', W - m * 2, 1, Math.round(W * .4), 900);
    ctx.font = `900 ${n.size}px ${D}`; let y = writeLines(ctx, n, m, H * .12, .9);
    ctx.fillStyle = p.fg; const ti = fit(ctx, t.title, W - m * 2, 3, Math.round(W * .085));
    ctx.font = `800 ${ti.size}px ${D}`; y = writeLines(ctx, ti, m, y + 20);
    if (t.subtitle) { const s = fit(ctx, t.subtitle, W - m * 2, 2, Math.round(W * .034), 500, S, false); ctx.font = `500 ${s.size}px ${S}`; writeLines(ctx, s, m, y + 24, 1.3); }
    if (t.handle) pill(ctx, t.handle, m, H - m - 60, p, 26);
  } },
  typo: { name: 'Typo brute', hint: 'Titre répété en fond, très graphique', draw(ctx, W, H, t, p, photo) {
    background(ctx, W, H, p);
    if (photo) { ctx.globalAlpha = .35; cover(ctx, photo, 0, 0, W, H); ctx.globalAlpha = 1; }
    const word = String(t.title || 'AFTR').toUpperCase().split(/\s+/)[0];
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-.12); ctx.strokeStyle = p.fg + '30'; ctx.lineWidth = 3;
    ctx.font = `900 ${Math.round(W * .2)}px ${D}`; ctx.textAlign = 'center';
    for (let i = -6; i <= 6; i++) ctx.strokeText(`${word} ${word} ${word}`, (i % 2) * 120, i * W * .19);
    ctx.restore();
    const m = 80; ctx.fillStyle = p.accent; const ti = fit(ctx, t.title, W - m * 2, 3, Math.round(W * .17), 900);
    const th = ti.lines.length * ti.size * .92;
    ctx.font = `900 ${ti.size}px ${D}`; const y = writeLines(ctx, ti, W / 2, (H - th) / 2, .92, 'center');
    if (t.subtitle) { ctx.fillStyle = p.fg; ctx.font = `700 ${Math.round(W * .04)}px ${S}`; ctx.textAlign = 'center'; ctx.fillText(t.subtitle, W / 2, y + 60); }
    if (t.kicker) { ctx.font = `600 30px ${M}`; const w = ctx.measureText(t.kicker.toUpperCase()).width; pill(ctx, t.kicker, (W - w - 42) / 2, m, p); }
    mono(ctx, t.info, W / 2, H - m - 50, p.fg, 30, 'center'); mono(ctx, t.handle, W / 2, H - m, p.accent, 30, 'center');
  } },
};

// Création libre : chaque réglage est choisi à la main
function drawFree(ctx, W, H, t, p, photo, o) {
  if (o.bgKind === 'photo' && photo) { cover(ctx, photo, 0, 0, W, H); ctx.fillStyle = `rgba(0,0,0,${o.dim / 100})`; ctx.fillRect(0, 0, W, H); }
  else background(ctx, W, H, p, o.bgKind === 'gradient' ? 'gradient' : 'solid');
  const onPhoto = o.bgKind === 'photo' && photo, fg = onPhoto ? '#FFFFFF' : p.fg, m = 84, al = o.align;
  const x = al === 'center' ? W / 2 : m;
  ctx.font = `800 ${o.size}px ${D}`;
  const ti = fit(ctx, t.title, W - m * 2, 5, o.size);
  const blockH = (t.kicker ? 90 : 0) + ti.lines.length * ti.size * .95 + (t.subtitle ? 80 : 0) + (o.bar ? 50 : 0);
  let y = o.pos === 'top' ? m + 20 : o.pos === 'bottom' ? H - m - 120 - blockH : (H - blockH) / 2;
  if (t.kicker) { ctx.font = `600 30px ${M}`; const w = ctx.measureText(t.kicker.toUpperCase()).width + 42; pill(ctx, t.kicker, al === 'center' ? (W - w) / 2 : m, y, p); y += 90; }
  ctx.fillStyle = fg; ctx.font = `800 ${ti.size}px ${D}`; y = writeLines(ctx, ti, x, y, .95, al);
  if (o.bar) { ctx.fillStyle = p.accent; ctx.fillRect(al === 'center' ? W / 2 - 60 : m, y + 24, 120, 10); y += 50; }
  if (t.subtitle) { ctx.fillStyle = onPhoto ? p.accent : p.accent; ctx.font = `700 ${Math.round(W * .038)}px ${S}`; ctx.textAlign = al; ctx.fillText(t.subtitle, x, y + 60); }
  mono(ctx, t.info, al === 'center' ? W / 2 : m, H - m - 46, fg + 'CC', 30, al);
  mono(ctx, t.handle, al === 'center' ? W / 2 : m, H - m, p.accent, 30, al);
}

// ───────── Couleurs extraites d'une image d'inspiration
export function paletteFrom(im) {
  const c = document.createElement('canvas'); c.width = c.height = 48;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, 48, 48);
  const d = x.getImageData(0, 0, 48, 48).data, px = [];
  for (let i = 0; i < d.length; i += 4) { const [r, g, b] = [d[i], d[i + 1], d[i + 2]], mx = Math.max(r, g, b), mn = Math.min(r, g, b); px.push({ c: [r, g, b], l: (mx + mn) / 2, s: mx ? (mx - mn) / mx : 0, v: mx }); }
  const avg = arr => arr.reduce((a, p) => a.map((v, i) => v + p.c[i] / arr.length), [0, 0, 0]);
  const byL = [...px].sort((a, b) => a.l - b.l);
  let bg = avg(byL.slice(0, Math.ceil(px.length * .25))), light = avg(byL.slice(-Math.ceil(px.length * .15)));
  const vivid = px.filter(p => p.s > .45 && p.v > 110).sort((a, b) => b.s * b.v - a.s * a.v);
  let accent = vivid.length ? avg(vivid.slice(0, Math.max(1, Math.ceil(vivid.length * .2)))) : light;
  bg = bg.map(v => v * .55); // fond assombri pour garder un texte lisible
  const pal = { name: 'Depuis ton inspi', bg: hex(bg), bg2: hex(bg.map((v, i) => v * .4 + accent[i] * .35)), fg: hex(light), accent: hex(accent) };
  if (ratio(pal.fg, pal.bg) < 4.5) pal.fg = contrastOn(pal.bg) === '#FFFFFF' ? '#F5F3EE' : '#121216';
  if (ratio(pal.accent, pal.bg) < 3) pal.accent = lum(pal.bg) < .2 ? '#FFD23F' : '#121216';
  return pal;
}

const loadImage = src => new Promise((ok, ko) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => ok(im); im.onerror = () => ko(new Error('Image illisible.')); im.src = src; });
const fontsReady = () => Promise.all([`900 80px ${D}`, `800 80px ${D}`, `500 30px ${S}`, `700 30px ${S}`, `500 30px ${M}`, `600 30px ${M}`].map(f => document.fonts.load(f))).catch(() => {});

// ───────── Légendes proposées (modèles de texte, pas d'IA)
const slug = s => '#' + String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
export function hashtagsFor({ network = 'Instagram', styles = [], city, brand } = {}) {
  const base = { Instagram: ['#dj', '#djlife', '#nightlife'], TikTok: ['#dj', '#djtok', '#fyp'], YouTube: ['#djset', '#mix'], Facebook: ['#soirée'], LinkedIn: ['#musique', '#événementiel'] }[network] || ['#dj'];
  const tags = [...(brand ? [brand] : []), ...styles.slice(0, 3).map(slug), ...(city ? [slug(city), slug('dj ' + city)] : []), ...base];
  return [...new Set(tags)].slice(0, network === 'Instagram' ? 9 : 5).join(' ');
}
export function captionIdeas(t, { network = 'Instagram', cta } = {}) {
  const title = t.title || 'ma prochaine date', when = t.kicker ? t.kicker.toLowerCase() : '', where = t.subtitle || '', info = t.info || '';
  const tag = t.handle ? ` ${t.handle}` : '';
  const short = network === 'TikTok';
  return [
    { label: 'Annonce', text: `📍 ${title}${where ? ' — ' + where : ''}\n${when ? `🗓 ${when}\n` : ''}${info ? `ℹ️ ${info}\n` : ''}\n${cta || 'On se voit sur le dancefloor ? Dis-moi en commentaire qui tu ramènes 👇'}` },
    { label: 'Storytelling', text: `Il y a des dates qu'on attend plus que les autres. ${title} en fait partie.\n\n${where ? where + '. ' : ''}${when ? 'Rendez-vous ' + when + '. ' : ''}Je prépare une sélection spéciale pour l'occasion, et je vous garde quelques surprises.\n\n${cta || 'Enregistre ce post pour ne pas oublier 🔖'}${tag}` },
    { label: short ? 'Court (TikTok)' : 'Court', text: `${title.toUpperCase()} ${when ? '· ' + when : ''} ${where ? '· ' + where : ''}\n${cta || 'Lien en bio 🔗'}`.replace(/\s+\n/, '\n') },
  ];
}

/**
 * Ouvre le studio visuel.
 * @param {object} o  texts {kicker,title,subtitle,info,handle}, caption, network, styles, city, brand, photos [refs], onSave({visual_url, caption})
 */
export function openVisualStudio(o = {}) {
  const st = {
    mode: 'inspi', tpl: 'affiche', size: o.network === 'TikTok' || o.format === 'Story' || o.format === 'Reel' ? 'story' : 'post', pal: 'nuit',
    texts: { kicker: '', title: '', subtitle: '', info: '', handle: '', ...o.texts },
    free: { bgKind: 'gradient', pos: 'center', align: 'left', size: 150, dim: 45, bar: true },
    photo: null, photoSrc: null, inspi: null, customPal: null, idea: 0,
  };
  const photos = [...new Set((o.photos || []).filter(Boolean))];
  const pal = () => st.pal === 'inspi' && st.customPal ? st.customPal : PALETTES[st.pal];
  const tags = o.hashtags || hashtagsFor(o);
  let caption = o.caption || '';
  if (!caption) caption = captionIdeas(st.texts, o)[0].text + '\n\n' + tags;

  const render = (canvas, tpl = st.tpl, scale = 1) => {
    const [W, H] = SIZES[st.size];
    canvas.width = W * scale; canvas.height = H * scale;
    const ctx = canvas.getContext('2d'); ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (st.mode === 'free') drawFree(ctx, W, H, st.texts, pal(), st.photo, st.free);
    else TEMPLATES[tpl].draw(ctx, W, H, st.texts, pal(), st.photo);
  };
  const field = (k, l, ph) => html`<label class="field"><span>${l}</span><input class="input" data-t="${k}" value="${st.texts[k]}" placeholder="${ph}"></label>`;

  return modal({ title: 'Studio visuel', width: 1120, body: html`
  <p class="notice">${icon('image')}<span><b>Visuel prêt à poster.</b> Choisis un modèle d'inspiration ou pars de zéro, ajoute ta photo ou une image d'inspi (on reprend ses couleurs), puis télécharge l'image et copie la légende. Mise en page par modèles, sans IA.</span></p>
  <div class="vs">
    <div class="vs-preview"><canvas id="vs-main" aria-label="Aperçu du visuel"></canvas>
      <div class="row" style="justify-content:center;flex-wrap:wrap">${Object.entries(SIZES).map(([k, [, , l]]) => html`<button type="button" class="btn sm ${k === st.size ? 'primary' : ''}" data-size="${k}">${l}</button>`)}</div></div>
    <div class="vs-side stack" style="--gap:16px">
      <div class="seg"><button type="button" data-mode="inspi" class="on">${icon('layers')} Inspirations</button><button type="button" data-mode="free">${icon('edit')} De zéro</button></div>
      <div id="vs-inspi"><div class="vs-thumbs">${Object.entries(TEMPLATES).map(([k, t]) => html`<button type="button" class="vs-thumb ${k === st.tpl ? 'on' : ''}" data-tpl="${k}" title="${t.hint}"><canvas></canvas><span>${t.name}</span></button>`)}</div></div>
      <div id="vs-free" hidden class="form-grid">
        <label class="field"><span>Fond</span><select class="select" data-f="bgKind"><option value="solid">Couleur unie</option><option value="gradient" selected>Dégradé</option><option value="photo">Photo</option></select></label>
        <label class="field"><span>Position du texte</span><select class="select" data-f="pos"><option value="top">Haut</option><option value="center" selected>Centre</option><option value="bottom">Bas</option></select></label>
        <label class="field"><span>Alignement</span><select class="select" data-f="align"><option value="left" selected>Gauche</option><option value="center">Centré</option></select></label>
        <label class="field"><span>Taille du titre</span><input type="range" min="70" max="240" value="150" data-f="size"></label>
        <label class="field"><span>Assombrir la photo</span><input type="range" min="0" max="85" value="45" data-f="dim"></label>
        <label class="field" style="align-self:end"><span><input type="checkbox" data-f="bar" checked> Barre de couleur</span></label>
      </div>
      <div class="form-grid">
        ${field('kicker', 'Petit texte / date', 'SAM 14 NOV')}${field('title', 'Titre', 'Nom de la soirée')}
        ${field('subtitle', 'Sous-titre / lieu', 'Le Sucre, Lyon')}${field('info', 'Infos', '23h – 5h · Billets en bio')}
        ${field('handle', 'Signature', '@ton.compte')}
      </div>
      <div><p class="eyebrow" style="margin-bottom:8px">Couleurs</p><div class="row" style="flex-wrap:wrap;gap:8px">
        ${Object.entries(PALETTES).map(([k, p]) => html`<button type="button" class="vs-pal ${k === st.pal ? 'on' : ''}" data-pal="${k}" title="${p.name}" style="background:linear-gradient(135deg,${p.bg} 55%,${p.accent} 55%)"></button>`)}
        <button type="button" class="vs-pal" data-pal="inspi" id="vs-inspi-pal" hidden title="Depuis ton inspi"></button>
        <label class="btn sm">${icon('sparkle')}Image d'inspi<input type="file" accept="image/*" id="vs-inspi-file" hidden></label></div>
        <p class="tiny muted" id="vs-inspi-note" style="margin-top:6px">Importe une affiche ou une photo qui te plaît : on en extrait les couleurs. Elle n'est utilisée comme fond que si tu la choisis dans Photo.</p></div>
      <div><p class="eyebrow" style="margin-bottom:8px">Photo</p><div class="vs-photos" id="vs-photos">
        <button type="button" class="vs-ph on" data-ph="">Aucune</button>
        ${photos.map(p => html`<button type="button" class="vs-ph" data-ph="${img(p, 900)}" style="background-image:url('${img(p, 240)}')" aria-label="Photo"></button>`)}
        <label class="vs-ph add">${icon('upload')}<input type="file" accept="image/*" id="vs-photo-file" hidden></label></div></div>
      <div><div class="row spread" style="margin-bottom:8px"><p class="eyebrow">Légende prête à poster</p><button type="button" class="btn sm ghost" id="vs-idea">${icon('refresh')}Autre proposition</button></div>
        <textarea class="textarea" id="vs-caption" rows="7">${caption}</textarea>
        <p class="tiny muted" style="margin-top:6px"><span id="vs-count"></span> · Hashtags proposés : ${tags}</p></div>
    </div>
  </div>
  <div class="modal-f" style="flex-wrap:wrap"><button type="button" class="btn" id="vs-copy">${icon('file')}Copier la légende</button>
    <button type="button" class="btn" id="vs-share" hidden>${icon('share')}Partager</button>
    <button type="button" class="btn ${o.onSave ? '' : 'primary'}" id="vs-dl">${icon('download')}Télécharger le PNG</button>
    ${o.onSave ? html`<button type="button" class="btn primary" id="vs-save">${icon('check')}Utiliser ce visuel</button>` : ''}</div>`,
  mount: async (d, close) => {
    const main = $('#vs-main', d), cap = $('#vs-caption', d);
    await fontsReady();
    const draw = () => {
      render(main, st.tpl, .5);
      if (st.mode === 'inspi') $$('.vs-thumb', d).forEach(b => render(b.querySelector('canvas'), b.dataset.tpl, .16));
      const n = cap.value.length; $('#vs-count', d).textContent = `${n} caractères${n > 2200 ? ' (trop long pour Instagram)' : ''}`;
    };
    draw();
    d.addEventListener('input', e => {
      if (e.target.dataset.t) st.texts[e.target.dataset.t] = e.target.value;
      if (e.target.dataset.f) st.free[e.target.dataset.f] = e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'range' ? Number(e.target.value) : e.target.value;
      draw();
    });
    d.addEventListener('change', e => { if (e.target.dataset.f) { st.free[e.target.dataset.f] = e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'range' ? Number(e.target.value) : e.target.value; draw(); } });
    d.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.mode) { st.mode = b.dataset.mode; $$('[data-mode]', d).forEach(x => x.classList.toggle('on', x === b)); $('#vs-inspi', d).hidden = st.mode !== 'inspi'; $('#vs-free', d).hidden = st.mode !== 'free'; draw(); }
      if (b.dataset.tpl) { st.tpl = b.dataset.tpl; $$('.vs-thumb', d).forEach(x => x.classList.toggle('on', x === b)); draw(); }
      if (b.dataset.size) { st.size = b.dataset.size; $$('[data-size]', d).forEach(x => x.classList.toggle('primary', x === b)); draw(); }
      if (b.dataset.pal) { st.pal = b.dataset.pal; $$('.vs-pal', d).forEach(x => x.classList.toggle('on', x === b)); draw(); }
      if ('ph' in b.dataset) {
        try { st.photo = b.dataset.ph ? await loadImage(b.dataset.ph) : null; } catch (err) { return toast(err.message, 'error'); }
        $$('.vs-ph', d).forEach(x => x.classList.toggle('on', x === b));
        if (st.photo && st.mode === 'free') { st.free.bgKind = 'photo'; $('[data-f="bgKind"]', d).value = 'photo'; }
        draw();
      }
    });
    const addPhoto = (src, label) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'vs-ph'; b.dataset.ph = src; b.style.backgroundImage = `url('${src}')`; b.setAttribute('aria-label', label);
      $('#vs-photos', d).insertBefore(b, $('#vs-photos .add', d)); return b;
    };
    $('#vs-photo-file', d).addEventListener('change', e => { const f = e.target.files[0]; if (f) addPhoto(URL.createObjectURL(f), 'Ta photo').click(); });
    $('#vs-inspi-file', d).addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return;
      const src = URL.createObjectURL(f), im = await loadImage(src);
      st.customPal = paletteFrom(im);
      const pb = $('#vs-inspi-pal', d); pb.hidden = false; pb.style.background = `linear-gradient(135deg,${st.customPal.bg} 55%,${st.customPal.accent} 55%)`;
      addPhoto(src, 'Image d\'inspi');
      pb.click();
      $('#vs-inspi-note', d).textContent = `Couleurs extraites : fond ${st.customPal.bg}, accent ${st.customPal.accent}. L'image est aussi dans Photo si tu veux l'utiliser comme fond.`;
    });
    $('#vs-idea', d).onclick = () => { const ideas = captionIdeas(st.texts, o); st.idea = (st.idea + 1) % ideas.length; cap.value = ideas[st.idea].text + '\n\n' + tags; draw(); toast(`Proposition « ${ideas[st.idea].label} »`); };
    cap.addEventListener('input', draw);
    const full = () => new Promise(ok => { const c = document.createElement('canvas'); render(c, st.tpl, 1); c.toBlob(ok, 'image/png'); });
    const fileName = () => `aftr-${(st.texts.title || 'visuel').normalize('NFD').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase().replace(/^-|-$/g, '')}.png`;
    $('#vs-copy', d).onclick = async () => { try { await navigator.clipboard.writeText(cap.value); toast('Légende copiée'); } catch { cap.select(); toast('Sélectionnée : fais Cmd + C'); } };
    $('#vs-dl', d).onclick = async () => {
      let blob; try { blob = await full(); } catch { return toast('Cette photo bloque l\'export : choisis-en une autre ou importe-la.', 'error'); }
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fileName(); a.click(); toast('Image téléchargée');
    };
    const share = $('#vs-share', d);
    if (navigator.canShare?.({ files: [new File([''], 'x.png', { type: 'image/png' })] })) {
      share.hidden = false;
      share.onclick = async () => { const blob = await full(); try { await navigator.share({ files: [new File([blob], fileName(), { type: 'image/png' })], text: cap.value }); } catch {} };
    }
    $('#vs-save', d)?.addEventListener('click', async e => {
      const btn = e.currentTarget; btn.disabled = true;
      try {
        const blob = await full();
        const { url } = await api.upload(new File([blob], fileName(), { type: 'image/png' }));
        o.onSave({ visual_url: url, caption: cap.value }); toast('Visuel ajouté à la publication'); close();
      } catch (err) { toast(err.message || 'Export impossible avec cette photo.', 'error'); btn.disabled = false; }
    });
  } });
}

/** Bloc « kit prêt à poster » : vignette du visuel + actions. */
export function visualBlock(url, captionSel) {
  return html`<div class="vs-kit">${url ? html`<a href="${url}" target="_blank" rel="noopener" class="vs-kit-img" style="background-image:url('${url}')" aria-label="Voir le visuel"></a>` : html`<div class="vs-kit-img empty">${icon('image')}</div>`}
    <div class="stack grow" style="--gap:8px"><b class="small">${url ? 'Visuel prêt' : 'Pas encore de visuel'}</b>
      <span class="tiny muted">${url ? 'Télécharge l\'image et copie la légende, puis publie-les depuis l\'application du réseau.' : 'Crée une image au bon format à partir de modèles ou de zéro, avec une légende prête.'}</span>
      <div class="row" style="flex-wrap:wrap"><button type="button" class="btn sm primary" data-visual>${icon('image')}${url ? 'Modifier le visuel' : 'Créer le visuel'}</button>
        ${url ? html`<a class="btn sm" href="${url}" download>${icon('download')}PNG</a><button type="button" class="btn sm" data-copy-caption="${captionSel}">${icon('file')}Copier la légende</button>` : ''}</div></div></div>`;
}
export function bindCopy(root) {
  root.addEventListener('click', async e => {
    const b = e.target.closest('[data-copy-caption]'); if (!b) return;
    const t = root.querySelector(b.dataset.copyCaption)?.value || '';
    try { await navigator.clipboard.writeText(t); toast('Légende copiée'); } catch { toast('Copie impossible : sélectionne le texte.', 'error'); }
  });
}

/** Dessine un modèle sur un canvas (utilisé par la page Communication pour les visuels des posts). */
export async function drawTemplate(canvas, { tpl = 'affiche', size = 'post', pal = 'nuit', texts = {}, photo = null, scale = 1 } = {}) {
  await fontsReady();
  const im = photo ? await loadImage(img(photo, 1200)).catch(() => null) : null;
  const [W, H] = SIZES[size];
  canvas.width = W * scale; canvas.height = H * scale;
  const ctx = canvas.getContext('2d'); ctx.setTransform(scale, 0, 0, scale, 0, 0);
  TEMPLATES[tpl].draw(ctx, W, H, { kicker: '', title: '', subtitle: '', info: '', handle: '', ...texts }, PALETTES[pal], im);
}
