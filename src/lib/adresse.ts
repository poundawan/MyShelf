/**
 * Autocomplétion des communes par la Base Adresse Nationale.
 *
 * `api-adresse.data.gouv.fr` est le géocodeur du service public français :
 * gratuit, sans clé, sans quota déclaré, et surtout classé par importance
 * réelle — taper « lyon » remonte Lyon avant Lyons-la-Forêt, et une faute de
 * frappe reste rattrapée. Le référentiel embarqué, lui, ne sait trier que par
 * longueur de nom.
 *
 * L'appel part du serveur, pas du navigateur : la politique de contenu
 * n'autorise que notre propre domaine en `connect-src`, et cela évite d'envoyer
 * l'adresse IP de nos membres chez un tiers — même un tiers public.
 *
 * Ce module ne fait que proposer des suggestions. Le code INSEE choisi est
 * ensuite vérifié contre le référentiel local, qui reste seul juge des
 * coordonnées : une réponse d'API ne décide pas d'où se trouve quelqu'un.
 */

const BASE = process.env.ADRESSE_API_BASE || "https://api-adresse.data.gouv.fr";

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

  const url = `${BASE}/search/?q=${encodeURIComponent(q)}&type=municipality&limit=${limite}`;

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
      console.error(`Base Adresse Nationale : ${detail} sur ${url}`);
      return { statut: "injoignable", detail };
    }

    const donnees = (await reponse.json()) as Reponse;
    return { statut: "ok", communes: (donnees.features ?? []).map(lire).filter(estValide) };
  } catch (erreur) {
    const detail = erreur instanceof Error ? `${erreur.name}: ${erreur.message}` : "erreur inconnue";
    console.error(`Base Adresse Nationale injoignable — ${detail}`);
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
