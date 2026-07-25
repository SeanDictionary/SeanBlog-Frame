const htmlEscapePattern = /[&<>"]/g
const htmlEscapes: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
}

function escapeHtml(input: string) {
  return input.replace(htmlEscapePattern, (character) => htmlEscapes[character] ?? character)
}

function inlineMarkdown(input: string) {
  return escapeHtml(input)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
}

export function markdownToHtml(markdown: string) {
  const blocks = markdown.trim().split(/\n{2,}/)

  return blocks
    .map((block) => {
      const value = block.trim()

      if (!value) {
        return ''
      }

      if (value.startsWith('### ')) {
        return `<h3>${inlineMarkdown(value.slice(4))}</h3>`
      }

      if (value.startsWith('## ')) {
        return `<h2>${inlineMarkdown(value.slice(3))}</h2>`
      }

      if (value.startsWith('# ')) {
        return `<h1>${inlineMarkdown(value.slice(2))}</h1>`
      }

      const lines = value.split('\n')
      if (lines.every((line) => line.startsWith('- '))) {
        return `<ul>${lines.map((line) => `<li>${inlineMarkdown(line.slice(2))}</li>`).join('')}</ul>`
      }

      return `<p>${inlineMarkdown(lines.join('<br>'))}</p>`
    })
    .filter(Boolean)
    .join('')
}

export function createExcerpt(markdown: string, maxLength = 160) {
  const plainText = markdown
    .replace(/[#>*_`\-[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (plainText.length <= maxLength) {
    return plainText
  }

  return `${plainText.slice(0, maxLength).trimEnd()}...`
}
