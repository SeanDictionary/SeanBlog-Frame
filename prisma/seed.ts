import { hashSync } from 'bcryptjs'
import { PrismaClient, UserRole, ArticleStatus } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const adminEmail = process.env.ADMIN_SEED_EMAIL ?? 'admin@example.com'
  const adminPassword = process.env.ADMIN_SEED_PASSWORD ?? 'ChangeMe123!'

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: 'Admin',
      passwordHash: hashSync(adminPassword, 10),
      role: UserRole.ADMIN,
    },
    create: {
      name: 'Admin',
      email: adminEmail,
      passwordHash: hashSync(adminPassword, 10),
      role: UserRole.ADMIN,
    },
  })

  const category = await prisma.category.upsert({
    where: { slug: 'engineering' },
    update: {},
    create: {
      name: 'Engineering',
      slug: 'engineering',
      description: 'Engineering and full-stack development notes.',
    },
  })

  const tag = await prisma.tag.upsert({
    where: { slug: 'nextjs' },
    update: {},
    create: {
      name: 'Next.js',
      slug: 'nextjs',
    },
  })

  const article = await prisma.article.upsert({
    where: { slug: 'hello-seanblog-frame' },
    update: {
      title: 'Hello SeanBlog Frame',
      excerpt: 'Initial seeded article for the blog CMS skeleton.',
      contentMarkdown: '# Hello SeanBlog Frame\n\nThis is the first seeded article.',
      contentHtml: '<h1>Hello SeanBlog Frame</h1><p>This is the first seeded article.</p>',
      status: ArticleStatus.PUBLISHED,
      publishedAt: new Date(),
      authorId: admin.id,
      categoryId: category.id,
    },
    create: {
      title: 'Hello SeanBlog Frame',
      slug: 'hello-seanblog-frame',
      excerpt: 'Initial seeded article for the blog CMS skeleton.',
      contentMarkdown: '# Hello SeanBlog Frame\n\nThis is the first seeded article.',
      contentHtml: '<h1>Hello SeanBlog Frame</h1><p>This is the first seeded article.</p>',
      status: ArticleStatus.PUBLISHED,
      publishedAt: new Date(),
      authorId: admin.id,
      categoryId: category.id,
    },
  })

  await prisma.articleTag.upsert({
    where: {
      articleId_tagId: {
        articleId: article.id,
        tagId: tag.id,
      },
    },
    update: {},
    create: {
      articleId: article.id,
      tagId: tag.id,
    },
  })

  console.log('Seed completed successfully.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
