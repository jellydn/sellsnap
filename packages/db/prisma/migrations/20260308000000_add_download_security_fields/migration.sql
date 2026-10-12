-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN "downloadAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Purchase" ADD COLUMN "maxDownloadAttempts" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "Purchase" ADD COLUMN "boundIpAddress" TEXT;
ALTER TABLE "Purchase" ADD COLUMN "revokedAt" TIMESTAMP(3);
