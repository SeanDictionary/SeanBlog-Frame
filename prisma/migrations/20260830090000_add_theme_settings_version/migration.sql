-- Add per-theme settings schema version for runtime migrations
ALTER TABLE "ThemeCustomization" ADD COLUMN "settingsVersion" INTEGER NOT NULL DEFAULT 1;
