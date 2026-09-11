"use client";

import { useT } from "@/lib/i18n/client";

/**
 * Mention « Powered by BGG », exigée par les conditions d'utilisation de leur
 * API XML pour toute application publique : elle doit pointer vers
 * BoardGameGeek, et le logo doit rester à une taille où son texte est lisible.
 *
 * Le logo n'est pas versionné ici — c'est leur marque, elle se télécharge
 * depuis la page « Using the XML API ». Dépose le fichier dans `public/` et
 * renseigne `NEXT_PUBLIC_BGG_LOGO_URL` (par exemple `/powered-by-bgg.png`) :
 * la mention passe alors du texte à l'image.
 *
 * Pourquoi une variable plutôt qu'un chemin en dur avec repli sur erreur : une
 * image absente déclenche un 404 à chaque affichage, que la console signale et
 * que les tests comptent comme une erreur de page. Un réglage explicite vaut
 * mieux qu'un échec silencieux qu'on finit par ignorer.
 */
const LOGO = process.env.NEXT_PUBLIC_BGG_LOGO_URL?.trim();

export function PoweredByBgg({ className = "" }: { className?: string }) {
  const t = useT();

  return (
    <a
      href="https://boardgamegeek.com"
      target="_blank"
      rel="noreferrer noopener"
      className={`inline-flex items-center gap-2 text-xs text-ink-soft hover:text-cream ${className}`}
    >
      {LOGO ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={LOGO} alt={t("bgg.poweredBy")} className="h-6 w-auto" />
      ) : (
        <span className="font-bold">{t("bgg.poweredBy")}</span>
      )}
      <span>{t("bgg.credit")}</span>
    </a>
  );
}
