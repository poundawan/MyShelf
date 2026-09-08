import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const alice = await prisma.user.upsert({
    where: { email: "alice@example.com" },
    update: {},
    create: { email: "alice@example.com", name: "Alice", city: "Lyon", passwordHash },
  });

  const bob = await prisma.user.upsert({
    where: { email: "bob@example.com" },
    update: {},
    create: { email: "bob@example.com", name: "Bob", city: "Paris", passwordHash },
  });

  await prisma.item.createMany({
    data: [
      {
        ownerId: alice.id,
        title: "Catan",
        description: "Jeu de base, 3-4 joueurs, boîte complète.",
        category: "GAME",
        condition: "GOOD",
      },
      {
        ownerId: alice.id,
        title: "Le Seigneur des Anneaux — La Communauté de l'Anneau",
        description: "Édition poche, un peu jaunie mais lisible.",
        category: "BOOK",
        condition: "WORN",
      },
      {
        ownerId: bob.id,
        title: "7 Wonders",
        description: "2 extensions incluses (Leaders, Cities).",
        category: "GAME",
        condition: "LIKE_NEW",
      },
      {
        ownerId: bob.id,
        title: "Dune",
        description: "Frank Herbert, édition Robert Laffont.",
        category: "BOOK",
        condition: "GOOD",
      },
    ],
  });

  console.log("Seed terminé :", { alice: alice.email, bob: bob.email });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
