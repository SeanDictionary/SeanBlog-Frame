import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'

type HtmlNode = {
  type?: string
  tagName?: string
  value?: string
  properties?: Record<string, unknown>
  children?: HtmlNode[]
}

type TokenNode = HtmlNode & { value?: string }

type TokenMatch = {
  index: number
  text: string
  className: string
}

const javascriptKeywords = new Set([
  'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'default', 'else', 'export', 'extends', 'false', 'finally', 'for', 'from', 'function', 'if', 'import', 'in', 'interface', 'let', 'new', 'null', 'return', 'throw', 'true', 'try', 'type', 'undefined', 'var', 'while',
])

function getClassNames(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string')
  }

  if (typeof value === 'string') {
    return value.split(/\s+/).filter(Boolean)
  }

  return []
}

function getCodeLanguage(node: HtmlNode) {
  const code = node.children?.find((child) => child.type === 'element' && child.tagName === 'code')
  const languageClass = getClassNames(code?.properties?.className).find((className) => className.startsWith('language-'))

  return languageClass?.replace(/^language-/, '')
}

function textNode(value: string): TokenNode {
  return { type: 'text', value }
}

function spanNode(className: string, value: string): TokenNode {
  return {
    type: 'element',
    tagName: 'span',
    properties: { className: [className] },
    children: [textNode(value)],
  }
}

function classifyJavascriptToken(value: string) {
  if (value.startsWith('//') || value.startsWith('/*')) return 'token-comment'
  if (value.startsWith('"') || value.startsWith("'") || value.startsWith('`')) return 'token-string'
  if (/^\d/.test(value)) return 'token-number'
  if (javascriptKeywords.has(value)) return 'token-keyword'
  return 'token-function'
}

function getTokenPattern(language: string) {
  if (/^(js|jsx|ts|tsx|javascript|typescript)$/.test(language)) {
    return /\/\/[^\n]*|\/\*[\s\S]*?\*\/|`(?:\\.|[^`\\])*`|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|\b(?:async|await|break|case|catch|class|const|continue|default|else|export|extends|false|finally|for|from|function|if|import|in|interface|let|new|null|return|throw|true|try|type|undefined|var|while)\b|\b[A-Za-z_$][\w$]*(?=\s*\()|\b\d+(?:\.\d+)?\b/g
  }

  if (/^(json|jsonc)$/.test(language)) {
    return /"(?:\\.|[^"\\])*"(?=\s*:)|"(?:\\.|[^"\\])*"|\b(?:true|false|null)\b|-?\b\d+(?:\.\d+)?\b/g
  }

  if (/^(html|xml|svg)$/.test(language)) {
    return /<!--[\s\S]*?-->|<\/?[A-Za-z][^>]*>|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g
  }

  if (/^(css|scss)$/.test(language)) {
    return /\/\*[\s\S]*?\*\/|#[\da-fA-F]{3,8}\b|\b[-a-zA-Z]+(?=\s*:)|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw)?\b/g
  }

  return null
}

function classifyToken(language: string, value: string) {
  if (/^(js|jsx|ts|tsx|javascript|typescript)$/.test(language)) {
    return classifyJavascriptToken(value)
  }

  if (/^(json|jsonc)$/.test(language)) {
    if (value.startsWith('"') && /"$/.test(value) && /"(?=\s*:)/.test(value)) return 'token-property'
    if (value.startsWith('"')) return 'token-string'
    if (/^-?\d/.test(value)) return 'token-number'
    return 'token-keyword'
  }

  if (/^(html|xml|svg)$/.test(language)) {
    if (value.startsWith('<!--')) return 'token-comment'
    if (value.startsWith('"') || value.startsWith("'")) return 'token-string'
    return 'token-tag'
  }

  if (/^(css|scss)$/.test(language)) {
    if (value.startsWith('/*')) return 'token-comment'
    if (value.startsWith('"') || value.startsWith("'")) return 'token-string'
    if (value.startsWith('#') || /^\d/.test(value)) return 'token-number'
    return 'token-property'
  }

  return 'token-keyword'
}

function highlightCode(value: string, language: string): TokenNode[] {
  const pattern = getTokenPattern(language)
  if (!pattern) return [textNode(value)]

  const matches: TokenMatch[] = []
  let match: RegExpExecArray | null

  while ((match = pattern.exec(value)) !== null) {
    matches.push({ index: match.index, text: match[0], className: classifyToken(language, match[0]) })
  }

  if (!matches.length) return [textNode(value)]

  const nodes: TokenNode[] = []
  let cursor = 0

  for (const token of matches) {
    if (token.index > cursor) {
      nodes.push(textNode(value.slice(cursor, token.index)))
    }

    nodes.push(spanNode(token.className, token.text))
    cursor = token.index + token.text.length
  }

  if (cursor < value.length) {
    nodes.push(textNode(value.slice(cursor)))
  }

  return nodes
}

function enhanceCodeBlock(node: HtmlNode) {
  const code = node.children?.find((child) => child.type === 'element' && child.tagName === 'code')
  const language = getCodeLanguage(node)

  if (!code || !language) return

  node.properties = {
    ...node.properties,
    className: [...new Set([...getClassNames(node.properties?.className), `language-${language}`])],
    dataLanguage: language,
  }

  const codeText = code.children?.map((child) => child.value ?? '').join('') ?? ''
  code.children = highlightCode(codeText, language)
}

function rehypeCodeBlockEnhancements() {
  return (tree: HtmlNode) => {
    function visit(node: HtmlNode) {
      if (node.type === 'element' && node.tagName === 'pre') {
        enhanceCodeBlock(node)
      }

      node.children?.forEach(visit)
    }

    visit(tree)
  }
}

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeCodeBlockEnhancements)
  .use(rehypeSanitize, {
    ...defaultSchema,
    attributes: {
      ...defaultSchema.attributes,
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
        ['className', /^token-/],
      ],
    },
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
