import { auth } from '@/lib/auth'

export async function requireAdmin() {
  const session = await auth()

  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }

  return session
}

export async function isAdminAuthenticated() {
  return Boolean((await auth())?.user?.id)
}
