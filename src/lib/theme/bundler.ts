/**
 * 主题包安装时/按需预编译器
 *
 * 用 esbuild.build 把 themes/{slug}/pages/{pageKey}.tsx 编译为自包含 CJS，
 * 产物写入 themes/{slug}/.build/{pageKey}.cjs，运行时仅 require 产物。
 *
 * 为什么要 bundle 而不是 transform：
 * - esbuild.transform 只编译单文件，不处理 import；@/ 别名、包内 lib/*.ts
 *   helper 在生产环境会变成运行时 require 失败。
 * - esbuild.build 跟随 import 全部内联进单产物，alias/plugin 在编译期解析。
 *
 * 安全沙箱（最严白名单）：
 * - 主题只能 import react / react-dom / next（含子路径，如 next/link、react/jsx-runtime）。
 * - @/* 别名、node:* 内置模块、任意第三方 npm 包一律报错。
 *   主题需要平台能力时，通过 data.components 注入获取。
 * - 包内相对 import（../lib/*.ts）允许，会被一并与 entry 内联。
 */

import path from 'node:path'

import { badRequest } from '@/lib/api/errors'

const THEME_PAGE_KEYS = ['home', 'article-detail', 'taxonomy', 'categories-index', 'tags-index', 'search'] as const
type ThemePageKey = (typeof THEME_PAGE_KEYS)[number]

const themesRoot = path.join(process.cwd(), 'themes')

/** 允许 external（运行时从宿主 node_modules 解析）的 import */
const EXTERNAL_PATTERN = /^(react|react-dom|react\/.+|next|next\/.+)$/

/** 明确禁止的 import（即使 esbuild 没识别为 bare，也兜底拒绝） */
const FORBIDDEN_PATTERN = /^(node:|fs|path|child_process|os|crypto|http|https|net|dns|cluster|worker_threads|v8|util|stream|zlib|url|querystring|events|assert|buffer|process)$/

let esbuildLoaded: typeof import('esbuild') | null = null

async function getEsbuild() {
  if (!esbuildLoaded) {
    // 用 eval 阻止 turbopack/webpack 静态分析这个 import（esbuild 是纯 Node 工具）
    esbuildLoaded = await eval('import("esbuild")')
  }
  return esbuildLoaded
}

function themeDir(themeSlug: string) {
  return path.join(themesRoot, themeSlug)
}

function entryPath(themeSlug: string, pageKey: ThemePageKey) {
  return path.join(themeDir(themeSlug), 'pages', `${pageKey}.tsx`)
}

function buildDir(themeSlug: string) {
  return path.join(themeDir(themeSlug), '.build')
}

function buildArtifactPath(themeSlug: string, pageKey: ThemePageKey) {
  return path.join(buildDir(themeSlug), `${pageKey}.cjs`)
}

/** esbuild 沙箱插件：拒绝非白名单 import */
function themeSandboxPlugin(themeSlug: string) {
  const importerDir = themeDir(themeSlug)

  return {
    name: 'seanblog-theme-sandbox',
    setup(build: any) {
      // 拒绝 node:* 与危险内置
      build.onResolve({ filter: FORBIDDEN_PATTERN }, (args: any) => {
        return {
          errors: [
            {
              text: `主题 "${themeSlug}" 试图 import 受限模块 "${args.path}"。Node 内置模块不允许在主题中使用。`,
            },
          ],
        }
      })

      // 白名单 external（运行时从宿主解析 react/next）
      build.onResolve({ filter: EXTERNAL_PATTERN }, (args: any) => ({
        path: args.path,
        external: true,
      }))

      // 拒绝 @/* 别名（最严白名单下主题不得用平台内部模块）
      build.onResolve({ filter: /^@\// }, (args: any) => {
        return {
          errors: [
            {
              text: `主题 "${themeSlug}" 试图 import "${args.path}"。@/ 别名不允许，请改用 data.components 注入的组件。`,
            },
          ],
        }
      })

      // 拒绝任何其它 bare 模块说明符（第三方 npm 包）
      // 注意：@/ 已被上面的规则命中，这里 filter 排除 ./ ../ 与 @/
      build.onResolve({ filter: /^[a-z][a-z0-9._-]*$/i, namespace: 'file' }, (args: any) => {
        return {
          errors: [
            {
              text: `主题 "${themeSlug}" 试图 import "${args.path}"。仅允许 import react / next；第三方包不允许。`,
            },
          ],
        }
      })

      // 包内相对 import 限制在主题目录内（防路径逃逸）
      build.onResolve({ filter: /^\.\.?\// }, (args: any) => {
        const resolved = path.resolve(path.dirname(args.importer), args.path)
        const normalized = path.relative(importerDir, resolved)
        if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
          return {
            errors: [
              {
                text: `主题 "${themeSlug}" 的 import "${args.path}" 逃出了主题目录。`,
              },
            ],
          }
        }
        return null
      })
    },
  }
}

export async function bundleThemePage(themeSlug: string, pageKey: ThemePageKey): Promise<string> {
  const esbuild = await getEsbuild()
  if (!esbuild) throw new Error('esbuild unavailable')
  const entry = entryPath(themeSlug, pageKey)

  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'es2020',
    jsx: 'automatic',
    outfile: buildArtifactPath(themeSlug, pageKey),
    logLevel: 'silent',
    sourcemap: false,
    write: true,
    plugins: [themeSandboxPlugin(themeSlug)],
    // 把 TS 的 path alias 关掉（主题包内不应依赖 tsconfig 的 @/）
    tsconfig: undefined,
    absWorkingDir: themeDir(themeSlug),
  })

  if (result.errors.length) {
    const msg = result.errors.map((e: any) => e.text).join('; ')
    throw badRequest(`主题 "${themeSlug}" 的页面 ${pageKey} 编译失败：${msg}`, 'THEME_BUILD_FAILED')
  }

  return buildArtifactPath(themeSlug, pageKey)
}

/** 编译主题所有页面，返回失败页面列表（用于安装时 fail-fast） */
export async function bundleTheme(themeSlug: string): Promise<void> {
  const errors: string[] = []
  for (const pageKey of THEME_PAGE_KEYS) {
    try {
      const { stat } = await import('node:fs/promises')
      const entry = entryPath(themeSlug, pageKey)
      // 跳过主题未提供的页面（fallback 到默认主题）
      const exists = await stat(entry).then((s) => s.isFile()).catch(() => false)
      if (!exists) continue
      await bundleThemePage(themeSlug, pageKey)
    } catch (error) {
      // ApiError 直接抛，安装时阻断
      if (error instanceof Error && error.name === 'ApiError') throw error
      errors.push(`${pageKey}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  if (errors.length) {
    throw badRequest(`主题 "${themeSlug}" 编译失败：${errors.join(' | ')}`, 'THEME_BUILD_FAILED')
  }
}

/** 清除主题编译产物（主题删除/更新时调用） */
export async function clearThemeBuild(themeSlug: string) {
  const { rm } = await import('node:fs/promises')
  await rm(buildDir(themeSlug), { recursive: true, force: true }).catch(() => undefined)
}
