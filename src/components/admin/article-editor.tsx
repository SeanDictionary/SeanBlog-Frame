'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'

import type { ArticleCommentsMode } from '@/lib/comment-settings'
import { createSlugFromTitle } from '@/lib/content/pinyin-slug'

type ArticleStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

type ArticleFormValues = {
  id?: string
  title?: string
  slug?: string
  excerpt?: string | null
  contentMarkdown?: string
  coverImage?: string | null
  status?: ArticleStatus
  commentsMode?: ArticleCommentsMode
  categoryId?: string | null
  tagIds?: string[]
  isPinned?: boolean
  publishedAt?: Date | string | null
  expiresAt?: Date | string | null
  metaTitle?: string | null
  metaDescription?: string | null
  metaKeywords?: string | null
}

type Option = {
  id: string
  name: string
  slug?: string
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

type TaxonomyResponse = {
  category?: Option
  tag?: Option
  error?: { message?: string }
}

type SlugCheckResponse = {
  slug: string
  available: boolean
  message?: string | null
}

type FormState = {
  title: string
  slug: string
  excerpt: string
  contentMarkdown: string
  coverImage: string
  status: ArticleStatus
  commentsMode: ArticleCommentsMode
  categoryId: string
  isPinned: boolean
  publishedAt: string
  expiresAt: string
  metaTitle: string
  metaDescription: string
  metaKeywords: string
}

const statusLabels: Record<ArticleStatus, string> = {
  DRAFT: '草稿',
  PUBLISHED: '发布',
  ARCHIVED: '归档',
}

function toDateTimeLocal(value?: Date | string | null) {
  if (!value) return ''

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60_000)
  return local.toISOString().slice(0, 16)
}

function fromDateTimeLocal(value: string) {
  return value ? new Date(value).toISOString() : null
}

function getInitialState(article?: ArticleFormValues): FormState {
  return {
    title: article?.title ?? '',
    slug: article?.slug ?? '',
    excerpt: article?.excerpt ?? '',
    contentMarkdown: article?.contentMarkdown ?? '',
    coverImage: article?.coverImage ?? '',
    status: article?.status ?? 'DRAFT',
    commentsMode: article?.commentsMode ?? 'enabled',
    categoryId: article?.categoryId ?? '',
    isPinned: article?.isPinned ?? false,
    publishedAt: toDateTimeLocal(article?.publishedAt),
    expiresAt: toDateTimeLocal(article?.expiresAt),
    metaTitle: article?.metaTitle ?? '',
    metaDescription: article?.metaDescription ?? '',
    metaKeywords: article?.metaKeywords ?? '',
  }
}

export function ArticleEditor({ article, categories, tags }: ArticleEditorProps) {
  const [form, setForm] = useState<FormState>(() => getInitialState(article))
  const [categoryOptions, setCategoryOptions] = useState(categories)
  const [tagOptions, setTagOptions] = useState(tags)
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set(article?.tagIds ?? []))
  const [message, setMessage] = useState<string | null>(null)
  const [slugError, setSlugError] = useState<string | null>(null)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newTagName, setNewTagName] = useState('')
  const [slugTouched, setSlugTouched] = useState(Boolean(article?.slug))
  const [isPending, startTransition] = useTransition()
  const [isTaxonomyPending, startTaxonomyTransition] = useTransition()
  const [isSlugPending, startSlugTransition] = useTransition()

  const statusSummary = useMemo(() => {
    const labels = [statusLabels[form.status]]
    const now = Date.now()
    const publishedAt = form.publishedAt ? new Date(form.publishedAt).getTime() : null
    const expiresAt = form.expiresAt ? new Date(form.expiresAt).getTime() : null

    if (form.isPinned) labels.push('置顶')
    if (form.status === 'PUBLISHED' && publishedAt && publishedAt > now) labels.push('定时发布')
    if (expiresAt && expiresAt <= now) labels.push('已过期')
    if (expiresAt && expiresAt > now) labels.push('定时过期')

    return labels
  }, [form.expiresAt, form.isPinned, form.publishedAt, form.status])

  useEffect(() => {
    if (!slugTouched) {
      setForm((previous) => ({ ...previous, slug: createSlugFromTitle(previous.title) }))
    }
  }, [form.title, slugTouched])

  useEffect(() => {
    if (!form.slug) {
      setSlugError('Slug 必填。')
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      startSlugTransition(async () => {
        try {
          const params = new URLSearchParams({ slug: form.slug })
          if (article?.id) params.set('excludeId', article.id)
          const response = await fetch(`/api/admin/articles/slug?${params.toString()}`, { signal: controller.signal })
          const data = (await response.json()) as SlugCheckResponse

          if (!response.ok) throw new Error('Slug 校验失败。')
          setSlugError(data.available ? null : data.message ?? '该 Slug 已被其他文章使用。')
          if (data.slug && data.slug !== form.slug) {
            setForm((previous) => ({ ...previous, slug: data.slug }))
          }
        } catch (error) {
          if (!controller.signal.aborted) {
            setSlugError(error instanceof Error ? error.message : 'Slug 校验失败。')
          }
        }
      })
    }, 350)

    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [article?.id, form.slug])

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }))
  }

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

      updateField('coverImage', data.media.url)
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

  function createTaxonomy(kind: 'category' | 'tag') {
    const name = (kind === 'category' ? newCategoryName : newTagName).trim()
    if (!name) {
      setMessage(kind === 'category' ? '请输入分类名称。' : '请输入标签名称。')
      return
    }

    startTaxonomyTransition(async () => {
      try {
        const response = await fetch(`/api/admin/${kind === 'category' ? 'categories' : 'tags'}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        })
        const data = (await response.json()) as TaxonomyResponse
        const item = kind === 'category' ? data.category : data.tag

        if (!response.ok || !item) {
          throw new Error(data.error?.message ?? '创建失败。')
        }

        if (kind === 'category') {
          setCategoryOptions((previous) => [...previous, item].sort((left, right) => left.name.localeCompare(right.name, 'zh-CN')))
          updateField('categoryId', item.id)
          setNewCategoryName('')
          setMessage(`已创建并选中分类「${item.name}」。`)
          return
        }

        setTagOptions((previous) => [...previous, item].sort((left, right) => left.name.localeCompare(right.name, 'zh-CN')))
        setSelectedTags((previous) => new Set(previous).add(item.id))
        setNewTagName('')
        setMessage(`已创建并选中标签「${item.name}」。`)
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '创建失败。')
      }
    })
  }

  function submit() {
    setMessage(null)

    if (!form.slug) {
      setSlugError('Slug 必填。')
      return
    }

    if (slugError) {
      setMessage('请先修正 Slug 错误。')
      return
    }

    startTransition(async () => {
      const payload = {
        title: form.title,
        slug: form.slug,
        excerpt: form.excerpt || null,
        contentMarkdown: form.contentMarkdown,
        coverImage: form.coverImage || null,
        status: form.status,
        commentsMode: form.commentsMode,
        categoryId: form.categoryId || null,
        tagIds: [...selectedTags],
        isPinned: form.isPinned,
        publishedAt: fromDateTimeLocal(form.publishedAt),
        expiresAt: fromDateTimeLocal(form.expiresAt),
        metaTitle: form.metaTitle || null,
        metaDescription: form.metaDescription || null,
        metaKeywords: form.metaKeywords || null,
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

        window.location.assign('/admin/articles?saved=1')
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '保存失败。')
      }
    })
  }

  return (
    <form action={submit} className="space-y-7">
      <section className="grid gap-5 rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
        <label className="grid gap-1.5 text-sm font-medium">
          标题
          <input
            name="title"
            value={form.title}
            onChange={(event) => updateField('title', event.target.value)}
            required
            maxLength={200}
            className="h-11 rounded-md border border-neutral-300 bg-white px-3 font-normal outline-none focus:border-blue-600 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-blue-400"
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Slug <span className="font-normal text-neutral-500">（标题变化时自动生成，可手动修改）</span>
          <input
            name="slug"
            value={form.slug}
            onChange={(event) => {
              setSlugTouched(true)
              updateField('slug', event.target.value)
            }}
            required
            maxLength={120}
            aria-invalid={Boolean(slugError)}
            aria-describedby="slug-help"
            className="h-10 rounded-md border border-neutral-300 bg-white px-3 font-mono text-sm font-normal outline-none focus:border-blue-600 aria-invalid:border-red-500 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-blue-400"
          />
          <span id="slug-help" className={`text-xs ${slugError ? 'text-red-600' : 'text-neutral-500'}`}>
            {slugError ?? (isSlugPending ? '正在校验 Slug…' : 'Slug 可用。')}
          </span>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          摘要
          <textarea name="excerpt" value={form.excerpt} onChange={(event) => updateField('excerpt', event.target.value)} rows={3} className="rounded-md border border-neutral-300 bg-white p-3 font-normal outline-none focus:border-blue-600 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-blue-400" />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          头图 URL <span className="font-normal text-neutral-500">（可手填 URL，也可上传或粘贴图片）</span>
          <input name="coverImage" value={form.coverImage} onChange={(event) => updateField('coverImage', event.target.value)} onPaste={handlePaste} maxLength={2048} placeholder="https://example.com/cover.jpg 或粘贴图片" className="h-10 rounded-md border border-neutral-300 bg-white px-3 font-normal outline-none focus:border-blue-600 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-blue-400" />
        </label>
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
        {form.coverImage && <img src={form.coverImage} alt="文章头图预览" className="h-44 w-full rounded-md border border-neutral-200 object-cover dark:border-neutral-800" />}
        <label className="grid gap-1.5 text-sm font-medium">
          正文（Markdown）
          <textarea name="contentMarkdown" value={form.contentMarkdown} onChange={(event) => updateField('contentMarkdown', event.target.value)} required rows={22} className="rounded-md border border-neutral-300 bg-white p-3 font-mono text-sm font-normal leading-6 outline-none focus:border-blue-600 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-blue-400" />
        </label>
      </section>

      <section className="grid gap-5 rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <p className="mb-2 text-sm font-medium">当前组合状态</p>
          <div className="flex flex-wrap gap-2">
            {statusSummary.map((item) => <span key={item} className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">{item}</span>)}
          </div>
        </div>
        <label className="grid gap-1.5 text-sm font-medium">
          发布状态
          <select name="status" value={form.status} onChange={(event) => updateField('status', event.target.value as ArticleStatus)} className="h-10 rounded-md border border-neutral-300 bg-white px-3 font-normal outline-none dark:border-neutral-700 dark:bg-neutral-900">
            <option value="DRAFT">草稿</option>
            <option value="PUBLISHED">发布</option>
            <option value="ARCHIVED">归档</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          评论
          <select name="commentsMode" value={form.commentsMode} onChange={(event) => updateField('commentsMode', event.target.value as ArticleCommentsMode)} className="h-10 rounded-md border border-neutral-300 bg-white px-3 font-normal outline-none dark:border-neutral-700 dark:bg-neutral-900">
            <option value="enabled">允许评论</option>
            <option value="readOnly">关闭新增评论</option>
            <option value="disabled">关闭评论</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          发布时间
          <input type="datetime-local" name="publishedAt" value={form.publishedAt} onChange={(event) => updateField('publishedAt', event.target.value)} className="h-10 rounded-md border border-neutral-300 bg-white px-3 font-normal outline-none dark:border-neutral-700 dark:bg-neutral-900" />
          <span className="text-xs font-normal text-neutral-500">设为未来时间时，文章会在时间到达后公开。</span>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          过期时间
          <input type="datetime-local" name="expiresAt" value={form.expiresAt} onChange={(event) => updateField('expiresAt', event.target.value)} className="h-10 rounded-md border border-neutral-300 bg-white px-3 font-normal outline-none dark:border-neutral-700 dark:bg-neutral-900" />
          <span className="text-xs font-normal text-neutral-500">时间到达后自动从公开页面隐藏。</span>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          分类
          <select name="categoryId" value={form.categoryId} onChange={(event) => updateField('categoryId', event.target.value)} className="h-10 rounded-md border border-neutral-300 bg-white px-3 font-normal outline-none dark:border-neutral-700 dark:bg-neutral-900">
            <option value="">未分类</option>
            {categoryOptions.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        <div className="grid gap-2 text-sm font-medium">
          快速新增分类
          <div className="flex gap-2">
            <input value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="分类名称" className="h-10 min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-3 font-normal outline-none dark:border-neutral-700 dark:bg-neutral-900" />
            <button type="button" onClick={() => createTaxonomy('category')} disabled={isTaxonomyPending} className="rounded-md border border-neutral-300 px-3 text-sm font-medium transition-colors hover:bg-neutral-100 disabled:opacity-60 dark:border-neutral-700 dark:hover:bg-neutral-800">新增</button>
          </div>
        </div>
        <label className="inline-flex items-center gap-2 text-sm font-medium"><input name="isPinned" type="checkbox" checked={form.isPinned} onChange={(event) => updateField('isPinned', event.target.checked)} /> 置顶文章</label>
        <div className="sm:col-span-2">
          <p className="mb-2 text-sm font-medium">标签</p>
          <div className="flex flex-wrap gap-2">{tagOptions.map((tag) => <label key={tag.id} className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"><input type="checkbox" checked={selectedTags.has(tag.id)} onChange={() => toggleTag(tag.id)} /> {tag.name}</label>)}</div>
          <div className="mt-3 flex max-w-md gap-2">
            <input value={newTagName} onChange={(event) => setNewTagName(event.target.value)} placeholder="新增标签名称" className="h-10 min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-3 text-sm outline-none dark:border-neutral-700 dark:bg-neutral-900" />
            <button type="button" onClick={() => createTaxonomy('tag')} disabled={isTaxonomyPending} className="rounded-md border border-neutral-300 px-3 text-sm font-medium transition-colors hover:bg-neutral-100 disabled:opacity-60 dark:border-neutral-700 dark:hover:bg-neutral-800">新增标签</button>
          </div>
        </div>
      </section>

      <details className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
        <summary className="cursor-pointer text-sm font-medium">SEO 设置</summary>
        <div className="mt-5 grid gap-5">
          <label className="grid gap-1.5 text-sm">SEO 标题<input name="metaTitle" value={form.metaTitle} onChange={(event) => updateField('metaTitle', event.target.value)} className="h-10 rounded-md border border-neutral-300 bg-white px-3 outline-none dark:border-neutral-700 dark:bg-neutral-900" /></label>
          <label className="grid gap-1.5 text-sm">SEO 描述<textarea name="metaDescription" value={form.metaDescription} onChange={(event) => updateField('metaDescription', event.target.value)} rows={3} className="rounded-md border border-neutral-300 bg-white p-3 outline-none dark:border-neutral-700 dark:bg-neutral-900" /></label>
          <label className="grid gap-1.5 text-sm">关键词<input name="metaKeywords" value={form.metaKeywords} onChange={(event) => updateField('metaKeywords', event.target.value)} className="h-10 rounded-md border border-neutral-300 bg-white px-3 outline-none dark:border-neutral-700 dark:bg-neutral-900" /></label>
        </div>
      </details>

      <div className="flex items-center gap-4"><button type="submit" disabled={isPending || Boolean(slugError)} className="rounded-md bg-neutral-950 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-950">{isPending ? '正在保存…' : '保存文章'}</button>{message && <p className="text-sm text-neutral-500" role="status">{message}</p>}</div>
    </form>
  )
}
