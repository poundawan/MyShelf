"use server";

import { prisma } from "@/lib/prisma";
import { normaliserRecherche } from "@/lib/geo";

/**
 * Recherche dans le référentiel des communes, pour le sélecteur des
 * formulaires.
 *
 * Volontairement ouverte aux visiteurs non connectés : le champ sert aussi à
 * l'inscription. Elle ne lit qu'un référentiel public, ne révèle rien sur les
 * membres, et n'appelle aucun service tiers — il n'y a donc rien à protéger.
 */

export type CommuneTrouvee = {
  code: string;
  nom: string;
  departement: string;
  codePostal: string | null;
};

const MAX_RESULTATS = 8;

export async function rechercherCommunesAction(terme: string): Promise<CommuneTrouvee[]> {
  if (typeof terme !== "string") return [];
  const recherche = normaliserRecherche(terme).slice(0, 60);
  if (recherche.length < 2) return [];

  const champs = { code: true, nom: true, departement: true, codePostal: true } as const;

  // Un code postal saisi en entier désigne une commune bien plus sûrement
  // qu'un nom : « 69007 » ne laisse aucune ambiguïté.
  if (/^\d{5}$/.test(recherche)) {
    return prisma.commune.findMany({
      where: { codePostal: recherche },
      select: champs,
      orderBy: { nom: "asc" },
      take: MAX_RESULTATS,
    });
  }

  // Le préfixe passe par l'index ; il répond à « lyon » comme à « saint et ».
  const debuts = await prisma.commune.findMany({
    where: { nomRecherche: { startsWith: recherche } },
    select: champs,
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
          select: champs,
          take: MAX_RESULTATS * 2,
        });

  return [...trier(debuts, recherche), ...trier(complement, recherche)].slice(0, MAX_RESULTATS);
}

/**
 * Le nom exact d'abord, puis les noms les plus courts.
 *
 * Sans donnée de population, la longueur du nom est le meilleur indice
 * disponible : « Lyon » passe devant « Lyons-la-Forêt », et c'est presque
 * toujours celle-là qu'on cherchait.
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
