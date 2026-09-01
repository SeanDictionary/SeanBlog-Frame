/**
 * KaTeX CDN 配置
 *
 * KaTeX 由服务端 rehype-katex 渲染为带 katex-* 类名的 HTML，
 * 使用 CDN 加载 CSS 和字体文件，无需本地存储。
 */

export const KATEX_CDN_CSS = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css'

// 生成 link 标签用于 HTML head
export function getKatexCssLink(): string {
  return `<link rel="stylesheet" href="${KATEX_CDN_CSS}">`
}
