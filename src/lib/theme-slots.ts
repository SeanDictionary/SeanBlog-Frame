export function orderThemeSlots(defaultSlots: string[], themeSlots?: string[] | null) {
  if (!themeSlots?.length) return defaultSlots

  const known = new Set(defaultSlots)
  const ordered = themeSlots.filter((slot) => known.has(slot))

  return ordered.length ? ordered : defaultSlots
}
