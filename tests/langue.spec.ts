import { test, expect } from "@playwright/test";
import { login, one, rows, uniqueEmail, userId, datetimeLocal, pgArray } from "./helpers";

/**
 * Langue de l'interface et langues de jeu.
 *
 * Deux notions distinctes qu'il ne faut pas confondre : la langue dans
 * laquelle on lit l'application, et celle dans laquelle on peut jouer à une
 * table donnée.
 */

test.describe("Langue de l'interface", () => {
  test("passer en anglais change réellement l'application", async ({ page }) => {
    await login(page, "amandine");
    const me = await userId("amandine");

    // Point de départ : français.
    await expect(page.getByRole("button", { name: "Déconnexion" }).first()).toBeVisible();

    await page.goto("/profile/edit");
    await page.selectOption("#locale", "EN");
    await page.getByRole("button", { name: "Enregistrer" }).click();

    // La navigation, les titres et les boutons suivent, pas seulement un écran.
    await expect(page.getByRole("button", { name: "Sign out" }).first()).toBeVisible();
    await page.goto("/shelf");
    await expect(page.getByRole("heading", { name: "My shelf", level: 1 })).toBeVisible();
    await page.goto("/trades");
    await expect(page.getByRole("heading", { name: "My trades", level: 1 })).toBeVisible();
    await page.goto("/notifications");
    await expect(page.getByRole("heading", { name: "Notifications", level: 1 })).toBeVisible();

    // Le choix est bien enregistré, pas seulement affiché.
    expect((await one<{ locale: string }>('SELECT locale FROM "User" WHERE id = $1', [me])).locale).toBe("EN");

    // Et l'attribut de langue du document suit : les lecteurs d'écran et la
    // correction orthographique s'appuient dessus.
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    // Retour au français.
    await page.goto("/profile/edit");
    await page.selectOption("#locale", "FR");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("button", { name: "Déconnexion" }).first()).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  });

  test("les messages de validation suivent la langue", async ({ page }) => {
    // Compte jetable : basculer un compte du seed en anglais laisserait les
    // tests suivants devant une interface qu'ils n'attendent pas.
    const email = uniqueEmail("validation");
    await page.goto("/register");
    await page.fill("#name", "Valid Ation");
    await page.fill("#city", "Lyon 9e");
    await page.fill("#email", email);
    await page.fill("#password", "motdepasse123");
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await page.waitForURL("/");

    await page.goto("/profile/edit");
    await page.selectOption("#locale", "EN");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByRole("button", { name: "Sign out" }).first()).toBeVisible();

    // Un nom trop court : l'erreur vient du serveur, elle doit être en anglais.
    await page.goto("/profile/edit");
    await expect(page.getByRole("heading", { name: "Edit my profile", level: 1 })).toBeVisible();
    await page.fill("#name", "A");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Your name needs at least 2 characters")).toBeVisible();
  });

  test("un visiteur déconnecté suit la langue de son navigateur", async ({ browser }) => {
    const contexte = await browser.newContext({ locale: "en-GB", extraHTTPHeaders: { "accept-language": "en-GB,en;q=0.9" } });
    const page = await contexte.newPage();

    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in", level: 1 })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    await contexte.close();
  });

  test("une notification est lue dans la langue du destinataire", async ({ page, browser }) => {
    // Léa écrit en français à un compte neuf qui lit en anglais.
    const email = uniqueEmail("anglophone");
    const contexte = await browser.newContext();
    const anglophone = await contexte.newPage();
    await anglophone.goto("/register");
    await anglophone.fill("#name", "English Reader");
    await anglophone.fill("#city", "Brighton");
    await anglophone.fill("#email", email);
    await anglophone.fill("#password", "motdepasse123");
    await anglophone.getByRole("button", { name: "Créer mon compte" }).click();
    await anglophone.waitForURL("/");
    await anglophone.goto("/profile/edit");
    await anglophone.selectOption("#locale", "EN");
    await anglophone.getByRole("button", { name: "Enregistrer" }).click();
    await expect(anglophone.getByRole("button", { name: "Sign out" }).first()).toBeVisible();

    const destinataire = await one<{ id: string }>('SELECT id FROM "User" WHERE email = $1', [email]);

    await login(page, "lea");
    await page.goto(`/profile/${destinataire.id}`);
    await page.getByRole("button", { name: "Écrire" }).click();
    await page.waitForURL(/\/messages\/c/);
    await page.fill('input[name="content"]', "Bonjour !");
    await page.getByRole("button", { name: "Envoyer" }).click();
    await expect(page.getByText("Bonjour !")).toBeVisible();

    // C'est le lecteur qui compte, pas l'auteur : le texte est stocké sous
    // forme de clé, pas figé dans la langue de qui a déclenché l'action.
    await anglophone.goto("/notifications");
    await expect(anglophone.getByText("Message from Léa D.")).toBeVisible();
    await expect(anglophone.getByText("Bonjour !")).toBeVisible();

    await contexte.close();
  });
});

test.describe("Langues de jeu d'une table", () => {
  test("choisir les langues à la création et les retrouver sur la fiche", async ({ page }) => {
    await login(page, "marius");
    const titre = `Table bilingue ${Date.now()}`;

    await page.goto("/events/new");
    await page.fill("#title", titre);
    await page.fill("#city", "Lyon 3e");
    await page.fill("#startAt", datetimeLocal(9, 19));
    // Français est coché par défaut ; on ajoute l'anglais.
    await page.getByRole("button", { name: "English" }).click();
    await page.getByRole("button", { name: "Publier" }).click();

    await page.waitForURL(/\/events\/c/);
    const eventId = page.url().split("/events/")[1];
    await expect(page.getByText("On joue en Français · English")).toBeVisible();

    const event = await one<{ languages: unknown }>('SELECT languages FROM "Event" WHERE id = $1', [eventId]);
    expect(pgArray(event.languages).sort()).toEqual(["EN", "FR"]);
  });

  test("on ne peut pas retirer la dernière langue", async ({ page }) => {
    await login(page, "marius");
    await page.goto("/events/new");

    const francais = page.getByRole("button", { name: "Français" });
    await expect(francais).toHaveAttribute("aria-pressed", "true");

    // Cliquer sur la seule langue cochée ne doit pas la décocher : une table
    // sans langue de jeu n'a pas de sens.
    await francais.click();
    await expect(francais).toHaveAttribute("aria-pressed", "true");
  });

  test("les langues sont modifiables et pré-cochées à l'édition", async ({ page }) => {
    await login(page, "marius");
    const titre = `Table à retraduire ${Date.now()}`;

    await page.goto("/events/new");
    await page.fill("#title", titre);
    await page.fill("#city", "Lyon 3e");
    await page.fill("#startAt", datetimeLocal(9, 19));
    await page.getByRole("button", { name: "English" }).click();
    await page.getByRole("button", { name: "Publier" }).click();
    await page.waitForURL(/\/events\/c/);
    const eventId = page.url().split("/events/")[1];

    await page.goto(`/events/${eventId}/edit`);
    // Sans pré-cochage, enregistrer effacerait silencieusement un choix.
    await expect(page.getByRole("button", { name: "Français" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Français" }).click();
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL(new RegExp(`/events/${eventId}$`));

    await expect(page.getByText("On joue en English")).toBeVisible();
    expect(pgArray((await one<{ languages: unknown }>('SELECT languages FROM "Event" WHERE id = $1', [eventId])).languages)).toEqual(["EN"]);
  });

  test("les langues d'une table apparaissent aussi dans la liste", async ({ page }) => {
    await login(page, "chloe");
    await page.goto("/events");
    // Le jeu de démonstration donne des langues à chaque table.
    expect(await page.getByText(/On joue en/).count()).toBeGreaterThan(0);
    expect(await rows(`SELECT 1 FROM "Event" WHERE array_length(languages, 1) > 0`)).not.toHaveLength(0);
  });
});
