// Données de démonstration : 100 % fictives, datées par rapport au jour courant
// pour que la démo reste crédible quel que soit le jour de la soutenance.
import { run, insert, all, tx, today, addDays } from './db.js';
import { priceOf } from './routes/project.js';
import { hashPassword } from './http.js';

export const DEMO_PASSWORD = 'aftr2026';
export const DEMO_ACCOUNTS = [
  { email: 'anjara@aftr.demo', label: 'Anjara', role: 'DJ' },
  { email: 'contrejour@aftr.demo', label: 'Collectif Contre-Jour', role: 'Organisateur' },
  { email: 'dida@aftr.demo', label: 'DIDA', role: 'DJ + organisateur' },
  { email: 'admin@aftr.demo', label: 'Équipe AFTR', role: 'Administrateur' },
];

const P = id => `unsplash:photo-${id}`;
const PH = {
  anjara: '/img/anjara-avatar.jpg', anjaraFull: '/img/anjara-portrait.jpg', nokta: P('1713450602872-9e7587ea22ae'), lune: P('1764510383709-14be6ec28548'),
  pastel: P('1608433299744-f1d2abfda5b5'), kaya: P('1621623207386-54450400f7cb'), osmose: P('1720782201912-2e5518145a01'),
  marlow: P('1673131891738-3c38bb62b89c'), dida: P('1648090326914-fcf7ad3f5aa1'), silex: P('1574793954837-b7938eb5a662'),
  beton: P('1516873240891-4bf014598ab4'), amaya: P('1611119267731-def592cb04d5'), rizzo: P('1654134155454-0ac29533f52d'),
  crowd1: P('1578736641330-3155e606cd40'), crowd2: P('1545128485-c400e7702796'), crowd3: P('1574155267225-3b5423dd45d9'),
  stage1: P('1470229722913-7c0e2dbbafd3'), stage2: P('1514525253161-7a46d19cd819'), hands: P('1506157786151-b8491531f063'),
  festival: P('1533174072545-7a4b6ad7a6c3'), rooftop: P('1720623784273-f9388b9aa535'), night: P('1618176581835-d60e9c2567b9'),
  mixer: P('1594623930572-300a3011d9ae'), controller: P('1541126274323-dbac58d14741'), redmixer: P('1558474566-cbeb8b92cf48'),
  vinyl: P('1603048588665-791ca8aea617'), amber: P('1616714109948-c74fe5029a4d'), deck: P('1542395118-9d95347995bc'),
  booth: P('1688591677634-58dfdc60d62d'), lights: P('1777734448523-6b441c719d8d'), sunset: P('1778812268889-79d82e05216f'),
  confetti: P('1768054186550-4bdbb8f2640e'), party: P('1688591677741-0cf7b4462ce3'), blue: P('1574154808186-c3b1303a4b4c'),
};

let seedN = 7;
const rnd = () => { seedN = (seedN * 16807) % 2147483647; return (seedN - 1) / 2147483646; };
const pick = a => a[Math.floor(rnd() * a.length)];
const d = n => addDays(today(), n);
const ts = (days, h = 12, m = 0) => `${d(days)}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`;

export function seed() {
  seedN = 7;
  const hash = hashPassword(DEMO_PASSWORD);
  tx(() => {
    const user = (email, name, city, opts = {}) => insert(
      'INSERT INTO users (email, password_hash, name, city, bio, avatar, theme, source, is_demo, created_at, last_active_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
      email, hash, name, city, opts.bio ?? null, opts.avatar ?? null, opts.theme ?? 'auto', opts.source ?? 'Direct', opts.created ?? ts(-100), opts.active ?? ts(-1));
    const role = (id, ...roles) => roles.forEach(r => run('INSERT INTO user_roles (user_id, role) VALUES (?, ?)', id, r));
    const sub = (id, plan, days = -60) => run('INSERT INTO subscriptions (user_id, plan, status, started_at) VALUES (?, ?, ?, ?)', id, plan, 'active', ts(days));

    // ───────── Administrateur
    const admin = user('admin@aftr.demo', 'Équipe AFTR', 'Paris', { created: ts(-200), active: ts(0, 9) });
    role(admin, 'admin');

    // ───────── DJs mis en avant (marketplace)
    const DJS = [
      // Profil réel d'Anjara (repris de son espace « Anjara Booking »)
      { key: 'anjara', name: 'Anjara', email: 'anjara@aftr.demo', city: 'Lyon', styles: ['Afrobeats', 'Amapiano', 'Rap', 'Trap', 'Shatta', 'Dancehall', 'Baile funk'], types: ['Club', 'Bar / Rooftop', 'Festival', 'Soirée étudiante', 'Soirée privée'], pmin: 150, pmax: 600, xp: null, accent: '#FF3D8B', source: 'Instagram', created: -180,
        bio: 'DJ basée à Lyon, Anjara se distingue par une énergie brute et une vraie polyvalence derrière les platines.\nSes sets naviguent entre rap, trap, afro, amapiano et sonorités caribéennes (shatta, dancehall), avec une sélection toujours pensée pour faire vibrer son public. Elle joue entre Lyon, Paris et Genève.',
        tracks: [],
        exp: ['Girls in Lyon (Lyon)', 'Plavace Project, 5 ans au Ninkasi Cordeliers (Lyon)', 'Fête nationale suisse, Parc La Grange (Genève)', 'Madame Shatta XXL, La Fav (Paris)', 'House of Nine (Suisse)', 'Afro Touch, La Cherry (Lyon)', '1re partie de Bamby au Sucre (Lyon)'], gallery: ['anjaraFull', 'crowd1'] },
      { key: 'nokta', name: 'NOKTA', city: 'Marseille', styles: ['Techno', 'Minimal'], types: ['Club', 'Festival'], pmin: 700, pmax: 1200, xp: 10, accent: '#7C8CFF', source: 'Bouche-à-oreille', created: -170,
        bio: 'Techno hypnotique et longs sets de clôture. Dix ans de clubs entre Marseille et Berlin.', tracks: [{ title: 'Night Train (NOKTA edit)', kind: 'Edit', bpm: 132 }, { title: 'Closing set — Calanques', kind: 'Mix', bpm: 130 }],
        exp: ['Closing Hangar 9', 'Warehouse Marseille'], gallery: ['blue', 'stage1'] },
      { key: 'lune', name: 'LUNE ROUGE', city: 'Paris', styles: ['Hip-hop', 'R&B'], types: ['Club', 'Soirée étudiante', 'Soirée privée'], pmin: 400, pmax: 700, xp: 6, accent: '#E5484D', source: 'TikTok', created: -150,
        bio: 'Hip-hop old school, R&B et rap FR. Spécialiste des soirées étudiantes et des anniversaires qui finissent tard.', tracks: [{ title: '2000s Throwback mix', kind: 'Mix', bpm: 95 }], exp: ['Gala BDE 2025', 'Soirées Rap Club Paris'], gallery: ['party', 'hands'] },
      { key: 'pastel', name: 'PASTEL', city: 'Nantes', styles: ['Commercial', 'Années 80', 'Pop'], types: ['Mariage', 'Entreprise', 'Soirée privée'], pmin: 450, pmax: 800, xp: 12, accent: '#F3A6C8', source: 'Google', created: -160,
        bio: 'DJ généraliste : mariages, soirées d\'entreprise et anniversaires. Je lis la salle et j\'adapte la playlist aux invités.', tracks: [{ title: 'Wedding Party Classics', kind: 'Mix', bpm: 120 }], exp: ['120 mariages animés', 'Soirées d\'entreprise'], gallery: ['confetti'] },
      { key: 'kaya', name: 'KAYA SOUND', city: 'Paris', styles: ['Dancehall', 'Shatta', 'Afrobeats'], types: ['Club', 'Soirée privée', 'Festival'], pmin: 500, pmax: 850, xp: 8, accent: '#3CCB7F', source: 'Instagram', created: -140,
        bio: 'Dancehall, shatta et afrobeats. Sound system dans l\'âme, énergie garantie.', tracks: [{ title: 'Shatta Fever vol. 3', kind: 'Mix', bpm: 100 }], exp: ['Tropical Nights Paris'], gallery: ['crowd2'] },
      { key: 'osmose', name: 'OSMOSE', city: 'Bordeaux', styles: ['House', 'Deep house'], types: ['Bar / Rooftop', 'Club', 'Entreprise'], pmin: 500, pmax: 900, xp: 9, accent: '#F2C14E', source: 'Partenariat', created: -130,
        bio: 'House chaleureuse pour rooftops et afterworks. Vinyles uniquement.', tracks: [{ title: 'Rooftop Sessions #4', kind: 'Mix', bpm: 122 }], exp: ['Résident Rooftop Bordeaux'], gallery: ['vinyl', 'rooftop'] },
      { key: 'marlow', name: 'MARLOW', city: 'Lille', styles: ['Techno', 'House'], types: ['Club', 'Festival'], pmin: 650, pmax: 1000, xp: 5, accent: '#9B8CFF', source: 'Instagram', created: -110,
        bio: 'Entre house et techno, du club au festival.', tracks: [{ title: 'Lille Underground', kind: 'Mix', bpm: 128 }], exp: ['Festival Nord Électro'], gallery: ['lights'] },
      { key: 'dida', name: 'DIDA', email: 'dida@aftr.demo', city: 'Lyon', styles: ['Afrobeats', 'Afro house'], types: ['Bar / Rooftop', 'Soirée privée', 'Soirée étudiante'], pmin: 300, pmax: 500, xp: 2, accent: '#FF8A3D', source: 'TikTok', created: -60,
        bio: 'Jeune DJ afrobeats et organisateur des Afro Brunch lyonnais.', tracks: [{ title: 'Afro Brunch warm-up', kind: 'Mix', bpm: 108 }], exp: ['Afro Brunch Lyon'], gallery: ['party'] },
      { key: 'silex', name: 'SILEX', city: 'Toulouse', styles: ['Drum & bass', 'Jungle'], types: ['Club', 'Festival'], pmin: 400, pmax: 650, xp: 6, accent: '#5BC0EB', source: 'Bouche-à-oreille', created: -120,
        bio: 'Drum & bass, jungle et breaks. Mix rapide à quatre platines.', tracks: [{ title: 'Amen Break Science', kind: 'Edit', bpm: 174 }], exp: ['Bass Culture Toulouse'], gallery: ['stage2'] },
      { key: 'beton', name: 'BÉTON BLEU', city: 'Montpellier', styles: ['Disco', 'Funk'], types: ['Bar / Rooftop', 'Mariage', 'Soirée privée'], pmin: 450, pmax: 700, xp: 11, accent: '#4F8EF7', source: 'Google', created: -175,
        bio: 'Disco, funk et edits maison. Boule à facettes non fournie (mais presque).', tracks: [{ title: 'Disco Béton edits', kind: 'Edit', bpm: 118 }], exp: ['Disco Club Montpellier'], gallery: ['amber'] },
      { key: 'amaya', name: 'AMAYA', city: 'Paris', styles: ['Reggaeton', 'Latino', 'Commercial'], types: ['Club', 'Mariage', 'Soirée privée'], pmin: 450, pmax: 750, xp: 4, accent: '#FF6FA5', source: 'Instagram', created: -45,
        bio: 'Reggaeton, latino et hits du moment. Ambiance garantie de 22 h à la fermeture.', tracks: [{ title: 'Perreo Night', kind: 'Mix', bpm: 96 }], exp: ['Latin Fridays Paris'], gallery: ['hands'] },
      { key: 'rizzo', name: 'RIZZO', city: 'Strasbourg', styles: ['Hard techno', 'Techno'], types: ['Club', 'Festival'], pmin: 500, pmax: 900, xp: 3, accent: '#B4B9C7', source: 'TikTok', created: -25,
        bio: 'Hard techno rapide et sans compromis.', tracks: [{ title: 'Strasbourg 150 BPM', kind: 'Mix', bpm: 150 }], exp: [], gallery: [] },
    ];
    const djId = {};
    for (const dj of DJS) {
      const id = user(dj.email || `${dj.key}@aftr.demo`, dj.name, dj.city, { bio: dj.bio, source: dj.source, created: ts(dj.created), active: ts(-Math.floor(rnd() * 6), 10 + Math.floor(rnd() * 10)), theme: dj.key === 'anjara' ? 'dark' : 'auto' });
      djId[dj.key] = id;
      role(id, 'dj');
      run(`INSERT INTO dj_profiles (user_id, stage_name, slug, styles, event_types, price_min, price_max, experience_years, photo, cover, gallery, tracks, experiences, accent)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, id, dj.name, dj.key === 'beton' ? 'beton-bleu' : dj.key === 'lune' ? 'lune-rouge' : dj.key === 'kaya' ? 'kaya-sound' : dj.key,
        JSON.stringify(dj.styles), JSON.stringify(dj.types), dj.pmin, dj.pmax, dj.xp, PH[dj.key], PH[dj.gallery[0]] || PH.crowd3,
        JSON.stringify(dj.gallery.map(g => PH[g])), JSON.stringify(dj.tracks), JSON.stringify(dj.exp), dj.accent);
      sub(id, ['anjara', 'nokta', 'osmose', 'pastel'].includes(dj.key) ? 'dj_pro' : 'dj_free', dj.created + 2);
    }
    // RIZZO : profil volontairement incomplet (sert aux relances automatiques)
    run("UPDATE dj_profiles SET price_min = NULL, gallery = '[]', event_types = '[]' WHERE user_id = ?", djId.rizzo);
    run('UPDATE users SET bio = NULL WHERE id = ?', djId.rizzo);

    // ───────── Organisateurs
    const ORGS = [
      { key: 'contrejour', email: 'contrejour@aftr.demo', name: 'Collectif Contre-Jour', city: 'Paris', type: 'Collectif', photo: PH.crowd2, source: 'Instagram', created: -150, desc: 'Collectif de soirées afro et house à Paris : péniches, rooftops et lieux atypiques.' },
      { key: 'hangar', name: 'Le Hangar 9', city: 'Bordeaux', type: 'Club', photo: PH.stage1, source: 'LinkedIn', created: -165, desc: 'Club de 600 places sur les quais de Bordeaux.' },
      { key: 'bde', name: 'BDE Sup\'Com Lyon', city: 'Lyon', type: 'Association étudiante', photo: PH.hands, source: 'Campagne Rentrée', created: -55, desc: 'Bureau des étudiants : galas, soirées d\'intégration et afterworks.' },
      { key: 'ivoire', name: 'Maison Ivoire Mariages', city: 'Nantes', type: 'Wedding planner', photo: PH.confetti, source: 'Google', created: -95, desc: 'Organisation de mariages dans l\'Ouest de la France.' },
      { key: 'hf', name: 'Agence Haute Fréquence', city: 'Paris', type: 'Agence événementielle', photo: PH.lights, source: 'Campagne Rentrée', created: -48, desc: 'Agence événementielle : lancements de produits, séminaires et soirées de marque.' },
      { key: 'berges', name: 'Festival Les Berges', city: 'Toulouse', type: 'Festival', photo: PH.festival, source: 'Partenariat', created: -140, desc: 'Festival de musiques électroniques en bord de Garonne.' },
    ];
    const orgId = {};
    for (const o of ORGS) {
      const id = user(o.email || `${o.key}@aftr.demo`, o.name, o.city, { source: o.source, created: ts(o.created), active: ts(-Math.floor(rnd() * 8), 11) });
      orgId[o.key] = id; role(id, 'organizer');
      run('INSERT INTO organizer_profiles (user_id, org_name, org_type, description, photo) VALUES (?, ?, ?, ?, ?)', id, o.name, o.type, o.desc, o.photo);
      sub(id, ['contrejour', 'hangar', 'hf'].includes(o.key) ? 'org_plus' : 'org_free', o.created + 1);
    }
    // DIDA est aussi organisateur (double rôle)
    role(djId.dida, 'organizer');
    run('INSERT INTO organizer_profiles (user_id, org_name, org_type, description, photo) VALUES (?, ?, ?, ?, ?)', djId.dida, 'Afro Brunch Lyon', 'Collectif', 'Brunchs afro le dimanche à Lyon.', PH.party);
    sub(djId.dida, 'org_free', -40);
    orgId.dida = djId.dida;

    // ───────── Membres de la communauté (inscriptions réparties sur 4 mois)
    const FIRST = ['Inès', 'Malik', 'Chloé', 'Yanis', 'Léa', 'Sami', 'Nora', 'Hugo', 'Aya', 'Théo', 'Maya', 'Rayan', 'Lina', 'Enzo', 'Sarah', 'Noah', 'Jade', 'Adam', 'Zoé', 'Ilyes', 'Camille', 'Bilal', 'Manon', 'Lucas', 'Assia', 'Tom', 'Salomé', 'Karim', 'Eva', 'Nathan', 'Lou', 'Moussa', 'Clara', 'Jules', 'Amel', 'Victor', 'Leïla', 'Axel', 'Anaïs', 'Mehdi'];
    const ALIAS = ['Nuit', 'Echo', 'Kairos', 'Volt', 'Sable', 'Prisme', 'Orbit', 'Mirage', 'Flux', 'Onyx', 'Néon', 'Cobalt', 'Ruban', 'Halo', 'Pulse', 'Zénith'];
    const CITIES = ['Paris', 'Lyon', 'Marseille', 'Bordeaux', 'Lille', 'Toulouse', 'Nantes', 'Montpellier', 'Strasbourg', 'Rennes', 'Nice'];
    const SOURCES = ['Instagram', 'Instagram', 'Instagram', 'TikTok', 'TikTok', 'Bouche-à-oreille', 'Bouche-à-oreille', 'Google', 'LinkedIn', 'Partenariat', 'Campagne Rentrée', 'Direct'];
    const STYLES = ['House', 'Techno', 'Afro house', 'Hip-hop', 'Commercial', 'Dancehall', 'Amapiano', 'Disco', 'Drum & bass'];
    const members = [];
    for (let i = 0; i < 62; i++) {
      const first = FIRST[i % FIRST.length], isOrg = i % 5 === 0;
      const created = -Math.floor(rnd() * 118) - 1;
      const activeAgo = rnd() < 0.55 ? Math.floor(rnd() * 20) : 25 + Math.floor(rnd() * 60);
      let source = pick(SOURCES);
      if (source === 'Campagne Rentrée' && (created < -60 || created > -30)) source = 'Instagram';
      const id = user(`membre${i + 1}@aftr.demo`, isOrg ? `${first} — ${pick(['Soirées', 'Events', 'Asso'])} ${pick(CITIES)}` : `${first} ${String.fromCharCode(65 + (i * 7) % 26)}.`, pick(CITIES),
        { source, created: ts(created, 8 + (i % 12)), active: ts(-Math.min(activeAgo, -created), 15) });
      if (isOrg) {
        role(id, 'organizer');
        run('INSERT INTO organizer_profiles (user_id, org_name, org_type) VALUES (?, ?, ?)', id, `${first} ${pick(['Events', 'Soirées', 'Prod'])}`, pick(['Collectif', 'Association étudiante', 'Particulier', 'Bar']));
        sub(id, 'org_free', created);
      } else {
        role(id, 'dj');
        const alias = `${pick(ALIAS)} ${String.fromCharCode(65 + i % 26)}`;
        run('INSERT INTO dj_profiles (user_id, stage_name, slug, styles, marketplace_visible) VALUES (?, ?, ?, ?, 0)', id, alias, `membre-${i + 1}`, JSON.stringify([pick(STYLES)]));
        sub(id, rnd() < 0.12 ? 'dj_pro' : 'dj_free', created);
      }
      members.push(id);
    }

    // ───────── Événements
    const ev = (org, title, days, city, venue, type, styles, cap, budget, photo, status = 'planning', desc = null, start = '22:00', end = '04:00') =>
      insert(`INSERT INTO events (organizer_id, title, date, start_time, end_time, city, venue, event_type, styles, capacity, budget, description, photo, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        orgId[org], title, d(days), start, end, city, venue, type, JSON.stringify(styles), cap, budget, desc, PH[photo], status, ts(Math.min(-5, days - 40)));
    const E = {
      cj12: ev('contrejour', 'Contre-Jour #12 — Péniche', 16, 'Paris', 'Péniche Lumière (quai de la Gare)', 'Club', ['Afro house', 'Amapiano'], 300, 800, 'crowd2', 'dj_found', 'Soirée afro sur l\'eau, 300 personnes, coucher de soleil puis club jusqu\'à 4 h.'),
      cj13: ev('contrejour', 'Contre-Jour #13 — Rooftop', 44, 'Paris', 'Rooftop République', 'Bar / Rooftop', ['House', 'Afro house'], 250, 700, 'rooftop', 'planning', 'Rooftop de fin d\'année. DJ recherché pour le closing.', '18:00', '01:00'),
      cj11: ev('contrejour', 'Contre-Jour #11', -40, 'Paris', 'Entrepôt Est', 'Club', ['Afro house'], 400, 750, 'crowd1', 'done'),
      afro: ev('hangar', 'Afro Night', -12, 'Bordeaux', 'Le Hangar 9', 'Club', ['Afro house', 'Afrobeats'], 600, 700, 'stage1', 'done'),
      techno: ev('hangar', 'Techno Session', 11, 'Bordeaux', 'Le Hangar 9', 'Club', ['Techno'], 600, 1100, 'blue', 'dj_found'),
      closing: ev('hangar', 'Closing de saison', 60, 'Bordeaux', 'Le Hangar 9', 'Club', ['House', 'Techno'], 600, 1200, 'lights', 'planning', 'Grand closing : deux DJs en back-to-back recherchés.'),
      gala: ev('bde', 'Gala de fin de semestre', 30, 'Lyon', 'Salle des Célestins (fictive)', 'Soirée étudiante', ['Commercial', 'Hip-hop', 'Afrobeats'], 450, 650, 'hands', 'planning'),
      wedding: ev('ivoire', 'Mariage Camille & Sofiane', 52, 'Nantes', 'Domaine des Sablons (fictif)', 'Mariage', ['Commercial', 'Afro house'], 140, 1100, 'confetti', 'planning', null, '19:00', '03:00'),
      launch: ev('hf', 'Lancement produit Nova', 9, 'Paris', 'Showroom Marais', 'Entreprise', ['House', 'Afro house'], 200, 950, 'lights', 'planning', 'Soirée de lancement d\'une marque de sneakers.', '19:00', '23:30'),
      seminar: ev('hf', 'Séminaire annuel — soirée', 75, 'Paris', 'Pavillon Bercy', 'Entreprise', ['Commercial', 'Disco'], 350, 1300, 'party', 'planning'),
      berges: ev('berges', 'Festival Les Berges — Jour 1', 120, 'Toulouse', 'Prairie des Filtres', 'Festival', ['Techno', 'House', 'Drum & bass'], 3000, 2500, 'festival', 'planning', null, '16:00', '02:00'),
      berges25: ev('berges', 'Festival Les Berges — été', -70, 'Toulouse', 'Prairie des Filtres', 'Festival', ['Afro house', 'House'], 3000, 900, 'sunset', 'done'),
      brunch: ev('dida', 'Afro Brunch #7', 20, 'Lyon', 'Péniche Loire (fictive)', 'Bar / Rooftop', ['Afrobeats', 'Amapiano'], 150, 300, 'party', 'planning', null, '12:00', '18:00'),
    };

    // ───────── Demandes de réservation et historique
    const book = (dj, org, event, title, days, city, venue, type, budget, status, opts = {}) => {
      const created = opts.created ?? Math.min(days - 20, -2);
      const id = insert(`INSERT INTO booking_requests (dj_id, organizer_id, event_id, event_title, event_type, date, start_time, end_time, city, venue, budget, message, status, quote_amount, quote_message, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, djId[dj], orgId[org], event ?? null, title, type, d(days), opts.start ?? '23:00', opts.end ?? '03:00', city, venue, budget, opts.message ?? null,
        status, opts.quote ?? null, opts.quoteMsg ?? null, ts(created, 14), ts(opts.updated ?? created + 2, 16));
      const h = (st, note, dd, actor) => insert('INSERT INTO booking_history (request_id, actor_id, status, note, created_at) VALUES (?, ?, ?, ?, ?)', id, actor, st, note, ts(dd, 15));
      h('pending', 'Demande envoyée', created, orgId[org]);
      if (['quoted', 'confirmed', 'completed'].includes(status) || opts.quote) h('quoted', `Devis proposé : ${opts.quote} €`, created + 1, djId[dj]);
      if (['confirmed', 'completed'].includes(status)) h('confirmed', 'Devis accepté, booking confirmé', created + 2, orgId[org]);
      if (status === 'completed') h('completed', 'Prestation réalisée', days + 1, djId[dj]);
      if (status === 'declined') h('declined', opts.declineNote || 'Refusé par le DJ', created + 1, opts.declinedBy === 'org' ? orgId[org] : djId[dj]);
      if (status === 'cancelled') h('cancelled', "Annulé par l'organisateur", created + 3, orgId[org]);
      return id;
    };
    const R = {
      cj12: book('anjara', 'contrejour', E.cj12, 'Contre-Jour #12 — Péniche', 16, 'Paris', 'Péniche Lumière', 'Club', 300, 'confirmed', { quote: 350, quoteMsg: 'Set de 2 h (1 h – 3 h), matériel du lieu. Déplacement Lyon–Paris inclus.', message: 'Hello Anjara ! On adore tes sets afro / shatta, on aimerait t\'avoir pour la #12 sur la péniche.', created: -18 }),
      gala: book('anjara', 'bde', E.gala, 'Gala de fin de semestre', 30, 'Lyon', 'Salle des Célestins', 'Soirée étudiante', 400, 'pending', { message: 'Bonjour, nous cherchons une DJ pour notre gala (450 étudiants). Set de 23 h à 2 h. Est-ce possible ?', created: -2 }),
      launch: book('anjara', 'hf', E.launch, 'Lancement produit Nova', 9, 'Paris', 'Showroom Marais', 'Entreprise', 500, 'quoted', { quote: 550, quoteMsg: 'Set afro / amapiano de 19 h 30 à 23 h, avec sonorisation d\'appoint fournie.', message: 'Soirée de lancement d\'une marque de sneakers, ambiance afrobeats et amapiano.', created: -6, start: '19:30', end: '23:00' }),
      wedding: book('anjara', 'hangar', E.closing, 'Closing de saison — salle 2 (shatta)', 60, 'Bordeaux', 'Le Hangar 9', 'Club', 400, 'pending', { message: 'On ouvre une deuxième salle shatta / dancehall pour le closing : partante ?', created: -1, start: '00:00', end: '03:00' }),
      brunch: book('anjara', 'dida', E.brunch, 'Afro Brunch #7', 20, 'Lyon', 'Péniche Loire', 'Bar / Rooftop', 250, 'declined', { message: 'Petit budget mais super ambiance !', created: -8, declineNote: 'Budget trop éloigné de mes tarifs, désolée !' }),
    };
    book('nokta', 'hangar', E.techno, 'Techno Session', 11, 'Bordeaux', 'Le Hangar 9', 'Club', 1100, 'confirmed', { quote: 1100, created: -25 });
    book('nokta', 'berges', E.berges, 'Festival Les Berges — Jour 1', 120, 'Toulouse', 'Prairie des Filtres', 'Festival', 1300, 'quoted', { quote: 1400, created: -9 });
    book('marlow', 'hangar', E.closing, 'Closing de saison', 60, 'Bordeaux', 'Le Hangar 9', 'Club', 1000, 'pending', { created: -3 });
    book('lune', 'bde', E.gala, 'Gala de fin de semestre', 30, 'Lyon', 'Salle des Célestins', 'Soirée étudiante', 600, 'declined', { created: -10, declinedBy: 'org', declineNote: "Devis refusé par l'organisateur", quote: 700 });
    book('pastel', 'ivoire', null, 'Mariage Julie & Karim', -30, 'Nantes', 'Château de la Loire (fictif)', 'Mariage', 800, 'completed', { quote: 800, created: -90 });
    book('pastel', 'hf', E.seminar, 'Séminaire annuel — soirée', 75, 'Paris', 'Pavillon Bercy', 'Entreprise', 1300, 'confirmed', { quote: 1200, created: -15 });
    book('kaya', 'contrejour', null, 'Contre-Jour x Tropical', -20, 'Paris', 'Péniche Lumière', 'Club', 650, 'completed', { quote: 650, created: -60 });
    book('osmose', 'hangar', null, 'Afterwork Rooftop', -5, 'Bordeaux', 'Toit du Hangar', 'Bar / Rooftop', 500, 'completed', { quote: 550, created: -30 });
    book('silex', 'berges', E.berges, 'Festival Les Berges — Jour 1', 120, 'Toulouse', 'Prairie des Filtres', 'Festival', 650, 'confirmed', { quote: 650, created: -12 });
    book('amaya', 'contrejour', E.cj13, 'Contre-Jour #13 — Rooftop', 44, 'Paris', 'Rooftop République', 'Bar / Rooftop', 600, 'pending', { created: -1 });
    book('beton', 'ivoire', null, 'Mariage Élise & Tom', 34, 'Nantes', 'Moulin de Vertou (fictif)', 'Mariage', 700, 'cancelled', { created: -20 });
    book('dida', 'bde', null, 'Afterwork BDE', -18, 'Lyon', 'Bar du Rhône', 'Soirée étudiante', 300, 'completed', { quote: 320, created: -40 });

    // Avis
    const review = (dj, org, req, rating, body, days) => insert('INSERT INTO reviews (dj_id, author_id, request_id, rating, body, created_at) VALUES (?, ?, ?, ?, ?, ?)', djId[dj], orgId[org], req, rating, body, ts(days));
    review('nokta', 'hangar', null, 5, 'Closing magistral.', -50);
    review('pastel', 'ivoire', null, 4, 'Les invités ont dansé toute la nuit. Petit retard à l\'installation.', -28);
    review('kaya', 'contrejour', null, 5, 'Énergie incroyable, on refait ça vite.', -18);
    review('osmose', 'hangar', null, 5, 'Parfait pour notre rooftop.', -4);
    review('dida', 'bde', null, 4, 'Très bonne ambiance pour notre afterwork.', -16);

    // Dates bloquées d'Anjara
    for (const [n, r] of [[23, 'Vacances'], [24, 'Vacances'], [37, 'Set privé']]) run('INSERT INTO dj_blocked_dates (dj_id, date, reason) VALUES (?, ?, ?)', djId.anjara, d(n), r);

    // Favoris
    for (const [o, dj] of [['contrejour', 'anjara'], ['contrejour', 'kaya'], ['contrejour', 'osmose'], ['hangar', 'nokta'], ['hf', 'anjara'], ['hf', 'pastel']]) run('INSERT INTO favorites (organizer_id, dj_id, created_at) VALUES (?, ?, ?)', orgId[o], djId[dj], ts(-20));

    // ───────── Communauté : abonnements
    const all12 = Object.values(djId);
    for (const a of all12) for (const b of all12) if (a !== b && rnd() < 0.45) run('INSERT INTO follows (follower_id, followee_id, created_at) VALUES (?, ?, ?)', a, b, ts(-30));
    for (const m of members) for (const b of all12) if (rnd() < 0.3) run('INSERT OR IGNORE INTO follows (follower_id, followee_id, created_at) VALUES (?, ?, ?)', m, b, ts(-20));
    run('INSERT OR IGNORE INTO follows (follower_id, followee_id, created_at) VALUES (?, ?, ?)', djId.anjara, djId.nokta, ts(-60));
    run('INSERT OR IGNORE INTO follows (follower_id, followee_id, created_at) VALUES (?, ?, ?)', djId.anjara, djId.dida, ts(-40));

    // Publications
    const post = (author, kind, body, days, h, media = [], track = null) => insert('INSERT INTO posts (author_id, kind, body, media, track, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      author, kind, body, JSON.stringify(media.map(m => ({ type: 'image', url: PH[m] }))), track ? JSON.stringify(track) : null, ts(days, h));
    const P1 = post(djId.osmose, 'post', 'Rooftop complet hier soir à Bordeaux. Trois heures de house au coucher du soleil, merci à toute l\'équipe du Hangar 🙏', 0, 9, ['rooftop']);
    const P2 = post(djId.nokta, 'track', 'Nouvel edit techno en test ce week-end. Qui veut l\'écouter avant la sortie ?', 0, 7, [], { title: 'Night Train (NOKTA edit)', artist: 'NOKTA', bpm: 132 });
    const P3 = post(djId.kaya, 'question', 'Question aux DJs mariage : vous gérez comment les demandes de playlist des invités pendant la soirée ? Fiche papier, QR code, vous refusez tout ?', -1, 20);
    const P4 = post(djId.anjara, 'post', '5 ans de Plavace au Ninkasi Cordeliers : merci Lyon ❤️ Prochaine date : Girls in Lyon au Sound Club.', -2, 13, ['anjaraFull']);
    const P5 = post(djId.silex, 'gear', 'Je passe du DJM-900 à un mixer rotatif. Des retours sur le grain et la prise en main en drum & bass ?', -2, 18, ['redmixer']);
    const P6 = post(djId.dida, 'collab', 'Je cherche un·e DJ amapiano à Lyon pour un back-to-back au prochain Afro Brunch. Écrivez-moi !', -3, 11, ['party']);
    const P7 = post(djId.beton, 'track', 'Mon edit disco du week-end, en libre écoute. Fait à partir d\'un sample libre de droits.', -4, 21, ['amber'], { title: 'Boogie Béton (edit)', artist: 'BÉTON BLEU', bpm: 118 });
    const P8 = post(djId.marlow, 'post', 'Première au Festival Nord Électro. Je n\'ai toujours pas redescendu.', -5, 12, ['lights']);
    const P9 = post(djId.lune, 'question', 'Vos meilleurs morceaux pour faire la transition entre hip-hop et afrobeats sans casser l\'énergie ?', -6, 22);
    const P10 = post(djId.amaya, 'post', 'Nouvelle résidence le vendredi à Paris. On commence doucement, on finit en perreo.', -7, 19, ['hands']);
    const P11 = post(djId.pastel, 'gear', 'Astuce mariage : toujours prévoir une deuxième clé USB et un micro HF de secours. Toujours.', -9, 10, ['controller']);
    const P12 = post(djId.anjara, 'question', 'Je cherche des edits baile funk et shatta pour mes prochains sets. Vous avez des recos (libres de droits ou avec autorisation) ?', -15, 18);
    const P13 = post(members[1], 'track', 'Mon mashup du moment 🔥', -3, 23, [], { title: 'Mashup sans titre', artist: 'Inconnu', bpm: 124 });
    const P14 = post(djId.rizzo, 'post', 'Premier set à 150 BPM devant 400 personnes. Merci Strasbourg.', -8, 2, ['night']);
    const P15 = post(orgId.contrejour, 'post', 'Contre-Jour #12 sur la péniche avec Anjara aux platines. Billetterie bientôt ouverte !', -1, 17, ['crowd2']);
    const P16 = post(djId.osmose, 'gear', 'Ma valise vinyles pour un set de 3 h : 70 disques, pas un de plus.', -12, 15, ['vinyl']);
    insert('INSERT INTO posts (author_id, kind, body, shared_post_id, created_at) VALUES (?, ?, ?, ?, ?)', djId.dida, 'post', 'Qui a des recos pour Anjara ? 👇', P12, ts(-14, 10));
    const comment = (p, a, body, days, h) => insert('INSERT INTO comments (post_id, author_id, body, created_at) VALUES (?, ?, ?, ?)', p, a, body, ts(days, h));
    comment(P1, djId.anjara, 'La vue de ce rooftop 😍', 0, 10);
    comment(P2, djId.marlow, 'Envoie, je le teste vendredi à Lille.', 0, 8);
    comment(P3, djId.pastel, 'QR code vers un formulaire, et je filtre. Ça évite les débats en cabine.', -1, 21);
    comment(P3, djId.amaya, 'Je demande aux mariés une liste « interdite » avant la soirée, ça règle 90 % des cas.', -1, 22);
    comment(P4, djId.nokta, 'Bravo ! Le Hangar c\'est une autre dimension.', -11, 15);
    comment(P5, djId.nokta, 'Le rotatif change tout pour les transitions longues. Pour la DnB, plus délicat.', -2, 19);
    comment(P6, djId.anjara, 'Je connais quelqu\'un, je te mets en contact en privé.', -3, 12);
    comment(P9, djId.kaya, 'Passer par un titre afro-trap autour de 100 BPM marche très bien.', -6, 23);
    comment(P12, djId.dida, 'Demande à KAYA SOUND, il a plein d\'edits shatta 🔥', -15, 19);
    for (const [p, n] of [[P1, 14], [P2, 9], [P3, 7], [P4, 21], [P5, 5], [P6, 6], [P7, 8], [P8, 12], [P9, 4], [P10, 9], [P11, 11], [P12, 18], [P14, 10], [P15, 13], [P16, 7]]) {
      const pool = [...all12, ...members].sort(() => rnd() - 0.5).slice(0, n);
      for (const u of pool) run('INSERT OR IGNORE INTO reactions (post_id, user_id, created_at) VALUES (?, ?, ?)', p, u, ts(-Math.floor(rnd() * 3)));
    }
    run('INSERT INTO reports (post_id, reporter_id, reason, created_at) VALUES (?, ?, ?, ?)', P13, djId.beton, "Droits d'auteur", ts(-2, 9));

    // Messagerie
    const conv = (title, members, msgs) => {
      const c = insert('INSERT INTO conversations (title, is_group, created_at) VALUES (?, ?, ?)', title, members.length > 2 ? 1 : 0, ts(-30));
      for (const m of members) run('INSERT INTO conversation_members (conversation_id, user_id, last_read_at) VALUES (?, ?, ?)', c, m, m === members[0] ? ts(-1, 9) : ts(0, 23));
      for (const [who, body, days, h, mi] of msgs) insert('INSERT INTO messages (conversation_id, sender_id, body, created_at) VALUES (?, ?, ?, ?)', c, who, body, ts(days, h, mi || 0));
    };
    conv(null, [djId.anjara, orgId.contrejour], [
      [orgId.contrejour, 'Hello Anjara ! On a reçu ton devis pour la #12, c\'est validé de notre côté 🎉', -16, 18],
      [djId.anjara, 'Super ! Je serai là vers 23 h pour l\'installation. Le lieu a bien deux CDJ et une DJM ?', -16, 19],
      [orgId.contrejour, 'Oui : 2 × CDJ-3000 et une DJM-900. On t\'envoie la fiche technique.', -16, 19, 30],
      [orgId.contrejour, 'Petite question : tu peux nous faire un clip de 30 s pour annoncer la soirée ?', 0, 10],
    ]);
    conv(null, [djId.anjara, djId.nokta], [
      [djId.nokta, 'J\'ai écouté Log Drum Theory, très propre. Ça te dirait un B2B afro/techno un de ces jours ?', -4, 21],
      [djId.anjara, 'Carrément ! On pourrait proposer ça au Hangar pour le closing.', -4, 22],
      [djId.nokta, 'Je leur en parle. Je te tiens au courant.', -3, 9],
    ]);
    conv('B2B Lyon', [djId.anjara, djId.dida, djId.rizzo], [
      [djId.dida, 'On organise un warm-up commun avant le Brunch #7 ?', -2, 14],
      [djId.rizzo, 'Je suis chaud si on garde la techno pour la fin 😅', -2, 15],
      [djId.anjara, 'Ok pour moi, dimanche prochain ?', -1, 11],
    ]);

    // ───────── Business Studio d'Anjara (privé)
    // Repris de son outil « Anjara Booking » : vraies dates, factures et prospects.
    // Ses coordonnées personnelles (adresse, téléphone, IBAN, SIRET) ne sont volontairement pas reprises.
    const V = djId.anjara;
    run('UPDATE users SET is_demo = 0 WHERE id = ?', V); // profil réel
    run('UPDATE dj_profiles SET tagline = ?, instagram = ?, presskit_url = ?, booking_email = ?, cover = ? WHERE user_id = ?',
      'DJ basée à Lyon, Anjara se distingue par une énergie brute et une vraie polyvalence derrière les platines.',
      '@anjaraaaa', 'https://drive.google.com/drive/folders/1ArUfnN9PXZzYL4dQy2E6h7MdUw2yY6RC', 'anjara.booking@gmail.com', PH.crowd1, V);
    run('INSERT INTO studio_settings (owner_id, legal_name, vat_mode, legal_status, monthly_goal) VALUES (?, ?, ?, ?, ?)', V, 'Solène Hary — DJ Anjara', 'franchise', 'micro-entreprise', 700);
    const at = iso => `${iso}T12:00:00.000Z`;
    const contact = (name, city, stage, value, tags, notes, follow, created) => insert(`INSERT INTO studio_contacts (owner_id, name, city, tags, stage, value, notes, next_follow_up, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, V, name, city, JSON.stringify(tags), stage, value, notes, follow, created, created);
    const C = {
      plavace: contact('Plavace Project', 'Lyon', 'won', 150, ['Collectif', 'Récurrent'], 'Instagram : @plavace.plv. Plavace, St Valentin x Plavace, puis les 5 ans au Ninkasi Cordeliers.', null, at('2026-02-01')),
      gil: contact('Girls in Lyon', 'Lyon', 'won', 250, ['Soirée récurrente'], 'Organisé par LMV Multi Services. Dates en février, septembre et novembre.', null, at('2026-02-01')),
      hypemada: contact('Hypemada', 'Vitry-sur-Seine', 'won', 100, ['Collectif'], 'Fête de la musique et Mansa en juin.', null, at('2026-06-01')),
      fzn: contact('FZN Entertainment', 'Brighton (Royaume-Uni)', 'won', 70, ['Étranger'], 'Client étranger : facture sans TVA française.', null, at('2026-05-15')),
      hon: contact('House of Nine', 'Suisse', 'won', 321, ['Suisse'], 'Facturé 300 CHF.', null, at('2026-06-10')),
      geneve: contact('Ville de Genève', 'Genève', 'won', 642, ['Institution', 'Suisse'], 'Fête nationale suisse au Parc La Grange. Facturé 600 CHF.', null, at('2026-07-10')),
      shatta: contact('Madame Shatta', 'Paris', 'won', 80, ['Soirée récurrente', 'Shatta'], 'Instagram : @madameshatta. XXL édition à La Fav.', null, at('2026-09-01')),
      afrotouch: contact('Afro Touch', 'Lyon', 'won', 200, ['Collectif'], 'La Cherry au Little Pub (soirée partagée avec Emjee). Halloween à Tignieu annulé.', null, at('2026-09-20')),
      tr: contact('TR (Le Sucre)', 'Lyon', 'won', 150, ['Salle de concert'], '1re partie de Bamby au Sucre.', null, at('2026-10-20')),
      tsara: contact('Tsara Shatta', 'Rennes', 'negotiation', 0, ['Shatta'], 'Date du 18 décembre à Rennes : cachet encore à confirmer.', addDays(today(), 3), at('2026-10-27')),
      ensemble: contact('ENSEMBLE', 'Paris', 'to_contact', null, ['Collectif', 'Rap', 'Afro', 'Amapiano', 'Caribéen'], 'Instagram : @ensemblee_', addDays(today(), 2), at('2026-10-08')),
      motel: contact('MOTEL CAMPO', 'Genève', 'to_contact', null, ['Collectif', 'Baile funk'], 'Instagram : @motel_campo. Lieu : Motel Campo.', addDays(today(), 5), at('2026-10-08')),
      inseec: contact('INSEEC', null, 'follow_up', null, ['École', 'Trap'], 'Contactée le 8 octobre, sans réponse depuis.', today(), at('2026-10-08')),
      // Contacts issus de la marketplace AFTR (organisateurs fictifs de la démo)
      contrejour: contact('Collectif Contre-Jour', 'Paris', 'won', 350, ['Collectif', 'Via AFTR'], 'Booking confirmé via la marketplace pour la #12.', null, ts(-18)),
      hf: contact('Agence Haute Fréquence', 'Paris', 'quote_sent', 550, ['Agence', 'Via AFTR'], 'Lancement produit Nova : devis envoyé via AFTR.', d(3), ts(-6)),
      bde: contact("BDE Sup'Com Lyon", 'Lyon', 'waiting', 400, ['Étudiant', 'Via AFTR'], 'Demande reçue sur AFTR pour le gala.', d(1), ts(-2)),
      hangar: contact('Le Hangar 9', 'Bordeaux', 'new', 400, ['Club', 'Via AFTR'], 'Demande pour la salle shatta du closing.', d(1), ts(-1)),
    };
    const act = (c, kind, body, when) => insert('INSERT INTO studio_activities (owner_id, contact_id, kind, body, created_at) VALUES (?, ?, ?, ?, ?)', V, c, kind, body, when);
    act(C.inseec, 'email', 'Premier message envoyé.', at('2026-10-08'));
    act(C.plavace, 'note', '5 ans de Plavace au Ninkasi Cordeliers : set de 2 h à 4 h.', at('2026-11-07'));
    act(C.afrotouch, 'note', 'Halloween à Tignieu annulé (transport).', at('2026-10-27'));
    act(C.tsara, 'note', 'Date calée au 18 décembre, cachet à fixer.', at('2026-10-27'));
    act(C.hf, 'email', 'Devis envoyé depuis la demande AFTR.', ts(-5));
    const task = (c, title, due, done = 0) => insert('INSERT INTO studio_tasks (owner_id, contact_id, title, due_date, done, created_at) VALUES (?, ?, ?, ?, ?, ?)', V, c, title, due, done, ts(-2));
    task(C.plavace, 'Envoyer la facture des 5 ans Plavace', today());
    task(C.gil, 'Récupérer le rider pour Girls in Lyon au Sound Club', today());
    task(C.inseec, 'Relancer INSEEC', today());
    task(C.tsara, 'Confirmer le cachet avec Tsara Shatta', d(3));
    task(C.ensemble, 'Premier message à ENSEMBLE', d(2));
    task(null, 'Préparer la playlist Contre-Jour #12', d(12));

    // Dates hors plateforme (réseau personnel), avec feuille de route
    const gig = (c, title, client, date, start, end, venue, address, city, fee, status, extra = {}) => insert(`INSERT INTO studio_gigs (owner_id, contact_id, title, client_name, date, start_time, end_time, venue, address, city, fee, status, rider, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, V, c, title, client, date, start, end, venue, address, city, fee, status, extra.rider ?? null, extra.notes ?? null, at(date));
    const G = {
      plavace: gig(C.plavace, 'Plavace', 'Plavace Project', '2026-02-10', null, null, null, null, 'Lyon', 150, 'done'),
      valentin: gig(C.plavace, 'St Valentin x Plavace', 'Plavace Project', '2026-02-14', null, null, null, null, 'Lyon', 200, 'done'),
      gil1: gig(C.gil, 'Girls in Lyon', 'Girls in Lyon', '2026-02-23', null, null, null, null, 'Lyon', 250, 'done'),
      fzn: gig(C.fzn, 'FZN', 'FZN Entertainment', '2026-05-30', null, null, null, null, null, 70, 'done'),
      fdlm: gig(C.hypemada, 'Fête de la musique', 'Hypemada', '2026-06-21', null, null, null, null, null, 100, 'done'),
      mansa: gig(C.hypemada, 'Mansa', 'Hypemada', '2026-06-24', null, null, null, null, null, 100, 'done'),
      hon: gig(C.hon, 'House of Nine', 'House of Nine', '2026-06-26', null, null, null, null, 'Suisse', 321, 'done', { notes: 'Cachet de 300 CHF.' }),
      geneve: gig(C.geneve, 'Fête nationale suisse', 'Ville de Genève', '2026-08-01', '23:00', '01:00', 'Parc La Grange', null, 'Genève', 642, 'done', { notes: 'Cachet de 600 CHF.' }),
      gil2: gig(C.gil, 'Girls In Lyon', 'Girls in Lyon', '2026-09-19', '23:00', '04:00', "L'Arène Club", null, 'Lyon', 250, 'done'),
      shatta: gig(C.shatta, 'Madame Shatta XXL édition', 'Madame Shatta', '2026-09-26', '02:00', '03:00', 'La Fav', null, 'Paris', 80, 'done'),
      cherry: gig(C.afrotouch, 'La Cherry / Afro Touch', 'Afro Touch', '2026-10-10', '23:00', '04:00', 'Little Pub', '1 rue Saint-Benoît, 69001 Lyon', 'Lyon', 200, 'done', { rider: 'S11 + 1 CDJ ?', notes: 'Soirée partagée avec Emjee.' }),
      halloween: gig(C.afrotouch, 'Halloween', 'Afro Touch', '2026-10-31', '23:00', '04:00', null, null, 'Tignieu', 500, 'cancelled', { notes: 'Annulée.' }),
      plavace5: gig(C.plavace, '5 ans Plavace', 'Plavace Project', '2026-11-06', '02:00', '04:00', 'Ninkasi Cordeliers', '1 rue Président Carnot, Lyon', 'Lyon', 150, 'done', { rider: 'À redemander' }),
      gil3: gig(C.gil, "Girl's In Lyon", 'Girls in Lyon', '2026-11-10', '04:00', '06:00', 'Sound Club', '73 rue du Bourbonnais, 69009 Lyon', 'Lyon', 250, 'confirmed', { rider: 'Rev 5 de Eli' }),
      bamby: gig(C.tr, '1re partie de Bamby', 'TR (Le Sucre)', '2026-11-21', '20:00', '20:25', 'Le Sucre', '50 quai Rambaud, Lyon', 'Lyon', 150, 'confirmed'),
      tsara: gig(C.tsara, 'Tsara Shatta', 'Tsara Shatta', '2026-12-18', null, null, null, null, 'Rennes', null, 'option', { notes: 'Cachet à confirmer.' }),
    };

    // Devis issus de la marketplace (organisateurs fictifs)
    const line = (label, qty, price) => ({ label, qty, unit_price: price });
    const quote = (num, c, req, client, email, title, eventDay, lines, status, days, notes = null) => insert(`INSERT INTO studio_quotes (owner_id, number, contact_id, request_id, client_name, client_email, client_address, title, event_date, lines, vat_rate, status, notes, valid_until, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`, V, num, c, req, client, email, null, title, d(eventDay), JSON.stringify(lines), status, notes, d(days + 30), ts(days));
    quote('DEV-2026-001', C.contrejour, R.cj12, 'Collectif Contre-Jour', 'contrejour@aftr.demo', 'Contre-Jour #12 — Péniche', 16, [line('DJ set 2 h (1 h – 3 h)', 1, 250), line('Déplacement Lyon–Paris', 1, 100)], 'accepted', -17, 'Set de 2 h, matériel du lieu.');
    quote('DEV-2026-002', C.hf, R.launch, 'Agence Haute Fréquence', 'hf@aftr.demo', 'Lancement produit Nova', 9, [line('DJ set afro / amapiano — 19 h 30 à 23 h', 1, 450), line("Sonorisation d'appoint", 1, 100)], 'sent', -5);

    // Factures réelles (numérotation reprise de son outil)
    const inv = (num, c, g, title, date, amount, status, issue, due, paid, notes = null) => insert(`INSERT INTO studio_invoices (owner_id, number, contact_id, gig_id, client_name, title, event_date, lines, vat_rate, status, issue_date, due_date, paid_at, notes, created_at)
      VALUES (?, ?, ?, ?, (SELECT name FROM studio_contacts WHERE id = ?), ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`, V, num, c, g, c, title, date, JSON.stringify([line(`DJ set — ${title}`, 1, amount)]), status, issue, due, paid, notes, at(issue));
    inv('FAC-2026-001', C.plavace, G.plavace, 'Plavace', '2026-02-10', 150, 'paid', '2026-02-10', '2026-03-12', '2026-10-08');
    inv('FAC-2026-002', C.plavace, G.valentin, 'St Valentin x Plavace', '2026-02-14', 200, 'paid', '2026-02-19', '2026-03-21', '2026-10-08');
    inv('FAC-2026-003', C.gil, G.gil1, 'Girls in Lyon', '2026-02-23', 250, 'paid', '2026-02-23', '2026-03-25', '2026-10-08');
    inv('FAC-2026-006', C.hypemada, G.fdlm, 'Fête de la musique', '2026-06-21', 100, 'paid', '2026-07-06', '2026-08-05', '2026-10-08');
    inv('FAC-2026-007', C.hypemada, G.mansa, 'Mansa', '2026-06-24', 100, 'paid', '2026-07-06', '2026-08-05', '2026-10-08');
    inv('FAC-2026-008', C.hon, G.hon, 'House of Nine', '2026-06-26', 321, 'paid', '2026-07-06', '2026-08-05', '2026-10-08', 'Facturé 300 CHF, converti en euros au taux de 1,07.');
    inv('FAC-2026-009', C.fzn, G.fzn, 'FZN', '2026-05-30', 70, 'paid', '2026-07-21', '2026-08-20', '2026-10-08');
    inv('FAC-2026-010', C.afrotouch, G.cherry, 'La Cherry / Afro Touch', '2026-10-10', 200, 'paid', '2026-10-10', '2026-11-09', '2026-10-27');
    inv('FAC-2026-011', C.plavace, G.plavace5, '5 ans Plavace', '2026-11-06', 150, 'draft', '2026-11-06', '2026-12-06', null);
    inv('FAC-2026-012', C.geneve, G.geneve, 'Fête nationale suisse', '2026-08-01', 642, 'paid', '2026-08-01', '2026-08-31', '2026-10-08', 'Facturé 600 CHF, converti en euros au taux de 1,07.');
    inv('FAC-2026-013', C.shatta, G.shatta, 'Madame Shatta XXL édition', '2026-09-26', 80, 'paid', '2026-09-26', '2026-10-26', '2026-10-08');
    inv('FAC-2026-014', C.gil, G.gil2, 'Girls In Lyon', '2026-09-19', 250, 'paid', '2026-10-08', '2026-10-19', '2026-11-08');
    inv('FAC-2026-016', C.tr, G.bamby, '1re partie de Bamby', '2026-11-21', 150, 'sent', '2026-10-27', '2026-12-21', null);
    inv('FAC-2026-018', C.gil, G.gil3, "Girl's In Lyon", '2026-11-10', 250, 'draft', '2026-11-10', '2026-12-10', null);

    // « Ma com' » : publications et abonnés d'EXEMPLE (marqués is_example, supprimables en un clic).
    // Ce ne sont pas les vraies statistiques d'Anjara : aucun compte de réseau social n'est connecté.
    const spost = (network, format, title, gig, status, planned, published, stats = [], caption = null) => insert(`INSERT INTO studio_posts (owner_id, network, format, title, caption, gig_id, status, planned_date, published_date, views, likes, comments, shares, saves, followers_gained, is_example, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`, V, network, format, title, caption, gig, status, planned, published, ...[0, 1, 2, 3, 4, 5].map(i => stats[i] ?? null), at(published || planned || today()));
    spost('Instagram', 'Carrousel', 'Annonce Girls In Lyon @ L\'Arène Club', G.gil2, 'published', null, '2026-09-16', [2100, 184, 22, 9, 31, 14]);
    spost('TikTok', 'Vidéo courte', 'Drop shatta — Madame Shatta XXL', G.shatta, 'published', null, '2026-09-27', [8400, 610, 48, 75, 92, 63]);
    spost('Instagram', 'Reel', 'Récap La Cherry / Afro Touch', G.cherry, 'published', null, '2026-10-11', [3900, 312, 27, 18, 44, 21]);
    spost('Instagram', 'Story', 'Dispos novembre', null, 'published', null, '2026-10-20', [950, 41, 6, 0, 0, 2]);
    spost('TikTok', 'Vidéo courte', 'Transition amapiano → baile funk', null, 'published', null, '2026-10-29', [12600, 980, 85, 140, 210, 118]);
    spost('Instagram', 'Reel', 'Récap 5 ans Plavace @ Ninkasi', G.plavace5, 'published', null, '2026-11-07', [4600, 401, 39, 26, 58, 30]);
    spost('Instagram', 'Carrousel', 'Annonce 1re partie de Bamby au Sucre', G.bamby, 'planned', '2026-11-18', null, [], 'Le 21/11, j\'ouvre pour Bamby au Sucre 🔥 On se voit là-bas ?');
    spost('TikTok', 'Vidéo courte', 'Le drop de la semaine', null, 'idea', null, null);
    for (const [network, rows] of [['Instagram', [['2026-08-01', 1180], ['2026-09-01', 1290], ['2026-10-01', 1410], ['2026-11-01', 1520], [today(), 1580]]], ['TikTok', [['2026-08-01', 420], ['2026-09-01', 510], ['2026-10-01', 690], ['2026-11-01', 880], [today(), 960]]]])
      for (const [dt, count] of rows) insert('INSERT INTO studio_followers (owner_id, network, date, count, is_example) VALUES (?, ?, ?, ?, 1)', V, network, dt, count);
    insert('INSERT INTO studio_marketing (owner_id, goal, target_city, posts_per_week) VALUES (?, ?, ?, ?)', V, 'dates_city', 'Paris', 3);

    // Messages types (repris de son outil de prospection)
    for (const [name, body] of [
      ['Premier contact', 'Salut {prenom} ! C’est {dj} ({insta}), DJ afrobeats / amapiano / gqom, avec du shatta, du rap et du baile funk dans les sets. Je suis vos soirées {soiree} et l’énergie me parle à fond. J’adorerais jouer chez vous : mon press kit avec mes vidéos de sets est ici 👉 {presskit}. Dispo pour en parler quand vous voulez !'],
      ['Relance', 'Re {prenom} ! Je me permets de relancer mon message pour {soiree}. Si vous cherchez quelqu’un pour une prochaine date, je suis dispo. Le press kit : {presskit}'],
      ['Merci après la date', 'Merci encore pour {soiree} ! Grosse ambiance, c’était un vrai plaisir de jouer pour vous. Je remets ça quand vous voulez 🔥'],
      ['Relance de facture', 'Bonjour {prenom}, petite relance concernant ma facture pour {soiree}, arrivée à échéance. Peux-tu me dire quand le virement est prévu ? Merci !'],
    ]) insert('INSERT INTO studio_templates (owner_id, name, body) VALUES (?, ?, ?)', V, name, body);

    // ───────── CRM interne AFTR : une fiche par membre + prospects de l'équipe
    const companies = {};
    for (const [k, name, kind, city] of [['hangar', 'Le Hangar 9', 'Club', 'Bordeaux'], ['hf', 'Agence Haute Fréquence', 'Agence événementielle', 'Paris'], ['bde', 'BDE Sup\'Com Lyon', 'Association étudiante', 'Lyon'],
      ['ivoire', 'Maison Ivoire Mariages', 'Wedding planner', 'Nantes'], ['berges', 'Festival Les Berges', 'Festival', 'Toulouse'], ['entrepot', 'Club L\'Entrepôt', 'Club', 'Lille'],
      ['panorama', 'Rooftop Panorama', 'Rooftop', 'Marseille'], ['ecole', 'École Pro DJ (fictive)', 'École', 'Paris'], ['mag', 'Magazine Basses Fréquences (fictif)', 'Média', 'Paris'], ['brasserie', 'Groupe Brasseries du Sud (fictif)', 'Bars', 'Montpellier']])
      companies[k] = insert('INSERT INTO admin_companies (name, kind, city, website, created_at) VALUES (?, ?, ?, ?, ?)', name, kind, city, null, ts(-150));
    const orgCompany = { [orgId.hangar]: companies.hangar, [orgId.hf]: companies.hf, [orgId.bde]: companies.bde, [orgId.ivoire]: companies.ivoire, [orgId.berges]: companies.berges };
    for (const u of [...Object.values(djId), ...Object.values(orgId).filter((v, i, a) => a.indexOf(v) === i && v !== djId.dida), ...members]) {
      run(`INSERT INTO admin_contacts (user_id, company_id, name, email, city, segment, stage, source, created_at)
        SELECT u.id, ?, COALESCE(d.stage_name, o.org_name, u.name), u.email, u.city,
          CASE WHEN d.user_id IS NOT NULL THEN 'dj' ELSE 'organizer' END, 'customer', u.source, u.created_at
        FROM users u LEFT JOIN dj_profiles d ON d.user_id = u.id LEFT JOIN organizer_profiles o ON o.user_id = u.id WHERE u.id = ?`, orgCompany[u] ?? null, u);
    }
    const lead = (name, email, city, seg, stage, source, company, tags, notes, days) => insert('INSERT INTO admin_contacts (name, email, city, segment, stage, source, company_id, tags, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      name, email, city, seg, stage, source, company, JSON.stringify(tags), notes, ts(days));
    const L = {
      entrepot: lead('Sophie Lambert', 'programmation@entrepot.exemple', 'Lille', 'venue', 'demo', 'Salon Nuits Pro', companies.entrepot, ['Club', 'Nord'], 'Démo de la marketplace faite, intéressée par l\'offre Organisateur Plus.', -40),
      panorama: lead('Damien Petit', 'contact@panorama.exemple', 'Marseille', 'venue', 'contacted', 'LinkedIn', companies.panorama, ['Rooftop'], null, -25),
      ecole: lead('Rachid Amrani', 'partenariats@ecole-pro-dj.exemple', 'Paris', 'partner', 'demo', 'Événement', companies.ecole, ['Formation', 'Partenariat'], 'Partenariat : 3 mois de DJ Pro offerts aux élèves contre visibilité.', -30),
      mag: lead('Élodie Vasseur', 'redaction@bassesfrequences.exemple', 'Paris', 'press', 'contacted', 'Relations presse', companies.mag, ['Presse'], 'Article sur les outils numériques des DJs.', -15),
      brasserie: lead('Olivier Garnier', 'events@brasseries-sud.exemple', 'Montpellier', 'organizer', 'lead', 'Prospection', companies.brasserie, ['Bars', 'Multi-sites'], '12 bars : potentiel de soirées récurrentes.', -20),
      lyonevents: lead('Agence Lyon Events (fictive)', 'hello@lyonevents.exemple', 'Lyon', 'organizer', 'lead', 'Prospection', null, ['Agence'], null, -22),
      wedding: lead('Studio Mariage Atlantique (fictif)', 'contact@mariage-atlantique.exemple', 'La Rochelle', 'organizer', 'lost', 'Google', null, ['Mariage'], 'Pas de besoin avant la saison prochaine.', -70),
    };
    const ai = (c, kind, body, days) => insert('INSERT INTO admin_interactions (contact_id, admin_id, kind, body, created_at) VALUES (?, ?, ?, ?, ?)', c, admin, kind, body, ts(days, 10));
    ai(L.entrepot, 'meeting', 'Démo de 30 min de la recherche de DJs et du suivi des demandes.', -10);
    ai(L.entrepot, 'email', 'Envoi de la plaquette Organisateur Plus.', -8);
    ai(L.ecole, 'call', 'Accord de principe sur le partenariat, contrat à rédiger.', -6);
    ai(L.panorama, 'email', 'Premier contact après la saison.', -25);
    const aTask = (c, title, days, done = 0) => insert('INSERT INTO admin_tasks (contact_id, title, due_date, done, created_at) VALUES (?, ?, ?, ?, ?)', c, title, d(days), done, ts(-2));
    aTask(L.entrepot, 'Envoyer l\'offre Organisateur Plus personnalisée', 1);
    aTask(L.ecole, 'Rédiger la convention de partenariat', 4);
    aTask(L.mag, 'Préparer les chiffres clés pour l\'article', 6);
    aTask(L.panorama, 'Relancer avec le comparatif des offres', 2);
    aTask(L.brasserie, 'Premier appel de découverte', 1);
    aTask(L.lyonevents, 'Envoyer la présentation AFTR par e-mail', 3);
    aTask(L.wedding, 'Recontacter en février avant la saison des mariages', 90);

    // Pipeline commercial : un membre payant est « Gagné », un inscrit gratuit est un prospect pour l'offre payante
    run(`UPDATE admin_contacts SET stage = 'lead' WHERE user_id IS NOT NULL AND user_id NOT IN
      (SELECT user_id FROM subscriptions WHERE plan IN ('dj_pro', 'org_plus') AND status = 'active')`);
    const free = all("SELECT id, name, segment FROM admin_contacts WHERE user_id IS NOT NULL AND stage = 'lead' ORDER BY id");
    free.forEach((c, i) => {
      if (i % 5 === 1) { run("UPDATE admin_contacts SET stage = 'contacted' WHERE id = ?", c.id); ai(c.id, 'email', c.segment === 'dj' ? 'E-mail : présentation de DJ Pro (devis, factures, Set Clipper).' : 'E-mail : présentation d\'Organisateur Plus.', -(3 + i % 9)); aTask(c.id, 'Relancer si pas de réponse', 1 + i % 6); }
      else if (i % 7 === 2) { run("UPDATE admin_contacts SET stage = 'demo' WHERE id = ?", c.id); ai(c.id, 'call', 'Appel : besoins validés, proposition envoyée (offre annuelle).', -(2 + i % 5)); aTask(c.id, 'Appeler pour la décision sur la proposition', 2 + i % 4); }
      else if (i % 11 === 4) { run("UPDATE admin_contacts SET stage = 'lost' WHERE id = ?", c.id); ai(c.id, 'note', 'Pas intéressé pour l\'instant : reste en formule gratuite.', -(10 + i % 20)); }
      else if (i % 3 === 0) aTask(c.id, 'Envoyer l\'e-mail de bienvenue et proposer un essai Pro', 1 + i % 8);
    });
    // Coordonnées fictives (indicatif réservé à la fiction)
    for (const c of all('SELECT id FROM admin_contacts WHERE phone IS NULL')) run('UPDATE admin_contacts SET phone = ? WHERE id = ?', `06 00 00 ${String(10 + c.id % 89).padStart(2, '0')} ${String(c.id * 7 % 100).padStart(2, '0')}`, c.id);
    // Commandes historiques (paiement simulé) des membres payants
    for (const sb of all("SELECT s.user_id, s.plan, s.started_at, c.id contact_id, c.name, c.email, c.city, c.source FROM subscriptions s JOIN admin_contacts c ON c.user_id = s.user_id WHERE s.plan IN ('dj_pro', 'org_plus') AND s.status = 'active'")) {
      const period = sb.user_id % 2 ? 'yearly' : 'monthly', p = priceOf(sb.plan, period);
      insert('INSERT INTO orders (ref, offer, period, amount_ht, vat, amount_ttc, name, email, city, source, contact_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        `CMD-2026-${(1000 + sb.user_id).toString(16).toUpperCase()}`, sb.plan, period, p.ht, p.vat, p.ttc, sb.name, sb.email, sb.city, sb.source, sb.contact_id, sb.started_at);
    }

    // Support
    const ticket = (userIdOrNull, name, email, subject, category, status, priority, days, msgs) => {
      const t = insert('INSERT INTO support_tickets (user_id, name, email, subject, category, status, priority, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', userIdOrNull, name, email, subject, category, status, priority, ts(days, 9));
      for (const [author, body, dd] of msgs) insert('INSERT INTO ticket_messages (ticket_id, author, body, created_at) VALUES (?, ?, ?, ?)', t, author, body, ts(dd, 10));
    };
    ticket(djId.rizzo, 'RIZZO', 'rizzo@aftr.demo', 'Ma photo de profil ne s\'affiche pas', 'Compte', 'open', 'normal', -1, [['client', 'J\'ai envoyé une photo mais elle n\'apparaît pas sur mon profil public.', -1]]);
    ticket(orgId.ivoire, 'Maison Ivoire Mariages', 'ivoire@aftr.demo', 'Modifier la date d\'une demande envoyée', 'Réservation', 'pending', 'high', -3, [['client', 'Le mariage a été avancé d\'une semaine, comment modifier ma demande ?', -3], ['aftr', 'Bonjour ! Pour l\'instant il faut annuler puis renvoyer la demande. La modification directe arrive bientôt.', -2]]);
    ticket(null, 'Thomas Girard', 'thomas.g@exemple.fr', 'Partenariat avec notre salle', 'Partenariat', 'open', 'normal', 0, [['client', 'Nous gérons une salle de 800 places à Rennes et aimerions référencer nos soirées.', 0]]);
    ticket(djId.osmose, 'OSMOSE', 'osmose@aftr.demo', 'Facture : ajouter mon numéro de TVA', 'Compte', 'resolved', 'low', -20, [['client', 'Je passe au régime réel, où ajouter mon numéro de TVA ?', -20], ['aftr', 'Dans Studio > Factures > Mes informations. Tu peux aussi choisir la TVA à 20 % sur chaque document.', -19]]);

    // ───────── Marketing
    const camp = (name, objective, channel, sourceKey, s, e, budget, status) => insert('INSERT INTO campaigns (name, objective, channel, source_key, start_date, end_date, budget, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', name, objective, channel, sourceKey, d(s), d(e), budget, status, ts(s - 10));
    const c1 = camp('Rentrée des organisateurs', 'Inscriptions d\'organisateurs', 'LinkedIn + Instagram', 'Campagne Rentrée', -60, -30, 300, 'published');
    const c2 = camp('Clips de DJs sur TikTok', 'Inscriptions de DJs', 'TikTok', 'TikTok', -21, 10, 150, 'published');
    camp('Fêtes de fin d\'année', 'Réservations', 'Instagram + Newsletter', 'Campagne Noël', 15, 45, 400, 'draft');
    const content = (network, topic, target, objective, tone, format, hook, caption, cta, hashtags, visual, day, status, campaign) => insert(`INSERT INTO marketing_contents (network, topic, target, objective, tone, format, idea, hook, caption, cta, hashtags, visual, scheduled_date, status, campaign_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, network, topic, target, objective, tone, format, `${format} — ${topic}`, hook, caption, cta, hashtags, visual, d(day), status, campaign ?? null, ts(day - 5));
    content('Instagram', 'Portrait d\'Anjara', 'DJs et organisateurs', 'Notoriété', 'Inspirant', 'Carrousel', 'Elle fait lever Lyon chaque mois. Rencontre avec Anjara 👇', 'Afro, amapiano, shatta : une énergie brute derrière les platines.', 'Découvre son profil sur AFTR.', '#DJ #AfroHouse #Lyon #AFTR', 'Photo plein cadre + 3 cartes citations', -6, 'published', null);
    content('TikTok', 'Le drop de la semaine', 'DJs', 'Inscriptions', 'Fun', 'Vidéo courte', 'POV : le drop que personne n\'attendait', 'Le clip de la semaine vient de la communauté AFTR.', 'Partage tes clips sur AFTR.', '#DJTok #Drop #AFTR', 'Clip vertical Set Clipper', -2, 'published', c2);
    content('LinkedIn', 'Réserver un DJ pour un événement d\'entreprise', 'Agences et RH', 'Inscriptions', 'Expert', 'Post texte', '3 erreurs à éviter quand on réserve un DJ pour un séminaire.', 'Brief flou, budget irréaliste, fiche technique oubliée…', 'Trouve ton DJ en 3 filtres sur AFTR.', '#Événementiel #RH #AFTR', 'Photo coulisses + chiffre clé', 3, 'scheduled', null);
    content('Instagram', 'Contre-Jour #12 avec Anjara', 'Public parisien', 'Engagement', 'Communautaire', 'Reel', 'Péniche, coucher de soleil, afro house.', 'Contre-Jour #12 arrive…', 'Dis-nous qui tu emmènes en commentaire.', '#ContreJour #AfroHouse #Paris', 'Reel 15 s issu du Set Clipper', 12, 'approved', null);
    content('Facebook', 'Groupes BDE : comment budgéter un DJ', 'Associations étudiantes', 'Inscriptions', 'Expert', 'Post texte', 'Gala, intégration, afterwork : combien prévoir pour un DJ ?', 'Les fourchettes de prix des DJs sur AFTR…', 'Compare les profils sur AFTR.', '#BDE #Gala #Soirée', 'Visuel infographie jaune et noir', 7, 'review', null);
    content('TikTok', 'Tuto transition hip-hop → afrobeats', 'DJs débutants', 'Engagement', 'Fun', 'Vidéo courte', 'La transition que tout le monde rate', null, null, '#DJTips #Transition', 'Écran partagé platines / waveform', 18, 'draft', null);
    content('Instagram', 'Calendrier des soirées de décembre', 'Public', 'Notoriété', 'Communautaire', 'Carrousel', null, null, null, null, null, 26, 'idea', null);
    content('LinkedIn', 'Bilan : 3 mois de marketplace', 'Partenaires', 'Notoriété', 'Expert', 'Post texte', null, null, null, null, null, -20, 'archived', c1);
    const nl = (subject, preheader, body, cta, segment, day, status, recipients) => insert('INSERT INTO newsletters (subject, preheader, body, cta_label, cta_url, segment, scheduled_date, status, outbox_at, recipients, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      subject, preheader, body, cta, '/artistes', segment, d(day), status, status === 'outbox' ? ts(day) : null, recipients, ts(day - 4));
    nl('Les nouveaux DJs du mois', '12 profils à découvrir, du dancehall à la hard techno.', 'Bonjour,\n\nCe mois-ci, la communauté AFTR accueille de nouveaux talents : AMAYA (reggaeton, Paris), RIZZO (hard techno, Strasbourg) et bien d\'autres.\n\nÀ très vite sur le dancefloor.', 'Découvrir les DJs', 'organizers', -14, 'outbox', 19);
    nl('Fêtes de fin d\'année : réservez votre DJ', 'Les meilleures dates partent vite.', 'Bonjour,\n\nLes soirées de décembre se préparent maintenant. Retrouvez sur AFTR les DJs disponibles près de chez vous, filtrés par style et budget.', 'Trouver un DJ', 'organizers', 10, 'scheduled', null);
    nl('Nouveau : le Set Clipper', 'Transforme ton set en clips pour les réseaux.', 'Importe ta vidéo, laisse la détection repérer les drops et exporte tes clips en 9:16.', 'Essayer le Set Clipper', 'djs', 20, 'draft', null);
    for (const u of [...Object.values(orgId), ...members.filter((_, i) => i % 5 === 0)].slice(0, 19)) insert('INSERT INTO outbox (to_email, subject, body, origin, created_at) VALUES ((SELECT email FROM users WHERE id = ?), ?, ?, ?, ?)', u, 'Les nouveaux DJs du mois', '…', 'newsletter #1', ts(-14));
    for (const [key, name, desc, enabled] of [
      ['welcome', 'Bienvenue des nouveaux utilisateurs', 'Notification + e-mail de bienvenue aux inscrits des 7 derniers jours.', 1],
      ['incomplete_profile', 'Relance des profils incomplets', 'Notifie les DJs dont le profil est complété à moins de 60 %.', 1],
      ['prospect_follow_up', 'Relance des prospects', 'Crée une tâche dans le CRM pour chaque prospect sans échange depuis 14 jours.', 1],
      ['booking_follow_up', 'Suivi des demandes de réservation', 'Rappelle aux DJs les demandes sans réponse (3 j) et aux organisateurs les devis en attente (5 j).', 1],
      ['review_request', 'Demandes d\'avis', 'Invite les organisateurs à noter les prestations réalisées.', 1],
      ['reactivation', 'Réactivation des inactifs', 'Prépare un e-mail pour les membres inactifs depuis 30 jours.', 0],
    ]) insert('INSERT INTO automations (key, name, description, enabled) VALUES (?, ?, ?, ?)', key, name, desc, enabled);
    insert('INSERT INTO automation_runs (automation_id, matched, detail, created_at) VALUES (1, 3, ?, ?)', '3 message(s) de bienvenue', ts(-7, 8));
    run('UPDATE automations SET last_run_at = ? WHERE id = 1', ts(-7, 8));

    // Notifications d'Anjara
    const n = (u, kind, title, body, link, days, h, read = 0) => insert('INSERT INTO notifications (user_id, kind, title, body, link, read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', u, kind, title, body, link, read, ts(days, h));
    n(V, 'booking', 'Nouvelle demande de réservation', `Closing de saison — salle 2 (shatta) · ${d(60)}`, `/app/reservations/${R.wedding}`, -1, 9);
    n(V, 'booking', 'Nouvelle demande de réservation', `Gala de fin de semestre · ${d(30)}`, `/app/reservations/${R.gala}`, -2, 14);
    n(V, 'comment', 'NOKTA a commenté ta publication', 'Bravo ! Le Hangar c\'est une autre dimension.', '/app/fil', -11, 15, 1);
    n(V, 'follow', 'AMAYA te suit désormais', null, `/app/membres/${djId.amaya}`, -3, 12);
    n(orgId.contrejour, 'booking', 'Booking confirmé 🎉', `Contre-Jour #12 — Péniche · ${d(16)}`, `/app/reservations/${R.cj12}`, -16, 18, 1);
    n(orgId.hf, 'booking', 'Tu as reçu un devis', 'Lancement produit Nova · 900 €', `/app/reservations/${R.launch}`, -5, 16);
  });
}
