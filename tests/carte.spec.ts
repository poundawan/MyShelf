import { test, expect } from "@playwright/test";
import { login, rows, watchForPageErrors, expectNoHorizontalOverflow } from "./helpers";

/**
 * Carte interactive de l'accueil.
 *
 * C'est le premier écran qui dépende d'un tiers : sans tuiles, pas de fond de
 * carte. La suite n'en appelle évidemment aucun — le faux service en sert,
 * comme il sert déjà les réponses de BoardGameGeek et du géocodeur. Deux
 * chemins comptent ici : celui où les tuiles arrivent, et celui où elles
 * n'arrivent pas.
 */

const carte = 'div.leaflet-container[role="region"]';
const marqueurs = ".leaflet-marker-icon";

test.describe("Carte de proximité", () => {
  test("elle affiche une tuile réelle et un marqueur par table située", async ({ page }) => {
    const erreurs = watchForPageErrors(page);
    await login(page, "chloe");

    await expect(page.locator(carte)).toBeVisible();

    // Les tuiles ont réellement été téléchargées et décodées.
    // `naturalWidth > 0` est le seul témoin qui ne mente pas : une image
    // cassée est présente dans le DOM, dimensionnée par la feuille de style,
    // et paraîtrait « visible » — mais sa largeur naturelle reste nulle.
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const tuiles = Array.from(document.querySelectorAll<HTMLImageElement>(".leaflet-tile"));
          return tuiles.length > 0 && tuiles.every((t) => t.naturalWidth > 0);
        }),
      )
      .toBe(true);

    // Et elles viennent bien du fournisseur configuré.
    const source = await page.locator(".leaflet-tile").first().getAttribute("src");
    expect(source).toContain("/tuiles/");

    // Un marqueur par table du rayon dont la commune est connue — ni plus
    // (on n'invente pas de position), ni moins (une carte qui en cache la
    // moitié mentirait sur ce qu'il y a autour).
    const attendus = await rows<{ n: string }>(
      `SELECT count(*) AS n FROM "Event" e
         JOIN "Commune" c ON c.code = e."communeCode"
        WHERE e.status = 'ACTIVE' AND e."startAt" >= now()`,
    );
    await expect(page.locator(marqueurs)).toHaveCount(Number(attendus[0].n));

    expect(erreurs).toEqual([]);
  });

  test("l'attribution du fournisseur est affichée", async ({ page }) => {
    await login(page, "chloe");
    // Exigée par la plupart des fournisseurs, OpenStreetMap compris. La
    // masquer serait un manquement, pas un choix esthétique.
    await expect(page.locator(".leaflet-control-attribution")).toContainText("Fonds de carte de test");
  });

  test("un marqueur ouvre la fiche de sa table", async ({ page }) => {
    await login(page, "chloe");
    await expect(page.locator(carte)).toBeVisible();

    await page.locator(marqueurs).first().click();
    const lien = page.locator(".leaflet-popup-content a").first();
    await expect(lien).toBeVisible();

    const href = await lien.getAttribute("href");
    expect(href).toMatch(/^\/events\/[a-z0-9]+$/);
    await lien.click();
    await page.waitForURL(/\/events\/(?!new$)[a-z0-9]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("la liste reste affichée sous la carte", async ({ page }) => {
    await login(page, "chloe");
    // La carte ne se lit ni au clavier ni à voix haute aussi bien qu'une
    // liste. Elle s'ajoute, elle ne remplace pas.
    await expect(page.locator(carte)).toBeVisible();
    // Des liens vers des tables hors de la carte : ceux de la liste.
    const horsCarte = page.locator('a[href^="/events/"]:not(.leaflet-popup-content a)');
    expect(await horsCarte.count()).toBeGreaterThan(0);
  });

  test("la carte ne fait pas déborder la page", async ({ page }) => {
    await login(page, "chloe");
    await expect(page.locator(carte)).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Carte sans fournisseur de tuiles", () => {
  // Le vrai risque d'une carte : un fond gris et muet, qu'on prend pour une
  // région vide alors que c'est le fournisseur qui manque.
  test("elle s'efface et le dit, plutôt que d'afficher un fond vide", async ({ page }) => {
    test.setTimeout(60_000);
    await login(page, "chloe");

    // On coupe le fournisseur au niveau du navigateur : plus fidèle qu'une
    // variable d'environnement, puisque c'est bien le réseau qui manque.
    await page.route("**/tuiles/**", (route) => route.abort());
    await page.reload();

    await expect(page.getByText(/fond de carte n'a pas pu être chargé|map background could not be loaded/i))
      .toBeVisible({ timeout: 20_000 });
    await expect(page.locator(carte)).toHaveCount(0);

    // Et la liste, elle, reste juste.
    await expect(page.getByText(/Autour de toi|Around you/)).toBeVisible();
    expect(await page.locator('a[href^="/events/"]').count()).toBeGreaterThan(0);
  });
});
