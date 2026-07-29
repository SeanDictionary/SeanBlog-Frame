import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="mx-auto max-w-(--content-max-width) px-(--content-padding) py-24 text-center">
      <p className="font-mono text-sm text-text-tertiary">404</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">没有找到这个页面</h1>
      <p className="mt-4 text-text-secondary">链接可能已失效，或页面已经移动。</p>
      <Link href="/" className="mt-8 inline-flex rounded-sm bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover">返回首页</Link>
    </div>
  )
}
