"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { cardCopySchema } from "@/lib/validation";
import type { ActionState } from "@/lib/actions/auth";

export async function addCardAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = cardCopySchema.safeParse({
    name: formData.get("name"),
    setName: formData.get("setName"),
    rarity: formData.get("rarity"),
    mode: formData.get("mode"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };

  const { name, setName, rarity, mode } = parsed.data;

  let card = await prisma.card.findFirst({ where: { name: { equals: name.trim(), mode: "insensitive" } } });
  if (!card) {
    card = await prisma.card.create({ data: { name: name.trim(), setName: setName || null, rarity } });
  }

  if (mode === "DOUBLE") {
    await prisma.cardCopy.create({ data: { cardId: card.id, ownerId: user.id, status: "ON_TABLE" } });
  } else {
    await prisma.cardWant.upsert({
      where: { cardId_userId: { cardId: card.id, userId: user.id } },
      update: {}, create: { cardId: card.id, userId: user.id },
    });
  }

  revalidatePath("/cards");
  redirect("/cards");
}
