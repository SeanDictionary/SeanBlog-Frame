import { getSiteSettingsMap } from '@/lib/services/setting-service'
import { readThemeCss, readThemeManifest } from '@/lib/theme'

async function buildThemeOptionsCss(themeSlug: string, settings: Record<string, unknown>) {
  const manifest = await readThemeManifest(themeSlug).catch(() => null)
  if (!manifest?.settingsSchema?.length) return null

  const variables = manifest.settingsSchema
    .map((item) => {
      if (!item.cssVariable) return null
      const value = settings[`themeSetting:${manifest.slug}:${item.key}`] ?? item.default
      if (typeof value !== 'string' && typeof value !== 'number') return null
      return `${item.cssVariable}:${value}`
    })
    .filter((item): item is string => item !== null)

  return variables.length ? `:root{${variables.join(';')}}` : null
}

export default async function ThemePreviewPage({ searchParams }: { searchParams: Promise<{ theme?: string }> }) {
  const [{ theme = 'seanblog-default' }, settings] = await Promise.all([searchParams, getSiteSettingsMap()])
  const manifest = await readThemeManifest(theme).catch(() => null)
  const themeCss = await readThemeCss(theme)
  const optionsCss = await buildThemeOptionsCss(theme, settings)
  const title = manifest?.name ?? theme

  return (
    <div className="min-h-screen bg-bg p-8 text-text">
      {themeCss && <style>{themeCss}</style>}
      {optionsCss && <style>{optionsCss}</style>}
      <main className="mx-auto max-w-(--content-max-width) space-y-8">
        <header className="sb-site-header rounded-xl border border-border bg-bg-secondary p-6">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-text-tertiary">Theme package preview</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-3 text-text-secondary">{manifest?.description ?? '这是一组用于预览主题包模板、部件和组件样式的样例内容。'}</p>
        </header>
        <section className="grid gap-4 md:grid-cols-3">
          {['文章卡片', '分类入口', '统计面板'].map((cardTitle) => <article key={cardTitle} className="sb-card rounded-lg border border-border bg-bg-secondary p-5"><h2 className="font-semibold">{cardTitle}</h2><p className="mt-2 text-sm text-text-secondary">主题包通过模板、部件、settingsSchema 和安全组件命名空间控制这个区域。</p></article>)}
        </section>
        <section className="article-content rounded-lg border border-border bg-bg-secondary p-6">
          <h2>Markdown 内容样式</h2>
          <p>正文、链接、引用、代码块会跟随当前主题包。</p>
          <pre className="language-ts" data-language="ts"><code><span className="token-keyword">const</span> theme = <span className="token-string">'{theme}'</span></code></pre>
        </section>
      </main>
    </div>
  )
}
