import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { login, one } from "./helpers";
import { analyserFiches, analyserIdsRecherche, estImageBgg } from "../src/lib/bgg";

/**
 * Chaîne complète de la recherche BoardGameGeek : requête HTTP, statuts
 * d'erreur, analyse, action serveur, écran — testée par l'écran, comme on
 * s'en sert.
 *
 * Le serveur interrogé est un faux BGG local (`tests/faux-bgg.ts`) piloté par
 * `BGG_API_BASE`. L'API réelle n'est pas appelée : elle est lente, elle tombe,
 * et certains environnements n'ont aucun accès sortant vers elle.
 */

const fixture = (nom: string) => path.join(__dirname, "fixtures", nom);

/** Ouvre l'ajout d'un jeu et lance une recherche dans le sélecteur. */
async function chercher(page: import("@playwright/test").Page, terme: string) {
  await page.goto("/shelf/new");
  await page.fill("#bgg-query", terme);
  await page.getByRole("button", { name: "Chercher" }).click();
}

test.describe("Recherche BoardGameGeek", () => {
  test("une recherche qui aboutit pré-remplit le formulaire", async ({ page }) => {
    await login(page, "chloe");
    await chercher(page, "wingspan");

    await page.getByRole("button", { name: /Wingspan/ }).first().click();

    await expect(page.locator("#title")).toHaveValue("Wingspan");
    await expect(page.locator("#minPlayers")).toHaveValue("1");
    await expect(page.locator("#maxPlayers")).toHaveValue("5");
    await expect(page.locator("#durationMin")).toHaveValue("70");
    await expect(page.getByText("Reprise du catalogue BoardGameGeek.")).toBeVisible();
  });

  test("le jeu ajouté garde la jaquette reprise du catalogue", async ({ page }) => {
    await login(page, "marius");
    await chercher(page, "wingspan");
    await page.getByRole("button", { name: /Wingspan/ }).first().click();

    // Un titre unique : le catalogue est partagé et le test doit être rejouable.
    const titre = `Wingspan ${Date.now()}`;
    await page.fill("#title", titre);
    await page.getByRole("button", { name: "Ajouter à mon étagère" }).click();
    await page.waitForURL(/\/games\/[a-z0-9]+$/);

    const jeu = await one<{ photoUrl: string | null; bggId: number | null }>(
      'SELECT "photoUrl", "bggId" FROM "Game" WHERE title = $1', [titre],
    );
    expect(jeu.photoUrl).toContain("cf.geekdo-images.com");
    // Modifier le titre à la main détache la fiche du catalogue de BGG.
    expect(jeu.bggId).toBeNull();
  });

  test("aucun résultat le dit, sans parler de panne", async ({ page }) => {
    await login(page, "chloe");
    await chercher(page, "inconnu");

    await expect(page.getByText(/Aucun jeu de ce nom/)).toBeVisible();
    await expect(page.getByText(/ne répond pas/)).toHaveCount(0);
  });

  test("une erreur serveur est annoncée comme une panne, avec son motif", async ({ page }) => {
    await login(page, "chloe");
    await chercher(page, "panne");

    await expect(page.getByText(/BoardGameGeek ne répond pas/)).toBeVisible();
    await expect(page.getByText(/500/)).toBeVisible();

    // Le formulaire manuel doit rester utilisable : c'est tout l'enjeu.
    const titre = `Jeu saisi à la main ${Date.now()}`;
    await page.fill("#title", titre);
    await page.getByRole("button", { name: "Ajouter à mon étagère" }).click();
    await page.waitForURL(/\/games\/[a-z0-9]+$/);
    await expect(page.getByRole("heading", { name: titre, level: 1 })).toBeVisible();
  });

  test("une réponse encore en préparation (202) est retentée puis signalée", async ({ page }) => {
    await login(page, "chloe");
    await chercher(page, "attente");

    await expect(page.getByText(/BoardGameGeek ne répond pas/)).toBeVisible();
    await expect(page.getByText(/202/)).toBeVisible();
  });

  test("un serveur muet ne fait pas attendre indéfiniment", async ({ page }) => {
    test.setTimeout(40_000);
    await login(page, "chloe");
    await chercher(page, "lent");

    // AbortSignal.timeout lève une TimeoutError au bout de huit secondes.
    await expect(page.getByText(/BoardGameGeek ne répond pas/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Timeout|abort/i)).toBeVisible();
  });

  test("un hôte qui refuse fait basculer sur le second, sans que personne ne le voie", async ({ page }) => {
    await login(page, "chloe");
    await chercher(page, "bascule");

    // La racine principale renvoie 401 — ce que le pare-feu de BoardGameGeek
    // fait depuis une adresse d'hébergeur. La seconde doit prendre le relais
    // et la recherche aboutir normalement.
    await expect(page.getByRole("button", { name: /Wingspan/ }).first()).toBeVisible();
    await expect(page.getByText(/ne répond pas/)).toHaveCount(0);
  });

  test("si le filtre par type ne ramène rien, la recherche est retentée sans lui", async ({ page }) => {
    await login(page, "chloe");
    await chercher(page, "sanstype");

    await expect(page.getByRole("button", { name: /Wingspan/ }).first()).toBeVisible();
  });

  test("une session perdue est annoncée comme telle, pas comme une panne de BoardGameGeek", async ({ page, context }) => {
    await login(page, "chloe");
    await page.goto("/shelf/new");

    // La page est déjà rendue : la garde de route ne repassera pas. On simule
    // une session perdue entre l'affichage du formulaire et la recherche —
    // exactement le cas où l'action doit refuser d'elle-même.
    await page.fill("#title", "Saisie en cours");
    await context.clearCookies();

    await page.fill("#bgg-query", "wingspan");
    await page.getByRole("button", { name: "Chercher" }).click();

    await expect(page.getByText(/session n'est plus reconnue/)).toBeVisible();
    await expect(page.getByText(/BoardGameGeek ne répond pas/)).toHaveCount(0);
    // Ce qui était saisi ne doit pas disparaître.
    await expect(page.locator("#title")).toHaveValue("Saisie en cours");
  });

  test("le sélecteur est hors de portée d'un visiteur déconnecté", async ({ page }) => {
    await page.goto("/shelf/new");
    await page.waitForURL(/\/login$/);
    await expect(page.locator("#bgg-query")).toHaveCount(0);
  });
});

test.describe("Analyse des réponses XML", () => {
  test("l'analyse d'une réponse /search donne les identifiants", () => {
    const xml = readFileSync(fixture("bgg-search.xml"), "utf8");
    expect(analyserIdsRecherche(xml)).toEqual([266192, 300442, 13]);
  });

  test("l'analyse d'une réponse /thing donne les fiches", () => {
    const fiches = analyserFiches(readFileSync(fixture("bgg-thing.xml"), "utf8"));

    expect(fiches).toHaveLength(3);
    expect(fiches[0]).toMatchObject({
      bggId: 266192, title: "Wingspan", year: 2019,
      minPlayers: 1, maxPlayers: 5, durationMin: 70, minAge: 10,
    });
    // Le nom « primary » fait foi, même s'il arrive après un nom alternatif,
    // et les entités XML doivent être décodées.
    expect(fiches[1].title).toBe("Carcassonne: Chasseurs & Cueilleurs");
    expect(fiches[2].title).toBe("Jeu à l'image douteuse");
  });

  test("une jaquette qui ne vient pas de BoardGameGeek est écartée", () => {
    const fiches = analyserFiches(readFileSync(fixture("bgg-thing.xml"), "utf8"));

    // La troisième fiche annonce une vignette en clair et une image en
    // « javascript: » : aucune des deux ne doit ressortir.
    expect(fiches[2].thumbnail).toBeNull();
    expect(fiches[2].image).toBeNull();

    expect(estImageBgg("https://cf.geekdo-images.com/x/img/a.jpg")).toBe(true);
    expect(estImageBgg("http://cf.geekdo-images.com/x/img/a.jpg")).toBe(false);
    expect(estImageBgg("https://exemple.test/img/a.jpg")).toBe(false);
    expect(estImageBgg("javascript:alert(1)")).toBe(false);
  });
});
