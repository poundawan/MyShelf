import { defineConfig, devices } from "@playwright/test";
import { config as loadEnvFile } from "dotenv";
import path from "node:path";

// dotenv n'écrase jamais une variable déjà définie : en CI, les valeurs
// fournies par le workflow GitHub Actions gagnent sur .env.test.
loadEnvFile({ path: path.resolve(__dirname, ".env.test"), quiet: true });

const PORT = Number(process.env.TEST_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${PORT}`;

// Aucun service extérieur n'est appelé par les tests : un faux serveur local
// rejoue les réponses de BoardGameGeek et de la Base Adresse Nationale, pannes
// comprises. Sans cela, les requêtes HTTP et le traitement de leurs statuts
// d'erreur — le maillon le plus fragile — ne seraient couverts par rien.
const PORT_SERVICES = Number(process.env.FAUX_SERVICES_PORT ?? 3199);

// Chromium est déjà présent dans certains environnements (conteneurs CI, bacs
// à sable) : on l'utilise tel quel plutôt que de le retélécharger.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

// Chromium refuse de démarrer en root sans cette option ; c'est le cas dans
// certains conteneurs. Ailleurs, on garde le bac à sable actif.
const launchOptions = {
  executablePath,
  args: process.getuid?.() === 0 ? ["--no-sandbox"] : [],
};

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./tests/global-setup.ts",

  // Les tests partagent une seule base et se marchent dessus s'ils tournent en
  // parallèle (un test qui accepte un échange pendant qu'un autre le lit).
  // La suite reste rapide, ce n'est pas un compromis coûteux ici.
  fullyParallel: false,
  workers: 1,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : [["list"]],

  use: {
    baseURL,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "bureau",
      use: { ...devices["Desktop Chrome"], launchOptions },
    },
    {
      // Les parcours ne sont rejoués sur mobile que pour le rendu : la logique
      // métier est la même, seule la mise en page change. On garde le gabarit
      // de l'iPhone 13 mais sous Chromium : c'est le seul moteur installé.
      name: "mobile",
      testMatch: /rendu\.spec\.ts/,
      use: { ...devices["iPhone 13"], browserName: "chromium", launchOptions },
    },
  ],

  webServer: [
    {
      command: `npx tsx tests/faux-services.ts`,
      port: PORT_SERVICES,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      stdout: "pipe",
      stderr: "pipe",
      env: { FAUX_SERVICES_PORT: String(PORT_SERVICES), FAUX_BGG_TOKEN: "jeton-de-test" },
    },
    {
      // On teste le vrai build de production, pas le serveur de développement :
      // c'est ce qui tourne sur Vercel.
      command: `npx next build && npx next start --port ${PORT}`,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        DATABASE_URL: process.env.DATABASE_URL ?? "",
        DIRECT_URL: process.env.DIRECT_URL ?? "",
        AUTH_SECRET: process.env.AUTH_SECRET ?? "",
        // Deux racines, comme en production : la principale puis le secours.
        BGG_API_BASE: `http://127.0.0.1:${PORT_SERVICES}/xmlapi2`,
        // Le faux BoardGameGeek refuse tout appel sans ce jeton : la suite
        // entière vérifie donc que l'application l'envoie.
        BGG_API_TOKEN: "jeton-de-test",
        ADRESSE_API_BASE: `http://127.0.0.1:${PORT_SERVICES}`,
      },
    },
  ],
});
