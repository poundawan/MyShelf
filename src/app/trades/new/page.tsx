import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { TradeWizard } from "@/components/trade-wizard";

export default async function NewTradePage({ searchParams }: { searchParams: Promise<{ copyId?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { copyId } = await searchParams;
  if (!copyId) notFound();

  const targetCopy = await prisma.gameCopy.findUnique({ where: { id: copyId }, include: { game: true, owner: true } });
  if (!targetCopy || targetCopy.status !== "ON_TABLE" || targetCopy.ownerId === user.id) notFound();

  const myCopies = await prisma.gameCopy.findMany({
    where: { ownerId: user.id, status: "ON_TABLE" },
    include: { game: { select: { title: true, category: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="text-xs font-bold uppercase tracking-widest text-gold">Négociation en cours</div>
      <h1 className="mt-1 font-display text-3xl text-cream sm:text-4xl">Échange avec {targetCopy.owner.name}</h1>
      <p className="mt-2 text-ink-soft">
        Pour <span className="text-cream">{targetCopy.game.title}</span>. Face à face, vous fixez le lieu ensemble.
      </p>

      <div className="mt-8">
        <TradeWizard targetCopyId={targetCopy.id} targetOwnerName={targetCopy.owner.name} myCopies={myCopies} />
      </div>
    </div>
  );
}
