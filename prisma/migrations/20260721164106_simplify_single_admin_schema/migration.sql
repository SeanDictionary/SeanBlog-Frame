/*
  Warnings:

  - You are about to drop the column `authorId` on the `Article` table. All the data in the column will be lost.
  - You are about to drop the column `bannedAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `bio` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `emailVerified` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `image` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `Account` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ArticleRevision` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Comment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Media` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Session` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SiteSetting` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `VerificationToken` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `passwordHash` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Account" DROP CONSTRAINT "Account_userId_fkey";

-- DropForeignKey
ALTER TABLE "Article" DROP CONSTRAINT "Article_authorId_fkey";

-- DropForeignKey
ALTER TABLE "ArticleRevision" DROP CONSTRAINT "ArticleRevision_articleId_fkey";

-- DropForeignKey
ALTER TABLE "Comment" DROP CONSTRAINT "Comment_articleId_fkey";

-- DropForeignKey
ALTER TABLE "Comment" DROP CONSTRAINT "Comment_authorId_fkey";

-- DropForeignKey
ALTER TABLE "Comment" DROP CONSTRAINT "Comment_parentId_fkey";

-- DropForeignKey
ALTER TABLE "Media" DROP CONSTRAINT "Media_userId_fkey";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_userId_fkey";

-- DropIndex
DROP INDEX "Article_authorId_idx";

-- DropIndex
DROP INDEX "User_bannedAt_idx";

-- DropIndex
DROP INDEX "User_role_idx";

-- AlterTable
ALTER TABLE "Article" DROP COLUMN "authorId";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "bannedAt",
DROP COLUMN "bio",
DROP COLUMN "emailVerified",
DROP COLUMN "image",
DROP COLUMN "role",
ALTER COLUMN "passwordHash" SET NOT NULL;

-- DropTable
DROP TABLE "Account";

-- DropTable
DROP TABLE "ArticleRevision";

-- DropTable
DROP TABLE "Comment";

-- DropTable
DROP TABLE "Media";

-- DropTable
DROP TABLE "Session";

-- DropTable
DROP TABLE "SiteSetting";

-- DropTable
DROP TABLE "VerificationToken";

-- DropEnum
DROP TYPE "CommentStatus";

-- DropEnum
DROP TYPE "UserRole";
