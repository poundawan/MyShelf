// Lancé directement par `tsx`, ce script ne passe pas par la configuration
// Prisma : c'est donc à lui de lire le fichier .env.
import "dotenv/config";

import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { normaliserNom } from "../src/lib/geo";

/**
 * Charge le référentiel des communes en base, puis rattache les lignes qui
 * n'ont encore qu'une ville en texte libre.
 *
 * Le fichier est versionné dans le dépôt : aucun appel réseau ici. Il est
 * régénéré à la main par `scripts/construire-communes.ts`, une fois par an
 * tout au plus.
 *
 *     npx tsx prisma/communes.ts                     # charge et rattache
 *     npx tsx prisma/communes.ts --charger-seulement # charge, sans rattacher
 *
 * La seconde forme est appelée par `npm run build`. Sans elle, une base
 * fraîchement déployée n'a aucune commune, et le sélecteur de ville devient
 * silencieusement inutilisable : toutes les suggestions sont écartées au
 * recoupement, faute de pouvoir les situer. Compter sur une commande à lancer
 * à la main, c'est compter sur un oubli — et c'est exactement ce qui est
 * arrivé en production.
 */

const FICHIER = path.join(__dirname, "data", "communes.json.gz");

/** Postgres accepte de longues listes, mais pas un paquet de 35 000 lignes. */
const TAILLE_LOT = 2000;

type LigneCommune = [
  code: string,
  nom: string,
  codePostal: string | null,
  lat: number,
  lng: number,
  pays: string,
  subdivision: string,
];

export function lireReferentiel(): LigneCommune[] {
  const brut = JSON.parse(gunzipSync(readFileSync(FICHIER)).toString()) as { communes: LigneCommune[] };
  return brut.communes;
}

/**
 * Met la base en accord avec le fichier : ajoute ce qui manque, corrige ce qui
 * diffère, ne touche à rien d'autre.
 *
 * Une comparaison plutôt qu'un simple compte : la version précédente se
 * contentait d'insérer les codes absents, et une correction de nom — « Brussels »
 * devenu « Bruxelles » — ne serait jamais parvenue jusqu'aux bases déjà
 * peuplées. Lire trente-sept mille lignes courtes coûte quelques centaines de
 * millisecondes au build, contre un référentiel silencieusement périmé.
 *
 * Les lignes présentes en base mais absentes du fichier sont laissées en
 * place : des membres y sont peut-être rattachés, et une commune disparue
 * d'une source ne disparaît pas du monde.
 */
export async function chargerCommunes(prisma: PrismaClient) {
  const lignes = lireReferentiel().map(([code, nom, codePostal, latitude, longitude, pays, subdivision]) => ({
    code,
    pays,
    nom,
    nomRecherche: normaliserNom(nom),
    codePostal,
    departement: subdivision,
    latitude,
    longitude,
  }));

  const existantes = new Map(
    (await prisma.commune.findMany()).map((c) => [c.code, c] as const),
  );

  const aCreer = lignes.filter((l) => !existantes.has(l.code));
  const aCorriger = lignes.filter((l) => {
    const avant = existantes.get(l.code);
    return (
      avant !== undefined &&
      (avant.nom !== l.nom ||
        avant.nomRecherche !== l.nomRecherche ||
        avant.codePostal !== l.codePostal ||
        avant.departement !== l.departement ||
        avant.pays !== l.pays ||
        avant.latitude !== l.latitude ||
        avant.longitude !== l.longitude)
    );
  });

  if (aCreer.length === 0 && aCorriger.length === 0) {
    console.log(`Communes : ${existantes.size} en base, à jour.`);
    return;
  }

  for (let i = 0; i < aCreer.length; i += TAILLE_LOT) {
    await prisma.commune.createMany({ data: aCreer.slice(i, i + TAILLE_LOT), skipDuplicates: true });
  }
  for (const ligne of aCorriger) {
    await prisma.commune.update({ where: { code: ligne.code }, data: ligne });
  }

  console.log(
    `Communes : ${await prisma.commune.count()} en base ` +
      `(${aCreer.length} ajoutée(s), ${aCorriger.length} corrigée(s)).`,
  );
}

/**
 * Rattache à une commune les membres, tables et clubs qui n'en ont pas encore.
 *
 * Sert une seule fois, pour les données saisies avant l'arrivée du référentiel.
 * En cas d'homonymie — et la France en compte beaucoup — on ne devine pas : la
 * ligne reste sans commune et la personne choisira elle-même. Une position
 * fausse serait pire que pas de position du tout.
 */
export async function rattacherCommunes(prisma: PrismaClient) {
  const communes = await prisma.commune.findMany({ select: { code: true, nom: true, nomRecherche: true } });

  const parNom = new Map<string, string[]>();
  for (const c of communes) {
    const liste = parNom.get(c.nomRecherche) ?? [];
    liste.push(c.code);
    parNom.set(c.nomRecherche, liste);
  }

  const resoudre = (ville: string): string | null => {
    const candidats = parNom.get(normaliserNom(ville));
    return candidats && candidats.length === 1 ? candidats[0] : null;
  };

  const ambigus = new Set<string>();
  let rattaches = 0;

  for (const table of ["user", "event", "club"] as const) {
    const lignes = await (prisma[table] as { findMany: (a: unknown) => Promise<{ id: string; city: string }[]> })
      .findMany({ where: { communeCode: null }, select: { id: true, city: true } });

    for (const ligne of lignes) {
      const code = resoudre(ligne.city);
      if (!code) {
        ambigus.add(ligne.city);
        continue;
      }
      await (prisma[table] as { update: (a: unknown) => Promise<unknown> })
        .update({ where: { id: ligne.id }, data: { communeCode: code } });
      rattaches++;
    }
  }

  console.log(`Rattachement : ${rattaches} ligne(s) reliée(s) à une commune.`);
  if (ambigus.size > 0) {
    console.log(
      `Villes non reconnues ou ambiguës, laissées sans commune : ${[...ambigus].join(", ")}\n` +
        "Les personnes concernées choisiront leur commune elles-mêmes.",
    );
  }
}

async function principal() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  try {
    await chargerCommunes(prisma);
    // Le rattachement des villes saisies en texte libre est une reprise de
    // données, pas une étape de déploiement : inutile de la rejouer à chaque
    // build.
    if (!process.argv.includes("--charger-seulement")) await rattacherCommunes(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  principal().catch((erreur) => {
    console.error(erreur);
    process.exit(1);
  });
}
