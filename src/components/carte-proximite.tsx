"use client";

import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import { useT } from "@/lib/i18n/client";
import { TUILES_ATTRIBUTION, TUILES_URL } from "@/lib/carte";

/**
 * Un point à placer. Les coordonnées sont celles du CENTRE DE LA COMMUNE,
 * jamais d'une adresse : c'est la même règle que pour les distances, et pour
 * la même raison — trois relevés précis suffisent à retrouver un domicile.
 */
export type PointCarte = {
  id: string;
  titre: string;
  sousTitre: string;
  href: string;
  latitude: number;
  longitude: number;
};

/** Au-delà, on considère que les tuiles ne viendront pas. */
const DELAI_TUILES_MS = 6000;

/**
 * Carte des tables autour de soi.
 *
 * Trois partis pris.
 *
 * Leaflet n'est chargé qu'une fois le composant monté, par un `import()` dans
 * l'effet : la bibliothèque touche au DOM dès son évaluation, et la page est
 * pré-rendue côté serveur.
 *
 * Les marqueurs sont des `divIcon`, pas les icônes par défaut. Celles-ci sont
 * des fichiers PNG que Leaflet réclame à une adresse devinée, laquelle ne
 * survit pas à un empaquetage : on obtient trois 404 par carte. Du HTML en
 * ligne n'a pas ce défaut et s'accorde au reste de l'interface.
 *
 * Si aucune tuile n'arrive, la carte s'efface et le dit. Un fond gris muet
 * laisserait croire à une région vide alors que c'est le fournisseur qui
 * manque — et la liste en dessous, elle, reste juste.
 */
export function CarteProximite({
  points,
  origine,
  hauteur = "h-64",
}: {
  points: PointCarte[];
  origine: { latitude: number; longitude: number } | null;
  hauteur?: string;
}) {
  const t = useT();
  const conteneur = useRef<HTMLDivElement>(null);
  const [tuilesAbsentes, setTuilesAbsentes] = useState(false);

  useEffect(() => {
    if (!conteneur.current || points.length === 0) return;

    let carte: Leaflet.Map | undefined;
    let vivant = true;
    let minuterie: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      const L = await import("leaflet");
      if (!vivant || !conteneur.current) return;

      carte = L.map(conteneur.current, {
        // La molette défile la page : sur une carte insérée dans un tableau de
        // bord, zoomer par mégarde en faisant défiler est franchement pénible.
        scrollWheelZoom: false,
        attributionControl: true,
      });

      const couche = L.tileLayer(TUILES_URL, {
        attribution: TUILES_ATTRIBUTION,
        maxZoom: 18,
      });

      let tuilesRecues = 0;
      couche.on("tileload", () => { tuilesRecues++; });
      couche.addTo(carte);

      minuterie = setTimeout(() => {
        if (vivant && tuilesRecues === 0) setTuilesAbsentes(true);
      }, DELAI_TUILES_MS);

      const marqueurs: Leaflet.Marker[] = points.map((point) =>
        L.marker([point.latitude, point.longitude], {
          title: point.titre,
          icon: L.divIcon({
            className: "",
            html: `<span class="block size-3 rotate-45 border-2 border-[#1c3b2e] bg-[#d9a520]"></span>`,
            iconSize: [12, 12],
            iconAnchor: [6, 6],
          }),
        }).bindPopup(
          `<a href="${echapper(point.href)}" class="block no-underline">
             <strong class="block text-[13px]">${echapper(point.titre)}</strong>
             <span class="text-[11px]">${echapper(point.sousTitre)}</span>
           </a>`,
        ),
      );
      for (const marqueur of marqueurs) marqueur.addTo(carte);

      if (origine) {
        L.circleMarker([origine.latitude, origine.longitude], {
          radius: 6, color: "#b4552d", weight: 2, fillColor: "#b4552d", fillOpacity: 0.5,
        })
          .bindPopup(t("carte.toi"))
          .addTo(carte);
      }

      // Le cadrage englobe les points et, s'il y en a une, sa propre position :
      // se voir hors champ ne dit rien de la distance.
      const aEnglober: Leaflet.LatLngExpression[] = points.map((p) => [p.latitude, p.longitude]);
      if (origine) aEnglober.push([origine.latitude, origine.longitude]);
      carte.fitBounds(L.latLngBounds(aEnglober), { padding: [28, 28], maxZoom: 13 });
    })();

    return () => {
      vivant = false;
      if (minuterie) clearTimeout(minuterie);
      carte?.remove();
    };
  }, [points, origine, t]);

  if (points.length === 0) return null;

  if (tuilesAbsentes) {
    return (
      <p className="mt-3 rounded-sm border border-border-strong bg-surface-2 p-3 text-xs text-ink-soft">
        {t("carte.indisponible")}
      </p>
    );
  }

  return (
    <div
      ref={conteneur}
      role="region"
      aria-label={t("carte.libelle")}
      className={`mt-3 w-full overflow-hidden rounded-sm border border-border-strong ${hauteur}`}
    />
  );
}

/** Les titres viennent des membres : ils n'entrent pas bruts dans du HTML. */
function echapper(texte: string) {
  return texte
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
