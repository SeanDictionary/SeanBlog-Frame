export const COMMENT_MODERATION_RULES_SETTING_KEY = 'commentModerationRules'

export type CommentModerationRules = {
  autoApprove: boolean
  blacklist: string[]
}

export type CommentModerationDecision = {
  status: 'PENDING' | 'APPROVED' | 'SPAM'
  isSpam: boolean
}

type ParsedBlacklistRule =
  | { type: 'keyword'; value: string }
  | { type: 'regex'; value: RegExp }
  | { type: 'invalid-regex'; value: string; message: string }

export const DEFAULT_COMMENT_MODERATION_RULES: CommentModerationRules = {
  autoApprove: false,
  blacklist: [],
}

function splitBlacklistRules(value: string) {
  const rules: string[] = []
  let buffer = ''
  let inRegex = false
  let escaped = false
  let hasStartedRule = false

  function flush() {
    const rule = buffer.trim()
    if (rule) rules.push(rule)
    buffer = ''
    inRegex = false
    escaped = false
    hasStartedRule = false
  }

  for (const char of value) {
    if (escaped) {
      buffer += char
      escaped = false
      continue
    }

    if (char === '\\') {
      buffer += char
      escaped = true
      continue
    }

    if (char === '/' && !hasStartedRule) {
      buffer += char
      inRegex = true
      hasStartedRule = true
      continue
    }

    if (char === '/' && inRegex) {
      buffer += char
      inRegex = false
      continue
    }

    if (!inRegex && (char === '\n' || char === '\r' || char === ',' || char === '，')) {
      flush()
      continue
    }

    buffer += char
    if (!/\s/.test(char)) hasStartedRule = true
  }

  flush()
  return rules
}

function findRegexBodyEnd(value: string) {
  let escaped = false

  for (let index = 1; index < value.length; index += 1) {
    const char = value[index]

    if (escaped) {
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      continue
    }

    if (char === '/') return index
  }

  return -1
}

function parseBlacklistRule(value: string): ParsedBlacklistRule {
  if (!value.startsWith('/')) {
    return { type: 'keyword', value: value.toLocaleLowerCase() }
  }

  const bodyEnd = findRegexBodyEnd(value)

  if (bodyEnd <= 0) {
    return { type: 'invalid-regex', value, message: '正则规则需要使用 /pattern/flags 格式。' }
  }

  const pattern = value.slice(1, bodyEnd)
  const flags = value.slice(bodyEnd + 1)

  if (!/^[dgimsuvy]*$/.test(flags)) {
    return { type: 'invalid-regex', value, message: '正则 flags 仅支持 d/g/i/m/s/u/v/y。' }
  }

  try {
    return { type: 'regex', value: new RegExp(pattern, flags) }
  } catch (error) {
    return { type: 'invalid-regex', value, message: error instanceof Error ? error.message : '正则表达式无效。' }
  }
}

export function parseCommentBlacklistText(value: string) {
  return splitBlacklistRules(value)
}

export function validateCommentBlacklistRules(rules: string[]) {
  return rules
    .map(parseBlacklistRule)
    .filter((rule): rule is Extract<ParsedBlacklistRule, { type: 'invalid-regex' }> => rule.type === 'invalid-regex')
}

export function normalizeCommentModerationRules(value: unknown): CommentModerationRules {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return DEFAULT_COMMENT_MODERATION_RULES
  }

  const raw = value as { autoApprove?: unknown; blacklist?: unknown }
  const blacklist = Array.isArray(raw.blacklist)
    ? raw.blacklist.map((item) => String(item).trim()).filter(Boolean)
    : []

  return {
    autoApprove: raw.autoApprove === true,
    blacklist: [...new Set(blacklist)],
  }
}

export function getCommentModerationDecision(input: { content: string; guestName?: string | null; guestEmail?: string | null; guestLink?: string | null }, rules: CommentModerationRules): CommentModerationDecision {
  const rawText = [input.content, input.guestName, input.guestEmail, input.guestLink]
    .filter(Boolean)
    .join('\n')
  const normalizedText = rawText.toLocaleLowerCase()
  const hasBlacklistedTerm = rules.blacklist.some((term) => {
    const rule = parseBlacklistRule(term)

    if (rule.type === 'keyword') return normalizedText.includes(rule.value)
    if (rule.type === 'regex') return rule.value.test(rawText)
    return false
  })

  if (hasBlacklistedTerm) {
    return { status: 'SPAM', isSpam: true }
  }

  if (rules.autoApprove) {
    return { status: 'APPROVED', isSpam: false }
  }

  return { status: 'PENDING', isSpam: false }
}
