"use server";

import { prisma } from "@/lib/prisma";
import { normaliserRecherche } from "@/lib/geo";
import { suggererCommunes } from "@/lib/adresse";

/**
 * Autocomplétion des communes pour les formulaires.
 *
 * Le référentiel couvre la France et les pays francophones voisins ; le
 * service d'adresses, lui, s'arrête aux frontières françaises. Une recherche
 * sur « Genève » ne trouvera donc rien chez lui et sera servie par le
 * référentiel — ce n'est pas une panne, et l'écran ne doit pas le prétendre.
 *
 * Les suggestions viennent de la **Base Adresse Nationale** : elle classe par
 * importance réelle et rattrape les fautes de frappe, là où le référentiel
 * embarqué ne sait trier que par longueur de nom.
 *
 * Mais elle ne décide de rien. Chaque code INSEE qu'elle renvoie est recoupé
 * avec le référentiel local, qui reste seul juge du nom retenu et des
 * coordonnées : une suggestion qu'on ne saurait pas positionner ne serait
 * qu'un piège de plus — on pourrait la choisir sans jamais obtenir de distance.
 *
 * Si l'API ne répond pas, la recherche locale prend le relais. Le formulaire
 * reste utilisable, et l'écran le signale plutôt que de laisser croire que
 * la commune cherchée n'existe pas.
 *
 * Volontairement ouverte aux visiteurs non connectés : le champ sert aussi à
 * l'inscription, et elle ne révèle rien sur les membres.
 */

export type CommuneTrouvee = {
  code: string;
  nom: string;
  pays: string;
  departement: string;
  codePostal: string | null;
};

export type ResultatCommunes = {
  communes: CommuneTrouvee[];
  /**
   * D'où viennent les suggestions.
   *
   * `api`     : le service d'adresses a répondu et son classement est retenu.
   * `local`   : le référentiel embarqué, par choix (un code postal) ou parce
   *             que le service n'a rien trouvé — ce qui n'est pas une panne.
   * `secours` : le service n'a pas répondu. Confondre les deux ferait passer
   *             une panne durable pour un classement médiocre, ou l'inverse.
   * `referentielVide` : la table des communes n'a pas été chargée sur ce
   *             serveur. Aucune ville ne peut alors être choisie, et rien ne
   *             le laisserait deviner — d'où un état à part.
   */
  source: "api" | "local" | "secours" | "referentielVide";
};

const MAX_RESULTATS = 8;

const CHAMPS = { code: true, nom: true, pays: true, departement: true, codePostal: true } as const;

export async function rechercherCommunesAction(terme: string): Promise<ResultatCommunes> {
  if (typeof terme !== "string") return { communes: [], source: "local" };
  const recherche = normaliserRecherche(terme).slice(0, 60);
  if (recherche.length < 2) return { communes: [], source: "local" };

  // Un code postal complet ne laisse aucune ambiguïté et n'a rien à gagner à
  // un aller-retour réseau : le référentiel local répond mieux, et toujours.
  if (/^\d{5}$/.test(recherche)) {
    return {
      communes: await prisma.commune.findMany({
        where: { codePostal: recherche },
        select: CHAMPS,
        orderBy: { nom: "asc" },
        take: MAX_RESULTATS,
      }),
      source: "local",
    };
  }

  const suggestions = await suggererCommunes(terme, MAX_RESULTATS);
  // Un service qui répond « rien » n'est pas un service en panne.
  const repli: ResultatCommunes["source"] = suggestions.statut === "ok" ? "local" : "secours";

  if (suggestions.statut === "ok") {
    const communes = await recouper(suggestions.communes.map((c) => c.code));
    if (communes.length > 0) return { communes, source: "api" };
  }

  const locales = await chercherEnLocal(recherche);
  if (locales.length > 0) return { communes: locales, source: repli };

  // Rien nulle part : avant de laisser croire que la commune n'existe pas, on
  // vérifie qu'on a bien une liste de communes à consulter.
  if ((await prisma.commune.count()) === 0) {
    console.error(
      "Le référentiel des communes est vide sur ce serveur : aucune ville ne peut être choisie, " +
        "et donc aucune distance calculée. Lancer `npm run db:communes`.",
    );
    return { communes: [], source: "referentielVide" };
  }

  return { communes: [], source: repli };
}

/**
 * Remplace des codes INSEE par les communes du référentiel, dans l'ordre reçu.
 *
 * L'ordre est celui de l'API — c'est tout son intérêt. Les codes qu'on ne
 * connaît pas sont écartés : ce sont des communes nées après la dernière
 * génération du référentiel, et les proposer reviendrait à offrir un choix
 * sans position.
 *
 * Le dédoublonnage n'est pas décoratif : si le filtre par type cessait d'être
 * honoré, l'API renverrait des adresses, et dix rues de Lyon deviendraient dix
 * fois « Lyon » dans la liste.
 */
async function recouper(codesBruts: string[]): Promise<CommuneTrouvee[]> {
  const codes = [...new Set(codesBruts)];
  if (codes.length === 0) return [];

  const connues = await prisma.commune.findMany({ where: { code: { in: codes } }, select: CHAMPS });
  const parCode = new Map(connues.map((c) => [c.code, c]));

  const inconnus = codes.filter((code) => !parCode.has(code));
  if (inconnus.length > 0) {
    // Deux causes très différentes, et mon premier message accusait la
    // mauvaise : une table vide n'est pas un découpage administratif qui bouge.
    const motif =
      connues.length === 0
        ? "Le référentiel est vraisemblablement vide sur ce serveur — lancer `npm run db:communes`."
        : "Le découpage administratif a sans doute bougé — relancer scripts/construire-communes.ts.";
    console.warn(`Communes suggérées par l'API mais absentes du référentiel : ${inconnus.join(", ")}. ${motif}`);
  }

  return codes.map((code) => parCode.get(code)).filter((c): c is CommuneTrouvee => c !== undefined);
}

/** Recherche de repli, sur le référentiel embarqué. */
async function chercherEnLocal(recherche: string): Promise<CommuneTrouvee[]> {
  // Le préfixe passe par l'index ; il répond à « lyon » comme à « saint et ».
  const debuts = await prisma.commune.findMany({
    where: { nomRecherche: { startsWith: recherche } },
    select: CHAMPS,
    take: MAX_RESULTATS * 4,
  });

  // Si le préfixe ne suffit pas, on cherche le terme n'importe où dans le nom :
  // « étienne » doit finir par trouver Saint-Étienne. C'est un balayage, mais
  // sur trente-cinq mille lignes courtes et seulement quand il le faut.
  const complement =
    debuts.length >= MAX_RESULTATS
      ? []
      : await prisma.commune.findMany({
          where: { nomRecherche: { contains: recherche }, NOT: { nomRecherche: { startsWith: recherche } } },
          select: CHAMPS,
          take: MAX_RESULTATS * 2,
        });

  return [...trier(debuts, recherche), ...trier(complement, recherche)].slice(0, MAX_RESULTATS);
}

/**
 * Le nom exact d'abord, puis les noms les plus courts.
 *
 * Sans donnée de population, la longueur du nom est le meilleur indice
 * disponible : « Lyon » passe devant « Lyons-la-Forêt ». C'est précisément ce
 * classement approximatif que la Base Adresse Nationale remplace quand elle
 * répond.
 */
function trier(communes: CommuneTrouvee[], recherche: string): CommuneTrouvee[] {
  return [...communes].sort((a, b) => {
    const exactA = normaliserRecherche(a.nom) === recherche ? 0 : 1;
    const exactB = normaliserRecherche(b.nom) === recherche ? 0 : 1;
    if (exactA !== exactB) return exactA - exactB;
    if (a.nom.length !== b.nom.length) return a.nom.length - b.nom.length;
    return a.nom.localeCompare(b.nom, "fr");
  });
}
