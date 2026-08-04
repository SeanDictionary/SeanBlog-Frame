import { readThemeCss } from '@/lib/theme'
import { getSiteSettingsMap } from '@/lib/services/setting-service'

function buildThemeOptionsCss(settings: Record<string, unknown>) {
  const variables: string[] = []
  if (typeof settings.themeAccentColor === 'string') variables.push(`--color-accent:${settings.themeAccentColor}`)
  if (typeof settings.themeContentMaxWidth === 'string') variables.push(`--content-max-width:${settings.themeContentMaxWidth}`)
  if (typeof settings.themeRadius === 'string') variables.push(`--radius:${settings.themeRadius};--radius-lg:${settings.themeRadius}`)
  if (typeof settings.themeHeaderHeight === 'string') variables.push(`--header-height:${settings.themeHeaderHeight}`)
  return variables.length ? `:root{${variables.join(';')}}` : null
}

export default async function ThemePreviewPage({ searchParams }: { searchParams: Promise<{ theme?: string }> }) {
  const [{ theme = 'default' }, settings] = await Promise.all([searchParams, getSiteSettingsMap()])
  const themeCss = theme !== 'default' ? await readThemeCss(theme) : null
  const optionsCss = buildThemeOptionsCss(settings)

  return (
    <div className="min-h-screen bg-bg p-8 text-text">
      {themeCss && <style>{themeCss}</style>}
      {optionsCss && <style>{optionsCss}</style>}
      <main className="mx-auto max-w-(--content-max-width) space-y-8">
        <header className="sb-site-header rounded-xl border border-border bg-bg-secondary p-6">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-text-tertiary">Theme preview</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">{theme}</h1>
          <p className="mt-3 text-text-secondary">这是一组用于预览主题变量和组件命名空间的样例内容。</p>
        </header>
        <section className="grid gap-4 md:grid-cols-3">
          {['文章卡片', '分类入口', '统计面板'].map((title) => <article key={title} className="sb-card rounded-lg border border-border bg-bg-secondary p-5"><h2 className="font-semibold">{title}</h2><p className="mt-2 text-sm text-text-secondary">主题可以通过 CSS 变量和 .sb-* 组件类覆盖这个区域。</p></article>)}
        </section>
        <section className="article-content rounded-lg border border-border bg-bg-secondary p-6">
          <h2>Markdown 内容样式</h2>
          <p>正文、链接、引用、代码块会跟随当前主题。</p>
          <pre className="language-ts" data-language="ts"><code><span className="token-keyword">const</span> theme = <span className="token-string">'{theme}'</span></code></pre>
        </section>
      </main>
    </div>
  )
}
