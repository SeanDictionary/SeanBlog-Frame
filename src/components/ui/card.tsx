import type { ReactNode } from 'react'

type CardPadding = 'sm' | 'md' | 'lg'
type CardRounded = 'lg' | 'xl' | '2xl'

const PADDING: Record<CardPadding, string> = {
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
}

const ROUNDED: Record<CardRounded, string> = {
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
}

type CardProps = {
  children: ReactNode
  padding?: CardPadding
  rounded?: CardRounded
  shadow?: boolean
  className?: string
}

export function Card({ children, padding = 'md', rounded = 'lg', shadow = false, className = '' }: CardProps) {
  return (
    <section
      className={`${ROUNDED[rounded]} border border-neutral-200 bg-white ${PADDING[padding]} ${shadow ? 'shadow-sm' : ''} dark:border-neutral-800 dark:bg-neutral-950 ${className}`}
    >
      {children}
    </section>
  )
}

type CardHeaderProps = {
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function CardHeader({ title, description, action, className = '' }: CardHeaderProps) {
  return (
    <div className={`mb-4 flex flex-wrap items-center justify-between gap-3 ${className}`}>
      <div>
        <h2 className="font-semibold">{title}</h2>
        {description && <p className="mt-1 text-sm text-neutral-500">{description}</p>}
      </div>
      {action}
    </div>
  )
}
