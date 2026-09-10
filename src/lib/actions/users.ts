"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { cookies } from "next/headers";
import { getT, LOCALE_COOKIE } from "@/lib/i18n/server";
import { profileSchema } from "@/lib/validation";
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
    avatarUrl: formData.get("avatarUrl"),
  });
  if (!parsed.success) return { error: t(parsed.error.issues[0]?.message ?? "validation.form") };

  const { name, city, bio, experienceLevel, locale, avatarUrl } = parsed.data;

  await prisma.user.update({
    where: { id: user.id },
    data: { name, city, bio: bio || null, experienceLevel, locale, avatarUrl: avatarUrl || null },
  });

  // Le cookie double le choix enregistré en base : il fait suivre la langue
  // sur les pages publiques, avant même qu'on soit reconnu.
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });

  revalidatePath("/", "layout");
  revalidatePath(`/profile/${user.id}`);
  redirect(`/profile/${user.id}`);
}
