"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { itemSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/actions/auth";

export async function createItemAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = itemSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    category: formData.get("category"),
    condition: formData.get("condition"),
    photoUrl: formData.get("photoUrl"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }

  const { title, description, category, condition, photoUrl } = parsed.data;

  const item = await prisma.item.create({
    data: {
      ownerId: user.id,
      title,
      description: description || null,
      category,
      condition,
      photoUrl: photoUrl || null,
    },
  });

  revalidatePath("/");
  redirect(`/items/${item.id}`);
}

export async function deleteItemAction(itemId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item || item.ownerId !== user.id) {
    throw new Error("Objet introuvable");
  }

  await prisma.item.delete({ where: { id: itemId } });
  revalidatePath("/");
  revalidatePath("/profile");
  redirect("/profile");
}
