import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Faux BoardGameGeek, pour les tests.
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
 */

const PORT = Number(process.env.FAUX_BGG_PORT ?? 3199);
const FIXTURES = path.join(__dirname, "fixtures");
const lire = (nom: string) => readFileSync(path.join(FIXTURES, nom), "utf8");

const VIDE = '<?xml version="1.0" encoding="utf-8"?>\n<items total="0"></items>';

const serveur = createServer((requete, reponse) => {
  const url = new URL(requete.url ?? "/", `http://127.0.0.1:${PORT}`);
  const terme = (url.searchParams.get("query") ?? "").toLowerCase();
  const avecType = url.searchParams.has("type");

  const xml = (corps: string, statut = 200) => {
    reponse.writeHead(statut, { "Content-Type": "text/xml; charset=utf-8" });
    reponse.end(corps);
  };

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
  console.log(`Faux BoardGameGeek à l'écoute sur http://127.0.0.1:${PORT}`);
});
