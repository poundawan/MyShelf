/**
 * Fournisseur de fonds de carte.
 *
 * C'est le premier tiers dont dépend un écran de l'application. Jusqu'ici tout
 * était soit calculé sur place (les distances), soit embarqué dans le dépôt
 * (les 37 283 communes) : l'application ne montrait rien qu'elle ne sût
 * produire elle-même. Une carte, non — il faut des tuiles, et elles viennent
 * de quelqu'un.
 *
 * Deux conséquences assumées.
 *
 * Le navigateur de chaque visiteur demande ses tuiles directement au
 * fournisseur, qui voit donc son adresse IP et la zone qu'il regarde. Il ne
 * voit ni qui il est, ni ce qu'il cherche : les marqueurs, eux, sont placés
 * par nous, à partir de positions que nous seuls connaissons. Et ces positions
 * restent des CENTRES DE COMMUNES, jamais des adresses.
 *
 * L'adresse est configurable pour que le choix reste réversible : un
 * fournisseur qui ferme, durcit ses conditions ou devient payant se remplace
 * par une variable d'environnement, sans toucher au code.
 *
 * L'attribution n'est pas décorative : elle est exigée par la plupart des
 * fournisseurs, OpenStreetMap compris. Elle s'affiche dans le coin de la
 * carte, posée par Leaflet.
 */

/** Gabarit d'URL des tuiles, au format `{z}/{x}/{y}`. */
export const TUILES_URL =
  process.env.NEXT_PUBLIC_TUILES_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

/** Mention obligatoire, affichée dans le coin de la carte. */
export const TUILES_ATTRIBUTION =
  process.env.NEXT_PUBLIC_TUILES_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
