"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { eventSchema, eventUpdateSchema, recurrenceSchema } from "@/lib/validation";
import { seancesSuivantes } from "@/lib/recurrence";
import { notify } from "@/lib/notifications";
import { appliquerPhoto } from "@/lib/photos";
import { resoudreCommune } from "@/lib/communes";
import type { ActionState } from "@/lib/actions/auth";

export async function createEventAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = eventSchema.safeParse({
    title: formData.get("title"),
    type: formData.get("type"),
    level: formData.get("level"),
    languages: formData.getAll("languages"),
    description: formData.get("description"),
    bringList: formData.get("bringList"),
    city: formData.get("city"),
    location: formData.get("location"),
    startAt: formData.get("startAt"),
    endAt: formData.get("endAt"),
    maxParticipants: formData.get("maxParticipants"),
  });
  if (!parsed.success) return { error: t(parsed.error.issues[0]?.message ?? "validation.form") };

  const { title, type, level, languages, description, bringList, location, startAt, endAt, maxParticipants } = parsed.data;

  // La cadence se valide à part, et seulement ici : une série se décide à
  // l'ouverture de la table, jamais au détour d'une modification.
  const recurrence = recurrenceSchema.safeParse({
    frequency: formData.get("frequency") ?? "",
    untilAt: formData.get("untilAt") ?? "",
    startAt,
  });
  if (!recurrence.success) return { error: t(recurrence.error.issues[0]?.message ?? "validation.form") };

  const { communeCode, city } = await resoudreCommune(formData);

  const photo = await appliquerPhoto(formData, "photo", user.id, null);
  if (!photo.ok) return { error: t(photo.erreur, photo.params) };

  // Tout ce que les séances d'une même série partagent. Seules la date et
  // l'heure de fin changent d'une séance à l'autre.
  const commun = {
    hostId: user.id, title, type, level, languages,
    description: description || null, bringList: bringList || null,
    city, communeCode, location: location || null,
    maxParticipants: maxParticipants ?? null,
    photoUrl: photo.url ?? null,
  };

  const serie = recurrence.data ? await prisma.eventSeries.create({ data: recurrence.data }) : null;

  const event = await prisma.event.create({
    data: {
      ...commun, startAt, endAt: endAt ?? null, seriesId: serie?.id ?? null,
      participants: { create: [{ userId: user.id }] },
    },
  });

  if (serie) {
    // Chaque séance dure aussi longtemps que la première : on reporte l'écart,
    // pas l'heure de fin, sans quoi une table de 20h à 23h finirait toujours
    // le soir de la première séance.
    const duree = endAt ? endAt.getTime() - startAt.getTime() : null;
    const suivantes = seancesSuivantes(startAt, serie.frequency, serie.untilAt);

    if (suivantes.length > 0) {
      const seances = await prisma.event.createManyAndReturn({
        data: suivantes.map((date) => ({
          ...commun, startAt: date,
          endAt: duree === null ? null : new Date(date.getTime() + duree),
          seriesId: serie.id,
        })),
        select: { id: true },
      });
      // L'organisateur tient chacune de ses séances : il est inscrit à toutes.
      await prisma.eventParticipant.createMany({
        data: seances.map((seance) => ({ eventId: seance.id, userId: user.id })),
      });
    }
  }

  revalidatePath("/events");
  revalidatePath("/");
  redirect(`/events/${event.id}`);
}

export async function updateEventAction(eventId: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const existing = await prisma.event.findUnique({ where: { id: eventId } });
  if (!existing) return { error: t("action.eventNotFound") };
  if (existing.hostId !== user.id) return { error: t("action.hostOnly") };

  const parsed = eventUpdateSchema.safeParse({
    title: formData.get("title"),
    type: formData.get("type"),
    level: formData.get("level"),
    languages: formData.getAll("languages"),
    description: formData.get("description"),
    bringList: formData.get("bringList"),
    city: formData.get("city"),
    location: formData.get("location"),
    startAt: formData.get("startAt"),
    endAt: formData.get("endAt"),
    maxParticipants: formData.get("maxParticipants"),
  });
  if (!parsed.success) return { error: t(parsed.error.issues[0]?.message ?? "validation.form") };

  const { title, type, level, languages, description, bringList, location, startAt, endAt, maxParticipants } = parsed.data;
  const { communeCode, city } = await resoudreCommune(formData);

  // Sur une table récurrente, l'organisateur peut répercuter la correction sur
  // les séances à venir. Sans cela, changer de salle à mi-parcours obligerait à
  // rouvrir cinquante fiches une par une — et c'est exactement le genre de
  // corvée qui fait mentir un calendrier.
  const surToutLaSuite = formData.get("applyToSeries") === "1" && existing.seriesId !== null;
  const suivantes = surToutLaSuite
    ? await prisma.event.findMany({
        where: { seriesId: existing.seriesId, status: "ACTIVE", id: { not: eventId }, startAt: { gt: existing.startAt } },
        select: { id: true, _count: { select: { participants: true } } },
      })
    : [];

  // On ne peut pas réduire le nombre de places en dessous du nombre d'inscrits :
  // il faudrait désinscrire quelqu'un sans le lui dire. La contrainte vaut pour
  // chacune des séances touchées, pas seulement pour celle qu'on a sous les yeux.
  if (maxParticipants) {
    const inscrits = await prisma.eventParticipant.count({ where: { eventId } });
    const plein = Math.max(inscrits, ...suivantes.map((seance) => seance._count.participants));
    if (maxParticipants < plein) {
      return { error: t("action.tooFewPlaces", { count: plein }) };
    }
  }

  const photo = await appliquerPhoto(formData, "photo", user.id, existing.photoUrl);
  if (!photo.ok) return { error: t(photo.erreur, photo.params) };

  // Tout sauf les dates : chaque séance garde la sienne, c'est ce qui en fait
  // une séance.
  const commun = {
    title, type, level, languages,
    description: description || null, bringList: bringList || null,
    city, communeCode, location: location || null,
    maxParticipants: maxParticipants ?? null,
    // `undefined` : la photo n'a pas été touchée, on ne l'écrase pas.
    ...(photo.url === undefined ? {} : { photoUrl: photo.url }),
  };

  await prisma.event.update({
    where: { id: eventId },
    data: { ...commun, startAt, endAt: endAt ?? null },
  });

  if (suivantes.length > 0) {
    await prisma.event.updateMany({
      where: { id: { in: suivantes.map((seance) => seance.id) } },
      data: commun,
    });
  }

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

  const dejaInscrit = event.participants.some((p) => p.userId === user.id);

  await prisma.eventParticipant.upsert({
    where: { eventId_userId: { eventId, userId: user.id } },
    update: {}, create: { eventId, userId: user.id },
  });

  // On ne prévient l'organisateur que d'une vraie nouvelle inscription, et
  // jamais de la sienne à la création de la table.
  if (!dejaInscrit && event.hostId !== user.id) {
    await notify({
      userId: event.hostId,
      kind: "EVENT_JOINED",
      title: "notify.eventJoined",
      params: { name: user.name, title: event.title },
      href: `/events/${eventId}`,
      subjectId: eventId,
    });
  }

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

  // Prévenir ceux qui avaient réservé leur soirée est le minimum.
  for (const participant of event.participants) {
    if (participant.userId === user.id) continue;
    await notify({
      userId: participant.userId,
      kind: "EVENT_CANCELLED",
      title: "notify.eventCancelled",
      params: { name: user.name, title: event.title },
      body: "notify.eventCancelled.body",
      href: `/events/${eventId}`,
      subjectId: eventId,
    });
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/events");
  revalidatePath("/");
}

/**
 * Annule toutes les séances à venir d'une table récurrente.
 *
 * Les séances passées ne bougent pas : elles ont eu lieu, les annuler
 * après coup réécrirait l'histoire et invaliderait les avis qui s'y
 * rattachent.
 */
export async function cancelSeriesAction(eventId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new Error("Événement introuvable");
  if (event.hostId !== user.id) throw new Error("Action non autorisée");
  if (!event.seriesId) throw new Error("Cette table n'appartient à aucune série");

  const seances = await prisma.event.findMany({
    where: { seriesId: event.seriesId, status: "ACTIVE", startAt: { gte: event.startAt } },
    include: { participants: true },
  });

  await prisma.event.updateMany({
    where: { id: { in: seances.map((seance) => seance.id) } },
    data: { status: "CANCELLED" },
  });

  // Une décision, une notification. Prévenir quelqu'un vingt fois de la même
  // annulation reviendrait à l'ensevelir sous sa propre boîte de réception.
  const prevenus = new Set<string>([user.id]);
  for (const seance of seances) {
    for (const participant of seance.participants) {
      if (prevenus.has(participant.userId)) continue;
      prevenus.add(participant.userId);
      await notify({
        userId: participant.userId,
        kind: "EVENT_CANCELLED",
        title: "notify.seriesCancelled",
        params: { name: user.name, title: event.title, count: seances.length },
        body: "notify.eventCancelled.body",
        href: `/events/${eventId}`,
        subjectId: event.seriesId,
      });
    }
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/events");
  revalidatePath("/");
}
