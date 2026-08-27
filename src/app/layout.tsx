import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { cookies } from 'next/headers'
import type { ReactNode } from 'react'

import { getActiveThemeSettings } from '@/lib/services/theme-settings-service'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: {
    default: 'SeanBlog',
    template: '%s | SeanBlog',
  },
  description: 'Personal blog powered by SeanBlog Frame.',
  openGraph: {
    type: 'website',
    siteName: 'SeanBlog',
    title: 'SeanBlog',
    description: 'Personal blog powered by SeanBlog Frame.',
  },
}

type RootLayoutProps = {
  children: ReactNode
}

/**
 * 解析初始色彩模式（dark/light），SSR 写入 <html data-theme>，消除 FOUC。
 *
 * 优先级：
 * 1. sb-theme cookie（用户手动切换的偏好）→ 直接使用
 * 2. 主题 colorMode 设置（dark/light/auto）→ dark 直接用；light 直接用；
 *    auto 在 SSR 默认 dark，由下方内联脚本在首屏前按系统偏好修正
 *
 * 数据库不可用时降级到 dark。
 */
async function resolveColorMode(): Promise<{ attr: 'dark' | 'light'; mode: string }> {
  const cookieStore = await cookies()
  const sbTheme = cookieStore.get('sb-theme')?.value
  if (sbTheme === 'light' || sbTheme === 'dark') {
    return { attr: sbTheme, mode: sbTheme }
  }

  try {
    const { settings } = await getActiveThemeSettings()
    const mode = typeof settings.colorMode === 'string' ? settings.colorMode : 'dark'
    if (mode === 'light') return { attr: 'light', mode }
    if (mode === 'auto') return { attr: 'dark', mode: 'auto' }
    return { attr: 'dark', mode: 'dark' }
  } catch {
    return { attr: 'dark', mode: 'dark' }
  }
}

export default async function RootLayout({ children }: RootLayoutProps) {
  const { attr, mode } = await resolveColorMode()

  // 首屏前同步脚本：处理 auto 模式下跟随系统，且无 cookie 时才介入（避免覆盖用户偏好）
  const colorBootstrap = mode === 'auto'
    ? `<script>(function(){if(document.cookie.indexOf('sb-theme=')>=0)return;try{var m=window.matchMedia('(prefers-color-scheme: dark)');document.documentElement.setAttribute('data-theme',m.matches?'dark':'light');}catch(e){}})();</script>`
    : ''

  return (
    <html lang="zh-CN" data-theme={attr} suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/7.0.0/css/all.min.css"
          integrity="sha512-DxV+EoADOkOygM4IR9yXP8Sb2qwgidEmeqAEmDKIOfPRQZOWbXCzLC6vjbZyy0vPisbH2SyW27+ddLVCN+OMzQ=="
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
        {mode === 'auto' && <script dangerouslySetInnerHTML={{ __html: colorBootstrap }} />}
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  )
}
