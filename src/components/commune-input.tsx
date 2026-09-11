"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Input, Label } from "@/components/ui";
import { rechercherCommunesAction, type CommuneTrouvee } from "@/lib/actions/communes";
import { useT } from "@/lib/i18n/client";

/**
 * Choix d'une commune, par son nom ou son code postal.
 *
 * Le champ visible reste du texte libre : on n'empêche personne d'écrire ce
 * qu'il veut. Mais tant qu'aucune commune n'est choisie, `communeCode` reste
 * vide, et l'application le sait — elle n'affichera simplement aucune distance
 * plutôt que d'en inventer une.
 */
export function CommuneInput({
  name = "city",
  label,
  defaultValue = "",
  defaultCode = null,
  required,
  onChange,
}: {
  /** Nom du champ texte. Le code INSEE part sous `${name}Code`. */
  name?: string;
  label: string;
  defaultValue?: string;
  defaultCode?: string | null;
  required?: boolean;
  /** Prévenu à chaque changement, pour les aperçus qui suivent la saisie. */
  onChange?: (nom: string, code: string | null) => void;
}) {
  const t = useT();
  const listeId = useId();
  const [saisie, setSaisie] = useState(defaultValue);
  const [code, setCode] = useState<string | null>(defaultCode);
  const [resultats, setResultats] = useState<CommuneTrouvee[]>([]);
  // Vrai quand les suggestions viennent du référentiel embarqué parce que le
  // service d'adresses n'a pas répondu. À dire : sinon une panne durable
  // passerait pour un classement médiocre.
  const [horsLigne, setHorsLigne] = useState(false);
  const [referentielVide, setReferentielVide] = useState(false);
  const [ouvert, setOuvert] = useState(false);
  const [surligne, setSurligne] = useState(-1);
  const conteneur = useRef<HTMLDivElement>(null);

  // La recherche ne part pas à chaque frappe : on laisse le temps de finir un
  // mot, sinon « villeurbanne » déclencherait douze requêtes.
  useEffect(() => {
    const terme = saisie.trim();
    let abandonne = false;
    const minuterie = setTimeout(async () => {
      if (terme.length < 2) {
        setResultats([]);
        setHorsLigne(false);
        setReferentielVide(false);
        return;
      }
      try {
        const reponse = await rechercherCommunesAction(terme);
        if (abandonne) return;
        setResultats(reponse.communes);
        setHorsLigne(reponse.source === "secours");
        setReferentielVide(reponse.source === "referentielVide");
      } catch {
        // Le champ reste utilisable en saisie libre : ne rien afficher vaut
        // mieux qu'un message d'erreur sur une aide à la saisie.
        if (!abandonne) {
          setResultats([]);
          setHorsLigne(false);
        }
      }
    }, 220);
    return () => {
      abandonne = true;
      clearTimeout(minuterie);
    };
  }, [saisie]);

  // Un clic ailleurs ferme la liste : sans cela elle resterait ouverte
  // par-dessus le reste du formulaire.
  useEffect(() => {
    function auClic(evenement: MouseEvent) {
      if (!conteneur.current?.contains(evenement.target as Node)) setOuvert(false);
    }
    document.addEventListener("mousedown", auClic);
    return () => document.removeEventListener("mousedown", auClic);
  }, []);

  function choisir(commune: CommuneTrouvee) {
    setSaisie(commune.nom);
    setCode(commune.code);
    setOuvert(false);
    setSurligne(-1);
    onChange?.(commune.nom, commune.code);
  }

  function auClavier(evenement: React.KeyboardEvent<HTMLInputElement>) {
    if (!ouvert || resultats.length === 0) return;
    if (evenement.key === "ArrowDown" || evenement.key === "ArrowUp") {
      evenement.preventDefault();
      const pas = evenement.key === "ArrowDown" ? 1 : -1;
      setSurligne((n) => (n + pas + resultats.length) % resultats.length);
    } else if (evenement.key === "Enter" && surligne >= 0) {
      // Entrée valide la suggestion, elle ne soumet pas le formulaire.
      evenement.preventDefault();
      choisir(resultats[surligne]);
    } else if (evenement.key === "Escape") {
      setOuvert(false);
    }
  }

  return (
    <div ref={conteneur} className="relative">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        value={saisie}
        onChange={(e) => {
          setSaisie(e.target.value);
          // Retaper détache la commune choisie : le texte et le code ne
          // doivent jamais désigner deux endroits différents.
          setCode(null);
          setOuvert(true);
          setSurligne(-1);
          onChange?.(e.target.value, null);
        }}
        onFocus={() => setOuvert(true)}
        onKeyDown={auClavier}
        placeholder={t("commune.placeholder")}
        autoComplete="off"
        role="combobox"
        aria-expanded={ouvert && resultats.length > 0}
        aria-controls={listeId}
        aria-autocomplete="list"
        aria-activedescendant={surligne >= 0 ? `${listeId}-${surligne}` : undefined}
        required={required}
      />
      <input type="hidden" name={`${name}Code`} value={code ?? ""} />

      {ouvert && resultats.length > 0 && (
        <ul
          id={listeId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-sm border border-border-strong bg-surface shadow-lg"
        >
          {/* Pas de <button> à l'intérieur : une option de liste ne contient
              pas de commande. Le clavier passe par le champ, qui désigne
              l'option courante avec aria-activedescendant. */}
          {resultats.map((commune, i) => (
            <li
              key={commune.code}
              id={`${listeId}-${i}`}
              role="option"
              aria-selected={i === surligne}
              onMouseEnter={() => setSurligne(i)}
              onMouseDown={(e) => {
                // `mousedown` plutôt que `click` : le champ perdrait le focus
                // avant que le clic n'aboutisse, et la liste se refermerait.
                e.preventDefault();
                choisir(commune);
              }}
              className={`flex cursor-pointer items-baseline justify-between gap-3 px-3 py-2 text-sm ${
                i === surligne ? "bg-wood/40 text-cream" : "text-ink"
              }`}
            >
              <span className="truncate">{commune.nom}</span>
              <span className="flex-none text-xs text-ink-soft">
                {commune.codePostal ?? commune.departement}
              </span>
            </li>
          ))}
        </ul>
      )}

      {referentielVide && <p className="mt-1.5 text-xs text-rust">{t("commune.missingData")}</p>}

      {horsLigne && resultats.length > 0 && (
        <p className="mt-1.5 text-xs text-ink-soft">{t("commune.offline")}</p>
      )}

      {!code && saisie.trim().length > 0 && (
        <p className="mt-1.5 text-xs text-ink-soft">{t("commune.notChosen")}</p>
      )}
    </div>
  );
}
