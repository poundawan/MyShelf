import { test, expect, type Page } from "@playwright/test";
import { login, rows, one, datetimeLocal } from "./helpers";
import { MAX_SEANCES, compterSeances, seancesSuivantes, replierSeries } from "../src/lib/recurrence";

/**
 * Tables récurrentes : cadence, séances engendrées, repli dans les listes.
 *
 * Le pari du modèle est que chaque séance est une vraie table — avec ses
 * propres inscrits. Ces tests vérifient surtout cela : que la série ne soit
 * pas un simple libellé posé sur une table unique, et qu'elle n'inonde pas
 * l'écran non plus.
 */

type Seance = { id: string; startAt: Date; endAt: Date | null; status: string; location: string | null; title: string };

const seancesDe = (serieId: string) =>
  rows<Seance>(
    'SELECT id, "startAt", "endAt", status, location, title FROM "Event" WHERE "seriesId" = $1 ORDER BY "startAt" ASC',
    [serieId],
  );

/** Date au format attendu par un `<input type="date">`. */
function dateInput(daysFromNow: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const JOUR_MS = 24 * 3600 * 1000;

test.describe("Cadence", () => {
  test("les séances hebdomadaires tombent tous les sept jours", () => {
    const debut = new Date(2026, 8, 17, 20, 0);
    const fin = new Date(2026, 9, 16, 23, 59);
    const suite = seancesSuivantes(debut, "WEEKLY", fin);

    expect(suite.map((d) => d.getDate())).toEqual([24, 1, 8, 15]);
    // L'heure ne dérive pas : une table de 20h reste une table de 20h.
    for (const date of suite) expect(date.getHours()).toBe(20);
  });

  test("une semaine sur deux saute bien une semaine", () => {
    const debut = new Date(2026, 8, 17, 20, 0);
    const suite = seancesSuivantes(debut, "BIWEEKLY", new Date(2026, 10, 1));
    expect(suite.map((d) => d.toDateString())).toEqual([
      new Date(2026, 9, 1, 20).toDateString(),
      new Date(2026, 9, 15, 20).toDateString(),
      new Date(2026, 9, 29, 20).toDateString(),
    ]);
  });

  test("le mensuel ne dérive pas sur les mois courts", () => {
    // Le 31 janvier : février n'a pas de 31. Une addition de proche en proche
    // rabattrait toute la série sur le 28 ; on attend le contraire.
    const debut = new Date(2026, 0, 31, 20, 0);
    const suite = seancesSuivantes(debut, "MONTHLY", new Date(2026, 4, 1));

    expect(suite.map((d) => `${d.getMonth()}-${d.getDate()}`)).toEqual([
      "1-28", // février, rabattu sur son dernier jour
      "2-31", // mars retrouve le bon quantième
      "3-30", // avril n'a que trente jours
    ]);
  });

  test("une date de fin déraisonnable est bornée", () => {
    const debut = new Date(2026, 0, 1, 20, 0);
    const dansDixAns = new Date(2036, 0, 1);
    expect(seancesSuivantes(debut, "WEEKLY", dansDixAns)).toHaveLength(MAX_SEANCES);
    expect(compterSeances(debut, "WEEKLY", dansDixAns)).toBeGreaterThan(MAX_SEANCES);
  });

  test("le repli ne confond pas les tables isolées entre elles", () => {
    // Le piège : `seriesId` vaut `null` pour toutes les tables ponctuelles.
    // Les regrouper par cette valeur n'en laisserait qu'une seule à l'écran.
    const tables = [
      { id: "a", seriesId: null },
      { id: "b", seriesId: "s1" },
      { id: "c", seriesId: null },
      { id: "d", seriesId: "s1" },
      { id: "e", seriesId: "s2" },
    ];
    expect(replierSeries(tables).map((t) => t.id)).toEqual(["a", "b", "c", "e"]);
  });
});

/** Ouvre une table récurrente et renvoie l'identifiant de sa série. */
async function ouvrirSerie(
  page: Page,
  { titre, cadence, jours = 60, lieu = "Comptoir des Halles" }:
    { titre: string; cadence: RegExp; jours?: number; lieu?: string },
) {
  await page.goto("/events/new");
  await page.fill("#title", titre);
  await page.fill("#city", "Lyon 7e");
  await page.getByRole("option", { name: /Lyon 7e/ }).first().click();
  await page.fill("#location", lieu);
  await page.fill("#startAt", datetimeLocal(7, 20));
  await page.getByRole("button", { name: cadence }).click();
  await page.fill("#untilAt", dateInput(jours));
  await page.getByRole("button", { name: /^(Publier|Publish)$/ }).click();
  await page.waitForURL(/\/events\/(?!new$)[a-z0-9]+$/);

  const table = await one<{ seriesId: string }>('SELECT "seriesId" FROM "Event" WHERE title = $1 LIMIT 1', [titre]);
  expect(table.seriesId, "la table devrait appartenir à une série").not.toBeNull();
  return table.seriesId;
}

test.describe("Tables récurrentes", () => {
  test("ouvrir une table hebdomadaire engendre toutes ses séances", async ({ page }) => {
    await login(page, "chloe");
    const titre = `Jeudis du Comptoir ${Date.now()}`;
    const serieId = await ouvrirSerie(page, { titre, cadence: /Toutes les semaines|Every week/ });

    const seances = await seancesDe(serieId);
    // Huit semaines couvrent au moins huit séances, la première comprise.
    expect(seances.length).toBeGreaterThanOrEqual(8);

    for (let i = 1; i < seances.length; i++) {
      const ecart = seances[i].startAt.getTime() - seances[i - 1].startAt.getTime();
      expect(Math.round(ecart / JOUR_MS)).toBe(7);
    }

    // Chaque séance est une vraie table : l'organisatrice y est inscrite.
    const inscriptions = await rows(
      'SELECT p.id FROM "EventParticipant" p JOIN "Event" e ON e.id = p."eventId" WHERE e."seriesId" = $1',
      [serieId],
    );
    expect(inscriptions).toHaveLength(seances.length);
  });

  test("la liste des tables ne montre la série qu'une fois", async ({ page }) => {
    await login(page, "chloe");
    const titre = `Dimanches tranquilles ${Date.now()}`;
    await ouvrirSerie(page, { titre, cadence: /Toutes les semaines|Every week/ });

    await page.goto("/events");
    // Toute la valeur du repli est là : dix séances, une seule carte.
    await expect(page.getByRole("link", { name: new RegExp(titre) })).toHaveCount(1);
    await expect(page.getByText(/Toutes les semaines|Every week/).first()).toBeVisible();
  });

  test("la fiche donne accès aux autres séances", async ({ page }) => {
    await login(page, "chloe");
    const titre = `Mardis du Sceau ${Date.now()}`;
    const serieId = await ouvrirSerie(page, { titre, cadence: /Une semaine sur deux|Every other week/ });

    const seances = await seancesDe(serieId);
    await page.goto(`/events/${seances[0].id}`);
    await expect(page.getByText(/Les autres séances|Other sessions/)).toBeVisible();

    // On s'inscrit à la séance qui arrange, pas à celle sur laquelle on est
    // tombé : les autres dates doivent être atteignables.
    await expect(page.locator(`a[href="/events/${seances[1].id}"]`)).toBeVisible();
  });

  test("s'inscrire à une séance n'inscrit pas aux autres", async ({ page }) => {
    await login(page, "chloe");
    const titre = `Samedis découverte ${Date.now()}`;
    const serieId = await ouvrirSerie(page, { titre, cadence: /Toutes les semaines|Every week/ });
    const seances = await seancesDe(serieId);

    await login(page, "marius");
    await page.goto(`/events/${seances[1].id}`);
    await page.getByRole("button", { name: /Je réserve une place|Save me a seat/ }).click();
    await expect(page.getByRole("button", { name: /Se désinscrire|Give up my seat/ })).toBeVisible();

    const inscrit = await rows(
      `SELECT e.id FROM "EventParticipant" p
         JOIN "Event" e ON e.id = p."eventId"
         JOIN "User" u ON u.id = p."userId"
        WHERE e."seriesId" = $1 AND u.email = 'marius@example.com'`,
      [serieId],
    );
    expect(inscrit.map((r) => r.id)).toEqual([seances[1].id]);
  });

  test("annuler une séance laisse les autres en place", async ({ page }) => {
    await login(page, "chloe");
    const titre = `Lundis d'essai ${Date.now()}`;
    const serieId = await ouvrirSerie(page, { titre, cadence: /Toutes les semaines|Every week/ });
    const seances = await seancesDe(serieId);

    await page.goto(`/events/${seances[1].id}`);
    await page.getByRole("button", { name: /Annuler cette séance|Cancel this session/ }).click();
    await expect(page.getByText(/Événement annulé|Event cancelled/).first()).toBeVisible();

    const apres = await seancesDe(serieId);
    const annulees = apres.filter((s) => s.status === "CANCELLED");
    expect(annulees.map((s) => s.id)).toEqual([seances[1].id]);
  });

  test("annuler la série annule toutes les séances à venir", async ({ page }) => {
    await login(page, "chloe");
    const titre = `Vendredis du Rail ${Date.now()}`;
    const serieId = await ouvrirSerie(page, { titre, cadence: /Toutes les semaines|Every week/ });
    const seances = await seancesDe(serieId);

    await page.goto(`/events/${seances[0].id}`);
    await page.getByRole("button", { name: /Annuler toute la série|Cancel the whole series/ }).click();
    await expect(page.getByText(/Événement annulé|Event cancelled/).first()).toBeVisible();

    const apres = await seancesDe(serieId);
    expect(apres.every((s) => s.status === "CANCELLED")).toBe(true);
  });

  test("une correction peut se répercuter sur les séances suivantes", async ({ page }) => {
    await login(page, "chloe");
    const titre = `Mercredis nomades ${Date.now()}`;
    const serieId = await ouvrirSerie(page, { titre, cadence: /Toutes les semaines|Every week/, lieu: "Ancienne salle" });
    const seances = await seancesDe(serieId);

    await page.goto(`/events/${seances[0].id}/edit`);
    await page.fill("#location", "Nouvelle salle");
    await page.getByRole("checkbox", { name: /Appliquer aux séances suivantes|Apply to the following sessions/ }).check();
    await page.getByRole("button", { name: /Enregistrer|Save/ }).click();
    await page.waitForURL(/\/events\/(?!new$)[a-z0-9]+$/);

    const apres = await seancesDe(serieId);
    expect(apres.every((s) => s.location === "Nouvelle salle")).toBe(true);
    // Les dates, elles, n'ont pas bougé : c'est ce qui distingue une séance.
    expect(apres.map((s) => s.startAt.getTime())).toEqual(seances.map((s) => s.startAt.getTime()));
  });

  test("sans cadence, la table reste unique", async ({ page }) => {
    await login(page, "chloe");
    const titre = `Soirée unique ${Date.now()}`;

    await page.goto("/events/new");
    await page.fill("#title", titre);
    await page.fill("#city", "Lyon 7e");
    await page.getByRole("option", { name: /Lyon 7e/ }).first().click();
    await page.fill("#startAt", datetimeLocal(9, 20));
    // Aucune date de fin de série n'est demandée tant qu'on ne choisit rien.
    await expect(page.locator("#untilAt")).toHaveCount(0);
    await page.getByRole("button", { name: /^(Publier|Publish)$/ }).click();
    await page.waitForURL(/\/events\/(?!new$)[a-z0-9]+$/);

    const tables = await rows('SELECT "seriesId" FROM "Event" WHERE title = $1', [titre]);
    expect(tables).toHaveLength(1);
    expect(tables[0].seriesId).toBeNull();
  });
});

test.describe("Recherche : distance et type de table", () => {
  test("« Partout » lève le plafond des cent kilomètres", async ({ page }) => {
    await login(page, "chloe");

    // Une table volontairement hors de portée du plus grand rayon proposé.
    await page.goto("/events/new");
    const titre = `Convention lointaine ${Date.now()}`;
    await page.fill("#title", titre);
    await page.fill("#city", "Brest");
    await page.getByRole("option", { name: /Brest/ }).first().click();
    await page.fill("#startAt", datetimeLocal(12, 14));
    await page.getByRole("button", { name: /^(Publier|Publish)$/ }).click();
    await page.waitForURL(/\/events\/(?!new$)[a-z0-9]+$/);

    await page.goto(`/search?q=${encodeURIComponent(titre)}&distance=100`);
    await expect(page.getByRole("link", { name: new RegExp(titre) })).toHaveCount(0);

    await page.getByRole("button", { name: /^(Partout|Anywhere)$/ }).click();
    await expect(page.getByRole("link", { name: new RegExp(titre) })).toHaveCount(1);
    await expect(page.getByText(/Sans limite de distance|No distance limit/).first()).toBeVisible();
  });

  test("le filtre par type ne renvoie que les tables de ce type", async ({ page }) => {
    await login(page, "chloe");

    await page.goto("/search?type=Table&eventType=ROLE_PLAYING&distance=0");
    // Le seed contient un weekend de jeu de rôle et un draft TCG.
    await expect(page.getByRole("link", { name: /Weekend DnD/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Draft TCG/ })).toHaveCount(0);

    await page.goto("/search?type=Table&eventType=TCG&distance=0");
    await expect(page.getByRole("link", { name: /Draft TCG/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Weekend DnD/ })).toHaveCount(0);
  });

  test("choisir un type de table écarte jeux, cartes et clubs", async ({ page }) => {
    await login(page, "chloe");

    // On interroge les liens des résultats plutôt que leur libellé : « Club »
    // et « Jeu » sont aussi les noms des boutons de filtre, juste à côté.
    await page.goto("/search?distance=0");
    expect(await page.locator('a[href^="/clubs/"]').count()).toBeGreaterThan(0);

    await page.goto("/search?type=Table&eventType=BOARD_GAME&distance=0");
    await expect(page.locator('a[href^="/clubs/"]')).toHaveCount(0);
    await expect(page.locator('a[href^="/games/"]')).toHaveCount(0);
    expect(await page.locator('a[href^="/events/"]').count()).toBeGreaterThan(0);
  });

  test("quitter les tables emporte le filtre de type de table", async ({ page }) => {
    await login(page, "chloe");
    await page.goto("/search?type=Table&eventType=TCG&distance=0");

    // Un filtre resté actif en douce ferait mentir tous les résultats suivants.
    await page.getByRole("link", { name: /^Jeu$|^Game$/ }).click();
    await page.waitForURL(/type=Jeu/);
    expect(page.url()).not.toContain("eventType");
  });
});
