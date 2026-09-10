"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getOrCreateConversation } from "@/lib/actions/messages";
import { notify } from "@/lib/notifications";
import type { ActionState } from "@/lib/actions/auth";

export async function proposeGameTradeAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const targetCopyId = String(formData.get("targetCopyId") ?? "");
  const offeredCopyIds = formData.getAll("offeredCopyIds").map(String);
  const message = String(formData.get("message") ?? "").trim();

  if (!targetCopyId || offeredCopyIds.length === 0) {
    return { error: "Choisis au moins un de tes jeux à proposer en échange" };
  }

  const targetCopy = await prisma.gameCopy.findUnique({ where: { id: targetCopyId } });
  if (!targetCopy || targetCopy.status !== "ON_TABLE") return { error: "Cette copie n'est plus disponible" };
  if (targetCopy.ownerId === user.id) return { error: "Tu ne peux pas échanger avec toi-même" };

  const offered = await prisma.gameCopy.findMany({ where: { id: { in: offeredCopyIds }, ownerId: user.id, status: "ON_TABLE" } });
  if (offered.length !== offeredCopyIds.length) return { error: "Un des jeux sélectionnés n'est plus disponible" };

  const conversation = await getOrCreateConversation(user.id, targetCopy.ownerId);

  const trade = await prisma.tradeProposal.create({
    data: {
      kind: "GAME", fromUserId: user.id, toUserId: targetCopy.ownerId, conversationId: conversation.id,
      items: { create: [
        { gameCopyId: targetCopy.id, offeredBy: "TO" },
        ...offered.map((c) => ({ gameCopyId: c.id, offeredBy: "FROM" as const })),
      ]},
    },
  });

  if (message) {
    await prisma.message.create({ data: { conversationId: conversation.id, senderId: user.id, content: message } });
  }

  await notify({
    userId: targetCopy.ownerId,
    kind: "TRADE_PROPOSED",
    title: `${user.name} te propose un échange`,
    body: message || null,
    href: `/trades/${trade.id}`,
    subjectId: trade.id,
  });

  revalidatePath("/trades");
  redirect(`/trades/${trade.id}`);
}

export async function requestCardAction(cardCopyId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const cardCopy = await prisma.cardCopy.findUnique({ where: { id: cardCopyId } });
  if (!cardCopy || cardCopy.status !== "ON_TABLE") throw new Error("Carte indisponible");
  if (cardCopy.ownerId === user.id) throw new Error("Action non autorisée");

  const conversation = await getOrCreateConversation(user.id, cardCopy.ownerId);

  const trade = await prisma.tradeProposal.create({
    data: {
      kind: "CARD", fromUserId: user.id, toUserId: cardCopy.ownerId, conversationId: conversation.id,
      items: { create: [{ cardCopyId: cardCopy.id, offeredBy: "TO" }] },
    },
  });

  await notify({
    userId: cardCopy.ownerId,
    kind: "TRADE_PROPOSED",
    title: `${user.name} demande une de tes cartes`,
    href: `/trades/${trade.id}`,
    subjectId: trade.id,
  });

  revalidatePath("/cards");
  redirect(`/trades/${trade.id}`);
}

async function itemsOf(tradeId: string) {
  return prisma.tradeItem.findMany({ where: { tradeProposalId: tradeId } });
}

async function setCopiesStatus(items: Awaited<ReturnType<typeof itemsOf>>, status: "AVAILABLE_ON_TABLE" | "IN_TRADE" | "TRADED") {
  const gameCopyIds = items.map((i) => i.gameCopyId).filter((v): v is string => !!v);
  const cardCopyIds = items.map((i) => i.cardCopyId).filter((v): v is string => !!v);
  const value = status === "AVAILABLE_ON_TABLE" ? "ON_TABLE" : status;
  if (gameCopyIds.length) await prisma.gameCopy.updateMany({ where: { id: { in: gameCopyIds } }, data: { status: value } });
  if (cardCopyIds.length) await prisma.cardCopy.updateMany({ where: { id: { in: cardCopyIds } }, data: { status: value } });
}

async function assertParticipant(tradeId: string, userId: string) {
  const trade = await prisma.tradeProposal.findUnique({ where: { id: tradeId } });
  if (!trade || (trade.fromUserId !== userId && trade.toUserId !== userId)) throw new Error("Échange introuvable");
  return trade;
}

export async function respondToTradeAction(tradeId: string, accept: boolean) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const trade = await assertParticipant(tradeId, user.id);
  if (trade.toUserId !== user.id || trade.status !== "PENDING") throw new Error("Action non autorisée");

  await prisma.tradeProposal.update({ where: { id: tradeId }, data: { status: accept ? "ACCEPTED" : "REJECTED" } });
  if (accept) await setCopiesStatus(await itemsOf(tradeId), "IN_TRADE");

  await notify({
    userId: trade.fromUserId,
    kind: accept ? "TRADE_ACCEPTED" : "TRADE_REJECTED",
    title: accept
      ? `${user.name} accepte ton échange`
      : `${user.name} décline ton échange`,
    body: accept ? "Convenez d'un lieu et d'une heure par message." : null,
    href: `/trades/${tradeId}`,
    subjectId: tradeId,
  });

  revalidatePath(`/trades/${tradeId}`);
  revalidatePath("/trades");
}

export async function cancelTradeAction(tradeId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const trade = await assertParticipant(tradeId, user.id);
  if (!["PENDING", "ACCEPTED"].includes(trade.status)) throw new Error("Action non autorisée");

  await prisma.tradeProposal.update({ where: { id: tradeId }, data: { status: "CANCELLED" } });
  if (trade.status === "ACCEPTED") await setCopiesStatus(await itemsOf(tradeId), "AVAILABLE_ON_TABLE");

  revalidatePath(`/trades/${tradeId}`);
  revalidatePath("/trades");
}

export async function completeTradeAction(tradeId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const trade = await assertParticipant(tradeId, user.id);
  if (trade.status !== "ACCEPTED") throw new Error("Action non autorisée");

  await prisma.tradeProposal.update({ where: { id: tradeId }, data: { status: "COMPLETED" } });
  await setCopiesStatus(await itemsOf(tradeId), "TRADED");

  const autre = trade.fromUserId === user.id ? trade.toUserId : trade.fromUserId;
  await notify({
    userId: autre,
    kind: "TRADE_COMPLETED",
    title: `Échange terminé avec ${user.name}`,
    body: "Tu peux maintenant laisser un avis.",
    href: `/trades/${tradeId}`,
    subjectId: tradeId,
  });

  revalidatePath(`/trades/${tradeId}`);
  revalidatePath("/trades");
  revalidatePath("/");
}
