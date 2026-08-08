'use client'

import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react'

type AdminToastLevel = 'info' | 'success' | 'error'

type AdminToast = {
  id: number
  text: string
  level: AdminToastLevel
  visible: boolean
  exiting: boolean
}

type AdminToastContextValue = {
  info: (text: string) => void
  success: (text: string) => void
  error: (text: string) => void
  notify: (text: string, level?: AdminToastLevel) => void
}

const AdminToastContext = createContext<AdminToastContextValue | null>(null)
const TOAST_AUTO_DISMISS_MS = 10000
const TOAST_EXIT_ANIMATION_MS = 300

const toastStyles = {
  info: {
    icon: 'fa-solid fa-circle-info',
    className: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950 dark:text-blue-300',
    closeClassName: 'text-blue-500 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-100',
  },
  success: {
    icon: 'fa-solid fa-circle-check',
    className: 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/60 dark:bg-green-950 dark:text-green-300',
    closeClassName: 'text-green-500 hover:text-green-800 dark:text-green-300 dark:hover:text-green-100',
  },
  error: {
    icon: 'fa-solid fa-triangle-exclamation',
    className: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950 dark:text-red-300',
    closeClassName: 'text-red-500 hover:text-red-800 dark:text-red-300 dark:hover:text-red-100',
  },
} satisfies Record<AdminToastLevel, { icon: string; className: string; closeClassName: string }>

export function AdminToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<AdminToast[]>([])
  const toastIdRef = useRef(0)
  const lastToastRef = useRef<{ text: string; level: AdminToastLevel; timestamp: number } | null>(null)
  const toastRefs = useRef(new Map<number, HTMLDivElement>())
  const previousPositionsRef = useRef(new Map<number, number>())

  const dismissToast = useCallback((id: number) => {
    setToasts((previous) => previous.map((toast) => (toast.id === id ? { ...toast, exiting: true, visible: false } : toast)))
    window.setTimeout(() => {
      setToasts((previous) => previous.filter((toast) => toast.id !== id))
    }, TOAST_EXIT_ANIMATION_MS)
  }, [])

  const notify = useCallback((text: string, level: AdminToastLevel = 'info') => {
    const trimmedText = text.trim()
    if (!trimmedText) return

    const now = Date.now()
    const lastToast = lastToastRef.current
    if (lastToast && lastToast.text === trimmedText && lastToast.level === level && now - lastToast.timestamp < 500) {
      return
    }
    lastToastRef.current = { text: trimmedText, level, timestamp: now }

    const id = toastIdRef.current + 1
    toastIdRef.current = id
    setToasts((previous) => [...previous, { id, text: trimmedText, level, visible: false, exiting: false }])
    window.setTimeout(() => {
      setToasts((previous) => previous.map((toast) => (toast.id === id ? { ...toast, visible: true } : toast)))
    }, 20)
    window.setTimeout(() => dismissToast(id), TOAST_AUTO_DISMISS_MS)
  }, [dismissToast])

  const value = useMemo<AdminToastContextValue>(() => ({
    notify,
    info: (text: string) => notify(text, 'info'),
    success: (text: string) => notify(text, 'success'),
    error: (text: string) => notify(text, 'error'),
  }), [notify])

  useLayoutEffect(() => {
    const nextPositions = new Map<number, number>()

    for (const [id, node] of toastRefs.current.entries()) {
      const top = node.getBoundingClientRect().top
      const previousTop = previousPositionsRef.current.get(id)

      if (previousTop !== undefined) {
        const delta = previousTop - top

        if (Math.abs(delta) > 1 && !node.dataset.exiting) {
          node.style.transition = 'none'
          node.style.transform = `translateY(${delta}px)`
          window.requestAnimationFrame(() => {
            node.style.transition = ''
            node.style.transform = ''
          })
        }
      }

      nextPositions.set(id, top)
    }

    previousPositionsRef.current = nextPositions
  }, [toasts])

  return (
    <AdminToastContext.Provider value={value}>
      {children}
      {toasts.length > 0 && (
        <div className="fixed right-4 top-4 z-50 grid w-[min(calc(100vw-2rem),24rem)] gap-3" aria-live="polite" aria-atomic="false">
          {toasts.map((toast) => {
            const style = toastStyles[toast.level]

            return (
              <div
                key={toast.id}
                ref={(node) => {
                  if (node) toastRefs.current.set(toast.id, node)
                  else toastRefs.current.delete(toast.id)
                }}
                data-exiting={toast.exiting ? 'true' : undefined}
                className={`rounded-xl border p-4 text-sm shadow-lg transition-all duration-300 ease-out ${style.className} ${
                  toast.visible && !toast.exiting ? 'translate-x-0 scale-100 opacity-100' : 'translate-x-6 scale-95 opacity-0'
                }`}
                role="status"
              >
                <div className="flex items-start gap-3">
                  <i className={`${style.icon} mt-0.5 text-xs`} aria-hidden="true" />
                  <p className="min-w-0 flex-1 break-words">{toast.text}</p>
                  <button type="button" onClick={() => dismissToast(toast.id)} className={`transition-colors ${style.closeClassName}`} aria-label="关闭提示">
                    <i className="fa-solid fa-xmark" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </AdminToastContext.Provider>
  )
}

export function useAdminToast() {
  const context = useContext(AdminToastContext)

  if (!context) {
    throw new Error('useAdminToast must be used within AdminToastProvider.')
  }

  return context
}

export type { AdminToastLevel }
