ALTER TABLE "Purchase"
ADD COLUMN "downloadAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "downloadIp" TEXT,
ADD COLUMN "downloadRevokedAt" TIMESTAMP(3);

-- Existing links must not retain the previous 24-hour access window.
UPDATE "Purchase"
SET "downloadExpiresAt" = LEAST("downloadExpiresAt", "createdAt" + INTERVAL '2 hours');
