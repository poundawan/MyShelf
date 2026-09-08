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
        category: "BOARD_GAME",
        condition: "GOOD",
      },
      {
        ownerId: alice.id,
        title: "Donjons & Dragons — Manuel des joueurs (5e édition)",
        description: "Édition VF, un peu usée mais complète.",
        category: "ROLE_PLAYING",
        condition: "WORN",
      },
      {
        ownerId: bob.id,
        title: "7 Wonders",
        description: "2 extensions incluses (Leaders, Cities).",
        category: "BOARD_GAME",
        condition: "LIKE_NEW",
      },
      {
        ownerId: bob.id,
        title: "L'Appel de Cthulhu — Boîte de base",
        description: "Livre de règles + écran de jeu + scénario d'introduction.",
        category: "ROLE_PLAYING",
        condition: "GOOD",
      },
    ],
  });

  const nextTuesday = new Date();
  nextTuesday.setDate(nextTuesday.getDate() + ((2 - nextTuesday.getDay() + 7) % 7 || 7));
  nextTuesday.setHours(19, 30, 0, 0);

  await prisma.event.create({
    data: {
      hostId: alice.id,
      title: "Soirée Catan & co",
      description: "Soirée jeux de société conviviale, débutants bienvenus !",
      gameType: "BOARD_GAME",
      gameName: "Catan",
      level: "ALL_LEVELS",
      recurrence: "WEEKLY",
      city: "Lyon",
      location: "Café des Jeux, 12 rue de la République",
      startAt: nextTuesday,
      maxParticipants: 6,
      participants: { create: [{ userId: alice.id }, { userId: bob.id }] },
    },
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
