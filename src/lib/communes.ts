import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Traduit les deux champs déposés par `<CommuneInput>` — le texte saisi et le
 * code INSEE choisi — en ce qu'il faut écrire en base.
 *
 * Le code vient d'un champ caché : il est donc falsifiable, et on vérifie
 * toujours qu'il désigne une commune réelle avant de s'y fier. Le libellé
 * `city` est ensuite recopié du référentiel, pour qu'il ne puisse pas raconter
 * autre chose que la position.
 *
 * Sans commune reconnue, on garde le texte tel quel et `communeCode` reste
 * vide : l'application n'affichera aucune distance, plutôt qu'une distance
 * inventée.
 */
export async function resoudreCommune(
  formData: FormData,
  champ = "city",
): Promise<{ communeCode: string | null; city: string }> {
  const texte = String(formData.get(champ) ?? "").trim();
  const code = String(formData.get(`${champ}Code`) ?? "").trim();

  if (!code) return { communeCode: null, city: texte };

  const commune = await prisma.commune.findUnique({ where: { code }, select: { code: true, nom: true } });
  if (!commune) return { communeCode: null, city: texte };

  return { communeCode: commune.code, city: commune.nom };
}
