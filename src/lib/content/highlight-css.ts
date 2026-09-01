/**
 * 内置代码块高亮 CSS — Shiki 双主题深色切换。
 *
 * Shiki 由服务端 unified 管线输出：浅色 token 为内联 color，深色 token 以
 * --shiki-dark / --shiki-dark-bg CSS 变量形式输出。浅色直接生效；深色需要用
 * !important 覆盖内联 color，按站点 [data-theme="dark"] 切换。
 *
 * 主题 CSS 校验器（validateThemeCss）禁止 !important，因此这段样式作为框架内置
 * 样式随主题 CSS 包一起注入，不经过主题校验。
 */
export const DEFAULT_HIGHLIGHT_CSS = `/* Shiki 代码高亮：深色模式切换到 --shiki-dark token */
[data-theme="dark"] .article-content .shiki,
[data-theme="dark"] .article-content .shiki span {
  background-color: var(--shiki-dark-bg) !important;
  color: var(--shiki-dark) !important;
}
`
