import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '分类',
}

export default async function CategoriesPage() {
  return (
    <div className="mx-auto max-w-[var(--content-max-width)] px-[var(--content-padding)] py-12">
      <h1 className="text-2xl font-bold">分类</h1>
    </div>
  )
}
