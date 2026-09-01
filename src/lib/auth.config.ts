import type { NextAuthConfig } from 'next-auth'

export const authConfig = {
  session: {
    strategy: 'jwt',
    // 7 天上限（默认 30 天偏长）。updateAge 仍为默认 24h：活跃管理员每 24h
    // 刷新签发时间，连续空闲超 7 天才自动登出。
    maxAge: 7 * 24 * 60 * 60,
  },
  providers: [],
} satisfies NextAuthConfig
