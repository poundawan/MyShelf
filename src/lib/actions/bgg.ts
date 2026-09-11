"use server";

import { getCurrentUser } from "@/lib/auth";
import { rechercherJeuxBgg, type JeuBgg } from "@/lib/bgg";

/**
 * Recherche dans le catalogue BoardGameGeek, appelée depuis le sélecteur.
 *
 * C'est une action serveur et non une route `/api`, alors que le besoin — un
 * GET avec un paramètre — y ressemblait. Deux raisons :
 *
 * 1. Une route API interrogée en `fetch` depuis le navigateur est une seconde
 *    requête HTTP qui doit ré-établir la session de son côté ; sur un
 *    hébergement qui intercale une protection de déploiement, elle n'est pas
 *    traitée comme la navigation qui l'a précédée et peut être refusée alors
 *    que la page, elle, s'est affichée. Le reste de l'application ne passe que
 *    par des actions serveur : autant emprunter le chemin déjà éprouvé.
 * 2. C'est un point d'entrée public de moins.
 *
 * L'action reste un point d'entrée non fiable : la session y est revérifiée.
 */

export type ResultatRechercheBgg = {
  jeux: JeuBgg[];
  /**
   * `ok`           : BoardGameGeek a répondu (la liste peut être vide).
   * `nonConfigure` : aucun jeton d'application n'est réglé de notre côté.
   * `jetonRefuse`  : BoardGameGeek a rejeté notre jeton.
   * `injoignable`  : réseau, délai, ou autre erreur de leur côté.
   * `session`      : c'est nous qui refusons, la session n'est plus reconnue.
   *
   * Cinq issues, cinq remèdes. Les confondre a déjà coûté trois allers-retours
   * à chercher une panne d'hébergeur là où il manquait une inscription.
   */
  statut: "ok" | "injoignable" | "nonConfigure" | "jetonRefuse" | "session";
  detail?: string;
};

/** Longueur au-delà de laquelle un terme de recherche n'a plus de sens. */
const LONGUEUR_MAX = 100;

export async function rechercherBggAction(terme: string): Promise<ResultatRechercheBgg> {
  const user = await getCurrentUser();
  // Pas de redirection : le formulaire est déjà rempli, on préfère le dire.
  if (!user) return { jeux: [], statut: "session" };

  if (typeof terme !== "string" || terme.trim().length < 2) return { jeux: [], statut: "ok" };

  return rechercherJeuxBgg(terme.slice(0, LONGUEUR_MAX));
}
