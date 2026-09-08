# MyShelf

Application web d'échange de jeux de société, livres (et autres objets) entre particuliers, en main propre.

## Stack

- [Next.js 16](https://nextjs.org) (App Router, Server Actions, Turbopack) + React 19 + TypeScript
- Tailwind CSS v4 pour le design
- Prisma + SQLite pour la persistance (facilement remplaçable par Postgres en prod)
- Authentification maison (session cookie signé JWT via `jose` + `bcryptjs`) — pas de dépendance à un fournisseur d'auth externe

## Démarrer en local

```bash
npm install
cp .env.example .env   # puis adapte DATABASE_URL avec un chemin absolu vers ce dossier
npx prisma migrate deploy
npx prisma db seed     # optionnel : crée deux comptes de démo (alice@example.com / bob@example.com, mdp: password123)
npm run dev
```

L'app est disponible sur http://localhost:3000.

## Fonctionnement

- **Inscription / connexion** par e-mail + mot de passe.
- **Ajouter un objet** à son étagère (livre, jeu de société, autre) avec titre, catégorie, état, description, photo (URL).
- **Parcourir / rechercher** les objets disponibles des autres membres, filtrables par catégorie et ville.
- **Proposer un échange** : sur la page d'un objet, choisir un ou plusieurs de ses propres objets à proposer en troc.
- Le propriétaire de l'objet ciblé peut **accepter / refuser** la proposition depuis `/trades`.
- Une fois acceptée, les objets passent en statut "en échange" ; l'échange peut être **marqué comme terminé** (objets alors marqués "échangés") ou **annulé**.
- Chaque échange a un **fil de messages** simple pour s'organiser (lieu/heure de rencontre, etc.).

## Modèle de données

Voir `prisma/schema.prisma` : `User`, `Item`, `TradeProposal`, `TradeItem` (table de liaison objets ⇄ échange, avec le camp qui l'offre), `Message`.

## Pistes d'évolution

- Upload de photo réel (au lieu d'une URL) via un service de stockage.
- Enrichissement automatique des fiches via des catalogues externes (Open Library / Google Books pour les livres, BoardGameGeek pour les jeux).
- Géolocalisation / distance plutôt qu'un simple filtre par nom de ville.
- Notifications (e-mail ou push) sur nouvelle proposition, message, etc.
- Système de réputation / avis après échange.
