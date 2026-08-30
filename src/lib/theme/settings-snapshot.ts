import { createHash } from 'node:crypto'

import { badRequest } from '@/lib/api/errors'
import { validateThemeCss } from '@/lib/validations/theme'
import type { SettingsSchema, ThemePackageManifest, ThemeSettingSchemaItem } from '@/lib/theme'
import { flattenSchemaItems } from '@/lib/theme/schema-utils'

export const THEME_SETTINGS_FORMAT_VERSION = 1
export const DEFAULT_SETTINGS_SCHEMA_VERSION = 1
export const THEME_SETTINGS_FILENAME = 'theme-settings.json'

export type ThemeSettingsImportMode = 'ignore' | 'preserve' | 'restore'

export type ThemeSettingsSnapshot = {
  formatVersion: number
  theme: {
    slug: string
    version: string
  }
  settingsVersion: number
  settingsSchemaHash: string
  exportedAt: string
  settings: Record<string, unknown>
}

export type PreparedThemeSettings = {
  settings: Record<string, unknown>
  warnings: string[]
}

type Migration = (settings: Record<string, unknown>) => Record<string, unknown>

const migrations = new Map<string, Map<number, Migration>>()

/** Register one declarative application-side migration step for a theme. */
export function registerThemeSettingsMigration(themeSlug: string, fromVersion: number, migrate: Migration) {
  if (!Number.isInteger(fromVersion) || fromVersion < 1) {
    throw new Error('Theme settings migration versions must be positive integers.')
  }
  const byVersion = migrations.get(themeSlug) ?? new Map<number, Migration>()
  byVersion.set(fromVersion, migrate)
  migrations.set(themeSlug, byVersion)
}

function ensureBuiltInMigrations() {
  if (migrations.has('cardinal')) return
  registerThemeSettingsMigration('cardinal', 1, (settings) => {
    const next = { ...settings }
    const legacyHeroStyle = next.heroStyle

    // 旧版 Hero 样式都在主栏内；仅旧 fullscreen 迁移为新的宽屏全屏模式。
    if (next.heroWidth === undefined && typeof legacyHeroStyle === 'string') {
      next.heroWidth = legacyHeroStyle === 'fullscreen' ? 'wide' : 'narrow'
    }
    if (next.heroHeight === undefined && legacyHeroStyle === 'fullscreen') {
      next.heroHeight = 'fullscreen'
    }
    if (next.cardTitleColor === 'auto') next.cardTitleColor = 'follow'
    delete next.heroStyle
    return next
  })
}

function getRegisteredMigration(themeSlug: string, fromVersion: number) {
  ensureBuiltInMigrations()
  return migrations.get(themeSlug)?.get(fromVersion)
}

export function getThemeSettingsVersion(manifest: Pick<ThemePackageManifest, 'settingsVersion'>) {
  return manifest.settingsVersion ?? DEFAULT_SETTINGS_SCHEMA_VERSION
}

export function migrateThemeSettingsToManifest(
  settings: Record<string, unknown>,
  fromVersion: number,
  manifest: ThemePackageManifest,
): { settings: Record<string, unknown>; version: number } {
  ensureBuiltInMigrations()
  const currentVersion = getThemeSettingsVersion(manifest)
  let version = fromVersion
  let migrated = { ...settings }

  if (!Number.isInteger(version) || version < 1) {
    throw badRequest('Theme settings version must be a positive integer.', 'INVALID_THEME_SETTINGS')
  }
  if (version > currentVersion) {
    throw badRequest('Theme settings require a newer theme settings version.', 'UNSUPPORTED_THEME_SETTINGS_VERSION')
  }
  while (version < currentVersion) {
    const migrate = getRegisteredMigration(manifest.slug, version)
    if (!migrate) {
      throw badRequest(`No migration is registered for ${manifest.slug} settings v${version} → v${version + 1}.`, 'THEME_SETTINGS_MIGRATION_REQUIRED')
    }
    migrated = migrate(migrated)
    version += 1
  }
  return { settings: migrated, version }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    )
  }
  return value
}

function schemaItemSignature(item: ThemeSettingSchemaItem) {
  return {
    key: item.key,
    type: item.type,
    default: item.default,
    options: item.options,
    itemFields: item.itemFields,
    if: item.if,
    min: item.min,
    max: item.max,
    step: item.step,
  }
}

export function getSettingsSchemaHash(schema: SettingsSchema | undefined) {
  const items = flattenSchemaItems(schema ?? {})
    .map(schemaItemSignature)
    .sort((left, right) => left.key.localeCompare(right.key))
  const payload = JSON.stringify(canonicalize(items))
  return `sha256:${createHash('sha256').update(payload).digest('hex')}`
}

export function createThemeSettingsSnapshot({
  manifest,
  settings,
}: {
  manifest: ThemePackageManifest
  settings: Record<string, unknown>
}): ThemeSettingsSnapshot {
  return {
    formatVersion: THEME_SETTINGS_FORMAT_VERSION,
    theme: { slug: manifest.slug, version: manifest.version },
    settingsVersion: getThemeSettingsVersion(manifest),
    settingsSchemaHash: getSettingsSchemaHash(manifest.settingsSchema),
    exportedAt: new Date().toISOString(),
    settings,
  }
}

function assertSnapshotRecord(value: unknown, field: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw badRequest(`Theme settings snapshot field ${field} must be an object.`, 'INVALID_THEME_SETTINGS')
  }
  return value as Record<string, unknown>
}

/** Parse and validate the portable snapshot envelope before installing it. */
export function parseThemeSettingsSnapshot(value: unknown, expectedSlug?: string): ThemeSettingsSnapshot {
  const record = assertSnapshotRecord(value, 'root')
  if (record.formatVersion !== THEME_SETTINGS_FORMAT_VERSION) {
    throw badRequest(`Unsupported theme settings format version: ${String(record.formatVersion)}.`, 'UNSUPPORTED_THEME_SETTINGS_FORMAT')
  }

  const theme = assertSnapshotRecord(record.theme, 'theme')
  if (typeof theme.slug !== 'string' || !theme.slug.trim() || typeof theme.version !== 'string' || !theme.version.trim()) {
    throw badRequest('Theme settings snapshot contains an invalid theme identity.', 'INVALID_THEME_SETTINGS')
  }
  if (expectedSlug && theme.slug !== expectedSlug) {
    throw badRequest('Theme settings snapshot slug does not match the theme package.', 'THEME_SETTINGS_SLUG_MISMATCH')
  }

  if (!Number.isInteger(record.settingsVersion) || Number(record.settingsVersion) < 1) {
    throw badRequest('Theme settings snapshot contains an invalid settings version.', 'INVALID_THEME_SETTINGS')
  }
  if (typeof record.settingsSchemaHash !== 'string' || !record.settingsSchemaHash.trim()) {
    throw badRequest('Theme settings snapshot is missing settingsSchemaHash.', 'INVALID_THEME_SETTINGS')
  }
  if (typeof record.exportedAt !== 'string' || !record.exportedAt.trim()) {
    throw badRequest('Theme settings snapshot is missing exportedAt.', 'INVALID_THEME_SETTINGS')
  }

  const settings = assertSnapshotRecord(record.settings, 'settings')
  return {
    formatVersion: THEME_SETTINGS_FORMAT_VERSION,
    theme: { slug: theme.slug, version: theme.version },
    settingsVersion: Number(record.settingsVersion),
    settingsSchemaHash: record.settingsSchemaHash,
    exportedAt: record.exportedAt,
    settings,
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function validateItemValue(item: ThemeSettingSchemaItem, value: unknown, path: string) {
  if (item.type === 'boolean' && typeof value !== 'boolean') {
    throw badRequest(`${path} must be boolean.`, 'INVALID_THEME_SETTINGS')
  }
  if ((item.type === 'text' || item.type === 'textarea' || item.type === 'color') && typeof value !== 'string') {
    throw badRequest(`${path} must be string.`, 'INVALID_THEME_SETTINGS')
  }
  if ((item.type === 'number' || item.type === 'range') && !isFiniteNumber(value)) {
    throw badRequest(`${path} must be a finite number.`, 'INVALID_THEME_SETTINGS')
  }
  if (item.type === 'range' && isFiniteNumber(value)) {
    if (item.min !== undefined && value < item.min) throw badRequest(`${path} is below its minimum.`, 'INVALID_THEME_SETTINGS')
    if (item.max !== undefined && value > item.max) throw badRequest(`${path} is above its maximum.`, 'INVALID_THEME_SETTINGS')
  }
  if (item.type === 'select') {
    if (typeof value !== 'string' || (item.options && !item.options.some((option) => option.value === value))) {
      throw badRequest(`${path} has an invalid option.`, 'INVALID_THEME_SETTINGS')
    }
  }
  if (item.type === 'multiselect') {
    if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
      throw badRequest(`${path} must be an array of strings.`, 'INVALID_THEME_SETTINGS')
    }
    if (item.options && value.some((entry) => !item.options?.some((option) => option.value === entry))) {
      throw badRequest(`${path} contains an invalid option.`, 'INVALID_THEME_SETTINGS')
    }
  }
  if (item.type === 'list') {
    if (!Array.isArray(value)) throw badRequest(`${path} must be an array.`, 'INVALID_THEME_SETTINGS')
    for (const [index, entry] of value.entries()) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        throw badRequest(`${path}[${index}] must be an object.`, 'INVALID_THEME_SETTINGS')
      }
      for (const field of item.itemFields ?? []) {
        const fieldValue = (entry as Record<string, unknown>)[field.key]
        if (fieldValue === undefined) continue
        if (field.type === 'select' && (typeof fieldValue !== 'string' || (field.options && !field.options.some((option) => option.value === fieldValue)))) {
          throw badRequest(`${path}[${index}].${field.key} has an invalid option.`, 'INVALID_THEME_SETTINGS')
        }
        if (field.type === 'number' && typeof fieldValue !== 'number' && (typeof fieldValue !== 'string' || !fieldValue.trim() || !Number.isFinite(Number(fieldValue)))) {
          throw badRequest(`${path}[${index}].${field.key} must be numeric.`, 'INVALID_THEME_SETTINGS')
        }
        if (field.type === 'boolean' && typeof fieldValue !== 'boolean' && fieldValue !== 'true' && fieldValue !== 'false') {
          throw badRequest(`${path}[${index}].${field.key} must be boolean.`, 'INVALID_THEME_SETTINGS')
        }
      }
    }
  }
}

export function validateThemeSettingsValues(schema: SettingsSchema | undefined, settings: Record<string, unknown>) {
  const itemsByKey = new Map(flattenSchemaItems(schema ?? {}).map((item) => [item.key, item]))
  for (const [key, value] of Object.entries(settings)) {
    if (key === 'calloutCustomCss') {
      if (typeof value !== 'string') throw badRequest('calloutCustomCss must be a string.', 'INVALID_THEME_SETTINGS')
      if (value.trim()) validateThemeCss(value)
      continue
    }
    const item = itemsByKey.get(key)
    if (item) validateItemValue(item, value, key)
  }
}

/**
 * Migrate a snapshot to the installed theme's settings version and filter
 * fields unknown to the current schema. New fields are intentionally omitted,
 * so the current theme's defaults continue to apply to them.
 */
export function prepareThemeSettingsSnapshot(snapshot: ThemeSettingsSnapshot, manifest: ThemePackageManifest): PreparedThemeSettings {
  if (snapshot.theme.slug !== manifest.slug) {
    throw badRequest('Theme settings snapshot slug does not match the installed theme.', 'THEME_SETTINGS_SLUG_MISMATCH')
  }

  const currentVersion = getThemeSettingsVersion(manifest)
  let version = snapshot.settingsVersion
  let settings = { ...snapshot.settings }
  const warnings: string[] = []

  if (version > currentVersion) {
    throw badRequest('Theme settings snapshot requires a newer theme settings version.', 'UNSUPPORTED_THEME_SETTINGS_VERSION')
  }
  while (version < currentVersion) {
    const migrate = getRegisteredMigration(manifest.slug, version)
    if (!migrate) {
      throw badRequest(`No migration is registered for ${manifest.slug} settings v${version} → v${version + 1}.`, 'THEME_SETTINGS_MIGRATION_REQUIRED')
    }
    settings = migrate({ ...settings })
    version += 1
  }

  const expectedHash = getSettingsSchemaHash(manifest.settingsSchema)
  if (snapshot.settingsSchemaHash !== expectedHash) {
    warnings.push('The settings schema hash differs; compatible fields were imported and unknown fields were ignored.')
  }

  const knownKeys = new Set(flattenSchemaItems(manifest.settingsSchema ?? {}).map((item) => item.key))
  const filtered: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(settings)) {
    if (key === 'calloutCustomCss') {
      if (typeof value !== 'string') throw badRequest('calloutCustomCss must be a string.', 'INVALID_THEME_SETTINGS')
      filtered[key] = value.trim() ? validateThemeCss(value) : value
      continue
    }
    if (!knownKeys.has(key)) {
      warnings.push(`Ignored unknown theme setting: ${key}`)
      continue
    }
    filtered[key] = value
  }

  const itemsByKey = new Map(flattenSchemaItems(manifest.settingsSchema ?? {}).map((item) => [item.key, item]))
  for (const [key, value] of Object.entries(filtered)) {
    const item = itemsByKey.get(key)
    if (item) validateItemValue(item, value, key)
  }

  return { settings: filtered, warnings }
}
