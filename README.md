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
| `tests/geo.spec.ts` | Distances comparées à des valeurs connues (Lyon–Paris, Lyon–Marseille), boîte englobante qui n'écarte jamais un voisin réel, référentiel chargé, autocomplétion via l'API d'adresses (ordre d'importance conservé, faute de frappe rattrapée, panne signalée, commune inconnue écartée), rayon réellement appliqué, absence de distance inventée. |

Chaque test vérifie à la fois l'écran et l'état réel en base : un affichage peut mentir, pas la
base de données.

Aucun service extérieur n'est appelé par les tests : `tests/faux-services.ts` rejoue les réponses
de BoardGameGeek **et** de la Base Adresse Nationale, **pannes comprises**, et `BGG_API_BASE` /
`ADRESSE_API_BASE` y dirigent l'application. Le terme cherché sert d'aiguillage — `panne` renvoie
une erreur, `attente` un 202, `lent` ne répond jamais. Toute la chaîne est ainsi couverte
(requête, statuts d'erreur, analyse, écran) sans dépendre d'un tiers ni d'un accès réseau
sortant.

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
[BoardGameGeek](https://boardgamegeek.com) (API XML v2) : titre, nombre de
joueurs, durée, âge et jaquette. Tout reste modifiable ensuite, et le
formulaire fonctionne entièrement à la main si BGG ne répond pas.

### Obtenir un jeton (obligatoire depuis le 2 juillet 2025)

Tout appel sans en-tête `Authorization` reçoit un **401**, usage commercial ou
non. La marche à suivre :

1. Enregistre l'application sur
   [boardgamegeek.com/applications](https://boardgamegeek.com/applications), en
   choisissant **non commercial**. **Compte une semaine ou plus** avant la
   réponse : la demande est examinée à la main.
2. Une fois l'application approuvée, crée un jeton depuis la même page
   (bouton « Tokens »).
3. Renseigne `BGG_API_TOKEN` dans ton `.env` local **et** dans les variables
   d'environnement Vercel — puis **redéploie** : une variable ajoutée ne
   s'applique pas aux déploiements déjà en ligne.

Sans jeton, l'application ne les appelle pas du tout : elle le dit et laisse le
formulaire manuel disponible, plutôt que de solliciter leurs serveurs pour un
refus certain — ou de leur imputer une panne.

### Ce que leurs conditions imposent, et comment on s'y conforme

| Leur règle | Ici |
|---|---|
| Appels **depuis le serveur**, pas depuis le navigateur | Action serveur ; le jeton ne quitte jamais le serveur |
| **Mettre les résultats en cache** | Réponses gardées 24 h (`next.revalidate`) |
| **Limiter le nombre d'appels** | Deux requêtes par recherche (`/search` puis `/thing` groupé), déclenchées par un bouton et non à la frappe |
| Domaine **`boardgamegeek.com`, sans `www`** | C'est la seule racine appelée |
| Logo **« Powered by BGG »** sur les applications publiques | Affiché sous le sélecteur et sur la fiche de tout jeu repris de leur catalogue |

Le logo n'est pas versionné ici — c'est leur marque. Télécharge-le depuis la
même page, dépose-le dans `public/`, et indique son chemin dans
`NEXT_PUBLIC_BGG_LOGO_URL`. Sans cela, la mention s'affiche en toutes lettres :
fonctionnel et honnête, mais pas encore tout à fait conforme.

- L'appel se fait **par une action serveur** (`src/lib/actions/bgg.ts`), pas
  par une route `/api` interrogée en `fetch`. Une route API est une seconde
  requête HTTP qui doit ré-établir la session de son côté ; un hébergeur qui
  intercale une protection de déploiement ne la traite pas comme la navigation
  qui l'a précédée, et peut la refuser alors même que la page s'est affichée.
  Tout le reste de l'application passe par des actions serveur : autant
  emprunter le chemin déjà éprouvé, et exposer un point d'entrée public de
  moins. La session y est revérifiée — l'action reste une porte ouverte sur
  Internet.
- BGG n'envoyant pas d'en-tête CORS, l'appel devait de toute façon partir du
  serveur. Les réponses sont mises en cache 24 h.
- **Trois issues, trois messages : « aucun résultat », « BGG n'a pas répondu »,
  « session perdue ».** Les confondre envoie chercher ailleurs un jeu qui
  existe, ou fait accuser un service tiers à notre place. Le message porte le
  motif réel (`HTTP 403`, `TimeoutError`…), et le serveur le journalise.
- Un en-tête `User-Agent` explicite est envoyé : BGG est derrière Cloudflare,
  qui refuse les clients non identifiés.
- **Chaque refus est journalisé** avec son statut, l'en-tête `server`,
  l'identifiant `cf-ray`, l'en-tête `www-authenticate` et le début du corps.
  C'est ce qui a fini par identifier le problème : `Bearer realm="xml api"`
  disait qu'il manquait un jeton, là où un « HTTP 401 » nu nous avait fait
  soupçonner l'hébergeur pendant trois allers-retours.
- **Cinq issues, cinq messages** : jeton absent, jeton refusé, aucun résultat,
  service injoignable, session perdue. Chacune appelle un remède différent —
  s'inscrire, renouveler, chercher autrement, attendre, se reconnecter.
- `BGG_API_BASE` permet de viser un autre serveur — c'est ce dont se servent
  les tests, dont le faux BoardGameGeek **refuse tout appel sans le bon
  jeton** : la suite entière ne passe que si l'application l'envoie
  réellement.
- Une jaquette n'est recopiée que si son URL est en HTTPS **et** sur un hôte de
  BGG — le champ est caché, donc falsifiable.
- `Game.bggId` est unique : deux personnes qui importent le même jeu partagent
  la même fiche du catalogue, quelle que soit l'orthographe du titre.
- Données et visuels : BoardGameGeek, usage non commercial.

## Géolocalisation

Les distances affichées sont **réelles**. Elles l'ont longtemps été en apparence
seulement : « à 2,8 km » était un nombre dérivé de l'identifiant de l'objet.

### Une position à la commune, jamais au domicile

Chaque membre, table et club est rattaché à une **commune** (`communeCode`,
code INSEE), et la position retenue est le **centre de cette commune**. Jamais
la position exacte de la personne : afficher des distances au mètre près entre
membres permettrait de retrouver une adresse par recoupement de trois mesures.
Deux joueurs de la même ville sont donc à 0 km l'un de l'autre, ce qui est la
vérité utile.

Quand la commune n'est pas connue, l'application affiche **« distance
inconnue »** et invite à la renseigner. Elle n'estime rien.

### L'autocomplétion passe par le géocodage de la Géoplateforme

Les suggestions viennent de `data.geopf.fr/geocodage`, le géocodeur du service
public français adossé à la Base Adresse Nationale : gratuit, sans clé. Il
classe par importance réelle — « lyon » remonte Lyon avant Lyons-la-Forêt — et
rattrape les fautes de frappe, deux choses qu'une liste locale ne sait pas
faire : sans donnée de population, elle ne peut trier que par longueur de nom.

> **L'ancienne adresse `api-adresse.data.gouv.fr` est morte.** L'API a été
> transférée à l'IGN courant 2025, puis cette URL décommissionnée fin janvier
> 2026. Elle avait été codée en dur ici sans vérification — la même erreur que
> pour BoardGameGeek, et le même remède : vérifier avant d'affirmer.

Limites annoncées : 50 requêtes par seconde et par adresse IP. La saisie est
temporisée (220 ms) et les réponses mises en cache 24 h : on en est loin.

L'appel part du **serveur**, jamais du navigateur : la politique de contenu
n'autorise que notre domaine en `connect-src`, et cela évite d'envoyer l'adresse
IP de nos membres chez un tiers, fût-il public. Seul le terme tapé sort.

Trois garde-fous :

- **L'API ne décide de rien.** Chaque code INSEE qu'elle renvoie est recoupé
  avec le référentiel local, qui reste seul juge du nom retenu et des
  coordonnées. Une suggestion qu'on ne saurait pas positionner est écartée
  plutôt que proposée : pouvoir la choisir sans jamais obtenir de distance
  serait un piège de plus.
- **Si elle ne répond pas, la liste embarquée prend le relais**, et l'écran le
  dit. Un service durablement muet passerait sinon pour un classement médiocre.
- **Un service qui ne trouve rien n'est pas un service en panne** : les deux
  cas sont distingués, et seul le second se signale.

Un code postal complet ne passe pas par l'API : il ne laisse aucune ambiguïté,
et le référentiel local répond mieux, et toujours.

Les résultats sont **dédoublonnés par code INSEE**. Ce n'est pas décoratif : si
le filtre `type=municipality` cessait d'être honoré, l'API renverrait des
adresses, et dix rues de Lyon deviendraient dix fois « Lyon » dans la liste.

`ADRESSE_API_BASE` permet de viser un autre serveur — c'est ce dont se servent
les tests.

### Un référentiel embarqué pour les positions

`prisma/data/communes.json.gz` (609 ko) contient les **35 273 communes
françaises** — métropole, outre-mer, Corse, plus les arrondissements de Paris,
Lyon et Marseille. C'est lui qui porte les coordonnées : une réponse d'API ne
décide pas d'où se trouve quelqu'un, et les distances doivent rester calculables
même quand un service extérieur ne répond plus.

Le fichier est construit par `scripts/construire-communes.ts`, à relancer à la
main quand le découpage administratif bouge (une fois par an tout au plus,
c'est le seul moment où une connexion sortante est nécessaire) :

```bash
npx tsx scripts/construire-communes.ts
npm run db:communes   # charge le référentiel et rattache les villes existantes
```

Deux sources sont croisées sur le code INSEE, parce qu'aucune ne suffit :
le découpage IGN donne les noms correctement accentués et tiretés
(« Saint-Étienne-de-Tinée ») et les contours dont on tire les centres ; le
référentiel La Poste donne les codes postaux et rattrape les 37 communes
minuscules que la simplification des contours avait fait disparaître. Les noms
de La Poste, eux, sont en capitales sans accents — inutilisables tels quels.

`npx prisma db seed` charge le référentiel au passage : inutile de le faire à
part.

### Ce qui en découle

- **Choix de la commune** par autocomplétion (nom ou code postal) à
  l'inscription, dans le profil et à la création d'une table. « st etienne »
  trouve Saint-Étienne : la recherche porte sur une forme normalisée, sans
  accent ni trait d'union, et développe les abréviations d'usage.
- **Recherche par rayon** réellement appliquée. La base préfiltre sur une boîte
  englobante — l'index sait comparer des bornes, pas calculer une haversine —
  puis `distanceKm` tranche. Le rectangle déborde volontairement du disque :
  trop petit, il écarterait des voisins réels sans que rien ne le signale.
- Les rayons proposés vont maintenant **jusqu'à 100 km** (contre 15 auparavant,
  calibrés sur des distances inventées) : hors des grandes villes, le joueur le
  plus proche est rarement à 8 km.
- L'encart « autour de toi » de l'accueil listait trois pastilles posées à des
  coordonnées écrites à la main. Ce sont désormais les tables réellement les
  plus proches, à leur distance réelle.

### Ce qui n'est pas fait

- **Pas de carte interactive.** Elle demande un fournisseur de tuiles, donc un
  tiers ; c'est un chantier à part.
- **Pas de « utiliser ma position ».** L'application ne stocke que des
  positions de communes : récupérer des coordonnées exactes pour les arrondir
  aussitôt n'apporterait qu'une permission de plus à demander.
- **France uniquement.** Le référentiel s'arrête aux frontières, et l'API
  d'adresses aussi.

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
- `Commune` (code INSEE, nom, code postal, département, latitude, longitude)

Il n'y a pas de génération d'occurrences pour les tables récurrentes (le champ est informatif
seulement).

## Pistes d'évolution

- Carte interactive, une fois choisi un fournisseur de tuiles.
- Notifications par e-mail ou push (celles dans l'application existent).
- Occurrences générées pour les tables récurrentes (le champ est informatif).
- Corriger une fiche du catalogue partagé (titre, durée, nombre de joueurs).
- Ajouter d'autres langues que le français et l'anglais.
