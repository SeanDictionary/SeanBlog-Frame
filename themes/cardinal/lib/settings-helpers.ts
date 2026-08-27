/**
 * Cardinal 主题共享设置助手
 *
 * 从 data.settings 读取主题设置值，生成动态 CSS 变量。
 */

type Settings = Record<string, unknown>

export function getSetting<T>(settings: Settings, key: string, fallback: T): T {
  const v = settings[key]
  return (v !== undefined ? v : fallback) as unknown as T
}

export function getSettingString(settings: Settings, key: string, fallback: string): string {
  const v = settings[key]
  return typeof v === 'string' ? v : fallback
}

export function isSettingTrue(settings: Settings, key: string): boolean {
  return settings[key] === true || settings[key] === 'true'
}

// --- CSS 变量生成 ---

const FONT_MAP: Record<string, string> = {
  monospace: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  sans: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif",
  serif: "Georgia, 'Noto Serif SC', 'Songti SC', 'Source Han Serif SC', serif",
}

const RADIUS_MAP: Record<string, Record<string, string>> = {
  none: { '--radius-sm': '0', '--radius': '0', '--radius-lg': '0', '--radius-xl': '0' },
  small: { '--radius-sm': '0.125rem', '--radius': '0.25rem', '--radius-lg': '0.5rem', '--radius-xl': '1rem' },
  medium: { '--radius-sm': '0.25rem', '--radius': '0.5rem', '--radius-lg': '0.75rem', '--radius-xl': '1.5rem' },
  large: { '--radius-sm': '0.5rem', '--radius': '1rem', '--radius-lg': '1.5rem', '--radius-xl': '2rem' },
}

const WIDTH_MAP: Record<string, string> = {
  narrow: '30rem',
  medium: '42rem',
  wide: '64rem',
}

/** 生成动态 CSS 变量字符串（用于 <style> 标签） */
export function buildDynamicCss(settings: Settings): string {
  const vars: string[] = []

  // 字体
  const font = getSetting(settings, 'fontFamily', 'monospace')
  if (FONT_MAP[font]) vars.push(`--font-sans: ${FONT_MAP[font]}`)

  const headingFont = getSetting(settings, 'headingFontFamily', 'same')
  if (headingFont === 'same') {
    vars.push('--font-heading: var(--font-sans)')
  } else if (FONT_MAP[headingFont]) {
    vars.push(`--font-heading: ${FONT_MAP[headingFont]}`)
  }

  // 圆角
  const radius = getSetting(settings, 'borderRadius', 'small')
  if (RADIUS_MAP[radius]) {
    for (const [k, v] of Object.entries(RADIUS_MAP[radius])) {
      vars.push(`${k}: ${v}`)
    }
  }

  // 内容宽度
  const width = getSetting(settings, 'contentWidth', 'medium')
  if (WIDTH_MAP[width]) vars.push(`--layout-content-max-width: ${WIDTH_MAP[width]}`)

  // 阴影
  const shadow = isSettingTrue(settings, 'showShadow')
  vars.push(`--shadow-card: ${shadow ? '0 2px 8px rgba(0,0,0,0.08)' : 'none'}`)
  vars.push(`--shadow-header: ${shadow ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'}`)

  return `:root{${vars.join(';')}}`
}

// --- 布局类名生成 ---

export function getLayoutClass(settings: Settings): string {
  const pos = getSetting(settings, 'sidebarPosition', 'right')
  const sticky = getSetting(settings, 'sidebarSticky', 'sticky')
  return `cf-layout cf-layout--${pos} cf-sidebar--${sticky}`
}

// --- 侧边栏内容 ---

export function getSidebarItems(settings: Settings): string[] {
  const items = settings.sidebarContent
  if (Array.isArray(items)) return items.filter((v): v is string => typeof v === 'string')
  return ['profile', 'recent', 'tags']
}
