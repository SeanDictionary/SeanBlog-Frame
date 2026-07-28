import { unauthorized } from '@/lib/api/errors'

import { auth } from '@/lib/auth'

export async function requireAdmin() {
  const session = await auth()

  if (!session?.user?.id) {
    throw unauthorized()
  }

  return session
}

export async function isAdminAuthenticated() {
  return Boolean((await auth())?.user?.id)
}
