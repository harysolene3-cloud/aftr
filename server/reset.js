// Réinitialise la base avec les données de démonstration : npm run reset
import { openDb } from './db.js';
import { seed, DEMO_ACCOUNTS, DEMO_PASSWORD } from './seed.js';

openDb({ fresh: true });
seed();
console.log('Démo réinitialisée. Comptes (mot de passe : ' + DEMO_PASSWORD + ') :');
for (const a of DEMO_ACCOUNTS) console.log(`  ${a.role.padEnd(20)} ${a.email}`);
