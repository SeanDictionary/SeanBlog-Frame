import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

const articleContentRoot = path.join(process.cwd(), 'content', 'articles')
const articleContentFilename = 'index.md'

function normalizeContentPath(value: string) {
  return value.replaceAll('\\', '/')
}

function assertSafePathSegment(value: string, label: string) {
  if (!/^[a-z0-9_-]+$/i.test(value)) {
    throw new Error(`Invalid ${label} for content path.`)
  }
}

export function getArticleContentPath(articleId: string) {
  assertSafePathSegment(articleId, 'article ID')
  return normalizeContentPath(path.join('content', 'articles', articleId, articleContentFilename))
}

export function getArticleRevisionContentPath(articleId: string, revisionId: string) {
  assertSafePathSegment(articleId, 'article ID')
  assertSafePathSegment(revisionId, 'revision ID')
  return normalizeContentPath(path.join('content', 'articles', articleId, 'revisions', `${revisionId}.md`))
}

function resolveArticleContentPath(contentPath: string) {
  const normalized = normalizeContentPath(contentPath)

  if (!normalized.startsWith('content/articles/')) {
    throw new Error('Article content path must be under content/articles/.')
  }

  const absolutePath = path.resolve(process.cwd(), ...normalized.split('/'))

  if (absolutePath !== articleContentRoot && !absolutePath.startsWith(`${articleContentRoot}${path.sep}`)) {
    throw new Error('Article content path escapes content/articles/.')
  }

  return absolutePath
}

async function writeMarkdown(contentPath: string, markdown: string) {
  const absolutePath = resolveArticleContentPath(contentPath)

  await mkdir(path.dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, markdown, 'utf8')

  return contentPath
}

async function writeTemporaryMarkdown(contentPath: string, markdown: string) {
  const absolutePath = resolveArticleContentPath(contentPath)
  const temporaryPath = `${absolutePath}.tmp`

  await mkdir(path.dirname(absolutePath), { recursive: true })
  await writeFile(temporaryPath, markdown, 'utf8')

  return normalizeContentPath(`${contentPath}.tmp`)
}

export async function replaceArticleMarkdown(contentPath: string, markdown: string) {
  const temporaryContentPath = await writeTemporaryMarkdown(contentPath, markdown)

  try {
    await rename(resolveArticleContentPath(temporaryContentPath), resolveArticleContentPath(contentPath))
  } catch (error) {
    await rm(resolveArticleContentPath(temporaryContentPath), { force: true }).catch(() => undefined)
    throw error
  }

  return contentPath
}

export async function readArticleMarkdown(contentPath: string) {
  return readFile(resolveArticleContentPath(contentPath), 'utf8')
}

export async function writeArticleMarkdownAtPath(contentPath: string, markdown: string) {
  return writeMarkdown(contentPath, markdown)
}

export async function writeArticleMarkdown(articleId: string, markdown: string) {
  return writeMarkdown(getArticleContentPath(articleId), markdown)
}

export async function writeArticleRevisionMarkdown(articleId: string, revisionId: string, markdown: string) {
  return writeMarkdown(getArticleRevisionContentPath(articleId, revisionId), markdown)
}

export async function deleteArticleContent(contentPath: string) {
  await rm(path.dirname(resolveArticleContentPath(contentPath)), { recursive: true, force: true })
}

export async function deleteArticleRevisionMarkdown(contentPath: string) {
  await rm(resolveArticleContentPath(contentPath), { force: true })
}
