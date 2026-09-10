import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { markAllNotificationsReadAction, openNotificationAction } from "@/lib/actions/notifications";
import { Badge, Button, Card } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

const KIND_LABELS: Record<string, string> = {
  TRADE_PROPOSED: "Échange",
  TRADE_ACCEPTED: "Échange",
  TRADE_REJECTED: "Échange",
  TRADE_COMPLETED: "Échange",
  MESSAGE_RECEIVED: "Message",
  EVENT_JOINED: "Table",
  EVENT_CANCELLED: "Table",
  REVIEW_RECEIVED: "Avis",
};

export default async function NotificationsPage() {
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
          <div className="text-xs font-bold uppercase tracking-widest text-gold">Ce qui t&apos;attend</div>
          <h1 className="mt-1 font-display text-3xl text-cream sm:text-4xl">Notifications</h1>
          <p className="mt-2 text-sm text-ink-soft">
            {nonLues > 0
              ? `${nonLues} nouvelle${nonLues > 1 ? "s" : ""} depuis ton dernier passage.`
              : "Tu es à jour."}
          </p>
        </div>
        {nonLues > 0 && (
          <form action={markAllNotificationsReadAction}>
            <Button type="submit" variant="secondary" size="sm">Tout marquer comme lu</Button>
          </form>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card className="mt-8 p-8 text-center text-sm text-ink-soft">
          Rien pour l&apos;instant. On te préviendra ici quand quelqu&apos;un te proposera un
          échange, t&apos;écrira ou rejoindra ta table.
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
                      <Badge variant={n.readAt ? "default" : "primary"}>{KIND_LABELS[n.kind] ?? "Info"}</Badge>
                      <span className="text-xs text-ink-soft">{timeAgo(n.createdAt)}</span>
                    </div>
                    <div className="mt-1.5 font-semibold text-cream">{n.title}</div>
                    {n.body && <p className="mt-1 text-sm text-ink-soft">{n.body}</p>}
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
