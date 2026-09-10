import { expect, type Page } from "@playwright/test";
import { Pool } from "pg";

/** Comptes créés par prisma/seed.ts. Tous partagent le même mot de passe. */
export const SEED_PASSWORD = "password123";
export const USERS = {
  chloe: { email: "chloe@example.com", name: "Chloé Barrat" },
  marius: { email: "marius@example.com", name: "Marius T." },
  lea: { email: "lea@example.com", name: "Léa D." },
  bastien: { email: "bastien@example.com", name: "Bastien R." },
  amandine: { email: "amandine@example.com", name: "Amandine P." },
} as const;

export type UserKey = keyof typeof USERS;

/**
 * Accès direct à la base depuis les tests.
 *
 * On passe par `pg` plutôt que par le client Prisma : celui-ci est généré en
 * ESM (`import.meta`) et le chargeur TypeScript de Playwright est en
 * CommonJS. Les tests n'ont de toute façon besoin que de quelques lectures
 * simples — retrouver un identifiant créé par le seed, ou vérifier qu'une
 * action a bien eu l'effet attendu côté serveur et pas seulement à l'écran.
 */
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });

export async function rows<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const result = await pool.query(sql, params);
  return result.rows as T[];
}

export async function one<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T> {
  const found = await rows<T>(sql, params);
  if (!found.length) throw new Error(`Aucune ligne pour : ${sql}`);
  return found[0];
}

export async function closeDb() {
  await pool.end();
}

/** Liste des e-mails du seed, pour filtrer en SQL. */
export const SEED_EMAILS = Object.values(USERS).map((u) => u.email);

/** Retrouve la clé d'un compte du seed à partir de son e-mail. */
export function keyForEmail(email: string): UserKey {
  const found = (Object.keys(USERS) as UserKey[]).find((k) => USERS[k].email === email);
  if (!found) throw new Error(`E-mail hors du jeu de démonstration : ${email}`);
  return found;
}

export async function userId(key: UserKey): Promise<string> {
  const user = await one<{ id: string }>('SELECT id FROM "User" WHERE email = $1', [USERS[key].email]);
  return user.id;
}

/**
 * Connecte le navigateur avec un compte du seed.
 *
 * On vérifie que la session est bien établie avant de rendre la main : sans
 * cela, un échec de connexion ne se manifeste que plusieurs étapes plus loin,
 * sous la forme d'une redirection inexpliquée vers /login.
 */
export async function login(page: Page, key: UserKey) {
  await page.goto("/login");
  await page.fill("#email", USERS[key].email);
  await page.fill("#password", SEED_PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL("/");
  // L'application est bilingue : on accepte les deux libellés plutôt que de
  // supposer la langue du compte.
  await expect(
    page.getByRole("button", { name: /Déconnexion|Sign out/ }).first(),
    `la session de ${USERS[key].email} devrait être ouverte`,
  ).toBeVisible();
}

/** Ferme la session et attend que la page de connexion soit rendue. */
export async function logout(page: Page) {
  await page.getByRole("button", { name: /Déconnexion|Sign out/ }).first().click();
  await page.waitForURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
}

/**
 * Normalise un tableau Postgres.
 *
 * `pg` ne connaît pas l'OID des tableaux d'énumération créés par Prisma et les
 * renvoie sous forme de littéral (« {FR,EN} ») plutôt que de tableau.
 */
export function pgArray(valeur: unknown): string[] {
  if (Array.isArray(valeur)) return valeur as string[];
  if (typeof valeur === "string") {
    const nu = valeur.replace(/^\{|\}$/g, "");
    return nu ? nu.split(",").map((v) => v.replace(/^"|"$/g, "")) : [];
  }
  return [];
}

/** Rend un e-mail unique, pour que les tests d'inscription soient rejouables. */
export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}@example.test`;
}

/** Date au format attendu par un `<input type="datetime-local">`. */
export function datetimeLocal(daysFromNow: number, hour = 20) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Collecte les erreurs JavaScript de la page. À brancher en début de test,
 * puis à vérifier à la fin avec `expect(errors).toEqual([])`.
 */
export function watchForPageErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`${page.url()} : ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`${page.url()} : ${message.text()}`);
  });
  return errors;
}

export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "la page ne doit pas déborder horizontalement").toBeLessThanOrEqual(0);
}
