# MyShelf

Application web pour joueurs de jeux de société et de jeux de rôle : échangez vos jeux entre
particuliers, et organisez ou rejoignez des parties près de chez vous.

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

### Échange de jeux

- **Ajouter un jeu** à son étagère (jeu de société, jeu de rôle, autre) avec titre, catégorie, état, description, photo (URL).
- **Parcourir / rechercher** les jeux disponibles des autres membres sur `/items`, filtrables par catégorie et ville.
- **Proposer un échange** : sur la page d'un jeu, choisir un ou plusieurs de ses propres jeux à proposer en troc.
- Le propriétaire du jeu ciblé peut **accepter / refuser** la proposition depuis `/trades`.
- Une fois acceptée, les jeux passent en statut "en échange" ; l'échange peut être **marqué comme terminé** (jeux alors marqués "échangés") ou **annulé**.
- Chaque échange a un **fil de messages** simple pour s'organiser (lieu/heure de rencontre, etc.).

### Événements (parties)

- **Créer un événement** sur `/events/new` : titre, type de jeu (société / rôle / autre), jeu précis, niveau attendu, récurrence (ponctuel / hebdo / mensuel), ville, lieu, date/heure, nombre de places.
- **Parcourir les prochaines parties** sur `/events`, filtrables par type de jeu et ville.
- **S'inscrire / se désinscrire** d'un événement (dans la limite des places si un maximum est fixé).
- L'organisateur peut **annuler** son événement.

La page d'accueil (`/`) sert de hub : mise en avant des prochaines parties et des jeux récemment proposés.

## Modèle de données

Voir `prisma/schema.prisma` :

- `User`, `Item`, `TradeProposal`, `TradeItem` (table de liaison jeux ⇄ échange, avec le camp qui l'offre), `Message` — pour l'échange.
- `Event`, `EventParticipant` — pour les parties organisées.

## Pistes d'évolution

- Upload de photo réel (au lieu d'une URL) via un service de stockage.
- Enrichissement automatique des fiches via BoardGameGeek (jeux de société) ou une base de jeux de rôle.
- Géolocalisation / distance plutôt qu'un simple filtre par nom de ville.
- Notifications (e-mail ou push) sur nouvelle proposition, message, inscription à un événement, etc.
- Système de réputation / avis après échange ou événement.
- Génération automatique des occurrences pour les événements récurrents (actuellement informatif seulement).
