import { prisma } from "@/lib/prisma";

/**
 * Sert une image envoyée par un membre.
 *
 * Le contenu d'une photo ne change jamais — un remplacement crée une nouvelle
 * ligne, donc une nouvelle URL — d'où le cache `immutable` d'un an.
 *
 * Le type MIME renvoyé est celui reconnu à l'envoi dans les octets du fichier,
 * jamais celui annoncé par le navigateur : servir du contenu envoyé par un
 * tiers depuis notre propre domaine ne doit en aucun cas pouvoir devenir du
 * HTML exécutable. `nosniff` et la politique de contenu `sandbox` complètent
 * la protection — ils sont posés dans `next.config.ts`, dont les en-têtes
 * l'emportent sur ceux fixés ici.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/photos/[id]">) {
  const { id } = await ctx.params;

  const photo = await prisma.photo.findUnique({
    where: { id },
    select: { bytes: true, mimeType: true, byteSize: true },
  });
  if (!photo) return new Response("Not found", { status: 404 });

  const etag = `"${id}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  return new Response(new Uint8Array(photo.bytes), {
    headers: {
      "Content-Type": photo.mimeType,
      "Content-Length": String(photo.byteSize),
      "Content-Disposition": "inline",
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: etag,
    },
  });
}
