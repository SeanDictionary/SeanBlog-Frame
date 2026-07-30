import { redirect } from 'next/navigation'

import { AdminSidebar } from '@/components/layout/admin-sidebar'
import { getAdminSession } from '@/lib/auth.utils'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getAdminSession()

  if (!session) {
    redirect('/login?callbackUrl=/admin')
  }

  return (
    <div className="flex min-h-screen bg-neutral-50 text-neutral-950 dark:bg-neutral-900 dark:text-neutral-50">
      <AdminSidebar session={session} />
      <main className="min-w-0 flex-1 p-8 lg:p-12">{children}</main>
    </div>
  )
}
