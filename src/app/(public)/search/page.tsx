import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '搜索',
}

export default async function SearchPage() {
  return (
    <div className="mx-auto max-w-[var(--content-max-width)] px-[var(--content-padding)] py-12">
      <h1 className="text-2xl font-bold">搜索</h1>
    </div>
  )
}
