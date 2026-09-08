"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { eventSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/actions/auth";

export async function createEventAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = eventSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    gameType: formData.get("gameType"),
    gameName: formData.get("gameName"),
    level: formData.get("level"),
    recurrence: formData.get("recurrence"),
    city: formData.get("city"),
    location: formData.get("location"),
    startAt: formData.get("startAt"),
    maxParticipants: formData.get("maxParticipants"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }

  const { title, description, gameType, gameName, level, recurrence, city, location, startAt, maxParticipants } =
    parsed.data;

  const event = await prisma.event.create({
    data: {
      hostId: user.id,
      title,
      description: description || null,
      gameType,
      gameName: gameName || null,
      level,
      recurrence,
      city,
      location: location || null,
      startAt,
      maxParticipants: maxParticipants ?? null,
      participants: { create: [{ userId: user.id }] },
    },
  });

  revalidatePath("/events");
  revalidatePath("/");
  redirect(`/events/${event.id}`);
}

async function assertActiveEvent(eventId: string) {
  const event = await prisma.event.findUnique({
    include: { participants: true },
    where: { id: eventId },
  });
  if (!event) throw new Error("Événement introuvable");
  return event;
}

export async function joinEventAction(eventId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const event = await assertActiveEvent(eventId);
  if (event.status !== "ACTIVE") throw new Error("Cet événement n'est plus ouvert aux inscriptions");
  if (event.maxParticipants && event.participants.length >= event.maxParticipants) {
    throw new Error("Cet événement est complet");
  }

  await prisma.eventParticipant.upsert({
    where: { eventId_userId: { eventId, userId: user.id } },
    update: {},
    create: { eventId, userId: user.id },
  });

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/events");
  revalidatePath("/");
}

export async function leaveEventAction(eventId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const event = await assertActiveEvent(eventId);
  if (event.hostId === user.id) {
    throw new Error("L'organisateur ne peut pas se désinscrire — annule l'événement si besoin");
  }

  await prisma.eventParticipant.deleteMany({ where: { eventId, userId: user.id } });

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/events");
  revalidatePath("/");
}

export async function cancelEventAction(eventId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const event = await assertActiveEvent(eventId);
  if (event.hostId !== user.id) throw new Error("Action non autorisée");

  await prisma.event.update({ where: { id: eventId }, data: { status: "CANCELLED" } });

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/events");
  revalidatePath("/");
}
