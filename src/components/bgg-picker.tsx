"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Button, Card, Input, Label } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import { PoweredByBgg } from "@/components/powered-by-bgg";
import { rechercherBggAction } from "@/lib/actions/bgg";
import type { JeuBgg } from "@/lib/bgg";

/**
 * Recherche dans le catalogue BoardGameGeek pour pré-remplir la fiche d'un jeu.
 *
 * Ce n'est qu'un raccourci : tous les champs restent modifiables ensuite, et le
 * formulaire fonctionne entièrement à la main si BGG ne répond pas.
 */
export function BggPicker({ onChoisir }: { onChoisir: (jeu: JeuBgg) => void }) {
  const t = useT();
  const [terme, setTerme] = useState("");
  const [resultats, setResultats] = useState<JeuBgg[] | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function chercher() {
    const q = terme.trim();
    if (q.length < 2) return;
    setEnCours(true);
    setMessage(null);
    try {
      const donnees = await rechercherBggAction(q);

      // Trois issues, trois messages. Présenter une panne comme une absence de
      // résultat enverrait chercher ailleurs un jeu qui existe ; présenter une
      // session perdue comme une panne de BoardGameGeek ferait accuser un
      // service tiers à notre place.
      if (donnees.statut === "session") {
        setResultats(null);
        setMessage(t("bgg.session"));
        return;
      }

      if (donnees.statut === "nonConfigure") {
        setResultats(null);
        setMessage(t("bgg.notConfigured"));
        return;
      }

      if (donnees.statut === "jetonRefuse") {
        setResultats(null);
        setMessage(t("bgg.tokenRejected"));
        return;
      }

      if (donnees.statut === "injoignable") {
        setResultats(null);
        setMessage(`${t("bgg.unreachable")}${donnees.detail ? ` (${donnees.detail})` : ""}`);
        return;
      }

      setResultats(donnees.jeux);
      if (donnees.jeux.length === 0) setMessage(t("bgg.empty"));
    } catch (erreur) {
      // L'action elle-même n'a pas abouti : réseau coupé, ou requête refusée
      // avant même d'atteindre l'application.
      setResultats(null);
      const detail = erreur instanceof Error ? erreur.message : "";
      setMessage(`${t("bgg.failed")}${detail ? ` (${detail})` : ""}`);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Card className="border-wood bg-wood/20 p-4">
      <Label htmlFor="bgg-query">{t("bgg.label")}</Label>
      <div className="flex flex-wrap gap-2">
        <Input
          id="bgg-query"
          value={terme}
          onChange={(e) => setTerme(e.target.value)}
          onKeyDown={(e) => {
            // Entrée dans ce champ doit lancer la recherche, pas soumettre
            // le formulaire d'ajout qui l'entoure.
            if (e.key === "Enter") {
              e.preventDefault();
              void chercher();
            }
          }}
          placeholder={t("bgg.placeholder")}
          className="min-w-0 flex-1"
        />
        <Button type="button" variant="secondary" onClick={() => void chercher()} disabled={enCours || terme.trim().length < 2}>
          <Search size={15} aria-hidden="true" />
          {enCours ? t("bgg.searching") : t("bgg.search")}
        </Button>
      </div>

      {message && <p className="mt-2 text-sm text-ink-soft">{message}</p>}

      {resultats && resultats.length > 0 && (
        <ul className="mt-3 flex max-h-72 flex-col gap-1.5 overflow-y-auto">
          {resultats.map((jeu) => (
            <li key={jeu.bggId}>
              <button
                type="button"
                onClick={() => {
                  onChoisir(jeu);
                  setResultats(null);
                  setMessage(t("bgg.picked", { title: jeu.title }));
                }}
                className="flex w-full items-center gap-3 rounded-sm border border-border bg-surface p-2 text-left hover:border-gold"
              >
                <span className="flex h-12 w-12 flex-none items-center justify-center overflow-hidden rounded-sm bg-surface-2">
                  {jeu.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={jeu.thumbnail} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span aria-hidden="true">🎲</span>
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-cream">{jeu.title}</span>
                  <span className="block text-xs text-ink-soft">
                    {[
                      jeu.year,
                      jeu.minPlayers && jeu.maxPlayers ? `${jeu.minPlayers}–${jeu.maxPlayers} ${t("bgg.players")}` : null,
                      jeu.durationMin ? `${jeu.durationMin} min` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <PoweredByBgg className="mt-3" />
    </Card>
  );
}
