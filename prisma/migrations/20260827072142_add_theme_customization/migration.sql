-- CreateTable
CREATE TABLE "ThemeCustomization" (
    "themeSlug" TEXT NOT NULL,
    "settings" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ThemeCustomization_themeSlug_key" ON "ThemeCustomization"("themeSlug");
