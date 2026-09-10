import "server-only";

import { prisma } from "@/lib/prisma";

/** Au-delà de ce nombre d'échecs dans la fenêtre, on refuse de vérifier le mot de passe. */
const MAX_ECHECS = 5;
const FENETRE_MS = 15 * 60 * 1000;

/**
 * Freine les tentatives de connexion par force brute.
 *
 * Le compteur est en base plutôt qu'en mémoire : sur Vercel, chaque requête
 * peut atterrir dans une instance différente, et un compteur local ne verrait
 * qu'une fraction des tentatives — autant dire rien.
 *
 * On compte par adresse e-mail, y compris inexistante : sinon il suffirait de
 * balayer des adresses au hasard sans jamais être freiné.
 */
export async function verifierLimiteConnexion(email: string) {
  const depuis = new Date(Date.now() - FENETRE_MS);

  const echecs = await prisma.loginAttempt.count({
    where: { email, succeeded: false, createdAt: { gte: depuis } },
  });

  if (echecs < MAX_ECHECS) return { bloque: false as const };

  const plusAncien = await prisma.loginAttempt.findFirst({
    where: { email, succeeded: false, createdAt: { gte: depuis } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  const finBlocage = new Date((plusAncien?.createdAt.getTime() ?? Date.now()) + FENETRE_MS);
  const minutes = Math.max(1, Math.ceil((finBlocage.getTime() - Date.now()) / 60000));

  return { bloque: true as const, minutes };
}

export async function enregistrerTentative(email: string, succeeded: boolean, userId?: string) {
  await prisma.loginAttempt.create({ data: { email, succeeded, userId: userId ?? null } });

  // Une connexion réussie efface l'ardoise : sinon quelqu'un qui s'est trompé
  // quatre fois resterait à un échec du blocage pendant un quart d'heure.
  if (succeeded) {
    await prisma.loginAttempt.deleteMany({ where: { email, succeeded: false } });
  }
}

/**
 * Purge les tentatives anciennes. Appelée au fil de l'eau plutôt que par une
 * tâche planifiée : la table ne sert qu'à une fenêtre de quinze minutes.
 */
export async function purgerTentativesAnciennes() {
  const seuil = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: seuil } } });
}
