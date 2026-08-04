import { handleApiError, json } from '@/lib/api/response'
import { requireAdmin } from '@/lib/auth.utils'
import { isValidSlug, slugify } from '@/lib/content/slug'
import { createSlugFromTitle } from '@/lib/content/pinyin-slug'
import { getPrisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const title = searchParams.get('title') ?? ''
    const rawSlug = searchParams.get('slug') ?? ''
    const excludeId = searchParams.get('excludeId')?.trim() || undefined
    const slug = rawSlug.trim() ? slugify(rawSlug) : createSlugFromTitle(title)

    if (!slug || !isValidSlug(slug)) {
      return json({ slug, available: false, message: 'Slug 只能包含小写字母、数字和短横线。' })
    }

    const existing = await getPrisma().article.findFirst({
      where: {
        slug,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    })

    return json({
      slug,
      available: existing === null,
      message: existing ? '该 Slug 已被其他文章使用。' : null,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
