export function orderThemeSlots(defaultSlots: string[], themeSlots?: string[] | null) {
  if (!themeSlots?.length) return defaultSlots

  const known = new Set(defaultSlots)
  const ordered = themeSlots.filter((slot) => known.has(slot))
  const missing = defaultSlots.filter((slot) => !ordered.includes(slot))

  return [...ordered, ...missing]
}
