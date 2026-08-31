/**
 * 主题渲染服务：把 ctx 交给 Handlebars 引擎渲染整页 HTML。
 *
 * - 注入预计算的 seo_head / theme_css / platform_enhance 字符串到 ctx
 *   （模板用 {{{seo_head}}} 等三花括号直接输出）
 * - fallback 链由引擎处理
 * - 不做整页缓存（模板编译缓存已在引擎内；service 数据有各自缓存），
 *   避免主题切换时旧缓存残留
 */

import { buildThemeCssBundle } from '@/lib/theme/css-bundle'
import { getMergedSettings } from '@/lib/services/theme-settings-service'
import { normalizeThemeName } from '@/lib/theme'
import { renderTemplate } from '@/lib/theme/handlebars-engine'

export type PageKey = 'home' | 'post' | 'taxonomy' | 'categories' | 'tags' | 'search'

export type RenderInput = {
  pageKey: PageKey
  ctx: Record<string, unknown>
}

const PAGE_TEMPLATE_MAP: Record<PageKey, string> = {
  home: 'index',
  post: 'post',
  taxonomy: 'taxonomy',
  categories: 'categories',
  tags: 'tags',
  search: 'search',
}

type SeoCtx = {
  title: string
  description?: string
  canonical?: string
  robots?: string
  og?: Record<string, string>
  jsonld?: unknown
}

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
}

function buildSeoHead(seo: SeoCtx | undefined): string {
  if (!seo) return ''
  const lines: string[] = []
  lines.push(`<title>${esc(seo.title)}</title>`)
  if (seo.description) lines.push(`<meta name="description" content="${esc(seo.description)}">`)
  if (seo.robots) lines.push(`<meta name="robots" content="${esc(seo.robots)}">`)
  if (seo.canonical) lines.push(`<link rel="canonical" href="${esc(seo.canonical)}">`)
  if (seo.og) for (const [k, v] of Object.entries(seo.og)) lines.push(`<meta property="${esc(k)}" content="${esc(v)}">`)
  if (seo.jsonld) lines.push(`<script type="application/ld+json">${JSON.stringify(seo.jsonld)}</script>`)
  lines.push(`<link rel="alternate" type="application/rss+xml" title="${esc(seo.title)}" href="/rss.xml">`)
  lines.push(`<link rel="sitemap" type="application/xml" href="/sitemap.xml">`)
  return lines.join('\n')
}

const FONT_AWESOME = `<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/7.0.0/css/all.min.css" integrity="sha512-DxV+EoADOkOygM4IR9yXP8Sb2qwgidEmeqAEmDKIOfPRQZOWbXCzLC6vjbZyy0vPisbH2SyW27+ddLVCN+OMzQ==" crossorigin="anonymous" referrerPolicy="no-referrer">`

async function enrichCtx(ctx: Record<string, unknown>, slug: string): Promise<Record<string, unknown>> {
  const cssBundle = await buildThemeCssBundle()
  return {
    ...ctx,
    theme: { ...(ctx as any).theme, slug },
    seo_head: buildSeoHead((ctx as any).seo),
    theme_css: cssBundle?.css ? `<style>${cssBundle.css}</style>` : '',
    callout_css: cssBundle?.calloutCss ? `<style>${cssBundle.calloutCss}</style>` : '',
    font_awesome: FONT_AWESOME,
    platform_enhance: `<script src="/enhance.js" defer></script><script src="/analytics.js" defer></script>`,
  }
}

/** 渲染整页 */
export async function renderThemePage(input: RenderInput): Promise<string> {
  const settings = await getMergedSettings()
  const slug = normalizeThemeName(settings.activeTheme)
  const enriched = await enrichCtx(input.ctx, slug)
  return renderTemplate({
    slug,
    template: PAGE_TEMPLATE_MAP[input.pageKey],
    layout: 'default',
    data: enriched,
  })
}
