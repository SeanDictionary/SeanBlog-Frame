-- AlterTable
ALTER TABLE "Article" ADD COLUMN "expiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Article_expiresAt_idx" ON "Article"("expiresAt");
