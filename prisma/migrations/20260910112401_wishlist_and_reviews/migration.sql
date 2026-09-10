-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "eventId" TEXT,
ADD COLUMN     "tradeId" TEXT;

-- CreateTable
CREATE TABLE "GameWant" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameWant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameWant_userId_idx" ON "GameWant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GameWant_gameId_userId_key" ON "GameWant"("gameId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_fromUserId_tradeId_key" ON "Review"("fromUserId", "tradeId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_fromUserId_eventId_key" ON "Review"("fromUserId", "eventId");

-- AddForeignKey
ALTER TABLE "GameWant" ADD CONSTRAINT "GameWant_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameWant" ADD CONSTRAINT "GameWant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "TradeProposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

