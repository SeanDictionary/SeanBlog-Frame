/**
 * 主题设置条件表达式求值器
 *
 * 用于 settingsSchema item 的 `if` 字段（FormKit/Halo 风格）。
 * 手写 tokenizer + 递归下降解析器，**不使用 eval / Function**，只支持受限语法：
 *
 * 语法：
 *   expr   := or
 *   or     := and ( '||' and )*
 *   and    := not ( '&&' not )*
 *   not    := '!' not | cmp
 *   cmp    := primary ( ('===' | '==' | '!==' | '!=') primary )?
 *   primary:= '(' expr ')' | string | number | 'true' | 'false' | 'null' | identifier
 *
 * 标识符（identifier）解析为 values map 中的同名设置 key。
 * 缺失的标识符视为 undefined。
 *
 * 求值结果为布尔。语法错误时抛 SettingConditionError。
 */

import type { ThemeSettingSchemaItem, SettingsSchema } from '@/lib/theme'

export class SettingConditionError extends Error {
  constructor(message: string, public expression: string, public position: number) {
    super(`主题设置条件表达式解析失败：${message}（"${expression}" @${position}）`)
    this.name = 'SettingConditionError'
  }
}

type Token =
  | { kind: 'string'; value: string; pos: number }
  | { kind: 'number'; value: number; pos: number }
  | { kind: 'ident'; value: string; pos: number }
  | { kind: 'op'; value: string; pos: number }
  | { kind: 'eof'; pos: number }

const OPERATORS = new Set(['===', '!==', '==', '!=', '&&', '||', '!', '(', ')'])

function tokenLabel(t: Token): string {
  return t.kind === 'eof' ? '<end>' : String(t.value)
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  const n = input.length

  while (i < n) {
    const ch = input[i]

    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++
      continue
    }

    const start = i

    // 字符串字面量（单/双引号）
    if (ch === '\'' || ch === '"') {
      const quote = ch
      i++
      let buf = ''
      while (i < n && input[i] !== quote) {
        const c = input[i]
        if (c === '\\') {
          const next = input[i + 1]
          if (next === 'n') buf += '\n'
          else if (next === 't') buf += '\t'
          else buf += next ?? ''
          i += 2
          continue
        }
        buf += c
        i++
      }
      if (i >= n) throw new SettingConditionError('字符串未闭合', input, start)
      i++ // 跳过结束引号
      tokens.push({ kind: 'string', value: buf, pos: start })
      continue
    }

    // 数字字面量
    if (ch >= '0' && ch <= '9') {
      let num = ''
      while (i < n && ((input[i] >= '0' && input[i] <= '9') || input[i] === '.')) {
        num += input[i]
        i++
      }
      tokens.push({ kind: 'number', value: Number(num), pos: start })
      continue
    }

    // 标识符 / 关键字（true/false/null）
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_' || ch === '$') {
      let ident = ''
      while (
        i < n &&
        ((input[i] >= 'a' && input[i] <= 'z') ||
          (input[i] >= 'A' && input[i] <= 'Z') ||
          (input[i] >= '0' && input[i] <= '9') ||
          input[i] === '_' ||
          input[i] === '$' ||
          input[i] === '.')
      ) {
        ident += input[i]
        i++
      }
      tokens.push({ kind: 'ident', value: ident, pos: start })
      continue
    }

    // 多字符操作符
    const three = input.slice(i, i + 3)
    const two = input.slice(i, i + 2)
    if (OPERATORS.has(three)) {
      tokens.push({ kind: 'op', value: three, pos: start })
      i += 3
      continue
    }
    if (OPERATORS.has(two)) {
      tokens.push({ kind: 'op', value: two, pos: start })
      i += 2
      continue
    }
    if (OPERATORS.has(ch)) {
      tokens.push({ kind: 'op', value: ch, pos: start })
      i++
      continue
    }

    throw new SettingConditionError(`非法字符 "${ch}"`, input, start)
  }

  tokens.push({ kind: 'eof', pos: i })
  return tokens
}

class Parser {
  private pos = 0
  constructor(private tokens: Token[], private expression: string) {}

  private peek(): Token {
    return this.tokens[this.pos]
  }

  private next(): Token {
    return this.tokens[this.pos++]
  }

  private expectOp(op: string) {
    const t = this.next()
    if (t.kind !== 'op' || t.value !== op) {
      throw new SettingConditionError(`期望 "${op}"，得到 "${tokenLabel(t)}"`, this.expression, t.pos)
    }
  }

  parse(): (values: Record<string, unknown>) => boolean {
    const fn = this.parseOr()
    const eof = this.peek()
    if (eof.kind !== 'eof') {
      throw new SettingConditionError('存在未消费的尾部字符', this.expression, eof.pos)
    }
    return fn
  }

  private parseOr(): (values: Record<string, unknown>) => boolean {
    let left = this.parseAnd()
    while (true) {
      const t = this.peek()
      if (t.kind !== 'op' || t.value !== '||') break
      this.next()
      const right = this.parseAnd()
      const l = left
      const r = right
      left = (v) => l(v) || r(v)
    }
    return left
  }

  private parseAnd(): (values: Record<string, unknown>) => boolean {
    let left = this.parseNot()
    while (true) {
      const t = this.peek()
      if (t.kind !== 'op' || t.value !== '&&') break
      this.next()
      const right = this.parseNot()
      const l = left
      const r = right
      left = (v) => l(v) && r(v)
    }
    return left
  }

  private parseNot(): (values: Record<string, unknown>) => boolean {
    const t = this.peek()
    if (t.kind === 'op' && t.value === '!') {
      this.next()
      const operand = this.parseNot()
      return (v) => !operand(v)
    }
    return this.parseCmp()
  }

  private parseCmp(): (values: Record<string, unknown>) => boolean {
    const left = this.parsePrimary()
    const t = this.peek()
    // 成员运算： needle in haystack / needle not in haystack
    if (t.kind === 'ident' && (t.value === 'in' || t.value === 'not')) {
      let negate = false
      if (t.value === 'not') {
        const next = this.tokens[this.pos + 1]
        if (!next || next.kind !== 'ident' || next.value !== 'in') {
          throw new SettingConditionError('期望 "in"（组成 "not in"）', this.expression, t.pos)
        }
        negate = true
        this.next() // not
        this.next() // in
      } else {
        this.next() // in
      }
      const right = this.parsePrimary()
      const l = left
      const r = right
      const neg = negate
      return (v) => {
        const needle = l(v)
        const haystack = r(v)
        const res = memberIn(needle, haystack)
        return neg ? !res : res
      }
    }
    if (t.kind === 'op' && (t.value === '===' || t.value === '==' || t.value === '!==' || t.value === '!=')) {
      this.next()
      const right = this.parsePrimary()
      const op = t.value
      const l = left
      const r = right
      return (v) => {
        const lv = l(v)
        const rv = r(v)
        switch (op) {
          case '===':
            return strictEq(lv, rv)
          case '!==':
            return !strictEq(lv, rv)
          case '==':
            return looseEq(lv, rv)
          case '!=':
            return !looseEq(lv, rv)
          default:
            return false
        }
      }
    }
    return (v) => truthy(left(v))
  }

  private parsePrimary(): (values: Record<string, unknown>) => unknown {
    const t = this.next()
    if (t.kind === 'op' && t.value === '(') {
      const inner = this.parseOr()
      this.expectOp(')')
      return inner
    }
    if (t.kind === 'string') {
      const s = t.value
      return () => s
    }
    if (t.kind === 'number') {
      const num = t.value
      return () => num
    }
    if (t.kind === 'ident') {
      const name = t.value
      if (name === 'true') return () => true
      if (name === 'false') return () => false
      if (name === 'null') return () => null
      return (v) => resolveIdent(v, name)
    }
    throw new SettingConditionError(`意外的符号 "${tokenLabel(t)}"`, this.expression, t.pos)
  }
}

/** 解析标识符：支持点号取值（如 obj.key），主题设置场景下顶层 key 即设置项 key。 */
function resolveIdent(values: Record<string, unknown>, name: string): unknown {
  if (Object.prototype.hasOwnProperty.call(values, name)) {
    return values[name]
  }
  // 点号访问：a.b → values.a?.b
  if (name.includes('.')) {
    const parts = name.split('.')
    let cur: unknown = values[parts[0]]
    for (let i = 1; i < parts.length; i++) {
      if (cur && typeof cur === 'object' && !Array.isArray(cur)) {
        cur = (cur as Record<string, unknown>)[parts[i]]
      } else {
        return undefined
      }
    }
    return cur
  }
  return undefined
}

function strictEq(a: unknown, b: unknown): boolean {
  if (typeof a === typeof b) return a === b
  // 数字与字符串数字比较：宽松处理 "1" === 1
  if (typeof a === 'number' && typeof b === 'string') return String(a) === b
  if (typeof b === 'number' && typeof a === 'string') return a === String(b)
  return false
}

function looseEq(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a == null || b == null) return a == null && b == null
  // 字符串与布尔：把 'true'/'false' 与 boolean 视作相等
  if (typeof a === 'boolean' && typeof b === 'string') return String(a) === b
  if (typeof b === 'boolean' && typeof a === 'string') return a === String(b)
  if (typeof a === 'number' && typeof b === 'string') return a === Number(b)
  if (typeof b === 'number' && typeof a === 'string') return b === Number(a)
  return false
}

/** 成员判断： needle in haystack。支持数组包含、字符串子串。 */
function memberIn(needle: unknown, haystack: unknown): boolean {
  if (Array.isArray(haystack)) {
    return haystack.some((v) => looseEq(v, needle))
  }
  if (typeof haystack === 'string') {
    return typeof needle === 'string' && haystack.includes(needle)
  }
  return false
}

function truthy(v: unknown): boolean {
  if (typeof v === 'boolean') return v
  if (v == null) return false
  if (typeof v === 'number') return v !== 0
  if (typeof v === 'string') return v.length > 0
  if (Array.isArray(v)) return v.length > 0
  return true
}

const compiledCache = new Map<string, (values: Record<string, unknown>) => boolean>()

function compile(expression: string): (values: Record<string, unknown>) => boolean {
  const cached = compiledCache.get(expression)
  if (cached) return cached
  const tokens = tokenize(expression)
  const fn = new Parser(tokens, expression).parse()
  compiledCache.set(expression, fn)
  return fn
}

/** 对表达式求值，返回布尔结果。语法错误抛 SettingConditionError。 */
export function evaluateCondition(expression: string, values: Record<string, unknown>): boolean {
  return compile(expression)(values)
}

const KEYWORDS = new Set(['true', 'false', 'null', 'in', 'not', 'and', 'or'])

/**
 * 提取表达式引用的设置 key（仅保留 schema 中存在的项）。
 * 用于级联隐藏：子项引用的父项若被隐藏，子项自动隐藏。
 * 语法错误时返回空集。
 */
export function extractReferencedKeys(expression: string, knownKeys: Set<string>): Set<string> {
  const result = new Set<string>()
  let tokens: Token[]
  try {
    tokens = tokenize(expression)
  } catch {
    return result
  }
  for (const t of tokens) {
    if (t.kind !== 'ident') continue
    if (KEYWORDS.has(t.value)) continue
    const root = t.value.split('.')[0]
    if (knownKeys.has(root)) result.add(root)
  }
  return result
}

/**
 * 计算整张 schema 的可见性映射（含级联隐藏）。
 * - 无 `if` 的项恒可见。
 * - 有 `if` 的项：仅当自身条件求值为真 **且** 其引用的全部父级设置项均可见时才可见。
 * - 父项被隐藏 → 子项自动隐藏，无需重复根条件。
 * - 循环依赖：检测到环时按可见处理并告警，避免无限递归。
 */
export function computeVisibility(
  schema: SettingsSchema,
  values: Record<string, unknown>,
): Record<string, boolean> {
  const itemsByKey = new Map<string, ThemeSettingSchemaItem>()
  for (const items of Object.values(schema)) {
    for (const item of items) itemsByKey.set(item.key, item)
  }
  const knownKeys = new Set(itemsByKey.keys())
  const refsByKey = new Map<string, Set<string>>()
  for (const [key, item] of itemsByKey) {
    refsByKey.set(key, item.if ? extractReferencedKeys(item.if, knownKeys) : new Set<string>())
  }

  const cache: Record<string, boolean> = {}
  const stack = new Set<string>()

  function isVisible(key: string): boolean {
    if (key in cache) return cache[key]
    if (stack.has(key)) {
      // 循环依赖：按可见处理以打断递归
      if (typeof console !== 'undefined') {
        console.warn(`[theme] 设置项 "${key}" 存在循环依赖，按可见处理`)
      }
      return true
    }
    const item = itemsByKey.get(key)
    if (!item) return true // 非 schema key：视作可见
    stack.add(key)
    let result = true
    if (item.if) {
      try {
        result = evaluateCondition(item.if, values)
      } catch (error) {
        if (typeof console !== 'undefined') {
          console.warn(`[theme] 设置项 "${key}" 的条件表达式无效：${error instanceof Error ? error.message : error}`)
        }
        result = true
      }
    }
    if (result) {
      for (const dep of refsByKey.get(key) ?? []) {
        if (!isVisible(dep)) {
          result = false
          break
        }
      }
    }
    stack.delete(key)
    cache[key] = result
    return result
  }

  for (const key of itemsByKey.keys()) isVisible(key)
  return cache
}

/**
 * 判断某个设置项是否应在后台表单中显示（单项判定，不含级联隐藏）。
 * - 无 `if` 字段 → 恒显示。
 * - 有 `if` 字段 → 求值；语法错误时仍显示（并警告），避免锁死设置。
 * 注意：此函数不处理级联隐藏。需要级联隐藏请使用 computeVisibility。
 */
export function isItemVisible(item: ThemeSettingSchemaItem, values: Record<string, unknown>): boolean {
  if (!item.if) return true
  try {
    return evaluateCondition(item.if, values)
  } catch (error) {
    if (typeof console !== 'undefined') {
      console.warn(`[theme] 设置项 "${item.key}" 的条件表达式无效：${error instanceof Error ? error.message : error}`)
    }
    return true
  }
}
