import { randomBytes } from 'node:crypto'

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

import { resolveDatabaseUrl } from './db-url.mjs'

export const ADMIN_USERNAME = 'admin'

function createPrisma() {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: resolveDatabaseUrl() }),
  })
}

function createPassword() {
  return randomBytes(24).toString('base64url')
}

export async function createAdminIfMissing() {
  const prisma = createPrisma()

  try {
    const admin = await prisma.user.findUnique({
      where: { username: ADMIN_USERNAME },
    })

    if (admin) {
      return null
    }

    const password = createPassword()

    await prisma.user.create({
      data: {
        username: ADMIN_USERNAME,
        passwordHash: await hash(password, 12),
      },
    })

    return password
  } finally {
    await prisma.$disconnect()
  }
}

export async function resetAdminPassword() {
  const prisma = createPrisma()
  const password = createPassword()

  try {
    await prisma.user.upsert({
      where: { username: ADMIN_USERNAME },
      update: {
        passwordHash: await hash(password, 12),
      },
      create: {
        username: ADMIN_USERNAME,
        passwordHash: await hash(password, 12),
      },
    })

    return password
  } finally {
    await prisma.$disconnect()
  }
}

export function printAdminPassword(password, wasReset = false) {
  console.log(`\nAdministrator password ${wasReset ? 'reset' : 'created'}.`)
  console.log(`Username: ${ADMIN_USERNAME}`)
  console.log(`Password: ${password}`)
  console.log('Save this password now. It will not be shown again.\n')
}
