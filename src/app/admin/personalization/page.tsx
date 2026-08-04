import { PersonalizationManager } from '@/components/admin/personalization-manager'
import { listSettings } from '@/lib/services/setting-service'
import { listThemes } from '@/lib/theme'

export default async function AdminPersonalizationPage() {
  const [settings, themes] = await Promise.all([listSettings(), listThemes()])

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-8">
        <p className="mb-2 text-sm text-neutral-500">系统管理</p>
        <h1 className="text-3xl font-semibold tracking-tight">个性化</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-500">集中调整前台 Dock、页脚、后台侧边栏和主题。默认主题保持原生组件风格，自定义主题可通过安全命名空间覆盖组件样式。</p>
      </header>
      <PersonalizationManager initialSettings={settings} availableThemes={themes} />
    </div>
  )
}
