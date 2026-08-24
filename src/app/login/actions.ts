'use server'

import { AuthError } from 'next-auth'
import { redirect } from 'next/navigation'

import { signIn } from '@/lib/auth'
import { isDatabaseAvailable } from '@/lib/prisma'

export async function authenticate(formData: FormData) {
  // Fail gracefully when the database is unreachable, instead of letting the
  // credentials lookup throw and report misleading "invalid credentials".
  if (!(await isDatabaseAvailable())) {
    redirect('/login?error=ServiceUnavailable')
  }

  try {
    await signIn('credentials', {
      username: String(formData.get('username') ?? ''),
      password: String(formData.get('password') ?? ''),
      redirectTo: '/admin',
    })
  } catch (error) {
    if (error instanceof AuthError) {
      redirect('/login?error=CredentialsSignin')
    }

    throw error
  }
}
