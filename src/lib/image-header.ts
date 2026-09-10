/**
 * Lecture des en-têtes d'image, sans dépendance ni accès base.
 *
 * Isolé de `photos.ts` (qui, lui, touche à la base et est réservé au serveur)
 * pour rester directement exécutable par un test unitaire.
 */

/**
 * Formats acceptés. Le GIF est volontairement absent : une animation ne se
 * redimensionne pas dans un canvas sans perdre ses images.
 */
export const TYPES_ACCEPTES = ["image/jpeg", "image/png", "image/webp"] as const;
export type TypeImage = (typeof TYPES_ACCEPTES)[number];

export type Dimensions = { width: number; height: number };

/**
 * Reconnaît le format d'après les octets du fichier, jamais d'après le type
 * MIME annoncé : celui-ci vient du navigateur, donc de l'appelant, qui peut
 * mentir. Renvoie aussi les dimensions, lues dans l'en-tête.
 *
 * Lire l'en-tête soi-même évite une dépendance native (sharp) que Vercel et la
 * suite de tests devraient toutes deux embarquer pour une seule information.
 */
export function inspecterImage(octets: Uint8Array): { type: TypeImage } & Dimensions | null {
  const vue = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);

  // ---- PNG : signature de 8 octets, puis le bloc IHDR ----
  const SIGNATURE_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (octets.length >= 24 && SIGNATURE_PNG.every((o, i) => octets[i] === o)) {
    return { type: "image/png", width: vue.getUint32(16), height: vue.getUint32(20) };
  }

  // ---- JPEG : suite de segments, les dimensions sont dans le segment SOF ----
  if (octets.length >= 4 && octets[0] === 0xff && octets[1] === 0xd8 && octets[2] === 0xff) {
    const dims = dimensionsJpeg(octets, vue);
    if (dims) return { type: "image/jpeg", ...dims };
    return null;
  }

  // ---- WebP : conteneur RIFF, trois variantes de bloc ----
  if (octets.length >= 30 && lireAscii(octets, 0, 4) === "RIFF" && lireAscii(octets, 8, 4) === "WEBP") {
    const dims = dimensionsWebp(octets, vue);
    if (dims) return { type: "image/webp", ...dims };
    return null;
  }

  return null;
}

function lireAscii(octets: Uint8Array, debut: number, longueur: number) {
  let s = "";
  for (let i = debut; i < debut + longueur; i++) s += String.fromCharCode(octets[i]);
  return s;
}

function dimensionsJpeg(octets: Uint8Array, vue: DataView): Dimensions | null {
  let i = 2;
  while (i + 9 < octets.length) {
    if (octets[i] !== 0xff) {
      i++; // octet de bourrage entre deux segments
      continue;
    }
    const marqueur = octets[i + 1];

    // Marqueurs sans charge utile : on avance simplement.
    if (marqueur === 0xd8 || marqueur === 0x01 || (marqueur >= 0xd0 && marqueur <= 0xd7)) {
      i += 2;
      continue;
    }
    if (marqueur === 0xd9 || marqueur === 0xda) return null; // fin, ou début des données compressées

    const longueur = vue.getUint16(i + 2);
    if (longueur < 2) return null;

    // SOF0 à SOF15, en sautant DHT (C4), JPG (C8) et DAC (CC) qui partagent la plage.
    const estSof =
      marqueur >= 0xc0 && marqueur <= 0xcf && marqueur !== 0xc4 && marqueur !== 0xc8 && marqueur !== 0xcc;
    if (estSof) {
      return { height: vue.getUint16(i + 5), width: vue.getUint16(i + 7) };
    }

    i += 2 + longueur;
  }
  return null;
}

function dimensionsWebp(octets: Uint8Array, vue: DataView): Dimensions | null {
  const bloc = lireAscii(octets, 12, 4);

  if (bloc === "VP8 ") {
    // Trame « lossy » : 3 octets d'en-tête de trame, le code de départ 9D 01 2A,
    // puis deux entiers 14 bits en petit-boutiste.
    if (octets[23] !== 0x9d || octets[24] !== 0x01 || octets[25] !== 0x2a) return null;
    return { width: vue.getUint16(26, true) & 0x3fff, height: vue.getUint16(28, true) & 0x3fff };
  }

  if (bloc === "VP8L") {
    // « lossless » : après la signature 0x2F, 14 bits de largeur puis 14 de
    // hauteur, moins un, empaquetés sur quatre octets.
    if (octets[20] !== 0x2f) return null;
    const paquet = vue.getUint32(21, true);
    return { width: (paquet & 0x3fff) + 1, height: ((paquet >> 14) & 0x3fff) + 1 };
  }

  if (bloc === "VP8X") {
    // Forme étendue : la taille du canevas sur deux entiers 24 bits, moins un.
    const largeur = octets[24] | (octets[25] << 8) | (octets[26] << 16);
    const hauteur = octets[27] | (octets[28] << 8) | (octets[29] << 16);
    return { width: largeur + 1, height: hauteur + 1 };
  }

  return null;
}
