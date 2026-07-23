import { printAdminPassword, resetAdminPassword } from './admin-account.mjs'

const password = await resetAdminPassword()
printAdminPassword(password, true)
