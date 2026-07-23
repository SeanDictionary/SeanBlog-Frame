import { compare } from 'bcryptjs'
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { z } from 'zod'

import { authConfig } from '@/lib/auth.config'
import { getPrisma } from '@/lib/prisma'

const credentialsSchema = z.object({
  username: z.literal('admin'),
  password: z.string().min(1),
})

export const {
  auth,
  handlers: { GET, POST },
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        username: { label: '用户名', type: 'text' },
        password: { label: '密码', type: 'password' },
      },
      async authorize(credentials) {
        const parsedCredentials = credentialsSchema.safeParse(credentials)

        if (!parsedCredentials.success) {
          return null
        }

        const user = await getPrisma().user.findUnique({
          where: { username: parsedCredentials.data.username },
        })

        if (!user || !(await compare(parsedCredentials.data.password, user.passwordHash))) {
          return null
        }

        return {
          id: user.id,
          name: user.username,
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }

      return token
    },
    session({ session, token }) {
      if (session.user && typeof token.id === 'string') {
        session.user.id = token.id
      }

      return session
    },
  },
})
