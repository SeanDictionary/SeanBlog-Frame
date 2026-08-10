import { redirect } from 'next/navigation'
import type { Route } from 'next'

export default async function LegacyThemePreviewPage({ searchParams }: { searchParams: Promise<{ theme?: string; page?: string; slug?: string }> }) {
  const params = await searchParams
  const query = new URLSearchParams()

  query.set('theme', params.theme ?? 'seanblog-default')
  query.set('page', params.page === 'article' ? 'article' : 'home')
  if (params.slug) query.set('slug', params.slug)

  redirect(`/theme-preview?${query.toString()}` as Route)
}
