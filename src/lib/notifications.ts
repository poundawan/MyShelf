import "server-only";

import { prisma } from "@/lib/prisma";

type Kind =
  | "TRADE_PROPOSED"
  | "TRADE_ACCEPTED"
  | "TRADE_REJECTED"
  | "TRADE_COMPLETED"
  | "MESSAGE_RECEIVED"
  | "EVENT_JOINED"
  | "EVENT_CANCELLED"
  | "REVIEW_RECEIVED";

type NewNotification = {
  userId: string;
  kind: Kind;
  /** Clé de traduction du titre, et de l'éventuel corps. */
  title: string;
  body?: string | null;
  /** Variables des deux clés : un prénom, un titre de table, un extrait. */
  params?: Record<string, string | number>;
  href: string;
  /** Regroupe les notifications d'une même source (un échange, une conversation). */
  subjectId?: string | null;
};

/** Fenêtre pendant laquelle une notification non lue est réutilisée plutôt que dupliquée. */
const FENETRE_REGROUPEMENT_MS = 60 * 60 * 1000;

/**
 * Dépose une notification, sans jamais faire échouer l'action qui l'a déclenchée.
 *
 * `title` et `body` sont des CLÉS de traduction : c'est le destinataire qui
 * les lit, et il peut avoir choisi une autre langue que l'auteur de l'action.
 *
 * Prévenir quelqu'un est un effet de bord : si l'insertion échoue, l'échange
 * ou le message doit quand même aboutir. On avale donc l'erreur en la
 * journalisant, plutôt que de la laisser remonter.
 */
export async function notify(notification: NewNotification) {
  try {
    // Dix messages d'affilée dans la même conversation ne doivent pas produire
    // dix lignes : tant que la précédente n'est pas lue et qu'elle est récente,
    // on la rafraîchit.
    if (notification.subjectId) {
      const recente = await prisma.notification.findFirst({
        where: {
          userId: notification.userId,
          kind: notification.kind,
          subjectId: notification.subjectId,
          readAt: null,
          createdAt: { gte: new Date(Date.now() - FENETRE_REGROUPEMENT_MS) },
        },
        orderBy: { createdAt: "desc" },
      });

      if (recente) {
        await prisma.notification.update({
          where: { id: recente.id },
          data: {
            title: notification.title,
            body: notification.body ?? null,
            params: notification.params ?? undefined,
            href: notification.href,
            createdAt: new Date(),
          },
        });
        return;
      }
    }

    await prisma.notification.create({
      data: {
        userId: notification.userId,
        kind: notification.kind,
        title: notification.title,
        body: notification.body ?? null,
        params: notification.params ?? undefined,
        href: notification.href,
        subjectId: notification.subjectId ?? null,
      },
    });
  } catch (error) {
    console.error("Notification non enregistrée :", error);
  }
}

export async function countUnread(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}
