"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { cookies } from "next/headers";
import { getT, LOCALE_COOKIE } from "@/lib/i18n/server";
import { profileSchema } from "@/lib/validation";
import { appliquerPhoto } from "@/lib/photos";
import { resoudreCommune } from "@/lib/communes";
import type { ActionState } from "@/lib/actions/auth";

export async function updateProfileAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    city: formData.get("city"),
    bio: formData.get("bio"),
    experienceLevel: formData.get("experienceLevel"),
    locale: formData.get("locale"),
  });
  if (!parsed.success) return { error: t(parsed.error.issues[0]?.message ?? "validation.form") };

  const { name, bio, experienceLevel, locale } = parsed.data;
  const { communeCode, city } = await resoudreCommune(formData);

  // L'avatar se règle avant l'écriture : une photo refusée doit renvoyer le
  // formulaire intact, sans avoir enregistré la moitié des champs au passage.
  const avatar = await appliquerPhoto(formData, "avatar", user.id, user.avatarUrl);
  if (!avatar.ok) return { error: t(avatar.erreur, avatar.params) };

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name,
      city,
      communeCode,
      bio: bio || null,
      experienceLevel,
      locale,
      // `undefined` laisse la colonne tranquille : personne n'a touché à la photo.
      ...(avatar.url === undefined ? {} : { avatarUrl: avatar.url }),
    },
  });

  // Le cookie double le choix enregistré en base : il fait suivre la langue
  // sur les pages publiques, avant même qu'on soit reconnu.
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });

  revalidatePath("/", "layout");
  revalidatePath(`/profile/${user.id}`);
  redirect(`/profile/${user.id}`);
}
