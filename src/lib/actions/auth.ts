"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getT, LOCALE_COOKIE } from "@/lib/i18n/server";
import { createSession, clearSession, hashPassword, verifyPassword } from "@/lib/auth";
import { loginSchema, registerSchema } from "@/lib/validation";
import { verifierLimiteConnexion, enregistrerTentative, purgerTentativesAnciennes } from "@/lib/rate-limit";

export type ActionState = { error?: string } | undefined;

export async function registerAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getT();
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    city: formData.get("city"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: t(parsed.error.issues[0]?.message ?? "validation.form") };
  }

  const { name, email, city, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: t("action.accountExists") };
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { name, email, city, passwordHash },
  });

  await createSession(user.id);
  redirect("/");
}

export async function loginAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getT();
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: t(parsed.error.issues[0]?.message ?? "validation.form") };
  }

  const { email, password } = parsed.data;

  const limite = await verifierLimiteConnexion(email);
  if (limite.bloque) {
    return {
      error: t("action.tooManyAttempts", { count: limite.minutes }),
    };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    await enregistrerTentative(email, false, user?.id);
    // Message volontairement identique dans les deux cas : préciser que
    // l'adresse est inconnue reviendrait à confirmer qui a un compte ici.
    return { error: t("action.badCredentials") };
  }

  await enregistrerTentative(email, true, user.id);
  void purgerTentativesAnciennes();

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, user.locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });

  await createSession(user.id);
  redirect("/");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}
