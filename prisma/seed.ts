import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { chargerCommunes, rattacherCommunes } from "./communes";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function daysFromNow(days: number, hour: number, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function main() {
  // Le référentiel des communes se charge dans tous les cas, même si le reste
  // est déjà en place : sans lui, personne ne peut choisir sa ville et toutes
  // les distances disparaissent.
  await chargerCommunes(prisma);

  // Ce script n'est pas conçu pour fusionner avec des données existantes : les
  // jeux, copies, tables et échanges n'ont pas de clé naturelle et seraient
  // recréés en double à chaque exécution. On refuse donc de peupler une base
  // qui contient déjà quelque chose — ce qui rend la commande sûre à relancer,
  // notamment en production.
  const dejaPeuplee = await prisma.game.count();
  if (dejaPeuplee > 0 && process.env.SEED_FORCE !== "1") {
    console.log(
      `Base déjà peuplée (${dejaPeuplee} jeux) : rien à faire.\n` +
        "Pour forcer malgré tout (au risque de créer des doublons) : SEED_FORCE=1",
    );
    // Les lignes créées avant l'arrivée du référentiel n'ont encore qu'une
    // ville en texte libre : on les relie au passage.
    await rattacherCommunes(prisma);
    return;
  }

  const passwordHash = await bcrypt.hash("password123", 10);

  const [chloe, marius, lea, bastien, sofiane, amandine] = await Promise.all([
    prisma.user.upsert({
      where: { email: "chloe@example.com" }, update: {},
      create: {
        email: "chloe@example.com", name: "Chloé Barrat", city: "Lyon 7e", passwordHash,
        verified: true, experienceLevel: "CONFIRMED",
        bio: "J'ouvre ma table tous les jeudis. Débutants toujours bienvenus.",
      },
    }),
    prisma.user.upsert({
      where: { email: "marius@example.com" }, update: {},
      create: { email: "marius@example.com", name: "Marius T.", city: "Lyon 3e", passwordHash, verified: true, experienceLevel: "CONFIRMED" },
    }),
    prisma.user.upsert({
      where: { email: "lea@example.com" }, update: {},
      create: { email: "lea@example.com", name: "Léa D.", city: "Lyon 7e", passwordHash, verified: true, experienceLevel: "INTERMEDIATE" },
    }),
    prisma.user.upsert({
      where: { email: "bastien@example.com" }, update: {},
      create: { email: "bastien@example.com", name: "Bastien R.", city: "Lyon 2e", passwordHash, experienceLevel: "BEGINNER" },
    }),
    prisma.user.upsert({
      where: { email: "sofiane@example.com" }, update: {},
      create: {
        email: "sofiane@example.com", name: "Sofiane Bel", city: "Lyon 7e", passwordHash,
        verified: true, experienceLevel: "CONFIRMED", bio: "MJ depuis 6 ans, 23 tables animées.",
      },
    }),
    prisma.user.upsert({
      where: { email: "amandine@example.com" }, update: {},
      create: { email: "amandine@example.com", name: "Amandine P.", city: "Lyon 7e", passwordHash, experienceLevel: "BEGINNER" },
    }),
  ]);

  const club = await prisma.club.create({
    data: {
      name: "Les Dés Pipés", city: "Lyon 7e",
      description: "Une table tous les jeudis au Comptoir des Halles. Débutants bienvenus, on explique tout.",
      memberships: { create: [chloe, sofiane, lea, marius, amandine, bastien].map((u) => ({ userId: u.id })) },
    },
  });

  const games = await Promise.all([
    prisma.game.create({ data: {
      title: "Cap sur Oreb", category: "BOARD_GAME", level: "INTERMEDIATE",
      minPlayers: 2, maxPlayers: 5, durationMin: 90, minAge: 12,
      description: "Un jeu de commerce et de cabotage où l'on charge trop, où l'on vend trop tard, et où le vent décide du reste. Les règles tiennent en dix minutes, les rancunes durent plus longtemps.",
    }}),
    prisma.game.create({ data: { title: "Trois Comtés", category: "BOARD_GAME", level: "BEGINNER", minPlayers: 2, maxPlayers: 4, durationMin: 45, minAge: 10 }}),
    prisma.game.create({ data: { title: "Le Dernier Wagon", category: "BOARD_GAME", level: "BEGINNER", minPlayers: 3, maxPlayers: 6, durationMin: 30, minAge: 8 }}),
    prisma.game.create({ data: { title: "Bazar de Kohlim", category: "BOARD_GAME", level: "INTERMEDIATE", minPlayers: 2, maxPlayers: 4, durationMin: 60, minAge: 10 }}),
    prisma.game.create({ data: { title: "Sylve", category: "BOARD_GAME", level: "INTERMEDIATE", minPlayers: 1, maxPlayers: 4, durationMin: 75, minAge: 12 }}),
    prisma.game.create({ data: { title: "Orfèvres", category: "BOARD_GAME", level: "CONFIRMED", minPlayers: 2, maxPlayers: 2, durationMin: 25, minAge: 14 }}),
    prisma.game.create({ data: { title: "Vallée des Semeurs", category: "BOARD_GAME", level: "INTERMEDIATE", minPlayers: 2, maxPlayers: 4, durationMin: 60, minAge: 10 }}),
  ]);
  const [capSurOreb, troisComtes, dernierWagon, bazarKohlim, sylve, orfevres, valleeSemeurs] = games;

  const copies = await Promise.all([
    prisma.gameCopy.create({ data: { gameId: troisComtes.id, ownerId: chloe.id, condition: "GOOD", status: "ON_TABLE" } }),
    prisma.gameCopy.create({ data: { gameId: capSurOreb.id, ownerId: chloe.id, condition: "GOOD", status: "KEPT_WARM" } }),
    prisma.gameCopy.create({ data: { gameId: dernierWagon.id, ownerId: chloe.id, condition: "LIKE_NEW", status: "ON_TABLE" } }),
    prisma.gameCopy.create({ data: { gameId: bazarKohlim.id, ownerId: chloe.id, condition: "GOOD", status: "ON_TABLE" } }),
    prisma.gameCopy.create({ data: { gameId: sylve.id, ownerId: chloe.id, condition: "LIKE_NEW", status: "KEPT_WARM" } }),
    prisma.gameCopy.create({ data: { gameId: orfevres.id, ownerId: chloe.id, condition: "GOOD", status: "ON_TABLE" } }),
    prisma.gameCopy.create({ data: { gameId: capSurOreb.id, ownerId: marius.id, condition: "GOOD", status: "ON_TABLE" } }),
    prisma.gameCopy.create({ data: { gameId: capSurOreb.id, ownerId: amandine.id, condition: "LIKE_NEW", status: "ON_TABLE" } }),
    prisma.gameCopy.create({ data: { gameId: capSurOreb.id, ownerId: bastien.id, condition: "WORN", status: "ON_TABLE" } }),
    prisma.gameCopy.create({ data: { gameId: valleeSemeurs.id, ownerId: marius.id, condition: "GOOD", status: "ON_TABLE" } }),
    prisma.gameCopy.create({ data: { gameId: dernierWagon.id, ownerId: amandine.id, condition: "GOOD", status: "ON_TABLE" } }),
  ]);
  const [chloeTroisComtes, chloeCapSurOreb, , , , , , , , mariusValleeSemeurs] = copies;

  const cards = await Promise.all([
    prisma.card.create({ data: { name: "Gardienne des Cendres", setName: "Cendres du Nord", rarity: "FOIL" } }),
    prisma.card.create({ data: { name: "Éclat lunaire", setName: "Marches d'Argent", rarity: "RARE" } }),
    prisma.card.create({ data: { name: "Fossoyeur de Brume", setName: "Cendres du Nord", rarity: "RARE" } }),
    prisma.card.create({ data: { name: "Sceau de Kohlim", setName: "Vents Contraires", rarity: "MYTHIC" } }),
  ]);
  const [gardienneCendres, eclatLunaire, fossoyeurBrume, sceauKohlim] = cards;

  await Promise.all([
    prisma.cardCopy.create({ data: { cardId: gardienneCendres.id, ownerId: lea.id } }),
    prisma.cardCopy.create({ data: { cardId: eclatLunaire.id, ownerId: marius.id } }),
    prisma.cardCopy.create({ data: { cardId: fossoyeurBrume.id, ownerId: bastien.id } }),
    prisma.cardCopy.create({ data: { cardId: sceauKohlim.id, ownerId: lea.id } }),
  ]);
  await prisma.cardWant.create({ data: { cardId: gardienneCendres.id, userId: chloe.id } });

  const weekendDnd = await prisma.event.create({ data: {
    hostId: sofiane.id, clubId: club.id, title: "Weekend DnD — Les Cavernes de Sel",
    type: "ROLE_PLAYING", languages: ["FR"], level: "BEGINNER",
    description: "Deux jours dans les mines abandonnées de Sel-sur-Rhône. On joue une campagne courte, pré-tirée, avec des fiches de perso prêtes à l'emploi. Si tu n'as jamais lancé un dé à vingt faces, c'est exactement la table qu'il te faut : on prend la première heure pour tout expliquer.\n\nRepas partagé le samedi soir, chacun apporte quelque chose. Le matériel est fourni par le club.",
    bringList: "Rien d'obligatoire. Tes dés si tu en as, et un plat pour le samedi soir.",
    city: "Lyon 7e", location: "Comptoir des Halles, Lyon 7e",
    startAt: daysFromNow(10, 10, 0), endAt: daysFromNow(11, 18, 0),
    maxParticipants: 8,
    participants: { create: [sofiane, lea, bastien, marius, amandine].map((u) => ({ userId: u.id })) },
  }});

  const apremJeux = await prisma.event.create({ data: {
    hostId: chloe.id, clubId: club.id, title: "Aprem jeux au Comptoir",
    type: "DISCOVERY", level: "BEGINNER",
    description: "Douze personnes, quatre tables, on apporte ce qu'on veut faire découvrir.",
    city: "Lyon 7e", location: "Comptoir des Halles, Lyon 7e",
    startAt: daysFromNow(5, 15, 0), maxParticipants: 12,
    participants: { create: [chloe, lea, amandine].map((u) => ({ userId: u.id })) },
  }});

  await prisma.event.create({ data: {
    hostId: marius.id, title: "Draft TCG du jeudi",
    type: "TCG", languages: ["EN"], level: "CONFIRMED",
    description: "Draft classique, boosters fournis par la boutique partenaire.",
    city: "Lyon 3e", location: "Boutique Le Sceau, Lyon 3e",
    startAt: daysFromNow(2, 19, 0), maxParticipants: 8,
    participants: { create: [marius, bastien].map((u) => ({ userId: u.id })) },
  }});

  const conv = await prisma.conversation.create({ data: { userAId: chloe.id, userBId: marius.id } });
  const t0 = Date.now();
  await prisma.message.createMany({ data: [
    { conversationId: conv.id, senderId: marius.id, content: "Salut ! Ton Cap sur Oreb est toujours dispo ?", createdAt: new Date(t0 - 3 * 3600_000) },
    { conversationId: conv.id, senderId: chloe.id, content: "Oui ! Tu proposes quoi en face ?", createdAt: new Date(t0 - 2.8 * 3600_000) },
    { conversationId: conv.id, senderId: marius.id, content: "Vallée des Semeurs, joué deux fois, boîte nickel.", createdAt: new Date(t0 - 2.5 * 3600_000) },
    { conversationId: conv.id, senderId: marius.id, content: "Jeudi 19h au Comptoir, ça marche ?", createdAt: new Date(t0 - 2 * 3600_000) },
  ]});

  await prisma.tradeProposal.create({ data: {
    kind: "GAME", fromUserId: marius.id, toUserId: chloe.id, conversationId: conv.id, status: "PENDING",
    items: { create: [
      { gameCopyId: chloeCapSurOreb.id, offeredBy: "TO" },
      { gameCopyId: mariusValleeSemeurs.id, offeredBy: "FROM" },
    ]},
  }});

  const convLea = await prisma.conversation.create({ data: { userAId: chloe.id, userBId: lea.id } });
  await prisma.message.create({ data: { conversationId: convLea.id, senderId: lea.id, content: "J'ai la Gardienne foil de côté pour toi.", createdAt: new Date(t0 - 26 * 3600_000) } });

  const convSofiane = await prisma.conversation.create({ data: { userAId: chloe.id, userBId: sofiane.id } });
  await prisma.message.create({ data: { conversationId: convSofiane.id, senderId: sofiane.id, content: "Tu peux venir dès 9h30 si tu veux nous aider à installer.", createdAt: new Date(t0 - 4 * 24 * 3600_000) } });

  // Un échange déjà terminé pour peupler les avis + stats de Chloé
  const convBastien = await prisma.conversation.create({ data: { userAId: chloe.id, userBId: bastien.id } });
  await prisma.tradeProposal.create({ data: {
    kind: "GAME", fromUserId: bastien.id, toUserId: chloe.id, conversationId: convBastien.id, status: "COMPLETED",
    items: { create: [{ gameCopyId: chloeTroisComtes.id, offeredBy: "TO" }] },
  }});

  await prisma.review.createMany({ data: [
    { fromUserId: marius.id, toUserId: chloe.id, gameId: troisComtes.id, context: "Échange · Trois Comtés", rating: 5, comment: "Ponctuelle, boîte impeccable, et elle m'a expliqué les règles sur le trottoir. On refait ça." },
    { fromUserId: lea.id, toUserId: chloe.id, context: "Cartes · Cendres du Nord", rating: 5, comment: "Cartes protégées, état conforme à l'annonce. Échange en cinq minutes devant la boutique." },
    { fromUserId: bastien.id, toUserId: chloe.id, context: "Aprem jeux · débutant", rating: 4, comment: "Première fois que je jouais à autre chose qu'un jeu de cartes classique, personne ne m'a fait sentir largué." },
  ]});


  // Les comptes, tables et clubs du jeu de démonstration désignent leur ville

  // en texte ; on leur donne la commune correspondante.

  await rattacherCommunes(prisma);


  console.log("Seed terminé :", { chloe: chloe.email, weekendDnd: weekendDnd.id, apremJeux: apremJeux.id });
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
