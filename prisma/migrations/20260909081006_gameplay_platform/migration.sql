-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "experienceLevel" TEXT NOT NULL DEFAULT 'INTERMEDIATE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "level" TEXT,
    "minPlayers" INTEGER,
    "maxPlayers" INTEGER,
    "durationMin" INTEGER,
    "minAge" INTEGER,
    "description" TEXT,
    "photoUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "GameCopy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ON_TABLE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GameCopy_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GameCopy_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "setName" TEXT,
    "rarity" TEXT NOT NULL DEFAULT 'COMMON',
    "photoUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CardCopy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cardId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ON_TABLE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CardCopy_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CardCopy_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CardWant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CardWant_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CardWant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Club" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ClubMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clubId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClubMembership_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClubMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hostId" TEXT NOT NULL,
    "clubId" TEXT,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'BEGINNER',
    "description" TEXT,
    "bringList" TEXT,
    "city" TEXT NOT NULL,
    "location" TEXT,
    "photoUrl" TEXT,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME,
    "maxParticipants" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Event_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Event_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EventParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventParticipant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EventParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TradeProposal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "conversationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TradeProposal_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TradeProposal_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TradeProposal_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TradeItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tradeProposalId" TEXT NOT NULL,
    "gameCopyId" TEXT,
    "cardCopyId" TEXT,
    "offeredBy" TEXT NOT NULL,
    CONSTRAINT "TradeItem_tradeProposalId_fkey" FOREIGN KEY ("tradeProposalId") REFERENCES "TradeProposal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TradeItem_gameCopyId_fkey" FOREIGN KEY ("gameCopyId") REFERENCES "GameCopy" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TradeItem_cardCopyId_fkey" FOREIGN KEY ("cardCopyId") REFERENCES "CardCopy" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Conversation_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Conversation_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "gameId" TEXT,
    "context" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Review_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Review_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Review_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Game_category_idx" ON "Game"("category");

-- CreateIndex
CREATE INDEX "GameCopy_gameId_idx" ON "GameCopy"("gameId");

-- CreateIndex
CREATE INDEX "GameCopy_ownerId_idx" ON "GameCopy"("ownerId");

-- CreateIndex
CREATE INDEX "CardCopy_cardId_idx" ON "CardCopy"("cardId");

-- CreateIndex
CREATE INDEX "CardCopy_ownerId_idx" ON "CardCopy"("ownerId");

-- CreateIndex
CREATE INDEX "CardWant_userId_idx" ON "CardWant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CardWant_cardId_userId_key" ON "CardWant"("cardId", "userId");

-- CreateIndex
CREATE INDEX "ClubMembership_userId_idx" ON "ClubMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClubMembership_clubId_userId_key" ON "ClubMembership"("clubId", "userId");

-- CreateIndex
CREATE INDEX "Event_city_idx" ON "Event"("city");

-- CreateIndex
CREATE INDEX "Event_startAt_idx" ON "Event"("startAt");

-- CreateIndex
CREATE INDEX "Event_hostId_idx" ON "Event"("hostId");

-- CreateIndex
CREATE INDEX "EventParticipant_eventId_idx" ON "EventParticipant"("eventId");

-- CreateIndex
CREATE INDEX "EventParticipant_userId_idx" ON "EventParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EventParticipant_eventId_userId_key" ON "EventParticipant"("eventId", "userId");

-- CreateIndex
CREATE INDEX "TradeProposal_fromUserId_idx" ON "TradeProposal"("fromUserId");

-- CreateIndex
CREATE INDEX "TradeProposal_toUserId_idx" ON "TradeProposal"("toUserId");

-- CreateIndex
CREATE INDEX "TradeItem_tradeProposalId_idx" ON "TradeItem"("tradeProposalId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_userAId_userBId_key" ON "Conversation"("userAId", "userBId");

-- CreateIndex
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");

-- CreateIndex
CREATE INDEX "Review_toUserId_idx" ON "Review"("toUserId");
