"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { reviewSchema } from "@/lib/validation";
import { playerLevelLabels } from "@/lib/labels";
import type { ActionState } from "@/lib/actions/auth";

export async function createTradeReviewAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const tradeId = String(formData.get("tradeId") ?? "");
  const parsed = reviewSchema.safeParse({ rating: formData.get("rating"), comment: formData.get("comment") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };

  const trade = await prisma.tradeProposal.findUnique({
    where: { id: tradeId },
    include: { items: { include: { gameCopy: { include: { game: true } }, cardCopy: { include: { card: true } } } } },
  });
  if (!trade || (trade.fromUserId !== user.id && trade.toUserId !== user.id)) {
    return { error: "Échange introuvable" };
  }
  if (trade.status !== "COMPLETED") return { error: "Cet échange n'est pas encore terminé" };

  const toUserId = trade.fromUserId === user.id ? trade.toUserId : trade.fromUserId;
  const gameItem = trade.items.find((i) => i.gameCopy)?.gameCopy;
  const cardItem = trade.items.find((i) => i.cardCopy)?.cardCopy;
  const title = gameItem?.game.title ?? cardItem?.card.name ?? "objet";

  try {
    await prisma.review.create({
      data: {
        fromUserId: user.id,
        toUserId,
        tradeId: trade.id,
        gameId: gameItem?.gameId ?? null,
        context: `Échange · ${title}`,
        rating: parsed.data.rating,
        comment: parsed.data.comment,
      },
    });
  } catch {
    return { error: "Tu as déjà laissé un avis pour cet échange" };
  }

  revalidatePath(`/trades/${tradeId}`);
  revalidatePath(`/profile/${toUserId}`);
}

export async function createEventReviewAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const eventId = String(formData.get("eventId") ?? "");
  const parsed = reviewSchema.safeParse({ rating: formData.get("rating"), comment: formData.get("comment") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { participants: true },
  });
  if (!event) return { error: "Table introuvable" };
  if (event.hostId === user.id) return { error: "Tu ne peux pas t'auto-évaluer" };
  const isParticipant = event.participants.some((p) => p.userId === user.id);
  if (!isParticipant) return { error: "Tu dois avoir participé à cette table" };

  try {
    await prisma.review.create({
      data: {
        fromUserId: user.id,
        toUserId: event.hostId,
        eventId: event.id,
        context: `${event.title} · ${playerLevelLabels[event.level].toLowerCase()}`,
        rating: parsed.data.rating,
        comment: parsed.data.comment,
      },
    });
  } catch {
    return { error: "Tu as déjà laissé un avis pour cette table" };
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/profile/${event.hostId}`);
}
