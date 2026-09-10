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

export async function deleteCardCopyAction(cardCopyId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const copy = await prisma.cardCopy.findUnique({ where: { id: cardCopyId } });
  if (!copy || copy.ownerId !== user.id) throw new Error("Carte introuvable");

  // Même règle que pour les jeux : on ne retire pas une carte déjà promise.
  const engagee = await prisma.tradeItem.findFirst({
    where: { cardCopyId, tradeProposal: { status: { in: ["PENDING", "ACCEPTED"] } } },
  });
  if (engagee) throw new Error("Cette carte est engagée dans un échange en cours");

  await prisma.cardCopy.delete({ where: { id: cardCopyId } });
  revalidatePath("/cards");
}

export async function deleteCardWantAction(cardWantId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const want = await prisma.cardWant.findUnique({ where: { id: cardWantId } });
  if (!want || want.userId !== user.id) throw new Error("Introuvable");

  await prisma.cardWant.delete({ where: { id: cardWantId } });
  revalidatePath("/cards");
}
