"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui";

/**
 * Limite d'erreur de l'application : elle attrape ce qui casse au rendu d'une
 * page. `reset()` retente le rendu sans recharger toute l'application.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-24 text-center sm:px-6">
      <div className="flex size-16 rotate-45 items-center justify-center rounded-sm bg-rust">
        <span className="-rotate-45 font-display text-2xl text-cream">!</span>
      </div>

      <div className="mt-8 text-xs font-bold uppercase tracking-widest text-gold">La partie s&apos;est arrêtée</div>
      <h1 className="mt-2 font-display text-3xl text-cream">Quelque chose a coincé</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">
        L&apos;erreur vient de chez nous, pas de toi. Réessayer suffit le plus souvent ; si ça
        recommence, reviens dans quelques minutes.
      </p>

      {error.digest && (
        <p className="mt-4 font-mono text-xs text-ink-soft/70">Référence : {error.digest}</p>
      )}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>Réessayer</Button>
        <Link href="/" className="inline-block">
          <Button variant="secondary">Retour à l&apos;accueil</Button>
        </Link>
      </div>
    </div>
  );
}
