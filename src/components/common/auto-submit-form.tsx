'use client'

import type { FormEvent, ReactNode } from 'react'

type AutoSubmitFormProps = {
  action: string
  method?: 'get' | 'post'
  className?: string
  children: ReactNode
}

// GET form that submits itself as soon as a visitor changes a select or date
// field, so the "应用/切换" button can be dropped from the analytics filters.
// Free-text inputs are skipped (they apply on Enter) to avoid navigating on
// every keystroke.
export function AutoSubmitForm({ action, method = 'get', className, children }: AutoSubmitFormProps) {
  function handleChange(event: FormEvent<HTMLFormElement>) {
    const target = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    if (target instanceof HTMLInputElement && (target.type === 'text' || target.type === 'search')) {
      return
    }

    event.currentTarget.requestSubmit()
  }

  return (
    <form action={action} method={method} onChange={handleChange} className={className}>
      {children}
    </form>
  )
}
