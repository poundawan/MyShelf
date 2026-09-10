"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Button, Card, Input, Label } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import type { JeuBgg, ResultatRecherche } from "@/lib/bgg";

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
      const reponse = await fetch(`/api/bgg/search?q=${encodeURIComponent(q)}`);
      if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
      const donnees: ResultatRecherche = await reponse.json();

      if (donnees.statut === "injoignable") {
        // Ne jamais présenter une panne comme une absence de résultat : on
        // enverrait chercher ailleurs un jeu qui existe.
        setResultats(null);
        setMessage(`${t("bgg.unreachable")}${donnees.detail ? ` (${donnees.detail})` : ""}`);
        return;
      }

      setResultats(donnees.jeux);
      if (donnees.jeux.length === 0) setMessage(t("bgg.empty"));
    } catch (erreur) {
      setResultats(null);
      const detail = erreur instanceof Error ? erreur.message : "";
      setMessage(`${t("bgg.unreachable")}${detail ? ` (${detail})` : ""}`);
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

      <p className="mt-3 text-xs text-ink-soft">{t("bgg.credit")}</p>
    </Card>
  );
}
