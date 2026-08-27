import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { readThemeCss, readThemeManifest, type ThemeSettingSchemaItem } from '@/lib/theme'
import { getSiteSettingsMapSafe } from '@/lib/services/setting-service'
import { DEFAULT_CALLOUT_CSS } from '@/lib/content/callout-css'

function normalizeActiveTheme(value: unknown) {
  return typeof value === 'string' && value !== 'default' ? value : 'seanblog-default'
}

async function buildThemeOptionsCss(themeSlug: string, settings: Record<string, unknown>): Promise<string | null> {
  const manifest = await readThemeManifest(themeSlug).catch(() => null)
  if (!manifest?.settingsSchema?.length) return null

  const variables = manifest.settingsSchema
    .map((item: ThemeSettingSchemaItem) => {
      if (!item.cssVariable) return null
      const value = settings[`themeSetting:${manifest.slug}:${item.key}`] ?? item.default
      if (typeof value !== 'string' && typeof value !== 'number') return null
      return `${item.cssVariable}: ${value}`
    })
    .filter((item): item is string => item !== null)

  return variables.length ? `:root{${variables.join(';')}}` : null
}

/** Read a theme's preset callout CSS from assets/callout.css (if exists). */
async function readThemeCalloutPreset(themeSlug: string): Promise<string | null> {
  try {
    const manifest = await readThemeManifest(themeSlug)
    const cssPath = path.join(process.cwd(), 'themes', manifest.slug, 'assets', 'callout.css')
    return await readFile(cssPath, 'utf8')
  } catch {
    return null
  }
}

/**
 * Build the complete theme CSS bundle (theme stylesheet + settings variables + callout CSS).
 * Callout CSS resolution: per-theme custom setting → theme preset → default built-in.
 */
export async function buildThemeCssBundle(): Promise<{ css: string; calloutCss: string } | null> {
  const settings = await getSiteSettingsMapSafe()
  const activeTheme = normalizeActiveTheme(settings.activeTheme)

  const customThemeCss = await readThemeCss(activeTheme).catch(() => null)
    ?? await readThemeCss('seanblog-default').catch(() => null)
  const themeOptionsCss = await buildThemeOptionsCss(activeTheme, settings)
    ?? await buildThemeOptionsCss('seanblog-default', settings)

  // Callout CSS: per-theme custom → theme preset → default
  const calloutSettingKey = `calloutCustomCss:${activeTheme}`
  const calloutCustom = typeof settings[calloutSettingKey] === 'string' && (settings[calloutSettingKey] as string).trim()
    ? settings[calloutSettingKey] as string
    : null
  const calloutPreset = await readThemeCalloutPreset(activeTheme)
  const calloutCss = calloutCustom ?? calloutPreset ?? DEFAULT_CALLOUT_CSS

  const css = [customThemeCss, themeOptionsCss].filter(Boolean).join('\n')

  if (!css && calloutCss === DEFAULT_CALLOUT_CSS) return null
  return { css, calloutCss }
}
