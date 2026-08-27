'use client'

import { useState, useEffect } from 'react'

export function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const current = document.documentElement.getAttribute('data-theme')
    if (current === 'light' || current === 'dark') {
      setTheme(current)
    } else if (!current) {
      // auto 模式：跟随系统
      setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    }
  }, [])

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    document.cookie = `sb-theme=${next};path=/;max-age=31536000;SameSite=Lax`
  }

  if (!mounted) {
    return <span className="inline-block h-5 w-5" />
  }

  return (
    <button
      onClick={toggle}
      aria-label={theme === 'dark' ? '切换到浅色' : '切换到深色'}
      className="flex h-8 w-8 items-center justify-center rounded-[var(--radius)] text-text-secondary transition-colors hover:text-text"
    >
      {theme === 'dark' ? (
        <i className="fa-solid fa-sun text-sm" />
      ) : (
        <i className="fa-solid fa-moon text-sm" />
      )}
    </button>
  )
}
