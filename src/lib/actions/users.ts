"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { profileSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/actions/auth";

export async function updateProfileAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    city: formData.get("city"),
    bio: formData.get("bio"),
    experienceLevel: formData.get("experienceLevel"),
    avatarUrl: formData.get("avatarUrl"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };

  const { name, city, bio, experienceLevel, avatarUrl } = parsed.data;

  await prisma.user.update({
    where: { id: user.id },
    data: { name, city, bio: bio || null, experienceLevel, avatarUrl: avatarUrl || null },
  });

  revalidatePath(`/profile/${user.id}`);
  revalidatePath("/");
  redirect(`/profile/${user.id}`);
}
