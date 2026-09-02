import { z } from 'zod'

/**
 * 运行时环境变量校验。
 *
 * - 在 src/app/layout.tsx 与 src/lib/prisma.ts 顶部 import 本模块，使缺失/非法
 *   环境变量在运行时抛出明确错误，而非在请求深处产生难以排查的 500。
 * - 仅当 `DATABASE_URL` 存在时校验：构建期（尤其 Docker，无 .env.local）没有
 *   DATABASE_URL，跳过校验避免 `next build` 收集页面数据时失败；运行期
 *   （standalone `node server.js`，由 start-production.sh 注入 DATABASE_URL）
 *   照常校验。该判据不依赖 NEXT_PHASE（collect-page-data worker 不一定继承），
 *   且 scripts/* 不经本模块（各自直接用 @prisma/client），不受影响。
 */

const envSchema = z.object({
  DATABASE_URL: z.string().trim().min(1, 'DATABASE_URL is required.'),
  AUTH_SECRET: z.string().trim().min(1, 'AUTH_SECRET is required.'),
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

const shouldValidate = Boolean(process.env.DATABASE_URL)

export const env: Env = shouldValidate ? parseEnv() : (process.env as Env)
