import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui";
import { PackagePlus, ArrowLeftRight, User as UserIcon } from "lucide-react";

export async function Nav() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span className="text-2xl">🗄️</span>
          MyShelf
        </Link>

        {user ? (
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/trades"
              className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-foreground hover:bg-border/40 sm:flex"
            >
              <ArrowLeftRight className="size-4" />
              Échanges
            </Link>
            <Link href="/items/new">
              <Button size="sm" className="gap-1.5">
                <PackagePlus className="size-4" />
                <span className="hidden sm:inline">Ajouter un objet</span>
                <span className="sm:hidden">Ajouter</span>
              </Button>
            </Link>
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
