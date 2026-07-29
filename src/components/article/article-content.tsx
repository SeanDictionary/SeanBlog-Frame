type ArticleContentProps = {
  html: string
}

export function ArticleContent({ html }: ArticleContentProps) {
  return <div className="article-content" dangerouslySetInnerHTML={{ __html: html }} />
}
