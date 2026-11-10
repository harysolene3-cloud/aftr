// Set Clipper : analyse audio d'un set vidéo, détection de moments, découpe et export de clips.
// Tout se passe dans le navigateur (Web Audio + Canvas + MediaRecorder) : aucune IA générative,
// aucun service externe. La détection repose sur l'énergie du signal et des basses.
import { html, raw, api, state, icon, fmt, toast, modal, confirmBox, empty, notice, $, $$, on, act } from '../core.js';

const FORMATS = { '9:16': [720, 1280], '1:1': [1080, 1080], '16:9': [1280, 720] };
const KIND = { drop: ['Drop', 'accent'], build: ['Montée', 'warn'], transition: ['Transition', 'info'], peak: ["Pic d'énergie", 'ok'] };
const DEMO_SET = '/demo/set-demo-aftr.mp4';

export async function clipper({ rerender }) {
  const { items: history } = await api.get('/api/studio/clips');
  const hasDemo = await fetch(DEMO_SET, { method: 'HEAD' }).then(r => r.ok).catch(() => false);
  return { title: 'Set Clipper', html: html`
  <div class="view-h"><div><p class="eyebrow accent">Business Studio</p><h1>Set Clipper</h1><p>Importe la vidéo d'un set : AFTR analyse l'énergie audio, repère les drops, montées et transitions, puis découpe de vrais clips MP4 pour Instagram, TikTok ou YouTube.</p></div></div>
  <div class="stack" style="--gap:12px;margin-bottom:18px">
    ${notice('Détection automatique, pas d\'IA générative.', 'Les moments sont repérés par une analyse du signal audio (volume, basses, changements de texture). Les légendes proposées sont générées par des modèles de texte, sans intelligence artificielle.', 'info')}
    ${notice('Droits musicaux.', 'Publie uniquement des clips dont tu détiens les droits ou l\'autorisation : les réseaux peuvent bloquer un extrait contenant la musique d\'autres artistes.', 'shield')}
  </div>

  <section id="step-import">
    <label class="dropzone" id="drop">${icon('upload')}<b style="font-size:18px">Glisse la vidéo de ton set ici</b><span class="muted">ou clique pour choisir un fichier · MP4, MOV ou WebM · 20 minutes maximum conseillé</span>
      <input type="file" id="file" accept="video/*" hidden></label>
    <div class="row" style="justify-content:center;margin-top:14px">
      ${hasDemo ? html`<button class="btn" id="load-demo">${icon('play')}Charger le set de démonstration (musique synthétique libre de droits)</button>` : ''}
      <button class="btn ghost" id="gen-demo">${icon('sparkle')}Générer un set de test (45 s)</button>
    </div>
  </section>

  <section id="step-edit" hidden>
    <div class="clipper-stage">
      <div class="stack" style="--gap:14px">
        <div class="video-box" id="vbox"><video id="video" playsinline controls></video><div class="crop-guide" id="guide" hidden></div></div>
        <div class="row spread"><div class="small muted" id="file-info"></div><button class="btn sm ghost" id="change">${icon('refresh')}Changer de vidéo</button></div>
        <div class="card stack" style="--gap:10px">
          <div class="row spread"><h3 style="font-size:16px">Énergie du set</h3><div class="legend"><span><i style="background:var(--text)"></i>Volume</span><span><i style="background:var(--accent)"></i>Basses</span></div></div>
          <div class="energy" id="energy" title="Clique pour te déplacer dans la vidéo"><canvas id="energy-canvas"></canvas></div>
          <div id="analyse-box"><button class="btn primary" id="analyse">${icon('zap')}Analyser le set</button><span class="small muted" id="analyse-status" style="margin-left:10px"></span></div>
        </div>
      </div>
      <aside class="stack" style="--gap:14px">
        <div class="card stack" style="--gap:12px">
          <h3 style="font-size:16px">Moments détectés</h3>
          <div class="stack" id="moments" style="--gap:8px"><p class="small muted">Lance l'analyse pour repérer les moments forts.</p></div>
        </div>
      </aside>
    </div>

    <div class="card stack" id="export-panel" style="--gap:16px;margin-top:20px" hidden>
      <div class="row spread"><h3 style="font-size:18px">Clip sélectionné</h3><span class="mono" id="sel-info"></span></div>
      <div class="form-grid" style="grid-template-columns:repeat(4,minmax(0,1fr))">
        <label class="field"><span>Début (s)</span><input class="input" type="number" step="0.5" min="0" id="start"></label>
        <label class="field"><span>Fin (s)</span><input class="input" type="number" step="0.5" min="0" id="end"></label>
        <div class="field"><span class="label">Format</span><div class="seg" id="format">${Object.keys(FORMATS).map((k, i) => html`<button type="button" data-f="${k}" class="${i === 0 ? 'on' : ''}">${k}</button>`)}</div></div>
        <label class="field"><span>Cadrage horizontal</span><input type="range" id="pos" min="0" max="100" value="50"></label>
        <label class="field" style="grid-column:span 2"><span>Texte en surimpression</span><input class="input" id="overlay" value="${state.me.dj?.stage_name || ''}"></label>
        <label class="check" style="align-self:end"><input type="checkbox" id="brand" checked><span>Signature AFTR</span></label>
        <label class="check" style="align-self:end"><input type="checkbox" id="fade" checked><span>Fondus d'entrée et de sortie</span></label>
      </div>
      <div class="row"><button class="btn" id="preview">${icon('play')}Prévisualiser l'extrait</button><button class="btn primary" id="export">${icon('scissors')}Découper et exporter le clip</button><span class="small muted" id="export-status"></span></div>
      <div class="progress" id="progress" hidden><div style="width:0"></div></div>
      <div id="result"></div>
    </div>
  </section>

  <section style="margin-top:30px">
    <h2 class="eyebrow" style="margin-bottom:12px">Mes clips exportés</h2>
    ${history.length ? html`<div class="grid auto-fill" style="--min:220px">${history.map(c => html`<div class="card flush">
      ${c.file ? html`<video src="${c.file}" controls preload="metadata" style="width:100%;aspect-ratio:${c.format.replace(':', '/')};max-height:320px;background:#000;object-fit:contain"></video>` : ''}
      <div class="stack" style="padding:12px;--gap:6px"><b class="truncate">${c.title}</b><span class="tiny muted">${c.format} · ${fmt.tc(c.end_s - c.start_s)} · ${c.size ? fmt.bytes(c.size) : ''} · ${fmt.dayMonth(c.created_at)}</span>
        <div class="row">${c.file ? html`<a class="btn sm" href="${c.file}" download="${c.title}.${(c.mime || '').includes('mp4') ? 'mp4' : 'webm'}">${icon('download')}Télécharger</a>` : ''}<button class="btn sm ghost danger" data-del="${c.id}" aria-label="Supprimer">${icon('trash')}</button></div></div></div>`)}</div>`
      : html`<p class="small muted">Aucun clip pour l'instant.</p>`}
  </section>`,
  mount: v => mountClipper(v, rerender) };
}

function mountClipper(v, rerender) {
  const video = $('#video', v), canvas = $('#energy-canvas', v);
  let file = null, url = null, analysis = null, moments = [], selected = null, format = '9:16';

  on(v, 'click', '[data-del]', async (e, b) => { if (await confirmBox('Supprimer ce clip de ton historique ?', { ok: 'Supprimer', danger: true })) { await api.del('/api/studio/clips/' + b.dataset.del); rerender(); } });

  // ── Import
  const load = (f, label) => {
    if (!f.type.startsWith('video/')) return toast('Ce fichier n\'est pas une vidéo.', 'error');
    file = f; if (url) URL.revokeObjectURL(url); url = URL.createObjectURL(f);
    video.src = url; analysis = null; moments = []; selected = null;
    $('#step-import', v).hidden = true; $('#step-edit', v).hidden = false; $('#export-panel', v).hidden = true;
    $('#moments', v).innerHTML = '<p class="small muted">Lance l\'analyse pour repérer les moments forts.</p>';
    video.onloadedmetadata = () => { $('#file-info', v).textContent = `${label || f.name} · ${fmt.tc(video.duration)} · ${video.videoWidth}×${video.videoHeight} · ${fmt.bytes(f.size)}`; drawEnergy(); };
  };
  const input = $('#file', v), drop = $('#drop', v);
  input.onchange = () => input.files[0] && load(input.files[0]);
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); e.dataTransfer.files[0] && load(e.dataTransfer.files[0]); });
  $('#change', v).onclick = () => { $('#step-import', v).hidden = false; $('#step-edit', v).hidden = true; video.pause(); };
  $('#load-demo', v)?.addEventListener('click', async e => {
    const b = e.currentTarget; b.disabled = true;
    const blob = await (await fetch(DEMO_SET)).blob();
    load(new File([blob], 'set-demo-aftr.mp4', { type: blob.type || 'video/mp4' }), 'Set de démonstration AFTR (son synthétique)');
    b.disabled = false;
  });
  $('#gen-demo', v).onclick = async e => {
    const b = e.currentTarget; b.disabled = true;
    try {
      const blob = await generateTestSet(s => { b.textContent = s; });
      load(new File([blob], 'set-test-aftr.' + (blob.type.includes('mp4') ? 'mp4' : 'webm'), { type: blob.type }), 'Set de test généré (son synthétique)');
    } catch (err) { toast(err.message, 'error'); }
    b.disabled = false; b.innerHTML = icon('sparkle').s + 'Générer un set de test (45 s)';
  };

  // ── Analyse audio
  $('#analyse', v).onclick = async e => {
    const b = e.currentTarget, status = $('#analyse-status', v);
    b.disabled = true;
    try {
      status.textContent = 'Lecture de la piste audio…';
      const buf = await file.arrayBuffer();
      status.textContent = 'Décodage…';
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const audio = await ctx.decodeAudioData(buf);
      ctx.close();
      status.textContent = 'Calcul de l\'énergie…';
      await new Promise(r => setTimeout(r, 30));
      analysis = analyse(audio);
      moments = detect(analysis, audio.duration);
      status.textContent = `${moments.length} moment${moments.length > 1 ? 's' : ''} détecté${moments.length > 1 ? 's' : ''} sur ${fmt.tc(audio.duration)}.`;
      drawEnergy(); renderMoments();
      if (moments[0]) select(0);
    } catch (err) {
      console.error(err);
      status.textContent = '';
      toast("Impossible de lire la piste audio de cette vidéo. Essaie un MP4 (H.264/AAC) ou un WebM.", 'error');
    }
    b.disabled = false; b.innerHTML = icon('refresh').s + 'Relancer l\'analyse';
  };

  function drawEnergy() {
    const r = canvas.getBoundingClientRect(), dpr = devicePixelRatio || 1;
    canvas.width = r.width * dpr; canvas.height = r.height * dpr;
    const g = canvas.getContext('2d'); g.scale(dpr, dpr);
    const W = r.width, H = r.height, css = getComputedStyle(document.documentElement);
    g.clearRect(0, 0, W, H);
    if (!analysis) { g.fillStyle = css.getPropertyValue('--faint'); g.font = '13px sans-serif'; g.fillText('La courbe d\'énergie apparaîtra après l\'analyse.', 14, H / 2 + 4); return; }
    const n = analysis.energy.length, bw = W / n;
    g.fillStyle = css.getPropertyValue('--text');
    analysis.energy.forEach((e, i) => { const h = e * (H - 16); g.fillRect(i * bw, H - h, Math.max(1, bw - .5), h); });
    g.fillStyle = css.getPropertyValue('--accent'); g.globalAlpha = .85;
    analysis.bass.forEach((e, i) => { const h = e * (H - 16) * .7; g.fillRect(i * bw, H - h, Math.max(1, bw - .5), h); });
    g.globalAlpha = 1;
    const dur = analysis.duration;
    moments.forEach((m, i) => {
      const x1 = m.start / dur * W, x2 = m.end / dur * W;
      g.fillStyle = i === selected ? 'rgba(255,210,63,.28)' : 'rgba(127,163,255,.16)'; g.fillRect(x1, 0, x2 - x1, H);
      g.fillStyle = i === selected ? css.getPropertyValue('--accent') : css.getPropertyValue('--info'); g.fillRect(m.t / dur * W - 1, 0, 2, H);
      g.font = '600 10px JetBrains Mono, monospace'; g.fillText(String(i + 1), m.t / dur * W + 4, 12);
    });
    const px = video.currentTime / dur * W; g.fillStyle = css.getPropertyValue('--bad'); g.fillRect(px - 1, 0, 2, H);
  }
  video.addEventListener('timeupdate', () => analysis && drawEnergy());
  window.addEventListener('resize', drawEnergy);
  $('#energy', v).addEventListener('click', e => { if (!analysis) return; const r = e.currentTarget.getBoundingClientRect(); video.currentTime = (e.clientX - r.left) / r.width * analysis.duration; });

  function renderMoments() {
    $('#moments', v).innerHTML = moments.length ? moments.map((m, i) => html`<div class="moment ${i === selected ? 'on' : ''}" data-m="${i}" tabindex="0" role="button">
      <span class="chip ${KIND[m.kind][1]}">${i + 1} · ${KIND[m.kind][0]}</span>
      <div><div class="tc">${fmt.tc(m.t)}</div><div class="tiny muted">Clip ${fmt.tc(m.start)} → ${fmt.tc(m.end)} · ${Math.round(m.end - m.start)} s</div></div>
      <span class="mono tiny" title="Intensité">${'▮'.repeat(Math.max(1, Math.round(m.score * 5)))}</span></div>`.s).join('')
      : '<p class="small muted">Aucun moment marquant détecté : le set est peut-être trop court ou trop régulier.</p>';
  }
  on(v, 'click', '[data-m]', (e, el) => select(Number(el.dataset.m)));
  on(v, 'keydown', '[data-m]', (e, el) => e.key === 'Enter' && select(Number(el.dataset.m)));

  function select(i) {
    selected = i; const m = moments[i];
    $('#start', v).value = m.start.toFixed(1); $('#end', v).value = m.end.toFixed(1);
    $('#export-panel', v).hidden = false; $('#result', v).innerHTML = '';
    video.currentTime = m.start;
    updateSel(); renderMoments(); drawEnergy();
  }
  const range = () => { const s = Math.max(0, Number($('#start', v).value)), en = Math.min(video.duration, Number($('#end', v).value)); return [s, en]; };
  function updateSel() {
    const [s, e] = range();
    $('#sel-info', v).textContent = `${fmt.tc(s)} → ${fmt.tc(e)} · ${(e - s).toFixed(1)} s · ${format}`;
    if (moments[selected]) { moments[selected].start = s; moments[selected].end = e; drawEnergy(); }
    // Guide de cadrage sur la vidéo
    const guide = $('#guide', v), [fw, fh] = FORMATS[format];
    const box = $('#vbox', v).getBoundingClientRect(), vr = video.videoWidth / video.videoHeight, br = box.width / box.height;
    const dispW = vr > br ? box.width : box.height * vr, dispH = vr > br ? box.width / vr : box.height;
    const target = fw / fh;
    if (format === '16:9' && Math.abs(target - vr) < .02) { guide.hidden = true; return; }
    guide.hidden = false;
    const gw = target < vr ? dispH * target : dispW, gh = target < vr ? dispH : dispW / target;
    const pos = Number($('#pos', v).value) / 100;
    guide.style.width = gw + 'px'; guide.style.height = gh + 'px'; guide.style.top = (box.height - gh) / 2 + 'px'; guide.style.bottom = 'auto';
    guide.style.left = (box.width - dispW) / 2 + (dispW - gw) * pos + 'px'; guide.style.transform = 'none';
  }
  ['#start', '#end', '#pos'].forEach(s => $(s, v).addEventListener('input', updateSel));
  on(v, 'click', '#format [data-f]', (e, b) => { format = b.dataset.f; $$('#format [data-f]', v).forEach(x => x.classList.toggle('on', x === b)); updateSel(); });

  $('#preview', v).onclick = () => {
    const [s, e] = range(); video.currentTime = s; video.play();
    const stop = () => { if (video.currentTime >= e) { video.pause(); video.removeEventListener('timeupdate', stop); } };
    video.addEventListener('timeupdate', stop);
  };

  // ── Export réel : Canvas + MediaRecorder
  $('#export', v).onclick = async e => {
    const btn = e.currentTarget, [s, en] = range();
    if (en - s < 2) return toast('Le clip doit durer au moins 2 secondes.', 'error');
    if (en - s > 90) return toast('90 secondes maximum par clip.', 'error');
    btn.disabled = true; video.pause();
    const prog = $('#progress', v), bar = prog.firstElementChild, status = $('#export-status', v);
    prog.hidden = false; status.textContent = 'Préparation…';
    try {
      const m = moments[selected];
      const blob = await renderClip({ url, start: s, end: en, format, pos: Number($('#pos', v).value) / 100, overlay: $('#overlay', v).value, brand: $('#brand', v).checked, fade: $('#fade', v).checked },
        p => { bar.style.width = (p * 100).toFixed(0) + '%'; status.textContent = `Rendu en cours… ${Math.round(p * 100)} % (garde cet onglet visible)`; });
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
      const name = `${(state.me.dj?.stage_name || 'clip').replace(/\W+/g, '-')}-${KIND[m.kind][0].replace(/\W+/g, '').toLowerCase()}-${fmt.tc(s).replace(':', 'm')}-${format.replace(':', 'x')}`;
      const out = URL.createObjectURL(blob);
      status.textContent = 'Enregistrement dans ton historique…';
      // Le clip est déjà prêt sur l'appareil. Le stocker sur AFTR est un plus : la version en ligne (Vercel) refuse les fichiers de plus de 4,5 Mo.
      let up = null, upErr = '';
      try { up = await api.upload(new File([blob], `${name}.${ext}`, { type: blob.type })); } catch (err) { upErr = err.message; }
      const caps = captions(m.kind);
      const { id: clipId } = await api.post('/api/studio/clips', { title: name, source_name: file.name, start_s: s, end_s: en, format, moment_kind: m.kind, file: up?.url || null, mime: blob.type, size: blob.size, caption: caps[0].text });
      status.textContent = '';
      $('#result', v).innerHTML = html`<div class="grid g2" style="margin-top:6px">
        <div class="stack" style="--gap:10px"><video src="${out}" controls autoplay muted playsinline style="width:100%;max-height:480px;background:#000;border-radius:var(--r);object-fit:contain"></video>
          <div class="row"><a class="btn primary" href="${out}" download="${name}.${ext}">${icon('download')}Télécharger le ${ext.toUpperCase()}</a><span class="small muted">${fmt.bytes(blob.size)} · ${FORMATS[format].join('×')} · ${ext === 'mp4' ? 'MP4 (H.264)' : 'WebM : ton navigateur ne sait pas produire de MP4'}</span></div></div>
        <div class="stack" style="--gap:10px"><div class="row spread"><h3 style="font-size:16px">Idées de publication</h3><span class="tiny muted">Modèles de texte, sans IA</span></div>
          ${caps.map(c => html`<div class="panel stack" style="--gap:6px"><span class="eyebrow">${c.network}</span><p style="white-space:pre-wrap">${c.text}</p><p class="mono small" style="color:var(--accent-text)">${c.tags}</p><button class="btn sm" data-copy="${c.text}\n\n${c.tags}" style="justify-self:start">Copier</button></div>`)}
          ${up ? html`<p class="tiny muted">Clip enregistré dans ton historique ci-dessous.</p>` : html`<p class="notice">${icon('info')}<span><b>Clip prêt, mais pas stocké sur AFTR.</b> ${upErr} Télécharge-le avec le bouton à gauche : il reste dans l'historique, sans fichier.</span></p>`}
          <button class="btn primary" data-plan style="justify-self:start">${icon('calendar')}Programmer ce clip dans Ma com'</button></div></div>`.s;
      $('[data-plan]', v).onclick = async ev => {
        const btn = ev.currentTarget;
        await act(btn, () => api.post('/api/studio/posts', { network: format === '16:9' ? 'YouTube' : 'TikTok', format: format === '16:9' ? 'Vidéo courte' : format === '1:1' ? 'Reel' : 'Vidéo courte', title: `${KIND[m.kind][0]} — ${file.name.replace(/\.[^.]+$/, '')}`, caption: `${caps[1].text}\n\n${caps[1].tags}`, clip_id: clipId, status: 'planned', planned_date: new Date(Date.now() + 864e5).toISOString().slice(0, 10) }), 'Publication programmée pour demain dans Ma com\'');
        btn.outerHTML = '<a class="btn" href="/app/studio/marketing/publications?statut=planned">Voir dans Ma com\' →</a>';
      };
      toast('Clip exporté');
    } catch (err) { console.error(err); toast(err.message || 'Échec de l\'export.', 'error'); status.textContent = ''; }
    prog.hidden = true; bar.style.width = 0; btn.disabled = false;
  };
  on(v, 'click', '[data-copy]', async (e, b) => { try { await navigator.clipboard.writeText(b.dataset.copy); toast('Texte copié'); } catch { toast('Copie impossible : sélectionne le texte à la main.', 'error'); } });
  setTimeout(drawEnergy, 50);
}

// ───────── Analyse du signal
function analyse(audio) {
  const sr = audio.sampleRate, n = audio.length, chans = Math.min(2, audio.numberOfChannels);
  const data = Array.from({ length: chans }, (_, c) => audio.getChannelData(c));
  const hop = Math.round(sr * 0.5); // fenêtres de 0,5 s
  const a = 1 - Math.exp(-2 * Math.PI * 150 / sr); // passe-bas ~150 Hz pour les basses / kicks
  let lp = 0;
  const energy = [], bass = [], zcr = [];
  for (let start = 0; start < n; start += hop) {
    let sum = 0, bsum = 0, cross = 0, prev = 0;
    const end = Math.min(n, start + hop);
    for (let i = start; i < end; i++) {
      let x = 0; for (let c = 0; c < chans; c++) x += data[c][i]; x /= chans;
      lp += a * (x - lp);
      sum += x * x; bsum += lp * lp;
      if ((x >= 0) !== (prev >= 0)) cross++; prev = x;
    }
    const len = end - start;
    energy.push(Math.sqrt(sum / len)); bass.push(Math.sqrt(bsum / len)); zcr.push(cross / len);
  }
  const norm = arr => { const s = [...arr].sort((x, y) => x - y), p = s[Math.floor(s.length * .97)] || 1; return arr.map(v => Math.min(1, v / (p || 1))); };
  return { energy: norm(energy), bass: norm(bass), zcr: norm(zcr), step: 0.5, duration: audio.duration };
}

function detect({ energy, bass, zcr, step, duration }) {
  const N = energy.length, w = s => Math.round(s / step);
  const mean = (arr, a, b) => { a = Math.max(0, a); b = Math.min(arr.length, b); if (b <= a) return 0; let s = 0; for (let i = a; i < b; i++) s += arr[i]; return s / (b - a); };
  const cands = [];
  for (let i = w(4); i < N - w(2); i++) {
    // Drop : les basses reviennent fortement après une section plus pauvre en basses
    const pre = mean(bass, i - w(8), i - w(1)), post = mean(bass, i, i + w(4));
    const dropScore = post - pre;
    if (post > .5 && pre < post * .6 && dropScore > .25) cands.push({ t: i * step, kind: 'drop', score: Math.min(1, dropScore * 1.4) });
    // Montée : énergie qui grimpe régulièrement sur ~12 s
    const L = w(12);
    if (i + L < N) {
      let rising = 0; for (let k = 1; k <= 6; k++) if (mean(energy, i + (k - 1) * L / 6, i + k * L / 6) > mean(energy, i + (k - 2) * L / 6, i + (k - 1) * L / 6)) rising++;
      const gain = mean(energy, i + L - w(3), i + L) - mean(energy, i, i + w(3));
      if (rising >= 5 && gain > .18) cands.push({ t: i * step, kind: 'build', score: Math.min(1, gain * 2) });
    }
    // Transition : changement de texture sonore (équilibre basses / aigus) sans saut de volume
    const W = w(10);
    if (i > W && i + W < N) {
      const ratio = (a, b) => mean(bass, a, b) / (mean(energy, a, b) + 1e-3);
      const nov = Math.abs(ratio(i - W, i) - ratio(i, i + W)) + Math.abs(mean(zcr, i - W, i) - mean(zcr, i, i + W));
      const vol = Math.abs(mean(energy, i - W, i) - mean(energy, i, i + W));
      if (nov > .3 && vol < .2) cands.push({ t: i * step, kind: 'transition', score: Math.min(1, nov) });
    }
    // Pic d'énergie soutenu
    const sustained = mean(energy, i, i + w(8));
    if (sustained > .82) cands.push({ t: i * step, kind: 'peak', score: sustained * .8 });
  }
  // Garde le meilleur candidat par zone de 20 s
  cands.sort((a, b) => b.score - a.score || (a.kind === 'drop' ? -1 : 1));
  const picked = [];
  for (const c of cands) if (!picked.some(p => Math.abs(p.t - c.t) < 20) && picked.length < 8) picked.push(c);
  const span = { drop: [-6, 12], build: [0, 20], transition: [-8, 12], peak: [-4, 16] };
  return picked.sort((a, b) => a.t - b.t).map(m => {
    let [s, e] = span[m.kind].map(d => m.t + d);
    if (s < 0) { e -= s; s = 0; } if (e > duration) { s = Math.max(0, s - (e - duration)); e = duration; }
    return { ...m, start: Math.round(s * 2) / 2, end: Math.round(e * 2) / 2 };
  });
}

// ───────── Rendu du clip
function pickMime() {
  const list = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return list.find(t => window.MediaRecorder?.isTypeSupported(t));
}

async function renderClip({ url, start, end, format, pos, overlay, brand, fade }, onProgress) {
  if (!window.MediaRecorder) throw new Error("Ce navigateur ne permet pas l'export vidéo. Utilise Chrome, Edge ou Safari récent.");
  const mime = pickMime();
  const [W, H] = FORMATS[format];
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const vid = document.createElement('video');
  vid.src = url; vid.playsInline = true; vid.preload = 'auto'; vid.crossOrigin = 'anonymous';
  await new Promise((res, rej) => { vid.onloadedmetadata = res; vid.onerror = () => rej(new Error('Lecture de la vidéo impossible.')); });
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  const src = ac.createMediaElementSource(vid), dest = ac.createMediaStreamDestination();
  src.connect(dest);
  const stream = new MediaStream([...cv.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5_000_000, audioBitsPerSecond: 160_000 });
  const chunks = [];
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  await document.fonts.load('900 64px "Big Shoulders Display"').catch(() => null);

  vid.currentTime = start;
  await new Promise(r => vid.addEventListener('seeked', r, { once: true }));
  const vw = vid.videoWidth, vh = vid.videoHeight, target = W / H, srcRatio = vw / vh;
  let sx = 0, sy = 0, sw = vw, sh = vh;
  if (target < srcRatio) { sw = vh * target; sx = (vw - sw) * pos; } else { sh = vw / target; sy = (vh - sh) / 2; }
  const dur = end - start;

  const draw = () => {
    g.drawImage(vid, sx, sy, sw, sh, 0, 0, W, H);
    const t = vid.currentTime - start;
    if (overlay) {
      const grd = g.createLinearGradient(0, H * .62, 0, H); grd.addColorStop(0, 'rgba(10,10,14,0)'); grd.addColorStop(1, 'rgba(10,10,14,.75)');
      g.fillStyle = grd; g.fillRect(0, H * .62, W, H * .38);
      const size = Math.round(W * (format === '16:9' ? .075 : .13));
      g.font = `900 ${size}px "Big Shoulders Display", Impact, sans-serif`; g.fillStyle = '#fff'; g.textBaseline = 'alphabetic';
      g.fillText(overlay.toUpperCase(), W * .06, H - H * .07);
    }
    if (brand) {
      const s = Math.round(W * .045); g.font = `900 ${s}px "Big Shoulders Display", Impact, sans-serif`;
      const tw = g.measureText('AFTR').width;
      g.fillStyle = '#FFD23F'; g.beginPath(); g.roundRect?.(W * .05 - s * .25, H * .04, tw + s * .5, s * 1.25, s * .25); g.fill();
      g.fillStyle = '#121318'; g.fillText('AFTR', W * .05, H * .04 + s * 1.02);
    }
    if (fade) { const a = Math.max(0, 1 - t / .4, 1 - (dur - t) / .4); if (a > 0) { g.fillStyle = `rgba(0,0,0,${Math.min(1, a)})`; g.fillRect(0, 0, W, H); } }
    onProgress(Math.min(1, Math.max(0, t / dur)));
  };

  return new Promise((resolve, reject) => {
    let done = false;
    const finish = () => { if (done) return; done = true; vid.pause(); rec.stop(); };
    rec.onstop = () => { ac.close(); resolve(new Blob(chunks, { type: mime.split(';')[0] })); };
    rec.onerror = e => reject(e.error || new Error('Erreur pendant l\'enregistrement.'));
    const loop = () => {
      if (done) return;
      draw();
      if (vid.currentTime >= end || vid.ended) return finish();
      if (vid.requestVideoFrameCallback) vid.requestVideoFrameCallback(loop); else requestAnimationFrame(loop);
    };
    draw();
    rec.start(250);
    vid.play().then(loop).catch(reject);
    setTimeout(finish, (dur + 5) * 1000); // garde-fou
  });
}

// ───────── Propositions de légendes (modèles de texte, sans IA)
function captions(kind) {
  const dj = state.me.dj || {}, style = dj.styles?.[0] || 'house', city = state.me.city || '';
  const tag = s => '#' + s.replace(/[^\p{L}\p{N}]/gu, '');
  const base = [tag(style), '#DJ', '#DJlife', city ? tag(city) : null, '#AFTR'].filter(Boolean).join(' ');
  const hooks = { drop: 'Attends le drop… 🔊', build: 'La montée qui fait lever les bras 🙌', transition: 'Une transition, deux ambiances 🎛️', peak: 'Le moment où la salle a basculé 🔥' };
  return [
    { network: 'Instagram · Reel', text: `${hooks[kind]}\n${style} ${city ? `à ${city} ` : ''}— extrait de mon dernier set.\nTu veux ce son à ta soirée ? Lien en bio.`, tags: base + ' #Reels' },
    { network: 'TikTok', text: `POV : tu es dans la salle quand ${kind === 'drop' ? 'le drop tombe' : kind === 'build' ? 'la montée démarre' : 'tout bascule'} 😮‍💨`, tags: base + ' #DJTok #Mix' },
    { network: 'Idée de publication', text: `Carrousel « avant / après » : 1) photo de la salle calme, 2) ce clip, 3) la date de ta prochaine soirée. Publier en fin de semaine, entre 18 h et 20 h.`, tags: base },
  ];
}

// ───────── Générateur de set de test (son synthétique, donc libre de droits)
export async function generateTestSet(onStatus = () => {}) {
  const mime = pickMime();
  if (!mime) throw new Error("Ce navigateur ne permet pas l'enregistrement vidéo.");
  const DUR = 45, BPM = 124, beat = 60 / BPM;
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  const dest = ac.createMediaStreamDestination(), master = ac.createGain(); master.gain.value = .8; master.connect(dest);
  const analyser = ac.createAnalyser(); analyser.fftSize = 256; master.connect(analyser);
  const noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const T0 = ac.currentTime + .3;
  const kick = (t, v = 1) => { const o = ac.createOscillator(), gn = ac.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + .14); gn.gain.setValueAtTime(v, t); gn.gain.exponentialRampToValueAtTime(.001, t + .4); o.connect(gn).connect(master); o.start(t); o.stop(t + .42); };
  const hat = (t, v = .18) => { const s = ac.createBufferSource(), f = ac.createBiquadFilter(), gn = ac.createGain(); s.buffer = noise; f.type = 'highpass'; f.frequency.value = 8000; gn.gain.setValueAtTime(v, t); gn.gain.exponentialRampToValueAtTime(.001, t + .05); s.connect(f).connect(gn).connect(master); s.start(t, Math.random() * .5, .06); };
  const snare = (t, v = .3) => { const s = ac.createBufferSource(), f = ac.createBiquadFilter(), gn = ac.createGain(); s.buffer = noise; f.type = 'bandpass'; f.frequency.value = 1800; gn.gain.setValueAtTime(v, t); gn.gain.exponentialRampToValueAtTime(.001, t + .12); s.connect(f).connect(gn).connect(master); s.start(t, Math.random() * .5, .14); };
  const bassNote = (t, f0, v = .35) => { const o = ac.createOscillator(), fl = ac.createBiquadFilter(), gn = ac.createGain(); o.type = 'sawtooth'; o.frequency.value = f0; fl.type = 'lowpass'; fl.frequency.value = 380; gn.gain.setValueAtTime(v, t); gn.gain.exponentialRampToValueAtTime(.001, t + beat * .45); o.connect(fl).connect(gn).connect(master); o.start(t); o.stop(t + beat * .5); };
  const pad = (t, d) => [220, 261.6, 329.6].forEach(f => { const o = ac.createOscillator(), gn = ac.createGain(), fl = ac.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = Math.random() * 14 - 7; fl.type = 'lowpass'; fl.frequency.value = 900; gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(.05, t + 1.5); gn.gain.linearRampToValueAtTime(0, t + d); o.connect(fl).connect(gn).connect(master); o.start(t); o.stop(t + d); });
  // Structure : groove (0-14 s), breakdown (14-24 s), montée (24-31 s), drop (31-45 s)
  for (let t = 0; t < DUR; t += beat) {
    const at = T0 + t, b = Math.round(t / beat);
    if (t < 14) { kick(at, .8); hat(at + beat / 2, .12); if (b % 2) bassNote(at + beat / 2, 55, .2); }
    else if (t < 24) { if (b % 8 === 0) pad(at, beat * 8); hat(at + beat / 2, .05); }
    else if (t < 31) { const p = (t - 24) / 7; snare(at, .12 + p * .3); if (p > .4) snare(at + beat / 2, .1 + p * .3); if (p > .75) { snare(at + beat / 4, .3); snare(at + beat * .75, .3); } }
    else { kick(at, 1); hat(at + beat / 2, .22); hat(at + beat / 4, .08); bassNote(at + beat / 2, b % 4 < 2 ? 55 : 65.4, .45); if (b % 2) snare(at, .25); }
  }
  // Bruit montant pendant la montée
  const riser = ac.createBufferSource(), rf = ac.createBiquadFilter(), rg = ac.createGain();
  riser.buffer = noise; riser.loop = true; rf.type = 'bandpass'; rf.frequency.setValueAtTime(400, T0 + 24); rf.frequency.exponentialRampToValueAtTime(9000, T0 + 31);
  rg.gain.setValueAtTime(0, T0 + 24); rg.gain.linearRampToValueAtTime(.25, T0 + 30.8); rg.gain.setValueAtTime(0, T0 + 31);
  riser.connect(rf).connect(rg).connect(master); riser.start(T0 + 24); riser.stop(T0 + 31.2);

  const W = 1280, H = 720, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), freq = new Uint8Array(analyser.frequencyBinCount);
  await document.fonts.load('900 64px "Big Shoulders Display"').catch(() => null);
  const stream = new MediaStream([...cv.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 3_000_000 });
  const chunks = []; rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  rec.start(500);
  return new Promise(resolve => {
    rec.onstop = () => { ac.close(); resolve(new Blob(chunks, { type: mime.split(';')[0] })); };
    const frame = () => {
      const t = ac.currentTime - T0;
      analyser.getByteFrequencyData(freq);
      const lvl = freq.slice(0, 8).reduce((a, b) => a + b, 0) / 8 / 255;
      g.fillStyle = '#0D0E12'; g.fillRect(0, 0, W, H);
      const hue = t < 14 ? 220 : t < 24 ? 260 : t < 31 ? 30 : 48;
      for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(W / 2, H / 2, 60 + i * 70 + lvl * 120, 0, Math.PI * 2); g.strokeStyle = `hsla(${hue},90%,60%,${.5 - i * .07})`; g.lineWidth = 6 + lvl * 20; g.stroke(); }
      for (let i = 0; i < freq.length; i++) { const h = freq[i] / 255 * 220; g.fillStyle = `hsla(${hue},90%,60%,.9)`; g.fillRect(i * (W / freq.length), H - h, W / freq.length - 2, h); }
      g.fillStyle = '#FFD23F'; g.font = '900 64px "Big Shoulders Display", Impact, sans-serif'; g.fillText('AFTR · SET DE TEST', 48, 90);
      g.fillStyle = '#fff'; g.font = '500 26px "JetBrains Mono", monospace';
      g.fillText(`${fmt.tc(Math.max(0, t))} · ${t < 14 ? 'GROOVE' : t < 24 ? 'BREAKDOWN' : t < 31 ? 'MONTÉE' : 'DROP'} · ${BPM} BPM · son synthétique libre de droits`, 48, 140);
      onStatus(`Génération… ${Math.min(100, Math.round(t / DUR * 100))} %`);
      if (t < DUR) requestAnimationFrame(frame); else rec.stop();
    };
    frame();
  });
}
