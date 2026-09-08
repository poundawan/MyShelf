import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui";
import { PackagePlus, CalendarPlus, ArrowLeftRight, User as UserIcon, ChevronDown, Dices } from "lucide-react";

export async function Nav() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span className="text-2xl">🎲</span>
          MyShelf
        </Link>

        {user ? (
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/items"
              className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-foreground hover:bg-border/40 sm:flex"
            >
              <Dices className="size-4" />
              Jeux
            </Link>
            <Link
              href="/events"
              className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-foreground hover:bg-border/40 sm:flex"
            >
              <CalendarPlus className="size-4" />
              Événements
            </Link>
            <Link
              href="/trades"
              className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-foreground hover:bg-border/40 sm:flex"
            >
              <ArrowLeftRight className="size-4" />
              Échanges
            </Link>

            <details className="group relative">
              <summary className="flex list-none items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground marker:content-none hover:bg-primary-hover [&::-webkit-details-marker]:hidden">
                <span className="hidden sm:inline">Créer</span>
                <ChevronDown className="size-4" />
              </summary>
              <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                <Link
                  href="/events/new"
                  className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-border/40"
                >
                  <CalendarPlus className="size-4" />
                  Organiser une partie
                </Link>
                <Link
                  href="/items/new"
                  className="flex items-center gap-2 border-t border-border px-4 py-3 text-sm hover:bg-border/40"
                >
                  <PackagePlus className="size-4" />
                  Ajouter un objet
                </Link>
              </div>
            </details>

            <Link
              href="/profile"
              className="flex items-center gap-1.5 rounded-full p-2 text-sm font-medium text-foreground hover:bg-border/40"
              title={user.name}
            >
              <UserIcon className="size-5" />
            </Link>
            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="sm">
                Déconnexion
              </Button>
            </form>
          </nav>
        ) : (
          <nav className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Connexion
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm">Créer un compte</Button>
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
