import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { conflict, notFound } from '@/lib/api/errors'
import { assertThemeName, DEFAULT_THEME_NAME, validateThemeCss } from '@/lib/validations/theme'

const themesRoot = path.join(process.cwd(), 'themes')
const themeFilename = 'theme.css'

function getThemeDirectory(themeName: string) {
  return path.join(themesRoot, assertThemeName(themeName))
}

function getThemeFilePath(themeName: string) {
  return path.join(getThemeDirectory(themeName), themeFilename)
}

export async function themeExists(themeName: string) {
  try {
    const themeFile = await stat(getThemeFilePath(themeName))
    return themeFile.isFile() && themeFile.size > 0
  } catch {
    return false
  }
}

export async function listThemes() {
  try {
    const entries = await readdir(themesRoot, { withFileTypes: true })
    const themes = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && /^[a-z0-9][a-z0-9_-]{0,63}$/.test(entry.name))
        .map(async (entry) => ((await themeExists(entry.name)) ? entry.name : null)),
    )

    return themes.filter((theme): theme is string => theme !== null).sort((left, right) => left.localeCompare(right))
  } catch {
    return []
  }
}

export async function readThemeCss(themeName: string) {
  try {
    return await readFile(getThemeFilePath(themeName), 'utf8')
  } catch {
    return null
  }
}

export async function writeThemeCss(themeName: string, css: string) {
  const name = assertThemeName(themeName)

  if (name === DEFAULT_THEME_NAME) {
    throw conflict('The default theme cannot be overwritten.')
  }

  validateThemeCss(css)

  if (await themeExists(name)) {
    throw conflict('A theme with this name already exists.')
  }

  const directory = getThemeDirectory(name)
  await mkdir(directory, { recursive: true })
  await writeFile(path.join(directory, themeFilename), css, 'utf8')

  return name
}

export async function deleteTheme(themeName: string) {
  const name = assertThemeName(themeName)

  if (name === DEFAULT_THEME_NAME) {
    throw conflict('The default theme cannot be deleted.')
  }

  if (!(await themeExists(name))) {
    throw notFound('Theme not found.')
  }

  await rm(getThemeDirectory(name), { recursive: true, force: true })
}

export async function ensureDefaultTheme() {
  return themeExists(DEFAULT_THEME_NAME)
}
