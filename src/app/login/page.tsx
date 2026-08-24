import Link from 'next/link'

import { authenticate } from '@/app/login/actions'

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams

  return (
    <main className="grid min-h-screen place-items-center bg-neutral-50 px-5 py-10 dark:bg-neutral-950">
      <section className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-7 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <Link href="/" className="text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:hover:text-neutral-100">
          <i className="fa-solid fa-arrow-left mr-2 text-xs" aria-hidden="true" />
          返回网站
        </Link>

        <div className="mt-8">
          <p className="text-sm text-neutral-500">管理后台</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">登录 SeanBlog</h1>
        </div>

        <form action={authenticate} className="mt-7 space-y-5">
          <label className="grid gap-1.5 text-sm text-neutral-700 dark:text-neutral-300">
            用户名
            <input name="username" defaultValue="admin" required autoComplete="username" className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-neutral-950 outline-none transition-colors focus:border-blue-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50 dark:focus:border-blue-400" />
          </label>
          <label className="grid gap-1.5 text-sm text-neutral-700 dark:text-neutral-300">
            密码
            <input name="password" type="password" required autoComplete="current-password" className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-neutral-950 outline-none transition-colors focus:border-blue-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50 dark:focus:border-blue-400" />
          </label>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {error === 'ServiceUnavailable'
                ? '服务暂时不可用，请稍后重试。'
                : '用户名或密码不正确。'}
            </p>
          )}

          <button type="submit" className="w-full rounded-md bg-neutral-950 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 dark:bg-neutral-100 dark:text-neutral-950">
            登录
          </button>
        </form>
      </section>
    </main>
  )
}
