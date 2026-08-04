import type { Route } from 'next'
import { redirect } from 'next/navigation'

export default function AdminCategoriesPage() {
  redirect('/admin/taxonomy' as Route)
}
