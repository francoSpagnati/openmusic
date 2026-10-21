-- Catalog import from external open databases (Deezer, iTunes, MusicBrainz, Cover Art Archive):
-- external id columns, Artist table, match keys for dedupe, provenance and sync timestamps.

-- CreateEnum
CREATE TYPE "CatalogSource" AS ENUM ('DEEZER', 'ITUNES', 'MUSICBRAINZ', 'COVER_ART_ARCHIVE');

-- AlterTable
ALTER TABLE "Release" ADD COLUMN     "artistId" TEXT,
ADD COLUMN     "coverSource" "CatalogSource",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deezerId" TEXT,
ADD COLUMN     "enrichedAt" TIMESTAMP(3),
ADD COLUMN     "itunesId" TEXT,
ADD COLUMN     "label" TEXT,
ADD COLUMN     "matchKey" TEXT,
ADD COLUMN     "metadataSyncedAt" TIMESTAMP(3),
ADD COLUMN     "musicbrainzReleaseGroupId" TEXT,
ADD COLUMN     "trackCount" INTEGER,
ADD COLUMN     "upc" TEXT;

-- AlterTable
ALTER TABLE "Track" ADD COLUMN     "artistId" TEXT,
ADD COLUMN     "discNumber" INTEGER,
ADD COLUMN     "itunesId" TEXT,
ADD COLUMN     "matchKey" TEXT,
ADD COLUMN     "musicbrainzId" TEXT,
ADD COLUMN     "trackNumber" INTEGER;

-- CreateTable
CREATE TABLE "Artist" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "matchKey" TEXT NOT NULL,
    "deezerId" TEXT,
    "itunesId" TEXT,
    "musicbrainzId" TEXT,
    "pictureUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Artist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Artist_deezerId_key" ON "Artist"("deezerId");

-- CreateIndex
CREATE UNIQUE INDEX "Artist_itunesId_key" ON "Artist"("itunesId");

-- CreateIndex
CREATE UNIQUE INDEX "Artist_musicbrainzId_key" ON "Artist"("musicbrainzId");

-- CreateIndex
CREATE INDEX "Artist_matchKey_idx" ON "Artist"("matchKey");

-- CreateIndex
CREATE UNIQUE INDEX "Release_deezerId_key" ON "Release"("deezerId");

-- CreateIndex
CREATE UNIQUE INDEX "Release_itunesId_key" ON "Release"("itunesId");

-- CreateIndex
CREATE UNIQUE INDEX "Release_upc_key" ON "Release"("upc");

-- CreateIndex
CREATE INDEX "Release_matchKey_idx" ON "Release"("matchKey");

-- CreateIndex
CREATE INDEX "Release_artistId_idx" ON "Release"("artistId");

-- CreateIndex
CREATE UNIQUE INDEX "Track_itunesId_key" ON "Track"("itunesId");

-- CreateIndex
CREATE UNIQUE INDEX "Track_musicbrainzId_key" ON "Track"("musicbrainzId");

-- CreateIndex
CREATE INDEX "Track_releaseId_matchKey_idx" ON "Track"("releaseId", "matchKey");

-- CreateIndex
CREATE INDEX "Track_artistId_idx" ON "Track"("artistId");

-- AddForeignKey
ALTER TABLE "Release" ADD CONSTRAINT "Release_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Track" ADD CONSTRAINT "Track_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Legacy rows imported by the old catalog search used provider ids as primary keys
-- ("deezer-alb-<id>", "deezer-trk-<id>"), which every UUID-validated endpoint rejected.
-- Give them internal UUIDs and move the provider id to its column. Every foreign key to
-- Release/Track is ON UPDATE CASCADE, so reviews, posts, chat messages, playlists and
-- scrobbles follow the new id.
UPDATE "Release"
SET "deezerId" = substring("id" from 12),
    "id" = gen_random_uuid()::text
WHERE "id" LIKE 'deezer-alb-%'
  AND NOT EXISTS (SELECT 1 FROM "Release" r2 WHERE r2."deezerId" = substring("Release"."id" from 12));

UPDATE "Track"
SET "deezerId" = COALESCE("deezerId", substring("id" from 12)),
    "id" = gen_random_uuid()::text
WHERE "id" LIKE 'deezer-trk-%';
