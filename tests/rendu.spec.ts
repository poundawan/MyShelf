import { test, expect } from "@playwright/test";
import { one, login, userId, watchForPageErrors, expectNoHorizontalOverflow } from "./helpers";

/**
 * Niveau 1 — rendu.
 *
 * Chaque écran de l'application doit s'afficher avec son contenu propre, sans
 * erreur JavaScript et sans déborder horizontalement. Ce fichier est rejoué
 * sur mobile (iPhone 13) en plus du bureau.
 */

test.describe("Pages publiques", () => {
  test("la connexion et l'inscription s'affichent", async ({ page }) => {
    const errors = watchForPageErrors(page);

    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Connexion", level: 1 })).toBeVisible();
    await expect(page.locator("#email")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto("/register");
    await expect(page.getByRole("heading", { name: "Créer un compte", level: 1 })).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    expect(errors).toEqual([]);
  });

  test("un visiteur non connecté voit l'accueil et les tables", async ({ page }) => {
    const errors = watchForPageErrors(page);

    await page.goto("/");
    await expect(page.getByRole("link", { name: "Connexion" })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto("/events");
    await expect(page.getByRole("heading", { name: "Tables", level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    expect(errors).toEqual([]);
  });
});

test.describe("Pages connectées", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "chloe");
  });

  test("l'accueil affiche le tableau de bord et le fil", async ({ page }) => {
    const errors = watchForPageErrors(page);
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("À toi de jouer");
    await expect(page.getByText("Autour de toi")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });

  test("l'étagère liste les jeux et la liste de souhaits", async ({ page }) => {
    const errors = watchForPageErrors(page);

    await page.goto("/shelf");
    await expect(page.getByRole("heading", { name: "Mon étagère", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /Ajouter un jeu/ })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto("/shelf?tab=wishlist");
    await expect(page.getByRole("heading", { name: "Mon étagère", level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto("/shelf/new");
    await expect(page.getByRole("heading", { name: "Ajouter un jeu", level: 1 })).toBeVisible();
    await expect(page.locator("#title")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    expect(errors).toEqual([]);
  });

  test("la fiche d'un jeu affiche son titre et ses détenteurs", async ({ page }) => {
    const errors = watchForPageErrors(page);
    const game = await one<{ id: string }>('SELECT id FROM "Game" WHERE title = $1', ["Cap sur Oreb"]);

    await page.goto(`/games/${game.id}`);
    await expect(page.getByRole("heading", { name: "Cap sur Oreb", level: 1 })).toBeVisible();
    await expect(page.getByText("Joueurs", { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    expect(errors).toEqual([]);
  });

  test("les échanges s'affichent en liste et en détail", async ({ page }) => {
    const errors = watchForPageErrors(page);
    const me = await userId("chloe");

    await page.goto("/trades");
    await expect(page.getByRole("heading", { name: "Mes échanges", level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const trade = await one<{ id: string }>(
      'SELECT id FROM "TradeProposal" WHERE "fromUserId" = $1 OR "toUserId" = $1 LIMIT 1',
      [me],
    );
    await page.goto(`/trades/${trade.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    expect(errors).toEqual([]);
  });

  test("l'assistant de proposition d'échange s'affiche", async ({ page }) => {
    const errors = watchForPageErrors(page);
    const me = await userId("chloe");
    const copy = await one<{ id: string; ownerName: string }>(
      `SELECT c.id, u.name AS "ownerName"
         FROM "GameCopy" c JOIN "User" u ON u.id = c."ownerId"
        WHERE c."ownerId" <> $1 AND c.status = 'ON_TABLE'
        LIMIT 1`,
      [me],
    );

    await page.goto(`/trades/new?copyId=${copy.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(copy.ownerName);
    await expectNoHorizontalOverflow(page);

    expect(errors).toEqual([]);
  });

  test("les cartes s'affichent dans les deux onglets", async ({ page }) => {
    const errors = watchForPageErrors(page);

    await page.goto("/cards");
    await expect(page.getByRole("heading", { name: "Échange de cartes", level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto("/cards?tab=mine");
    await expect(page.getByRole("heading", { name: "Échange de cartes", level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto("/cards/new");
    await expect(page.getByRole("heading", { name: "Ajouter une carte", level: 1 })).toBeVisible();
    await expect(page.locator("#name")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    expect(errors).toEqual([]);
  });

  test("les tables s'affichent en liste, en détail et en création", async ({ page }) => {
    const errors = watchForPageErrors(page);

    await page.goto("/events");
    await expect(page.getByRole("heading", { name: "Tables", level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const event = await one<{ id: string; title: string }>(
      `SELECT id, title FROM "Event" WHERE status = 'ACTIVE' ORDER BY "startAt" LIMIT 1`,
    );
    await page.goto(`/events/${event.id}`);
    await expect(page.getByRole("heading", { name: event.title, level: 1 })).toBeVisible();
    await expect(page.getByText(/inscrit/)).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto("/events/new");
    await expect(page.getByRole("heading", { name: "Ouvrir une table", level: 1 })).toBeVisible();
    await expect(page.locator("#title")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    expect(errors).toEqual([]);
  });

  test("la recherche affiche ses filtres et ses résultats", async ({ page }) => {
    const errors = watchForPageErrors(page);

    await page.goto("/search");
    await expect(page.getByRole("heading", { name: "Recherche", level: 1 })).toBeVisible();
    await expect(page.getByText("Type")).toBeVisible();
    await expect(page.getByText(/résultat/)).toBeVisible();
    await expectNoHorizontalOverflow(page);

    expect(errors).toEqual([]);
  });

  test("les messages s'affichent en liste et en conversation", async ({ page }) => {
    const errors = watchForPageErrors(page);
    const me = await userId("chloe");

    await page.goto("/messages");
    await expect(page.getByRole("heading", { name: "Messages", level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const conversation = await one<{ id: string }>(
      'SELECT id FROM "Conversation" WHERE "userAId" = $1 OR "userBId" = $1 LIMIT 1',
      [me],
    );
    await page.goto(`/messages/${conversation.id}`);
    await expect(page.getByPlaceholder("Écris ton message...")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    expect(errors).toEqual([]);
  });

  test("le profil et son édition s'affichent", async ({ page }) => {
    const errors = watchForPageErrors(page);
    const me = await userId("chloe");

    await page.goto(`/profile/${me}`);
    await expect(page.getByRole("heading", { name: "Chloé Barrat", level: 1 })).toBeVisible();
    await expect(page.getByText("note moyenne", { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto("/profile/edit");
    await expect(page.getByRole("heading", { name: "Modifier mon profil", level: 1 })).toBeVisible();
    await expect(page.locator("#name")).toHaveValue("Chloé Barrat");
    await expectNoHorizontalOverflow(page);

    expect(errors).toEqual([]);
  });

  test("une ressource inexistante renvoie une page 404", async ({ page }) => {
    const response = await page.goto("/games/inexistant");
    expect(response?.status()).toBe(404);
  });
});
