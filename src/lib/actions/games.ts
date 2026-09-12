"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { gameCopySchema, itemConditions } from "@/lib/validation";
import { appliquerPhoto } from "@/lib/photos";
import { estImageBgg } from "@/lib/bgg";
import type { ActionState } from "@/lib/actions/auth";

export async function addGameCopyAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = gameCopySchema.safeParse({
    title: formData.get("title"),
    category: formData.get("category"),
    condition: formData.get("condition"),
    minPlayers: formData.get("minPlayers"),
    maxPlayers: formData.get("maxPlayers"),
    durationMin: formData.get("durationMin"),
    description: formData.get("description"),
    photoUrl: formData.get("photoUrl"),
    bggId: formData.get("bggId"),
    titreOriginal: formData.get("titreOriginal"),
  });

  if (!parsed.success) {
    return { error: t(parsed.error.issues[0]?.message ?? "validation.form") };
  }

  const { title, category, condition, minPlayers, maxPlayers, durationMin, description, photoUrl, bggId, titreOriginal } = parsed.data;

  // Le champ caché vient du sélecteur BoardGameGeek, mais rien n'empêche de
  // poster ce formulaire à la main : on ne recopie une URL distante que si
  // elle désigne bien une image de chez eux.
  const jaquetteDistante = photoUrl && estImageBgg(photoUrl) ? photoUrl : null;
  const identifiantBgg = /^[0-9]{1,9}$/.test(bggId ?? "") ? Number(bggId) : null;

  // Le titre d'origine n'a de sens que rattaché à une fiche BoardGameGeek.
  // Sans identifiant, ce champ caché ne prouve rien et on l'ignore.
  const titreBgg = identifiantBgg && titreOriginal ? titreOriginal.trim() : null;

  // Une photo envoyée l'emporte sur la jaquette reprise du catalogue : c'est
  // un geste explicite, contre une valeur pré-remplie.
  const envoyee = await appliquerPhoto(formData, "photo", user.id, null);
  if (!envoyee.ok) return { error: t(envoyee.erreur, envoyee.params) };
  const jaquette = envoyee.url ?? jaquetteDistante;

  // Le catalogue est partagé : on rattache la copie à la fiche existante
  // plutôt que d'en créer une deuxième. L'identifiant BGG prime sur le titre,
  // qui peut différer d'une orthographe à l'autre.
  let game = identifiantBgg ? await prisma.game.findUnique({ where: { bggId: identifiantBgg } }) : null;
  // À défaut d'identifiant, on rapproche par le titre — le sien ou celui
  // d'origine. C'est ce qui évite qu'une fiche enregistrée sous « Les
  // Aventuriers du Rail » soit dupliquée par quelqu'un qui saisit « Ticket to
  // Ride » à la main.
  game ??= await prisma.game.findFirst({
    where: {
      OR: [
        { title: { equals: title.trim(), mode: "insensitive" } },
        { titreOriginal: { equals: title.trim(), mode: "insensitive" } },
        ...(titreBgg ? [{ title: { equals: titreBgg, mode: "insensitive" as const } }] : []),
      ],
    },
  });

  if (!game) {
    game = await prisma.game.create({
      data: {
        title: title.trim(),
        category,
        minPlayers: minPlayers ? Number(minPlayers) : null,
        maxPlayers: maxPlayers ? Number(maxPlayers) : null,
        durationMin: durationMin ? Number(durationMin) : null,
        description: description || null,
        photoUrl: jaquette,
        bggId: identifiantBgg,
        titreOriginal: titreBgg,
      },
    });
  } else if (!game.photoUrl && jaquette) {
    // La fiche partagée existait sans visuel : la première personne à en
    // apporter un en fait profiter tout le monde.
    game = await prisma.game.update({ where: { id: game.id }, data: { photoUrl: jaquette } });
  }

  await prisma.gameCopy.create({
    data: { gameId: game.id, ownerId: user.id, condition, status: "ON_TABLE" },
  });

  revalidatePath("/shelf");
  revalidatePath("/");
  redirect(`/games/${game.id}`);
}

export async function toggleCopyStatusAction(copyId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const copy = await prisma.gameCopy.findUnique({ where: { id: copyId } });
  if (!copy || copy.ownerId !== user.id) throw new Error("Copie introuvable");
  if (copy.status !== "ON_TABLE" && copy.status !== "KEPT_WARM") return;

  await prisma.gameCopy.update({
    where: { id: copyId },
    data: { status: copy.status === "ON_TABLE" ? "KEPT_WARM" : "ON_TABLE" },
  });

  revalidatePath("/shelf");
  revalidatePath(`/games/${copy.gameId}`);
}

export async function toggleGameWantAction(gameId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const existing = await prisma.gameWant.findUnique({
    where: { gameId_userId: { gameId, userId: user.id } },
  });

  if (existing) {
    await prisma.gameWant.delete({ where: { id: existing.id } });
  } else {
    await prisma.gameWant.create({ data: { gameId, userId: user.id } });
  }

  revalidatePath(`/games/${gameId}`);
  revalidatePath("/shelf");
}

export async function removeGameWantAction(wantId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const want = await prisma.gameWant.findUnique({ where: { id: wantId } });
  if (!want || want.userId !== user.id) throw new Error("Introuvable");

  await prisma.gameWant.delete({ where: { id: wantId } });
  revalidatePath("/shelf");
}

export async function updateGameCopyConditionAction(copyId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const copy = await prisma.gameCopy.findUnique({ where: { id: copyId } });
  if (!copy || copy.ownerId !== user.id) throw new Error("Copie introuvable");

  const condition = String(formData.get("condition") ?? "");
  if (!(itemConditions as readonly string[]).includes(condition)) throw new Error("État invalide");

  await prisma.gameCopy.update({
    where: { id: copyId },
    data: { condition: condition as (typeof itemConditions)[number] },
  });

  revalidatePath("/shelf");
  revalidatePath(`/games/${copy.gameId}`);
}

export async function deleteGameCopyAction(copyId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const copy = await prisma.gameCopy.findUnique({ where: { id: copyId } });
  if (!copy || copy.ownerId !== user.id) throw new Error("Copie introuvable");

  // Retirer une copie engagée dans une négociation en cours laisserait
  // l'échange sans objet, côté interlocuteur comme en base.
  const engagee = await prisma.tradeItem.findFirst({
    where: { gameCopyId: copyId, tradeProposal: { status: { in: ["PENDING", "ACCEPTED"] } } },
  });
  if (engagee) throw new Error("Ce jeu est engagé dans un échange en cours");

  await prisma.gameCopy.delete({ where: { id: copyId } });
  revalidatePath("/shelf");
  redirect("/shelf");
}
