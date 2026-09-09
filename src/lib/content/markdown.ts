import rehypeShiki from '@shikijs/rehype'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import remarkDirective from 'remark-directive'
import remarkGithubAdmonitions, { DEFAULT_MAPPING, GithubAlertType } from 'remark-github-admonitions-to-directives'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import type { ShikiTransformer } from '@shikijs/types'
import { visit } from 'unist-util-visit'
import { getGithubRepo, languageColor } from '@/lib/content/github'
import { unified } from 'unified'

function getClassNames(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string')
  }

  if (typeof value === 'string') {
    return value.split(/\s+/).filter(Boolean)
  }

  return []
}

// --- Code block language label ---
// Shiki highlights tokens with inline styles, but does not surface the
// language name. This transformer adds `language-<lang>` class + `data-language`
// attribute to <pre> so themes can render a language label via CSS
// `::before { content: attr(data-language) }`.

const PLAIN_LANGUAGES = new Set(['text', 'plaintext', 'ansi', ''])

const languageLabelTransformer: ShikiTransformer = {
  name: 'sb-language-label',
  pre(node) {
    const lang = this.options.lang
    if (!lang || PLAIN_LANGUAGES.has(lang)) return
    this.addClassToHast(node, `language-${lang}`)
    node.properties = node.properties ?? {}
    node.properties.dataLanguage = lang
  },
}

// --- Admonition / Callout directive plugin ---

// 提示框类型词汇表统一对齐 GitHub 的 5 种（note/tip/important/warning/caution）。
// GitHub `[!IMPORTANT]`/`[!CAUTION]` 经插件映射后也输出 important/caution（见下 mapping），
// 与指令 `:::important`/`:::caution` 同名同样式。info/success/danger 不再作为类型。
const CALLOUT_TYPES = new Set(['note', 'tip', 'important', 'warning', 'caution'])

/**
 * remark plugin: converts directive nodes (:::callout, :::note, etc.) into
 * <div class="callout callout--{type}"> for the rehype phase.
 * Handles both `:::callout{type=warning}` and `:::note` (bare directive name).
 */
function remarkCalloutDirectives() {
  return (tree: any) => {
    visit(tree, (node: any) => {
      if (
        node.type !== 'containerDirective' &&
        node.type !== 'leafDirective' &&
        node.type !== 'textDirective'
      ) return

      const name = node.name as string
      let calloutType: string | null = null

      // :::callout{type=warning} or :::callout{.warning}
      if (name === 'callout') {
        const attrs = node.attributes || {}
        calloutType = (attrs.type as string) || getClassFromAttrs(attrs) || 'note'
      }
      // :::note / :::warning / etc. (directive name IS the type)
      else if (CALLOUT_TYPES.has(name)) {
        calloutType = name
      }

      if (!calloutType) return

      const data = node.data || (node.data = {})
      const isInline = node.type === 'textDirective'
      data.hName = isInline ? 'span' : 'div'
      data.hProperties = {
        className: ['callout', `callout--${calloutType}`],
      }
    })
  }
}

function getClassFromAttrs(attrs: Record<string, unknown>): string | null {
  const cls = getClassNames(attrs.className)
  return cls.find((c) => CALLOUT_TYPES.has(c)) ?? cls[0] ?? null
}

// --- github-repo / friend-link 卡片 directive ---
// 作者写法：
//   :::github-repo{author="solstice23" project="argon-theme" size="full"}
//   :::friend-link{name="站点名" url="https://..." avatar="https://..." desc="..."}
// github-repo 服务端拉取 GitHub API（缓存 1h，失败降级）；friend-link 纯静态。
// 产出 raw HTML 字符串（设为 mdast html 节点），经 rehype-raw 解析、rehype-sanitize 净化。

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function cardAttr(attrs: Record<string, unknown>, key: string): string {
  const v = attrs[key]
  return typeof v === 'string' ? v.trim() : ''
}

function friendLinkCard(attrs: Record<string, unknown>): string {
  const name = cardAttr(attrs, 'name')
  const url = cardAttr(attrs, 'url')
  const avatar = cardAttr(attrs, 'avatar')
  const desc = cardAttr(attrs, 'desc')
  if (!name || !url) {
    return `<figure class="friend-link-card fl-card--error"><span class="fl-card__error">friend-link: 缺少 name / url</span></figure>`
  }
  const avatarHtml = avatar
    ? `<img class="fl-card__avatar-img" src="${escapeHtml(avatar)}" alt="${escapeHtml(name)}" loading="lazy">`
    : `<span class="fl-card__avatar-fallback">${escapeHtml(name.charAt(0).toUpperCase())}</span>`
  return `<figure class="friend-link-card"><a class="fl-card__link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${avatarHtml}<span class="fl-card__main"><span class="fl-card__name">${escapeHtml(name)}</span>${desc ? `<span class="fl-card__desc">${escapeHtml(desc)}</span>` : ''}</span></a></figure>`
}

async function githubRepoCard(attrs: Record<string, unknown>): Promise<string> {
  let owner = cardAttr(attrs, 'author')
  let repo = cardAttr(attrs, 'project')
  const shorthand = cardAttr(attrs, 'repo')
  if ((!owner || !repo) && shorthand) {
    const m = shorthand.match(/^([^/]+)\/(.+)$/)
    if (m) { owner = m[1]; repo = m[2] }
  }
  const size = cardAttr(attrs, 'size') === 'mini' ? 'mini' : 'full'
  if (!owner || !repo) {
    return `<figure class="github-repo-card gh-card--error"><span class="gh-card__error">github-repo: 缺少 author / project</span></figure>`
  }
  const data = await getGithubRepo(owner, repo)
  const href = data?.htmlUrl ?? `https://github.com/${owner}/${repo}`
  const title = data?.fullName ?? `${owner}/${repo}`
  if (size === 'mini') {
    const stars = data ? `<span class="gh-card__stars"><i class="fa-solid fa-star"></i>${data.stars}</span>` : ''
    return `<figure class="github-repo-card gh-card--mini"><a class="gh-card__link" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"><i class="gh-card__icon fa-brands fa-github"></i><span class="gh-card__title">${escapeHtml(title)}</span>${stars}</a></figure>`
  }
  const desc = data?.description ? `<span class="gh-card__desc">${escapeHtml(data.description)}</span>` : ''
  const langColor = data?.language ? languageColor(data.language) : null
  const lang = data?.language ? `<span class="gh-card__lang"><i class="gh-card__lang-dot" style="background:${escapeHtml(langColor ?? '')}"></i>${escapeHtml(data.language)}</span>` : ''
  const stars = data ? `<span class="gh-card__stars"><i class="fa-solid fa-star"></i>${data.stars}</span>` : ''
  const forks = data ? `<span class="gh-card__forks"><i class="fa-solid fa-code-fork"></i>${data.forks}</span>` : ''
  const meta = (lang || stars || forks) ? `<span class="gh-card__meta">${lang}${stars}${forks}</span>` : ''
  return `<figure class="github-repo-card"><a class="gh-card__link" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"><i class="gh-card__icon fa-brands fa-github"></i><span class="gh-card__main"><span class="gh-card__title">${escapeHtml(title)}</span>${desc}${meta}</span><i class="gh-card__arrow fa-solid fa-arrow-up-right-from-square"></i></a></figure>`
}

function remarkCardDirectives() {
  return async (tree: any) => {
    const targets: any[] = []
    visit(tree, (node: any) => {
      if (node.type === 'containerDirective' && (node.name === 'github-repo' || node.name === 'friend-link')) {
        targets.push(node)
      }
    })
    await Promise.all(targets.map(async (node) => {
      const attrs = node.attributes || {}
      const html = node.name === 'github-repo' ? await githubRepoCard(attrs) : friendLinkCard(attrs)
      node.type = 'html'
      node.value = html
      delete node.children
      delete node.data
    }))
  }
}

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkGithubAdmonitions, {
    // 把 GitHub 的 IMPORTANT/CAUTION 映射到同名 directive（而非默认的 info/danger），
    // 使 `> [!IMPORTANT]` 与 `:::important` 同名同样式（对齐 GitHub 5 种词汇表）。
    mapping: {
      ...DEFAULT_MAPPING,
      [GithubAlertType.IMPORTANT]: 'important',
      [GithubAlertType.CAUTION]: 'caution',
    },
  })
  .use(remarkDirective)
  .use(remarkCalloutDirectives)
  .use(remarkCardDirectives)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeKatex)
  .use(rehypeSanitize, {
    ...defaultSchema,
    tagNames: [
      ...(defaultSchema.tagNames ?? []),
      'div', 'span', 'figure', 'figcaption', 'iframe', 'details', 'summary',
      'math', 'semantics', 'annotation', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub', 'msubsup', 'mfrac', 'msqrt', 'mroot', 'munder', 'mover', 'munderover', 'mtable', 'mtr', 'mtd', 'mtext', 'mspace', 'mphantom', 'menclose', 'mstyle', 'mpadded', 'merror', 'mglyph',
    ],
    attributes: {
      ...defaultSchema.attributes,
      '*': [
        ...(defaultSchema.attributes?.['*'] ?? []),
        'className', 'style', 'dataType',
      ],
      div: [
        ...(defaultSchema.attributes?.div ?? []),
        'className', 'style', 'dataType',
      ],
      iframe: [
        'src', 'title', 'allow', 'allowFullScreen', 'loading',
        ['className', /^.*$/],
      ],
      code: [
        ...(defaultSchema.attributes?.code ?? []),
        ['className', /^language-/],
      ],
      pre: [
        ...(defaultSchema.attributes?.pre ?? []),
        'dataLanguage',
        ['className', /^language-/],
      ],
      span: [
        ...(defaultSchema.attributes?.span ?? []),
        ['className', /^.*/],
      ],
      a: [
        'href', 'target', 'rel',
        'ariaDescribedBy', 'ariaLabel', 'ariaLabelledBy',
        ['className', /^.*$/],
      ],
      img: [
        ...(defaultSchema.attributes?.img ?? []),
        'alt', 'loading',
      ],
      math: [
        'xmlns', 'display',
        ['className', /^katex/],
      ],
      annotation: [
        'encoding',
      ],
    },
    protocols: {
      ...defaultSchema.protocols,
      // 仅允许 http/https 作为 src，阻止 data: iframe（data:text/html 可执行脚本）
      src: ['http', 'https'],
    },
  })
  .use(rehypeShiki, {
    // Dual themes: light colors render inline; dark colors ship as --shiki-dark
    // CSS variables, switched by [data-theme="dark"] in the theme stylesheet.
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultLanguage: 'text',
    // sage is not bundled by Shiki; treat it as python for lattice-crypto writeups.
    langAlias: { sage: 'python' },
    transformers: [languageLabelTransformer],
  })
  .use(rehypeStringify)

/** 将连续的 friend-link <figure> 包裹在 .friend-link-grid 容器中，实现网格布局 */
function wrapFriendLinkGrid(html: string): string {
  return html.replace(
    /((?:<figure class="friend-link-card[^"]*"[\s\S]*?<\/figure>\s*)+)/g,
    (match) => {
      const trimmed = match.trim()
      return `<div class="friend-link-grid">${trimmed}</div>`
    }
  )
}

export async function markdownToHtml(markdown: string) {
  const result = await processor.process(markdown)

  return wrapFriendLinkGrid(String(result))
}

export function createExcerpt(markdown: string, maxLength = 160) {
  const plainText = markdown
    .replace(/[#>*_`\-[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (plainText.length <= maxLength) {
    return plainText
  }

  return `${plainText.slice(0, maxLength).trimEnd()}...`
}
