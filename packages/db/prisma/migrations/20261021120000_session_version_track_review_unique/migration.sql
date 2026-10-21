-- Session revocation: tokens carry the user's sessionVersion; a password change bumps it.
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- One review per user per track (release reviews already have @@unique([userId, releaseId])).
-- Keep the most recent duplicate before adding the constraint.
DELETE FROM "Review" r
USING "Review" newer
WHERE r."trackId" IS NOT NULL
  AND r."userId" = newer."userId"
  AND r."trackId" = newer."trackId"
  AND (r."updatedAt", r."id") < (newer."updatedAt", newer."id");

CREATE UNIQUE INDEX "Review_userId_trackId_key" ON "Review"("userId", "trackId");
