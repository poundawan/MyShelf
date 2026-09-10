"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { notify } from "@/lib/notifications";

export async function getOrCreateConversation(userId1: string, userId2: string) {
  const [userAId, userBId] = [userId1, userId2].sort();
  const existing = await prisma.conversation.findUnique({ where: { userAId_userBId: { userAId, userBId } } });
  if (existing) return existing;
  return prisma.conversation.create({ data: { userAId, userBId } });
}

async function assertParticipant(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation || (conversation.userAId !== userId && conversation.userBId !== userId)) {
    throw new Error("Conversation introuvable");
  }
  return conversation;
}

export async function sendMessagePlainAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const conversationId = String(formData.get("conversationId") ?? "");
  const content = String(formData.get("content") ?? "").trim();
  if (!content) return;

  const conversation = await assertParticipant(conversationId, user.id);

  const texte = content.slice(0, 2000);
  await prisma.message.create({ data: { conversationId, senderId: user.id, content: texte } });
  await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });

  const destinataire = conversation.userAId === user.id ? conversation.userBId : conversation.userAId;
  await notify({
    userId: destinataire,
    kind: "MESSAGE_RECEIVED",
    title: "notify.message",
    // L'extrait du message n'est pas traduisible : c'est le texte de la personne.
    params: { name: user.name, extrait: texte.length > 120 ? `${texte.slice(0, 120)}…` : texte },
    body: "notify.excerpt",
    href: `/messages/${conversationId}`,
    subjectId: conversationId,
  });

  revalidatePath(`/messages/${conversationId}`);
  revalidatePath(`/trades`);
  revalidatePath("/messages");
}

export async function startConversationAction(otherUserId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (otherUserId === user.id) throw new Error("Action non autorisée");

  const conversation = await getOrCreateConversation(user.id, otherUserId);
  redirect(`/messages/${conversation.id}`);
}
