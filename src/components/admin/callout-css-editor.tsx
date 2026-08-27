'use client'

import Editor from 'react-simple-code-editor'
import Prism from 'prismjs'
import 'prismjs/components/prism-css'
import 'prismjs/themes/prism.min.css'
import { useEffect, useState } from 'react'

type CalloutCssEditorProps = {
  /** Initial CSS value (user's custom or theme preset or default). */
  initialValue: string
  /** Called when user clicks save. */
  onSave: (css: string) => void
  /** Called when user clicks reset. */
  onReset: () => void
  /** The preset CSS to restore on reset (theme-specific, not the global default). */
  presetValue: string
}

export function CalloutCssEditor({ initialValue, onSave, onReset, presetValue }: CalloutCssEditorProps) {
  const [code, setCode] = useState(initialValue)
  const [validation, setValidation] = useState<{ valid: boolean; error?: string; checking?: boolean } | null>(null)

  useEffect(() => {
    if (code === initialValue) {
      setValidation(null)
      return
    }
    setValidation({ valid: true, checking: true })
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/admin/validate-css', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ css: code }),
        })
        const data = await res.json()
        setValidation({ valid: data.valid, error: data.error })
      } catch {
        setValidation({ valid: false, error: '校验请求失败' })
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [code, initialValue])

  const changed = code !== initialValue
  const checking = validation?.checking === true
  const canSave = changed && validation?.valid === true && !checking

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold">Callout CSS</h3>
          <p className="mt-1 text-sm text-neutral-500">当前主题的提示框样式。</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => canSave && onSave(code)}
            disabled={!canSave}
            className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-950"
          >
            {checking ? '检查语法...' : '保存CSS样式'}
          </button>
          <button
            type="button"
            onClick={() => { setCode(presetValue); onReset() }}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            重置为预设
          </button>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        <div className={`overflow-hidden rounded-md border ${validation?.valid === false ? 'border-red-400' : 'border-neutral-300 dark:border-neutral-700'}`}>
          <Editor
            value={code}
            onValueChange={setCode}
            highlight={(css) => Prism.highlight(css, Prism.languages.css, 'css')}
            padding={12}
            textareaClassName="font-mono text-xs outline-none"
            style={{
              fontFamily: 'var(--font-mono, ui-monospace, monospace)',
              fontSize: '0.75rem',
              minHeight: '16rem',
            maxHeight: '16rem',
            overflow: 'auto',
              backgroundColor: 'transparent',
            }}
          />
        </div>
        {validation?.valid === false && validation.error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950/30 dark:text-red-400">⚠ {validation.error}</p>
        )}
      </div>
    </div>
  )
}
