"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function joinClubAction(clubId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const club = await prisma.club.findUnique({ where: { id: clubId } });
  if (!club) throw new Error("Club introuvable");

  await prisma.clubMembership.upsert({
    where: { clubId_userId: { clubId, userId: user.id } },
    update: {},
    create: { clubId, userId: user.id },
  });

  revalidatePath(`/clubs/${clubId}`);
  revalidatePath("/clubs");
  revalidatePath("/");
}

export async function leaveClubAction(clubId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  await prisma.clubMembership.deleteMany({ where: { clubId, userId: user.id } });

  revalidatePath(`/clubs/${clubId}`);
  revalidatePath("/clubs");
  revalidatePath("/");
}
