// Base SQLite intégrée à Node (node:sqlite) : aucun service ni dépendance à installer.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// Sur Vercel, seul /tmp est inscriptible : la base y est recréée à chaque démarrage d'instance
export const DATA_DIR = process.env.AFTR_DATA_DIR || (process.env.VERCEL ? '/tmp/aftr' : join(ROOT, 'data'));
export const UPLOAD_DIR = join(DATA_DIR, 'uploads');
const DB_FILE = join(DATA_DIR, 'aftr.db');

const SCHEMA = `
PRAGMA foreign_keys = ON;

-- ───────── Identité commune
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar TEXT,
  city TEXT,
  bio TEXT,
  theme TEXT NOT NULL DEFAULT 'auto',
  source TEXT,                       -- canal d'acquisition déclaré à l'inscription
  suspended INTEGER NOT NULL DEFAULT 0,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  last_active_at TEXT
);
CREATE TABLE user_roles (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('dj','organizer','admin')),
  PRIMARY KEY (user_id, role)
);
CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE TABLE dj_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  stage_name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  styles TEXT NOT NULL DEFAULT '[]',
  event_types TEXT NOT NULL DEFAULT '[]',
  price_min INTEGER, price_max INTEGER,
  experience_years INTEGER,
  photo TEXT, cover TEXT,
  gallery TEXT NOT NULL DEFAULT '[]',
  tracks TEXT NOT NULL DEFAULT '[]',
  experiences TEXT NOT NULL DEFAULT '[]',
  accent TEXT,
  tagline TEXT,                      -- accroche du press kit
  instagram TEXT, presskit_url TEXT, booking_email TEXT, mix_url TEXT,
  marketplace_visible INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE dj_blocked_dates (
  dj_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL, reason TEXT,
  PRIMARY KEY (dj_id, date)
);
CREATE TABLE organizer_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  org_name TEXT NOT NULL,
  org_type TEXT,
  description TEXT,
  photo TEXT
);
CREATE TABLE reviews (
  id INTEGER PRIMARY KEY,
  dj_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_id INTEGER,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE favorites (
  organizer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dj_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (organizer_id, dj_id)
);
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- ───────── Marketplace (partagé entre DJ et organisateur concernés)
CREATE TABLE events (
  id INTEGER PRIMARY KEY,
  organizer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  start_time TEXT, end_time TEXT,
  city TEXT, venue TEXT,
  event_type TEXT,
  styles TEXT NOT NULL DEFAULT '[]',
  capacity INTEGER,
  budget INTEGER,
  description TEXT,
  photo TEXT,
  status TEXT NOT NULL DEFAULT 'planning',   -- planning | dj_found | done | cancelled
  created_at TEXT NOT NULL
);
CREATE TABLE booking_requests (
  id INTEGER PRIMARY KEY,
  dj_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organizer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
  event_title TEXT NOT NULL,
  event_type TEXT,
  date TEXT NOT NULL,
  start_time TEXT, end_time TEXT,
  city TEXT, venue TEXT,
  budget INTEGER,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',     -- pending | quoted | confirmed | declined | cancelled | completed
  quote_amount INTEGER,
  quote_message TEXT,
  address TEXT, arrival_time TEXT, rider TEXT, onsite_contact TEXT, roadmap_notes TEXT,  -- feuille de route
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE booking_history (
  id INTEGER PRIMARY KEY,
  request_id INTEGER NOT NULL REFERENCES booking_requests(id) ON DELETE CASCADE,
  actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);

-- ───────── Communauté
CREATE TABLE posts (
  id INTEGER PRIMARY KEY,
  author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'post',          -- post | track | question | gear | collab
  body TEXT,
  media TEXT NOT NULL DEFAULT '[]',
  track TEXT,
  shared_post_id INTEGER REFERENCES posts(id) ON DELETE SET NULL,
  hidden INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE comments (
  id INTEGER PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE reactions (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (post_id, user_id)
);
CREATE TABLE follows (
  follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (follower_id, followee_id)
);
CREATE TABLE reports (
  id INTEGER PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',        -- open | dismissed | removed
  created_at TEXT NOT NULL
);
CREATE TABLE conversations (
  id INTEGER PRIMARY KEY,
  title TEXT,
  is_group INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE conversation_members (
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at TEXT,
  PRIMARY KEY (conversation_id, user_id)
);
CREATE TABLE messages (
  id INTEGER PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- ───────── DJ Business Studio : PRIVÉ, chaque ligne appartient à un DJ (owner_id).
-- Aucune route admin ne lit ces tables (voir server/routes/admin.js).
CREATE TABLE studio_contacts (
  id INTEGER PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company TEXT, job TEXT, email TEXT, phone TEXT, city TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  stage TEXT NOT NULL DEFAULT 'new',
  value INTEGER,
  notes TEXT,
  next_follow_up TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE studio_activities (
  id INTEGER PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id INTEGER NOT NULL REFERENCES studio_contacts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                         -- note | call | email | meeting | stage
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE studio_tasks (
  id INTEGER PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id INTEGER REFERENCES studio_contacts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_date TEXT,
  done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE studio_quotes (
  id INTEGER PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  number TEXT NOT NULL,
  contact_id INTEGER REFERENCES studio_contacts(id) ON DELETE SET NULL,
  request_id INTEGER REFERENCES booking_requests(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL, client_email TEXT, client_address TEXT,
  title TEXT NOT NULL,
  event_date TEXT,
  lines TEXT NOT NULL DEFAULT '[]',
  vat_rate REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',       -- draft | sent | accepted | declined
  notes TEXT,
  valid_until TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (owner_id, number)
);
CREATE TABLE studio_invoices (
  id INTEGER PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  number TEXT NOT NULL,
  quote_id INTEGER REFERENCES studio_quotes(id) ON DELETE SET NULL,
  contact_id INTEGER REFERENCES studio_contacts(id) ON DELETE SET NULL,
  request_id INTEGER REFERENCES booking_requests(id) ON DELETE SET NULL,
  gig_id INTEGER REFERENCES studio_gigs(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL, client_email TEXT, client_address TEXT,
  title TEXT NOT NULL,
  event_date TEXT,
  lines TEXT NOT NULL DEFAULT '[]',
  vat_rate REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',       -- draft | sent | paid | overdue
  issue_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  paid_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (owner_id, number)
);
CREATE TABLE studio_settings (
  owner_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  legal_name TEXT, address TEXT, siret TEXT, iban TEXT,
  vat_mode TEXT NOT NULL DEFAULT 'franchise', -- franchise | vat
  legal_status TEXT,                          -- micro-entreprise | portage salarial | intermittence (GUSO)
  monthly_goal INTEGER
);
-- Dates hors plateforme (réseau personnel du DJ), avec leur feuille de route
CREATE TABLE studio_gigs (
  id INTEGER PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id INTEGER REFERENCES studio_contacts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  client_name TEXT,
  date TEXT NOT NULL,
  start_time TEXT, end_time TEXT, arrival_time TEXT,
  venue TEXT, address TEXT, city TEXT,
  fee REAL,
  status TEXT NOT NULL DEFAULT 'confirmed',  -- option | confirmed | done | cancelled
  rider TEXT, onsite_contact TEXT, notes TEXT,
  created_at TEXT NOT NULL
);
-- Suivi des réseaux sociaux du DJ (saisie manuelle : aucun compte Instagram/TikTok n'est connecté)
CREATE TABLE studio_posts (
  id INTEGER PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  network TEXT NOT NULL,                      -- Instagram | TikTok | YouTube | Facebook
  format TEXT,                                -- Reel | Carrousel | Photo | Story | Vidéo courte | Live
  title TEXT NOT NULL,
  caption TEXT, link TEXT,
  clip_id INTEGER REFERENCES studio_clips(id) ON DELETE SET NULL,
  gig_id INTEGER REFERENCES studio_gigs(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'idea',          -- idea | planned | published
  planned_date TEXT, published_date TEXT,
  views INTEGER, likes INTEGER, comments INTEGER, shares INTEGER, saves INTEGER, followers_gained INTEGER,
  is_example INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE studio_followers (
  id INTEGER PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  network TEXT NOT NULL, date TEXT NOT NULL, count INTEGER NOT NULL,
  is_example INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE studio_marketing (
  owner_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  goal TEXT, target_city TEXT, posts_per_week INTEGER
);
CREATE TABLE studio_templates (
  id INTEGER PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  body TEXT NOT NULL
);
CREATE TABLE studio_clips (
  id INTEGER PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_name TEXT,
  start_s REAL, end_s REAL,
  format TEXT,
  moment_kind TEXT,
  file TEXT,
  mime TEXT,
  size INTEGER,
  caption TEXT,
  created_at TEXT NOT NULL
);

-- ───────── AFTR Admin : CRM interne et marketing (réservé au rôle admin)
CREATE TABLE admin_companies (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL, kind TEXT, city TEXT, website TEXT, notes TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE admin_contacts (
  id INTEGER PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  company_id INTEGER REFERENCES admin_companies(id) ON DELETE SET NULL,
  name TEXT NOT NULL, email TEXT, phone TEXT, city TEXT,
  segment TEXT,                               -- dj | organizer | venue | partner | press
  stage TEXT NOT NULL DEFAULT 'lead',         -- lead | contacted | demo | negotiation | customer | lost
  source TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  notes TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE admin_interactions (
  id INTEGER PRIMARY KEY,
  contact_id INTEGER NOT NULL REFERENCES admin_contacts(id) ON DELETE CASCADE,
  admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  kind TEXT NOT NULL, body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE admin_tasks (
  id INTEGER PRIMARY KEY,
  contact_id INTEGER REFERENCES admin_contacts(id) ON DELETE CASCADE,
  title TEXT NOT NULL, due_date TEXT, done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE subscriptions (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,                         -- dj_free | dj_pro | org_free | org_plus
  status TEXT NOT NULL DEFAULT 'active',      -- active | trial | cancelled
  started_at TEXT NOT NULL
);
CREATE TABLE support_tickets (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name TEXT, email TEXT,
  subject TEXT NOT NULL,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'open',        -- open | pending | resolved
  priority TEXT NOT NULL DEFAULT 'normal',
  created_at TEXT NOT NULL
);
CREATE TABLE ticket_messages (
  id INTEGER PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author TEXT NOT NULL,                       -- 'client' | 'aftr'
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE campaigns (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  objective TEXT, channel TEXT,
  source_key TEXT,                            -- valeur de users.source attribuée à la campagne
  start_date TEXT, end_date TEXT,
  budget INTEGER,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL
);
CREATE TABLE marketing_contents (
  id INTEGER PRIMARY KEY,
  network TEXT NOT NULL,
  topic TEXT, target TEXT, objective TEXT, tone TEXT, format TEXT,
  idea TEXT, hook TEXT, caption TEXT, cta TEXT, hashtags TEXT, visual TEXT,
  scheduled_date TEXT,
  status TEXT NOT NULL DEFAULT 'idea',        -- idea | draft | review | approved | scheduled | published | archived
  campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE newsletters (
  id INTEGER PRIMARY KEY,
  subject TEXT NOT NULL, preheader TEXT, body TEXT,
  cta_label TEXT, cta_url TEXT,
  segment TEXT NOT NULL DEFAULT 'all',
  scheduled_date TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  outbox_at TEXT,
  recipients INTEGER,
  created_at TEXT NOT NULL
);
CREATE TABLE strategies (
  id INTEGER PRIMARY KEY,
  objective TEXT NOT NULL,
  params TEXT NOT NULL,
  result TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE automations (
  id INTEGER PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_run_at TEXT
);
CREATE TABLE automation_runs (
  id INTEGER PRIMARY KEY,
  automation_id INTEGER NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  matched INTEGER NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL
);
-- Boîte d'envoi interne : aucun e-mail n'est réellement envoyé (aucun service d'emailing connecté).
CREATE TABLE outbox (
  id INTEGER PRIMARY KEY,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT,
  origin TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY,
  admin_id INTEGER, action TEXT NOT NULL, detail TEXT,
  created_at TEXT NOT NULL
);
`;

// Commandes passées depuis l'espace de vente (paiement simulé)
const ORDERS_DDL = `CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY,
  ref TEXT UNIQUE NOT NULL,
  offer TEXT NOT NULL, period TEXT NOT NULL,
  amount_ht REAL NOT NULL, vat REAL NOT NULL, amount_ttc REAL NOT NULL,
  name TEXT NOT NULL, email TEXT NOT NULL, city TEXT, company TEXT, source TEXT,
  contact_id INTEGER REFERENCES admin_contacts(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'paid_simulated',
  created_at TEXT NOT NULL
);`;

export let db;

export function openDb({ fresh = false } = {}) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
  if (db) { db.close(); db = undefined; }
  if (fresh) for (const f of [DB_FILE, DB_FILE + '-wal', DB_FILE + '-shm']) if (existsSync(f)) rmSync(f);
  const isNew = !existsSync(DB_FILE);
  db = new DatabaseSync(DB_FILE);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  if (isNew) db.exec(SCHEMA);
  db.exec(ORDERS_DDL);
  db.exec("UPDATE admin_contacts SET stage = 'demo' WHERE stage = 'negotiation'");
  // Ajouts de colonnes sur une base existante
  for (const [t, c] of [['studio_posts', 'visual_url'], ['marketing_contents', 'visual_url']])
    if (!db.prepare(`PRAGMA table_info(${t})`).all().some(x => x.name === c)) db.exec(`ALTER TABLE ${t} ADD COLUMN ${c} TEXT`);
  return { db, isNew };
}

// Petits utilitaires de requêtes
export const all = (sql, ...p) => db.prepare(sql).all(...p);
export const get = (sql, ...p) => db.prepare(sql).get(...p);
export const run = (sql, ...p) => db.prepare(sql).run(...p);
export const insert = (sql, ...p) => Number(db.prepare(sql).run(...p).lastInsertRowid);
export function tx(fn) {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
}
export const J = (s, fallback = []) => { try { return s ? JSON.parse(s) : fallback; } catch { return fallback; } };
export const now = () => new Date().toISOString();
export const today = () => new Date().toISOString().slice(0, 10);
export const addDays = (iso, n) => { const d = new Date(iso.length === 10 ? iso + 'T12:00:00Z' : iso); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
