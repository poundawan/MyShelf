import { test, expect } from "@playwright/test";
import { login, logout, one, rows, userId, uniqueEmail, datetimeLocal, keyForEmail, SEED_EMAILS } from "./helpers";

/**
 * Les chantiers prioritaires livrés après la première suite : clubs, gardes de
 * rendu, modification et suppression, pages d'erreur.
 */

test.describe("Clubs", () => {
  test("la liste et la fiche d'un club s'affichent", async ({ page }) => {
    await login(page, "chloe");
    const club = await one<{ id: string; name: string }>('SELECT id, name FROM "Club" LIMIT 1');

    await page.goto("/clubs");
    await expect(page.getByRole("heading", { name: "Clubs", level: 1 })).toBeVisible();
    await expect(page.getByText(club.name).first()).toBeVisible();

    await page.goto(`/clubs/${club.id}`);
    await expect(page.getByRole("heading", { name: club.name, level: 1 })).toBeVisible();
    await expect(page.getByText(/Membres \(/)).toBeVisible();
  });

  test("rejoindre puis quitter un club", async ({ page }) => {
    const club = await one<{ id: string }>('SELECT id FROM "Club" LIMIT 1');

    // Tous les comptes du jeu de démonstration sont déjà membres : on crée donc
    // un compte neuf, ce qui rend le test indépendant du seed.
    const email = uniqueEmail("club");
    await page.goto("/register");
    await page.fill("#name", "Nouveau Membre");
    await page.fill("#city", "Lyon 5e");
    await page.fill("#email", email);
    await page.fill("#password", "motdepasse123");
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await page.waitForURL("/");

    const { id: uid } = await one<{ id: string }>('SELECT id FROM "User" WHERE email = $1', [email]);
    await page.goto(`/clubs/${club.id}`);

    await page.getByRole("button", { name: "Rejoindre le club" }).click();
    await expect(page.getByRole("button", { name: "Quitter le club" })).toBeVisible();
    expect(await rows('SELECT 1 FROM "ClubMembership" WHERE "clubId" = $1 AND "userId" = $2', [club.id, uid])).toHaveLength(1);

    await page.getByRole("button", { name: "Quitter le club" }).click();
    await expect(page.getByRole("button", { name: "Rejoindre le club" })).toBeVisible();
    expect(await rows('SELECT 1 FROM "ClubMembership" WHERE "clubId" = $1 AND "userId" = $2', [club.id, uid])).toHaveLength(0);
  });

  test("le résultat de recherche « club » mène à sa fiche", async ({ page }) => {
    await login(page, "chloe");
    await page.goto("/search?type=Club");

    const lien = page.locator('a[href^="/clubs/"]').first();
    await expect(lien).toBeVisible();
    await lien.click();
    await expect(page).toHaveURL(/\/clubs\/c/);
  });
});

test.describe("Gardes de rendu", () => {
  const formulaires = [
    ["ajouter un jeu", "/shelf/new"],
    ["ajouter une carte", "/cards/new"],
    ["ouvrir une table", "/events/new"],
  ] as const;

  for (const [nom, route] of formulaires) {
    test(`« ${nom} » ne s'affiche pas sans session`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/);
      // Le formulaire lui-même ne doit jamais être rendu : sinon on le remplit
      // pour rien avant d'être renvoyé ici.
      await expect(page.locator("#title, #name")).toHaveCount(0);
    });
  }

  test("connecté, les formulaires s'affichent normalement", async ({ page }) => {
    await login(page, "chloe");
    await page.goto("/shelf/new");
    await expect(page.locator("#title")).toBeVisible();
    await page.goto("/events/new");
    await expect(page.locator("#title")).toBeVisible();
    await page.goto("/cards/new");
    await expect(page.locator("#name")).toBeVisible();
  });
});

test.describe("Modifier une table", () => {
  test("l'organisateur modifie sa table, les inscrits sont conservés", async ({ page }) => {
    await login(page, "marius");

    await page.goto("/events/new");
    await page.fill("#title", `Table à corriger ${Date.now()}`);
    await page.fill("#city", "Lyon 3e");
    await page.fill("#startAt", datetimeLocal(12, 18));
    await page.fill("#maxParticipants", "5");
    await page.getByRole("button", { name: "Publier" }).click();
    await page.waitForURL(/\/events\/c/);
    const eventId = page.url().split("/events/")[1];

    await page.getByRole("link", { name: "Modifier" }).click();
    await page.waitForURL(/\/edit$/);

    // Le formulaire arrive pré-rempli : sans cela, on efface en enregistrant.
    await expect(page.locator("#city")).toHaveValue("Lyon 3e");
    await expect(page.locator("#maxParticipants")).toHaveValue("5");

    const nouveauTitre = `Table corrigée ${Date.now()}`;
    await page.fill("#title", nouveauTitre);
    await page.fill("#location", "Chez Marius, 2e étage");
    await page.getByRole("button", { name: "Confirmé" }).click();
    await page.getByRole("button", { name: "Enregistrer" }).click();

    await page.waitForURL(new RegExp(`/events/${eventId}$`));
    await expect(page.getByRole("heading", { name: nouveauTitre, level: 1 })).toBeVisible();

    const apres = await one<{ title: string; location: string; level: string; maxParticipants: number }>(
      'SELECT title, location, level, "maxParticipants" FROM "Event" WHERE id = $1',
      [eventId],
    );
    expect(apres.title).toBe(nouveauTitre);
    expect(apres.location).toBe("Chez Marius, 2e étage");
    expect(apres.level).toBe("CONFIRMED");
    expect(apres.maxParticipants).toBe(5);
    expect(await rows('SELECT 1 FROM "EventParticipant" WHERE "eventId" = $1', [eventId])).toHaveLength(1);
  });

  test("on ne peut pas descendre sous le nombre d'inscrits", async ({ page }) => {
    await login(page, "marius");
    await page.goto("/events/new");
    await page.fill("#title", `Table pleine ${Date.now()}`);
    await page.fill("#city", "Lyon 3e");
    await page.fill("#startAt", datetimeLocal(12, 18));
    await page.fill("#maxParticipants", "4");
    await page.getByRole("button", { name: "Publier" }).click();
    await page.waitForURL(/\/events\/c/);
    const eventId = page.url().split("/events/")[1];

    // Léa rejoint : ils sont deux.
    await logout(page);
    await login(page, "lea");
    await page.goto(`/events/${eventId}`);
    await page.getByRole("button", { name: "Je réserve une place" }).click();
    await expect(page.getByRole("button", { name: "Se désinscrire" })).toBeVisible();

    await logout(page);
    await login(page, "marius");
    await page.goto(`/events/${eventId}/edit`);
    await page.fill("#maxParticipants", "1");
    await page.getByRole("button", { name: "Enregistrer" }).click();

    await expect(page.getByText(/2 personnes sont déjà inscrites/)).toBeVisible();
    const apres = await one<{ maxParticipants: number }>('SELECT "maxParticipants" FROM "Event" WHERE id = $1', [eventId]);
    expect(apres.maxParticipants).toBe(4);
  });

  test("un autre membre ne peut pas ouvrir le formulaire de modification", async ({ page }) => {
    const event = await one<{ id: string; hostEmail: string }>(
      `SELECT e.id, u.email AS "hostEmail" FROM "Event" e
         JOIN "User" u ON u.id = e."hostId"
        WHERE e.status = 'ACTIVE' AND u.email = ANY($1::text[]) LIMIT 1`,
      [SEED_EMAILS],
    );
    const autre = await one<{ email: string }>(
      `SELECT email FROM "User" WHERE email = ANY($1::text[]) AND email <> $2 LIMIT 1`,
      [SEED_EMAILS, event.hostEmail],
    );

    await login(page, keyForEmail(autre.email));
    await page.goto(`/events/${event.id}/edit`);

    // Renvoyé sur la fiche, sans formulaire.
    await expect(page).toHaveURL(new RegExp(`/events/${event.id}$`));
    await expect(page.getByRole("button", { name: "Enregistrer" })).toHaveCount(0);
  });
});

test.describe("Gérer ma copie de jeu", () => {
  test("changer l'état puis retirer une copie de son étagère", async ({ page }) => {
    await login(page, "lea");
    const titre = `Copie jetable ${Date.now()}`;

    await page.goto("/shelf/new");
    await page.fill("#title", titre);
    await page.selectOption("#condition", "GOOD");
    await page.getByRole("button", { name: "Ajouter à mon étagère" }).click();
    await page.waitForURL(/\/games\//);
    const gameId = page.url().split("/games/")[1];

    await expect(page.getByText("Ma copie")).toBeVisible();
    await page.selectOption("#condition", "WORN");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.locator("#condition")).toHaveValue("WORN");

    const copie = await one<{ id: string; condition: string }>(
      'SELECT id, condition FROM "GameCopy" WHERE "gameId" = $1 AND "ownerId" = $2',
      [gameId, await userId("lea")],
    );
    expect(copie.condition).toBe("WORN");

    await page.getByRole("button", { name: "Retirer de mon étagère" }).click();
    await page.waitForURL(/\/shelf$/);
    expect(await rows('SELECT 1 FROM "GameCopy" WHERE id = $1', [copie.id])).toHaveLength(0);
  });

  test("une copie gardée au chaud reste gérable", async ({ page }) => {
    await login(page, "chloe");
    const copie = await one<{ gameId: string }>(
      `SELECT "gameId" FROM "GameCopy" WHERE "ownerId" = $1 AND status = 'KEPT_WARM' LIMIT 1`,
      [await userId("chloe")],
    );

    // Le panneau ne doit pas dépendre de la liste des copies « sur la table ».
    await page.goto(`/games/${copie.gameId}`);
    await expect(page.getByText("Ma copie")).toBeVisible();
    await expect(page.getByRole("button", { name: "Retirer de mon étagère" })).toBeVisible();
  });

  test("une copie engagée dans un échange ne peut pas être retirée", async ({ page }) => {
    // L'échange COMPLETED du seed a des copies en statut TRADED ; on prend
    // plutôt une proposition encore en cours.
    const item = await one<{ gameId: string; email: string }>(
      `SELECT c."gameId", u.email FROM "TradeItem" i
         JOIN "GameCopy" c ON c.id = i."gameCopyId"
         JOIN "User" u ON u.id = c."ownerId"
         JOIN "TradeProposal" t ON t.id = i."tradeProposalId"
        WHERE t.status IN ('PENDING', 'ACCEPTED') AND u.email = ANY($1::text[])
        LIMIT 1`,
      [SEED_EMAILS],
    );

    await login(page, keyForEmail(item.email));
    await page.goto(`/games/${item.gameId}`);
    await page.getByRole("button", { name: "Retirer de mon étagère" }).click();

    // L'action lève : la copie doit toujours exister.
    await page.waitForTimeout(1500);
    expect(
      await rows('SELECT 1 FROM "GameCopy" WHERE "gameId" = $1 AND "ownerId" = (SELECT id FROM "User" WHERE email = $2)', [
        item.gameId,
        item.email,
      ]),
    ).not.toHaveLength(0);
  });
});

test.describe("Gérer mes cartes", () => {
  test("les cartes recherchées sont visibles et retirables", async ({ page }) => {
    await login(page, "lea");
    const nom = `Carte cherchée ${Date.now()}`;

    await page.goto("/cards/new");
    await page.getByRole("button", { name: "Je la cherche" }).click();
    await page.fill("#name", nom);
    await page.getByRole("button", { name: "Ajouter à ma liste de recherche" }).click();
    await page.waitForURL((url) => url.pathname === "/cards");

    // Sans cet écran, une carte déclarée disparaissait de la vue pour toujours.
    await page.goto("/cards?tab=mine");
    await expect(page.getByText("Les cartes que je cherche")).toBeVisible();
    await expect(page.getByText(nom)).toBeVisible();

    await page.getByRole("button", { name: "Retirer" }).last().click();
    await expect(page.getByText(nom)).toHaveCount(0);
    expect(
      await rows('SELECT 1 FROM "CardWant" w JOIN "Card" c ON c.id = w."cardId" WHERE c.name = $1', [nom]),
    ).toHaveLength(0);
  });

  test("retirer un double de sa main", async ({ page }) => {
    await login(page, "lea");
    const nom = `Double jetable ${Date.now()}`;

    await page.goto("/cards/new");
    await page.getByRole("button", { name: "C'est un double" }).click();
    await page.fill("#name", nom);
    await page.getByRole("button", { name: "Ajouter à mes doubles" }).click();
    await page.waitForURL((url) => url.pathname === "/cards");

    await page.goto("/cards?tab=mine");
    await expect(page.getByText(nom)).toBeVisible();
    await page.getByRole("button", { name: "Retirer" }).first().click();
    await expect(page.getByText(nom)).toHaveCount(0);

    expect(
      await rows('SELECT 1 FROM "CardCopy" cc JOIN "Card" c ON c.id = cc."cardId" WHERE c.name = $1', [nom]),
    ).toHaveLength(0);
  });
});

test.describe("Pages d'erreur", () => {
  test("une adresse inconnue affiche la page 404 maison", async ({ page }) => {
    const reponse = await page.goto("/cette-page-n-existe-pas");
    expect(reponse?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Cette boîte est vide", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /Retour à l'accueil/ })).toBeVisible();
  });

  test("une ressource inexistante affiche aussi la page 404 maison", async ({ page }) => {
    await login(page, "chloe");
    const reponse = await page.goto("/clubs/inexistant");
    expect(reponse?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Cette boîte est vide", level: 1 })).toBeVisible();
  });
});
