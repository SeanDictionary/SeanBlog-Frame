import postcss from 'postcss'

import { badRequest } from '@/lib/api/errors'

export const DEFAULT_THEME_NAME = 'seanblog-default'
export const THEME_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/
export const MAX_THEME_CSS_BYTES = 100 * 1024

const allowedVariables = new Set([
  '--color-bg',
  '--color-bg-secondary',
  '--color-bg-tertiary',
  '--color-text',
  '--color-text-secondary',
  '--color-text-tertiary',
  '--color-border',
  '--color-border-hover',
  '--color-accent',
  '--color-accent-hover',
  '--color-accent-subtle',
  '--color-accent-text',
  '--color-success',
  '--color-warning',
  '--color-error',
  '--font-sans',
  '--font-mono',
  '--radius-sm',
  '--radius',
  '--radius-lg',
  '--radius-xl',
  '--header-height',
  '--content-max-width',
  '--content-padding',
])

export function assertThemeName(value: unknown) {
  if (typeof value !== 'string' || !THEME_NAME_PATTERN.test(value)) {
    throw badRequest('Theme names must use lowercase letters, numbers, hyphens, and underscores.', 'INVALID_THEME_NAME')
  }

  return value
}

const unsafeCssPattern = /<\/?style|[<>]|@import|!important/i

const componentSelectorPattern = /^(\.sb-[a-z0-9-]+|\.sf-[a-z0-9-]+|\.article-content)([\s>]+[a-z0-9_.:#\-[\]=\"'()]+)*$/i

function assertDeclarations(rule: postcss.Rule) {
  if (rule.selector !== ':root' && !componentSelectorPattern.test(rule.selector)) {
    throw badRequest('Theme CSS may only define :root variables or safe .sb-/.sf- component selectors.', 'INVALID_THEME_CSS')
  }

  rule.each((node) => {
    if (
      node.type !== 'decl'
      || (rule.selector === ':root' && !allowedVariables.has(node.prop))
      || !node.value
      || node.important
      || unsafeCssPattern.test(node.value)
    ) {
      throw badRequest('Theme CSS contains an unsupported variable declaration.', 'INVALID_THEME_CSS')
    }
  })
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
    if (node.type === 'rule') {
      assertDeclarations(node)
      declarationCount += node.nodes?.length ?? 0
      return
    }

    if (node.type === 'atrule' && node.name === 'media' && node.params.trim() === '(prefers-color-scheme: dark)') {
      node.each((child) => {
        if (child.type !== 'rule') {
          throw badRequest('Theme CSS media queries may only contain :root variables.', 'INVALID_THEME_CSS')
        }

        assertDeclarations(child)
        declarationCount += child.nodes?.length ?? 0
      })
      return
    }

    throw badRequest('Theme CSS only supports :root and the dark-mode media query.', 'INVALID_THEME_CSS')
  })

  if (declarationCount === 0) {
    throw badRequest('Theme CSS must override at least one supported variable.', 'INVALID_THEME_CSS')
  }

  return css
}
