/**
 * 主题页面解析器
 *
 * 根据活跃主题解析对应的页面组件。
 * Dev 模式：Next.js 原生 import()（HMR + 类型检查）
 * Production 模式：esbuild 编译 + Module._compile + require 拦截
 *
 * Fallback 链：
 * 1. 活跃主题的 pages/{pageKey}.tsx → 用它
 * 2. 默认主题的 pages/{pageKey}.tsx → 用默认
 * 3. 都没有 → 返回 null（路由层走 slot 系统降级）
 */

import type { ComponentType } from 'react'
import path from 'node:path'
import Module from 'node:module'

import { readThemeManifest } from '@/lib/theme'
import type { PageType, ThemePage } from '@/lib/theme/page-types'

const CURRENT_ENGINE_VERSION = 1
const DEFAULT_THEME = 'seanblog-default'

/** 内存缓存：编译后的模块按 themeSlug + pageKey 缓存 */
const moduleCache = new Map<string, ComponentType<any>>()

/** 清除指定主题的缓存（主题更新时调用） */
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

/**
 * 解析主题页面组件。
 * 返回 null 表示没有 JSX 页面，调用方应走 slot 系统降级。
 */
export async function resolveThemePage(
  themeSlug: string,
  pageKey: PageType,
): Promise<ThemePage | null> {
  const cacheKey = `${themeSlug}:${pageKey}`

  // 缓存命中
  const cached = moduleCache.get(cacheKey)
  if (cached) return cached

  // 检查引擎版本
  const manifest = await readThemeManifest(themeSlug).catch(() => null)
  if (manifest && manifest.engineVersion !== CURRENT_ENGINE_VERSION) {
    console.warn(`[theme] 主题 "${themeSlug}" engineVersion=${manifest.engineVersion} 不兼容当前版本 ${CURRENT_ENGINE_VERSION}，降级到 slot 系统`)
    return null
  }

  // Dev 模式：Next.js 原生 import
  if (process.env.NODE_ENV === 'development') {
    const component = await tryDevImport(themeSlug, pageKey)
    if (component) {
      moduleCache.set(cacheKey, component)
      return component
    }
    // 尝试默认主题
    if (themeSlug !== DEFAULT_THEME) {
      const fallback = await tryDevImport(DEFAULT_THEME, pageKey)
      if (fallback) {
        moduleCache.set(cacheKey, fallback)
        return fallback
      }
    }
    return null
  }

  // Production 模式：esbuild 编译 + Module._compile
  const component = await tryProdLoad(themeSlug, pageKey)
  if (component) {
    moduleCache.set(cacheKey, component)
    return component
  }
  if (themeSlug !== DEFAULT_THEME) {
    const fallback = await tryProdLoad(DEFAULT_THEME, pageKey)
    if (fallback) {
      moduleCache.set(cacheKey, fallback)
      return fallback
    }
  }
  return null
}

// --- Dev 模式 ---

async function tryDevImport(slug: string, pageKey: PageType): Promise<ComponentType<any> | null> {
  try {
    const mod = await import(`@themes/${slug}/pages/${pageKey}`)
    return (mod as any).default ?? null
  } catch {
    return null
  }
}

// --- Production 模式 ---

let esbuildLoaded: any = null

async function getEsbuild() {
  if (!esbuildLoaded) {
    // 使用 eval 阻止 turbopack 静态分析此 import
    esbuildLoaded = await eval('import("esbuild")')
  }
  return esbuildLoaded
}

async function tryProdLoad(slug: string, pageKey: PageType): Promise<ComponentType<any> | null> {
  try {
    const { readFile } = await import('node:fs/promises')
    const filePath = path.join(process.cwd(), 'themes', slug, 'pages', `${pageKey}.tsx`)

    let source: string
    try {
      source = await readFile(filePath, 'utf8')
    } catch {
      return null
    }

    // esbuild 编译 TSX → CJS
    const esbuild = await getEsbuild()
    const { code } = await esbuild.transform(source, {
      loader: 'tsx',
      format: 'cjs',
      target: 'es2020',
    })

    // Module._compile + require 拦截
    const m = new Module(filePath)
    m.filename = filePath
    ;(m as any).paths = (Module as any)._nodeModulePaths(path.dirname(filePath))

    const origRequire = (m as any).require.bind(m)
    ;(m as any).require = (id: string) => {
      if (id === 'react') return require('react')
      if (id === 'react/jsx-runtime') return require('react/jsx-runtime')
      if (id === 'react-dom/server') return require('react-dom/server')
      return origRequire(id)
    }

    ;(m as any)._compile(code, filePath)
    const component = (m.exports as any).default
    if (typeof component !== 'function') return null
    return component as ComponentType<any>
  } catch (error) {
    console.error(`[theme] 加载主题页面失败: ${slug}/pages/${pageKey}`, error)
    return null
  }
}
