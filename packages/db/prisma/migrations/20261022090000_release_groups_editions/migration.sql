-- ADR-012: editions model. A ReleaseGroup is the album as a work (MusicBrainz release group);
-- every existing Release row becomes one edition of a group.

-- CreateEnum
CREATE TYPE "ReleaseGroupType" AS ENUM ('ALBUM', 'EP', 'SINGLE', 'LIVE', 'COMPILATION', 'OTHER');

-- AlterTable
ALTER TABLE "Release" ADD COLUMN     "country" TEXT,
ADD COLUMN     "disambiguation" TEXT,
ADD COLUMN     "editionLabel" TEXT,
ADD COLUMN     "format" TEXT,
ADD COLUMN     "releaseGroupId" TEXT,
ADD COLUMN     "releaseStatus" TEXT;

-- CreateTable
CREATE TABLE "ReleaseGroup" (
    "id" TEXT NOT NULL,
    "musicbrainzId" TEXT,
    "title" TEXT NOT NULL,
    "artistName" TEXT NOT NULL,
    "artistId" TEXT,
    "primaryType" "ReleaseGroupType" NOT NULL DEFAULT 'ALBUM',
    "firstReleaseYear" INTEGER,
    "matchKey" TEXT,
    "editionsSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReleaseGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReleaseGroup_musicbrainzId_key" ON "ReleaseGroup"("musicbrainzId");

-- CreateIndex
CREATE INDEX "ReleaseGroup_matchKey_idx" ON "ReleaseGroup"("matchKey");

-- CreateIndex
CREATE INDEX "ReleaseGroup_artistId_idx" ON "ReleaseGroup"("artistId");

-- CreateIndex
CREATE INDEX "Release_releaseGroupId_idx" ON "Release"("releaseGroupId");

-- AddForeignKey
ALTER TABLE "ReleaseGroup" ADD CONSTRAINT "ReleaseGroup_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Release" ADD CONSTRAINT "Release_releaseGroupId_fkey" FOREIGN KEY ("releaseGroupId") REFERENCES "ReleaseGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill ---------------------------------------------------------------------------------------
-- Work title = release title without edition qualifiers (same marker words as
-- parseEdition() in packages/shared/src/catalog-edition.ts), e.g.
-- "Abbey Road (Remastered 2009)" -> "Abbey Road". Falls back to the full title.
CREATE FUNCTION pg_temp.openmusic_work_title(t TEXT) RETURNS TEXT AS $$
  SELECT COALESCE(NULLIF(btrim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          t,
          '\s*[\(\[][^\)\]]*\m(remaster(ed|s)?|deluxe|expanded|anniversary|edition|live|mono|stereo|reissue[ds]?|bonus|version|explicit|clean|super)\M[^\)\]]*[\)\]]',
          '', 'gi'),
        '\s*[\(\[]\s*(feat|ft|featuring|with)\M[^\)\]]*[\)\]]', '', 'gi'),
      '\s+-\s+([^-]*\m(remaster(ed|s)?|deluxe|expanded|anniversary|edition|live|mono|stereo|reissue[ds]?|bonus|version|super)\M[^-]*|single|ep)$',
      '', 'gi')
  ), ''), t)
$$ LANGUAGE sql IMMUTABLE;

-- 1. One group per MusicBrainz release-group id already known: editions sharing it are merged
--    into the same group. Title/artist come from the oldest edition.
INSERT INTO "ReleaseGroup" ("id", "musicbrainzId", "title", "artistName", "artistId", "primaryType",
                            "firstReleaseYear", "matchKey", "createdAt", "updatedAt")
SELECT md5('mbrg:' || g."musicbrainzReleaseGroupId")::uuid::text,
       g."musicbrainzReleaseGroupId",
       pg_temp.openmusic_work_title(first_r."title"),
       first_r."artistName",
       first_r."artistId",
       first_r."releaseType"::text::"ReleaseGroupType",
       g.first_year,
       first_r."matchKey",
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
FROM (
  SELECT "musicbrainzReleaseGroupId",
         MIN(EXTRACT(YEAR FROM "releaseDate"))::int AS first_year
  FROM "Release"
  WHERE "musicbrainzReleaseGroupId" IS NOT NULL
  GROUP BY "musicbrainzReleaseGroupId"
) g
CROSS JOIN LATERAL (
  SELECT r."title", r."artistName", r."artistId", r."releaseType", r."matchKey"
  FROM "Release" r
  WHERE r."musicbrainzReleaseGroupId" = g."musicbrainzReleaseGroupId"
  ORDER BY r."releaseDate" ASC NULLS LAST, r."createdAt" ASC, r."id" ASC
  LIMIT 1
) first_r;

UPDATE "Release"
SET "releaseGroupId" = md5('mbrg:' || "musicbrainzReleaseGroupId")::uuid::text
WHERE "musicbrainzReleaseGroupId" IS NOT NULL;

-- 2. Every other release gets its own group (no evidence that two rows are the same work).
INSERT INTO "ReleaseGroup" ("id", "title", "artistName", "artistId", "primaryType",
                            "firstReleaseYear", "matchKey", "createdAt", "updatedAt")
SELECT md5('group:' || r."id")::uuid::text,
       pg_temp.openmusic_work_title(r."title"),
       r."artistName",
       r."artistId",
       r."releaseType"::text::"ReleaseGroupType",
       EXTRACT(YEAR FROM r."releaseDate")::int,
       r."matchKey",
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
FROM "Release" r
WHERE r."releaseGroupId" IS NULL;

UPDATE "Release"
SET "releaseGroupId" = md5('group:' || "id")::uuid::text
WHERE "releaseGroupId" IS NULL;
