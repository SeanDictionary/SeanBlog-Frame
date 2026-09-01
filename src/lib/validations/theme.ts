import postcss from 'postcss'

import { badRequest } from '@/lib/api/errors'

export const DEFAULT_THEME_NAME = 'seanblog-default'
export const THEME_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/
export const MAX_THEME_CSS_BYTES = 100 * 1024

const unsafeCssPattern = /<\/?style|[<>]|@import|!important|expression\(|javascript:|behavior:/i

function assertDeclarations(rule: postcss.Rule) {
  rule.each((node) => {
    // 跳过注释节点（允许规则内注释）
    if (node.type === 'comment') return
    if (node.type !== 'decl' || !node.value || node.important || unsafeCssPattern.test(node.value)) {
      throw badRequest('Theme CSS contains an unsupported declaration.', 'INVALID_THEME_CSS')
    }
  })
}

export function assertThemeName(value: unknown) {
  if (typeof value !== 'string' || !THEME_NAME_PATTERN.test(value)) {
    throw badRequest('Theme names must use lowercase letters, numbers, hyphens, and underscores.', 'INVALID_THEME_NAME')
  }

  return value
}

export function validateThemeCss(css: string) {
  if (!css.trim()) {
    throw badRequest('Theme CSS cannot be empty.', 'INVALID_THEME_CSS')
  }

  if (Buffer.byteLength(css, 'utf8') > MAX_THEME_CSS_BYTES) {
    throw badRequest('Theme CSS must not exceed 100 KB.', 'THEME_CSS_TOO_LARGE')
  }

  let root: postcss.Root

  try {
    root = postcss.parse(css)
  } catch {
    throw badRequest('Theme CSS could not be parsed.', 'INVALID_THEME_CSS')
  }

  let declarationCount = 0

  root.each((node) => {
    // 跳过顶层注释节点
    if (node.type === 'comment') return

    if (node.type === 'rule') {
      assertDeclarations(node)
      declarationCount += node.nodes?.length ?? 0
      return
    }

    if (node.type === 'atrule') {
      if (node.name === 'media') {
        node.each((child) => {
          if (child.type === 'comment') return
          if (child.type !== 'rule') {
            throw badRequest('Theme CSS media queries may only contain rule blocks.', 'INVALID_THEME_CSS')
          }
          assertDeclarations(child)
          declarationCount += child.nodes?.length ?? 0
        })
        return
      }
      throw badRequest('Theme CSS only supports @media queries.', 'INVALID_THEME_CSS')
    }

    throw badRequest('Theme CSS only supports rules and @media queries.', 'INVALID_THEME_CSS')
  })

  if (declarationCount === 0) {
    throw badRequest('Theme CSS must contain at least one declaration.', 'INVALID_THEME_CSS')
  }

  return css
}
