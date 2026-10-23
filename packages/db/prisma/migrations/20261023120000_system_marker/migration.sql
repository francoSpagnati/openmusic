-- CreateTable
CREATE TABLE "SystemMarker" (
    "key" TEXT NOT NULL,
    "leaseUntil" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "details" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemMarker_pkey" PRIMARY KEY ("key")
);
