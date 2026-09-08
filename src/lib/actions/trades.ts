"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import type { ActionState } from "@/lib/actions/auth";

export async function proposeTradeAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const targetItemId = String(formData.get("targetItemId") ?? "");
  const offeredItemIds = formData.getAll("offeredItemIds").map(String);

  if (!targetItemId || offeredItemIds.length === 0) {
    return { error: "Choisis au moins un de tes objets à proposer en échange" };
  }

  const targetItem = await prisma.item.findUnique({ where: { id: targetItemId } });
  if (!targetItem || targetItem.status !== "AVAILABLE") {
    return { error: "Cet objet n'est plus disponible" };
  }
  if (targetItem.ownerId === user.id) {
    return { error: "Tu ne peux pas échanger avec toi-même" };
  }

  const offeredItems = await prisma.item.findMany({
    where: { id: { in: offeredItemIds }, ownerId: user.id, status: "AVAILABLE" },
  });
  if (offeredItems.length !== offeredItemIds.length) {
    return { error: "Un des objets sélectionnés n'est plus disponible" };
  }

  const proposal = await prisma.tradeProposal.create({
    data: {
      fromUserId: user.id,
      toUserId: targetItem.ownerId,
      items: {
        create: [
          { itemId: targetItem.id, offeredBy: "TO" },
          ...offeredItems.map((item) => ({ itemId: item.id, offeredBy: "FROM" as const })),
        ],
      },
    },
  });

  revalidatePath("/trades");
  redirect(`/trades/${proposal.id}`);
}

async function assertParticipant(tradeId: string, userId: string) {
  const trade = await prisma.tradeProposal.findUnique({ where: { id: tradeId } });
  if (!trade || (trade.fromUserId !== userId && trade.toUserId !== userId)) {
    throw new Error("Échange introuvable");
  }
  return trade;
}

export async function respondToTradeAction(tradeId: string, accept: boolean) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const trade = await assertParticipant(tradeId, user.id);
  if (trade.toUserId !== user.id || trade.status !== "PENDING") {
    throw new Error("Action non autorisée");
  }

  await prisma.$transaction(async (tx) => {
    await tx.tradeProposal.update({
      where: { id: tradeId },
      data: { status: accept ? "ACCEPTED" : "REJECTED" },
    });

    if (accept) {
      const tradeItems = await tx.tradeItem.findMany({ where: { tradeProposalId: tradeId } });
      await tx.item.updateMany({
        where: { id: { in: tradeItems.map((ti) => ti.itemId) } },
        data: { status: "IN_TRADE" },
      });
    }
  });

  revalidatePath(`/trades/${tradeId}`);
  revalidatePath("/trades");
}

export async function cancelTradeAction(tradeId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const trade = await assertParticipant(tradeId, user.id);
  if (!["PENDING", "ACCEPTED"].includes(trade.status)) {
    throw new Error("Action non autorisée");
  }

  await prisma.$transaction(async (tx) => {
    await tx.tradeProposal.update({ where: { id: tradeId }, data: { status: "CANCELLED" } });

    if (trade.status === "ACCEPTED") {
      const tradeItems = await tx.tradeItem.findMany({ where: { tradeProposalId: tradeId } });
      await tx.item.updateMany({
        where: { id: { in: tradeItems.map((ti) => ti.itemId) } },
        data: { status: "AVAILABLE" },
      });
    }
  });

  revalidatePath(`/trades/${tradeId}`);
  revalidatePath("/trades");
}

export async function completeTradeAction(tradeId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const trade = await assertParticipant(tradeId, user.id);
  if (trade.status !== "ACCEPTED") {
    throw new Error("Action non autorisée");
  }

  await prisma.$transaction(async (tx) => {
    await tx.tradeProposal.update({ where: { id: tradeId }, data: { status: "COMPLETED" } });
    const tradeItems = await tx.tradeItem.findMany({ where: { tradeProposalId: tradeId } });
    await tx.item.updateMany({
      where: { id: { in: tradeItems.map((ti) => ti.itemId) } },
      data: { status: "TRADED" },
    });
  });

  revalidatePath(`/trades/${tradeId}`);
  revalidatePath("/trades");
  revalidatePath("/");
}

export async function sendMessageAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const tradeId = String(formData.get("tradeId") ?? "");
  const content = String(formData.get("content") ?? "").trim();
  if (!content) return { error: "Message vide" };

  await assertParticipant(tradeId, user.id);

  await prisma.message.create({
    data: { tradeProposalId: tradeId, senderId: user.id, content: content.slice(0, 2000) },
  });

  revalidatePath(`/trades/${tradeId}`);
}
