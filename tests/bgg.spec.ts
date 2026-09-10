import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { login, one } from "./helpers";
import { analyserFiches, analyserIdsRecherche, estImageBgg } from "../src/lib/bgg";

/**
 * Chaîne complète de la recherche BoardGameGeek : requête HTTP, statuts
 * d'erreur, analyse, route, écran.
 *
 * Le serveur interrogé est un faux BGG local (`tests/faux-bgg.ts`) piloté par
 * `BGG_API_BASE`. L'API réelle n'est pas appelée : elle est lente, elle tombe,
 * et certains environnements n'ont aucun accès sortant vers elle.
 */

const fixture = (nom: string) => path.join(__dirname, "fixtures", nom);

/** Interroge la route depuis le navigateur, pour que le cookie de session parte. */
async function chercher(page: import("@playwright/test").Page, terme: string) {
  const reponse = await page.goto(`/api/bgg/search?q=${encodeURIComponent(terme)}`);
  expect(reponse!.status()).toBe(200);
  return JSON.parse(await page.locator("body").innerText());
}

test.describe("Recherche BoardGameGeek", () => {
  test("une recherche qui aboutit remonte les fiches complètes", async ({ page }) => {
    await login(page, "chloe");
    const donnees = await chercher(page, "wingspan");

    expect(donnees.statut).toBe("ok");
    expect(donnees.jeux.length).toBeGreaterThan(0);
    expect(donnees.jeux[0]).toMatchObject({
      bggId: 266192, title: "Wingspan", minPlayers: 1, maxPlayers: 5, durationMin: 70,
    });
    expect(donnees.jeux[0].image).toContain("cf.geekdo-images.com");
  });

  test("aucun résultat n'est pas une panne", async ({ page }) => {
    await login(page, "chloe");
    const donnees = await chercher(page, "inconnu");

    expect(donnees).toEqual({ jeux: [], statut: "ok" });
  });

  test("une erreur serveur est annoncée comme telle, pas comme une absence de résultat", async ({ page }) => {
    await login(page, "chloe");
    const donnees = await chercher(page, "panne");

    expect(donnees.statut).toBe("injoignable");
    expect(donnees.detail).toContain("500");
    expect(donnees.jeux).toEqual([]);
  });

  test("une réponse encore en préparation (202) est retentée puis signalée", async ({ page }) => {
    await login(page, "chloe");
    const donnees = await chercher(page, "attente");

    expect(donnees.statut).toBe("injoignable");
    expect(donnees.detail).toContain("202");
  });

  test("un serveur muet ne fait pas attendre indéfiniment", async ({ page }) => {
    test.setTimeout(30_000);
    await login(page, "chloe");
    const donnees = await chercher(page, "lent");

    expect(donnees.statut).toBe("injoignable");
    // AbortSignal.timeout lève une TimeoutError.
    expect(donnees.detail).toMatch(/Timeout|abort/i);
  });

  test("si le filtre par type ne ramène rien, la recherche est retentée sans lui", async ({ page }) => {
    await login(page, "chloe");
    const donnees = await chercher(page, "sanstype");

    expect(donnees.statut).toBe("ok");
    expect(donnees.jeux.length).toBeGreaterThan(0);
  });
});

test.describe("Sélecteur dans l'ajout d'un jeu", () => {
  test("choisir une fiche pré-remplit le formulaire", async ({ page }) => {
    await login(page, "chloe");
    await page.goto("/shelf/new");

    await page.fill("#bgg-query", "wingspan");
    await page.getByRole("button", { name: "Chercher" }).click();

    await page.getByRole("button", { name: /Wingspan/ }).first().click();

    await expect(page.locator("#title")).toHaveValue("Wingspan");
    await expect(page.locator("#minPlayers")).toHaveValue("1");
    await expect(page.locator("#maxPlayers")).toHaveValue("5");
    await expect(page.locator("#durationMin")).toHaveValue("70");
    // La jaquette reprise doit être visible, et annoncée comme venant de BGG.
    await expect(page.getByText("Reprise du catalogue BoardGameGeek.")).toBeVisible();
  });

  test("le jeu ajouté garde la jaquette et l'identifiant BoardGameGeek", async ({ page }) => {
    await login(page, "marius");
    await page.goto("/shelf/new");

    await page.fill("#bgg-query", "wingspan");
    await page.getByRole("button", { name: "Chercher" }).click();
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

  test("une panne de BoardGameGeek se lit à l'écran, sans bloquer le formulaire", async ({ page }) => {
    await login(page, "chloe");
    await page.goto("/shelf/new");

    await page.fill("#bgg-query", "panne");
    await page.getByRole("button", { name: "Chercher" }).click();

    await expect(page.getByText(/BoardGameGeek ne répond pas/)).toBeVisible();
    await expect(page.getByText(/500/)).toBeVisible();

    // Le formulaire manuel doit rester utilisable : c'est tout l'enjeu.
    const titre = `Jeu saisi à la main ${Date.now()}`;
    await page.fill("#title", titre);
    await page.getByRole("button", { name: "Ajouter à mon étagère" }).click();
    await page.waitForURL(/\/games\/[a-z0-9]+$/);
    await expect(page.getByRole("heading", { name: titre, level: 1 })).toBeVisible();
  });

  test("un jeu introuvable chez BoardGameGeek le dit sans parler de panne", async ({ page }) => {
    await login(page, "chloe");
    await page.goto("/shelf/new");

    await page.fill("#bgg-query", "inconnu");
    await page.getByRole("button", { name: "Chercher" }).click();

    await expect(page.getByText(/Aucun jeu de ce nom/)).toBeVisible();
    await expect(page.getByText(/ne répond pas/)).toHaveCount(0);
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

test.describe("Accès à la route de recherche", () => {
  test("la recherche exige une session : l'application n'est pas un relais ouvert", async ({ page }) => {
    const anonyme = await page.request.get("/api/bgg/search?q=wingspan");
    expect(anonyme.status()).toBe(401);
  });

  test("une requête trop courte ne part pas chez BoardGameGeek", async ({ page }) => {
    await login(page, "chloe");

    // On passe par le navigateur et non par `page.request` : le cookie de
    // session porte le préfixe `__Host-` (donc `Secure`) dans une compilation
    // de production, et le client HTTP de Playwright, contrairement à
    // Chromium, ne fait pas d'exception pour http://127.0.0.1.
    expect(await chercher(page, "a")).toEqual({ jeux: [], statut: "ok" });
  });
});
