import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { ArticleStatus, Prisma } from '@prisma/client'

import { badRequest, conflict, notFound } from '@/lib/api/errors'
import {
  deleteArticleContent,
  deleteArticleRevisionMarkdown,
  getArticleContentPath,
  readArticleMarkdown,
  replaceArticleMarkdown,
  writeArticleMarkdown,
  writeArticleMarkdownAtPath,
  writeArticleRevisionMarkdown,
} from '@/lib/content/article-content'
import { fromPrismaArticleCommentsMode, isArticleCommentsMode, toPrismaArticleCommentsMode } from '@/lib/comment-settings'
import { createExcerpt, markdownToHtml } from '@/lib/content/markdown'
import { resolveSlug } from '@/lib/content/slug'
import { createZip, readZip } from '@/lib/content/zip'
import { getPublicArticleWhere } from '@/lib/services/article-visibility'
import { getPrisma } from '@/lib/prisma'
import { parseSearchTerms, textIncludesAllSearchTerms } from '@/lib/search'
import {
  adminArticleDetailSelect,
  adminArticleSearchSelect,
  adminArticleSummarySelect,
  pageMeta,
  paginate,
  publicArticleDetailSelect,
  publicArticleSearchSelect,
  publicArticleSummarySelect,
  serializeArticleTags,
} from '@/lib/services/shared'
import type { AdminArticleSort, ArticleBulkActionInput, ArticleImportInput, ArticleInput, ArticleUpdateInput, PublicArticleSort } from '@/lib/validations/cms'

type PrismaExecutor = ReturnType<typeof getPrisma> | Prisma.TransactionClient
type ArticleContentSource = {
  contentPath: string | null
  legacyContentMarkdown: string | null
}

type ArticleWithTags<T> = T & {
  tags: Array<{ tag: { id: string; name: string; slug: string; description: string | null } }>
}

type PublicArticleSummaryRecord = Prisma.ArticleGetPayload<{ select: typeof publicArticleSummarySelect }>
type PublicArticleListItem = Omit<PublicArticleSummaryRecord, keyof ArticleContentSource | 'tags'> & {
  tags: Array<{ id: string; name: string; slug: string; description: string | null }>
}
type PaginatedPublicArticles = {
  items: PublicArticleListItem[]
  meta: ReturnType<typeof pageMeta>
}

function buildArticleData(input: ArticleInput | ArticleUpdateInput, options: { generateSlugFromTitle?: boolean } = {}) {
  const data: Prisma.ArticleUncheckedUpdateInput = {}

  if (input.title !== undefined) {
    data.title = input.title
  }

  if (input.slug !== undefined) {
    data.slug = resolveSlug({ slug: input.slug })
  } else if (options.generateSlugFromTitle && input.title !== undefined) {
    data.slug = resolveSlug({ title: input.title })
  }

  if (input.contentMarkdown !== undefined && (input.excerpt === undefined || input.excerpt === null)) {
    data.excerpt = createExcerpt(input.contentMarkdown, 200)
  }

  if (input.excerpt !== undefined && input.excerpt !== null) {
    data.excerpt = input.excerpt
  }

  if (input.coverImage !== undefined) {
    data.coverImage = input.coverImage
  }

  if (input.status !== undefined) {
    data.status = input.status

    if (input.status === ArticleStatus.PUBLISHED) {
      data.publishedAt = input.publishedAt ?? new Date()
    }

    if (input.status !== ArticleStatus.PUBLISHED) {
      data.publishedAt = input.publishedAt ?? null
    }
  }

  if (input.commentsMode !== undefined) {
    data.commentsMode = toPrismaArticleCommentsMode(input.commentsMode)
  }

  if (input.publishedAt !== undefined && input.status === undefined) {
    data.publishedAt = input.publishedAt
  }

  if (input.metaTitle !== undefined) {
    data.metaTitle = input.metaTitle
  }

  if (input.metaDescription !== undefined) {
    data.metaDescription = input.metaDescription
  }

  if (input.metaKeywords !== undefined) {
    data.metaKeywords = input.metaKeywords
  }

  if (input.isPinned !== undefined) {
    data.isPinned = input.isPinned
  }

  if (input.categoryId !== undefined) {
    data.categoryId = input.categoryId
  }

  return data
}

async function readMarkdownFromStorage(article: ArticleContentSource) {
  if (article.contentPath) {
    try {
      return await readArticleMarkdown(article.contentPath)
    } catch (error) {
      if (article.legacyContentMarkdown === null) {
        throw error
      }
    }
  }

  if (article.legacyContentMarkdown !== null) {
    return article.legacyContentMarkdown
  }

  throw badRequest('Article content is unavailable.')
}

function withoutContentSource<
  T extends ArticleContentSource & { tags: Array<{ tag: { id: string; name: string; slug: string; description: string | null } }> }
>(article: T): Omit<T, keyof ArticleContentSource | 'tags'> & { tags: Array<{ id: string; name: string; slug: string; description: string | null }> } {
  const { contentPath: _contentPath, legacyContentMarkdown: _legacyContentMarkdown, tags, ...rest } = article

  return {
    ...rest,
    tags: tags.map((item) => item.tag),
  }
}

async function withPublicArticleListExcerpt(article: PublicArticleSummaryRecord): Promise<PublicArticleListItem> {
  const serialized = withoutContentSource(article)

  if (serialized.excerpt) {
    return serialized
  }

  return {
    ...serialized,
    excerpt: createExcerpt(await readMarkdownFromStorage(article), 200),
  }
}

async function getPublicArticleRecord(slug: string) {
  return getPrisma().article.findFirst({
    where: {
      slug,
      ...getPublicArticleWhere(),
    },
    select: publicArticleDetailSelect,
  })
}

async function getAdminArticleRecord(id: string) {
  return getPrisma().article.findUnique({
    where: { id },
    select: adminArticleDetailSelect,
  })
}

async function withPublicArticleContent(article: NonNullable<Awaited<ReturnType<typeof getPublicArticleRecord>>>) {
  const markdown = await readMarkdownFromStorage(article)

  return {
    ...withoutContentSource(article),
    contentHtml: await markdownToHtml(markdown),
  }
}

async function withAdminArticleContent(article: NonNullable<Awaited<ReturnType<typeof getAdminArticleRecord>>>) {
  const markdown = await readMarkdownFromStorage(article)

  return {
    ...withoutContentSource(article),
    contentMarkdown: markdown,
    contentHtml: await markdownToHtml(markdown),
  }
}

async function createRevision(articleId: string, title: string, markdown: string, changeNote?: string | null) {
  const prisma = getPrisma()
  const latest = await prisma.articleRevision.findFirst({
    where: { articleId },
    orderBy: { version: 'desc' },
    select: { version: true },
  })
  const revision = await prisma.articleRevision.create({
    data: {
      articleId,
      title,
      contentPath: null,
      version: (latest?.version ?? 0) + 1,
      changeNote,
    },
  })

  let revisionContentPath: string | null = null

  try {
    revisionContentPath = await writeArticleRevisionMarkdown(articleId, revision.id, markdown)

    return await prisma.articleRevision.update({
      where: { id: revision.id },
      data: { contentPath: revisionContentPath },
    })
  } catch (error) {
    if (revisionContentPath) {
      await deleteArticleRevisionMarkdown(revisionContentPath).catch(() => undefined)
    }

    await prisma.articleRevision.delete({ where: { id: revision.id } }).catch(() => undefined)
    throw error
  }
}

async function deleteRevisionContent(revision: { id: string; contentPath: string | null }) {
  if (revision.contentPath) {
    await deleteArticleRevisionMarkdown(revision.contentPath).catch(() => undefined)
  }

  await getPrisma().articleRevision.delete({ where: { id: revision.id } }).catch(() => undefined)
}

async function syncArticleTags(articleId: string, tagIds: string[], client: PrismaExecutor = getPrisma()) {
  const uniqueTagIds = [...new Set(tagIds)]

  const existing = await client.articleTag.findMany({
    where: { articleId },
    select: { tagId: true },
  })
  const existingTagIds = new Set(existing.map((row) => row.tagId))
  const desiredTagIds = new Set(uniqueTagIds)

  const toRemove = [...existingTagIds].filter((tagId) => !desiredTagIds.has(tagId))
  const toAdd = uniqueTagIds.filter((tagId) => !existingTagIds.has(tagId))

  if (toRemove.length) {
    await client.articleTag.deleteMany({
      where: { articleId, tagId: { in: [...toRemove] } },
    })
  }

  if (toAdd.length) {
    await client.articleTag.createMany({
      data: toAdd.map((tagId) => ({ articleId, tagId })),
    })
  }
}

const SEARCH_CANDIDATE_LIMIT = 200
const ARTICLE_EXPORT_LIMIT = 100
const ARTICLE_ARCHIVE_MAX_BYTES = 25 * 1024 * 1024
const ARTICLE_ARCHIVE_MAX_UNCOMPRESSED_BYTES = 80 * 1024 * 1024
const ARTICLE_ARCHIVE_MAX_FILE_BYTES = 10 * 1024 * 1024
const ARTICLE_ARCHIVE_MAX_ENTRIES = 800
const ARTICLE_ARCHIVE_MAX_ARTICLES = 100
const ARTICLE_ARCHIVE_MEDIA_ROOT = path.join(process.cwd(), 'public', 'uploads', 'article-imports')
const publicUploadRoot = path.join(process.cwd(), 'public')
const localMediaPattern = /!\[([^\]]*)\]\((\/uploads\/media\/[^)\s]+|\/uploads\/article-imports\/[^)\s]+)\)/g
const importedArticleMediaPattern = /!\[([^\]]*)\]\((image\/article\/[^)\s]+)\)/g
const supportedMediaTypes: Record<string, string> = {
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

type ArticleArchiveMetadata = {
  title: string
  slug: string
  excerpt?: string | null
  coverImage?: string | null
  status?: ArticleStatus
  commentsMode?: unknown
  metaTitle?: string | null
  metaDescription?: string | null
  metaKeywords?: string | null
  isPinned?: boolean
  publishedAt?: string | null
  category?: { name: string; slug: string; description?: string | null } | null
  tags?: Array<{ name: string; slug: string; description?: string | null }>
}

type ParsedArticleArchive = {
  root: string
  metadataPath: string
  markdownPath: string
  metadata: ArticleArchiveMetadata
  markdown: string
  files: Map<string, Buffer>
}

type ImportedMediaFile = {
  sourcePath: string
  filename: string
  mimeType: string
  data: Buffer
}

function getSafeArchiveRoot(slug: string) {
  const safeSlug = slug.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'article'
  return safeSlug
}

function normalizeArchivePath(value: string) {
  return value.replaceAll('\\', '/').replace(/^\/+/, '')
}

function isIgnoredArchivePath(value: string) {
  const normalized = normalizeArchivePath(value)
  const segments = normalized.split('/').filter(Boolean)

  return segments.some((segment) => segment === '__MACOSX' || segment.startsWith('.'))
}

function getMimeTypeFromFilename(filename: string) {
  return supportedMediaTypes[path.extname(filename).toLowerCase()]
}

function getLocalPublicFilePath(url: string) {
  if (!url.startsWith('/uploads/')) return null

  const decodedPath = decodeURIComponent(url.split(/[?#]/)[0] ?? '')
  const relativePath = decodedPath.replace(/^\/+/, '')
  const absolutePath = path.resolve(publicUploadRoot, relativePath)

  if (absolutePath !== publicUploadRoot && absolutePath.startsWith(`${publicUploadRoot}${path.sep}`)) {
    return absolutePath
  }

  return null
}

function getUniqueArchiveMediaPath(basePath: string, usedPaths: Set<string>) {
  const normalized = normalizeArchivePath(basePath)
  const extension = path.posix.extname(normalized)
  const basename = normalized.slice(0, normalized.length - extension.length)
  let candidate = normalized
  let index = 2

  while (usedPaths.has(candidate)) {
    candidate = `${basename}-${index}${extension}`
    index += 1
  }

  usedPaths.add(candidate)
  return candidate
}

function normalizeOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function parseArchiveMetadata(value: unknown, metadataPath: string): ArticleArchiveMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw badRequest(`${metadataPath} must be a JSON object.`, 'INVALID_ARTICLE_METADATA')
  }

  const record = value as Record<string, unknown>
  const title = normalizeOptionalString(record.title)
  const slug = normalizeOptionalString(record.slug)

  if (!title || !slug) {
    throw badRequest(`${metadataPath} must include title and slug.`, 'INVALID_ARTICLE_METADATA')
  }

  const status = record.status === 'PUBLISHED' || record.status === 'ARCHIVED' || record.status === 'DRAFT'
    ? record.status
    : ArticleStatus.DRAFT
  const category = record.category && typeof record.category === 'object' && !Array.isArray(record.category)
    ? record.category as Record<string, unknown>
    : null
  const tags = Array.isArray(record.tags) ? record.tags : []

  return {
    title,
    slug,
    excerpt: normalizeOptionalString(record.excerpt),
    coverImage: normalizeOptionalString(record.coverImage),
    status,
    commentsMode: record.commentsMode,
    metaTitle: normalizeOptionalString(record.metaTitle),
    metaDescription: normalizeOptionalString(record.metaDescription),
    metaKeywords: normalizeOptionalString(record.metaKeywords),
    isPinned: record.isPinned === true,
    publishedAt: normalizeOptionalString(record.publishedAt),
    category: category
      ? {
          name: normalizeOptionalString(category.name) ?? '',
          slug: normalizeOptionalString(category.slug) ?? '',
          description: normalizeOptionalString(category.description),
        }
      : null,
    tags: tags.flatMap((tag) => {
      if (!tag || typeof tag !== 'object' || Array.isArray(tag)) return []
      const tagRecord = tag as Record<string, unknown>
      const name = normalizeOptionalString(tagRecord.name)
      const tagSlug = normalizeOptionalString(tagRecord.slug)
      const description = normalizeOptionalString(tagRecord.description)
      return name && tagSlug ? [{ name, slug: tagSlug, description }] : []
    }),
  }
}

function parseArticleArchives(zipBuffer: Buffer) {
  const entries = readZip(zipBuffer, {
    maxEntries: ARTICLE_ARCHIVE_MAX_ENTRIES,
    maxCompressedBytes: ARTICLE_ARCHIVE_MAX_BYTES,
    maxUncompressedBytes: ARTICLE_ARCHIVE_MAX_UNCOMPRESSED_BYTES,
    maxFileBytes: ARTICLE_ARCHIVE_MAX_FILE_BYTES,
  }).filter((entry) => !entry.directory && !isIgnoredArchivePath(entry.path))
  const files = new Map(entries.map((entry) => [entry.path, entry.data]))
  const metadataPaths = entries.map((entry) => entry.path).filter((entryPath) => entryPath.endsWith('article.json'))

  if (!metadataPaths.length) {
    throw badRequest('ZIP archive must contain article.json.', 'MISSING_ARTICLE_JSON')
  }

  if (metadataPaths.length > ARTICLE_ARCHIVE_MAX_ARTICLES) {
    throw badRequest('ZIP archive contains too many articles.', 'TOO_MANY_ARTICLES')
  }

  return metadataPaths.map((metadataPath) => {
    const root = metadataPaths.length === 1 && metadataPath === 'article.json'
      ? ''
      : metadataPath.slice(0, -'article.json'.length).replace(/\/$/, '')
    const markdownPath = root ? `${root}/article.md` : 'article.md'
    const markdownData = files.get(markdownPath)
    const metadataData = files.get(metadataPath)

    if (!metadataData) {
      throw badRequest(`${metadataPath} is missing.`, 'MISSING_ARTICLE_JSON')
    }

    if (!markdownData) {
      throw badRequest(`${markdownPath} is missing.`, 'MISSING_ARTICLE_MARKDOWN')
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(metadataData.toString('utf8'))
    } catch {
      throw badRequest(`${metadataPath} is not valid JSON.`, 'INVALID_ARTICLE_METADATA')
    }

    const prefix = root ? `${root}/` : ''
    const articleFiles = new Map<string, Buffer>()

    for (const [entryPath, data] of files.entries()) {
      if (entryPath.startsWith(prefix)) {
        articleFiles.set(entryPath.slice(prefix.length), data)
      }
    }

    return {
      root,
      metadataPath,
      markdownPath,
      metadata: parseArchiveMetadata(parsed, metadataPath),
      markdown: markdownData.toString('utf8'),
      files: articleFiles,
    }
  })
}

async function findOrCreateCategory(metadata: ArticleArchiveMetadata['category'], client: PrismaExecutor) {
  if (!metadata?.name || !metadata.slug) return null

  const slug = resolveSlug({ slug: metadata.slug })
  const existing = await client.category.findFirst({
    where: { OR: [{ slug }, { name: metadata.name }] },
    select: { id: true },
  })
  if (existing) return existing.id

  const created = await client.category.create({
    data: {
      name: metadata.name,
      slug,
      description: metadata.description ?? null,
    },
    select: { id: true },
  })

  return created.id
}

async function findOrCreateTags(tags: NonNullable<ArticleArchiveMetadata['tags']>, client: PrismaExecutor) {
  const tagIds: string[] = []

  for (const tag of tags) {
    const slug = resolveSlug({ slug: tag.slug })
    const existing = await client.tag.findFirst({
      where: { OR: [{ slug }, { name: tag.name }] },
      select: { id: true },
    })

    if (existing) {
      tagIds.push(existing.id)
      continue
    }

    const created = await client.tag.create({ data: { name: tag.name, slug, description: tag.description ?? null }, select: { id: true } })
    tagIds.push(created.id)
  }

  return tagIds
}

async function writeImportedMedia(file: ImportedMediaFile, articleSlug: string, client: PrismaExecutor) {
  const extension = path.extname(file.filename).toLowerCase()
  const digest = createHash('sha1').update(file.data).digest('hex').slice(0, 10)
  const filename = `${Date.now()}-${randomUUID()}-${digest}${extension}`
  const key = `uploads/article-imports/${articleSlug}/${filename}`
  const url = `/${key}`
  const absolutePath = path.join(ARTICLE_ARCHIVE_MEDIA_ROOT, articleSlug, filename)

  await mkdir(path.dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, file.data)
  await client.media.create({
    data: {
      filename: file.filename,
      key,
      url,
      size: file.data.length,
      mimeType: file.mimeType,
    },
  })

  return url
}

function collectReferencedImportMedia(markdown: string) {
  const referenced = new Set<string>()

  for (const match of markdown.matchAll(importedArticleMediaPattern)) {
    referenced.add(match[2])
  }

  return referenced
}

function collectArticleImportMedia(archive: ParsedArticleArchive) {
  const mediaFiles: ImportedMediaFile[] = []

  for (const [entryPath, data] of archive.files.entries()) {
    if (!entryPath.startsWith('image/article/')) continue
    const filename = path.posix.basename(entryPath)
    const mimeType = getMimeTypeFromFilename(filename)

    if (!mimeType) {
      throw badRequest(`${archive.root || 'article'} contains unsupported media file: ${entryPath}`, 'UNSUPPORTED_MEDIA_TYPE')
    }

    mediaFiles.push({ sourcePath: entryPath, filename, mimeType, data })
  }

  return mediaFiles
}

function findArchiveCoverFile(archive: ParsedArticleArchive): ImportedMediaFile | null {
  const coverFiles = [...archive.files.entries()]
    .filter(([entryPath]) => entryPath.startsWith('image/cover.'))
    .map(([entryPath, data]) => {
      const filename = path.posix.basename(entryPath)
      const mimeType = getMimeTypeFromFilename(filename)

      if (!mimeType) {
        throw badRequest(`${archive.metadata.slug} contains unsupported cover image type: ${entryPath}`, 'UNSUPPORTED_MEDIA_TYPE')
      }

      return { sourcePath: entryPath, filename, mimeType, data }
    })

  if (coverFiles.length > 1) {
    throw badRequest(`${archive.metadata.slug} contains multiple cover images.`, 'DUPLICATE_COVER_IMAGE')
  }

  return coverFiles[0] ?? null
}

function buildArchiveImportInput(metadata: ArticleArchiveMetadata, markdown: string, categoryId: string | null, tagIds: string[], coverImage: string | null): ArticleInput {
  const commentsMode = isArticleCommentsMode(metadata.commentsMode) ? metadata.commentsMode : 'enabled'

  return {
    title: metadata.title,
    slug: metadata.slug,
    excerpt: metadata.excerpt ?? null,
    contentMarkdown: markdown,
    coverImage,
    status: metadata.status ?? ArticleStatus.DRAFT,
    commentsMode,
    metaTitle: metadata.metaTitle ?? null,
    metaDescription: metadata.metaDescription ?? null,
    metaKeywords: metadata.metaKeywords ?? null,
    isPinned: metadata.isPinned ?? false,
    categoryId,
    tagIds,
    publishedAt: metadata.publishedAt ? new Date(metadata.publishedAt) : null,
  }
}

async function createArticleInTransaction(input: ArticleInput, client: Prisma.TransactionClient, createdArticleIds?: string[]) {
  const data = buildArticleData(input, { generateSlugFromTitle: true })
  const article = await client.article.create({
    data: data as Prisma.ArticleUncheckedCreateInput,
  })
  createdArticleIds?.push(article.id)

  await syncArticleTags(article.id, input.tagIds, client)

  const contentPath = getArticleContentPath(article.id)
  await writeArticleMarkdownAtPath(contentPath, input.contentMarkdown)
  await client.article.update({ where: { id: article.id }, data: { contentPath } })

  const revision = await client.articleRevision.create({
    data: {
      articleId: article.id,
      title: article.title,
      contentPath: null,
      version: 1,
      changeNote: input.changeNote ?? 'Imported article',
    },
  })
  const revisionContentPath = await writeArticleRevisionMarkdown(article.id, revision.id, input.contentMarkdown)
  await client.articleRevision.update({ where: { id: revision.id }, data: { contentPath: revisionContentPath } })

  return article
}

async function importArchiveArticle(archive: ParsedArticleArchive, client: Prisma.TransactionClient, createdArticleIds?: string[]) {
  const slug = resolveSlug({ slug: archive.metadata.slug })
  const coverFile = findArchiveCoverFile(archive)
  const hasExternalCover = Boolean(archive.metadata.coverImage)

  if (coverFile && hasExternalCover) {
    throw badRequest(`${archive.metadata.slug} cannot include both image/cover.jpg and coverImage URL.`, 'DUPLICATE_COVER_IMAGE')
  }

  const mediaFiles = collectArticleImportMedia(archive)
  const referencedMedia = collectReferencedImportMedia(archive.markdown)
  const availableMediaPaths = new Set(mediaFiles.map((file) => file.sourcePath))

  for (const mediaPath of referencedMedia) {
    if (!availableMediaPaths.has(mediaPath)) {
      throw badRequest(`${archive.metadata.slug} references missing media file ${mediaPath}.`, 'MISSING_MEDIA_FILE')
    }
  }

  const categoryId = await findOrCreateCategory(archive.metadata.category, client)
  const tagIds = await findOrCreateTags(archive.metadata.tags ?? [], client)
  const mediaUrlBySourcePath = new Map<string, string>()

  for (const mediaFile of mediaFiles) {
    mediaUrlBySourcePath.set(mediaFile.sourcePath, await writeImportedMedia(mediaFile, slug, client))
  }

  const coverImage = coverFile
    ? await writeImportedMedia(coverFile, slug, client)
    : archive.metadata.coverImage ?? null
  const markdown = archive.markdown.replace(importedArticleMediaPattern, (match, alt: string, mediaPath: string) => {
    const url = mediaUrlBySourcePath.get(mediaPath)
    return url ? `![${alt}](${url})` : match
  })
  const input = buildArchiveImportInput({ ...archive.metadata, slug }, markdown, categoryId, tagIds, coverImage)
  const article = await createArticleInTransaction(input, client, createdArticleIds)

  return { id: article.id, title: article.title, slug: article.slug }
}

async function collectArticleExportEntries(article: Awaited<ReturnType<typeof getAdminArticleById>>, root: string) {
  const entries: Array<{ path: string; data: Buffer }> = []
  const usedMediaPaths = new Set<string>()
  let coverImage = article.coverImage
  let markdown = article.contentMarkdown

  if (article.coverImage) {
    const coverPath = getLocalPublicFilePath(article.coverImage)

    if (coverPath) {
      const extension = path.extname(coverPath).toLowerCase() || '.jpg'
      const archiveCoverPath = `image/cover${extension}`
      entries.push({ path: `${root}/${archiveCoverPath}`, data: await readFile(coverPath) })
      coverImage = null
    }
  }

  const replacements = new Map<string, string>()
  const matches = [...markdown.matchAll(localMediaPattern)]

  for (const match of matches) {
    const sourceUrl = match[2]
    if (replacements.has(sourceUrl)) continue

    const absolutePath = getLocalPublicFilePath(sourceUrl)
    if (!absolutePath) continue

    try {
      const filename = path.basename(absolutePath)
      const archivePath = getUniqueArchiveMediaPath(`image/article/${filename}`, usedMediaPaths)
      entries.push({ path: `${root}/${archivePath}`, data: await readFile(absolutePath) })
      replacements.set(sourceUrl, archivePath)
    } catch {
      throw badRequest(`${article.slug} references a local media file that cannot be read: ${sourceUrl}`, 'MEDIA_EXPORT_FAILED')
    }
  }

  markdown = markdown.replace(localMediaPattern, (match, alt: string, sourceUrl: string) => {
    const replacement = replacements.get(sourceUrl)
    return replacement ? `![${alt}](${replacement})` : match
  })

  const metadata = {
    title: article.title,
    slug: article.slug,
    excerpt: article.excerpt,
    coverImage,
    status: article.status,
    commentsMode: fromPrismaArticleCommentsMode(article.commentsMode),
    metaTitle: article.metaTitle,
    metaDescription: article.metaDescription,
    metaKeywords: article.metaKeywords,
    isPinned: article.isPinned,
    publishedAt: article.publishedAt?.toISOString() ?? null,
    category: article.category
      ? {
          name: article.category.name,
          slug: article.category.slug,
        }
      : null,
    tags: article.tags.map((tag) => ({ name: tag.name, slug: tag.slug, description: tag.description ?? null })),
  }

  return [
    { path: `${root}/article.json`, data: Buffer.from(JSON.stringify(metadata, null, 2), 'utf8') },
    { path: `${root}/article.md`, data: Buffer.from(markdown, 'utf8') },
    ...entries,
  ]
}

function getPublicArticleOrderBy(sort: Exclude<PublicArticleSort, 'commentCount'>): Prisma.ArticleOrderByWithRelationInput[] {
  if (sort === 'updatedAt') {
    return [{ updatedAt: 'desc' }, { publishedAt: 'desc' }]
  }

  if (sort === 'viewCount') {
    return [{ viewCount: 'desc' }, { publishedAt: 'desc' }]
  }

  return [{ isPinned: 'desc' }, { publishedAt: 'desc' }]
}

function getAdminArticleOrderBy(sort: AdminArticleSort, order: 'asc' | 'desc'): Prisma.ArticleOrderByWithRelationInput[] {
  if (sort === 'title') {
    return [{ title: order }, { updatedAt: 'desc' }]
  }

  return [{ [sort]: order }, { updatedAt: 'desc' }]
}

async function articleMatchesQuery(
  article: ArticleContentSource & {
    title: string
    excerpt: string | null
    category?: { name: string; slug: string } | null
    tags?: Array<{ tag?: { name: string; slug: string }; name?: string; slug?: string }>
  },
  searchTerms: string[],
) {
  const tagText = article.tags
    ?.map((item) => {
      const tag = item.tag ?? item
      return `${tag.name ?? ''} ${tag.slug ?? ''}`
    })
    .join(' ') ?? ''
  const searchableMetadata = [
    article.title,
    article.excerpt,
    article.category?.name,
    article.category?.slug,
    tagText,
  ].filter(Boolean).join(' ')

  if (textIncludesAllSearchTerms(searchableMetadata, searchTerms)) {
    return true
  }

  return textIncludesAllSearchTerms(await readMarkdownFromStorage(article), searchTerms)
}

export async function listPublicArticles(input: { page: number; pageSize: number; category?: string; tag?: string; sort?: PublicArticleSort }): Promise<PaginatedPublicArticles> {
  const prisma = getPrisma()
  const sort = input.sort ?? 'publishedAt'
  const where: Prisma.ArticleWhereInput = {
    ...getPublicArticleWhere(),
    ...(input.category
      ? {
          category: {
            slug: input.category,
          },
        }
      : {}),
    ...(input.tag
      ? {
          tags: {
            some: {
              tag: {
                slug: input.tag,
              },
            },
          },
        }
      : {}),
  }

  if (sort === 'commentCount') {
    const [allItems, total] = await Promise.all([
      prisma.article.findMany({
        where,
        select: publicArticleSummarySelect,
      }),
      prisma.article.count({ where }),
    ])
    const sortedItems = [...allItems].sort((left, right) => {
      const commentDifference = right._count.comments - left._count.comments

      if (commentDifference !== 0) {
        return commentDifference
      }

      return (right.publishedAt?.getTime() ?? 0) - (left.publishedAt?.getTime() ?? 0)
    })
    const start = (input.page - 1) * input.pageSize
    const serializedItems = await Promise.all(sortedItems.slice(start, start + input.pageSize).map(withPublicArticleListExcerpt))

    return {
      items: serializedItems,
      meta: pageMeta(total, input.page, input.pageSize),
    }
  }

  const [items, total] = await Promise.all([
    prisma.article.findMany({
      where,
      ...paginate(input.page, input.pageSize),
      orderBy: getPublicArticleOrderBy(sort),
      select: publicArticleSummarySelect,
    }),
    prisma.article.count({ where }),
  ])

  const serializedItems = await Promise.all(items.map(withPublicArticleListExcerpt))

  return {
    items: serializedItems,
    meta: pageMeta(total, input.page, input.pageSize),
  }
}

export async function listAdminArticles(input: {
  page: number
  pageSize: number
  status?: ArticleStatus
  category?: string
  tag?: string
  q?: string
  sort?: AdminArticleSort
  order?: 'asc' | 'desc'
}) {
  const prisma = getPrisma()
  const sort = input.sort ?? 'updatedAt'
  const order = input.order ?? 'desc'
  const where: Prisma.ArticleWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.category ? { category: { slug: input.category } } : {}),
    ...(input.tag ? { tags: { some: { tag: { slug: input.tag } } } } : {}),
  }

  if (!input.q) {
    const [items, total] = await Promise.all([
      prisma.article.findMany({
        where,
        ...paginate(input.page, input.pageSize),
        orderBy: getAdminArticleOrderBy(sort, order),
        select: adminArticleSummarySelect,
      }),
      prisma.article.count({ where }),
    ])

    return {
      items: items.map(serializeArticleTags),
      meta: pageMeta(total, input.page, input.pageSize),
    }
  }

  const searchTerms = parseSearchTerms(input.q)
  const candidates = await prisma.article.findMany({
    where,
    orderBy: getAdminArticleOrderBy(sort, order),
    take: SEARCH_CANDIDATE_LIMIT,
    select: adminArticleSearchSelect,
  })
  const matching = (
    await Promise.all(
      candidates.map(async (article) => ((await articleMatchesQuery(article, searchTerms)) ? article : null)),
    )
  ).filter((article): article is NonNullable<typeof article> => article !== null)
  const start = (input.page - 1) * input.pageSize

  return {
    items: matching.slice(start, start + input.pageSize).map(withoutContentSource),
    meta: pageMeta(matching.length, input.page, input.pageSize),
  }
}

function bulkStatusData(action: ArticleBulkActionInput['action']): Prisma.ArticleUncheckedUpdateInput | null {
  if (action === 'publish') {
    return { status: ArticleStatus.PUBLISHED, publishedAt: new Date() }
  }

  if (action === 'draft') {
    return { status: ArticleStatus.DRAFT, publishedAt: null }
  }

  if (action === 'archive') {
    return { status: ArticleStatus.ARCHIVED, publishedAt: null }
  }

  return null
}

export async function bulkUpdateArticles(input: ArticleBulkActionInput) {
  if (input.action === 'delete') {
    const articles = await getPrisma().article.findMany({
      where: { id: { in: input.ids } },
      select: { id: true, contentPath: true },
    })

    await getPrisma().article.deleteMany({ where: { id: { in: input.ids } } })
    await Promise.all(articles.map((article) => (article.contentPath ? deleteArticleContent(article.contentPath).catch(() => undefined) : undefined)))

    return { count: articles.length }
  }

  const data = bulkStatusData(input.action)
  if (!data) throw badRequest('Unsupported bulk article action.')

  const result = await getPrisma().article.updateMany({
    where: { id: { in: input.ids } },
    data,
  })

  return { count: result.count }
}

export async function exportAdminArticles(input: {
  ids: string[]
}) {
  const uniqueIds = [...new Set(input.ids)]

  if (!uniqueIds.length) {
    throw badRequest('Select at least one article to export.', 'NO_ARTICLES_SELECTED')
  }

  if (uniqueIds.length > ARTICLE_EXPORT_LIMIT) {
    throw badRequest(`You can export up to ${ARTICLE_EXPORT_LIMIT} articles at a time.`, 'TOO_MANY_ARTICLES')
  }

  const records = await getPrisma().article.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true },
  })
  const existingIds = new Set(records.map((article) => article.id))
  const missingIds = uniqueIds.filter((id) => !existingIds.has(id))

  if (missingIds.length) {
    throw notFound(`Selected articles were not found: ${missingIds.join(', ')}`)
  }

  const articles = await Promise.all(uniqueIds.map((id) => getAdminArticleById(id)))
  const entries = (
    await Promise.all(
      articles.map((article) => collectArticleExportEntries(article, uniqueIds.length === 1 ? '' : getSafeArchiveRoot(article.slug))),
    )
  ).flat()
  const filename = uniqueIds.length === 1 ? `${getSafeArchiveRoot(articles[0].slug)}.zip` : 'articles.zip'

  return {
    filename,
    buffer: createZip(entries),
    count: articles.length,
  }
}

export async function importAdminArticles(input: ArticleImportInput) {
  const slugs = input.articles.map((article) => resolveSlug({ slug: article.slug }))

  if (new Set(slugs).size !== slugs.length) {
    throw conflict('Import contains duplicate article slugs.')
  }

  const existing = await getPrisma().article.findMany({
    where: { slug: { in: slugs } },
    select: { slug: true },
  })

  if (existing.length) {
    throw conflict(`Article slug already exists: ${existing.map((article) => article.slug).join(', ')}`)
  }

  const articles = []

  for (const articleInput of input.articles) {
    articles.push(await createArticle(articleInput))
  }

  return { count: articles.length, articles }
}

export async function importAdminArticlesArchive(buffer: Buffer) {
  const archives = parseArticleArchives(buffer)
  const slugs = archives.map((archive) => resolveSlug({ slug: archive.metadata.slug }))

  if (new Set(slugs).size !== slugs.length) {
    throw conflict('Import contains duplicate article slugs.')
  }

  const existing = await getPrisma().article.findMany({ where: { slug: { in: slugs } }, select: { slug: true } })

  if (existing.length) {
    throw conflict(`Article slug already exists: ${existing.map((article) => article.slug).join(', ')}`)
  }

  const createdArticleIds: string[] = []

  try {
    const articles = await getPrisma().$transaction(async (tx) => {
      const imported = []

      for (const archive of archives) {
        imported.push(await importArchiveArticle(archive, tx, createdArticleIds))
      }

      return imported
    })

    return { count: articles.length, articles }
  } catch (error) {
    await Promise.all([
      ...slugs.map((slug) => rm(path.join(ARTICLE_ARCHIVE_MEDIA_ROOT, slug), { recursive: true, force: true }).catch(() => undefined)),
      ...createdArticleIds.map((id) => deleteArticleContent(getArticleContentPath(id)).catch(() => undefined)),
    ])
    throw error
  }
}

export async function getPublicArticleNavigation(slug: string) {
  const articles = await getPrisma().article.findMany({
    where: getPublicArticleWhere(),
    orderBy: [{ publishedAt: 'desc' }, { title: 'asc' }],
    select: {
      title: true,
      slug: true,
    },
  })
  const currentIndex = articles.findIndex((article) => article.slug === slug)

  if (currentIndex === -1) {
    throw notFound('Article not found.')
  }

  return {
    previous: articles[currentIndex - 1] ?? null,
    next: articles[currentIndex + 1] ?? null,
  }
}

export async function getPublicArticleBySlug(slug: string) {
  const article = await getPublicArticleRecord(slug)

  if (!article) {
    throw notFound('Article not found.')
  }

  return withPublicArticleContent(article)
}

export async function getAdminArticleById(id: string) {
  const article = await getAdminArticleRecord(id)

  if (!article) {
    throw notFound('Article not found.')
  }

  return withAdminArticleContent(article)
}

export async function getAdminArticleRevision(articleId: string, revisionId: string) {
  const revision = await getPrisma().articleRevision.findFirst({
    where: {
      id: revisionId,
      articleId,
    },
    select: {
      id: true,
      articleId: true,
      title: true,
      version: true,
      changeNote: true,
      contentPath: true,
      legacyContentMarkdown: true,
      createdAt: true,
    },
  })

  if (!revision) {
    throw notFound('Article revision not found.')
  }

  const contentMarkdown = await readMarkdownFromStorage(revision)

  return {
    id: revision.id,
    articleId: revision.articleId,
    title: revision.title,
    version: revision.version,
    changeNote: revision.changeNote,
    createdAt: revision.createdAt,
    contentMarkdown,
    contentHtml: await markdownToHtml(contentMarkdown),
  }
}

export async function createArticle(input: ArticleInput) {
  const prisma = getPrisma()
  const data = buildArticleData(input, { generateSlugFromTitle: true })
  let articleId: string | null = null
  let contentPath: string | null = null

  try {
    const article = await prisma.$transaction(async (tx) => {
      const created = await tx.article.create({
        data: data as Prisma.ArticleUncheckedCreateInput,
      })

      await syncArticleTags(created.id, input.tagIds, tx)

      return created
    })
    articleId = article.id
    contentPath = await writeArticleMarkdown(article.id, input.contentMarkdown)

    await prisma.article.update({
      where: { id: article.id },
      data: { contentPath },
    })
    await createRevision(article.id, article.title, input.contentMarkdown, input.changeNote ?? 'Initial version')

    return getAdminArticleById(article.id)
  } catch (error) {
    if (articleId) {
      await prisma.article.delete({ where: { id: articleId } }).catch(() => undefined)
    }

    if (contentPath) {
      await deleteArticleContent(contentPath).catch(() => undefined)
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw conflict('Article slug already exists.')
    }

    throw error
  }
}

export async function updateArticle(id: string, input: ArticleUpdateInput) {
  const prisma = getPrisma()
  const existing = await prisma.article.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      contentPath: true,
      legacyContentMarkdown: true,
    },
  })

  if (!existing) {
    throw notFound('Article not found.')
  }

  const data = buildArticleData(input)
  const contentChanged = input.contentMarkdown !== undefined
  const previousMarkdown = contentChanged ? await readMarkdownFromStorage(existing) : ''
  const markdown = input.contentMarkdown ?? previousMarkdown
  let contentPath: string | null = null
  let revision: { id: string; contentPath: string | null } | null = null

  try {
    if (contentChanged) {
      contentPath = await replaceArticleMarkdown(existing.contentPath ?? getArticleContentPath(id), markdown)
      revision = await createRevision(id, input.title ?? existing.title, markdown, input.changeNote)
    }

    await prisma.$transaction(async (tx) => {
      await tx.article.update({
        where: { id },
        data: {
          ...data,
          ...(contentPath ? { contentPath } : {}),
        },
      })

      if (input.tagIds !== undefined) {
        await syncArticleTags(id, input.tagIds, tx)
      }
    })

    return getAdminArticleById(id)
  } catch (error) {
    if (revision) {
      await deleteRevisionContent(revision)
    }

    if (contentChanged && contentPath) {
      if (existing.contentPath) {
        await replaceArticleMarkdown(existing.contentPath, previousMarkdown).catch(() => undefined)
      } else {
        await deleteArticleContent(contentPath).catch(() => undefined)
      }
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        throw notFound('Article not found.')
      }

      if (error.code === 'P2002') {
        throw conflict('Article slug already exists.')
      }
    }

    throw error
  }
}

export async function deleteArticle(id: string) {
  const prisma = getPrisma()

  try {
    const article = await prisma.article.delete({
      where: { id },
      select: { contentPath: true },
    })

    if (article.contentPath) {
      await deleteArticleContent(article.contentPath).catch((error) => {
        console.error(`Unable to remove content files for article ${id}.`, error)
      })
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw notFound('Article not found.')
    }

    throw error
  }
}

export async function publishArticle(id: string) {
  return updateArticle(id, {
    status: ArticleStatus.PUBLISHED,
    publishedAt: new Date(),
    changeNote: 'Published article',
  })
}

export async function archiveArticle(id: string) {
  return updateArticle(id, {
    status: ArticleStatus.ARCHIVED,
    changeNote: 'Archived article',
  })
}

export async function searchArticles(input: { q: string; page: number; pageSize: number }) {
  const searchTerms = parseSearchTerms(input.q)
  const candidates = await getPrisma().article.findMany({
    where: getPublicArticleWhere(),
    orderBy: { publishedAt: 'desc' },
    take: SEARCH_CANDIDATE_LIMIT,
    select: publicArticleSearchSelect,
  })
  const matching = (
    await Promise.all(
      candidates.map(async (article) => ((await articleMatchesQuery(article, searchTerms)) ? article : null)),
    )
  ).filter((article): article is NonNullable<typeof article> => article !== null)
  const start = (input.page - 1) * input.pageSize

  return {
    items: matching.slice(start, start + input.pageSize).map(withoutContentSource),
    meta: pageMeta(matching.length, input.page, input.pageSize),
  }
}
