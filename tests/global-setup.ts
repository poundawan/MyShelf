import { execFileSync } from "node:child_process";

/**
 * Remet la base de test à zéro avant chaque exécution de la suite.
 *
 * Les tests écrivent réellement en base (créer un compte, proposer un échange,
 * ouvrir une table...). Ils doivent donc partir d'un état connu, sinon un test
 * qui a échoué à mi-parcours pollue tous les suivants.
 */
export default async function globalSetup() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL manquant : les tests ont besoin d'une base dédiée (voir .env.test).");
  }

  // Garde-fou : cette fonction efface tout le contenu de la base. On refuse
  // catégoriquement de la lancer ailleurs que sur une base nommée `*_test`,
  // pour qu'une variable d'environnement mal réglée ne puisse pas vider la
  // base de développement — ou pire, celle de production.
  const databaseName = new URL(url).pathname.replace(/^\//, "");
  if (!databaseName.endsWith("_test")) {
    throw new Error(
      `Refus d'effacer la base « ${databaseName} » : les tests n'acceptent qu'une base dont le nom finit par « _test ».`,
    );
  }

  const run = (command: string, args: string[]) =>
    execFileSync(command, args, { stdio: "inherit", env: process.env });

  // `migrate reset` rejoue les migrations depuis zéro : cela vérifie au passage
  // que les migrations versionnées décrivent bien le schéma attendu.
  run("npx", ["prisma", "migrate", "reset", "--force", "--skip-generate", "--skip-seed"]);
  run("npx", ["tsx", "prisma/seed.ts"]);
}
