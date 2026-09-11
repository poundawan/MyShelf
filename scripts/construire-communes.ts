/**
 * Construit le référentiel des communes françaises embarqué dans le dépôt.
 *
 * À lancer à la main, rarement (une fusion de communes par an environ) :
 *
 *     npx tsx scripts/construire-communes.ts
 *
 * C'est le seul moment où une connexion sortante est nécessaire. Ensuite,
 * l'application géolocalise sans appeler personne : pas de clé d'API, pas de
 * quota, pas de service tiers à qui l'on confierait l'adresse de nos membres.
 *
 * Deux sources, jointes sur le code INSEE, parce qu'aucune ne suffit :
 *
 * - `france-geojson` (Grégoire David, d'après le découpage IGN) donne les noms
 *   correctement accentués et tiretés — « Saint-Étienne-de-Tinée » — et les
 *   contours dont on tire le centre de chaque commune.
 * - Le référentiel La Poste donne les codes postaux, et les coordonnées de
 *   secours des 37 communes minuscules que la simplification des contours a
 *   fait disparaître. Ses noms, eux, sont en capitales sans accents
 *   (« SAINT ETIENNE DE TINEE ») : inutilisables tels quels.
 *
 * Les arrondissements de Paris, Lyon et Marseille viennent uniquement de La
 * Poste : le découpage géographique ne connaît que les communes entières, or
 * Marseille fait vingt kilomètres de large et « Marseille » ne dit pas grand
 * chose d'une distance.
 */

import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { departementDepuisInsee } from "../src/lib/geo";

const GEOJSON =
  "https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/communes-version-simplifiee.geojson";
const LA_POSTE = "https://raw.githubusercontent.com/high54/Communes-France-JSON/master/france.json";

/**
 * Localités du monde entier, dont on n'extrait que les pays francophones
 * voisins. Aucune source aussi complète que l'IGN n'existe pour eux sur les
 * dépôts accessibles ; celle-ci couvre l'essentiel, avec ses limites
 * documentées plus bas.
 */
const MONDE =
  "https://raw.githubusercontent.com/dr5hn/countries-states-cities-database/master/json/countries%2Bstates%2Bcities.json";

/** Pays repris en plus de la France. */
const PAYS_VOISINS = ["BE", "CH", "LU", "MC"];

/**
 * Noms anglicisés dans la source, corrigés vers le nom officiel local.
 *
 * Le reste du jeu de données emploie déjà les noms officiels — « Antwerpen »,
 * « Basel », « Kortrijk » —, ce qui est le bon choix dans des pays
 * plurilingues. Seules ces trois entrées font exception, et ce sont
 * précisément les plus visibles.
 */
const NOMS_CORRIGES: Record<string, string> = {
  Brussels: "Bruxelles",
  Geneva: "Genève",
  Ostend: "Oostende",
};

/**
 * Localités absentes de la source et ajoutées à la main.
 *
 * Monaco n'y figure que par ses quartiers — Monte-Carlo, La Condamine,
 * Fontvieille — mais jamais sous son propre nom, alors que la principauté ne
 * compte qu'une seule commune. Chercher « Monaco » ne donnait donc rien.
 * Les quartiers sont conservés : ils restent des noms que les gens emploient.
 */
const AJOUTS: Ligne[] = [["mc-monaco", "Monaco", "98000", 43.73842, 7.42462, "MC", "Monaco"]];

const SORTIE = path.join(__dirname, "..", "prisma", "data", "communes.json.gz");

type Anneau = [number, number][];
type Geometrie =
  | { type: "Polygon"; coordinates: Anneau[] }
  | { type: "MultiPolygon"; coordinates: Anneau[][] };

/**
 * Centre d'un anneau polygonal par la formule du lacet, avec son aire.
 *
 * Le centre de gravité vaut mieux qu'un simple milieu de boîte englobante :
 * sur une commune allongée le long d'une vallée, la boîte désigne un versant
 * où personne n'habite.
 */
function centreAnneau(anneau: Anneau): { x: number; y: number; aire: number } {
  let aire = 0, cx = 0, cy = 0;
  for (let i = 0; i < anneau.length - 1; i++) {
    const [x0, y0] = anneau[i];
    const [x1, y1] = anneau[i + 1];
    const f = x0 * y1 - x1 * y0;
    aire += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }
  if (aire === 0) {
    // Anneau dégénéré (commune réduite à quelques points) : moyenne simple.
    const moyenne = (k: 0 | 1) => anneau.reduce((s, p) => s + p[k], 0) / anneau.length;
    return { x: moyenne(0), y: moyenne(1), aire: 0 };
  }
  aire *= 0.5;
  return { x: cx / (6 * aire), y: cy / (6 * aire), aire: Math.abs(aire) };
}

/** Centre d'une commune, pondéré par l'aire quand elle a plusieurs morceaux. */
function centre(geometrie: Geometrie): { lat: number; lng: number } {
  const polygones = geometrie.type === "Polygon" ? [geometrie.coordinates] : geometrie.coordinates;
  let total = 0, sx = 0, sy = 0;
  let secours: { x: number; y: number } | null = null;

  for (const polygone of polygones) {
    const { x, y, aire } = centreAnneau(polygone[0]);
    secours ??= { x, y };
    sx += x * aire;
    sy += y * aire;
    total += aire;
  }
  // Le GeoJSON est en longitude/latitude, dans cet ordre.
  return total > 0 ? { lat: sy / total, lng: sx / total } : { lat: secours!.y, lng: secours!.x };
}

/** Le code INSEE est numérique sauf en Corse (2A/2B), où il faut le laisser tel quel. */
function normaliserInsee(brut: string | number): string {
  const texte = String(brut).trim().toUpperCase();
  return /^\d+$/.test(texte) ? texte.padStart(5, "0") : texte;
}

/** « PARIS 11 » → « Paris 11e », « LYON 07 » → « Lyon 7e », « PARIS 01 » → « Paris 1er ». */
function nomArrondissement(ville: string, numero: number): string {
  return `${ville} ${numero}${numero === 1 ? "er" : "e"}`;
}

type LignePoste = {
  Code_commune_INSEE: string | number;
  Nom_commune: string;
  Code_postal: string | number;
  coordonnees_gps: string;
};

async function recuperer<T>(url: string, quoi: string): Promise<T> {
  process.stdout.write(`Téléchargement de ${quoi}… `);
  const reponse = await fetch(url);
  if (!reponse.ok) throw new Error(`${quoi} : HTTP ${reponse.status}`);
  const donnees = (await reponse.json()) as T;
  console.log("fait.");
  return donnees;
}

type PaysMonde = {
  iso2?: string;
  states?: { name?: string; cities?: { id?: number; name?: string; latitude?: string; longitude?: string }[] }[];
};

/** Une ligne du référentiel, dans l'ordre des colonnes du fichier. */
type Ligne = [
  code: string,
  nom: string,
  codePostal: string | null,
  latitude: number,
  longitude: number,
  pays: string,
  subdivision: string,
];

/** Localités des pays voisins, nettoyées. */
async function voisins(): Promise<Ligne[]> {
  const monde = await recuperer<PaysMonde[]>(MONDE, "les localités des pays voisins");
  const lignes: Ligne[] = [];
  let quartiers = 0;

  for (const pays of monde) {
    const iso = pays.iso2;
    if (!iso || !PAYS_VOISINS.includes(iso)) continue;

    const vus = new Set<string>();
    for (const region of pays.states ?? []) {
      for (const ville of region.cities ?? []) {
        const brut = (ville.name ?? "").trim();
        if (!brut || !ville.id) continue;

        // « Adliswil / Hündli-Zopf » : la source mélange des quartiers suisses
        // aux communes. Ils n'ajoutent rien — leur commune est déjà là — et
        // encombreraient la liste de suggestions.
        if (brut.includes(" / ")) {
          quartiers++;
          continue;
        }

        const lat = Number(ville.latitude);
        const lng = Number(ville.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

        const nom = NOMS_CORRIGES[brut] ?? brut;
        // Une même localité peut figurer dans deux subdivisions : on garde la
        // première, la seconde n'apporterait qu'un doublon à l'écran.
        const cle = `${nom}|${region.name ?? ""}`;
        if (vus.has(cle)) continue;
        vus.add(cle);

        lignes.push([
          `${iso.toLowerCase()}-${ville.id}`,
          nom,
          null,
          arrondir(lat),
          arrondir(lng),
          iso,
          (region.name ?? "").trim() || iso,
        ]);
      }
    }
  }

  lignes.push(...AJOUTS);
  console.log(`Pays voisins : ${lignes.length} localités (${quartiers} quartiers suisses écartés, ${AJOUTS.length} ajoutée(s) à la main).`);
  return lignes;
}

async function principal() {
  const geo = await recuperer<{ features: { properties: { code: string; nom: string }; geometry: Geometrie | null }[] }>(
    GEOJSON, "le découpage des communes",
  );
  const poste = await recuperer<LignePoste[]>(LA_POSTE, "les codes postaux");

  // Index du référentiel La Poste : un code postal représentatif et des
  // coordonnées, par code INSEE.
  const codesPostaux = new Map<string, string[]>();
  const coordonneesPoste = new Map<string, { lat: number; lng: number }>();
  const nomsPoste = new Map<string, string>();

  for (const ligne of poste) {
    const insee = normaliserInsee(ligne.Code_commune_INSEE);
    const cp = String(ligne.Code_postal).trim().padStart(5, "0");
    const liste = codesPostaux.get(insee) ?? [];
    if (!liste.includes(cp)) liste.push(cp);
    codesPostaux.set(insee, liste);
    nomsPoste.set(insee, String(ligne.Nom_commune).trim());

    const [lat, lng] = String(ligne.coordonnees_gps ?? "").split(",").map((v) => Number(v.trim()));
    if (Number.isFinite(lat) && Number.isFinite(lng) && !coordonneesPoste.has(insee)) {
      coordonneesPoste.set(insee, { lat, lng });
    }
  }

  const lignes: Ligne[] = [];
  let viaPoste = 0;
  const perdues: string[] = [];

  for (const f of geo.features) {
    const code = f.properties.code;
    let position: { lat: number; lng: number } | undefined;

    if (f.geometry) {
      position = centre(f.geometry);
    } else if (coordonneesPoste.has(code)) {
      // La simplification des contours a fait disparaître quelques îles et
      // communes minuscules : La Poste les connaît encore.
      position = coordonneesPoste.get(code);
      viaPoste++;
    }

    if (!position) {
      perdues.push(`${code} ${f.properties.nom}`);
      continue;
    }

    const cp = codesPostaux.get(code)?.sort()[0] ?? null;
    lignes.push([code, f.properties.nom, cp, arrondir(position.lat), arrondir(position.lng), "FR", departementDepuisInsee(code)]);
  }

  // Arrondissements : le découpage géographique ne connaît que « Paris »,
  // « Lyon » et « Marseille » d'un seul tenant.
  const villesDecoupees: [string, string][] = [["751", "Paris"], ["6938", "Lyon"], ["132", "Marseille"]];
  let arrondissements = 0;

  for (const [insee, nom] of nomsPoste) {
    const ville = villesDecoupees.find(([prefixe]) => insee.startsWith(prefixe));
    if (!ville) continue;
    const numero = Number(nom.match(/(\d+)\s*$/)?.[1]);
    if (!Number.isInteger(numero) || numero < 1) continue;
    const position = coordonneesPoste.get(insee);
    if (!position) continue;

    lignes.push([
      insee,
      nomArrondissement(ville[1], numero),
      codesPostaux.get(insee)?.sort()[0] ?? null,
      arrondir(position.lat),
      arrondir(position.lng),
      "FR",
      departementDepuisInsee(insee),
    ]);
    arrondissements++;
  }

  const etrangeres = await voisins();
  lignes.push(...etrangeres);
  lignes.sort((a, b) => a[0].localeCompare(b[0]));

  const document = {
    source: { decoupage: GEOJSON, codesPostaux: LA_POSTE, voisins: MONDE },
    genereLe: new Date().toISOString().slice(0, 10),
    colonnes: ["code", "nom", "codePostal", "latitude", "longitude", "pays", "subdivision"],
    communes: lignes,
  };

  const compresse = gzipSync(Buffer.from(JSON.stringify(document)), { level: 9 });
  writeFileSync(SORTIE, compresse);

  console.log(`\n${lignes.length} localités : ${lignes.length - etrangeres.length} en France ` +
    `(${arrondissements} arrondissements, ${viaPoste} rattrapées via La Poste), ${etrangeres.length} chez les voisins.`);
  if (perdues.length) console.log(`Sans position, donc écartées : ${perdues.join(", ")}`);
  console.log(`Écrit dans ${path.relative(process.cwd(), SORTIE)} — ${(compresse.length / 1024).toFixed(0)} ko compressés.`);
}

/** Cinq décimales valent environ un mètre : bien au-delà du besoin. */
function arrondir(valeur: number) {
  return Math.round(valeur * 1e5) / 1e5;
}

principal().catch((erreur) => {
  console.error(erreur);
  process.exit(1);
});
