import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Faux services extérieurs, pour les tests.
 *
 * Un seul serveur tient les deux rôles : BoardGameGeek (`/xmlapi2/…`) et la
 * Base Adresse Nationale (`/search/`).
 *
 * L'API réelle n'est pas appelée par la suite : elle est lente, elle tombe, et
 * certains environnements de développement n'ont aucun accès sortant vers
 * elle. Mais ne rien appeler du tout laissait le maillon le plus fragile — la
 * requête HTTP et le traitement de ses statuts d'erreur — sans aucune
 * vérification. Ce serveur rejoue les réponses de BGG, y compris ses pannes.
 *
 * Le terme recherché sert d'aiguillage :
 *   wingspan  → réponse normale (fixtures bgg-search.xml / bgg-thing.xml)
 *   inconnu   → réponse valide, aucun résultat
 *   panne     → HTTP 500
 *   attente   → HTTP 202, comme BGG quand il prépare encore la réponse
 *   sanstype  → vide si le filtre `type` est présent, peuplée sinon
 *   lent      → ne répond jamais, pour éprouver le délai d'attente
 *   jetonko   → HTTP 401 malgré un jeton valide : le cas d'un jeton expiré
 *               ou révoqué.
 *
 * Côté adresses, le terme cherché sert aussi d'aiguillage :
 *   lyon        → trois communes, dans l'ordre d'importance de l'API
 *   doublons    → trois résultats partageant le même code INSEE
 *   vileurbane  → Villeurbanne, malgré la faute de frappe
 *   fantome     → une commune absente du référentiel embarqué
 *   panne       → HTTP 503
 *   lent        → aucune réponse
 *   (autre)     → aucun résultat
 */

const PORT = Number(process.env.FAUX_SERVICES_PORT ?? 3199);

/**
 * Jeton attendu par le faux BoardGameGeek.
 *
 * Tout appel sans cet en-tête reçoit un 401, comme le vrai depuis juillet 2025.
 * Conséquence utile : l'ensemble des tests BGG ne passe que si l'application
 * envoie réellement son `Authorization`. Nul besoin d'un test dédié — c'est
 * toute la suite qui le vérifie.
 */
const JETON_ATTENDU = process.env.FAUX_BGG_TOKEN ?? "jeton-de-test";
const FIXTURES = path.join(__dirname, "fixtures");
const lire = (nom: string) => readFileSync(path.join(FIXTURES, nom), "utf8");

const VIDE = '<?xml version="1.0" encoding="utf-8"?>\n<items total="0"></items>';

/**
 * Communes renvoyées par la fausse Base Adresse Nationale.
 *
 * Les codes INSEE sont réels : le recoupement avec le référentiel embarqué doit
 * aboutir, sinon la suggestion serait écartée — c'est précisément ce que ce
 * jeu d'essai doit pouvoir vérifier, y compris pour le code volontairement
 * inexistant.
 */
const COMMUNES_BAN: Record<string, [code: string, nom: string, cp: string, dep: string][]> = {
  // L'ordre compte : l'API classe par importance, et cet ordre doit survivre
  // au recoupement. Lyon avant Lyons-la-Forêt, ce que le tri local échouerait
  // à faire sur autre chose que la longueur du nom.
  lyon: [
    ["69123", "Lyon", "69001", "69"],
    ["69387", "Lyon 7e Arrondissement", "69007", "69"],
    ["27375", "Lyons-la-Forêt", "27480", "27"],
  ],
  // Une faute de frappe : l'intérêt même de passer par un service de géocodage.
  vileurbane: [["69266", "Villeurbanne", "69100", "69"]],
  // Une commune que le référentiel embarqué ne connaît pas : elle ne doit pas
  // être proposée, faute de pouvoir la situer.
  fantome: [["99999", "Commune Fantôme", "99999", "99"]],
  // Ce que renverrait l'API si le filtre par type cessait d'être honoré : des
  // adresses, toutes dans la même commune. La liste ne doit pas répéter Lyon
  // cinq fois.
  doublons: [
    ["69123", "Rue de la République", "69002", "69"],
    ["69123", "Place Bellecour", "69002", "69"],
    ["69123", "Quai Saint-Antoine", "69002", "69"],
  ],
};

const serveur = createServer((requete, reponse) => {
  const url = new URL(requete.url ?? "/", `http://127.0.0.1:${PORT}`);
  const terme = (url.searchParams.get("query") ?? "").toLowerCase();
  const avecType = url.searchParams.has("type");

  const xml = (corps: string, statut = 200) => {
    reponse.writeHead(statut, { "Content-Type": "text/xml; charset=utf-8" });
    reponse.end(corps);
  };

  // ---- Base Adresse Nationale ----
  if (url.pathname.startsWith("/search")) {
    const q = (url.searchParams.get("q") ?? "").toLowerCase().trim();

    if (q === "panne") {
      reponse.writeHead(503, { "Content-Type": "application/json" });
      return reponse.end('{"erreur":"indisponible"}');
    }
    if (q === "lent") return; // aucune réponse : le client doit abandonner

    const communes = COMMUNES_BAN[q] ?? [];
    reponse.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    return reponse.end(
      JSON.stringify({
        type: "FeatureCollection",
        features: communes.map(([code, nom, cp, dep]) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [4.83, 45.75] },
          properties: { citycode: code, name: nom, postcode: cp, context: `${dep}, Rhône`, type: "municipality" },
        })),
        attribution: "BAN",
      }),
    );
  }

  // ---- BoardGameGeek ----
  if (requete.headers.authorization !== `Bearer ${JETON_ATTENDU}`) {
    return xml("Unauthorized. See https://boardgamegeek.com/using_the_xml_api", 401);
  }

  if (terme === "jetonko") return xml("Unauthorized.", 401);

  if (url.pathname.endsWith("/thing")) {
    // Les identifiants demandés viennent de la recherche : on renvoie les
    // fiches correspondantes sans chercher plus loin.
    return xml(lire("bgg-thing.xml"));
  }

  if (terme === "panne") return xml("<html>erreur</html>", 500);
  if (terme === "attente") return xml("", 202);
  if (terme === "lent") return; // aucune réponse : le client doit abandonner
  if (terme === "inconnu") return xml(VIDE);
  if (terme === "sanstype") return xml(avecType ? VIDE : lire("bgg-search.xml"));

  return xml(lire("bgg-search.xml"));
});

serveur.listen(PORT, "127.0.0.1", () => {
  console.log(`Faux services à l'écoute sur http://127.0.0.1:${PORT}`);
});
