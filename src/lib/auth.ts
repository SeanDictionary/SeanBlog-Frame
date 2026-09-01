import { compare } from 'bcryptjs'
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import type { JWT } from 'next-auth/jwt'
import { z } from 'zod'

import { authConfig } from '@/lib/auth.config'
import { checkLoginRateLimit, getClientRateLimitIdentifier, resetLoginRateLimit } from '@/lib/api/rate-limit'
import { getPrisma } from '@/lib/prisma'
import { recordOperationLog } from '@/lib/services/operation-log-service'

const credentialsSchema = z.object({
  username: z.literal('admin'),
  password: z.string().min(1),
})

// 会话版本号缓存：jwt 回调每个鉴权请求都会校验 token.v 与 DB 当前版本是否一致，
// 不一致即吊销（密码已重置）。加 30s 缓存避免每请求查库；重置密码后最多 30s
// 内旧会话失效（reset 在另一进程，无法清本进程缓存）。
const SESSION_VERSION_CACHE_TTL = 30_000
const sessionVersionCache = new Map<string, { v: number; expires: number }>()

async function getUserSessionTokenVersion(userId: string): Promise<number | null> {
  const now = Date.now()
  const cached = sessionVersionCache.get(userId)
  if (cached && cached.expires > now) return cached.v
  const user = await getPrisma().user.findUnique({ where: { id: userId }, select: { sessionTokenVersion: true } })
  const v = user?.sessionTokenVersion ?? null
  if (v !== null) sessionVersionCache.set(userId, { v, expires: now + SESSION_VERSION_CACHE_TTL })
  return v
}

export const {
  auth,
  handlers: { GET, POST },
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  trustHost: true,
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
        const attemptedUsername = typeof credentials?.username === 'string' ? credentials.username : null

        const user = parsedCredentials.success
          ? await getPrisma().user.findUnique({
              where: { username: parsedCredentials.data.username },
            })
          : null

        if (!parsedCredentials.success || !user || !(await compare(parsedCredentials.data.password, user.passwordHash))) {
          await recordOperationLog({
            actor: { name: attemptedUsername, type: 'admin' },
            module: 'auth',
            action: 'login',
            summary: '管理员登录失败：凭据不正确',
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
    async jwt({ token, user }) {
      if (user) {
        // 初次登录：写入用户 id 与当前会话版本
        token.id = user.id
        token.v = (await getUserSessionTokenVersion(user.id)) ?? undefined
      } else if (typeof token.id === 'string') {
        // 后续请求：版本不一致（密码已重置）则吊销会话
        const current = await getUserSessionTokenVersion(token.id)
        if (current === null || token.v !== current) {
          return {} as JWT
        }
      }

      return token
    },
    session({ session, token }) {
      if (session.user && typeof token.id === 'string' && typeof token.v === 'number') {
        session.user.id = token.id
      }

      return session
    },
  },
})
