/**
 * Autocomplétion des communes par le géocodage de la Géoplateforme (IGN).
 *
 * C'est le géocodeur du service public français, adossé à la Base Adresse
 * Nationale : gratuit, sans clé, et surtout classé par importance réelle —
 * taper « lyon » remonte Lyon avant Lyons-la-Forêt, et une faute de frappe
 * reste rattrapée. Le référentiel embarqué, lui, ne sait trier que par
 * longueur de nom.
 *
 * **L'ancienne adresse `api-adresse.data.gouv.fr` est morte.** L'API a été
 * transférée à l'IGN courant 2025, puis cette URL a été décommissionnée fin
 * janvier 2026. Je l'avais codée en dur en me fiant à ce que je croyais savoir,
 * sans vérifier — la même erreur que pour BoardGameGeek.
 *
 * Limites annoncées : 50 requêtes par seconde et par adresse IP sur le
 * géocodage. La saisie est temporisée et les réponses mises en cache : on en
 * est très loin.
 *
 * L'appel part du serveur, pas du navigateur : la politique de contenu
 * n'autorise que notre propre domaine en `connect-src`, et cela évite d'envoyer
 * l'adresse IP de nos membres chez un tiers — même un tiers public.
 *
 * Ce module ne fait que proposer des suggestions. Le code INSEE choisi est
 * ensuite vérifié contre le référentiel local, qui reste seul juge des
 * coordonnées : une réponse d'API ne décide pas d'où se trouve quelqu'un.
 */

const BASE = (process.env.ADRESSE_API_BASE || "https://data.geopf.fr/geocodage").trim().replace(/\/$/, "");

/** Au-delà, on rend la main : c'est une aide à la saisie, pas une opération. */
const DELAI_MS = 4000;

const AGENT = "MyShelf/1.0 (+https://github.com/poundawan/MyShelf)";

export type CommuneSuggeree = {
  /** Code INSEE. C'est la seule chose qu'on retiendra de cette réponse. */
  code: string;
  nom: string;
  departement: string;
  codePostal: string | null;
};

export type ResultatSuggestions =
  | { statut: "ok"; communes: CommuneSuggeree[] }
  | { statut: "injoignable"; detail: string };

type Reponse = {
  features?: {
    properties?: {
      citycode?: string;
      name?: string;
      postcode?: string;
      context?: string;
      type?: string;
    };
  }[];
};

export async function suggererCommunes(terme: string, limite: number): Promise<ResultatSuggestions> {
  const q = terme.trim();
  if (q.length < 2) return { statut: "ok", communes: [] };

  // Forme héritée de la Base Adresse Nationale, que la Géoplateforme reprend.
  // `type=municipality` ne garde que les communes ; si ce filtre venait à ne
  // plus être honoré, on recevrait des adresses — dont le `citycode` reste
  // juste, et que l'appelant dédoublonne.
  const url = `${BASE}/search?q=${encodeURIComponent(q)}&type=municipality&limit=${limite}`;

  try {
    const reponse = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": AGENT },
      signal: AbortSignal.timeout(DELAI_MS),
      // Les communes ne changent pas d'un jour à l'autre, et une même saisie
      // revient souvent : « lyo » puis « lyon » pour toute la France.
      next: { revalidate: 60 * 60 * 24 },
    });

    if (!reponse.ok) {
      const detail = `HTTP ${reponse.status}`;
      // Le corps dit souvent ce que le statut tait : quota, paramètre refusé,
      // service déplacé. Ne pas le journaliser a déjà coûté cher.
      const debutCorps = (await reponse.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 200);
      console.error(`Géocodage : ${detail} sur ${url} | corps=${debutCorps}`);
      return { statut: "injoignable", detail };
    }

    const donnees = (await reponse.json()) as Reponse;
    return { statut: "ok", communes: (donnees.features ?? []).map(lire).filter(estValide) };
  } catch (erreur) {
    const detail = erreur instanceof Error ? `${erreur.name}: ${erreur.message}` : "erreur inconnue";
    console.error(`Géocodage injoignable sur ${url} — ${detail}`);
    return { statut: "injoignable", detail };
  }
}

function lire(feature: NonNullable<Reponse["features"]>[number]): CommuneSuggeree | null {
  const p = feature.properties;
  if (!p?.citycode || !p.name) return null;

  return {
    code: String(p.citycode),
    nom: String(p.name),
    // `context` vaut « 69, Rhône, Auvergne-Rhône-Alpes » : le département est
    // en tête. Absent, on le déduit du code INSEE.
    departement: p.context?.split(",")[0]?.trim() || departementDeSecours(String(p.citycode)),
    codePostal: p.postcode ? String(p.postcode) : null,
  };
}

/** Le code INSEE est numérique sauf en Corse (2A, 2B), et l'outre-mer tient sur trois chiffres. */
function departementDeSecours(code: string): string {
  return code.startsWith("97") || code.startsWith("98") ? code.slice(0, 3) : code.slice(0, 2);
}

function estValide(commune: CommuneSuggeree | null): commune is CommuneSuggeree {
  // Un code INSEE fait cinq caractères : 69123, 2A004, 97411. Toute réponse
  // qui n'en a pas l'allure est écartée avant d'atteindre un formulaire.
  return commune !== null && /^[0-9][0-9AB][0-9]{3}$/.test(commune.code);
}
