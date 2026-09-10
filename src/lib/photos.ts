import "server-only";

import { prisma } from "@/lib/prisma";
import { inspecterImage } from "@/lib/image-header";
import { PREFIXE_URL, TAILLE_MAX_OCTETS } from "@/lib/photos-constants";

export { inspecterImage, TYPES_ACCEPTES } from "@/lib/image-header";
export type { TypeImage, Dimensions } from "@/lib/image-header";
export { ACCEPT_ATTR, COTE_MAX_PX, PREFIXE_URL, TAILLE_MAX_OCTETS } from "@/lib/photos-constants";

/**
 * Un refus porte la clé de traduction ET ses variables : le plafond affiché
 * doit venir de la constante, pas être recopié dans chaque dictionnaire.
 */
export type Refus = { ok: false; erreur: string; params?: Record<string, string | number> };

export type ResultatEnvoi = { ok: true; url: string } | Refus;

/** Le plafond exprimé en mégaoctets, pour les messages destinés à être lus. */
const PLAFOND_MO = { taille: Math.round(TAILLE_MAX_OCTETS / (1024 * 1024)) };

/**
 * Enregistre une image envoyée par un formulaire et renvoie l'URL à stocker
 * dans `photoUrl` / `avatarUrl`.
 *
 * Les messages d'erreur sont des CLÉS de traduction : c'est l'appelant qui les
 * affiche, dans la langue de la personne connectée.
 */
export async function enregistrerPhoto(fichier: File, uploadedById: string): Promise<ResultatEnvoi> {
  if (fichier.size === 0) return { ok: false, erreur: "photo.error.empty" };
  if (fichier.size > TAILLE_MAX_OCTETS) return { ok: false, erreur: "photo.error.tooLarge", params: PLAFOND_MO };

  const octets = new Uint8Array(await fichier.arrayBuffer());

  // Une seconde vérification après lecture : `File.size` est déclaratif.
  if (octets.byteLength > TAILLE_MAX_OCTETS) return { ok: false, erreur: "photo.error.tooLarge", params: PLAFOND_MO };

  const image = inspecterImage(octets);
  if (!image) return { ok: false, erreur: "photo.error.type" };
  if (image.width < 1 || image.height < 1) return { ok: false, erreur: "photo.error.type" };

  const photo = await prisma.photo.create({
    data: {
      mimeType: image.type,
      bytes: Buffer.from(octets),
      byteSize: octets.byteLength,
      width: image.width,
      height: image.height,
      uploadedById,
    },
    select: { id: true },
  });

  return { ok: true, url: PREFIXE_URL + photo.id };
}

/** Identifiant de photo contenu dans une URL locale, ou `null` si elle est distante. */
export function idDepuisUrl(url: string | null | undefined): string | null {
  if (!url || !url.startsWith(PREFIXE_URL)) return null;
  const id = url.slice(PREFIXE_URL.length);
  return /^[a-z0-9]+$/i.test(id) ? id : null;
}

/**
 * Supprime la photo désignée par une URL locale, si c'en est une.
 *
 * Appelé lors d'un remplacement : sans cela, chaque changement d'avatar
 * laisserait une image orpheline en base. Une URL distante (BoardGameGeek) ou
 * inconnue ne fait rien.
 */
export async function supprimerPhotoParUrl(url: string | null | undefined) {
  const id = idDepuisUrl(url);
  if (!id) return;
  // La photo peut déjà avoir disparu : l'échec ne doit pas faire capoter
  // l'enregistrement du formulaire.
  await prisma.photo.deleteMany({ where: { id } });
}

/**
 * Ce qu'un formulaire veut faire de sa photo :
 * une nouvelle URL, `null` pour l'enlever, `undefined` pour ne rien changer.
 */
export type ChangementPhoto = { ok: true; url: string | null | undefined } | Refus;

/**
 * Traduit les deux champs déposés par `<PhotoInput>` en une décision.
 *
 * Trois cas se distinguent, et les confondre coûterait cher : renvoyer `null`
 * quand aucun fichier n'a été choisi effacerait la photo à chaque
 * enregistrement du formulaire.
 */
export async function appliquerPhoto(
  formData: FormData,
  champ: string,
  uploadedById: string,
  urlActuelle: string | null,
): Promise<ChangementPhoto> {
  const fichier = formData.get(champ);
  const retirer = formData.get(`${champ}Remove`) === "1";

  if (fichier instanceof File && fichier.size > 0) {
    const resultat = await enregistrerPhoto(fichier, uploadedById);
    if (!resultat.ok) return resultat;
    await supprimerPhotoParUrl(urlActuelle);
    return { ok: true, url: resultat.url };
  }

  if (retirer) {
    await supprimerPhotoParUrl(urlActuelle);
    return { ok: true, url: null };
  }

  return { ok: true, url: undefined };
}
