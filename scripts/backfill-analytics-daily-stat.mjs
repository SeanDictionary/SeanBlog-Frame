// Backfill AnalyticsDailyStat from existing AnalyticsEvent records.
// Run once after the schema migration to populate the daily aggregate table
// with historical view counts.
//
// Usage: node scripts/backfill-analytics-daily-stat.mjs
//
// Visitor table is NOT backfilled (old events have visitorId=null after the
// migration dropped visitorHash). Visitors accumulate from new visits onward.

import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

config({ path: '.env.local' })

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

async function main() {
  const events = await prisma.analyticsEvent.findMany({
    select: { createdAt: true, articleId: true, categoryId: true, tagId: true },
  })

  console.log(`Backfilling ${events.length} events into AnalyticsDailyStat...`)

  // Group by (date, dimension, contentId) → count views.
  const stats = new Map()

  for (const event of events) {
    const date = startOfDay(event.createdAt)
    const addRow = (dimension, contentId) => {
      const key = `${date.toISOString()}|${dimension}|${contentId}`
      stats.set(key, (stats.get(key) ?? 0) + 1)
    }

    addRow('all', '')
    if (event.articleId) addRow('article', event.articleId)
    if (event.categoryId) addRow('category', event.categoryId)
    if (event.tagId) addRow('tag', event.tagId)
  }

  console.log(`Upserting ${stats.size} daily-stat rows...`)

  let count = 0
  for (const [key, views] of stats) {
    const [dateStr, dimension, contentId] = key.split('|')
    const date = new Date(dateStr)

    await prisma.analyticsDailyStat.upsert({
      where: { date_dimension_contentId: { date, dimension, contentId } },
      create: { date, dimension, contentId, views },
      update: { views: { increment: views } },
    })

    count++
    if (count % 1000 === 0) console.log(`  ${count}/${stats.size}`)
  }

  console.log(`Done. Backfilled ${count} rows.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
