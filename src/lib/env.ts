import { z } from 'zod'

/**
 * 启动期环境变量校验。
 *
 * 在 src/app/layout.tsx 与 src/lib/prisma.ts 顶部 import 本模块，使缺失/非法
 * 环境变量在首次渲染 / 首次数据库访问时抛出明确错误，而非在请求深处产生
 * 难以排查的 500。
 */

const envSchema = z.object({
  DATABASE_URL: z.string().trim().min(1, 'DATABASE_URL is required.'),
  AUTH_SECRET: z.string().trim().min(1, 'AUTH_SECRET is required.'),
  NEXT_PUBLIC_SITE_URL: z
    .string()
    .trim()
    .url('NEXT_PUBLIC_SITE_URL must be a valid URL.')
    .optional(),
  TRUST_PROXY_HEADERS: z.string().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).optional(),
})

export type Env = z.infer<typeof envSchema>

function parseEnv(): Env {
  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n')
    throw new Error(`Environment variable validation failed:\n${issues}`)
  }
  return parsed.data
}

export const env = parseEnv()

export const siteUrl = (env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
