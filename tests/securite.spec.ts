import { test, expect } from "@playwright/test";
import { login, rows, uniqueEmail, USERS, SEED_PASSWORD } from "./helpers";

/**
 * Durcissement : limitation des tentatives de connexion, en-têtes HTTP,
 * comportement du cookie de session.
 */

test.describe("Limitation des tentatives de connexion", () => {
  async function tenterConnexion(page: import("@playwright/test").Page, email: string, motDePasse: string) {
    await page.goto("/login");
    await page.fill("#email", email);
    await page.fill("#password", motDePasse);
    await page.getByRole("button", { name: "Se connecter" }).click();
  }

  test("après cinq échecs, la connexion est temporairement bloquée", async ({ page }) => {
    // Compte jetable : bloquer un compte du seed gênerait les tests suivants.
    const email = uniqueEmail("brute");
    await page.goto("/register");
    await page.fill("#name", "Cible Brute");
    await page.fill("#city", "Lyon 4e");
    await page.fill("#email", email);
    await page.fill("#password", "motdepasse123");
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await page.waitForURL("/");
    await page.getByRole("button", { name: "Déconnexion" }).first().click();
    await page.waitForURL(/\/login$/);

    for (let i = 0; i < 5; i++) {
      await tenterConnexion(page, email, "mauvais-mot-de-passe");
      await expect(page.getByText("E-mail ou mot de passe incorrect")).toBeVisible();
    }

    // Le sixième essai n'atteint même plus la vérification du mot de passe.
    await tenterConnexion(page, email, "mauvais-mot-de-passe");
    await expect(page.getByText(/Trop de tentatives/)).toBeVisible();

    // Et le bon mot de passe est refusé lui aussi tant que la fenêtre court :
    // c'est le prix à payer pour freiner une attaque par force brute.
    await tenterConnexion(page, email, "motdepasse123");
    await expect(page.getByText(/Trop de tentatives/)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);

    // Cinq, pas sept : une tentative déjà bloquée n'est pas enregistrée. Sinon
    // un attaquant maintiendrait sa victime enfermée dehors indéfiniment en
    // continuant de frapper, au lieu de voir la fenêtre expirer.
    expect(await rows('SELECT 1 FROM "LoginAttempt" WHERE email = $1 AND succeeded = false', [email])).toHaveLength(5);
  });

  test("une connexion réussie efface les échecs précédents", async ({ page }) => {
    const email = USERS.bastien.email;

    for (let i = 0; i < 3; i++) {
      await tenterConnexion(page, email, "presque-le-bon");
      await expect(page.getByText("E-mail ou mot de passe incorrect")).toBeVisible();
    }
    expect(await rows('SELECT 1 FROM "LoginAttempt" WHERE email = $1 AND succeeded = false', [email])).toHaveLength(3);

    await tenterConnexion(page, email, SEED_PASSWORD);
    await page.waitForURL("/");

    // Sinon, après trois fautes de frappe on resterait à un essai du blocage
    // pendant un quart d'heure, alors qu'on a prouvé qu'on était le titulaire.
    expect(await rows('SELECT 1 FROM "LoginAttempt" WHERE email = $1 AND succeeded = false', [email])).toHaveLength(0);
  });

  test("un e-mail inconnu est compté aussi", async ({ page }) => {
    const inconnu = uniqueEmail("fantome");
    await tenterConnexion(page, inconnu, "peu-importe");
    await expect(page.getByText("E-mail ou mot de passe incorrect")).toBeVisible();

    // Sans cela, il suffirait de balayer des adresses au hasard sans jamais
    // être freiné. Le message reste identique : il ne révèle pas qui a un compte.
    expect(await rows('SELECT 1 FROM "LoginAttempt" WHERE email = $1', [inconnu])).toHaveLength(1);
  });
});

test.describe("En-têtes HTTP", () => {
  test("les en-têtes de sécurité sont présents", async ({ page }) => {
    const reponse = await page.goto("/login");
    const headers = reponse!.headers();

    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["content-security-policy"]).toContain("object-src 'none'");
    expect(headers["permissions-policy"]).toContain("camera=()");

    // Cet en-tête annonce la version du serveur sans rien apporter.
    expect(headers["x-powered-by"]).toBeUndefined();
  });

  test("la politique de contenu n'autorise pas eval en production", async ({ page }) => {
    // La suite tourne sur un build de production : `unsafe-eval` ne doit pas
    // y figurer, il ne sert qu'au rechargement à chaud en développement.
    const reponse = await page.goto("/login");
    expect(reponse!.headers()["content-security-policy"]).not.toContain("unsafe-eval");
  });
});

test.describe("Cookie de session", () => {
  test("le cookie est httpOnly, restreint au site et non lisible en JavaScript", async ({ page, context }) => {
    await login(page, "chloe");

    const session = (await context.cookies()).find((c) => c.name.endsWith("myshelf_session"));
    expect(session).toBeDefined();
    expect(session!.httpOnly).toBe(true);
    expect(session!.sameSite).toBe("Lax");
    expect(session!.path).toBe("/");

    // Une faille XSS ne doit pas suffire à voler la session.
    const visibleEnJs = await page.evaluate(() => document.cookie);
    expect(visibleEnJs).not.toContain("myshelf_session");
  });

  test("la déconnexion efface réellement le cookie", async ({ page, context }) => {
    await login(page, "chloe");
    await page.getByRole("button", { name: "Déconnexion" }).first().click();
    await page.waitForURL(/\/login$/);

    // Un cookie préfixé `__Host-` ne s'efface que si les attributs concordent :
    // sans cela la session survivait à la déconnexion.
    const session = (await context.cookies()).find((c) => c.name.endsWith("myshelf_session"));
    expect(session?.value ?? "").toBe("");

    await page.goto("/shelf");
    await expect(page).toHaveURL(/\/login/);
  });
});
