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

### Peupler la base de production

La base Supabase est vide au premier déploiement : un nouvel arrivant tombe sur une application
sans aucun jeu ni table. Pour y installer le jeu de démonstration, depuis ta machine :

```bash
DATABASE_URL="<l'URL Supabase>" DIRECT_URL="<l'URL Supabase>" npx prisma db seed
```

Le script **refuse de s'exécuter si la base contient déjà des jeux**, il est donc sans risque à
relancer : il ne créera jamais de doublons. (`SEED_FORCE=1` passe outre, à n'utiliser qu'en
connaissance de cause.)

Les six comptes de démonstration partagent le mot de passe `password123` — à considérer comme
des comptes publics, pas comme de vrais utilisateurs.

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

## Tests

La suite couvre les 20 écrans de l'application, sur trois niveaux :

| Fichier | Ce qui est vérifié |
| --- | --- |
| `tests/rendu.spec.ts` | Chaque écran s'affiche avec son contenu, sans erreur JavaScript ni débordement horizontal. Rejoué sur bureau **et** sur mobile. |
| `tests/parcours.spec.ts` | Les scénarios complets : inscription, ajout d'un jeu, échange proposé → accepté → terminé → noté, table ouverte/rejointe/annulée, messages, liste de souhaits, édition de profil, filtres de recherche. |
| `tests/permissions.spec.ts` | Ce qu'un membre **ne peut pas** faire : lire l'échange ou la conversation de quelqu'un d'autre, accepter une proposition qui ne lui est pas adressée, annuler la table d'un autre, agir sans session ou avec un cookie falsifié. |
| `tests/securite.spec.ts` | Limitation des tentatives de connexion, en-têtes HTTP, cookie de session. |
| `tests/accessibilite.spec.ts` | axe-core (WCAG 2.1 A/AA) sur chaque écran, navigation au clavier, libellés de formulaire. |
| `tests/langue.spec.ts` | Bascule français/anglais, y compris les messages de validation et les notifications ; langues de jeu d'une table. |
| `tests/photos.spec.ts` | Envoi d'un avatar, d'une salle et d'une jaquette, refus d'un fichier qui n'est pas une image, suppression de l'ancienne photo, en-têtes de la route de service. |
| `tests/bgg.spec.ts` | Recherche BoardGameGeek de bout en bout contre un faux serveur local : réponse normale, aucun résultat, HTTP 500, HTTP 202, serveur muet, filtre par type infructueux, puis le sélecteur à l'écran. |

Chaque test vérifie à la fois l'écran et l'état réel en base : un affichage peut mentir, pas la
base de données.

L'API BoardGameGeek n'est jamais appelée par les tests : `tests/faux-bgg.ts` rejoue ses réponses,
**pannes comprises**, et `BGG_API_BASE` y dirige l'application. Le terme cherché sert
d'aiguillage — `panne` renvoie un 500, `attente` un 202, `lent` ne répond jamais. Toute la chaîne
est ainsi couverte (requête, statuts d'erreur, analyse, écran) sans dépendre d'un service tiers
ni d'un accès réseau sortant.

### Lancer les tests

Il faut une base Postgres locale **dédiée**, dont le nom se termine par `_test` :

```bash
createdb myshelf_test          # une seule fois
npm test                       # toute la suite
npm test -- --project=bureau   # bureau uniquement, plus rapide
npm run test:ui                # mode interactif, pour explorer un échec
npm run test:report            # ouvrir le dernier rapport HTML
```

Les paramètres de connexion sont dans `.env.test` (base locale jetable, aucun secret). Avant
chaque exécution, `tests/global-setup.ts` rejoue les migrations à vide puis relance le seed, afin
que les tests partent toujours du même état. Ce fichier **refuse de démarrer** si le nom de la
base ne finit pas par `_test` : la base de développement et celle de production sont hors
d'atteinte.

Playwright construit et démarre lui-même l'application en mode production sur le port 3100 — c'est
la même commande que celle exécutée par Vercel, pas le serveur de développement.

### Intégration continue

`.github/workflows/ci.yml` rejoue lint + build + toute la suite à chaque push, avec un conteneur
Postgres. En cas d'échec, le rapport Playwright (captures, vidéos, traces) est déposé en artefact
du run.

## Langues

L'interface existe en français et en anglais. Chacun choisit la sienne dans
**Modifier mon profil** ; le choix est enregistré sur le compte et suivi par un
cookie, pour que les pages publiques s'affichent déjà dans la bonne langue.
Un visiteur qui n'a pas de compte hérite de la langue de son navigateur, à
défaut du français.

Le réglage porte sur toute l'application : libellés, messages de validation,
formats de date et attribut `lang` du document. Il ne touche évidemment pas aux
textes écrits par les joueurs (titres de tables, messages, avis).

Les traductions vivent dans `src/lib/i18n/` :

- `fr.ts` fait référence — toute clé doit y exister ; les autres langues y
  retombent si elles sont incomplètes, plutôt que d'afficher un identifiant.
- `en.ts` reprend les mêmes clés.
- Une valeur peut être une paire `{ one, other }` quand le texte dépend d'un
  nombre : le français accorde au singulier pour 0 et 1, l'anglais seulement
  pour 1, et `pluralForm()` s'en charge.

Les **notifications** stockent une clé et ses variables, pas du texte figé :
c'est le destinataire qui les lit, et il peut avoir choisi une autre langue que
la personne qui a déclenché l'action.

À ne pas confondre avec les **langues de jeu** d'une table : celles dans
lesquelles la partie peut se dérouler, choisies à l'ouverture de la table et
affichées sur sa fiche.

## Photos

Trois endroits acceptent une image : la **photo de profil**, la **salle d'une
table** et la **jaquette d'un jeu**.

Le fichier est réduit dans le navigateur (1200 px sur le plus long côté,
ré-encodage en WebP) avant d'être envoyé, puis vérifié côté serveur : le format
est reconnu dans les **octets** du fichier, jamais d'après le type annoncé par
le navigateur, et le tout est plafonné à 2 Mo. Un fichier texte renommé
`.png` est refusé.

Les images sont stockées en base (`Photo.bytes`) et servies par
`/api/photos/<id>` avec un cache d'un an : le contenu d'une photo ne change
jamais, un remplacement crée une nouvelle ligne donc une nouvelle URL — et
l'ancienne est supprimée, pour ne pas laisser d'orpheline. Vercel n'ayant pas
de système de fichiers persistant, la base est le seul stockage vérifiable à la
fois en développement, dans les tests et en production ; passer un jour à
Supabase Storage ne toucherait que `src/lib/photos.ts`.

Ces images étant servies depuis notre propre domaine, `next.config.ts` leur
applique une politique de contenu `sandbox` distincte de celle de
l'application : une image envoyée par un tiers ne doit jamais pouvoir devenir
un document exécutable.

## Catalogue BoardGameGeek

L'ajout d'un jeu propose de reprendre sa fiche depuis
[BoardGameGeek](https://boardgamegeek.com) (API XML v2, sans clé) : titre,
nombre de joueurs, durée, âge et jaquette. Tout reste modifiable ensuite, et le
formulaire fonctionne entièrement à la main si BGG ne répond pas.

- L'appel passe par `/api/bgg/search`, côté serveur : BGG n'envoie pas
  d'en-tête CORS. Une session est exigée pour que l'application ne devienne pas
  un relais ouvert, et les réponses sont mises en cache 24 h.
- **« Aucun résultat » et « BGG n'a pas répondu » sont distingués.** Une panne
  affichée comme une absence de résultat envoie chercher ailleurs un jeu qui
  existe ; le message d'erreur porte donc le motif réel (`HTTP 403`,
  `TimeoutError`…), et le serveur le journalise.
- Un en-tête `User-Agent` explicite est envoyé : BGG est derrière Cloudflare,
  qui refuse les clients non identifiés.
- `BGG_API_BASE` permet de viser un autre serveur — c'est ce dont se servent
  les tests.
- Une jaquette n'est recopiée que si son URL est en HTTPS **et** sur un hôte de
  BGG — le champ est caché, donc falsifiable.
- `Game.bggId` est unique : deux personnes qui importent le même jeu partagent
  la même fiche du catalogue, quelle que soit l'orthographe du titre.
- Données et visuels : BoardGameGeek, usage non commercial.

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
- `Photo` (octets, type MIME, dimensions, auteur de l'envoi)

Les distances affichées ("1,2 km", "900 m"...) sont **factices mais stables** (dérivées de l'id
de l'objet) — il n'y a pas de vraie géolocalisation dans cette version, ni de génération
d'occurrences pour les tables récurrentes (champ informatif seulement).

## Pistes d'évolution

- Vraie géolocalisation (adresse ou position) à la place des distances factices.
- Notifications par e-mail ou push (celles dans l'application existent).
- Occurrences générées pour les tables récurrentes (le champ est informatif).
- Corriger une fiche du catalogue partagé (titre, durée, nombre de joueurs).
- Ajouter d'autres langues que le français et l'anglais.
