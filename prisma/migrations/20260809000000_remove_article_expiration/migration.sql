-- DropIndex
DROP INDEX IF EXISTS "Article_expiresAt_idx";

-- AlterTable
ALTER TABLE "Article" DROP COLUMN IF EXISTS "expiresAt";
