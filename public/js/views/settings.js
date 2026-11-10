// Paramètres : compte, profil DJ, profil organisateur, rôles, thème.
import { html, raw, api, state, icon, bg, fmt, avatar, toast, formData, notice, $, $$, on, act, select, img } from '../core.js';
import { refreshMe, applyTheme } from '../app.js';

const STYLES = ['Afro house', 'Amapiano', 'Afrobeats', 'House', 'Deep house', 'Techno', 'Minimal', 'Hard techno', 'Hip-hop', 'R&B', 'Commercial', 'Pop', 'Années 80', 'Dancehall', 'Shatta', 'Reggaeton', 'Latino', 'Disco', 'Funk', 'Drum & bass', 'Jungle'];
const EVENT_TYPES = ['Club', 'Bar / Rooftop', 'Soirée privée', 'Mariage', 'Entreprise', 'Festival', 'Soirée étudiante'];

function photoField(name, label, value, wide) {
  return html`<div class="field"><span>${label}</span><div class="row"><div class="ph no-shade" data-prev="${name}" ${bg(value, 400)} style="width:${wide ? 160 : 72}px;height:72px;border-radius:12px;background-color:var(--surface-2)"></div>
    <label class="btn sm" style="cursor:pointer">${icon('upload')}Choisir une image<input type="file" accept="image/*" data-upload="${name}" hidden></label><input type="hidden" name="${name}" value=""></div></div>`;
}

export async function settings({ rerender }) {
  const me = state.me, dj = me.dj, org = me.organizer;
  const theme = document.documentElement.getAttribute('data-theme') || 'auto';
  return { title: 'Paramètres', html: html`
  <div class="view-h"><div><p class="eyebrow accent">Mon compte</p><h1>Paramètres</h1></div>${dj ? html`<a class="btn" href="/dj/${dj.slug}" target="_blank" rel="noopener">${icon('external')}Voir mon profil public</a>` : ''}</div>
  <div class="split">
    <div class="stack" style="--gap:18px">
      <form class="card stack" id="account" style="--gap:14px"><h3 style="font-size:18px">Compte</h3>
        <div class="form-grid">
          <label class="field"><span>Nom</span><input class="input" name="name" required value="${me.name}"></label>
          <label class="field"><span>Ville</span><input class="input" name="city" value="${me.city || ''}"></label>
          <label class="field full"><span>Bio courte (communauté)</span><textarea class="textarea" name="bio">${me.bio || ''}</textarea></label>
          ${photoField('avatar', 'Photo de profil', me.avatar)}
        </div><div><button class="btn primary">Enregistrer</button></div></form>

      ${dj ? html`<form class="card stack" id="dj" style="--gap:14px"><div class="row spread"><h3 style="font-size:18px">Profil DJ</h3><span class="chip">${completeness(dj, me)} % complété</span></div>
        <div class="form-grid">
          <label class="field"><span>Nom de scène</span><input class="input" name="stage_name" required value="${dj.stage_name}"></label>
          <label class="field"><span>Années d'expérience</span><input class="input" type="number" name="experience_years" min="0" value="${dj.experience_years ?? ''}"></label>
          <label class="field"><span>Tarif à partir de (€)</span><input class="input" type="number" name="price_min" min="0" value="${dj.price_min ?? ''}"></label>
          <label class="field"><span>Tarif jusqu'à (€)</span><input class="input" type="number" name="price_max" min="0" value="${dj.price_max ?? ''}"></label>
          <div class="field full"><span>Styles musicaux</span><div class="choice">${[...new Set([...STYLES, ...dj.styles])].map(s => html`<label><input type="checkbox" name="styles" value="${s}" ${dj.styles.includes(s) ? raw('checked') : ''}><span>${s}</span></label>`)}</div></div>
          <div class="field full"><span>Types d'événements</span><div class="choice">${EVENT_TYPES.map(s => html`<label><input type="checkbox" name="event_types" value="${s}" ${dj.event_types.includes(s) ? raw('checked') : ''}><span>${s}</span></label>`)}</div></div>
          ${photoField('photo', 'Photo principale', dj.photo)}${photoField('cover', 'Image de couverture', dj.cover, true)}
          <label class="field full"><span>Accroche du press kit</span><input class="input" name="tagline" value="${dj.tagline || ''}"></label>
          <label class="field"><span>Instagram</span><input class="input" name="instagram" value="${dj.instagram || ''}" placeholder="@ton_compte"></label>
          <label class="field"><span>E-mail de booking (affiché)</span><input class="input" type="email" name="booking_email" value="${dj.booking_email || ''}"></label>
          <label class="field"><span>Lien du press kit (vidéos, photos)</span><input class="input" name="presskit_url" value="${dj.presskit_url || ''}" placeholder="https://drive.google.com/…"></label>
          <label class="field"><span>Lien de ton mix</span><input class="input" name="mix_url" value="${dj.mix_url || ''}" placeholder="https://soundcloud.com/…"></label>
          <label class="field full"><span>Expériences (une par ligne)</span><textarea class="textarea" name="experiences">${dj.experiences.join('\n')}</textarea></label>
          <div class="field full"><span>Extraits & mixes</span><div class="stack" id="tracks" style="--gap:6px">${[...dj.tracks, {}, {}].slice(0, Math.max(3, dj.tracks.length + 1)).map(t => html`<div class="row nowrap" data-track><input class="input sm grow" name="t_title" placeholder="Titre" value="${t.title || ''}"><input class="input sm" name="t_kind" placeholder="Mix / Edit" value="${t.kind || ''}" style="width:110px"><input class="input sm" type="number" name="t_bpm" placeholder="BPM" value="${t.bpm || ''}" style="width:80px"></div>`)}</div></div>
          <label class="check full"><input type="checkbox" name="marketplace_visible" ${dj.marketplace_visible ? raw('checked') : ''}><span>Visible dans la marketplace (recherche des organisateurs)</span></label>
        </div><div><button class="btn primary">Enregistrer le profil DJ</button></div></form>` : ''}

      ${org ? html`<form class="card stack" id="org" style="--gap:14px"><h3 style="font-size:18px">Profil organisateur</h3>
        <div class="form-grid">
          <label class="field"><span>Nom de l'organisation</span><input class="input" name="org_name" required value="${org.org_name}"></label>
          <label class="field"><span>Type</span>${select('org_type', ['Collectif', 'Club', 'Bar', 'Agence événementielle', 'Association étudiante', 'Wedding planner', 'Entreprise', 'Festival', 'Particulier'], org.org_type)}</label>
          <label class="field full"><span>Description</span><textarea class="textarea" name="description">${org.description || ''}</textarea></label>
          ${photoField('photo', 'Visuel', org.photo, true)}
        </div><div><button class="btn primary">Enregistrer</button></div></form>` : ''}
    </div>
    <aside class="stack sticky" style="--gap:16px">
      <div class="card stack" style="--gap:12px"><h3 style="font-size:16px">Apparence</h3><p class="small muted">Ton choix est enregistré dans ton compte et appliqué sur tous tes appareils.</p>
        <div class="choice">${[['light', 'Jour'], ['dark', 'Nuit'], ['auto', 'Automatique']].map(([k, l]) => html`<label><input type="radio" name="theme" value="${k}" ${theme === k ? raw('checked') : ''}><span>${l}</span></label>`)}</div></div>
      <div class="card stack" style="--gap:12px"><h3 style="font-size:16px">Mes profils</h3>
        ${[['dj', 'DJ', 'Communauté, Business Studio, profil public'], ['organizer', 'Organisateur', 'Recherche de DJs, événements, réservations']].map(([r, l, d]) => html`<div class="row"><div class="grow"><b>${l}</b><div class="tiny muted">${d}</div></div>${me.roles.includes(r) ? html`<span class="chip ok">Actif</span>` : html`<button class="btn sm" data-role="${r}">Activer</button>`}</div>`)}
        ${me.roles.includes('admin') ? html`<div class="row"><div class="grow"><b>Administrateur</b><div class="tiny muted">Attribué par l'équipe AFTR</div></div><span class="chip ok">Actif</span></div>` : ''}</div>
      <div class="card small muted">Compte : <b>${me.email}</b><br>Membre depuis le ${fmt.date(me.created_at)}</div>
    </aside>
  </div>`,
  mount: v => {
    on(v, 'change', '[data-upload]', async (e, input) => {
      const f = input.files[0]; if (!f) return;
      const up = await act(null, () => api.upload(f), 'Image envoyée');
      const form = input.closest('form');
      form.querySelector(`[name="${input.dataset.upload}"]`).value = up.url;
      const prev = form.querySelector(`[data-prev="${input.dataset.upload}"]`); prev.style.backgroundImage = `url('${up.url}')`;
    });
    $('#account', v).addEventListener('submit', async e => { e.preventDefault(); await act(e.target.querySelector('button'), () => api.patch('/api/me', formData(e.target)), 'Compte mis à jour'); await refreshMe(); rerender(); });
    $('#dj', v)?.addEventListener('submit', async e => {
      e.preventDefault(); const f = e.target, d = formData(f);
      d.tracks = $$('[data-track]', f).map(r => ({ title: r.querySelector('[name=t_title]').value, kind: r.querySelector('[name=t_kind]').value, bpm: r.querySelector('[name=t_bpm]').value }));
      d.experiences = d.experiences.split('\n').map(s => s.trim()).filter(Boolean);
      d.gallery = state.me.dj.gallery;
      await act(f.querySelector('.primary'), () => api.patch('/api/me/dj', d), 'Profil DJ enregistré'); await refreshMe(); rerender();
    });
    $('#org', v)?.addEventListener('submit', async e => { e.preventDefault(); await act(e.target.querySelector('button'), () => api.patch('/api/me/organizer', formData(e.target)), 'Profil organisateur enregistré'); await refreshMe(); rerender(); });
    on(v, 'change', '[name=theme]', async (e, r) => { await applyTheme(r.value); toast('Apparence enregistrée dans ton compte'); });
    on(v, 'click', '[data-role]', async (e, b) => { await act(b, () => api.post('/api/me/roles', { role: b.dataset.role }), 'Profil activé'); await refreshMe(); rerender(); });
  } };
}

function completeness(dj, me) {
  const checks = [dj.photo, me.bio, me.city, dj.styles.length, dj.price_min, dj.tracks.length, dj.gallery.length, dj.event_types.length];
  return Math.round(checks.filter(Boolean).length / checks.length * 100);
}
