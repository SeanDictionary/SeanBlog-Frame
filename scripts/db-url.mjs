// 统一解析数据库连接串，供运维脚本（reset-admin-password / prune-operation-logs
// / initialize-admin / initialize-content）共用：
// 1) 显式 process.env.DATABASE_URL（Docker 入口 start-production.sh 已 export）
// 2) 本地开发：从 .env.local 加载
// 3) Docker exec：容器持久 env 无 DATABASE_URL，但 SECRETS_DIRECTORY 指向密钥
//    卷，从中读 postgres_password 推导连接串（host/db 默认 db/seanblog_frame，
//    可被 POSTGRES_HOST / POSTGRES_DB 覆盖）
// 使 `docker compose exec app node scripts/<x>.mjs` 与 `npm run admin:reset-password`
// 在不手工 export DATABASE_URL 的情况下可用。
import { existsSync, readFileSync } from 'node:fs'
import { config as dotenvConfig } from 'dotenv'

export function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL

  if (existsSync('.env.local')) {
    dotenvConfig({ path: '.env.local' })
    if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  }

  const secretsDir = process.env.SECRETS_DIRECTORY
  if (secretsDir) {
    const password = readFileSync(`${secretsDir}/postgres_password`, 'utf8').trim()
    const host = process.env.POSTGRES_HOST || 'db'
    const port = process.env.POSTGRES_PORT || '5432'
    const db = process.env.POSTGRES_DB || 'seanblog_frame'
    return `postgresql://postgres:${password}@${host}:${port}/${db}?schema=public`
  }

  throw new Error('DATABASE_URL is not configured. Set it, put it in .env.local, or run inside the Docker container (SECRETS_DIRECTORY).')
}
