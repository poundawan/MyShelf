import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";

/**
 * Compte les échanges d'une personne, une seule fois par requête.
 *
 * Le bandeau de navigation affiche la pastille des propositions en attente et
 * le niveau, lequel se déduit du nombre d'échanges menés à terme. L'accueil
 * affiche exactement les deux mêmes nombres. Chacun les demandait de son côté :
 * quatre requêtes là où deux suffisent, sur toutes les pages puisque le bandeau
 * est dans la mise en page racine.
 */
export const compterEchanges = cache(async (userId: string) => {
  const [enAttente, termines] = await Promise.all([
    prisma.tradeProposal.count({ where: { toUserId: userId, status: "PENDING" } }),
    prisma.tradeProposal.count({
      where: { OR: [{ fromUserId: userId }, { toUserId: userId }], status: "COMPLETED" },
    }),
  ]);
  return { enAttente, termines };
});
