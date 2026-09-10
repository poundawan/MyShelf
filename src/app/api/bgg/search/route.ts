import { getCurrentUser } from "@/lib/auth";
import { rechercherJeuxBgg } from "@/lib/bgg";

/**
 * Relais vers la recherche BoardGameGeek.
 *
 * Passer par le serveur est nécessaire : BGG ne renvoie pas d'en-tête CORS.
 * La session est exigée pour que l'application ne devienne pas un relais ouvert
 * vers un service tiers — et les réponses de BGG sont mises en cache 24 h
 * (voir `bgg.ts`), ce qui limite la charge qu'un membre pressé peut lui
 * transmettre.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ erreur: "unauthorized" }, { status: 401 });

  const requete = new URL(request.url).searchParams.get("q") ?? "";
  if (requete.trim().length < 2) return Response.json({ jeux: [] });

  const jeux = await rechercherJeuxBgg(requete);
  return Response.json({ jeux });
}
