import Link from 'next/link'

type ErrorPageProps = {
  reset: () => void
}

export default function GlobalError({ reset }: ErrorPageProps) {
  return (
    <html lang="zh-CN">
      <body className="grid min-h-screen place-items-center bg-neutral-50 px-5 text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50">
        <main className="max-w-md text-center">
          <p className="font-mono text-sm text-neutral-500">500</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">页面暂时无法加载</h1>
          <p className="mt-4 leading-7 text-neutral-600 dark:text-neutral-400">我们已经记录了这次异常。你可以重试，或返回首页继续阅读。</p>
          <div className="mt-8 flex justify-center gap-4"><button type="button" onClick={reset} className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-950">重试</button><Link href="/" className="rounded-md border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700">返回首页</Link></div>
        </main>
      </body>
    </html>
  )
}
