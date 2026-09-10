"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { eventSchema, eventUpdateSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/actions/auth";

export async function createEventAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = eventSchema.safeParse({
    title: formData.get("title"),
    type: formData.get("type"),
    level: formData.get("level"),
    description: formData.get("description"),
    bringList: formData.get("bringList"),
    city: formData.get("city"),
    location: formData.get("location"),
    startAt: formData.get("startAt"),
    endAt: formData.get("endAt"),
    maxParticipants: formData.get("maxParticipants"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };

  const { title, type, level, description, bringList, city, location, startAt, endAt, maxParticipants } = parsed.data;

  const event = await prisma.event.create({
    data: {
      hostId: user.id, title, type, level,
      description: description || null, bringList: bringList || null,
      city, location: location || null, startAt, endAt: endAt ?? null,
      maxParticipants: maxParticipants ?? null,
      participants: { create: [{ userId: user.id }] },
    },
  });

  revalidatePath("/events");
  revalidatePath("/");
  redirect(`/events/${event.id}`);
}

export async function updateEventAction(eventId: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const existing = await prisma.event.findUnique({ where: { id: eventId } });
  if (!existing) return { error: "Table introuvable" };
  if (existing.hostId !== user.id) return { error: "Seul l'organisateur peut modifier cette table" };

  const parsed = eventUpdateSchema.safeParse({
    title: formData.get("title"),
    type: formData.get("type"),
    level: formData.get("level"),
    description: formData.get("description"),
    bringList: formData.get("bringList"),
    city: formData.get("city"),
    location: formData.get("location"),
    startAt: formData.get("startAt"),
    endAt: formData.get("endAt"),
    maxParticipants: formData.get("maxParticipants"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };

  const { title, type, level, description, bringList, city, location, startAt, endAt, maxParticipants } = parsed.data;

  // On ne peut pas réduire le nombre de places en dessous du nombre d'inscrits :
  // il faudrait désinscrire quelqu'un sans le lui dire.
  if (maxParticipants) {
    const inscrits = await prisma.eventParticipant.count({ where: { eventId } });
    if (maxParticipants < inscrits) {
      return { error: `${inscrits} personnes sont déjà inscrites : impossible de descendre en dessous.` };
    }
  }

  await prisma.event.update({
    where: { id: eventId },
    data: {
      title, type, level,
      description: description || null, bringList: bringList || null,
      city, location: location || null, startAt, endAt: endAt ?? null,
      maxParticipants: maxParticipants ?? null,
    },
  });

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/events");
  revalidatePath("/");
  redirect(`/events/${eventId}`);
}

async function assertEvent(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId }, include: { participants: true } });
  if (!event) throw new Error("Événement introuvable");
  return event;
}

export async function joinEventAction(eventId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const event = await assertEvent(eventId);
  if (event.status !== "ACTIVE") throw new Error("Cet événement n'est plus ouvert");
  if (event.maxParticipants && event.participants.length >= event.maxParticipants) throw new Error("Complet");

  await prisma.eventParticipant.upsert({
    where: { eventId_userId: { eventId, userId: user.id } },
    update: {}, create: { eventId, userId: user.id },
  });

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/events");
  revalidatePath("/");
}

export async function leaveEventAction(eventId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const event = await assertEvent(eventId);
  if (event.hostId === user.id) throw new Error("L'organisateur ne peut pas se désinscrire");

  await prisma.eventParticipant.deleteMany({ where: { eventId, userId: user.id } });

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/events");
  revalidatePath("/");
}

export async function cancelEventAction(eventId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const event = await assertEvent(eventId);
  if (event.hostId !== user.id) throw new Error("Action non autorisée");

  await prisma.event.update({ where: { id: eventId }, data: { status: "CANCELLED" } });

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/events");
  revalidatePath("/");
}
