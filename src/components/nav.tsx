import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/auth";
import { prisma } from "@/lib/prisma";
import { Button, Avatar } from "@/components/ui";
import { computeLevel } from "@/lib/labels";
import { countUnread } from "@/lib/notifications";
import { ChevronDown, Dice5, Library, Search, ArrowLeftRight, Layers, CalendarDays, Mail, LogOut, Bell } from "lucide-react";

// `short` est le libellé de la barre d'onglets mobile : six colonnes doivent
// tenir sans rognage dès 320 px de large.
const NAV_ITEMS = [
  { href: "/shelf", label: "Mon étagère", short: "Étagère", icon: Library },
  { href: "/search", label: "Recherche", short: "Recherche", icon: Search },
  { href: "/trades", label: "Échanges", short: "Échanges", icon: ArrowLeftRight, badgeKey: "trades" as const },
  { href: "/cards", label: "Cartes", short: "Cartes", icon: Layers },
  { href: "/events", label: "Tables", short: "Tables", icon: CalendarDays },
  { href: "/messages", label: "Messages", short: "Messages", icon: Mail },
];

export async function Nav() {
  const user = await getCurrentUser();
  let pendingTrades = 0;
  let level = 1;

  let unreadNotifications = 0;

  if (user) {
    const [pending, completedCount, unread] = await Promise.all([
      prisma.tradeProposal.count({ where: { toUserId: user.id, status: "PENDING" } }),
      prisma.tradeProposal.count({ where: { OR: [{ fromUserId: user.id }, { toUserId: user.id }], status: "COMPLETED" } }),
      countUnread(user.id),
    ]);
    pendingTrades = pending;
    level = computeLevel(completedCount).level;
    unreadNotifications = unread;
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border-strong bg-wood">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5 sm:px-6">
        <Link href="/" className="flex flex-none items-center gap-2.5 py-1 pr-1 sm:pr-3">
          <div className="flex size-7 flex-none rotate-45 items-center justify-center rounded-sm bg-gold">
            <span className="-rotate-45 font-display text-sm text-gold-ink">M</span>
          </div>
          <span className="font-display text-lg text-cream">MyShelf</span>
        </Link>

        {user ? (
          <>
            {/* Les six libellés complets ne tiennent qu'à partir de `lg` :
                en dessous, c'est la barre d'onglets du bas de l'en-tête. */}
            <nav className="hidden flex-1 items-center gap-0.5 lg:flex">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const badge = item.badgeKey === "trades" ? pendingTrades : 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex flex-none items-center gap-1.5 whitespace-nowrap rounded-sm px-2 py-2 text-[13px] font-semibold text-cream-soft transition-colors hover:bg-black/10 hover:text-cream xl:px-3"
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

            <div className="ml-auto flex flex-none items-center gap-1 sm:gap-2">
              <details className="group relative">
                <summary className="flex cursor-pointer list-none items-center gap-1 rounded-sm bg-gold px-2.5 py-2 text-[13px] font-bold text-gold-ink marker:content-none sm:px-3.5 [&::-webkit-details-marker]:hidden">
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

              <Link
                href="/notifications"
                aria-label={
                  unreadNotifications > 0
                    ? `Notifications, ${unreadNotifications} non lue${unreadNotifications > 1 ? "s" : ""}`
                    : "Notifications"
                }
                className="relative flex size-9 flex-none items-center justify-center rounded-sm text-cream-soft transition-colors hover:bg-black/10 hover:text-cream"
              >
                <Bell className="size-[18px]" />
                {unreadNotifications > 0 && (
                  <span className="absolute right-1 top-1 min-w-4 rounded-full bg-rust px-1 text-[9px] font-bold leading-4 text-cream">
                    {unreadNotifications > 9 ? "9+" : unreadNotifications}
                  </span>
                )}
              </Link>

              <Link href={`/profile/${user.id}`} className="flex items-center gap-2 rounded-sm px-1.5 py-1.5 hover:bg-black/10 sm:px-2">
                <Avatar name={user.name} size={30} />
                <span className="hidden text-left leading-tight xl:block">
                  <span className="block text-xs font-bold text-cream">{user.name}</span>
                  <span className="block text-[10px] text-cream-soft">Niveau {level}</span>
                </span>
              </Link>
              {/* En dessous de `xl` la déconnexion se réduit à son icône : le
                  libellé coûte ~100 px et faisait déborder l'en-tête. */}
              <form action={logoutAction}>
                <button
                  type="submit"
                  aria-label="Déconnexion"
                  className="flex size-9 items-center justify-center rounded-sm text-cream-soft transition-colors hover:bg-black/10 hover:text-cream xl:hidden"
                >
                  <LogOut className="size-4" />
                </button>
                <Button type="submit" variant="ghost" size="sm" className="hidden text-cream-soft hover:text-cream xl:inline-flex">
                  Déconnexion
                </Button>
              </form>
            </div>
          </>
        ) : (
          <nav className="ml-auto flex flex-none items-center gap-1 sm:gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-cream-soft hover:text-cream">
                Connexion
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm">
                <span className="sm:hidden">S&apos;inscrire</span>
                <span className="hidden sm:inline">Créer un compte</span>
              </Button>
            </Link>
          </nav>
        )}
      </div>
      {user && (
        // Onglets mobiles : une grille de six colonnes, icône au-dessus du
        // libellé court, pour rester lisible et tactile sans défilement.
        <nav className="grid grid-cols-6 border-t border-black/10 lg:hidden">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const badge = item.badgeKey === "trades" ? pendingTrades : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative flex min-w-0 flex-col items-center gap-1 px-0.5 py-2 text-[10px] font-semibold text-cream-soft transition-colors hover:bg-black/10 hover:text-cream"
              >
                <Icon className="size-[18px] flex-none" />
                <span className="w-full truncate text-center leading-none">{item.short}</span>
                {badge > 0 && (
                  <span className="absolute right-1.5 top-1 rounded-full bg-rust px-1 text-[9px] font-bold leading-4 text-cream">
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
