-- CreateEnum
CREATE TYPE "ArticleCommentsMode" AS ENUM ('ENABLED', 'READ_ONLY', 'DISABLED');

-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "commentsMode" "ArticleCommentsMode" NOT NULL DEFAULT 'ENABLED';
