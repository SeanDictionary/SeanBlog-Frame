import { AdminSidebar } from '@/components/layout/admin-sidebar'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-neutral-50 text-neutral-950 dark:bg-neutral-900 dark:text-neutral-50">
      <AdminSidebar />
      <main className="min-w-0 flex-1 p-8 lg:p-12">{children}</main>
    </div>
  )
}
