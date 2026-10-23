-- ADR-013: automatic now-playing sync (Spotify / Last.fm poller).
-- Existing users get lastSeenAt = now (the column default), i.e. a full grace period before the
-- poller pauses their linked accounts for inactivity.

-- CreateEnum
CREATE TYPE "ProviderSyncStatus" AS ENUM ('ACTIVE', 'ERROR', 'PAUSED');

-- AlterTable
ALTER TABLE "ConnectedAccount" ADD COLUMN     "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "syncError" TEXT,
ADD COLUMN     "syncStatus" "ProviderSyncStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastSeenAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "ConnectedAccount_userId_idx" ON "ConnectedAccount"("userId");
