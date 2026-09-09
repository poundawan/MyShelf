"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { gameCopySchema } from "@/lib/validation";
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

export async function deleteGameCopyAction(copyId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const copy = await prisma.gameCopy.findUnique({ where: { id: copyId } });
  if (!copy || copy.ownerId !== user.id) throw new Error("Copie introuvable");

  await prisma.gameCopy.delete({ where: { id: copyId } });
  revalidatePath("/shelf");
  redirect("/shelf");
}
