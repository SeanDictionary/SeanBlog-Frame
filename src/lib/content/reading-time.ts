const CJK_CHARACTER_PATTERN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu
const WORD_PATTERN = /[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*/gu

const CJK_CHARACTERS_PER_MINUTE = 400
const WORDS_PER_MINUTE = 200

export function plainTextFromHtml(html: string) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export function countContentWords(text: string) {
  const cjkCharacters = text.match(CJK_CHARACTER_PATTERN)?.length ?? 0
  const textWithoutCjk = text.replace(CJK_CHARACTER_PATTERN, ' ')
  const words = textWithoutCjk.match(WORD_PATTERN)?.length ?? 0

  return cjkCharacters + words
}

export function countContentWordsFromHtml(html: string) {
  return countContentWords(plainTextFromHtml(html))
}

export function estimateReadingMinutes(text: string) {
  const cjkCharacters = text.match(CJK_CHARACTER_PATTERN)?.length ?? 0
  const textWithoutCjk = text.replace(CJK_CHARACTER_PATTERN, ' ')
  const words = textWithoutCjk.match(WORD_PATTERN)?.length ?? 0
  const rawMinutes = cjkCharacters / CJK_CHARACTERS_PER_MINUTE + words / WORDS_PER_MINUTE

  return Math.max(1, Math.ceil(rawMinutes))
}

export function estimateReadingMinutesFromHtml(html: string) {
  return estimateReadingMinutes(plainTextFromHtml(html))
}
