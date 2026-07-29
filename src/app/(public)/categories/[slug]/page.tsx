import { notFound } from 'next/navigation'

import { getPublicCategoryBySlug } from '@/lib/services/category-service'

type CategoryPageProps = {
  params: Promise<{ slug: string }>
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params

  try {
    const category = await getPublicCategoryBySlug(slug)

    return (
      <div className="mx-auto max-w-[var(--content-max-width)] px-[var(--content-padding)] py-12">
        <h1 className="text-2xl font-bold">{category.name}</h1>
        {category.description && (
          <p className="mt-2 text-text-secondary">{category.description}</p>
        )}
      </div>
    )
  } catch {
    notFound()
  }
}
