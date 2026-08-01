import { Fragment } from 'react'

import { parseSearchTerms } from '@/lib/search'

type HighlightedTextProps = {
  text: string
  query: string
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function HighlightedText({ text, query }: HighlightedTextProps) {
  const terms = parseSearchTerms(query)

  if (terms.length === 0) {
    return text
  }

  const pattern = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'gi')

  return (
    <>
      {text.split(pattern).map((part, index) => {
        if (!part) {
          return null
        }

        const isMatch = terms.includes(part.toLocaleLowerCase())

        return isMatch ? (
          <mark key={`${part}-${index}`} className="rounded-[0.2em] bg-accent/15 px-0.5 text-accent">
            {part}
          </mark>
        ) : (
          <Fragment key={`${part}-${index}`}>{part}</Fragment>
        )
      })}
    </>
  )
}
