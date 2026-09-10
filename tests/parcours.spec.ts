import { test, expect } from "@playwright/test";
import { login, logout, one, rows, uniqueEmail, userId, datetimeLocal, keyForEmail, USERS, SEED_EMAILS } from "./helpers";

/**
 * Niveau 2 — parcours bout en bout.
 *
 * Chaque test suit un vrai scénario utilisateur, du clic jusqu'à l'état en
 * base. On vérifie systématiquement les deux : ce que l'écran affiche, et ce
 * que le serveur a réellement enregistré — un écran peut mentir, pas la base.
 */

test.describe("Compte", () => {
  test("inscription, déconnexion, reconnexion", async ({ page }) => {
    const email = uniqueEmail("nouveau");

    await page.goto("/register");
    await page.fill("#name", "Camille Test");
    await page.fill("#city", "Lyon 6e");
    await page.fill("#email", email);
    await page.fill("#password", "motdepasse123");
    await page.getByRole("button", { name: "Créer mon compte" }).click();

    await page.waitForURL("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Camille");

    const created = await one<{ name: string; city: string }>(
      'SELECT name, city FROM "User" WHERE email = $1',
      [email],
    );
    expect(created.name).toBe("Camille Test");
    expect(created.city).toBe("Lyon 6e");

    await logout(page);
    await page.goto("/shelf");
    await expect(page).toHaveURL(/\/login/);

    await page.fill("#email", email);
    await page.fill("#password", "motdepasse123");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await page.waitForURL("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Camille");
  });

  test("un mot de passe erroné est refusé sans révéler si le compte existe", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", USERS.chloe.email);
    await page.fill("#password", "mauvais-mot-de-passe");
    await page.getByRole("button", { name: "Se connecter" }).click();

    await expect(page.getByText(/incorrect/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("une inscription avec un e-mail déjà pris est refusée", async ({ page }) => {
    await page.goto("/register");
    await page.fill("#name", "Doublon");
    await page.fill("#city", "Lyon 1er");
    await page.fill("#email", USERS.chloe.email);
    await page.fill("#password", "motdepasse123");
    await page.getByRole("button", { name: "Créer mon compte" }).click();

    await expect(page.getByText("Un compte existe déjà avec cet e-mail")).toBeVisible();
    await expect(page).toHaveURL(/\/register/);
  });

  test("un mot de passe trop court ne crée pas de compte", async ({ page }) => {
    const email = uniqueEmail("court");

    await page.goto("/register");
    await page.fill("#name", "Trop Court");
    await page.fill("#city", "Lyon 1er");
    await page.fill("#email", email);
    await page.fill("#password", "1234");
    await page.getByRole("button", { name: "Créer mon compte" }).click();

    // Le champ porte minLength=8 : le navigateur bloque l'envoi. On reste donc
    // sur le formulaire et, surtout, aucun compte n'est créé.
    await expect(page).toHaveURL(/\/register/);
    expect(await rows('SELECT 1 FROM "User" WHERE email = $1', [email])).toHaveLength(0);
  });
});

test.describe("Étagère", () => {
  test.beforeEach(async ({ page }) => login(page, "lea"));

  test("ajouter un jeu le fait apparaître sur l'étagère et sur sa fiche", async ({ page }) => {
    const titre = `Jeu de test ${Date.now()}`;

    await page.goto("/shelf/new");
    await page.fill("#title", titre);
    await page.selectOption("#category", "BOARD_GAME");
    await page.selectOption("#condition", "LIKE_NEW");
    await page.fill("#minPlayers", "2");
    await page.fill("#maxPlayers", "4");
    await page.fill("#durationMin", "45");
    await page.getByRole("button", { name: "Ajouter à mon étagère" }).click();

    await page.waitForURL(/\/games\//);
    await expect(page.getByRole("heading", { name: titre, level: 1 })).toBeVisible();

    await page.goto("/shelf");
    await expect(page.getByText(titre)).toBeVisible();

    const copy = await one<{ status: string; ownerId: string }>(
      `SELECT c.status, c."ownerId" FROM "GameCopy" c
         JOIN "Game" g ON g.id = c."gameId" WHERE g.title = $1`,
      [titre],
    );
    expect(copy.status).toBe("ON_TABLE");
    expect(copy.ownerId).toBe(await userId("lea"));
  });

  test("basculer une copie entre la table d'échange et « gardée au chaud »", async ({ page }) => {
    const me = await userId("lea");
    const copy = await one<{ id: string; title: string }>(
      `SELECT c.id, g.title FROM "GameCopy" c JOIN "Game" g ON g.id = c."gameId"
        WHERE c."ownerId" = $1 AND c.status = 'ON_TABLE' LIMIT 1`,
      [me],
    );

    await page.goto("/shelf");
    const carte = page.locator(`[data-copy-id="${copy.id}"]`);
    await expect(carte).toContainText(copy.title);
    await expect(carte.getByRole("button")).toHaveText(/Sur la table/);

    await carte.getByRole("button").click();
    await expect(carte.getByRole("button")).toHaveText(/Gardée au chaud/);

    const apres = await one<{ status: string }>('SELECT status FROM "GameCopy" WHERE id = $1', [copy.id]);
    expect(apres.status).toBe("KEPT_WARM");

    // Et la bascule fonctionne dans l'autre sens.
    await carte.getByRole("button").click();
    await expect(carte.getByRole("button")).toHaveText(/Sur la table/);
    expect((await one<{ status: string }>('SELECT status FROM "GameCopy" WHERE id = $1', [copy.id])).status).toBe("ON_TABLE");
  });

  test("ajouter puis retirer un jeu de la liste de souhaits", async ({ page }) => {
    const me = await userId("lea");
    const game = await one<{ id: string; title: string }>(
      `SELECT g.id, g.title FROM "Game" g
        WHERE NOT EXISTS (SELECT 1 FROM "GameCopy" c WHERE c."gameId" = g.id AND c."ownerId" = $1)
          AND NOT EXISTS (SELECT 1 FROM "GameWant" w WHERE w."gameId" = g.id AND w."userId" = $1)
        LIMIT 1`,
      [me],
    );

    await page.goto(`/games/${game.id}`);
    await page.getByRole("button", { name: /Ajouter à ma liste/ }).click();
    await expect(page.getByRole("button", { name: /Dans ma liste/ })).toBeVisible();

    expect(await rows('SELECT 1 FROM "GameWant" WHERE "gameId" = $1 AND "userId" = $2', [game.id, me])).toHaveLength(1);

    await page.goto("/shelf?tab=wishlist");
    await expect(page.getByText(game.title)).toBeVisible();
    await page.getByRole("button", { name: "Retirer" }).first().click();
    await expect(page.getByText(game.title)).toHaveCount(0);

    expect(await rows('SELECT 1 FROM "GameWant" WHERE "gameId" = $1 AND "userId" = $2', [game.id, me])).toHaveLength(0);
  });
});

test.describe("Échange complet", () => {
  test("proposer, accepter, terminer et laisser un avis", async ({ page }) => {
    const bastien = await userId("bastien");
    const amandine = await userId("amandine");

    // Une copie posée sur la table d'échange par Amandine, que Bastien convoite.
    const cible = await one<{ id: string; title: string }>(
      `SELECT c.id, g.title FROM "GameCopy" c JOIN "Game" g ON g.id = c."gameId"
        WHERE c."ownerId" = $1 AND c.status = 'ON_TABLE' LIMIT 1`,
      [amandine],
    );

    // Bastien a besoin d'au moins un jeu à offrir en retour.
    await login(page, "bastien");
    const titreOffert = `Offrande ${Date.now()}`;
    await page.goto("/shelf/new");
    await page.fill("#title", titreOffert);
    await page.getByRole("button", { name: "Ajouter à mon étagère" }).click();
    await page.waitForURL(/\/games\//);

    // Étape 1 : choisir ce qu'on met sur la table, étape 2 : le mot d'accompagnement.
    await page.goto(`/trades/new?copyId=${cible.id}`);
    await page.getByRole("button", { name: titreOffert }).click();
    await page.getByRole("button", { name: "Continuer" }).click();
    await page.fill('textarea[name="message"]', "Ça t'intéresse ?");
    await page.getByRole("button", { name: "Envoyer la proposition" }).click();

    await page.waitForURL(/\/trades\/c/);
    const tradeUrl = page.url();
    const tradeId = tradeUrl.split("/trades/")[1];

    let trade = await one<{ status: string; fromUserId: string; toUserId: string }>(
      'SELECT status, "fromUserId", "toUserId" FROM "TradeProposal" WHERE id = $1',
      [tradeId],
    );
    expect(trade.status).toBe("PENDING");
    expect(trade.fromUserId).toBe(bastien);
    expect(trade.toUserId).toBe(amandine);

    // Le destinataire ne voit pas les mêmes boutons que l'émetteur.
    await expect(page.getByRole("button", { name: "Accepter" })).toHaveCount(0);

    // Amandine accepte : les copies passent « en cours d'échange ».
    await logout(page);
    await login(page, "amandine");
    await page.goto(tradeUrl);
    await page.getByRole("button", { name: "Accepter" }).click();
    // On attend le changement d'état à l'écran plutôt qu'un « réseau au repos » :
    // seul cela garantit que l'action serveur est allée au bout.
    await expect(page.getByRole("button", { name: "Marquer comme terminé" })).toBeVisible();

    trade = await one('SELECT status, "fromUserId", "toUserId" FROM "TradeProposal" WHERE id = $1', [tradeId]);
    expect(trade.status).toBe("ACCEPTED");
    const enCours = await rows<{ status: string }>(
      `SELECT c.status FROM "GameCopy" c
         JOIN "TradeItem" i ON i."gameCopyId" = c.id WHERE i."tradeProposalId" = $1`,
      [tradeId],
    );
    expect(enCours.map((c) => c.status)).toEqual(["IN_TRADE", "IN_TRADE"]);

    // Puis on marque l'échange terminé : les copies deviennent « échangées ».
    await page.getByRole("button", { name: "Marquer comme terminé" }).click();
    await expect(page.getByRole("button", { name: "Publier l'avis" })).toBeVisible();

    trade = await one('SELECT status, "fromUserId", "toUserId" FROM "TradeProposal" WHERE id = $1', [tradeId]);
    expect(trade.status).toBe("COMPLETED");
    const echangees = await rows<{ status: string }>(
      `SELECT c.status FROM "GameCopy" c
         JOIN "TradeItem" i ON i."gameCopyId" = c.id WHERE i."tradeProposalId" = $1`,
      [tradeId],
    );
    expect(echangees.map((c) => c.status)).toEqual(["TRADED", "TRADED"]);

    // L'avis n'est proposé qu'une fois l'échange terminé.
    await page.getByRole("button", { name: /4 étoiles/ }).click();
    await page.fill('textarea[name="comment"]', "Ponctuel et sympa, rendez-vous devant la boutique.");
    await page.getByRole("button", { name: "Publier l'avis" }).click();
    await expect(page.getByText("Ponctuel et sympa, rendez-vous devant la boutique.")).toBeVisible();

    const avis = await one<{ rating: number; toUserId: string; context: string }>(
      'SELECT rating, "toUserId", context FROM "Review" WHERE "tradeId" = $1',
      [tradeId],
    );
    expect(avis.rating).toBe(4);
    expect(avis.toUserId).toBe(bastien);
    expect(avis.context).toContain("Échange");

    // Un second avis sur le même échange est impossible : le formulaire laisse
    // place à l'avis publié, en lecture seule.
    await page.reload();
    await expect(page.getByRole("button", { name: "Publier l'avis" })).toHaveCount(0);
    await expect(page.getByText("Ton avis")).toBeVisible();

    // Et l'avis remonte bien sur le profil de la personne notée.
    await page.goto(`/profile/${bastien}`);
    await expect(page.getByText("Ponctuel et sympa, rendez-vous devant la boutique.")).toBeVisible();
  });

  test("refuser une proposition la clôt sans bloquer les copies", async ({ page }) => {
    const marius = await userId("marius");
    const cible = await one<{ id: string }>(
      `SELECT c.id FROM "GameCopy" c WHERE c."ownerId" = $1 AND c.status = 'ON_TABLE' LIMIT 1`,
      [marius],
    );

    await login(page, "lea");
    const titreOffert = `Refusé ${Date.now()}`;
    await page.goto("/shelf/new");
    await page.fill("#title", titreOffert);
    await page.getByRole("button", { name: "Ajouter à mon étagère" }).click();
    await page.waitForURL(/\/games\//);

    await page.goto(`/trades/new?copyId=${cible.id}`);
    await page.getByRole("button", { name: titreOffert }).click();
    await page.getByRole("button", { name: "Continuer" }).click();
    await page.getByRole("button", { name: "Envoyer la proposition" }).click();
    await page.waitForURL(/\/trades\/c/);
    const tradeId = page.url().split("/trades/")[1];

    await logout(page);
    await login(page, "marius");
    await page.goto(`/trades/${tradeId}`);
    await page.getByRole("button", { name: "Refuser" }).click();
    await expect(page.getByRole("button", { name: "Accepter" })).toHaveCount(0);

    const trade = await one<{ status: string }>('SELECT status FROM "TradeProposal" WHERE id = $1', [tradeId]);
    expect(trade.status).toBe("REJECTED");

    // Un refus ne doit pas immobiliser les jeux : ils restent disponibles.
    const copies = await rows<{ status: string }>(
      `SELECT c.status FROM "GameCopy" c
         JOIN "TradeItem" i ON i."gameCopyId" = c.id WHERE i."tradeProposalId" = $1`,
      [tradeId],
    );
    expect(copies.every((c) => c.status === "ON_TABLE")).toBe(true);
  });
});

test.describe("Tables", () => {
  test("ouvrir une table, s'y inscrire, s'en désinscrire, l'annuler", async ({ page }) => {
    const titre = `Table de test ${Date.now()}`;

    await login(page, "marius");
    await page.goto("/events/new");
    await page.fill("#title", titre);
    await page.getByRole("button", { name: "Jeu de rôle" }).click();
    await page.getByRole("button", { name: "Débutant" }).click();
    await page.fill("#description", "Une partie d'initiation, on explique tout.");
    await page.fill("#city", "Lyon 3e");
    await page.fill("#location", "Chez Marius");
    await page.fill("#startAt", datetimeLocal(10, 19));
    await page.fill("#maxParticipants", "4");
    await page.getByRole("button", { name: "Publier" }).click();

    await page.waitForURL(/\/events\/c/);
    const eventId = page.url().split("/events/")[1];
    await expect(page.getByRole("heading", { name: titre, level: 1 })).toBeVisible();

    const event = await one<{ hostId: string; type: string; level: string; maxParticipants: number }>(
      'SELECT "hostId", type, level, "maxParticipants" FROM "Event" WHERE id = $1',
      [eventId],
    );
    expect(event.hostId).toBe(await userId("marius"));
    expect(event.type).toBe("ROLE_PLAYING");
    expect(event.level).toBe("BEGINNER");
    expect(event.maxParticipants).toBe(4);

    // L'organisateur est inscrit d'office et ne peut pas se désinscrire.
    expect(await rows('SELECT 1 FROM "EventParticipant" WHERE "eventId" = $1', [eventId])).toHaveLength(1);
    await expect(page.getByRole("button", { name: "Se désinscrire" })).toHaveCount(0);

    // Léa réserve une place, puis se ravise.
    await logout(page);
    await login(page, "lea");
    await page.goto(`/events/${eventId}`);
    await page.getByRole("button", { name: "Je réserve une place" }).click();
    await expect(page.getByRole("button", { name: "Se désinscrire" })).toBeVisible();
    expect(await rows('SELECT 1 FROM "EventParticipant" WHERE "eventId" = $1', [eventId])).toHaveLength(2);

    await page.getByRole("button", { name: "Se désinscrire" }).click();
    await expect(page.getByRole("button", { name: "Je réserve une place" })).toBeVisible();
    expect(await rows('SELECT 1 FROM "EventParticipant" WHERE "eventId" = $1', [eventId])).toHaveLength(1);

    // Seul l'organisateur peut annuler.
    await logout(page);
    await login(page, "marius");
    await page.goto(`/events/${eventId}`);
    await page.getByRole("button", { name: /Annuler l'événement/ }).click();
    await expect(page.getByText("Événement annulé")).toBeVisible();

    const annulee = await one<{ status: string }>('SELECT status FROM "Event" WHERE id = $1', [eventId]);
    expect(annulee.status).toBe("CANCELLED");
  });

  test("une date passée est refusée", async ({ page }) => {
    await login(page, "marius");
    await page.goto("/events/new");
    await page.fill("#title", "Table dans le passé");
    await page.fill("#city", "Lyon 3e");
    await page.fill("#startAt", datetimeLocal(-5, 19));
    await page.getByRole("button", { name: "Publier" }).click();

    await expect(page.getByText("La date doit être dans le futur")).toBeVisible();
    await expect(page).toHaveURL(/\/events\/new/);
  });

  test("laisser un avis sur une table à laquelle on a participé", async ({ page }) => {
    const chloe = await userId("chloe");

    // Une table de Chloé où il reste de la place, et un compte du seed qui n'y
    // est pas encore inscrit : on construit la situation plutôt que de la
    // supposer, pour que le test résiste aux évolutions du jeu de démonstration.
    const event = await one<{ id: string }>(
      `SELECT e.id FROM "Event" e
        WHERE e."hostId" = $1 AND e.status = 'ACTIVE'
          AND (e."maxParticipants" IS NULL
               OR (SELECT count(*) FROM "EventParticipant" p WHERE p."eventId" = e.id) < e."maxParticipants")
        LIMIT 1`,
      [chloe],
    );
    const invite = await one<{ email: string }>(
      `SELECT u.email FROM "User" u
        WHERE u.email = ANY($1::text[]) AND u.id <> $2
          AND NOT EXISTS (SELECT 1 FROM "EventParticipant" p WHERE p."eventId" = $3 AND p."userId" = u.id)
        LIMIT 1`,
      [SEED_EMAILS, chloe, event.id],
    );
    const participant = keyForEmail(invite.email);

    await login(page, participant);
    await page.goto(`/events/${event.id}`);

    // Tant qu'on n'a pas participé, aucun formulaire d'avis n'est proposé.
    await expect(page.getByRole("button", { name: "Publier l'avis" })).toHaveCount(0);

    await page.getByRole("button", { name: "Je réserve une place" }).click();
    await expect(page.getByRole("button", { name: "Se désinscrire" })).toBeVisible();

    await page.getByRole("button", { name: /5 étoiles/ }).click();
    await page.fill('textarea[name="comment"]', "Accueil au top pour une découverte.");
    await page.getByRole("button", { name: "Publier l'avis" }).click();

    await expect(page.getByText("Accueil au top pour une découverte.")).toBeVisible();
    const avis = await one<{ rating: number; toUserId: string }>(
      'SELECT rating, "toUserId" FROM "Review" WHERE "eventId" = $1 AND "fromUserId" = $2',
      [event.id, await userId(participant)],
    );
    expect(avis.rating).toBe(5);
    expect(avis.toUserId).toBe(chloe);
  });
});

test.describe("Cartes", () => {
  test.beforeEach(async ({ page }) => login(page, "lea"));

  test("déclarer un double puis une carte recherchée", async ({ page }) => {
    const me = await userId("lea");
    const double = `Double ${Date.now()}`;

    await page.goto("/cards/new");
    await page.getByRole("button", { name: "C'est un double" }).click();
    await page.fill("#name", double);
    await page.fill("#setName", "Cendres du Nord");
    await page.selectOption("#rarity", "RARE");
    await page.getByRole("button", { name: "Ajouter à mes doubles" }).click();
    await page.waitForURL((url) => url.pathname === "/cards");

    const copie = await one<{ status: string; ownerId: string }>(
      `SELECT cc.status, cc."ownerId" FROM "CardCopy" cc
         JOIN "Card" c ON c.id = cc."cardId" WHERE c.name = $1`,
      [double],
    );
    expect(copie.status).toBe("ON_TABLE");
    expect(copie.ownerId).toBe(me);

    const recherchee = `Recherchée ${Date.now()}`;
    await page.goto("/cards/new");
    await page.getByRole("button", { name: "Je la cherche" }).click();
    await page.fill("#name", recherchee);
    await page.getByRole("button", { name: "Ajouter à ma liste de recherche" }).click();
    await page.waitForURL((url) => url.pathname === "/cards");

    expect(
      await rows(
        `SELECT 1 FROM "CardWant" w JOIN "Card" c ON c.id = w."cardId"
          WHERE c.name = $1 AND w."userId" = $2`,
        [recherchee, me],
      ),
    ).toHaveLength(1);
  });
});

test.describe("Messages", () => {
  test("écrire à un membre depuis son profil crée la conversation", async ({ page }) => {
    const lea = await userId("lea");
    const amandine = await userId("amandine");

    await login(page, "amandine");
    await page.goto(`/profile/${lea}`);
    await page.getByRole("button", { name: "Écrire" }).click();
    await page.waitForURL(/\/messages\/c/);

    const texte = `Bonjour Léa, message de test ${Date.now()}`;
    await page.fill('input[name="content"]', texte);
    await page.getByRole("button", { name: "Envoyer" }).click();
    await expect(page.getByText(texte)).toBeVisible();

    const message = await one<{ senderId: string }>(
      'SELECT "senderId" FROM "Message" WHERE content = $1',
      [texte],
    );
    expect(message.senderId).toBe(amandine);

    // Et la conversation remonte dans la liste des deux côtés.
    await page.goto("/messages");
    await expect(page.getByText(USERS.lea.name).first()).toBeVisible();

    await logout(page);
    await login(page, "lea");
    await page.goto("/messages");
    await expect(page.getByText(texte)).toBeVisible();
  });

  test("un message vide n'est pas enregistré", async ({ page }) => {
    const me = await userId("chloe");
    await login(page, "chloe");
    const conversation = await one<{ id: string }>(
      'SELECT id FROM "Conversation" WHERE "userAId" = $1 OR "userBId" = $1 LIMIT 1',
      [me],
    );
    const avant = await rows('SELECT 1 FROM "Message" WHERE "conversationId" = $1', [conversation.id]);

    await page.goto(`/messages/${conversation.id}`);
    await page.fill('input[name="content"]', "   ");
    await page.getByRole("button", { name: "Envoyer" }).click();
    await page.waitForLoadState("networkidle");
    await page.reload();

    const apres = await rows('SELECT 1 FROM "Message" WHERE "conversationId" = $1', [conversation.id]);
    expect(apres).toHaveLength(avant.length);
  });
});

test.describe("Profil et recherche", () => {
  test("modifier son profil met à jour l'affichage public", async ({ page }) => {
    await login(page, "amandine");
    const me = await userId("amandine");
    const bio = `Bio mise à jour ${Date.now()}`;

    await page.goto("/profile/edit");
    await page.fill("#city", "Villeurbanne");
    await page.fill("#bio", bio);
    await page.selectOption("#experienceLevel", "CONFIRMED");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText(bio)).toBeVisible();

    const user = await one<{ city: string; bio: string; experienceLevel: string }>(
      'SELECT city, bio, "experienceLevel" FROM "User" WHERE id = $1',
      [me],
    );
    expect(user.city).toBe("Villeurbanne");
    expect(user.bio).toBe(bio);
    expect(user.experienceLevel).toBe("CONFIRMED");

    await page.goto(`/profile/${me}`);
    await expect(page.getByText(bio)).toBeVisible();
    await expect(page.getByText(/Villeurbanne/)).toBeVisible();
  });

  test("un nom vide est refusé à l'édition du profil", async ({ page }) => {
    await login(page, "amandine");
    await page.goto("/profile/edit");
    await page.fill("#name", "A");
    await page.getByRole("button", { name: "Enregistrer" }).click();

    await expect(page.getByText("Le nom doit faire au moins 2 caractères")).toBeVisible();
  });

  test("les filtres de recherche réduisent les résultats", async ({ page }) => {
    await login(page, "chloe");
    await page.goto("/search");

    const totalTexte = await page.getByText(/résultats? dans un rayon/).innerText();
    const total = Number(totalTexte.match(/^\d+/)?.[0] ?? 0);
    expect(total).toBeGreaterThan(0);

    await page.getByRole("link", { name: "Table", exact: true }).click();
    await page.waitForLoadState("networkidle");

    const filtreTexte = await page.getByText(/résultats? dans un rayon/).innerText();
    const filtre = Number(filtreTexte.match(/^\d+/)?.[0] ?? 0);
    expect(filtre).toBeGreaterThan(0);
    expect(filtre).toBeLessThan(total);

    // Filtré sur « Table », il ne doit plus rester que des tables : les jeux et
    // les cartes ont leurs propres liens, ils doivent avoir disparu.
    expect(await page.locator('a[href^="/events/"]').count()).toBeGreaterThan(0);
    expect(await page.locator('a[href^="/games/"]').count()).toBe(0);
  });
});
