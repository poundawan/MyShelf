"use client";

import { useActionState, useState } from "react";
import { proposeGameTradeAction } from "@/lib/actions/trades";
import { Button, Textarea, ErrorText } from "@/components/ui";
import { gameCategoryEmoji } from "@/lib/labels";
import { cn } from "@/lib/utils";

type MyCopy = { id: string; game: { title: string; category: string } };

export function TradeWizard({ targetCopyId, targetOwnerName, myCopies }: { targetCopyId: string; targetOwnerName: string; myCopies: MyCopy[] }) {
  const [state, formAction, pending] = useActionState(proposeGameTradeAction, undefined);
  const [step, setStep] = useState<"items" | "message">("items");
  const [selected, setSelected] = useState<string[]>([]);

  const steps = [
    { key: "items", label: "1 Ton jeu" },
    { key: "message", label: "2 Ton message" },
    { key: "sent", label: "3 Envoyé" },
  ] as const;

  return (
    <div>
      <div className="flex gap-2">
        {steps.map((s) => (
          <div
            key={s.key}
            className={cn(
              "rounded-sm border px-3 py-1.5 text-xs font-bold uppercase tracking-wide",
              s.key === step ? "border-gold bg-gold text-gold-ink" : "border-border-strong text-ink-soft",
            )}
          >
            {s.label}
          </div>
        ))}
      </div>

      {step === "items" && (
        <div className="mt-6">
          <h2 className="font-display text-xl text-cream">Qu&apos;est-ce que tu mets sur la table ?</h2>
          {myCopies.length === 0 ? (
            <p className="mt-4 text-sm text-ink-soft">
              Tu n&apos;as pas encore de jeu disponible. Ajoutes-en un depuis ton étagère.
            </p>
          ) : (
            <>
              <div className="mt-4 flex flex-wrap gap-3">
                {myCopies.map((c) => {
                  const isSelected = selected.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() =>
                        setSelected((prev) => (isSelected ? prev.filter((id) => id !== c.id) : [...prev, c.id]))
                      }
                      className={cn(
                        "flex items-center gap-3 rounded-sm border p-3 text-left text-sm transition-colors",
                        isSelected ? "border-gold bg-gold/10" : "border-border-strong hover:border-gold/60",
                      )}
                    >
                      <span className="flex size-9 items-center justify-center bg-surface-2 text-lg">
                        {gameCategoryEmoji[c.game.category]}
                      </span>
                      <span className="text-cream">{c.game.title}</span>
                    </button>
                  );
                })}
              </div>
              <Button type="button" className="mt-6" disabled={selected.length === 0} onClick={() => setStep("message")}>
                Continuer
              </Button>
            </>
          )}
        </div>
      )}

      {step === "message" && (
        <form action={formAction} className="mt-6">
          <input type="hidden" name="targetCopyId" value={targetCopyId} />
          {selected.map((id) => (
            <input key={id} type="hidden" name="offeredCopyIds" value={id} />
          ))}
          <h2 className="font-display text-xl text-cream">Un mot pour {targetOwnerName}</h2>
          <Textarea
            name="message"
            rows={4}
            className="mt-4"
            placeholder={`Salut ! Voilà ce que je te propose en échange...`}
          />
          <ErrorText>{state?.error}</ErrorText>
          <div className="mt-4 flex gap-3">
            <Button type="button" variant="secondary" onClick={() => setStep("items")}>
              ← Retour
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Envoi..." : "Envoyer la proposition"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
