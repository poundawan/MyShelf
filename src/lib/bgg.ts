/**
 * Accès au catalogue BoardGameGeek (API XML v2).
 *
 * C'est la seule base ludique publique encore vivante : Board Game Atlas a
 * fermé en 2023, Tric Trac n'expose plus d'API.
 *
 * **Depuis le 2 juillet 2025, elle exige une inscription et un jeton.** Tout
 * appel sans en-tête `Authorization` reçoit un 401 — commercial ou non. Le
 * jeton se demande sur https://boardgamegeek.com/using_the_xml_api et se
 * fournit ici par la variable d'environnement `BGG_API_TOKEN`.
 *
 * L'appel reste côté serveur : BGG ne renvoie pas d'en-tête CORS, cela évite
 * d'exposer les navigateurs de nos membres à un tiers, et surtout le jeton n'a
 * rien à faire dans du code envoyé au navigateur.
 */

/**
 * Racine de l'API.
 *
 * `boardgamegeek.com`, **sans `www`** : leur documentation en fait une
 * condition explicite du bon fonctionnement du jeton. J'avais ajouté
 * `api.geekdo.com` en secours en croyant contourner un pare-feu ; ce n'était
 * pas le problème, ce nom n'est documenté nulle part, et chaque appel inutile
 * pèse sur un quota qu'ils demandent de ménager. Il est retiré.
 *
 * Surchargeable par `BGG_API_BASE` : les tests pointent vers un faux
 * BoardGameGeek local, ce qui permet de vérifier toute la chaîne sans accès
 * réseau sortant.
 */
const BASE = (process.env.BGG_API_BASE || "https://boardgamegeek.com/xmlapi2").trim().replace(/\/$/, "");

/**
 * BoardGameGeek demande aux applications de s'identifier. On le fait
 * franchement : le refus n'a jamais eu de rapport avec cet en-tête, et se
 * déguiser en navigateur n'aurait servi qu'à brouiller la piste.
 */
const AGENT = "MyShelf/1.0 (+https://github.com/poundawan/MyShelf)";

/**
 * Jeton d'application, délivré après inscription auprès de BoardGameGeek.
 *
 * Sans lui, chaque appel repart en 401 : inutile de solliciter leurs serveurs
 * pour un refus certain, et surtout inutile de présenter ce refus comme une
 * panne de leur côté.
 */
const JETON = process.env.BGG_API_TOKEN?.trim() || "";
export const jetonConfigure = () => JETON.length > 0;

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

/**
 * Issue d'une recherche.
 *
 * « Aucun jeu de ce nom » et « BoardGameGeek n'a pas répondu » sont deux
 * choses différentes, et les confondre laisse la personne chercher en boucle
 * un jeu qui existe. Le statut voyage donc jusqu'à l'écran, et `detail` dit
 * ce qui a échoué — c'est le seul moyen de diagnostiquer depuis un poste qui
 * n'a pas le même accès réseau que le serveur.
 */
export type ResultatRecherche = {
  jeux: JeuBgg[];
  /**
   * `nonConfigure` : aucun jeton en environnement — c'est à nous de le régler.
   * `jetonRefuse`  : BoardGameGeek a rejeté le jeton fourni (401).
   * `injoignable`  : tout le reste, de leur côté.
   *
   * Trois remèdes différents : s'inscrire, renouveler le jeton, attendre.
   * Les confondre a déjà coûté trois allers-retours.
   */
  statut: "ok" | "injoignable" | "nonConfigure" | "jetonRefuse";
  detail?: string;
};

/** Recherche par titre, puis récupération des fiches en un seul appel. */
export async function rechercherJeuxBgg(requete: string): Promise<ResultatRecherche> {
  const terme = requete.trim();
  if (terme.length < 2) return { jeux: [], statut: "ok" };

  // Sans jeton, la réponse est connue d'avance. On ne va pas déranger leurs
  // serveurs pour se faire refouler, ni faire croire qu'ils sont en panne.
  if (!JETON) return { jeux: [], statut: "nonConfigure" };

  const recherche = await recuperer(
    `/search?type=boardgame,boardgameexpansion&query=${encodeURIComponent(terme)}`,
  );
  if (!recherche.ok) return echec(recherche.detail);

  let ids = analyserIdsRecherche(recherche.xml);

  // Le filtre par type est la partie la plus fragile de la requête : si elle
  // ne ramène rien, on retente sans, plutôt que d'annoncer que le jeu
  // n'existe pas.
  if (ids.length === 0) {
    const large = await recuperer(`/search?query=${encodeURIComponent(terme)}`);
    if (large.ok) ids = analyserIdsRecherche(large.xml);
  }

  ids = ids.slice(0, MAX_RESULTATS);
  if (ids.length === 0) return { jeux: [], statut: "ok" };

  const fiches = await recuperer(`/thing?id=${ids.join(",")}`);
  if (!fiches.ok) return echec(fiches.detail);

  return { jeux: analyserFiches(fiches.xml), statut: "ok" };
}

/**
 * Un 401 alors qu'un jeton a été envoyé ne veut pas dire la même chose qu'une
 * panne : le jeton est refusé, expiré ou révoqué, et c'est réparable.
 */
function echec(detail: string): ResultatRecherche {
  const statut = detail.includes("HTTP 401") ? "jetonRefuse" : "injoignable";
  return { jeux: [], statut, detail };
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

type Recuperation = { ok: true; xml: string } | { ok: false; detail: string };

/** Nombre de tentatives quand BGG met la demande en file d'attente (202). */
const TENTATIVES_202 = 2;

/**
 * Récupère un chemin de l'API.
 *
 * Les échecs sont journalisés avec ce qu'il faut pour comprendre le refus —
 * statut, serveur, identifiant Cloudflare, en-tête `www-authenticate`, début du
 * corps. C'est exactement ce qui a fini par élucider le 401 : un statut nu ne
 * disait pas qu'il manquait un jeton.
 */
async function recuperer(chemin: string): Promise<Recuperation> {
  const url = `${BASE}${chemin}`;

  for (let tentative = 1; tentative <= TENTATIVES_202; tentative++) {
    try {
      const reponse = await fetch(url, {
        headers: {
          Accept: "application/xml, text/xml",
          "User-Agent": AGENT,
          ...(JETON ? { Authorization: `Bearer ${JETON}` } : {}),
        },
        signal: AbortSignal.timeout(DELAI_MS),
        // Les fiches BGG ne bougent pas d'un jour à l'autre.
        next: { revalidate: 60 * 60 * 24 },
      });

      // 202 : BGG a accepté la demande mais la prépare encore. Une seule
      // relance, sinon on rend la main plutôt que de faire attendre.
      if (reponse.status === 202) {
        if (tentative < TENTATIVES_202) {
          await new Promise((r) => setTimeout(r, 1200));
          continue;
        }
        return { ok: false, detail: "HTTP 202 (BGG prépare encore la réponse)" };
      }

      if (!reponse.ok) {
        // Le corps d'un refus de pare-feu explique souvent le refus mieux que
        // son code : page de défi, message de blocage, identifiant à citer.
        const debutCorps = (await reponse.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 200);
        console.error(
          `BoardGameGeek a refusé ${url} : HTTP ${reponse.status}` +
            ` | server=${reponse.headers.get("server") ?? "?"}` +
            ` | cf-ray=${reponse.headers.get("cf-ray") ?? "?"}` +
            ` | www-authenticate=${reponse.headers.get("www-authenticate") ?? "?"}` +
            ` | corps=${debutCorps}`,
        );
        return { ok: false, detail: `HTTP ${reponse.status}` };
      }

      return { ok: true, xml: await reponse.text() };
    } catch (erreur) {
      // Réseau coupé, délai dépassé, DNS, politique de sortie : le formulaire
      // doit rester utilisable à la main, mais on dit lequel.
      const detail = erreur instanceof Error ? `${erreur.name}: ${erreur.message}` : "erreur inconnue";
      console.error(`BoardGameGeek injoignable sur ${url} — ${detail}`);
      return { ok: false, detail };
    }
  }
  return { ok: false, detail: "HTTP 202" };
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
