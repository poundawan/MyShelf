"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, clearSession, hashPassword, verifyPassword } from "@/lib/auth";
import { loginSchema, registerSchema } from "@/lib/validation";
import { verifierLimiteConnexion, enregistrerTentative, purgerTentativesAnciennes } from "@/lib/rate-limit";

export type ActionState = { error?: string } | undefined;

export async function registerAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    city: formData.get("city"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }

  const { name, email, city, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "Un compte existe déjà avec cet e-mail" };
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { name, email, city, passwordHash },
  });

  await createSession(user.id);
  redirect("/");
}

export async function loginAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }

  const { email, password } = parsed.data;

  const limite = await verifierLimiteConnexion(email);
  if (limite.bloque) {
    return {
      error: `Trop de tentatives. Réessaie dans ${limite.minutes} minute${limite.minutes > 1 ? "s" : ""}.`,
    };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    await enregistrerTentative(email, false, user?.id);
    // Message volontairement identique dans les deux cas : préciser que
    // l'adresse est inconnue reviendrait à confirmer qui a un compte ici.
    return { error: "E-mail ou mot de passe incorrect" };
  }

  await enregistrerTentative(email, true, user.id);
  void purgerTentativesAnciennes();

  await createSession(user.id);
  redirect("/");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}
