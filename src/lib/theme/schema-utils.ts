/**
 * 主题设置 schema 的纯工具函数（客户端安全，无 node 依赖）。
 *
 * `theme.ts` 含 node:fs 等服务端依赖，不能被客户端组件直接 value-import。
 * 本模块只 import 类型，因此可安全用于客户端 bundle。
 */

import type { SettingsSchema, ThemeSettingSchemaItem } from '@/lib/theme'

/** 将 schema（1 层或 2 层混合）扁平为所有设置项数组。 */
export function flattenSchemaItems(schema: SettingsSchema | undefined): ThemeSettingSchemaItem[] {
  if (!schema) return []
  const out: ThemeSettingSchemaItem[] = []
  for (const group of Object.values(schema)) {
    if (Array.isArray(group)) {
      out.push(...group)
    } else if (group && typeof group === 'object') {
      for (const items of Object.values(group)) out.push(...items)
    }
  }
  return out
}
