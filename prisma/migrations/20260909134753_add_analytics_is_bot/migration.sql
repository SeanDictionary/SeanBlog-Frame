-- AlterTable
ALTER TABLE "AnalyticsEvent" ADD COLUMN     "isBot" BOOLEAN;

-- CreateIndex
CREATE INDEX "AnalyticsEvent_isBot_idx" ON "AnalyticsEvent"("isBot");
