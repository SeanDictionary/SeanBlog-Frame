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

export async function markdownToHtml(markdown: string) {
  const result = await processor.process(markdown)

  return String(result)
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
