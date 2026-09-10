import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { markAllNotificationsReadAction, openNotificationAction } from "@/lib/actions/notifications";
import { Badge, Button, Card } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { getT, getLocale } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

/** Regroupe les huit natures de notification en quatre familles affichables. */
const KIND_FAMILY: Record<string, string> = {
  TRADE_PROPOSED: "trade",
  TRADE_ACCEPTED: "trade",
  TRADE_REJECTED: "trade",
  TRADE_COMPLETED: "trade",
  MESSAGE_RECEIVED: "message",
  EVENT_JOINED: "event",
  EVENT_CANCELLED: "event",
  REVIEW_RECEIVED: "review",
};

/** Les variables sont stockées en JSON : on les remet en forme pour `t()`. */
function params(valeur: unknown): Record<string, string | number> {
  return valeur && typeof valeur === "object" ? (valeur as Record<string, string | number>) : {};
}

export default async function NotificationsPage() {
  const t = await getT();
  const locale = await getLocale();
  const user = await requireUser();

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 60,
  });
  const nonLues = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-gold">{t("notifications.eyebrow")}</div>
          <h1 className="mt-1 font-display text-3xl text-cream sm:text-4xl">{t("notifications.title")}</h1>
          <p className="mt-2 text-sm text-ink-soft">
            {nonLues > 0 ? t("notifications.unread", { count: nonLues }) : t("notifications.upToDate")}
          </p>
        </div>
        {nonLues > 0 && (
          <form action={markAllNotificationsReadAction}>
            <Button type="submit" variant="secondary" size="sm">{t("notifications.markAll")}</Button>
          </form>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card className="mt-8 p-8 text-center text-sm text-ink-soft">
          {t("notifications.empty")}
        </Card>
      ) : (
        <div className="mt-8 flex flex-col gap-2">
          {notifications.map((n) => (
            <form key={n.id} action={openNotificationAction.bind(null, n.id)}>
              <button
                type="submit"
                className={cn(
                  "w-full rounded-sm border p-4 text-left transition-colors hover:border-gold/60",
                  n.readAt ? "border-border bg-surface" : "border-gold/40 bg-gold/10",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={n.readAt ? "default" : "primary"}>{t(`notifications.kind.${KIND_FAMILY[n.kind] ?? "trade"}`)}</Badge>
                      <span className="text-xs text-ink-soft">{timeAgo(n.createdAt, locale, t)}</span>
                    </div>
                    <div className="mt-1.5 font-semibold text-cream">{t(n.title, params(n.params))}</div>
                    {n.body && <p className="mt-1 text-sm text-ink-soft">{t(n.body, params(n.params))}</p>}
                  </div>
                  <span aria-hidden="true" className="flex-none text-gold">→</span>
                </div>
              </button>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}
