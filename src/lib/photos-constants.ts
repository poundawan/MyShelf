import { TYPES_ACCEPTES } from "@/lib/image-header";

/**
 * Constantes partagées entre le serveur et le navigateur.
 *
 * `photos.ts` touche à la base et porte `server-only` : le composant d'envoi,
 * lui, tourne côté client et a besoin des mêmes plafonds. Les isoler ici évite
 * de les recopier — et donc de les voir diverger.
 */

/**
 * Taille maximale acceptée, une fois le fichier arrivé sur le serveur.
 *
 * Le composant d'envoi réduit déjà l'image dans le navigateur ; ce plafond est
 * là pour la personne qui contourne le composant et poste directement sur
 * l'action serveur. `next.config.ts` autorise un corps de requête un peu plus
 * grand, pour laisser la place à l'habillage multipart.
 */
export const TAILLE_MAX_OCTETS = 2 * 1024 * 1024;

/** Côté le plus long après réduction dans le navigateur, en pixels. */
export const COTE_MAX_PX = 1200;

/** Attribut `accept` de l'input fichier, dérivé de la liste des formats admis. */
export const ACCEPT_ATTR = TYPES_ACCEPTES.join(",");

/** Préfixe des URL servies par `/api/photos/[id]`. */
export const PREFIXE_URL = "/api/photos/";
