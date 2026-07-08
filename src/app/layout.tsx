import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: {
    default: 'SeanBlog Frame',
    template: '%s | SeanBlog Frame',
  },
  description: 'Personal blog CMS built with Next.js, PostgreSQL, and Prisma.',
}

type RootLayoutProps = {
  children: ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
