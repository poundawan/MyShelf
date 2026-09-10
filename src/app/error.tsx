"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

/**
 * Limite d'erreur de l'application : elle attrape ce qui casse au rendu d'une
 * page. `reset()` retente le rendu sans recharger toute l'application.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-24 text-center sm:px-6">
      <div className="flex size-16 rotate-45 items-center justify-center rounded-sm bg-rust">
        <span className="-rotate-45 font-display text-2xl text-cream">!</span>
      </div>

      <div className="mt-8 text-xs font-bold uppercase tracking-widest text-gold">{t("error.500.eyebrow")}</div>
      <h1 className="mt-2 font-display text-3xl text-cream">{t("error.500.title")}</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">{t("error.500.lede")}</p>

      {error.digest && (
        <p className="mt-4 font-mono text-xs text-ink-soft/70">{t("error.500.reference", { digest: error.digest })}</p>
      )}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>{t("error.500.retry")}</Button>
        <Link href="/" className="inline-block">
          <Button variant="secondary">{t("error.500.home")}</Button>
        </Link>
      </div>
    </div>
  );
}
