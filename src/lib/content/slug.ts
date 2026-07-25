const slugUnsafePattern = /[^a-z0-9\s-]/g
const slugSeparatorPattern = /[\s_-]+/g
const duplicateDashPattern = /-+/g

export function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(slugUnsafePattern, '')
    .replace(slugSeparatorPattern, '-')
    .replace(duplicateDashPattern, '-')
    .replace(/^-|-$/g, '')
}

export function resolveSlug(input: { slug?: string | null; title?: string; name?: string }) {
  const rawSlug = input.slug?.trim() || input.title || input.name || ''
  const slug = slugify(rawSlug)

  if (!slug) {
    throw new Error('A valid slug is required.')
  }

  return slug
}
