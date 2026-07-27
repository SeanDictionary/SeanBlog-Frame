-- Add file paths before removing legacy database body columns.
-- Existing Article.contentMarkdown / Article.contentHtml values must be exported to the
-- corresponding content/articles/{articleId}/index.md files before the legacy columns
-- are dropped in a future cleanup migration.
ALTER TABLE "Article" ADD COLUMN "contentPath" TEXT;
ALTER TABLE "ArticleRevision" ADD COLUMN "contentPath" TEXT;

-- Rows created after this migration store Markdown in files, so legacy body columns
-- must become nullable before application code stops writing them.
ALTER TABLE "Article" ALTER COLUMN "contentMarkdown" DROP NOT NULL;
ALTER TABLE "Article" ALTER COLUMN "contentHtml" DROP NOT NULL;
ALTER TABLE "ArticleRevision" ALTER COLUMN "contentMarkdown" DROP NOT NULL;
ALTER TABLE "ArticleRevision" ALTER COLUMN "contentHtml" DROP NOT NULL;

-- Existing rows remain nullable until the application migration script writes their Markdown files.
