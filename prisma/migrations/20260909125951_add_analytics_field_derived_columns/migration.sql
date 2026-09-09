-- AlterTable
ALTER TABLE "AnalyticsEvent" ADD COLUMN     "browser" TEXT,
ADD COLUMN     "operatingSystem" TEXT,
ADD COLUMN     "referrerDomain" TEXT;

-- CreateIndex
CREATE INDEX "AnalyticsEvent_country_idx" ON "AnalyticsEvent"("country");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_referrerDomain_idx" ON "AnalyticsEvent"("referrerDomain");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_operatingSystem_idx" ON "AnalyticsEvent"("operatingSystem");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_browser_idx" ON "AnalyticsEvent"("browser");
