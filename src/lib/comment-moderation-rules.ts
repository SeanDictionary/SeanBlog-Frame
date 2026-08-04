export const COMMENT_MODERATION_RULES_SETTING_KEY = 'commentModerationRules'

export type CommentModerationRules = {
  autoApprove: boolean
  blacklist: string[]
}

export type CommentModerationDecision = {
  status: 'PENDING' | 'APPROVED' | 'SPAM'
  isSpam: boolean
}

export const DEFAULT_COMMENT_MODERATION_RULES: CommentModerationRules = {
  autoApprove: false,
  blacklist: [],
}

export function parseCommentBlacklistText(value: string) {
  return value
    .split(/[\n,，]+/)
    .map((item) => item.trim())
    .filter(Boolean)
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

export function getCommentModerationDecision(input: { content: string; guestName?: string | null; guestEmail?: string | null }, rules: CommentModerationRules): CommentModerationDecision {
  const haystack = [input.content, input.guestName, input.guestEmail]
    .filter(Boolean)
    .join('\n')
    .toLocaleLowerCase()
  const hasBlacklistedTerm = rules.blacklist.some((term) => haystack.includes(term.toLocaleLowerCase()))

  if (hasBlacklistedTerm) {
    return { status: 'SPAM', isSpam: true }
  }

  if (rules.autoApprove) {
    return { status: 'APPROVED', isSpam: false }
  }

  return { status: 'PENDING', isSpam: false }
}
