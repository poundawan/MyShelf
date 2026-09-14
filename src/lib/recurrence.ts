/**
 * Cadence des tables récurrentes.
 *
 * Une série ne stocke que sa fréquence et sa date de fin ; ce fichier en
 * déduit les dates de chaque séance. Aucune magie côté base : les séances sont
 * calculées une fois, à la création, et deviennent de vraies tables. Rien ne
 * s'engendre ensuite dans le dos de l'organisateur.
 */

export const FREQUENCES = ["WEEKLY", "BIWEEKLY", "MONTHLY"] as const;
export type Frequence = (typeof FREQUENCES)[number];

/**
 * Nombre maximal de séances par série.
 *
 * Une table hebdomadaire sur un an en produit cinquante-trois : la borne est
 * posée juste au-dessus. Elle existe pour qu'une date de fin saisie de travers
 * — « jusqu'en 2050 » — ne remplisse pas la base de dizaines de milliers de
 * lignes que personne n'a demandées.
 */
export const MAX_SEANCES = 60;

/** Intervalle en jours, pour les cadences qui se comptent en jours. */
const JOURS: Partial<Record<Frequence, number>> = { WEEKLY: 7, BIWEEKLY: 14 };

/**
 * Dates des séances qui suivent la première, jusqu'à `jusquA` inclus.
 *
 * La première séance n'est pas renvoyée : c'est celle que l'organisateur vient
 * de saisir, elle existe déjà.
 *
 * Le cas mensuel se calcule toujours depuis la date d'origine, jamais de
 * proche en proche : additionner « un mois » douze fois de suite à partir du
 * 31 janvier ferait dériver la série vers le 28, puis le 28 définitivement.
 * Quand le mois visé est trop court, on retient son dernier jour et le mois
 * suivant retrouve le bon quantième.
 */
export function seancesSuivantes(debut: Date, frequence: Frequence, jusquA: Date): Date[] {
  const dates: Date[] = [];
  const jours = JOURS[frequence];

  for (let rang = 1; dates.length < MAX_SEANCES; rang++) {
    const date = jours ? decalerDeJours(debut, jours * rang) : decalerDeMois(debut, rang);
    if (date.getTime() > jusquA.getTime()) break;
    dates.push(date);
  }
  return dates;
}

/**
 * Nombre total de séances d'une série, la première comprise.
 *
 * Sert à refuser une date de fin déraisonnable avant d'écrire quoi que ce
 * soit, et à l'annoncer à l'organisateur.
 */
export function compterSeances(debut: Date, frequence: Frequence, jusquA: Date): number {
  return 1 + seancesSuivantes(debut, frequence, jusquA).length;
}

function decalerDeJours(depart: Date, jours: number): Date {
  const date = new Date(depart);
  date.setDate(date.getDate() + jours);
  return date;
}

function decalerDeMois(depart: Date, mois: number): Date {
  const quantieme = depart.getDate();
  const date = new Date(depart);
  // Le 1er du mois d'abord : sans cela, passer de janvier à février sur un
  // quantième trop grand ferait basculer `setMonth` dans le mois d'après.
  date.setDate(1);
  date.setMonth(date.getMonth() + mois);
  date.setDate(Math.min(quantieme, dernierJourDuMois(date)));
  return date;
}

function dernierJourDuMois(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/**
 * Ne garde qu'une séance par série : la première de la liste.
 *
 * Sans cela, une table hebdomadaire occuperait à elle seule une page entière
 * de résultats, en répétant cinquante fois le même intitulé. On montre la
 * prochaine, en signalant qu'elle revient ; les suivantes s'atteignent depuis
 * sa fiche.
 *
 * La liste doit être triée par date croissante pour que la séance retenue soit
 * bien la prochaine.
 */
export function replierSeries<T extends { seriesId: string | null }>(tables: T[]): T[] {
  const vues = new Set<string>();
  return tables.filter((table) => {
    if (!table.seriesId) return true;
    if (vues.has(table.seriesId)) return false;
    vues.add(table.seriesId);
    return true;
  });
}
