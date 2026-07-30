'use server'

import { AuthError } from 'next-auth'
import { redirect } from 'next/navigation'

import { signIn } from '@/lib/auth'

function getSafeCallbackUrl(value: FormDataEntryValue | null) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return '/admin'
  }

  return value
}

export async function authenticate(formData: FormData) {
  const callbackUrl = getSafeCallbackUrl(formData.get('callbackUrl'))

  try {
    await signIn('credentials', {
      username: String(formData.get('username') ?? ''),
      password: String(formData.get('password') ?? ''),
      redirectTo: callbackUrl,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(`/login?error=CredentialsSignin&callbackUrl=${encodeURIComponent(callbackUrl)}`)
    }

    throw error
  }
}
