# MyShelf

Plateforme d'échange ludique : jeux de société, jeux de rôle et cartes à collectionner entre
joueurs, organisation de tables (parties) et clubs.

## Stack

- [Next.js 16](https://nextjs.org) (App Router, Server Actions, Turbopack) + React 19 + TypeScript
- Tailwind CSS v4 pour le design — palette "table de jeu" (vert plateau, moutarde, terracotta), polices Bevan (titres) + Karla (texte)
- Prisma + PostgreSQL (ex. [Supabase](https://supabase.com)) pour la persistance
- Authentification maison (session cookie signé JWT via `jose` + `bcryptjs`)

## Démarrer en local

Il faut une base Postgres accessible (un projet [Supabase](https://supabase.com) gratuit convient
très bien, ou une instance Postgres locale).

```bash
npm install
cp .env.example .env   # renseigne DATABASE_URL / DIRECT_URL (voir Supabase ci-dessous) et AUTH_SECRET
npx prisma migrate dev --name init   # première fois : crée les tables
npx prisma db seed     # comptes de démo : chloe@example.com (et marius/lea/bastien/sofiane/amandine@example.com), mdp: password123
npm run dev
```

### Récupérer les identifiants Supabase

Dans ton projet Supabase → **Project Settings → Database → Connection string** :
- **Transaction pooler** (port `6543`, avec `?pgbouncer=true`) → `DATABASE_URL` (utilisée par l'app)
- **Direct connection** (port `5432`) → `DIRECT_URL` (utilisée uniquement par les migrations Prisma — le pooler ne supporte pas les prepared statements nécessaires aux migrations)

### Déployer sur Vercel

1. Importe le dépôt GitHub dans Vercel (framework détecté automatiquement : Next.js).
2. Dans les variables d'environnement du projet Vercel, ajoute `DATABASE_URL`, `DIRECT_URL` et `AUTH_SECRET` (une valeur forte et différente de celle du `.env` local).
3. Déploie. Les migrations doivent être appliquées à la base Supabase avant ou pendant le premier déploiement — depuis ta machine : `npx prisma migrate deploy` avec les mêmes variables d'environnement pointées vers Supabase.

L'app est disponible sur http://localhost:3000.

## Fonctionnement

### Ma ludothèque (`/shelf`)

Chaque jeu ajouté rejoint un **catalogue partagé** (`Game`) : si le titre existe déjà, ta copie
(`GameCopy`) vient s'ajouter à celles des autres joueurs. Bascule chaque copie entre **sur la
table** (disponible à l'échange) et **gardée au chaud** (non disponible). La fiche jeu (`/games/[id]`)
liste les autres joueurs qui possèdent une copie disponible, avec un bouton **Échanger**.

### Échanges (`/trades`)

Un échange se propose en 2 étapes (choix de ton jeu à mettre sur la table, puis un message) et
crée une conversation avec l'autre joueur. Le destinataire accepte/refuse ; une fois accepté,
l'échange peut être marqué terminé (les copies passent alors en "échangées").

### Cartes (`/cards`)

Système séparé pour les cartes à collectionner : ajoute tes **doubles** (disponibles à l'échange)
ou les cartes que tu **cherches**. "Demander" une carte crée un échange de type carte, à négocier
par message.

### Tables (`/events`)

Organise une partie (jeu de société, jeu de rôle, TCG ou découverte) avec niveau attendu, lieu,
créneau, nombre de places et liste "à apporter". Aperçu en direct de la carte pendant la saisie.
Les autres joueurs réservent une place ; l'hôte peut annuler.

### Recherche (`/search`)

Recherche unifiée à travers tables, jeux, cartes et clubs, avec filtres par type, niveau et
distance.

### Messages (`/messages`)

Conversations par binôme de joueurs, alimentées par les échanges ou démarrées librement (bouton
"Écrire" sur un profil ou une table).

### Profil (`/profile/[id]`)

Stats (note moyenne, échanges, tables ouvertes), avis reçus, "jetons" (badges calculés :
identité vérifiée, nombre d'échanges, hôtesse de table, accueil des débutants) et progression de
niveau.

## Modèle de données

Voir `prisma/schema.prisma` :

- `User` (avec `experienceLevel`, `verified`)
- `Game` (catalogue partagé) + `GameCopy` (copie possédée par un joueur)
- `Card` (catalogue) + `CardCopy` (double possédé) + `CardWant` (carte recherchée)
- `Club` + `ClubMembership`
- `Event` (table) + `EventParticipant`
- `TradeProposal` + `TradeItem` (jeu ou carte, camp qui l'offre)
- `Conversation` + `Message`
- `Review` (avis, contexte libre + note)

Les distances affichées ("1,2 km", "900 m"...) sont **factices mais stables** (dérivées de l'id
de l'objet) — il n'y a pas de vraie géolocalisation dans cette version, ni de génération
d'occurrences pour les tables récurrentes (champ informatif seulement).

## Pistes d'évolution

- Vraie géolocalisation (adresse ou position) à la place des distances factices.
- Upload de photo réel (au lieu d'une URL).
- Écriture d'avis depuis l'app (actuellement affichés en lecture seule, issus du seed).
- Page dédiée par club (actuellement teaser sur l'accueil + résultat de recherche uniquement).
- Notifications (e-mail ou push).
