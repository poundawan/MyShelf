import "server-only";

import { boiteEnglobante, distanceKm, type Position } from "@/lib/geo";

/**
 * Distances entre les membres, les tables et les clubs.
 *
 * Tout part de la commune : c'est la seule position que l'application connaisse.
 * Elle n'a jamais les coordonnées exactes de personne, et c'est délibéré —
 * afficher des distances au mètre près entre membres permettrait de retrouver
 * un domicile par recoupement de trois mesures.
 */

/** Ce qu'il faut savoir d'une ligne pour la situer : sa commune, ou rien. */
export type SituableParCommune = { commune: { latitude: number; longitude: number } | null } | null;

/** À inclure dans les requêtes Prisma pour pouvoir calculer une distance. */
export const POSITION_COMMUNE = { select: { latitude: true, longitude: true } } as const;

/**
 * Distance en kilomètres, ou `null` si l'un des deux bouts n'a pas de commune.
 *
 * `null` n'est pas un détail d'affichage : c'est ce qui remplace les distances
 * inventées d'avant. Une position inconnue se dit, elle ne se devine pas.
 */
export function distanceDepuis(origine: Position | null, cible: SituableParCommune): number | null {
  if (!origine || !cible?.commune) return null;
  return distanceKm(origine, cible.commune);
}

/**
 * Clause Prisma préfiltrant sur la boîte englobante du rayon demandé.
 *
 * L'index sait comparer des bornes, pas calculer une haversine : la base
 * élimine grossièrement, puis `distanceDepuis` tranche au kilomètre près. Les
 * lignes sans commune sont écartées — on ne peut pas affirmer qu'elles sont à
 * portée.
 */
export function filtreRayonCommune(origine: Position, rayonKm: number) {
  const boite = boiteEnglobante(origine, rayonKm);
  return {
    commune: {
      is: {
        latitude: { gte: boite.latMin, lte: boite.latMax },
        longitude: { gte: boite.lngMin, lte: boite.lngMax },
      },
    },
  };
}

/** Trie du plus proche au plus lointain, les positions inconnues en dernier. */
export function parProximite<T>(elements: T[], km: (element: T) => number | null): T[] {
  return [...elements].sort((a, b) => (km(a) ?? Infinity) - (km(b) ?? Infinity));
}
