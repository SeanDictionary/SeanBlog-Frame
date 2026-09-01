import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { flattenSchemaItems, readThemeCss, readThemeManifest, type ThemeSettingSchemaItem } from '@/lib/theme'
import { getActiveThemeSettings } from '@/lib/services/theme-settings-service'
import { DEFAULT_CALLOUT_CSS } from '@/lib/content/callout-css'
import { DEFAULT_HIGHLIGHT_CSS } from '@/lib/content/highlight-css'
import { getKatexCssLink } from '@/lib/content/math-css'
import { validateThemeCss } from '@/lib/validations/theme'

async function buildThemeOptionsCss(themeSlug: string, settings: Record<string, unknown>): Promise<string | null> {
  const manifest = await readThemeManifest(themeSlug).catch(() => null)
  const schema = manifest?.settingsSchema
  if (!schema) return null
  const items = flattenSchemaItems(schema)
  if (!items.length) return null

  // cssVariable 名必须是合法 CSS 自定义属性（--foo-bar），防止名注入。
  const varNamePattern = /^--[a-zA-Z0-9_-]+$/
  // 值剥离 ; {} < > 与 url( / @ / expression，防止从 :root{--x: VALUE} 上下文
  // 断裂注入任意 CSS（calloutCustomCss 已单独走 validateThemeCss，此处收口其余
  // cssVariable 绑定的 color/text 等设置值）。
  const sanitizeValue = (raw: string) =>
    raw.replace(/[;{}<>]/g, '').replace(/url\(/gi, '').replace(/@/g, '').replace(/expression\(/gi, '')

  const variables = items
    .map((item: ThemeSettingSchemaItem) => {
      if (!item.cssVariable || !varNamePattern.test(item.cssVariable)) return null
      const value = settings[item.key] ?? item.default
      if (typeof value !== 'string' && typeof value !== 'number') return null
      return `${item.cssVariable}: ${sanitizeValue(String(value))}`
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
export async function buildThemeCssBundle(): Promise<{ css: string; calloutCss: string; katexCssLink: string } | null> {
  const { themeSlug, settings } = await getActiveThemeSettings()

  const customThemeCss = await readThemeCss(themeSlug).catch(() => null)
    ?? await readThemeCss('seanblog-default').catch(() => null)
  const themeOptionsCss = await buildThemeOptionsCss(themeSlug, settings)
    ?? await buildThemeOptionsCss('seanblog-default', settings)

  // Callout CSS: per-theme custom → theme preset → default
  // calloutCustomCss 是管理员自定义 CSS，直接注入 <style>，必须走与主题 CSS
  // 相同的校验（拦 </style> / @import / !important / 远程 url() / < > 等），
  // 非法则回退到主题 preset / 内置默认，绝不破坏渲染。
  let calloutCustom: string | null = null
  if (typeof settings.calloutCustomCss === 'string' && (settings.calloutCustomCss as string).trim()) {
    try {
      calloutCustom = validateThemeCss(settings.calloutCustomCss as string)
    } catch {
      calloutCustom = null
    }
  }
  const calloutPreset = await readThemeCalloutPreset(themeSlug)
  const calloutCss = calloutCustom ?? calloutPreset ?? DEFAULT_CALLOUT_CSS

  const css = [customThemeCss, themeOptionsCss, DEFAULT_HIGHLIGHT_CSS].filter(Boolean).join('\n')
  const katexCssLink = getKatexCssLink()

  if (!customThemeCss && !themeOptionsCss && calloutCss === DEFAULT_CALLOUT_CSS) return null
  return { css, calloutCss, katexCssLink }
}
