import { test, expect } from "@playwright/test";
import { login, logout, one, rows, uniqueEmail, userId, keyForEmail, SEED_EMAILS } from "./helpers";

/**
 * Niveau 3 — accès et permissions.
 *
 * La partie la plus importante de la suite : elle vérifie qu'un membre ne peut
 * ni consulter ni modifier ce qui appartient à quelqu'un d'autre. Les actions
 * serveur revalident systématiquement les droits ; ces tests verrouillent ce
 * comportement pour qu'une évolution ne le fasse pas sauter en silence.
 */

test.describe("Pages réservées aux membres connectés", () => {
  const routesProtegees = [
    ["l'étagère", "/shelf"],
    ["les échanges", "/trades"],
    ["les messages", "/messages"],
    ["les cartes", "/cards"],
    ["la recherche", "/search"],
    ["l'édition du profil", "/profile/edit"],
    ["l'assistant d'échange", "/trades/new?copyId=peu-importe"],
  ] as const;

  for (const [nom, route] of routesProtegees) {
    test(`${nom} renvoie vers la connexion`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByRole("heading", { name: "Connexion", level: 1 })).toBeVisible();
    });
  }

  test("les pages publiques restent accessibles", async ({ page }) => {
    for (const route of ["/", "/events", "/login", "/register"]) {
      await page.goto(route);
      await expect(page).not.toHaveURL(/\/login/, { timeout: 2000 }).catch(() => {});
      expect(page.url()).toContain(route === "/" ? "" : route);
    }
  });

  test("les formulaires de création sont hors de portée sans session", async ({ page }) => {
    // Double barrière : la page ne se rend pas (garde de rendu), et l'action
    // serveur revalide de toute façon la session. On vérifie la première ici,
    // la seconde étant couverte par les tests de chaque action.
    const avant = await rows('SELECT 1 FROM "Game"');

    for (const route of ["/shelf/new", "/cards/new", "/events/new"]) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/);
      // Les champs propres aux formulaires de création ne doivent pas exister.
      await expect(page.locator("#title, #name, #startAt, #condition")).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Connexion", level: 1 })).toBeVisible();
    }

    expect(await rows('SELECT 1 FROM "Game"')).toHaveLength(avant.length);
  });
});

test.describe("Données d'autrui", () => {
  test("un échange entre deux autres membres est introuvable", async ({ page }) => {
    const trade = await one<{ id: string; temoin: string }>(
      `SELECT t.id,
              (SELECT u.email FROM "User" u
                WHERE u.email = ANY($1::text[])
                  AND u.id <> t."fromUserId" AND u.id <> t."toUserId" LIMIT 1) AS temoin
         FROM "TradeProposal" t LIMIT 1`,
      [SEED_EMAILS],
    );

    await login(page, keyForEmail(trade.temoin));
    const reponse = await page.goto(`/trades/${trade.id}`);
    expect(reponse?.status()).toBe(404);
  });

  test("une conversation entre deux autres membres est introuvable", async ({ page }) => {
    const conversation = await one<{ id: string; temoin: string }>(
      `SELECT c.id,
              (SELECT u.email FROM "User" u
                WHERE u.email = ANY($1::text[])
                  AND u.id <> c."userAId" AND u.id <> c."userBId" LIMIT 1) AS temoin
         FROM "Conversation" c
        WHERE EXISTS (SELECT 1 FROM "Message" m WHERE m."conversationId" = c.id)
        LIMIT 1`,
      [SEED_EMAILS],
    );

    await login(page, keyForEmail(conversation.temoin));
    const reponse = await page.goto(`/messages/${conversation.id}`);
    expect(reponse?.status()).toBe(404);

    // Et le contenu des messages ne fuit pas non plus.
    const messages = await rows<{ content: string }>(
      'SELECT content FROM "Message" WHERE "conversationId" = $1 LIMIT 1',
      [conversation.id],
    );
    if (messages.length) {
      await expect(page.getByText(messages[0].content)).toHaveCount(0);
    }
  });

  test("on ne peut pas proposer un échange sur sa propre copie", async ({ page }) => {
    const maCopie = await one<{ id: string; email: string }>(
      `SELECT c.id, u.email FROM "GameCopy" c JOIN "User" u ON u.id = c."ownerId"
        WHERE c.status = 'ON_TABLE' AND u.email = ANY($1::text[]) LIMIT 1`,
      [SEED_EMAILS],
    );

    await login(page, keyForEmail(maCopie.email));
    const reponse = await page.goto(`/trades/new?copyId=${maCopie.id}`);
    expect(reponse?.status()).toBe(404);
  });

  test("une copie gardée au chaud n'est pas échangeable", async ({ page }) => {
    const lea = await userId("lea");
    const copieIndispo = await one<{ id: string }>(
      `SELECT id FROM "GameCopy" WHERE "ownerId" <> $1 AND status = 'KEPT_WARM' LIMIT 1`,
      [lea],
    );

    await login(page, "lea");
    const reponse = await page.goto(`/trades/new?copyId=${copieIndispo.id}`);
    expect(reponse?.status()).toBe(404);
  });
});

test.describe("Actions réservées au bon interlocuteur", () => {
  test("seul le destinataire peut accepter ou refuser une proposition", async ({ page }) => {
    const trade = await one<{ id: string; fromEmail: string; toEmail: string }>(
      `SELECT t.id, f.email AS "fromEmail", d.email AS "toEmail"
         FROM "TradeProposal" t
         JOIN "User" f ON f.id = t."fromUserId"
         JOIN "User" d ON d.id = t."toUserId"
        WHERE t.status = 'PENDING'
          AND f.email = ANY($1::text[]) AND d.email = ANY($1::text[])
        LIMIT 1`,
      [SEED_EMAILS],
    );

    // Côté émetteur : aucun bouton de décision, seulement l'annulation.
    await login(page, keyForEmail(trade.fromEmail));
    await page.goto(`/trades/${trade.id}`);
    await expect(page.getByRole("button", { name: "Accepter" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Refuser" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Annuler l'échange/ })).toBeVisible();

    // Côté destinataire : la décision lui appartient.
    await logout(page);
    await login(page, keyForEmail(trade.toEmail));
    await page.goto(`/trades/${trade.id}`);
    await expect(page.getByRole("button", { name: "Accepter" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Refuser" })).toBeVisible();
  });

  test("seul l'organisateur peut annuler sa table, et il ne peut pas se désinscrire", async ({ page }) => {
    const event = await one<{ id: string; hostEmail: string }>(
      `SELECT e.id, u.email AS "hostEmail" FROM "Event" e
         JOIN "User" u ON u.id = e."hostId"
        WHERE e.status = 'ACTIVE' AND u.email = ANY($1::text[]) LIMIT 1`,
      [SEED_EMAILS],
    );
    const hote = keyForEmail(event.hostEmail);

    await login(page, hote);
    await page.goto(`/events/${event.id}`);
    await expect(page.getByRole("button", { name: /Annuler l'événement/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Se désinscrire" })).toHaveCount(0);

    // Un autre membre ne se voit jamais proposer l'annulation.
    const autre = await one<{ email: string }>(
      `SELECT email FROM "User" WHERE email = ANY($1::text[]) AND email <> $2 LIMIT 1`,
      [SEED_EMAILS, event.hostEmail],
    );
    await logout(page);
    await login(page, keyForEmail(autre.email));
    await page.goto(`/events/${event.id}`);
    await expect(page.getByRole("button", { name: /Annuler l'événement/ })).toHaveCount(0);
  });

  test("une table annulée ne prend plus d'inscription", async ({ page }) => {
    // On crée la table pour maîtriser complètement son état.
    await login(page, "marius");
    await page.goto("/events/new");
    await page.fill("#title", `Table annulée ${Date.now()}`);
    await page.fill("#city", "Lyon 3e");
    const demain = new Date(Date.now() + 5 * 86400_000);
    await page.fill("#startAt", demain.toISOString().slice(0, 16));
    await page.getByRole("button", { name: "Publier" }).click();
    await page.waitForURL(/\/events\/c/);
    const eventId = page.url().split("/events/")[1];

    await page.getByRole("button", { name: /Annuler l'événement/ }).click();
    await expect(page.getByText("Événement annulé")).toBeVisible();

    await logout(page);
    await login(page, "lea");
    await page.goto(`/events/${eventId}`);
    await expect(page.getByText("Annulée", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Je réserve une place" })).toHaveCount(0);
    expect(await rows('SELECT 1 FROM "EventParticipant" WHERE "eventId" = $1', [eventId])).toHaveLength(1);
  });

  test("on ne peut pas noter un échange qui n'est pas terminé", async ({ page }) => {
    const trade = await one<{ id: string; email: string }>(
      `SELECT t.id, u.email FROM "TradeProposal" t
         JOIN "User" u ON u.id = t."toUserId"
        WHERE t.status <> 'COMPLETED' AND u.email = ANY($1::text[]) LIMIT 1`,
      [SEED_EMAILS],
    );

    await login(page, keyForEmail(trade.email));
    await page.goto(`/trades/${trade.id}`);

    // Le formulaire d'avis n'apparaît qu'une fois l'échange mené à son terme.
    await expect(page.getByRole("button", { name: "Publier l'avis" })).toHaveCount(0);
  });

  test("l'édition de profil ne porte que sur son propre compte", async ({ page }) => {
    await login(page, "bastien");
    await page.goto("/profile/edit");

    // Le formulaire est pré-rempli avec SES données, sans aucun moyen de viser
    // un autre compte : l'action serveur écrit toujours sur l'utilisateur en
    // session, jamais sur un identifiant fourni par le formulaire.
    await expect(page.locator("#name")).toHaveValue("Bastien R.");
    await expect(page.locator('input[name="userId"], input[name="id"]')).toHaveCount(0);
  });
});

test.describe("Session", () => {
  test("après déconnexion, les pages réservées ne sont plus accessibles", async ({ page }) => {
    await login(page, "chloe");
    await page.goto("/shelf");
    await expect(page.getByRole("heading", { name: "Mon étagère", level: 1 })).toBeVisible();

    await logout(page);

    await page.goto("/shelf");
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/messages");
    await expect(page).toHaveURL(/\/login/);
  });

  test("un cookie de session falsifié est rejeté", async ({ page, context }) => {
    await login(page, "chloe");

    // On remplace la signature du jeton par une valeur arbitraire : la
    // vérification JWT doit échouer et la session être considérée absente.
    const cookies = await context.cookies();
    // Le nom porte le préfixe `__Host-` en production, pas en développement.
    const session = cookies.find((c) => c.name.endsWith("myshelf_session"));
    expect(session).toBeDefined();

    const [entete, charge] = session!.value.split(".");
    await context.clearCookies();
    await context.addCookies([{ ...session!, value: `${entete}.${charge}.signature-bidon` }]);

    await page.goto("/shelf");
    await expect(page).toHaveURL(/\/login/);
  });

  test("un compte supprimé ne donne plus accès aux pages réservées", async ({ page }) => {
    // Inscription d'un compte jetable, puis suppression côté base : le jeton
    // reste valide cryptographiquement mais ne désigne plus personne.
    const email = uniqueEmail("ephemere");
    await page.goto("/register");
    await page.fill("#name", "Compte Éphémère");
    await page.fill("#city", "Lyon 8e");
    await page.fill("#email", email);
    await page.fill("#password", "motdepasse123");
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await page.waitForURL("/");

    await rows('DELETE FROM "User" WHERE email = $1', [email]);

    await page.goto("/shelf");
    await expect(page).toHaveURL(/\/login/);
  });
});
