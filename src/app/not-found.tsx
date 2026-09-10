import Link from "next/link";
import { Button } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

export default async function NotFound() {
  const t = await getT();

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-24 text-center sm:px-6">
      <div className="flex size-16 rotate-45 items-center justify-center rounded-sm bg-wood">
        <span className="-rotate-45 font-display text-2xl text-cream">?</span>
      </div>

      <div className="mt-8 text-xs font-bold uppercase tracking-widest text-gold">{t("error.404.eyebrow")}</div>
      <h1 className="mt-2 font-display text-3xl text-cream">{t("error.404.title")}</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">{t("error.404.lede")}</p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="inline-block">
          <Button>{t("error.404.home")}</Button>
        </Link>
        <Link href="/search" className="inline-block">
          <Button variant="secondary">{t("error.404.explore")}</Button>
        </Link>
      </div>
    </div>
  );
}
