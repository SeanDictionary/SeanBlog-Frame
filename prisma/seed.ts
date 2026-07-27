import { randomBytes } from 'node:crypto'

import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { ArticleStatus, PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

import { writeArticleMarkdown } from '../src/lib/content/article-content'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is not configured.')
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
})

async function ensureAdmin() {
  const admin = await prisma.user.findUnique({
    where: { username: 'admin' },
  })

  if (admin) {
    return
  }

  const password = randomBytes(24).toString('base64url')

  await prisma.user.create({
    data: {
      username: 'admin',
      passwordHash: await hash(password, 12),
    },
  })

  console.log('\nAdministrator account created.')
  console.log('Username: admin')
  console.log(`Password: ${password}`)
  console.log('Save this password now. It will not be shown again.\n')
}

async function seedContent() {
  const categories = await Promise.all(
    [
      {
        name: 'Engineering',
        slug: 'engineering',
        description: 'Engineering and full-stack development notes.',
        sortOrder: 1,
      },
      {
        name: 'Notes',
        slug: 'notes',
        description: 'Notes from learning and daily work.',
        sortOrder: 2,
      },
      {
        name: 'Life',
        slug: 'life',
        description: 'Personal thoughts and life updates.',
        sortOrder: 3,
      },
    ].map((category) =>
      prisma.category.upsert({
        where: { slug: category.slug },
        update: category,
        create: category,
      }),
    ),
  )

  const tags = await Promise.all(
    ['Next.js', 'TypeScript', 'PostgreSQL', 'Prisma', 'Writing'].map((name) => {
      const slug = name.toLowerCase().replaceAll('.', '')

      return prisma.tag.upsert({
        where: { slug },
        update: { name },
        create: { name, slug },
      })
    }),
  )

  const articles = await Promise.all(
    [
      {
        title: 'Hello SeanBlog Frame',
        slug: 'hello-seanblog-frame',
        excerpt: 'Initial seeded article for the blog CMS.',
        contentMarkdown: '# Hello SeanBlog Frame\n\nThis is the first seeded article.',
        categoryId: categories[0].id,
        tagIds: [tags[0].id, tags[1].id],
      },
      {
        title: 'Building with PostgreSQL',
        slug: 'building-with-postgresql',
        excerpt: 'A seeded note about a reliable data foundation.',
        contentMarkdown: '# Building with PostgreSQL\n\nPostgreSQL is the data foundation for this project.',
        categoryId: categories[0].id,
        tagIds: [tags[2].id, tags[3].id],
      },
      {
        title: 'Why Keep Writing',
        slug: 'why-keep-writing',
        excerpt: 'A small note on keeping a personal publishing habit.',
        contentMarkdown: '# Why Keep Writing\n\nWriting makes ideas easier to revisit and improve.',
        categoryId: categories[1].id,
        tagIds: [tags[4].id],
      },
    ].map(async ({ tagIds, contentMarkdown, ...article }) => {
      const savedArticle = await prisma.article.upsert({
        where: { slug: article.slug },
        update: {
          ...article,
          status: ArticleStatus.PUBLISHED,
          publishedAt: new Date(),
        },
        create: {
          ...article,
          status: ArticleStatus.PUBLISHED,
          publishedAt: new Date(),
        },
      })

      const contentPath = await writeArticleMarkdown(savedArticle.id, contentMarkdown)

      await prisma.article.update({
        where: { id: savedArticle.id },
        data: { contentPath },
      })

      await prisma.articleTag.deleteMany({
        where: { articleId: savedArticle.id },
      })
      await prisma.articleTag.createMany({
        data: tagIds.map((tagId) => ({ articleId: savedArticle.id, tagId })),
      })

      return savedArticle
    }),
  )

  console.log(`Seeded ${categories.length} categories, ${tags.length} tags, and ${articles.length} articles.`)
}

async function main() {
  await ensureAdmin()
  await seedContent()
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
