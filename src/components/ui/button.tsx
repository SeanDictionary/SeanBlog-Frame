import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'dark' | 'outline' | 'danger'
type ButtonSize = 'sm' | 'md'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white transition-colors hover:bg-accent-hover',
  secondary: 'border border-border bg-bg transition-colors hover:bg-bg-secondary',
  dark: 'bg-neutral-950 text-white transition-colors hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-950 dark:hover:bg-neutral-200',
  outline: 'border border-neutral-300 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900',
  danger: 'bg-red-600 text-white transition-colors hover:bg-red-700',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
}

type BaseProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  children: ReactNode
  className?: string
}

type ButtonAsButton = BaseProps & {
  as?: 'button'
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>

type ButtonAsLink = BaseProps & {
  as: 'link'
  href: string
}

export function Button({ variant = 'outline', size = 'md', children, className = '', ...rest }: ButtonAsButton | ButtonAsLink) {
  const classes = `inline-flex items-center justify-center gap-2 rounded-md font-medium ${VARIANTS[variant]} ${SIZES[size]} ${className}`

  if ('as' in rest && rest.as === 'link') {
    const { as, href, ...linkProps } = rest
    return (
      <a href={href} className={classes} {...linkProps}>
        {children}
      </a>
    )
  }

  const { as: _as, ...buttonProps } = rest as ButtonAsButton
  return (
    <button className={classes} {...buttonProps}>
      {children}
    </button>
  )
}
