/**
 * Géométrie et normalisation des noms de lieux.
 *
 * Aucun accès base ni réseau : ce module est volontairement pur, pour être
 * vérifiable directement, sur des distances dont on connaît la valeur.
 */

export type Position = { latitude: number; longitude: number };

/** Rayon moyen de la Terre (IUGG), en kilomètres. */
const RAYON_TERRE_KM = 6371.0088;

/** Un degré de latitude, en kilomètres. Constant, contrairement à la longitude. */
const KM_PAR_DEGRE_LAT = 111.32;

const enRadians = (degres: number) => (degres * Math.PI) / 180;

/**
 * Distance orthodromique entre deux points, par la formule de haversine.
 *
 * La Terre n'est pas une sphère parfaite ; l'erreur est de l'ordre de 0,5 %,
 * sans commune mesure avec l'approximation déjà faite en réduisant une commune
 * à son centre.
 */
export function distanceKm(a: Position, b: Position): number {
  const dLat = enRadians(b.latitude - a.latitude);
  const dLng = enRadians(b.longitude - a.longitude);
  const lat1 = enRadians(a.latitude);
  const lat2 = enRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * RAYON_TERRE_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type Boite = { latMin: number; latMax: number; lngMin: number; lngMax: number };

/**
 * Rectangle contenant à coup sûr le disque de rayon `rayonKm`.
 *
 * Sert à préfiltrer en base, où l'index sait comparer des bornes mais pas
 * calculer une haversine. Le rectangle déborde du disque : les candidats
 * retenus sont ensuite passés à `distanceKm`, qui tranche. L'inverse — un
 * rectangle trop petit — écarterait des voisins réels, d'où les marges
 * prudentes ci-dessous.
 */
export function boiteEnglobante(centre: Position, rayonKm: number): Boite {
  const dLat = rayonKm / KM_PAR_DEGRE_LAT;

  // Un degré de longitude rétrécit vers les pôles. On prend le cosinus au bord
  // le plus proche du pôle, celui où un degré couvre le moins de terrain, pour
  // que le rectangle soit assez large des deux côtés.
  const latExtreme = Math.min(90, Math.abs(centre.latitude) + dLat);
  const cos = Math.cos(enRadians(latExtreme));
  const dLng = cos < 1e-6 ? 180 : rayonKm / (KM_PAR_DEGRE_LAT * cos);

  return {
    latMin: Math.max(-90, centre.latitude - dLat),
    latMax: Math.min(90, centre.latitude + dLat),
    lngMin: Math.max(-180, centre.longitude - dLng),
    lngMax: Math.min(180, centre.longitude + dLng),
  };
}

/**
 * Forme normalisée d'un nom de commune : sans accent, sans trait d'union, en
 * minuscules. C'est elle qui est stockée et comparée, pour que la casse et la
 * ponctuation ne fassent pas rater « Saint-Étienne ».
 */
export function normaliserNom(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[-'’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalise ce qu'une personne tape, en développant les abréviations d'usage.
 *
 * Personne n'écrit « Saint-Étienne » en entier dans un champ de recherche.
 */
export function normaliserRecherche(terme: string): string {
  return normaliserNom(terme)
    .replace(/\bst\b/g, "saint")
    .replace(/\bste\b/g, "sainte");
}

/**
 * Numéro de département déduit du code INSEE.
 *
 * L'outre-mer tient sur trois chiffres (971 à 976), la Corse sur 2A et 2B.
 */
export function departementDepuisInsee(code: string): string {
  return code.startsWith("97") || code.startsWith("98") ? code.slice(0, 3) : code.slice(0, 2);
}
