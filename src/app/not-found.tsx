import Link from "next/link";
import { Button } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-24 text-center sm:px-6">
      <div className="flex size-16 rotate-45 items-center justify-center rounded-sm bg-wood">
        <span className="-rotate-45 font-display text-2xl text-cream">?</span>
      </div>

      <div className="mt-8 text-xs font-bold uppercase tracking-widest text-gold">Erreur 404</div>
      <h1 className="mt-2 font-display text-3xl text-cream">Cette boîte est vide</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">
        La page que tu cherches n&apos;existe pas, ou plus. Une table annulée, un jeu retiré d&apos;une
        étagère, un lien recopié de travers : ça arrive.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="inline-block">
          <Button>Retour à l&apos;accueil</Button>
        </Link>
        <Link href="/search" className="inline-block">
          <Button variant="secondary">Explorer le plateau</Button>
        </Link>
      </div>
    </div>
  );
}
