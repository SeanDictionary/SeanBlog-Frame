/**
 * Handlebars 主题引擎
 *
 * - 单例 Handlebars 实例 + 白名单 helpers（绑定本平台数据/API）
 * - 模板与 partials 从 themes/{slug}/templates、partials/ 加载并按 slug 缓存
 * - 布局继承：render-service 用 default.hbs 包裹页面模板，经 {{{body}}} 注入
 *
 * seo_head / theme_css / platform_enhance 不走 helper（需 per-request ctx 且部分异步），
 * 由 render-service 预计算为字符串注入 ctx，模板用 {{{seo_head}}} 等直接输出。
 *
 * 安全：主题不能注册 helper、不能 require 模块。helpers 全部平台内置。
 */

import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

import Handlebars from 'handlebars'

const themesRoot = path.join(process.cwd(), 'themes')

const ZH_DICT: Record<string, string> = {}

/** 已编译模板缓存：slug -> name -> template fn */
const templateCache = new Map<string, Map<string, HandlebarsTemplateDelegate>>()
/** 各主题 partials 源码：slug -> name -> src（按全名注册，避免短名冲突） */
const partialSources = new Map<string, Map<string, string>>()
/** 当前已激活短名 partials 的主题链（避免重复激活） */
let activePartialsKey = ''

function getTemplateMap(slug: string) {
  let map = templateCache.get(slug)
  if (!map) {
    map = new Map()
    templateCache.set(slug, map)
  }
  return map
}

function getPartialMap(slug: string) {
  let map = partialSources.get(slug)
  if (!map) {
    map = new Map()
    partialSources.set(slug, map)
  }
  return map
}

async function loadThemeTemplates(slug: string) {
  // dev 模式每次重读磁盘（主题文件不在 Next 模块图内，无 HMR）
  if (process.env.NODE_ENV !== 'production') {
    templateCache.delete(slug)
    partialSources.delete(slug)
    activePartialsKey = ''
  }
  if (templateCache.has(slug) && partialSources.has(slug)) return
  const dir = path.join(themesRoot, slug)
  await Promise.all([
    loadDir(path.join(dir, 'templates'), slug, false).catch(() => {}),
    loadDir(path.join(dir, 'partials'), slug, true).catch(() => {}),
  ])
}

async function loadDir(dir: string, slug: string, isPartial: boolean) {
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return
  }
  for (const file of entries.filter((f) => f.endsWith('.hbs'))) {
    const src = await readFile(path.join(dir, file), 'utf8')
    const name = file.replace(/\.hbs$/, '')
    if (isPartial) {
      getPartialMap(slug).set(name, src)
    } else {
      getTemplateMap(slug).set(name, Handlebars.compile(src, { noEscape: true }))
    }
  }
}

/** 清除主题模板与 partials 缓存（主题切换/更新/删除时调用） */
export function clearTemplateCache(slug?: string) {
  if (!slug) {
    templateCache.clear()
    partialSources.clear()
    activePartialsKey = ''
    return
  }
  templateCache.delete(slug)
  partialSources.delete(slug)
  activePartialsKey = ''
}

async function readThemeManifestSafe(slug: string) {
  const { readThemeManifest } = await import('@/lib/theme')
  return readThemeManifest(slug).catch(() => null)
}

/** 激活活跃主题链的短名 partials（活跃优先，覆盖 base/default） */
async function activatePartials(slug: string) {
  const manifest = await readThemeManifestSafe(slug)
  // 注册顺序：default → base → 活跃（后注册覆盖先注册，活跃胜出）
  const chain = ['seanblog-default', manifest?.base, slug].filter(Boolean) as string[]
  const key = chain.join('|')
  if (key === activePartialsKey) return
  for (const s of chain) {
    await loadThemeTemplates(s)
    const map = partialSources.get(s)
    if (!map) continue
    for (const [name, src] of map) {
      Handlebars.registerPartial(name, src)
    }
  }
  activePartialsKey = key
}

/** 取已编译模板（fallback 链：活跃 → base → seanblog-default） */
async function getTemplate(slug: string, name: string): Promise<HandlebarsTemplateDelegate | null> {
  const manifest = await readThemeManifestSafe(slug)
  const chain = [slug, manifest?.base, 'seanblog-default'].filter(Boolean) as string[]
  for (const s of chain) {
    await loadThemeTemplates(s)
    const fn = getTemplateMap(s).get(name)
    if (fn) return fn
  }
  return null
}

// --- 白名单 helpers（纯函数，无 IO/异步） ---

Handlebars.registerHelper('json', (obj: unknown) => {
  const s = JSON.stringify(obj ?? null)
  return s ? new Handlebars.SafeString(s.replace(/"/g, '&quot;')) : ''
})

Handlebars.registerHelper('format_date', (date: unknown, opts: { hash?: { format?: string } }) => {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(String(date))
  if (Number.isNaN(d.getTime())) return ''
  const fmt = opts?.hash?.format ?? 'YYYY-MM-DD'
  const pad = (n: number) => String(n).padStart(2, '0')
  return fmt
    .replace('YYYY', String(d.getFullYear()))
    .replace('MM', pad(d.getMonth() + 1))
    .replace('DD', pad(d.getDate()))
    .replace('HH', pad(d.getHours()))
    .replace('mm', pad(d.getMinutes()))
})

Handlebars.registerHelper('excerpt', (text: unknown, opts: { hash?: { length?: number } }) => {
  const len = opts?.hash?.length ?? 200
  const s = typeof text === 'string' ? text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : ''
  return s.length > len ? s.slice(0, len) + '…' : s
})

Handlebars.registerHelper('t', (key: string) => ZH_DICT[key] ?? key)

Handlebars.registerHelper('asset', function (this: any, p: string) {
  return this.__assetBase ? `${this.__assetBase}${encodeURIComponent(p)}` : p
})

Handlebars.registerHelper('eq', function (this: any, a: unknown, b: unknown, options: any) {
  const res = a === b
  return options && options.fn ? (res ? options.fn(this) : options.inverse(this)) : res
})
Handlebars.registerHelper('ne', function (this: any, a: unknown, b: unknown, options: any) {
  const res = a !== b
  return options && options.fn ? (res ? options.fn(this) : options.inverse(this)) : res
})
Handlebars.registerHelper('gt', function (this: any, a: unknown, b: unknown, options: any) {
  const res = Number(a) > Number(b)
  return options && options.fn ? (res ? options.fn(this) : options.inverse(this)) : res
})
Handlebars.registerHelper('or', function (this: any, a: unknown, b: unknown, options: any) {
  const res = a || b
  return options && options.fn ? (res ? options.fn(this) : options.inverse(this)) : res
})
Handlebars.registerHelper('not', function (this: any, a: unknown, options: any) {
  const res = !a
  return options && options.fn ? (res ? options.fn(this) : options.inverse(this)) : res
})

export const HandlebarsInstance = Handlebars

// --- 渲染入口 ---

export type RenderOptions = {
  slug: string
  template: string
  layout?: string
  data: Record<string, unknown>
}

export async function renderTemplate(opts: RenderOptions): Promise<string> {
  await activatePartials(opts.slug)
  const fn = await getTemplate(opts.slug, opts.template)
  const version = (await readThemeManifestSafe(opts.slug))?.version ?? '0'
  const ctx = {
    ...opts.data,
    __assetBase: `/api/themes/${opts.slug}/asset?v=${encodeURIComponent(version)}&path=`,
  }

  if (!fn) return renderBuiltinFallback(opts)

  const bodyHtml = fn(ctx, { allowProtoPropertiesByDefault: true, allowProtoMethodsByDefault: true })

  if (!opts.layout) return bodyHtml
  const layoutFn = await getTemplate(opts.slug, opts.layout)
  if (!layoutFn) return bodyHtml
  return layoutFn({ ...ctx, body: bodyHtml }, { allowProtoPropertiesByDefault: true, allowProtoMethodsByDefault: true })
}

function renderBuiltinFallback(opts: RenderOptions): string {
  const title = String((opts.data as any).site?.title ?? 'SeanBlog')
  const content = String((opts.data as any).content ?? '')
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body><main style="max-width:48rem;margin:2rem auto;font-family:sans-serif">${content}<p style="color:#888">主题模板缺失，使用内置兜底。</p></main></body></html>`
}
