import { compare } from 'bcryptjs'
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { z } from 'zod'

import { authConfig } from '@/lib/auth.config'
import { checkLoginRateLimit, getClientRateLimitIdentifier, resetLoginRateLimit } from '@/lib/api/rate-limit'
import { getPrisma } from '@/lib/prisma'
import { recordOperationLog } from '@/lib/services/operation-log-service'

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
      async authorize(credentials, request) {
        const identifier = getClientRateLimitIdentifier(request)

        if (!checkLoginRateLimit(identifier)) {
          await recordOperationLog({
            actor: { type: 'admin' },
            module: 'auth',
            action: 'login',
            summary: '管理员登录失败：请求过于频繁',
            result: 'FAILURE',
            error: new Error('Too many login attempts.'),
            request,
          })
          return null
        }

        const parsedCredentials = credentialsSchema.safeParse(credentials)

        if (!parsedCredentials.success) {
          await recordOperationLog({
            actor: { type: 'admin' },
            module: 'auth',
            action: 'login',
            summary: '管理员登录失败：凭据格式非法',
            result: 'FAILURE',
            error: parsedCredentials.error,
            request,
          })
          return null
        }

        const user = await getPrisma().user.findUnique({
          where: { username: parsedCredentials.data.username },
        })

        if (!user || !(await compare(parsedCredentials.data.password, user.passwordHash))) {
          await recordOperationLog({
            actor: { name: parsedCredentials.data.username, type: 'admin' },
            module: 'auth',
            action: 'login',
            summary: `管理员登录失败：${parsedCredentials.data.username}`,
            result: 'FAILURE',
            error: new Error('Invalid username or password.'),
            request,
          })
          return null
        }

        resetLoginRateLimit(identifier)
        await recordOperationLog({
          actor: { id: user.id, name: user.username, type: 'admin' },
          module: 'auth',
          action: 'login',
          targetType: 'user',
          targetId: user.id,
          summary: `管理员登录成功：${user.username}`,
          result: 'SUCCESS',
          request,
        })

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
