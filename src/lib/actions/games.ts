"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { gameCopySchema, itemConditions } from "@/lib/validation";
import type { ActionState } from "@/lib/actions/auth";

export async function addGameCopyAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
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
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }

  const { title, category, condition, minPlayers, maxPlayers, durationMin, description, photoUrl } = parsed.data;

  let game = await prisma.game.findFirst({ where: { title: { equals: title.trim(), mode: "insensitive" } } });
  if (!game) {
    game = await prisma.game.create({
      data: {
        title: title.trim(),
        category,
        minPlayers: minPlayers ? Number(minPlayers) : null,
        maxPlayers: maxPlayers ? Number(maxPlayers) : null,
        durationMin: durationMin ? Number(durationMin) : null,
        description: description || null,
        photoUrl: photoUrl || null,
      },
    });
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
