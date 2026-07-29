export default function Loading() {
  return (
    <div className="mx-auto max-w-(--content-max-width) animate-pulse px-(--content-padding) py-12 sm:py-18">
      <div className="h-3 w-24 rounded bg-bg-tertiary" />
      <div className="mt-5 h-10 w-2/3 rounded bg-bg-tertiary" />
      <div className="mt-12 space-y-6">{Array.from({ length: 4 }, (_, index) => <div key={index} className="border-t border-border pt-6"><div className="h-6 w-3/4 rounded bg-bg-tertiary" /><div className="mt-3 h-4 w-full rounded bg-bg-secondary" /><div className="mt-2 h-4 w-2/3 rounded bg-bg-secondary" /></div>)}</div>
    </div>
  )
}
