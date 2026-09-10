"use client";

import { useRef, useState } from "react";
import { Label } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import { ACCEPT_ATTR, COTE_MAX_PX, TAILLE_MAX_OCTETS } from "@/lib/photos-constants";
import { cn } from "@/lib/utils";

/**
 * Champ d'envoi de photo, partagé par l'avatar, la salle d'une table et la
 * jaquette d'un jeu.
 *
 * L'input fichier est un vrai `<input type="file">` : sans JavaScript, le
 * formulaire envoie quand même le fichier d'origine, et le serveur applique
 * son propre plafond. Le JavaScript n'ajoute que du confort — l'aperçu — et
 * une réduction de l'image avant l'envoi, qui évite de faire monter 8 Mo de
 * photo de téléphone pour un avatar de 96 pixels.
 */
export function PhotoInput({
  name,
  label,
  currentUrl,
  ratio = "aspect-[4/3]",
}: {
  name: string;
  label: string;
  /** Photo déjà enregistrée, s'il y en a une. */
  currentUrl?: string | null;
  ratio?: string;
}) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [apercu, setApercu] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [retiree, setRetiree] = useState(false);
  const [enCours, setEnCours] = useState(false);

  const affichee = apercu ?? (retiree ? null : currentUrl ?? null);

  async function choisir(event: React.ChangeEvent<HTMLInputElement>) {
    const fichier = event.target.files?.[0];
    setErreur(null);
    if (!fichier) {
      setApercu(null);
      return;
    }

    if (!ACCEPT_ATTR.split(",").includes(fichier.type)) {
      setErreur(t("photo.error.type"));
      event.target.value = "";
      setApercu(null);
      return;
    }

    setEnCours(true);
    try {
      const reduit = await reduire(fichier);
      if (reduit && input.current) {
        // On remplace le contenu de l'input pour que la soumission normale du
        // formulaire emporte la version réduite, sans champ caché ni base64.
        const transfert = new DataTransfer();
        transfert.items.add(reduit);
        input.current.files = transfert.files;
      }
      const retenu = reduit ?? fichier;
      if (retenu.size > TAILLE_MAX_OCTETS) {
        setErreur(t("photo.error.tooLarge"));
        event.target.value = "";
        setApercu(null);
        return;
      }
      setApercu((precedent) => {
        if (precedent) URL.revokeObjectURL(precedent);
        return URL.createObjectURL(retenu);
      });
      setRetiree(false);
    } catch {
      // Un canvas qui échoue (image corrompue, mémoire) ne doit pas bloquer
      // l'envoi : on garde le fichier d'origine, le serveur tranchera.
      setApercu(URL.createObjectURL(fichier));
      setRetiree(false);
    } finally {
      setEnCours(false);
    }
  }

  function retirer() {
    if (apercu) URL.revokeObjectURL(apercu);
    setApercu(null);
    setErreur(null);
    setRetiree(true);
    if (input.current) input.current.value = "";
  }

  return (
    <div>
      <Label htmlFor={name}>{label}</Label>

      {affichee && (
        <div className={cn("mb-3 w-full max-w-xs overflow-hidden rounded-sm border border-border bg-surface-2", ratio)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={affichee} alt={t("photo.previewAlt")} className="h-full w-full object-cover" />
        </div>
      )}

      <input
        ref={input}
        id={name}
        name={name}
        type="file"
        accept={ACCEPT_ATTR}
        onChange={choisir}
        className="block w-full text-sm text-ink-soft file:mr-3 file:cursor-pointer file:rounded-sm file:border-0 file:bg-gold file:px-3.5 file:py-2 file:text-xs file:font-bold file:tracking-wide file:text-gold-ink hover:file:bg-[#F0B94F]"
      />

      {/* Lu par l'action serveur : distingue « je n'ai rien changé » de
          « j'enlève la photo existante ». */}
      <input type="hidden" name={`${name}Remove`} value={retiree ? "1" : ""} />

      <p className="mt-1.5 text-xs text-ink-soft">
        {enCours ? t("photo.hint.processing") : t("photo.hint", { taille: Math.round(TAILLE_MAX_OCTETS / (1024 * 1024)) })}
      </p>

      {affichee && !enCours && (
        <button type="button" onClick={retirer} className="mt-1.5 text-xs font-bold text-rust underline">
          {t("photo.remove")}
        </button>
      )}

      {erreur && <p className="mt-2 text-sm text-rust">{erreur}</p>}
    </div>
  );
}

/**
 * Réduit l'image au plus long côté autorisé et la ré-encode en WebP.
 *
 * Renvoie `null` si le navigateur ne sait pas faire (pas de canvas, pas de
 * `createImageBitmap`) ou si l'image est déjà petite : l'appelant garde alors
 * le fichier tel quel.
 */
async function reduire(fichier: File): Promise<File | null> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return null;

  const bitmap = await createImageBitmap(fichier);
  const facteur = Math.min(1, COTE_MAX_PX / Math.max(bitmap.width, bitmap.height));

  // Déjà dans les clous et raisonnablement légère : inutile de la ré-encoder,
  // on perdrait de la qualité pour rien.
  if (facteur === 1 && fichier.size <= 600 * 1024) {
    bitmap.close();
    return null;
  }

  const largeur = Math.max(1, Math.round(bitmap.width * facteur));
  const hauteur = Math.max(1, Math.round(bitmap.height * facteur));

  const canvas = document.createElement("canvas");
  canvas.width = largeur;
  canvas.height = hauteur;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return null;
  }
  ctx.drawImage(bitmap, 0, 0, largeur, hauteur);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
  if (!blob) return null;

  return new File([blob], remplacerExtension(fichier.name), { type: "image/webp" });
}

function remplacerExtension(nom: string) {
  const base = nom.replace(/\.[^./\\]+$/, "");
  return `${base || "photo"}.webp`;
}
