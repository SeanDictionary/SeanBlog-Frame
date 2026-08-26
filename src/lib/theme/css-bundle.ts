import { readThemeCss, readThemeManifest, type ThemeSettingSchemaItem } from '@/lib/theme'
import { getSiteSettingsMapSafe } from '@/lib/services/setting-service'

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

/**
 * Build the complete theme CSS (theme stylesheet + settings variables) for a given
 * theme slug. Falls back to the default theme if the requested theme has no CSS.
 * Used by both the public layout and the article editor preview to ensure
 * preview rendering matches the live site.
 */
export async function buildThemeCssBundle(): Promise<{ css: string; optionsCss: string } | null> {
  const settings = await getSiteSettingsMapSafe()
  const activeTheme = normalizeActiveTheme(settings.activeTheme)

  const customThemeCss = await readThemeCss(activeTheme).catch(() => null)
    ?? await readThemeCss('seanblog-default').catch(() => null)
  const themeOptionsCss = await buildThemeOptionsCss(activeTheme, settings)
    ?? await buildThemeOptionsCss('seanblog-default', settings)

  const css = [customThemeCss, themeOptionsCss].filter(Boolean).join('\n')
  const optionsCss = themeOptionsCss ?? ''

  if (!css) return null
  return { css, optionsCss }
}
