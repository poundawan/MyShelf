import type { NextConfig } from "next";

/**
 * En-têtes de sécurité appliqués à toutes les réponses.
 *
 * La politique de contenu autorise les images distantes (les jeux, avatars et
 * salles sont renseignés par URL) mais interdit l'exécution de scripts venus
 * d'ailleurs. `'unsafe-inline'` reste nécessaire pour les scripts et styles
 * que Next.js injecte lui-même ; le supprimer demanderait de passer par un
 * nonce, ce qui suppose un middleware.
 */
const enDeveloppement = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  // `unsafe-eval` n'est nécessaire qu'au rechargement à chaud du serveur de
  // développement. L'autoriser en production affaiblirait la protection pour rien.
  `script-src 'self' 'unsafe-inline'${enDeveloppement ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Empêche l'affichage du site dans une iframe tierce (détournement de clic).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // L'application n'a besoin d'aucune de ces permissions.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,

  experimental: {
    // Les actions serveur reçoivent 1 Mo par défaut, ce qui refuserait une
    // photo de 2 Mo (le plafond appliqué dans `src/lib/photos.ts`). On laisse
    // en plus de la marge pour l'habillage multipart, qui n'est pas gratuit.
    serverActions: { bodySizeLimit: "3mb" },
  },

  async headers() {
    const headers = [...securityHeaders];

    // HSTS n'a de sens qu'en HTTPS : l'ajouter en développement rendrait
    // http://localhost inaccessible dans le navigateur, durablement.
    if (process.env.NODE_ENV === "production") {
      headers.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    }

    return [
      { source: "/:path*", headers },
      {
        // Les images envoyées par les membres sont servies depuis notre propre
        // domaine : elles doivent être inertes. La règle générale ci-dessus
        // leur appliquerait la politique de l'application, qui autorise nos
        // scripts — cette entrée, plus spécifique et placée après, la remplace.
        source: "/api/photos/:path*",
        headers: [
          ...headers.filter((h) => h.key !== "Content-Security-Policy"),
          { key: "Content-Security-Policy", value: "sandbox; default-src 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;
