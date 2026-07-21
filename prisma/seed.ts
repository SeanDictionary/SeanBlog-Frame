import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { ArticleStatus, PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is not configured.')
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
})

async function main() {
  const adminEmail = process.env.ADMIN_SEED_EMAIL ?? 'admin@example.com'
  const adminPassword = process.env.ADMIN_SEED_PASSWORD ?? 'ChangeMe123!'
  const passwordHash = await hash(adminPassword, 12)

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: 'Admin',
      passwordHash,
    },
    create: {
      name: 'Admin',
      email: adminEmail,
      passwordHash,
    },
  })

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
        contentHtml: '<h1>Hello SeanBlog Frame</h1><p>This is the first seeded article.</p>',
        categoryId: categories[0].id,
        tagIds: [tags[0].id, tags[1].id],
      },
      {
        title: 'Building with PostgreSQL',
        slug: 'building-with-postgresql',
        excerpt: 'A seeded note about a reliable data foundation.',
        contentMarkdown: '# Building with PostgreSQL\n\nPostgreSQL is the data foundation for this project.',
        contentHtml: '<h1>Building with PostgreSQL</h1><p>PostgreSQL is the data foundation for this project.</p>',
        categoryId: categories[0].id,
        tagIds: [tags[2].id, tags[3].id],
      },
      {
        title: 'Why Keep Writing',
        slug: 'why-keep-writing',
        excerpt: 'A small note on keeping a personal publishing habit.',
        contentMarkdown: '# Why Keep Writing\n\nWriting makes ideas easier to revisit and improve.',
        contentHtml: '<h1>Why Keep Writing</h1><p>Writing makes ideas easier to revisit and improve.</p>',
        categoryId: categories[1].id,
        tagIds: [tags[4].id],
      },
    ].map(async ({ tagIds, ...article }) => {
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

      await prisma.articleTag.deleteMany({
        where: { articleId: savedArticle.id },
      })
      await prisma.articleTag.createMany({
        data: tagIds.map((tagId) => ({ articleId: savedArticle.id, tagId })),
      })

      return savedArticle
    }),
  )

  console.log(
    `Seeded 1 administrator, ${categories.length} categories, ${tags.length} tags, and ${articles.length} articles.`,
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
