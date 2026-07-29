import { readFile, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

const themesRoot = path.join(process.cwd(), 'themes')

export async function listThemes() {
  try {
    const entries = await readdir(themesRoot, { withFileTypes: true })
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  } catch {
    return []
  }
}

export async function readThemeCss(themeName: string) {
  const safeName = themeName.replace(/[^a-z0-9_-]/gi, '_')
  const filePath = path.join(themesRoot, safeName, 'theme.css')

  try {
    return await readFile(filePath, 'utf8')
  } catch {
    return null
  }
}

export async function writeThemeCss(themeName: string, css: string) {
  const safeName = themeName.replace(/[^a-z0-9_-]/gi, '_')
  const dir = path.join(themesRoot, safeName)

  const { mkdir } = await import('node:fs/promises')
  await mkdir(dir, { recursive: true })

  const filePath = path.join(dir, 'theme.css')
  await writeFile(filePath, css, 'utf8')

  return safeName
}

export async function deleteTheme(themeName: string) {
  const safeName = themeName.replace(/[^a-z0-9_-]/gi, '_')
  const dir = path.join(themesRoot, safeName)

  await rm(dir, { recursive: true, force: true })
}
