import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { ThemesManager } from '@/components/admin/themes-manager'
import { listSettings } from '@/lib/services/setting-service'
import { listThemes, readThemeManifest } from '@/lib/theme'

function normalizeActiveTheme(value: unknown) {
  return typeof value === 'string' && value !== 'default' ? value : 'seanblog-default'
}

async function readCalloutPreset(themeSlug: string): Promise<string | null> {
  try {
    const manifest = await readThemeManifest(themeSlug)
    const cssPath = path.join(process.cwd(), 'themes', manifest.slug, 'assets', 'callout.css')
    return await readFile(cssPath, 'utf8')
  } catch {
    return null
  }
}

export default async function AdminPersonalizationPage() {
  const [settings, themes] = await Promise.all([listSettings(), listThemes()])
  const activeTheme = normalizeActiveTheme(settings.find((s) => s.key === 'activeTheme')?.value)
  const calloutPreset = await readCalloutPreset(activeTheme)

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-8">
        <p className="mb-2 text-sm text-neutral-500">系统管理</p>
        <h1 className="text-3xl font-semibold tracking-tight">主题</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-500">集中管理主题包、自定义样式和页脚设置。主题包定义前台布局和配色，Callout CSS 随主题切换。</p>
      </header>
      <ThemesManager
        initialSettings={settings}
        availableThemes={themes}
        calloutPreset={calloutPreset ?? ''}
        activeThemeSlug={activeTheme}
      />
    </div>
  )
}
