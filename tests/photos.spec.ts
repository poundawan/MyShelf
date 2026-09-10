import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { login, one, rows, uniqueEmail, datetimeLocal } from "./helpers";
import { inspecterImage } from "../src/lib/image-header";

/**
 * Envoi de photos (avatar, salle d'une table, jaquette d'un jeu) et reprise
 * du catalogue BoardGameGeek.
 */

const FIXTURES = path.join(__dirname, "fixtures");
const fixture = (nom: string) => path.join(FIXTURES, nom);

/** Compte neuf : les tests d'avatar modifient le profil, on ne touche pas au seed. */
async function compteNeuf(page: import("@playwright/test").Page, prefixe: string) {
  const email = uniqueEmail(prefixe);
  await page.goto("/register");
  await page.fill("#name", "Photo Testeuse");
  await page.fill("#city", "Lyon 7e");
  await page.fill("#email", email);
  await page.fill("#password", "motdepasse123");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.waitForURL("/");
  const { id } = await one<{ id: string }>('SELECT id FROM "User" WHERE email = $1', [email]);
  return { email, id };
}

test.describe("Lecture des en-têtes d'image", () => {
  test("reconnaît JPEG, PNG et les trois variantes de WebP", () => {
    const lu = (nom: string) => inspecterImage(new Uint8Array(readFileSync(fixture(nom))));

    expect(lu("jaquette.jpg")).toEqual({ type: "image/jpeg", width: 640, height: 480 });
    expect(lu("avatar.png")).toEqual({ type: "image/png", width: 300, height: 300 });
    // VP8L (sans perte) et VP8 (avec perte) n'ont pas le même en-tête.
    expect(lu("salle.webp")).toEqual({ type: "image/webp", width: 800, height: 500 });
    expect(lu("salle-lossy.webp")).toEqual({ type: "image/webp", width: 800, height: 500 });
  });

  test("refuse un fichier qui se contente de porter une extension d'image", () => {
    // Le contenu est du HTML ; seul le nom prétend le contraire.
    expect(inspecterImage(new Uint8Array(readFileSync(fixture("piege.png"))))).toBeNull();
  });

  test("refuse un fichier tronqué", () => {
    const entier = new Uint8Array(readFileSync(fixture("avatar.png")));
    expect(inspecterImage(entier.slice(0, 10))).toBeNull();
  });
});

test.describe("Envoi d'un avatar", () => {
  test("la photo remplace les initiales, sur le profil et dans la barre", async ({ page }) => {
    const { id } = await compteNeuf(page, "avatar");

    await page.goto("/profile/edit");
    await page.setInputFiles("#avatar", fixture("avatar.png"));
    await expect(page.getByAltText("Aperçu de la photo choisie")).toBeVisible();

    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL(`/profile/${id}`);

    const apres = await one<{ avatarUrl: string | null }>('SELECT "avatarUrl" FROM "User" WHERE id = $1', [id]);
    expect(apres.avatarUrl, "l'avatar doit pointer vers la route de service").toMatch(/^\/api\/photos\/[a-z0-9]+$/);

    // La barre supérieure est rendue par un autre composant : elle doit suivre.
    await expect(page.locator(`header img[src="${apres.avatarUrl}"]`)).toBeVisible();

    const reponse = await page.request.get(apres.avatarUrl!);
    expect(reponse.status()).toBe(200);
    expect(reponse.headers()["content-type"]).toBe("image/png");
    expect(reponse.headers()["cache-control"]).toContain("immutable");
  });

  test("un fichier qui n'est pas une image est refusé par le serveur", async ({ page }) => {
    const { id } = await compteNeuf(page, "piege");

    await page.goto("/profile/edit");
    await page.setInputFiles("#avatar", fixture("piege.png"));
    await page.getByRole("button", { name: "Enregistrer" }).click();

    await expect(page.getByText("Ce fichier n'est pas une image JPEG, PNG ou WebP.")).toBeVisible();
    // Le formulaire ne doit pas non plus avoir enregistré le reste au passage.
    await expect(page).toHaveURL("/profile/edit");
    const apres = await one<{ avatarUrl: string | null }>('SELECT "avatarUrl" FROM "User" WHERE id = $1', [id]);
    expect(apres.avatarUrl).toBeNull();
  });

  test("remplacer une photo supprime l'ancienne au lieu de l'abandonner en base", async ({ page }) => {
    const { id } = await compteNeuf(page, "remplace");

    await page.goto("/profile/edit");
    await page.setInputFiles("#avatar", fixture("avatar.png"));
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL(`/profile/${id}`);
    const premiere = await one<{ avatarUrl: string }>('SELECT "avatarUrl" FROM "User" WHERE id = $1', [id]);

    await page.goto("/profile/edit");
    await page.setInputFiles("#avatar", fixture("jaquette.jpg"));
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL(`/profile/${id}`);
    const seconde = await one<{ avatarUrl: string }>('SELECT "avatarUrl" FROM "User" WHERE id = $1', [id]);

    expect(seconde.avatarUrl).not.toBe(premiere.avatarUrl);

    const ancienId = premiere.avatarUrl.split("/").pop()!;
    const restantes = await rows('SELECT id FROM "Photo" WHERE id = $1', [ancienId]);
    expect(restantes, "l'ancienne photo ne doit pas rester orpheline").toHaveLength(0);
    expect((await page.request.get(premiere.avatarUrl)).status()).toBe(404);
  });

  test("enregistrer sans toucher au champ conserve la photo", async ({ page }) => {
    const { id } = await compteNeuf(page, "conserve");

    await page.goto("/profile/edit");
    await page.setInputFiles("#avatar", fixture("avatar.png"));
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL(`/profile/${id}`);
    const avant = await one<{ avatarUrl: string }>('SELECT "avatarUrl" FROM "User" WHERE id = $1', [id]);

    // On ne modifie qu'un autre champ : la photo ne doit pas disparaître.
    await page.goto("/profile/edit");
    await page.fill("#city", "Villeurbanne");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL(`/profile/${id}`);

    const apres = await one<{ avatarUrl: string; city: string }>(
      'SELECT "avatarUrl", city FROM "User" WHERE id = $1', [id],
    );
    expect(apres.avatarUrl).toBe(avant.avatarUrl);
    expect(apres.city).toBe("Villeurbanne");
  });

  test("retirer la photo la supprime des deux côtés", async ({ page }) => {
    const { id } = await compteNeuf(page, "retire");

    await page.goto("/profile/edit");
    await page.setInputFiles("#avatar", fixture("avatar.png"));
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL(`/profile/${id}`);
    const avant = await one<{ avatarUrl: string }>('SELECT "avatarUrl" FROM "User" WHERE id = $1', [id]);

    await page.goto("/profile/edit");
    await page.getByRole("button", { name: "Retirer la photo" }).click();
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL(`/profile/${id}`);

    const apres = await one<{ avatarUrl: string | null }>('SELECT "avatarUrl" FROM "User" WHERE id = $1', [id]);
    expect(apres.avatarUrl).toBeNull();
    const photoId = avant.avatarUrl.split("/").pop()!;
    expect(await rows('SELECT id FROM "Photo" WHERE id = $1', [photoId])).toHaveLength(0);
  });
});

test.describe("Photo d'une table", () => {
  test("la salle envoyée à la création s'affiche sur la fiche", async ({ page }) => {
    await login(page, "chloe");

    const titre = `Soirée photo ${Date.now()}`;
    await page.goto("/events/new");
    await page.fill("#title", titre);
    await page.fill("#city", "Lyon 3e");
    await page.fill("#startAt", datetimeLocal(9));
    await page.setInputFiles("#photo", fixture("salle-lossy.webp"));
    await page.getByRole("button", { name: "Publier" }).click();

    await page.waitForURL(/\/events\/(?!new$)[a-z0-9]+$/);
    const evenement = await one<{ id: string; photoUrl: string | null }>(
      'SELECT id, "photoUrl" FROM "Event" WHERE title = $1', [titre],
    );
    expect(evenement.photoUrl).toMatch(/^\/api\/photos\//);
    await expect(page.locator(`img[src="${evenement.photoUrl}"]`)).toBeVisible();

    const reponse = await page.request.get(evenement.photoUrl!);
    expect(reponse.headers()["content-type"]).toBe("image/webp");
  });

  test("la modification garde la photo quand on ne la touche pas", async ({ page }) => {
    await login(page, "chloe");

    const titre = `Table à modifier ${Date.now()}`;
    await page.goto("/events/new");
    await page.fill("#title", titre);
    await page.fill("#city", "Lyon 3e");
    await page.fill("#startAt", datetimeLocal(10));
    await page.setInputFiles("#photo", fixture("salle-lossy.webp"));
    await page.getByRole("button", { name: "Publier" }).click();
    await page.waitForURL(/\/events\/(?!new$)[a-z0-9]+$/);

    const avant = await one<{ id: string; photoUrl: string }>(
      'SELECT id, "photoUrl" FROM "Event" WHERE title = $1', [titre],
    );

    await page.goto(`/events/${avant.id}/edit`);
    // La photo déjà enregistrée doit être proposée en aperçu.
    await expect(page.getByAltText("Aperçu de la photo choisie")).toBeVisible();
    await page.fill("#location", "Salle du fond");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL(`/events/${avant.id}`);

    const apres = await one<{ photoUrl: string; location: string }>(
      'SELECT "photoUrl", location FROM "Event" WHERE id = $1', [avant.id],
    );
    expect(apres.photoUrl).toBe(avant.photoUrl);
    expect(apres.location).toBe("Salle du fond");
  });
});

test.describe("Jaquette d'un jeu", () => {
  test("la photo envoyée devient la jaquette du catalogue", async ({ page }) => {
    await login(page, "marius");

    const titre = `Jeu photographié ${Date.now()}`;
    await page.goto("/shelf/new");
    await page.fill("#title", titre);
    await page.setInputFiles("#photo", fixture("jaquette.jpg"));
    await page.getByRole("button", { name: "Ajouter à mon étagère" }).click();

    await page.waitForURL(/\/games\/[a-z0-9]+$/);
    const jeu = await one<{ id: string; photoUrl: string | null }>(
      'SELECT id, "photoUrl" FROM "Game" WHERE title = $1', [titre],
    );
    expect(jeu.photoUrl).toMatch(/^\/api\/photos\//);
    await expect(page.locator(`img[src="${jeu.photoUrl}"]`)).toBeVisible();
  });
});

test.describe("Route de service des photos", () => {
  test("un identifiant inconnu renvoie 404", async ({ page }) => {
    expect((await page.request.get("/api/photos/inexistant123")).status()).toBe(404);
  });

  test("l'ETag évite de retélécharger la même image", async ({ page }) => {
    const { id } = await compteNeuf(page, "etag");
    await page.goto("/profile/edit");
    await page.setInputFiles("#avatar", fixture("avatar.png"));
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL(`/profile/${id}`);
    const { avatarUrl } = await one<{ avatarUrl: string }>('SELECT "avatarUrl" FROM "User" WHERE id = $1', [id]);

    const premiere = await page.request.get(avatarUrl);
    const etag = premiere.headers()["etag"];
    expect(etag).toBeTruthy();

    const seconde = await page.request.get(avatarUrl, { headers: { "If-None-Match": etag } });
    expect(seconde.status()).toBe(304);
  });

  test("une image envoyée est servie neutralisée, jamais comme du document", async ({ page }) => {
    const { id } = await compteNeuf(page, "entetes");
    await page.goto("/profile/edit");
    await page.setInputFiles("#avatar", fixture("avatar.png"));
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL(`/profile/${id}`);
    const { avatarUrl } = await one<{ avatarUrl: string }>('SELECT "avatarUrl" FROM "User" WHERE id = $1', [id]);

    const entetes = (await page.request.get(avatarUrl)).headers();
    expect(entetes["x-content-type-options"]).toBe("nosniff");
    expect(entetes["content-security-policy"]).toContain("sandbox");
  });
});
