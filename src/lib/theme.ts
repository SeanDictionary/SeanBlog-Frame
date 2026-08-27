import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { inflateRawSync } from 'node:zlib'

import { badRequest, conflict, notFound } from '@/lib/api/errors'
import { assertThemeName, DEFAULT_THEME_NAME, validateThemeCss } from '@/lib/validations/theme'

export const THEME_ENGINE = 'seanblog-theme'
export const THEME_ENGINE_VERSION = 1

const themesRoot = path.join(process.cwd(), 'themes')
const themeManifestFilename = 'theme.json'
const themeCssFallbackPath = 'assets/theme.css'
const maxThemePackageBytes = 2 * 1024 * 1024
const maxThemeFileCount = 200

export type ThemeSettingSchemaItem = {
  key: string
  label: string
  description?: string
  group?: string
  type: 'text' | 'color' | 'number' | 'boolean' | 'select' | 'list' | 'multiselect'
  default?: string | number | boolean | string[] | Array<Record<string, string>>
  cssVariable?: string
  options?: Array<{ label: string; value: string }>
  itemFields?: Array<{ key: string; label: string; type: 'text' | 'color' | 'number' | 'boolean' | 'select' }>
}

export type ThemePackageManifest = {
  slug: string
  name: string
  version: string
  author?: string
  description?: string
  engine: typeof THEME_ENGINE
  engineVersion: number
  previewImage?: string
  assets?: {
    css?: string
  }
  templates: Record<string, string>
  parts?: Record<string, string>
  settingsSchema?: ThemeSettingSchemaItem[]
  blocks?: string[]
  base?: string
}

export type ThemeTemplate = {
  template?: string
  layout?: string
  slots?: string[]
}

export type ThemePart = {
  part?: string
  blocks?: string[]
}

export type ThemePackageSummary = {
  slug: string
  name: string
  version: string
  author?: string
  description?: string
  previewImage?: string
  settingsSchema: ThemeSettingSchemaItem[]
}

type ZipEntry = {
  path: string
  content: Buffer
}

function getThemeDirectory(themeName: string) {
  return path.join(themesRoot, assertThemeName(themeName))
}

function getThemeManifestPath(themeName: string) {
  return path.join(getThemeDirectory(themeName), themeManifestFilename)
}

function resolveThemePath(themeName: string, relativePath: string) {
  const directory = getThemeDirectory(themeName)
  const normalized = relativePath.replaceAll('\\', '/')

  if (normalized.startsWith('/') || normalized.includes('..')) {
    throw badRequest('Theme package contains an unsafe path.', 'INVALID_THEME_PACKAGE')
  }

  const absolutePath = path.resolve(directory, ...normalized.split('/'))
  if (absolutePath !== directory && !absolutePath.startsWith(`${directory}${path.sep}`)) {
    throw badRequest('Theme package path escapes its directory.', 'INVALID_THEME_PACKAGE')
  }

  return absolutePath
}

function assertString(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw badRequest(`Theme manifest field ${field} is required.`, 'INVALID_THEME_MANIFEST')
  }

  return value
}

function assertRecord(value: unknown, field: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw badRequest(`Theme manifest field ${field} must be an object.`, 'INVALID_THEME_MANIFEST')
  }

  return value as Record<string, unknown>
}

function validateSettingsSchema(value: unknown): ThemeSettingSchemaItem[] {
  if (!Array.isArray(value)) return []

  return value.map((item) => {
    const record = assertRecord(item, 'settingsSchema item')
    const type = record.type

    if (!['text', 'color', 'number', 'boolean', 'select', 'list', 'multiselect'].includes(String(type))) {
      throw badRequest('Theme settings schema contains an unsupported field type.', 'INVALID_THEME_MANIFEST')
    }

    return {
      key: assertString(record.key, 'settingsSchema.key'),
      label: assertString(record.label, 'settingsSchema.label'),
      description: typeof record.description === 'string' ? record.description : undefined,
      group: typeof record.group === 'string' ? record.group : undefined,
      type: type as ThemeSettingSchemaItem['type'],
      default: typeof record.default === 'string' || typeof record.default === 'number' || typeof record.default === 'boolean'
        ? record.default
        : Array.isArray(record.default) ? record.default.filter((v: unknown) => typeof v === 'string') : undefined,
      cssVariable: typeof record.cssVariable === 'string' ? record.cssVariable : undefined,
      options: Array.isArray(record.options)
        ? record.options.map((option) => {
            const optionRecord = assertRecord(option, 'settingsSchema option')
            return {
              label: assertString(optionRecord.label, 'settingsSchema.options.label'),
              value: assertString(optionRecord.value, 'settingsSchema.options.value'),
            }
          })
        : undefined,
      itemFields: Array.isArray(record.itemFields)
        ? record.itemFields.map((field) => {
            const fieldRecord = assertRecord(field, 'settingsSchema itemField')
            return {
              key: assertString(fieldRecord.key, 'settingsSchema.itemField.key'),
              label: assertString(fieldRecord.label, 'settingsSchema.itemField.label'),
              type: ['text', 'color', 'number', 'boolean', 'select'].includes(String(fieldRecord.type))
                ? fieldRecord.type as 'text' | 'color' | 'number' | 'boolean' | 'select'
                : 'text',
            }
          })
        : undefined,
    }
  })
}

function validateManifest(raw: unknown, expectedSlug?: string): ThemePackageManifest {
  const manifest = assertRecord(raw, 'manifest')
  const slug = assertThemeName(assertString(manifest.slug, 'slug'))

  if (expectedSlug && slug !== expectedSlug) {
    throw badRequest('Theme manifest slug must match the theme directory name.', 'INVALID_THEME_MANIFEST')
  }

  const templates = assertRecord(manifest.templates, 'templates')
  for (const requiredTemplate of ['home', 'articleDetail', 'taxonomy', 'search']) {
    if (typeof templates[requiredTemplate] !== 'string') {
      throw badRequest(`Theme manifest must declare template ${requiredTemplate}.`, 'INVALID_THEME_MANIFEST')
    }
  }

  const assets = manifest.assets === undefined ? undefined : assertRecord(manifest.assets, 'assets')
  const engineVersion = Number(manifest.engineVersion)

  if (!Number.isInteger(engineVersion) || engineVersion < 1) {
    throw badRequest('Theme manifest engineVersion must be a positive integer.', 'INVALID_THEME_MANIFEST')
  }

  return {
    slug,
    name: assertString(manifest.name, 'name'),
    version: assertString(manifest.version, 'version'),
    author: typeof manifest.author === 'string' ? manifest.author : undefined,
    description: typeof manifest.description === 'string' ? manifest.description : undefined,
    engine: manifest.engine === THEME_ENGINE ? THEME_ENGINE : (() => { throw badRequest('Theme engine is not supported.', 'UNSUPPORTED_THEME_ENGINE') })(),
    engineVersion,
    previewImage: typeof manifest.previewImage === 'string' ? manifest.previewImage : undefined,
    assets: assets ? { css: typeof assets.css === 'string' ? assets.css : undefined } : undefined,
    templates: Object.fromEntries(Object.entries(templates).filter((entry): entry is [string, string] => typeof entry[1] === 'string')),
    parts: manifest.parts && typeof manifest.parts === 'object' && !Array.isArray(manifest.parts)
      ? Object.fromEntries(Object.entries(manifest.parts).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
      : undefined,
    settingsSchema: validateSettingsSchema(manifest.settingsSchema),
    blocks: Array.isArray(manifest.blocks) ? manifest.blocks.filter((block): block is string => typeof block === 'string') : [],
  }
}

async function readJsonFile(filePath: string) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as unknown
  } catch {
    throw badRequest('Theme package contains invalid JSON.', 'INVALID_THEME_PACKAGE')
  }
}

async function walkThemeFiles(themeName: string, directory = getThemeDirectory(themeName), prefix = ''): Promise<ZipEntry[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files: ZipEntry[] = []

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name)
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name

    if (entry.isDirectory()) {
      files.push(...await walkThemeFiles(themeName, fullPath, relativePath))
      continue
    }

    if (entry.isFile()) {
      files.push({ path: relativePath, content: await readFile(fullPath) })
    }
  }

  return files
}

function findEndOfCentralDirectory(buffer: Buffer) {
  for (let index = buffer.length - 22; index >= 0; index -= 1) {
    if (buffer.readUInt32LE(index) === 0x06054b50) return index
  }

  throw badRequest('Theme package is not a valid zip file.', 'INVALID_THEME_PACKAGE')
}

function parseZip(buffer: Buffer): ZipEntry[] {
  if (buffer.byteLength > maxThemePackageBytes) {
    throw badRequest('Theme package must not exceed 2 MB.', 'THEME_PACKAGE_TOO_LARGE')
  }

  const eocd = findEndOfCentralDirectory(buffer)
  const entryCount = buffer.readUInt16LE(eocd + 10)
  const centralDirectoryOffset = buffer.readUInt32LE(eocd + 16)
  const entries: ZipEntry[] = []
  let offset = centralDirectoryOffset

  if (entryCount > maxThemeFileCount) {
    throw badRequest('Theme package contains too many files.', 'INVALID_THEME_PACKAGE')
  }

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw badRequest('Theme package central directory is invalid.', 'INVALID_THEME_PACKAGE')
    }

    const compressionMethod = buffer.readUInt16LE(offset + 10)
    const compressedSize = buffer.readUInt32LE(offset + 20)
    const fileNameLength = buffer.readUInt16LE(offset + 28)
    const extraLength = buffer.readUInt16LE(offset + 30)
    const commentLength = buffer.readUInt16LE(offset + 32)
    const localHeaderOffset = buffer.readUInt32LE(offset + 42)
    const filePath = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString('utf8').replaceAll('\\', '/')

    offset += 46 + fileNameLength + extraLength + commentLength

    if (!filePath || filePath.endsWith('/')) continue
    if (filePath.startsWith('/') || filePath.includes('..')) {
      throw badRequest('Theme package contains an unsafe file path.', 'INVALID_THEME_PACKAGE')
    }

    if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
      throw badRequest('Theme package local header is invalid.', 'INVALID_THEME_PACKAGE')
    }

    const localFileNameLength = buffer.readUInt16LE(localHeaderOffset + 26)
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28)
    const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraLength
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize)
    let content: Buffer

    if (compressionMethod === 0) {
      content = compressed
    } else if (compressionMethod === 8) {
      content = inflateRawSync(compressed)
    } else {
      throw badRequest('Theme package uses an unsupported compression method.', 'INVALID_THEME_PACKAGE')
    }

    entries.push({ path: filePath, content })
  }

  return entries
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff

  for (const byte of buffer) {
    crc ^= byte
    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
  }

  return (crc ^ 0xffffffff) >>> 0
}

function createZip(entries: ZipEntry[]) {
  const localParts: Buffer[] = []
  const centralParts: Buffer[] = []
  let offset = 0

  for (const entry of entries) {
    const name = Buffer.from(entry.path, 'utf8')
    const content = Buffer.isBuffer(entry.content) ? entry.content : Buffer.from(entry.content)
    const crc = crc32(content)
    const localHeader = Buffer.alloc(30)
    localHeader.writeUInt32LE(0x04034b50, 0)
    localHeader.writeUInt16LE(20, 4)
    localHeader.writeUInt16LE(0, 6)
    localHeader.writeUInt16LE(0, 8)
    localHeader.writeUInt32LE(crc, 14)
    localHeader.writeUInt32LE(content.length, 18)
    localHeader.writeUInt32LE(content.length, 22)
    localHeader.writeUInt16LE(name.length, 26)
    localHeader.writeUInt16LE(0, 28)

    localParts.push(localHeader, name, content)

    const centralHeader = Buffer.alloc(46)
    centralHeader.writeUInt32LE(0x02014b50, 0)
    centralHeader.writeUInt16LE(20, 4)
    centralHeader.writeUInt16LE(20, 6)
    centralHeader.writeUInt16LE(0, 8)
    centralHeader.writeUInt16LE(0, 10)
    centralHeader.writeUInt32LE(crc, 16)
    centralHeader.writeUInt32LE(content.length, 20)
    centralHeader.writeUInt32LE(content.length, 24)
    centralHeader.writeUInt16LE(name.length, 28)
    centralHeader.writeUInt16LE(0, 30)
    centralHeader.writeUInt16LE(0, 32)
    centralHeader.writeUInt32LE(offset, 42)
    centralParts.push(centralHeader, name)

    offset += localHeader.length + name.length + content.length
  }

  const centralDirectory = Buffer.concat(centralParts)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(entries.length, 8)
  eocd.writeUInt16LE(entries.length, 10)
  eocd.writeUInt32LE(centralDirectory.length, 12)
  eocd.writeUInt32LE(offset, 16)

  return Buffer.concat([...localParts, centralDirectory, eocd])
}

export function normalizeThemeName(value: unknown) {
  return typeof value === 'string' && value !== 'default' ? assertThemeName(value) : DEFAULT_THEME_NAME
}

function validateTemplate(raw: unknown): ThemeTemplate {
  const record = assertRecord(raw, 'template')

  return {
    template: typeof record.template === 'string' ? record.template : undefined,
    layout: typeof record.layout === 'string' ? record.layout : undefined,
    slots: Array.isArray(record.slots) ? record.slots.filter((slot): slot is string => typeof slot === 'string') : [],
  }
}

function validatePart(raw: unknown): ThemePart {
  const record = assertRecord(raw, 'part')

  return {
    part: typeof record.part === 'string' ? record.part : undefined,
    blocks: Array.isArray(record.blocks) ? record.blocks.filter((block): block is string => typeof block === 'string') : [],
  }
}

export async function readThemeManifest(themeName: string) {
  const slug = normalizeThemeName(themeName)
  const manifest = validateManifest(await readJsonFile(getThemeManifestPath(slug)), slug)

  if (manifest.engineVersion > THEME_ENGINE_VERSION) {
    throw badRequest('Theme package requires a newer theme engine.', 'UNSUPPORTED_THEME_VERSION')
  }

  return manifest
}

export async function themeExists(themeName: string) {
  try {
    const manifestFile = await stat(getThemeManifestPath(normalizeThemeName(themeName)))
    return manifestFile.isFile() && manifestFile.size > 0
  } catch {
    return false
  }
}

export async function listThemes(): Promise<ThemePackageSummary[]> {
  try {
    const entries = await readdir(themesRoot, { withFileTypes: true })
    const themes = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && /^[a-z0-9][a-z0-9_-]{0,63}$/.test(entry.name))
        .map(async (entry) => {
          try {
            const manifest = await readThemeManifest(entry.name)
            const summary: ThemePackageSummary = {
              slug: manifest.slug,
              name: manifest.name,
              version: manifest.version,
              author: manifest.author,
              description: manifest.description,
              previewImage: manifest.previewImage,
              settingsSchema: manifest.settingsSchema ?? [],
            }
            return summary
          } catch {
            return null
          }
        }),
    )

    return themes.filter((theme): theme is ThemePackageSummary => theme !== null).sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
  } catch {
    return []
  }
}

function rewriteThemeCssUrls(themeSlug: string, cssPath: string, css: string) {
  const cssDirectory = path.posix.dirname(cssPath.replaceAll('\\', '/'))

  return css.replace(/url\((['"]?)([^'")]+)\1\)/g, (_match, _quote: string, rawUrl: string) => {
    const value = rawUrl.trim()

    if (/^(https?:|data:|javascript:|\/)/i.test(value) || value.includes('..')) {
      throw badRequest('Theme CSS may only reference relative package assets.', 'INVALID_THEME_CSS')
    }

    const assetPath = path.posix.normalize(path.posix.join(cssDirectory, value))
    return `url("/api/themes/${themeSlug}/asset?path=${encodeURIComponent(assetPath)}")`
  })
}

export async function readThemeTemplate(themeName: string, templateKey: string) {
  try {
    const manifest = await readThemeManifest(themeName)
    const templatePath = manifest.templates[templateKey]
    if (!templatePath) return null
    return validateTemplate(await readJsonFile(resolveThemePath(manifest.slug, templatePath)))
  } catch {
    return null
  }
}

export async function readThemePart(themeName: string, partKey: string) {
  try {
    const manifest = await readThemeManifest(themeName)
    const partPath = manifest.parts?.[partKey]
    if (!partPath) return null
    return validatePart(await readJsonFile(resolveThemePath(manifest.slug, partPath)))
  } catch {
    return null
  }
}

export async function readThemeCss(themeName: string) {
  try {
    const manifest = await readThemeManifest(themeName)
    const cssPath = manifest.assets?.css ?? themeCssFallbackPath
    const css = await readFile(resolveThemePath(manifest.slug, cssPath), 'utf8')
    return rewriteThemeCssUrls(manifest.slug, cssPath, validateThemeCss(css))
  } catch {
    return null
  }
}

export async function readThemeAsset(themeName: string, assetPath: string) {
  const name = normalizeThemeName(themeName)
  return readFile(resolveThemePath(name, assetPath))
}

export async function installThemePackageFromZip(file: File) {
  const entries = parseZip(Buffer.from(await file.arrayBuffer()))
  const manifestEntry = entries.find((entry) => entry.path === themeManifestFilename)

  if (!manifestEntry) {
    throw badRequest('Theme package must include theme.json at its root.', 'INVALID_THEME_PACKAGE')
  }

  let manifest: ThemePackageManifest

  try {
    manifest = validateManifest(JSON.parse(manifestEntry.content.toString('utf8')))
  } catch (error) {
    if (error instanceof Error && error.name === 'ApiError') throw error
    throw badRequest('Theme package contains an invalid theme.json manifest.', 'INVALID_THEME_MANIFEST')
  }

  const files = entries.filter((entry) => entry.path !== themeManifestFilename)
  return installThemePackageFromManifest(manifest, files)
}

export async function installThemePackageFromManifest(manifest: ThemePackageManifest, files: Array<{ path: string; content: string | Buffer }>) {
  const slug = assertThemeName(manifest.slug)

  if (slug === DEFAULT_THEME_NAME) {
    throw conflict('The built-in default theme package cannot be overwritten.')
  }

  if (await themeExists(slug)) {
    throw conflict('A theme package with this slug already exists.')
  }

  validateManifest(manifest, slug)
  const directory = getThemeDirectory(slug)
  await mkdir(directory, { recursive: true })

  try {
    await writeFile(path.join(directory, themeManifestFilename), JSON.stringify(manifest, null, 2), 'utf8')

    for (const file of files) {
      const target = resolveThemePath(slug, file.path)
      await mkdir(path.dirname(target), { recursive: true })
      if (file.path.endsWith('.css')) rewriteThemeCssUrls(slug, file.path, validateThemeCss(String(file.content)))
      await writeFile(target, file.content)
    }
  } catch (error) {
    await rm(directory, { recursive: true, force: true }).catch(() => undefined)
    throw error
  }

  // 清除 resolver 内存缓存
  const { clearThemeCache } = await import('@/lib/theme/resolver')
  clearThemeCache(slug)

  return slug
}

export async function exportThemePackage(themeName: string) {
  const name = normalizeThemeName(themeName)
  if (!(await themeExists(name))) throw notFound('Theme package not found.')
  return createZip(await walkThemeFiles(name))
}

export async function deleteTheme(themeName: string) {
  const name = normalizeThemeName(themeName)

  if (name === DEFAULT_THEME_NAME) {
    throw conflict('The default theme package cannot be deleted.')
  }

  if (!(await themeExists(name))) {
    throw notFound('Theme package not found.')
  }

  await rm(getThemeDirectory(name), { recursive: true, force: true })

  // 清除 resolver 内存缓存
  const { clearThemeCache } = await import('@/lib/theme/resolver')
  clearThemeCache(name)
}

export async function ensureDefaultTheme() {
  return themeExists(DEFAULT_THEME_NAME)
}
