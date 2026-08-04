'use client'

import { useState, useTransition } from 'react'

import type { ArticleCommentsMode } from '@/lib/comment-settings'

type ArticleFormValues = {
  id?: string
  title?: string
  slug?: string
  excerpt?: string | null
  contentMarkdown?: string
  coverImage?: string | null
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  commentsMode?: ArticleCommentsMode
  categoryId?: string | null
  tagIds?: string[]
  isPinned?: boolean
  metaTitle?: string | null
  metaDescription?: string | null
  metaKeywords?: string | null
}

type Option = {
  id: string
  name: string
}

type ArticleEditorProps = {
  article?: ArticleFormValues
  categories: Option[]
  tags: Option[]
}

type UploadResponse = {
  media?: { url: string }
  error?: { message?: string }
}

export function ArticleEditor({ article, categories, tags }: ArticleEditorProps) {
  const [message, setMessage] = useState<string | null>(null)
  const [coverImage, setCoverImage] = useState(article?.coverImage ?? '')
  const [isPending, startTransition] = useTransition()
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set(article?.tagIds ?? []))

  function toggleTag(tagId: string) {
    setSelectedTags((previous) => {
      const next = new Set(previous)
      next.has(tagId) ? next.delete(tagId) : next.add(tagId)
      return next
    })
  }

  async function uploadCoverImage(file: File) {
    if (!file.type.startsWith('image/')) {
      setMessage('只能上传图片作为头图。')
      return
    }

    setMessage('正在上传头图…')

    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch('/api/admin/media/upload', { method: 'POST', body: formData })
      const data = (await response.json()) as UploadResponse

      if (!response.ok || !data.media) {
        throw new Error(data.error?.message ?? '头图上传失败。')
      }

      setCoverImage(data.media.url)
      setMessage('头图已上传并填入 URL。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '头图上传失败。')
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    if (file) {
      void uploadCoverImage(file)
    }
    event.currentTarget.value = ''
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const file = Array.from(event.clipboardData.files).find((item) => item.type.startsWith('image/'))
    if (file) {
      event.preventDefault()
      void uploadCoverImage(file)
    }
  }

  function submit(formData: FormData) {
    setMessage(null)

    startTransition(async () => {
      const payload = {
        title: String(formData.get('title') ?? ''),
        slug: String(formData.get('slug') ?? '') || undefined,
        excerpt: String(formData.get('excerpt') ?? '') || null,
        contentMarkdown: String(formData.get('contentMarkdown') ?? ''),
        coverImage: String(formData.get('coverImage') ?? '') || null,
        status: String(formData.get('status') ?? 'DRAFT'),
        commentsMode: String(formData.get('commentsMode') ?? 'enabled'),
        categoryId: String(formData.get('categoryId') ?? '') || null,
        tagIds: [...selectedTags],
        isPinned: formData.get('isPinned') === 'on',
        metaTitle: String(formData.get('metaTitle') ?? '') || null,
        metaDescription: String(formData.get('metaDescription') ?? '') || null,
        metaKeywords: String(formData.get('metaKeywords') ?? '') || null,
      }

      try {
        const endpoint = article?.id ? `/api/admin/articles/${article.id}` : '/api/admin/articles'
        const response = await fetch(endpoint, {
          method: article?.id ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = (await response.json()) as { article?: { id: string }; error?: { message?: string } }

        if (!response.ok || !data.article) {
          throw new Error(data.error?.message ?? '保存失败。')
        }

        setMessage('已保存。')
        if (!article?.id) {
          window.location.assign(`/admin/articles/${data.article.id}/edit`)
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '保存失败。')
      }
    })
  }

  return (
    <form action={submit} className="space-y-7">
      <section className="grid gap-5 rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
        <label className="grid gap-1.5 text-sm font-medium">标题<input name="title" defaultValue={article?.title} required maxLength={200} className="h-11 rounded-md border border-neutral-300 bg-white px-3 font-normal outline-none focus:border-blue-600 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-blue-400" /></label>
        <label className="grid gap-1.5 text-sm font-medium">Slug <span className="font-normal text-neutral-500">（留空自动生成）</span><input name="slug" defaultValue={article?.slug} maxLength={120} className="h-10 rounded-md border border-neutral-300 bg-white px-3 font-mono text-sm font-normal outline-none focus:border-blue-600 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-blue-400" /></label>
        <label className="grid gap-1.5 text-sm font-medium">摘要<textarea name="excerpt" defaultValue={article?.excerpt ?? ''} rows={3} className="rounded-md border border-neutral-300 bg-white p-3 font-normal outline-none focus:border-blue-600 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-blue-400" /></label>
        <label className="grid gap-1.5 text-sm font-medium">头图 URL <span className="font-normal text-neutral-500">（可手填 URL，也可上传或粘贴图片）</span><input name="coverImage" value={coverImage} onChange={(event) => setCoverImage(event.target.value)} onPaste={handlePaste} maxLength={2048} placeholder="https://example.com/cover.jpg 或粘贴图片" className="h-10 rounded-md border border-neutral-300 bg-white px-3 font-normal outline-none focus:border-blue-600 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-blue-400" /></label>
        <div className="grid gap-3 rounded-md border border-dashed border-neutral-300 p-4 dark:border-neutral-700 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="text-sm font-medium">上传头图</p>
            <p className="mt-1 text-xs text-neutral-500">支持 jpg、png、webp、gif、avif，最大 5 MB。也可以直接在头图 URL 输入框粘贴图片。</p>
          </div>
          <label className="inline-flex cursor-pointer items-center justify-center rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800">
            选择图片
            <input type="file" accept="image/*" onChange={handleFileChange} className="sr-only" />
          </label>
        </div>
        {coverImage && <img src={coverImage} alt="文章头图预览" className="h-44 w-full rounded-md border border-neutral-200 object-cover dark:border-neutral-800" />}
        <label className="grid gap-1.5 text-sm font-medium">正文（Markdown）<textarea name="contentMarkdown" defaultValue={article?.contentMarkdown} required rows={22} className="rounded-md border border-neutral-300 bg-white p-3 font-mono text-sm font-normal leading-6 outline-none focus:border-blue-600 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-blue-400" /></label>
      </section>

      <section className="grid gap-5 rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-medium">状态<select name="status" defaultValue={article?.status ?? 'DRAFT'} className="h-10 rounded-md border border-neutral-300 bg-white px-3 font-normal outline-none dark:border-neutral-700 dark:bg-neutral-900"><option value="DRAFT">草稿</option><option value="PUBLISHED">发布</option><option value="ARCHIVED">归档</option></select></label>
        <label className="grid gap-1.5 text-sm font-medium">评论<select name="commentsMode" defaultValue={article?.commentsMode ?? 'enabled'} className="h-10 rounded-md border border-neutral-300 bg-white px-3 font-normal outline-none dark:border-neutral-700 dark:bg-neutral-900"><option value="enabled">允许评论</option><option value="readOnly">关闭新增评论</option><option value="disabled">关闭评论</option></select></label>
        <label className="grid gap-1.5 text-sm font-medium">分类<select name="categoryId" defaultValue={article?.categoryId ?? ''} className="h-10 rounded-md border border-neutral-300 bg-white px-3 font-normal outline-none dark:border-neutral-700 dark:bg-neutral-900"><option value="">未分类</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <label className="inline-flex items-center gap-2 text-sm font-medium"><input name="isPinned" type="checkbox" defaultChecked={article?.isPinned} /> 置顶文章</label>
        <div className="sm:col-span-2"><p className="mb-2 text-sm font-medium">标签</p><div className="flex flex-wrap gap-2">{tags.map((tag) => <label key={tag.id} className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"><input type="checkbox" checked={selectedTags.has(tag.id)} onChange={() => toggleTag(tag.id)} /> {tag.name}</label>)}</div></div>
      </section>

      <details className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950"><summary className="cursor-pointer text-sm font-medium">SEO 设置</summary><div className="mt-5 grid gap-5"><label className="grid gap-1.5 text-sm">SEO 标题<input name="metaTitle" defaultValue={article?.metaTitle ?? ''} className="h-10 rounded-md border border-neutral-300 bg-white px-3 outline-none dark:border-neutral-700 dark:bg-neutral-900" /></label><label className="grid gap-1.5 text-sm">SEO 描述<textarea name="metaDescription" defaultValue={article?.metaDescription ?? ''} rows={3} className="rounded-md border border-neutral-300 bg-white p-3 outline-none dark:border-neutral-700 dark:bg-neutral-900" /></label><label className="grid gap-1.5 text-sm">关键词<input name="metaKeywords" defaultValue={article?.metaKeywords ?? ''} className="h-10 rounded-md border border-neutral-300 bg-white px-3 outline-none dark:border-neutral-700 dark:bg-neutral-900" /></label></div></details>

      <div className="flex items-center gap-4"><button type="submit" disabled={isPending} className="rounded-md bg-neutral-950 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-950">{isPending ? '正在保存…' : '保存文章'}</button>{message && <p className="text-sm text-neutral-500" role="status">{message}</p>}</div>
    </form>
  )
}
