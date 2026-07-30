import { unauthorized } from '@/lib/api/errors'

import { auth } from '@/lib/auth'

export async function getAdminSession() {
  const session = await auth()

  return session?.user?.id ? session : null
}

export async function requireAdmin() {
  const session = await getAdminSession()

  if (!session) {
    throw unauthorized()
  }

  return session
}

export async function isAdminAuthenticated() {
  return Boolean(await getAdminSession())
}
