const SEARCH_TERM_SPLITTER = /[+\s]+/u

export function parseSearchTerms(query: string) {
  return query
    .trim()
    .split(SEARCH_TERM_SPLITTER)
    .map((term) => term.trim().toLocaleLowerCase())
    .filter(Boolean)
}

export function textIncludesAllSearchTerms(text: string, terms: string[]) {
  if (terms.length === 0) {
    return false
  }

  const normalizedText = text.toLocaleLowerCase()
  return terms.every((term) => normalizedText.includes(term))
}
