"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { reviewSchema } from "@/lib/validation";
import { notify } from "@/lib/notifications";
import type { ActionState } from "@/lib/actions/auth";

export async function createTradeReviewAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const tradeId = String(formData.get("tradeId") ?? "");
  const parsed = reviewSchema.safeParse({ rating: formData.get("rating"), comment: formData.get("comment") });
  if (!parsed.success) return { error: t(parsed.error.issues[0]?.message ?? "validation.form") };

  const trade = await prisma.tradeProposal.findUnique({
    where: { id: tradeId },
    include: { items: { include: { gameCopy: { include: { game: true } }, cardCopy: { include: { card: true } } } } },
  });
  if (!trade || (trade.fromUserId !== user.id && trade.toUserId !== user.id)) {
    return { error: t("action.tradeNotFound") };
  }
  if (trade.status !== "COMPLETED") return { error: t("action.tradeNotComplete") };

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
    return { error: t("action.reviewExists.trade") };
  }

  await notify({
    userId: toUserId,
    kind: "REVIEW_RECEIVED",
    title: "notify.review",
    params: { name: user.name, extrait: `${parsed.data.rating}/5 · ${parsed.data.comment.slice(0, 100)}` },
    body: "notify.excerpt",
    href: `/profile/${toUserId}`,
  });

  revalidatePath(`/trades/${tradeId}`);
  revalidatePath(`/profile/${toUserId}`);
}

export async function createEventReviewAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const eventId = String(formData.get("eventId") ?? "");
  const parsed = reviewSchema.safeParse({ rating: formData.get("rating"), comment: formData.get("comment") });
  if (!parsed.success) return { error: t(parsed.error.issues[0]?.message ?? "validation.form") };

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { participants: true },
  });
  if (!event) return { error: t("action.eventNotFound") };
  if (event.hostId === user.id) return { error: t("action.noSelfReview") };
  const isParticipant = event.participants.some((p) => p.userId === user.id);
  if (!isParticipant) return { error: t("action.mustAttend") };

  try {
    await prisma.review.create({
      data: {
        fromUserId: user.id,
        toUserId: event.hostId,
        eventId: event.id,
        // Le contexte est figé au moment de l'avis : il décrit un fait passé,
        // pas un libellé d'interface, et ne doit donc pas suivre la langue du lecteur.
        context: `${event.title} · ${event.level}`,
        rating: parsed.data.rating,
        comment: parsed.data.comment,
      },
    });
  } catch {
    return { error: t("action.reviewExists.event") };
  }

  await notify({
    userId: event.hostId,
    kind: "REVIEW_RECEIVED",
    title: "notify.reviewEvent",
    params: { name: user.name, extrait: `${parsed.data.rating}/5 · ${parsed.data.comment.slice(0, 100)}` },
    body: "notify.excerpt",
    href: `/profile/${event.hostId}`,
  });

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/profile/${event.hostId}`);
}
