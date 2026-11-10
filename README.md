# AFTR

Plateforme pour DJs et organisateurs : communauté, marketplace, Business Studio et back-office AFTR (CRM, Marketing Hub).
Projet de Master 2 en marketing digital, conçu pour une démonstration en direct.

## Lancer l'application

- **Le plus simple :** double-clique sur `Lancer AFTR.command`. Le navigateur s'ouvre sur http://localhost:3000.
- **En ligne de commande :** `~/.local/node/bin/node --no-warnings server/index.js`

Aucune installation de dépendance, aucun compte externe. Il faut seulement Node.js 24, déjà installé dans `~/.local/node`. L'application tourne sans Internet, à part les polices et les photos Unsplash.

## Comptes de démonstration

Le mot de passe est le même pour tous : `aftr2026`.

| Compte | E-mail |
|---|---|
| Anjara (DJ, profil réel) | anjara@aftr.demo |
| Collectif Contre-Jour (organisateur fictif) | contrejour@aftr.demo |
| DIDA (DJ + organisateur, fictif) | dida@aftr.demo |
| Équipe AFTR (administrateur) | admin@aftr.demo |

Sur la page de connexion, un clic sur un compte suffit.

## Données

- **Anjara** : profil, photo, bio, press kit, dates jouées, factures (numérotation reprise), prospects et messages types viennent de son outil « Anjara Booking ». Son adresse, son téléphone, son IBAN et son SIRET ne sont volontairement pas repris : elle peut les ajouter dans *Factures › Mes informations*.
- **Ma com' & réseaux** : les publications et les relevés d'abonnés d'Anjara sont des exemples, marqués « exemple ». Ce ne sont pas ses vraies statistiques. Ils se suppriment en un clic, et aucun compte Instagram ou TikTok n'est connecté : les statistiques se saisissent à la main.
- **Studio visuel** (dans une publication de *Ma com'* ou dans le *Social Media Studio*) : crée l'image au format Instagram/TikTok à partir de modèles ou de zéro, reprend les couleurs d'une image d'inspiration et propose une légende. Tout est calculé dans le navigateur, sans IA.
- **Tout le reste est fictif** : autres DJs, organisateurs, événements, demandes de réservation via AFTR, CRM interne et campagnes.
- **Réinitialiser** : bouton dans *Admin › Démo*, ou `~/.local/node/bin/node server/reset.js` (serveur arrêté). Les dates fictives sont recalculées par rapport au jour courant.

## Ce qui n'est pas connecté (et l'interface le dit)

- **Envoi d'e-mails** : les newsletters et relances vont dans une boîte d'envoi interne, marquée « non envoyée ».
- **Paiements et abonnements** : rien n'est encaissé, la commission de 8 % est théorique.
- **IA générative** : aucune clé n'est configurée. Le Strategist, le Social Media Studio et les légendes du Set Clipper utilisent des règles et des modèles de texte.

## Structure

- `server/` : serveur Node sans dépendance, base SQLite intégrée (`data/aftr.db`), générateur PDF, routes par espace.
- `public/` : interface (HTML, CSS, JavaScript sans build).
- Les CRM des DJs (`studio_*`) ne sont jamais lus par les routes admin, ce que vérifient les contrôles serveur (réponse 403).

## Version en ligne (Vercel)

https://aftr-rust.vercel.app : chaque instance recrée la base de démo au démarrage, donc ce qui est créé en ligne peut disparaître. Les fichiers envoyés sont limités à 4,5 Mo. Les clips du Set Clipper plus lourds se téléchargent quand même sur l'appareil, sans être stockés. Redéployer : `vercel deploy --prod`.
