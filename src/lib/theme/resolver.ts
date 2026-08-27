/**
 * 主题页面解析器
 *
 * 主题用 themes/{slug}/pages/{pageKey}.tsx 全权决定前台页面布局/样式。
 *
 * 渲染模型：主题页面由 Next 的 bundler 在构建期打包（dev + prod 一致），
 * 因此享有正确的 react-server 条件与单一 React 实例——这是 RSC 的硬性要求。
 * 运行时按需 dynamic import('@themes/{slug}/pages/{pageKey}')。
 *
 * 安全沙箱：import 白名单（仅 react/next）由 themes:build 脚本与 CI 校验，
 * 详见 docs/theme-development.md。
 *
 * Fallback 链：
 * 1. 活跃主题 pages/{pageKey}.tsx → 用它
 * 2. manifest.base 主题的 pages/{pageKey}.tsx → 用 base
 * 3. 默认主题 seanblog-default 的 pages/{pageKey}.tsx → 用默认
 * 4. 都没有 → 返回 null（路由层走 slot 系统降级）
 */

import type { ComponentType } from 'react'

import { readThemeManifest } from '@/lib/theme'
import type { PageType, ThemePage } from '@/lib/theme/page-types'

const CURRENT_ENGINE_VERSION = 1
const DEFAULT_THEME = 'seanblog-default'

/** 内存缓存：解析后的组件按 themeSlug + pageKey 缓存 */
const moduleCache = new Map<string, ComponentType<any>>()

/** 清除指定主题的缓存（主题更新/删除时调用） */
export function clearThemeCache(themeSlug?: string) {
  if (!themeSlug) {
    moduleCache.clear()
    return
  }
  for (const key of moduleCache.keys()) {
    if (key.startsWith(themeSlug + ':')) {
      moduleCache.delete(key)
    }
  }
}

/** 预编译主题所有页面（安装时 / CI 用，仅做沙箱校验，不参与运行时渲染） */
export async function preloadTheme(themeSlug: string) {
  const { bundleTheme } = await import('@/lib/theme/bundler')
  await bundleTheme(themeSlug)
}

/** 删除主题编译产物（主题删除时调用） */
export async function purgeThemeBuild(themeSlug: string) {
  const { clearThemeBuild } = await import('@/lib/theme/bundler')
  await clearThemeBuild(themeSlug)
}

/**
 * 解析主题页面组件。
 * 返回 null 表示没有 JSX 页面，调用方应走 slot 系统降级。
 */
export async function resolveThemePage(
  themeSlug: string,
  pageKey: PageType,
): Promise<ThemePage | null> {
  const cacheKey = `${themeSlug}:${pageKey}`

  const cached = moduleCache.get(cacheKey)
  if (cached) return cached

  // 检查引擎版本 + 获取 base 声明
  const manifest = await readThemeManifest(themeSlug).catch(() => null)
  if (manifest && manifest.engineVersion !== CURRENT_ENGINE_VERSION) {
    console.warn(
      `[theme] 主题 "${themeSlug}" engineVersion=${manifest.engineVersion} 不兼容当前版本 ${CURRENT_ENGINE_VERSION}，降级到 slot 系统`,
    )
    return null
  }

  // 尝试活跃主题
  const component = await tryLoad(themeSlug, pageKey)
  if (component) {
    moduleCache.set(cacheKey, component)
    return component
  }

  // 尝试 base 主题（如果声明了 base）
  if (manifest?.base && manifest.base !== themeSlug) {
    const baseComponent = await tryLoad(manifest.base, pageKey)
    if (baseComponent) {
      moduleCache.set(cacheKey, baseComponent)
      return baseComponent
    }
  }

  // 尝试默认主题
  if (themeSlug !== DEFAULT_THEME && (!manifest?.base || manifest.base !== DEFAULT_THEME)) {
    const fallback = await tryLoad(DEFAULT_THEME, pageKey)
    if (fallback) {
      moduleCache.set(cacheKey, fallback)
      return fallback
    }
  }
  return null
}

// --- 加载函数：Next dynamic import（构建期打包，react-server 条件正确） ---

async function tryLoad(slug: string, pageKey: PageType): Promise<ComponentType<any> | null> {
  try {
    // 模板字符串 dynamic import：turbopack/webpack 会将其作为 glob 打包
    // 所有 themes/*/pages/*.tsx，构建期应用 react-server 条件。
    const mod = await import(`@themes/${slug}/pages/${pageKey}`)
    const def = (mod as { default?: unknown }).default
    return typeof def === 'function' ? (def as ComponentType<any>) : null
  } catch (error) {
    // 模块不存在（主题未提供该页面）→ 静默返回 null，走 fallback
    if (isModuleNotFoundError(error)) return null
    console.error(`[theme] 加载主题页面失败: ${slug}/pages/${pageKey}`, error)
    return null
  }
}

function isModuleNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const msg = error.message.toLowerCase()
  return msg.includes('cannot find module') || msg.includes('could not be found') || error.name === 'MODULE_NOT_FOUND'
}
