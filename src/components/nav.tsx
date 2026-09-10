import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/auth";
import { prisma } from "@/lib/prisma";
import { Button, Avatar } from "@/components/ui";
import { computeLevel } from "@/lib/labels";
import { ChevronDown, Dice5, Library, Search, ArrowLeftRight, Layers, CalendarDays, Mail } from "lucide-react";

const NAV_ITEMS = [
  { href: "/shelf", label: "Mon étagère", icon: Library },
  { href: "/search", label: "Recherche", icon: Search },
  { href: "/trades", label: "Échanges", icon: ArrowLeftRight, badgeKey: "trades" as const },
  { href: "/cards", label: "Cartes", icon: Layers },
  { href: "/events", label: "Tables", icon: CalendarDays },
  { href: "/messages", label: "Messages", icon: Mail },
];

export async function Nav() {
  const user = await getCurrentUser();
  let pendingTrades = 0;
  let level = 1;

  if (user) {
    const [pending, completedCount] = await Promise.all([
      prisma.tradeProposal.count({ where: { toUserId: user.id, status: "PENDING" } }),
      prisma.tradeProposal.count({ where: { OR: [{ fromUserId: user.id }, { toUserId: user.id }], status: "COMPLETED" } }),
    ]);
    pendingTrades = pending;
    level = computeLevel(completedCount).level;
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border-strong bg-wood">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 pr-3">
          <div className="flex size-7 flex-none rotate-45 items-center justify-center rounded-sm bg-gold">
            <span className="-rotate-45 font-display text-sm text-gold-ink">M</span>
          </div>
          <span className="font-display text-lg text-cream">MyShelf</span>
        </Link>

        {user ? (
          <>
            <nav className="hidden flex-1 items-center gap-0.5 md:flex">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const badge = item.badgeKey === "trades" ? pendingTrades : 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-1.5 rounded-sm px-3 py-2 text-[13px] font-semibold text-cream-soft transition-colors hover:bg-black/10 hover:text-cream"
                  >
                    <Icon className="size-4" />
                    {item.label}
                    {badge > 0 && (
                      <span className="rounded-sm bg-rust px-1.5 py-0.5 text-[10px] font-bold text-cream">{badge}</span>
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="ml-auto flex items-center gap-2">
              <details className="group relative">
                <summary className="flex cursor-pointer list-none items-center gap-1 rounded-sm bg-gold px-3.5 py-2 text-[13px] font-bold text-gold-ink marker:content-none [&::-webkit-details-marker]:hidden">
                  <Dice5 className="size-4" />
                  <span className="hidden sm:inline">Créer</span>
                  <ChevronDown className="size-3.5" />
                </summary>
                <div className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-sm border border-border-strong bg-surface shadow-xl">
                  <Link href="/events/new" className="flex items-center gap-2 px-4 py-3 text-sm text-ink hover:bg-white/5">
                    Ouvrir une table
                  </Link>
                  <Link href="/shelf/new" className="flex items-center gap-2 border-t border-border px-4 py-3 text-sm text-ink hover:bg-white/5">
                    Ajouter un jeu
                  </Link>
                  <Link href="/cards/new" className="flex items-center gap-2 border-t border-border px-4 py-3 text-sm text-ink hover:bg-white/5">
                    Ajouter une carte
                  </Link>
                </div>
              </details>

              <Link href={`/profile/${user.id}`} className="flex items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-black/10">
                <Avatar name={user.name} size={30} />
                <span className="hidden text-left leading-tight lg:block">
                  <span className="block text-xs font-bold text-cream">{user.name}</span>
                  <span className="block text-[10px] text-cream-soft">Niveau {level}</span>
                </span>
              </Link>
              <form action={logoutAction}>
                <Button type="submit" variant="ghost" size="sm" className="text-cream-soft hover:text-cream">
                  Déconnexion
                </Button>
              </form>
            </div>
          </>
        ) : (
          <nav className="ml-auto flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-cream-soft hover:text-cream">
                Connexion
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm">Créer un compte</Button>
            </Link>
          </nav>
        )}
      </div>
      {user && (
        <nav className="flex items-center gap-0.5 overflow-x-auto border-t border-black/10 px-2 py-1 md:hidden">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-none items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs font-semibold text-cream-soft hover:bg-black/10 hover:text-cream"
              >
                <Icon className="size-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
