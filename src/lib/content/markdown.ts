import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSanitize, {
    ...defaultSchema,
    attributes: {
      ...defaultSchema.attributes,
      code: [
        ...(defaultSchema.attributes?.code ?? []),
        ['className', /^language-/],
      ],
    },
  })
  .use(rehypeStringify)

export async function markdownToHtml(markdown: string) {
  const result = await processor.process(markdown)

  return String(result)
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
