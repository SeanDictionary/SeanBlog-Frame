// 一次性迁移：把用户上传内容从 public/uploads 迁到 storage/uploads，并规范化
// DB Media.key（去掉冗余前导 uploads/，使其成为相对 UPLOADS_DIR 的相对路径）。
//
// 背景：Next.js 生产模式不服务运行时写入 public/ 的文件，且 public/uploads 无
// 命名卷、重建容器即丢数据。现已改由 storage 层 + /uploads 路由服务，存储根为
// <cwd>/storage/uploads。本脚本把历史文件搬到新位置并校正 key，幂等可重复执行。
//
// 用法：
//   本地： node scripts/migrate-uploads-to-storage.mjs [--dry-run]
//   容器： docker compose exec app node scripts/migrate-uploads-to-storage.mjs [--dry-run]
import { existsSync } from 'node:fs'
import { mkdir, readdir, rename, rm, stat } from 'node:fs/promises'
import path from 'node:path'

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { config as dotenvConfig } from 'dotenv'

import { resolveDatabaseUrl } from './db-url.mjs'

const DRY_RUN = process.argv.includes('--dry-run')

// 存储根与旧根，与 src/lib/media/storage.ts 的默认值保持一致。
const STORAGE_UPLOADS = process.env.UPLOADS_DIR
  ?? path.join(process.cwd(), 'storage', 'uploads')
const LEGACY_UPLOADS = path.join(process.cwd(), 'public', 'uploads')

function createPrisma() {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: resolveDatabaseUrl() }) })
}

// 本地 .env.local 兜底（容器内由 resolveDatabaseUrl 走 SECRETS_DIRECTORY）。
if (!process.env.DATABASE_URL && existsSync('.env.local')) {
  dotenvConfig({ path: '.env.local' })
}

function log(...args) {
  const tag = DRY_RUN ? '[dry-run]' : '[migrate]'
  console.log(tag, ...args)
}

/**
 * 递归把 src 下的文件合并到 dst（文件级幂等：目标已存在则跳过，不覆盖）。
 * 完成后删除 src 下已迁空的目录，保留仍存在文件的目录。
 */
async function mergeTree(src, dst) {
  let moved = 0
  let skipped = 0
  const entries = await readdir(src, { withFileTypes: true })
  for (const entry of entries) {
    const from = path.join(src, entry.name)
    const to = path.join(dst, entry.name)
    if (entry.isDirectory()) {
      const sub = await mergeTree(from, to)
      moved += sub.moved
      skipped += sub.skipped
      // 子目录迁空则删除，否则保留。
      const remaining = await readdir(from).catch(() => [])
      if (remaining.length === 0) {
        if (!DRY_RUN) await rm(from, { recursive: true, force: true }).catch(() => undefined)
      }
    } else if (entry.isFile()) {
      let targetExists = false
      try {
        await stat(to)
        targetExists = true
      } catch {
        targetExists = false
      }
      if (targetExists) {
        skipped += 1
        continue
      }
      if (DRY_RUN) {
        log('would move file:', path.relative(LEGACY_UPLOADS, from), '->', path.relative(STORAGE_UPLOADS, to))
        moved += 1
        continue
      }
      await mkdir(path.dirname(to), { recursive: true })
      await rename(from, to)
      moved += 1
    }
  }
  return { moved, skipped }
}

async function migrateFiles() {
  if (!existsSync(LEGACY_UPLOADS)) {
    log('legacy dir not present, nothing to move:', LEGACY_UPLOADS)
    return { moved: 0, skipped: 0 }
  }
  if (!existsSync(STORAGE_UPLOADS)) {
    if (!DRY_RUN) {
      await mkdir(STORAGE_UPLOADS, { recursive: true })
    }
  }
  log('moving tree:', LEGACY_UPLOADS, '->', STORAGE_UPLOADS)
  const result = await mergeTree(LEGACY_UPLOADS, STORAGE_UPLOADS)
  log(`files: ${result.moved} moved, ${result.skipped} skipped (already present)`)

  // 迁空后清理空的 legacy 根目录（若仍非空则保留）。
  if (!DRY_RUN) {
    const leftover = await readdir(LEGACY_UPLOADS).catch(() => null)
    if (leftover && leftover.length === 0) {
      await rm(LEGACY_UPLOADS, { force: true }).catch(() => undefined)
      log('removed empty legacy dir:', LEGACY_UPLOADS)
    } else if (leftover) {
      log('legacy dir still non-empty, kept:', LEGACY_UPLOADS)
    }
  }
  return result
}

async function migrateMediaKeys(prisma) {
  const rows = await prisma.media.findMany({ select: { id: true, key: true } })
  const toUpdate = rows.filter((row) => row.key && row.key.startsWith('uploads/'))
  if (toUpdate.length === 0) {
    log('no Media.key rows need normalization')
    return 0
  }
  log(`normalizing ${toUpdate.length} Media.key rows (strip leading 'uploads/')`)
  let updated = 0
  let failed = 0
  for (const row of toUpdate) {
    const newKey = row.key.slice('uploads/'.length)
    if (DRY_RUN) {
      log('would update key:', row.key, '->', newKey)
      updated += 1
      continue
    }
    try {
      await prisma.media.update({ where: { id: row.id }, data: { key: newKey } })
      updated += 1
    } catch (error) {
      failed += 1
      console.error('[migrate] failed to update key for media', row.id, row.key, '->', newKey, error?.message ?? error)
    }
  }
  log(`keys: ${updated} updated${failed ? `, ${failed} failed` : ''}`)
  return updated
}

async function main() {
  console.log(DRY_RUN ? '== DRY RUN ==' : '== APPLYING ==')
  console.log('storage root:', STORAGE_UPLOADS)
  console.log('legacy root :', LEGACY_UPLOADS)

  await migrateFiles()

  const prisma = createPrisma()
  try {
    await migrateMediaKeys(prisma)
  } finally {
    await prisma.$disconnect()
  }
  console.log(DRY_RUN ? '== DRY RUN done ==' : '== migration done ==')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
