import { createAdminIfMissing, printAdminPassword } from './admin-account.mjs'

const password = await createAdminIfMissing()

if (password) {
  printAdminPassword(password)
}
