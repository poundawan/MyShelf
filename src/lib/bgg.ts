/**
 * Accès au catalogue BoardGameGeek (API XML v2).
 *
 * C'est la seule base ludique publique encore vivante et sans clé : Board Game
 * Atlas a fermé en 2023, Tric Trac n'expose plus d'API. Usage non commercial,
 * attribution demandée — d'où la mention affichée sous le sélecteur.
 *
 * Aucun secret n'est nécessaire, mais l'appel reste côté serveur : BGG ne
 * renvoie pas d'en-tête CORS, et cela évite d'exposer les navigateurs de nos
 * membres à un tiers.
 */

const BASE = "https://boardgamegeek.com/xmlapi2";

/** BGG est lent quand son cache est froid ; au-delà, on rend la main. */
const DELAI_MS = 8000;

/** Nombre de fiches détaillées demandées après une recherche. */
const MAX_RESULTATS = 8;

/**
 * Hôtes dont on accepte une image.
 *
 * La jaquette finit dans un `<img src>` de notre domaine : on ne recopie que
 * des URL venues de là où on croit les avoir demandées.
 */
const HOTES_IMAGE = ["cf.geekdo-images.com", "geekdo-images.com", "images.boardgamegeek.com"];

export type JeuBgg = {
  bggId: number;
  title: string;
  year: number | null;
  thumbnail: string | null;
  image: string | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  durationMin: number | null;
  minAge: number | null;
};

/** Recherche par titre, puis récupération des fiches en un seul appel. */
export async function rechercherJeuxBgg(requete: string): Promise<JeuBgg[]> {
  const terme = requete.trim();
  if (terme.length < 2) return [];

  const xmlRecherche = await recuperer(
    `${BASE}/search?type=boardgame,boardgameexpansion&query=${encodeURIComponent(terme)}`,
  );
  if (!xmlRecherche) return [];

  const ids = analyserIdsRecherche(xmlRecherche).slice(0, MAX_RESULTATS);
  if (ids.length === 0) return [];

  const xmlFiches = await recuperer(`${BASE}/thing?id=${ids.join(",")}`);
  if (!xmlFiches) return [];

  return analyserFiches(xmlFiches);
}

/**
 * Identifiants d'une réponse `/search`. Séparé de l'appel réseau pour être
 * vérifiable sans sortir de la machine.
 */
export function analyserIdsRecherche(xml: string): number[] {
  return extraireItems(xml)
    .map((item) => Number(attribut(item.entete, "id")))
    .filter((id) => Number.isInteger(id) && id > 0);
}

/** Fiches d'une réponse `/thing`, dans l'ordre où BGG les renvoie. */
export function analyserFiches(xml: string): JeuBgg[] {
  return extraireItems(xml).map(lireFiche).filter((jeu): jeu is JeuBgg => jeu !== null);
}

async function recuperer(url: string): Promise<string | null> {
  try {
    const reponse = await fetch(url, {
      headers: { Accept: "application/xml" },
      signal: AbortSignal.timeout(DELAI_MS),
      // Les fiches BGG ne bougent pas d'un jour à l'autre.
      next: { revalidate: 60 * 60 * 24 },
    });
    // 202 : BGG a mis la demande en file d'attente. On ne fait pas patienter,
    // la personne relancera sa recherche.
    if (!reponse.ok || reponse.status === 202) return null;
    return await reponse.text();
  } catch {
    // Réseau coupé, délai dépassé, BGG en maintenance : le formulaire doit
    // rester utilisable à la main.
    return null;
  }
}

type Item = { entete: string; corps: string };

/** Découpe la réponse en items, qu'ils soient auto-fermants ou non. */
function extraireItems(xml: string): Item[] {
  const items: Item[] = [];
  const regex = /<item\b([^>]*?)(\/)?>/g;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(xml)) !== null) {
    if (m[2]) {
      items.push({ entete: m[1], corps: "" });
      continue;
    }
    const fin = xml.indexOf("</item>", regex.lastIndex);
    if (fin === -1) break;
    items.push({ entete: m[1], corps: xml.slice(regex.lastIndex, fin) });
    regex.lastIndex = fin + "</item>".length;
  }
  return items;
}

function attribut(source: string, nom: string): string | null {
  const m = new RegExp(`\\b${nom}="([^"]*)"`).exec(source);
  return m ? decoder(m[1]) : null;
}

/** Valeur de la balise `<nom value="…" />`, en ignorant les doublons suivants. */
function valeur(corps: string, nom: string): string | null {
  const m = new RegExp(`<${nom}\\b[^>]*\\bvalue="([^"]*)"`).exec(corps);
  return m ? decoder(m[1]) : null;
}

function texte(corps: string, nom: string): string | null {
  const m = new RegExp(`<${nom}>([\\s\\S]*?)</${nom}>`).exec(corps);
  return m ? decoder(m[1]).trim() : null;
}

function entier(brut: string | null): number | null {
  if (!brut) return null;
  const n = Number(brut);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/** Ne garde une URL d'image que si elle vient bien de chez BGG, en HTTPS. */
function imageSure(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsee = new URL(url.startsWith("//") ? `https:${url}` : url);
    if (parsee.protocol !== "https:") return null;
    return HOTES_IMAGE.includes(parsee.hostname) ? parsee.toString() : null;
  } catch {
    return null;
  }
}

function lireFiche(item: Item): JeuBgg | null {
  const bggId = Number(attribut(item.entete, "id"));
  if (!Number.isInteger(bggId) || bggId <= 0) return null;

  // Un jeu porte un nom par langue ; « primary » est celui qui fait foi.
  const primaire = /<name\b[^>]*\btype="primary"[^>]*\bvalue="([^"]*)"/.exec(item.corps)
    ?? /<name\b[^>]*\bvalue="([^"]*)"[^>]*\btype="primary"/.exec(item.corps);
  const title = primaire ? decoder(primaire[1]).trim() : null;
  if (!title) return null;

  return {
    bggId,
    title,
    year: entier(valeur(item.corps, "yearpublished")),
    thumbnail: imageSure(texte(item.corps, "thumbnail")),
    image: imageSure(texte(item.corps, "image")),
    minPlayers: entier(valeur(item.corps, "minplayers")),
    maxPlayers: entier(valeur(item.corps, "maxplayers")),
    durationMin: entier(valeur(item.corps, "playingtime")),
    minAge: entier(valeur(item.corps, "minage")),
  };
}

const ENTITES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
};

/** Décode les entités XML, y compris les formes numériques (`&#233;`). */
export function decoder(brut: string): string {
  return brut.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (entier_, nom: string) => {
    if (nom.startsWith("#")) {
      const code = nom[1] === "x" || nom[1] === "X" ? parseInt(nom.slice(2), 16) : parseInt(nom.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entier_;
    }
    return ENTITES[nom] ?? entier_;
  });
}

/** Réexporté pour la validation côté action : la jaquette doit venir de BGG. */
export function estImageBgg(url: string): boolean {
  return imageSure(url) !== null;
}
