import { notFound } from 'next/navigation'

// 后台兜底：所有未匹配到更具体路由的 /admin/** 路径在此触发 notFound()，
// 由 src/app/admin/not-found.tsx 渲染后台 404 页（走 admin layout、需登录）。
// 用必选 catch-all [...path] 才能比公共 [...path] 更具体，避免被前台兜底抢占。
export default function AdminCatchAllPage() {
  notFound()
}
