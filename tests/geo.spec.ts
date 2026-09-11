import { test, expect, type Page } from "@playwright/test";
import { login, one, rows, uniqueEmail, datetimeLocal } from "./helpers";
import {
  boiteEnglobante, departementDepuisInsee, distanceKm, normaliserNom, normaliserRecherche,
} from "../src/lib/geo";

/**
 * Géolocalisation : référentiel des communes, distances réelles, rayon de
 * recherche.
 *
 * Tout repose sur des données embarquées : aucun service de géocodage n'est
 * appelé, ici pas plus qu'en production.
 */

const p = (latitude: number, longitude: number) => ({ latitude, longitude });

type Commune = { code: string; nom: string; latitude: number; longitude: number };

const commune = (code: string) =>
  one<Commune>('SELECT code, nom, latitude, longitude FROM "Commune" WHERE code = $1', [code]);

/** Choisit une commune dans le sélecteur d'autocomplétion. */
async function choisirCommune(page: Page, saisie: string, libelle: string | RegExp) {
  await page.fill("#city", saisie);
  const option = page.getByRole("option", { name: libelle });
  await option.first().waitFor();
  await option.first().click();
}

test.describe("Géométrie", () => {
  test("les distances correspondent à la réalité", () => {
    const LYON = p(45.75514, 4.83639);
    const PARIS = p(48.85646, 2.34282);
    const MARSEILLE = p(43.29317, 5.42127);

    // Valeurs orthodromiques connues, à quelques kilomètres près.
    expect(distanceKm(LYON, PARIS)).toBeGreaterThan(385);
    expect(distanceKm(LYON, PARIS)).toBeLessThan(400);
    expect(distanceKm(LYON, MARSEILLE)).toBeGreaterThan(270);
    expect(distanceKm(LYON, MARSEILLE)).toBeLessThan(286);

    expect(distanceKm(LYON, LYON)).toBeCloseTo(0, 6);
    // La distance ne dépend pas du sens dans lequel on la mesure.
    expect(distanceKm(PARIS, MARSEILLE)).toBeCloseTo(distanceKm(MARSEILLE, PARIS), 9);
  });

  test("la boîte englobante n'écarte jamais un voisin réel", () => {
    const centre = p(45.75514, 4.83639);
    const rayon = 40;
    const b = boiteEnglobante(centre, rayon);

    // Un rectangle trop petit ferait disparaître des voisins de la recherche
    // sans que rien ne le signale : c'est l'erreur qu'il faut exclure.
    for (let i = 0; i < 5000; i++) {
      const angle = Math.random() * 2 * Math.PI;
      const r = Math.random() * rayon;
      const q = p(
        centre.latitude + (r / 111.32) * Math.cos(angle),
        centre.longitude + (r / (111.32 * Math.cos((centre.latitude * Math.PI) / 180))) * Math.sin(angle),
      );
      if (distanceKm(centre, q) > rayon) continue;
      expect(q.latitude).toBeGreaterThanOrEqual(b.latMin);
      expect(q.latitude).toBeLessThanOrEqual(b.latMax);
      expect(q.longitude).toBeGreaterThanOrEqual(b.lngMin);
      expect(q.longitude).toBeLessThanOrEqual(b.lngMax);
    }
  });

  test("les noms se normalisent pour la recherche", () => {
    expect(normaliserNom("Saint-Étienne-de-Tinée")).toBe("saint etienne de tinee");
    expect(normaliserNom("L'Haÿ-les-Roses")).toBe("l hay les roses");
    // Les abréviations d'usage ne sont développées que côté recherche.
    expect(normaliserRecherche("st etienne")).toBe("saint etienne");
    expect(normaliserRecherche("Ste-Foy")).toBe("sainte foy");
    expect(normaliserRecherche("Strasbourg")).toBe("strasbourg");
  });

  test("le département se déduit du code INSEE", () => {
    expect(departementDepuisInsee("69387")).toBe("69");
    expect(departementDepuisInsee("2A004")).toBe("2A");
    expect(departementDepuisInsee("97411")).toBe("974");
  });
});

test.describe("Référentiel des communes", () => {
  test("il est chargé en entier, avec des positions justes", async () => {
    const [{ n }] = await rows<{ n: string }>('SELECT COUNT(*)::text AS n FROM "Commune"');
    expect(Number(n)).toBeGreaterThan(35000);

    const lyon7 = await commune("69387");
    expect(lyon7.nom).toBe("Lyon 7e");
    expect(lyon7.latitude).toBeCloseTo(45.733, 2);
    expect(lyon7.longitude).toBeCloseTo(4.837, 2);

    // Les accents et traits d'union doivent avoir survécu à la construction.
    const stEtienne = await one<{ nom: string }>(
      `SELECT nom FROM "Commune" WHERE code = '42218'`,
    );
    expect(stEtienne.nom).toBe("Saint-Étienne");
  });

  test("les comptes du jeu de démonstration sont bien situés", async () => {
    const sans = await rows('SELECT id FROM "User" WHERE "communeCode" IS NULL AND email LIKE $1', ["%@example.com"]);
    expect(sans, "le seed doit rattacher chaque compte à sa commune").toHaveLength(0);
  });
});

test.describe("Choix de la commune", () => {
  test("l'autocomplétion trouve par le nom et enregistre la position", async ({ page }) => {
    await login(page, "bastien");
    await page.goto("/profile/edit");

    await choisirCommune(page, "villeurb", /Villeurbanne/);
    await expect(page.locator("#city")).toHaveValue("Villeurbanne");

    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL(/\/profile\/(?!edit$)[a-z0-9]+$/);

    const apres = await one<{ city: string; communeCode: string }>(
      'SELECT city, "communeCode" FROM "User" WHERE email = $1', ["bastien@example.com"],
    );
    expect(apres.city).toBe("Villeurbanne");
    const choisie = await commune(apres.communeCode);
    expect(choisie.nom).toBe("Villeurbanne");

    // On remet le compte dans son état d'origine : les autres tests s'appuient
    // sur le jeu de démonstration.
    await page.goto("/profile/edit");
    await choisirCommune(page, "Lyon 2e", /Lyon 2e/);
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL(/\/profile\/(?!edit$)[a-z0-9]+$/);
  });

  test("les accents et les abréviations ne font pas rater une commune", async ({ page }) => {
    await login(page, "chloe");
    await page.goto("/profile/edit");

    await page.fill("#city", "st etienne");
    await expect(page.getByRole("option", { name: /Saint-Étienne/ }).first()).toBeVisible();
  });

  test("tant qu'aucune commune n'est choisie, l'application le dit", async ({ page }) => {
    await login(page, "chloe");
    await page.goto("/profile/edit");

    await page.fill("#city", "Quelque part");
    await expect(page.getByText(/Choisis une commune dans la liste/)).toBeVisible();
  });
});

test.describe("Autocomplétion par la Base Adresse Nationale", () => {
  test("l'ordre d'importance de l'API est conservé", async ({ page }) => {
    await login(page, "chloe");
    await page.goto("/profile/edit");

    await page.fill("#city", "lyon");
    const options = page.getByRole("option");
    await options.first().waitFor();

    // L'API classe Lyon avant Lyons-la-Forêt. Le recoupement avec le
    // référentiel ne doit pas rebattre les cartes.
    const libelles = await options.allTextContents();
    expect(libelles[0]).toContain("Lyon");
    expect(libelles[0]).not.toContain("Lyons-la-Forêt");

    // Le nom affiché est celui du référentiel, pas celui de l'API : c'est
    // « Lyon 7e » qui sera enregistré, pas « Lyon 7e Arrondissement ».
    expect(libelles.join(" | ")).toContain("Lyon 7e");
    expect(libelles.join(" | ")).not.toContain("Arrondissement");
  });

  test("une faute de frappe est rattrapée, ce que la liste embarquée ne sait pas faire", async ({ page }) => {
    await login(page, "chloe");
    await page.goto("/profile/edit");

    await page.fill("#city", "vileurbane");
    await expect(page.getByRole("option", { name: /Villeurbanne/ })).toBeVisible();
    // C'est bien l'API qui a répondu : aucune mention de repli.
    await expect(page.getByText(/liste embarquée/)).toHaveCount(0);
  });

  test("une commune absente du référentiel n'est pas proposée", async ({ page }) => {
    await login(page, "chloe");
    await page.goto("/profile/edit");

    // L'API la connaît, nous non : la proposer reviendrait à offrir un choix
    // dont on ne saurait rien faire, sans jamais pouvoir calculer de distance.
    await page.fill("#city", "fantome");
    await expect(page.getByText(/Commune Fantôme/)).toHaveCount(0);
  });

  test("si l'API tombe, la liste embarquée prend le relais et le dit", async ({ page }) => {
    await login(page, "chloe");
    await page.goto("/profile/edit");

    await page.fill("#city", "panne");
    // Le formulaire reste utilisable — la France compte des communes en
    // « Pannes » — et l'écran signale que le service n'a pas répondu.
    await expect(page.getByRole("option").first()).toBeVisible();
    await expect(page.getByText(/liste embarquée/)).toBeVisible();
  });

  test("un service qui ne trouve rien n'est pas un service en panne", async ({ page }) => {
    await login(page, "chloe");
    await page.goto("/profile/edit");

    // « villeurbanne » n'est pas dans le jeu d'essai de la fausse API : elle
    // répond correctement, mais à vide. Le référentiel complète, et il serait
    // mensonger d'annoncer une panne.
    await page.fill("#city", "villeurbanne");
    await expect(page.getByRole("option", { name: /Villeurbanne/ })).toBeVisible();
    await expect(page.getByText(/liste embarquée/)).toHaveCount(0);
  });

  test("un code postal ne passe pas par l'API : le référentiel est plus sûr", async ({ page }) => {
    await login(page, "chloe");
    await page.goto("/profile/edit");

    await page.fill("#city", "69007");
    await expect(page.getByRole("option", { name: /Lyon 7e/ })).toBeVisible();
    // Résolu localement, donc sans mention de repli : ce n'est pas une panne.
    await expect(page.getByText(/liste embarquée/)).toHaveCount(0);
  });
});

test.describe("Distances affichées", () => {
  test("la distance entre deux membres est celle de leurs communes", async ({ page }) => {
    // Chloé est à Lyon 7e, Marius à Lyon 3e : la valeur attendue se calcule,
    // elle n'est pas recopiée.
    const chloe = await one<Commune>(
      'SELECT c.* FROM "User" u JOIN "Commune" c ON c.code = u."communeCode" WHERE u.email = $1',
      ["chloe@example.com"],
    );
    const marius = await one<Commune>(
      'SELECT c.* FROM "User" u JOIN "Commune" c ON c.code = u."communeCode" WHERE u.email = $1',
      ["marius@example.com"],
    );
    const attendu = distanceKm(chloe, marius);
    expect(attendu).toBeGreaterThan(0.5);

    const jeu = await one<{ id: string }>(
      `SELECT g.id FROM "Game" g
       JOIN "GameCopy" gc ON gc."gameId" = g.id AND gc.status = 'ON_TABLE'
       JOIN "User" u ON u.id = gc."ownerId" AND u.email = 'marius@example.com'
       LIMIT 1`,
    );

    await login(page, "chloe");
    await page.goto(`/games/${jeu.id}`);

    // L'écran affiche « 3,2 km » ou « 900 m » selon la distance : on
    // reconstruit le libellé attendu comme le fait l'application.
    const libelle = attendu < 1
      ? `${Math.round(attendu * 1000)} m`
      : `${new Intl.NumberFormat("fr", { maximumFractionDigits: 1 }).format(attendu)} km`;
    await expect(page.getByText(libelle).first()).toBeVisible();
  });

  test("sans commune, aucune distance n'est inventée", async ({ page }) => {
    // Compte neuf, laissé volontairement sans commune reconnue.
    const email = uniqueEmail("sansville");
    await page.goto("/register");
    await page.fill("#name", "Sans Commune");
    await page.fill("#city", "Nulle part précisément");
    await page.fill("#email", email);
    await page.fill("#password", "motdepasse123");
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await page.waitForURL("/");

    const cree = await one<{ communeCode: string | null }>(
      'SELECT "communeCode" FROM "User" WHERE email = $1', [email],
    );
    expect(cree.communeCode, "une ville non reconnue ne doit pas être devinée").toBeNull();

    await page.goto("/search");
    await expect(page.getByText(/distances indisponibles/)).toBeVisible();
    await expect(page.getByText(/Renseigne ta commune/)).toBeVisible();

    await page.goto("/");
    await expect(page.getByText(/Indique ta commune pour voir ce qui se passe/)).toBeVisible();
  });
});

test.describe("Recherche par rayon", () => {
  test("une table lointaine sort du rayon et revient quand on l'élargit", async ({ page }) => {
    // Un compte à Brest, donc à plus de 700 km de Lyon.
    const email = uniqueEmail("brest");
    await page.goto("/register");
    await page.fill("#name", "Joueur Breton");
    await page.fill("#city", "Brest");
    await page.fill("#email", email);
    await page.fill("#password", "motdepasse123");
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await page.waitForURL("/");

    await page.goto("/profile/edit");
    await choisirCommune(page, "Brest", /^Brest\b/);
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL(/\/profile\/(?!edit$)[a-z0-9]+$/);

    const titre = `Table brestoise ${Date.now()}`;
    await page.goto("/events/new");
    await page.fill("#title", titre);
    await choisirCommune(page, "Brest", /^Brest\b/);
    await page.fill("#startAt", datetimeLocal(12));
    await page.getByRole("button", { name: "Publier" }).click();
    await page.waitForURL(/\/events\/(?!new$)[a-z0-9]+$/);

    const table = await one<{ communeCode: string | null }>(
      'SELECT "communeCode" FROM "Event" WHERE title = $1', [titre],
    );
    expect(table.communeCode).not.toBeNull();

    // Vue depuis Lyon : hors de portée à 25 km, visible à 1000 km.
    await login(page, "chloe");
    await page.goto("/search?type=Table&distance=25");
    await expect(page.getByText(titre)).toHaveCount(0);

    await page.goto("/search?type=Table&distance=1000");
    await expect(page.getByText(titre)).toBeVisible();
  });
});
