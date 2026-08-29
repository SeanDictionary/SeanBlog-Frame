'use client'

import Prism from 'prismjs'
import 'prismjs/components/prism-css'
import 'prismjs/themes/prism.min.css'
import { useEffect, useRef, useState } from 'react'

type CalloutCssEditorProps = {
  initialValue: string
  onSave: (css: string) => void
  onReset: () => void
  presetValue: string
}

export function CalloutCssEditor({ initialValue, onSave, onReset, presetValue }: CalloutCssEditorProps) {
  const [code, setCode] = useState(initialValue)
  const [validation, setValidation] = useState<{ valid: boolean; error?: string; checking?: boolean } | null>(null)
  const preRef = useRef<HTMLPreElement>(null)

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

  function handleScroll(e: React.UIEvent<HTMLTextAreaElement>) {
    if (preRef.current) {
      preRef.current.scrollTop = e.currentTarget.scrollTop
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">Callout CSS</h2>
          <p className="mt-1 text-sm text-neutral-500">当前主题的提示框样式。</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => canSave && onSave(code)}
            disabled={!canSave}
            className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-950"
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
      <div className={`mt-4 relative overflow-hidden rounded-md border ${validation?.valid === false ? 'border-red-400' : 'border-neutral-300 dark:border-neutral-700'}`}>
        <pre
          ref={preRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 m-0 overflow-auto p-3 font-mono text-xs leading-5"
          style={{ color: 'inherit', background: 'transparent' }}
        >
          <code dangerouslySetInnerHTML={{ __html: Prism.highlight(code, Prism.languages.css, 'css') + '\n' }} />
        </pre>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onScroll={handleScroll}
          spellCheck={false}
          className="relative m-0 block w-full resize-y border-0 bg-transparent p-3 font-mono text-xs leading-5 text-transparent caret-neutral-900 dark:caret-neutral-100 outline-none"
          style={{ minHeight: '16rem', height: '16rem' }}
        />
      </div>
      {validation?.valid === false && validation.error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950/30 dark:text-red-400">⚠ {validation.error}</p>
      )}
    </div>
  )
}
