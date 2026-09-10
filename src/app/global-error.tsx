"use client";

/**
 * Dernier filet : cette page remplace la mise en page racine quand c'est elle
 * qui échoue. Ni les polices ni les feuilles de style du layout ne sont
 * disponibles ici, d'où les styles écrits en dur.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2e5a48",
          color: "#fbf3e2",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
          padding: 24,
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <div
            style={{
              width: 56,
              height: 56,
              margin: "0 auto",
              transform: "rotate(45deg)",
              background: "#b4472f",
              borderRadius: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ transform: "rotate(-45deg)", fontSize: 26, fontWeight: 700 }}>!</span>
          </div>

          <h1 style={{ marginTop: 28, fontSize: 24, fontWeight: 700 }}>MyShelf ne répond plus</h1>
          <p style={{ marginTop: 12, fontSize: 15, lineHeight: 1.6, color: "#d8e2d5" }}>
            Une erreur a interrompu le chargement de l&apos;application. Recharger la page suffit
            généralement.
          </p>
          {error.digest && (
            <p style={{ marginTop: 14, fontSize: 12, color: "#a9bda6" }}>Référence : {error.digest}</p>
          )}

          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 26,
              padding: "11px 22px",
              border: 0,
              borderRadius: 2,
              background: "#e2a93b",
              color: "#4a2e12",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Recharger
          </button>
        </div>
      </body>
    </html>
  );
}
