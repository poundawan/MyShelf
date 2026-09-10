"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function markNotificationReadAction(notificationId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // `updateMany` avec le propriétaire dans le filtre : marquer la notification
  // de quelqu'un d'autre ne renvoie simplement aucune ligne.
  await prisma.notification.updateMany({
    where: { id: notificationId, userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });

  revalidatePath("/notifications");
}

export async function markAllNotificationsReadAction() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });

  revalidatePath("/notifications");
  revalidatePath("/");
}

/** Ouvre la cible d'une notification en la marquant lue au passage. */
export async function openNotificationAction(notificationId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId: user.id },
  });
  if (!notification) redirect("/notifications");

  await prisma.notification.updateMany({
    where: { id: notificationId, userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });

  revalidatePath("/notifications");
  redirect(notification.href);
}
