// Composants partagés entre le site public et l'application.
import { html, raw, icon, bg, fmt, waveform, avatar, stars, chip, BOOKING, img, toast } from '../core.js';

export function djCard(d, href) {
  return html`<a class="dj-card" href="${href}" aria-label="${d.stage_name}, ${d.city}">
    <div class="ph" ${bg(d.photo, 700)}></div>
    <div class="top"><span class="demo-badge">${d.is_demo === 0 ? 'Profil réel' : 'Profil fictif'}</span>${d.price_min ? html`<span class="price">dès ${fmt.eur(d.price_min)}</span>` : ''}</div>
    <div class="body">
      <div class="meta">${icon('pin', '')}<span>${d.city || '—'}</span>${d.rating ? html`<span>★ ${d.rating} (${d.reviews})</span>` : ''}${d.experience_years ? html`<span>${d.experience_years} ans</span>` : ''}</div>
      <div class="name">${d.stage_name}</div>
      <div style="color:${d.accent || 'var(--accent)'}">${waveform(d.slug, 40)}</div>
      <div class="tags">${d.styles.slice(0, 3).map(s => html`<span class="tag">${s}</span>`)}</div>
    </div>
  </a>`;
}

export function availability(days) {
  const first = new Date(days[0].date + 'T12:00:00').getDay();
  const pad = (first + 6) % 7;
  return html`<div class="avail">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(d => html`<div class="dow">${d}</div>`)}
    ${Array.from({ length: pad }, () => html`<div class="dow"></div>`)}
    ${days.slice(0, 35).map(d => html`<div class="${d.busy ? 'busy' : ''}" title="${fmt.date(d.date)} : ${d.busy ? 'indisponible' : 'disponible'}">${Number(d.date.slice(8))}</div>`)}</div>
    <div class="legend" style="margin-top:10px"><span><i style="background:var(--ok-soft)"></i>Disponible</span><span><i style="background:var(--surface-2)"></i>Indisponible</span></div>`;
}

export function djProfileBody(dj, { actions = '' } = {}) {
  return html`
  <section class="profile-cover">
    <div class="ph" ${bg(dj.cover || dj.photo, 1800)}></div>
    <div class="inner wrap">
      <div class="row" style="margin-bottom:14px"><span class="demo-badge">${dj.is_demo === 0 ? 'Profil réel · espace de démonstration' : 'Profil fictif · démonstration'}</span>${dj.styles.map(s => html`<span class="tag" style="color:#fff;border-color:rgba(255,255,255,.35)">${s}</span>`)}</div>
      <h1>${dj.stage_name}</h1>${dj.tagline ? html`<p style="font-size:clamp(16px,1.6vw,20px);max-width:52ch;margin-top:12px;color:rgba(255,255,255,.85)">${dj.tagline}</p>` : ''}
      <div class="meta"><span>${dj.city}</span>${dj.experience_years ? html`<span>${dj.experience_years} ans d'expérience</span>` : ''}<span>${dj.followers} abonnés</span>${dj.rating ? html`<span>★ ${dj.rating} · ${dj.reviews} avis</span>` : ''}<span>${dj.bookings} bookings via AFTR</span></div>
    </div>
  </section>
  <div class="wrap" style="padding-block:32px 72px">
    <div class="split">
      <div class="stack" style="--gap:28px">
        <div class="row" style="justify-content:flex-start">${actions}</div>
        <section class="stack" style="--gap:10px"><p class="eyebrow">Biographie</p>${(dj.bio || 'Ce DJ n\'a pas encore rédigé sa biographie.').split(/\n+/).map(p => html`<p style="font-size:18px;max-width:62ch">${p}</p>`)}</section>
        ${dj.played?.length ? html`<section class="stack" style="--gap:12px"><p class="eyebrow">Ils l'ont programmé·e</p><ul class="played">${dj.played.map(p => html`<li>${p.title}${p.city ? html`<small>${p.city}</small>` : ''}</li>`)}</ul></section>` : ''}
        ${dj.tracks.length ? html`<section class="card"><div class="card-h"><h3>Extraits & mixes</h3><span class="tiny muted">Lecture non disponible dans la démo</span></div>
          ${dj.tracks.map(t => html`<div class="track"><span class="play" aria-hidden="true">${icon('music')}</span><div class="grow"><div style="font-weight:700">${t.title}</div><div style="color:${dj.accent || 'var(--accent-text)'}">${waveform(t.title, 64)}</div></div><span class="mono muted">${t.kind || ''}${t.bpm ? ` · ${t.bpm} BPM` : ''}</span></div>`)}</section>` : ''}
        ${dj.gallery.length ? html`<section class="stack" style="--gap:10px"><p class="eyebrow">Photos</p><div class="gallery">${dj.gallery.map(g => html`<div class="ph" ${bg(g, 500)}></div>`)}</div></section>` : ''}
        ${dj.experiences.length ? html`<section class="stack" style="--gap:10px"><p class="eyebrow">Expériences</p><div class="list">${dj.experiences.map(e => html`<div class="item">${icon('star')}<span>${e}</span></div>`)}</div></section>` : ''}
        <section class="stack" style="--gap:12px"><p class="eyebrow">Avis d'organisateurs</p>
          ${dj.reviews_list.length ? dj.reviews_list.map(r => html`<div class="card tight stack" style="--gap:6px"><div class="row spread">${stars(r.rating)}<span class="tiny muted"><span class="tag">avis fictif</span> ${fmt.date(r.created_at)}</span></div><p>${r.body || ''}</p><p class="small muted">— ${r.author}</p></div>`)
            : html`<p class="muted">Pas encore d'avis.</p>`}
        </section>
      </div>
      <aside class="stack sticky" style="--gap:16px">
        <div class="card stack" style="--gap:14px">
          <div><p class="eyebrow">Tarif indicatif</p><p class="display" style="font-size:44px;margin-top:6px">${dj.price_min ? `${fmt.eur(dj.price_min)}${dj.price_max ? ` – ${fmt.eur(dj.price_max)}` : ''}` : 'Sur devis'}</p><p class="tiny muted">Par prestation, hors déplacement. Le montant final est fixé par devis.</p></div>
          ${dj.event_types.length ? html`<div><p class="eyebrow" style="margin-bottom:8px">Événements</p><div class="tags">${dj.event_types.map(t => html`<span class="tag">${t}</span>`)}</div></div>` : ''}
        </div>
        ${dj.instagram || dj.presskit_url || dj.booking_email ? html`<div class="card stack" style="--gap:10px"><h3 style="font-size:16px">Press kit & contact</h3>
          ${dj.presskit_url ? html`<a class="btn" href="${dj.presskit_url}" target="_blank" rel="noopener">${icon('video')}Vidéos de sets & photos HD</a>` : ''}
          ${dj.instagram ? html`<a class="btn" href="https://instagram.com/${dj.instagram.replace(/^@/, '')}" target="_blank" rel="noopener">${icon('instagram')}${dj.instagram}</a>` : ''}
          ${dj.booking_email ? html`<div class="row small" style="--gap:8px">${icon('mail')}<span class="mono" style="user-select:all">${dj.booking_email}</span></div>` : ''}
          <button class="btn ghost sm" data-copy-pk style="justify-self:start">${icon('file')}Copier le texte du press kit</button></div>` : ''}
        <div class="card"><div class="card-h"><h3>Disponibilités</h3><span class="tiny muted">5 semaines</span></div>${availability(dj.availability)}</div>
      </aside>
    </div>
  </div>`;
}

export function bookingRow(b, href, perspective = 'dj') {
  const who = perspective === 'dj' ? (b.organizer?.org_name) : b.dj?.stage_name;
  const photo = perspective === 'dj' ? b.organizer?.photo : b.dj?.photo;
  const d = new Date(b.date + 'T12:00:00');
  return html`<a class="item" href="${href}">
    <div class="date-block"><b>${d.getDate()}</b><span>${d.toLocaleDateString('fr-FR', { month: 'short' })}</span></div>
    <div class="grow"><div class="item-title truncate">${b.event_title}</div><div class="item-sub truncate">${who} · ${b.city || ''} · ${fmt.until(b.date)}</div></div>
    <span class="mono muted nowrap">${fmt.eur(b.quote_amount || b.budget || 0)}</span>
    ${chip(BOOKING, b.status)}
  </a>`;
}

// Texte du press kit, prêt à coller dans un mail ou un DM
export function presskitText(dj) {
  return [`${dj.stage_name.toUpperCase()} · DJ · ${dj.city || ''}`, '', dj.bio || '', '', 'Styles : ' + dj.styles.join(' · '),
    dj.played?.length ? 'Ils m\'ont programmé·e : ' + dj.played.slice(0, 8).map(p => p.title).join(', ') : '',
    dj.presskit_url ? 'Vidéos & photos : ' + dj.presskit_url : '', dj.instagram ? 'Instagram : ' + dj.instagram : '', dj.booking_email ? 'Booking : ' + dj.booking_email : '']
    .filter((l, i, a) => l || a[i - 1]).join('\n');
}
export function bindPresskit(root, dj) {
  root.querySelector('[data-copy-pk]')?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(presskitText(dj)); toast('Texte du press kit copié'); } catch { toast('Copie impossible : sélectionne le texte à la main.', 'error'); }
  });
}