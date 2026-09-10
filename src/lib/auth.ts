import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const EN_PRODUCTION = process.env.NODE_ENV === "production";

/**
 * Le préfixe `__Host-` impose au navigateur : cookie chiffré, chemin racine et
 * aucun domaine explicite. Un sous-domaine voisin ne peut donc pas l'écraser.
 * Il exige HTTPS, on ne l'applique donc qu'en production.
 */
const SESSION_COOKIE = EN_PRODUCTION ? "__Host-myshelf_session" : "myshelf_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30; // 30 jours

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

/** Attributs communs à la pose et à l'effacement du cookie de session. */
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: EN_PRODUCTION,
  sameSite: "lax",
  path: "/",
} as const;

export async function createSession(userId: string) {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, { ...COOKIE_OPTIONS, maxAge: SESSION_DURATION_SECONDS });
}

export async function clearSession() {
  const cookieStore = await cookies();
  // On réécrit le cookie vide avec exactement les mêmes attributs plutôt que
  // d'appeler `delete` : un cookie préfixé `__Host-` n'est effacé que si le
  // navigateur retrouve `Secure` et `Path=/`, sinon la session survit à la
  // déconnexion.
  cookieStore.set(SESSION_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
}

async function getUserIdFromSession(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return typeof payload.userId === "string" ? payload.userId : null;
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const userId = await getUserIdFromSession();
  if (!userId) return null;

  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, name: true, city: true, avatarUrl: true, createdAt: true,
      bio: true, verified: true, experienceLevel: true, locale: true,
    },
  });
}

/**
 * Exige une session et renvoie l'utilisateur, ou redirige vers la connexion.
 *
 * À utiliser dans les composants serveur qui ne doivent rien afficher à un
 * visiteur déconnecté : sans cela, un formulaire client s'affiche entièrement
 * et la personne n'est renvoyée vers la connexion qu'à l'envoi, sa saisie
 * perdue. Les actions serveur revalident de toute façon la session : cette
 * garde est là pour le confort, pas pour la sécurité.
 */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
