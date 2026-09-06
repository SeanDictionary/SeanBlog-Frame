import Link from 'next/link'

// 后台 404：未匹配的 /admin/** 路径或 notFound() 调用在此渲染。
// 走 admin layout，给出「返回后台首页」入口，避免英文裸 404。
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center py-16">
      <div className="max-w-md text-center">
        <p className="font-mono text-sm text-neutral-400">404 · NOT_FOUND</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">页面不存在</h1>
        <p className="mt-4 leading-7 text-neutral-500">你访问的页面不存在，或已被移除。</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/admin"
            className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-950 dark:hover:bg-neutral-200"
          >
            返回后台首页
          </Link>
        </div>
      </div>
    </div>
  )
}
