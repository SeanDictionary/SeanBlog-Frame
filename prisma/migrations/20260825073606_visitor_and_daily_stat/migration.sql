-- CreateEnum
CREATE TYPE "AnalyticsDimension" AS ENUM ('all', 'article', 'category', 'tag');

-- DropIndex
DROP INDEX "AnalyticsEvent_visitorHash_idx";

-- AlterTable
ALTER TABLE "AnalyticsEvent" DROP COLUMN "sessionId",
DROP COLUMN "visitorHash",
ADD COLUMN     "visitorId" TEXT;

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "visitorId" TEXT;

-- CreateTable
CREATE TABLE "AnalyticsDailyStat" (
    "date" TIMESTAMP(3) NOT NULL,
    "dimension" "AnalyticsDimension" NOT NULL,
    "contentId" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AnalyticsDailyStat_pkey" PRIMARY KEY ("date","dimension","contentId")
);

-- CreateTable
CREATE TABLE "Visitor" (
    "visitorId" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visitCount" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Visitor_pkey" PRIMARY KEY ("visitorId")
);

-- CreateIndex
CREATE INDEX "AnalyticsDailyStat_dimension_date_idx" ON "AnalyticsDailyStat"("dimension", "date");

-- CreateIndex
CREATE INDEX "AnalyticsDailyStat_contentId_date_idx" ON "AnalyticsDailyStat"("contentId", "date");

-- CreateIndex
CREATE INDEX "Visitor_lastSeenAt_idx" ON "Visitor"("lastSeenAt");

-- CreateIndex
CREATE INDEX "Visitor_firstSeenAt_idx" ON "Visitor"("firstSeenAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_visitorId_idx" ON "AnalyticsEvent"("visitorId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_articleId_visitorId_idx" ON "AnalyticsEvent"("articleId", "visitorId");

-- CreateIndex
CREATE INDEX "Comment_visitorId_idx" ON "Comment"("visitorId");

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "Visitor"("visitorId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "Visitor"("visitorId") ON DELETE SET NULL ON UPDATE CASCADE;

