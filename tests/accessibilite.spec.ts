import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { login, one, userId } from "./helpers";

/**
 * Accessibilité — mesurée plutôt que supposée.
 *
 * axe-core n'attrape pas tout (il ne juge ni la formulation des libellés ni la
 * logique de navigation), mais il détecte sans indulgence les contrastes
 * insuffisants, les champs sans étiquette, les images sans alternative et les
 * hiérarchies de titres incohérentes. Ce qu'il ne voit pas reste à vérifier à
 * la main ; ce qu'il voit ne doit plus jamais régresser.
 */

async function analyser(page: import("@playwright/test").Page) {
  return new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
}

/** Rend les infractions lisibles dans le rapport d'échec. */
function resumer(violations: Awaited<ReturnType<typeof analyser>>["violations"]) {
  return violations
    .map((v) => `${v.id} (${v.impact}) — ${v.help}\n    ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join("\n    ")}`)
    .join("\n");
}

test.describe("Pages publiques", () => {
  for (const [nom, route] of [
    ["l'accueil", "/"],
    ["la connexion", "/login"],
    ["l'inscription", "/register"],
    ["les tables", "/events"],
  ] as const) {
    test(`${nom} ne présente aucune infraction`, async ({ page }) => {
      await page.goto(route);
      const { violations } = await analyser(page);
      expect(resumer(violations)).toBe("");
    });
  }
});

test.describe("Pages connectées", () => {
  test.beforeEach(async ({ page }) => login(page, "chloe"));

  test("l'accueil connecté", async ({ page }) => {
    await page.goto("/");
    expect(resumer((await analyser(page)).violations)).toBe("");
  });

  test("l'étagère et l'ajout d'un jeu", async ({ page }) => {
    await page.goto("/shelf");
    expect(resumer((await analyser(page)).violations)).toBe("");
    await page.goto("/shelf/new");
    expect(resumer((await analyser(page)).violations)).toBe("");
  });

  test("la fiche d'un jeu", async ({ page }) => {
    const game = await one<{ id: string }>('SELECT id FROM "Game" WHERE title = $1', ["Cap sur Oreb"]);
    await page.goto(`/games/${game.id}`);
    expect(resumer((await analyser(page)).violations)).toBe("");
  });

  test("les échanges", async ({ page }) => {
    await page.goto("/trades");
    expect(resumer((await analyser(page)).violations)).toBe("");

    const trade = await one<{ id: string }>(
      'SELECT id FROM "TradeProposal" WHERE "fromUserId" = $1 OR "toUserId" = $1 LIMIT 1',
      [await userId("chloe")],
    );
    await page.goto(`/trades/${trade.id}`);
    expect(resumer((await analyser(page)).violations)).toBe("");
  });

  test("les cartes", async ({ page }) => {
    await page.goto("/cards");
    expect(resumer((await analyser(page)).violations)).toBe("");
    await page.goto("/cards?tab=mine");
    expect(resumer((await analyser(page)).violations)).toBe("");
  });

  test("les tables et leur création", async ({ page }) => {
    const event = await one<{ id: string }>(`SELECT id FROM "Event" WHERE status = 'ACTIVE' LIMIT 1`);
    await page.goto(`/events/${event.id}`);
    expect(resumer((await analyser(page)).violations)).toBe("");
    await page.goto("/events/new");
    expect(resumer((await analyser(page)).violations)).toBe("");
  });

  test("la recherche", async ({ page }) => {
    await page.goto("/search");
    expect(resumer((await analyser(page)).violations)).toBe("");
  });

  test("les messages", async ({ page }) => {
    await page.goto("/messages");
    expect(resumer((await analyser(page)).violations)).toBe("");

    const conversation = await one<{ id: string }>(
      'SELECT id FROM "Conversation" WHERE "userAId" = $1 OR "userBId" = $1 LIMIT 1',
      [await userId("chloe")],
    );
    await page.goto(`/messages/${conversation.id}`);
    expect(resumer((await analyser(page)).violations)).toBe("");
  });

  test("le profil et son édition", async ({ page }) => {
    await page.goto(`/profile/${await userId("chloe")}`);
    expect(resumer((await analyser(page)).violations)).toBe("");
    await page.goto("/profile/edit");
    expect(resumer((await analyser(page)).violations)).toBe("");
  });

  test("les clubs et les notifications", async ({ page }) => {
    await page.goto("/clubs");
    expect(resumer((await analyser(page)).violations)).toBe("");

    const club = await one<{ id: string }>('SELECT id FROM "Club" LIMIT 1');
    await page.goto(`/clubs/${club.id}`);
    expect(resumer((await analyser(page)).violations)).toBe("");

    await page.goto("/notifications");
    expect(resumer((await analyser(page)).violations)).toBe("");
  });

  test("les pages d'erreur", async ({ page }) => {
    await page.goto("/cette-page-n-existe-pas");
    expect(resumer((await analyser(page)).violations)).toBe("");
  });
});
