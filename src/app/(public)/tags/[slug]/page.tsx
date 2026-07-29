import { notFound } from 'next/navigation'

import { getPublicTagBySlug } from '@/lib/services/tag-service'

type TagPageProps = {
  params: Promise<{ slug: string }>
}

export default async function TagPage({ params }: TagPageProps) {
  const { slug } = await params

  try {
    const tag = await getPublicTagBySlug(slug)

    return (
      <div className="mx-auto max-w-[var(--content-max-width)] px-[var(--content-padding)] py-12">
        <h1 className="text-2xl font-bold">{tag.name}</h1>
      </div>
    )
  } catch {
    notFound()
  }
}
