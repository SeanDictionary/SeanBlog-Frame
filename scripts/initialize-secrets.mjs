import { randomBytes } from 'node:crypto'
import { chmod, mkdir, open, readFile } from 'node:fs/promises'

const secretsDirectory = process.env.SECRETS_DIRECTORY ?? '/run/secrets'
const secretFiles = ['auth_secret', 'postgres_password']

async function ensureSecret(filename) {
  const path = `${secretsDirectory}/${filename}`

  try {
    const secret = (await readFile(path, 'utf8')).trim()

    if (!secret) {
      throw new Error(`${path} is empty.`)
    }

    await chmod(path, 0o444)
    return
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code !== 'ENOENT') {
      throw error
    }
  }

  const file = await open(path, 'wx', 0o600)

  try {
    await file.writeFile(randomBytes(48).toString('base64url'))
  } finally {
    await file.close()
  }

  await chmod(path, 0o444)
}

await mkdir(secretsDirectory, { recursive: true })
await Promise.all(secretFiles.map(ensureSecret))
