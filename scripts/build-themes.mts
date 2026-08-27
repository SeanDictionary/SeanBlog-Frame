// 预编译所有已安装主题的 pages/*.tsx → themes/{slug}/.build/{pageKey}.cjs
// 用于 Docker 构建阶段 / 生产部署前预热内置主题，避免首请求懒编译延迟。
import { bundleTheme } from '../src/lib/theme/bundler'

async function main() {
  const { readdir } = await import('node:fs/promises')
  const { join } = await import('node:path')
  const root = join(process.cwd(), 'themes')
  let entries = []
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch (e) {
    console.error('[themes:build] 无法读取 themes 目录:', e)
    process.exit(1)
  }
  const slugs = entries
    .filter((e) => e.isDirectory() && /^[a-z0-9][a-z0-9_-]{0,63}$/.test(e.name))
    .map((e) => e.name)

  let failed = 0
  for (const slug of slugs) {
    try {
      await bundleTheme(slug)
      console.log(`[themes:build] ✓ ${slug}`)
    } catch (e) {
      failed += 1
      console.error(`[themes:build] ✗ ${slug}:`, e?.message ?? e)
    }
  }
  if (failed) {
    console.error(`[themes:build] ${failed} 个主题编译失败`)
    process.exit(1)
  }
  console.log(`[themes:build] 完成，共 ${slugs.length} 个主题`)
}

main()
