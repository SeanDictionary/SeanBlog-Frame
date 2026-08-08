'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'

import type { ArticleCommentsMode } from '@/lib/comment-settings'
import { createSlugFromTitle } from '@/lib/content/pinyin-slug'

type ArticleStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
type EditorMode = 'edit' | 'preview' | 'split'

type ArticleRevisionSummary = {
  id: string
  version: number
  title: string
  changeNote: string | null
  createdAt: Date | string
}

type ArticleFormValues = {
  id?: string
  title?: string
  slug?: string
  excerpt?: string | null
  contentMarkdown?: string
  contentHtml?: string
  coverImage?: string | null
  status?: ArticleStatus
  commentsMode?: ArticleCommentsMode
  categoryId?: string | null
  tagIds?: string[]
  isPinned?: boolean
  publishedAt?: Date | string | null
  expiresAt?: Date | string | null
  updatedAt?: Date | string | null
  revisions?: ArticleRevisionSummary[]
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

type PreviewResponse = {
  html?: string
  error?: { message?: string }
}

type RevisionResponse = {
  revision?: ArticleRevisionSummary & { contentMarkdown: string; contentHtml: string }
  error?: { message?: string }
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
  enableScheduledPublish: boolean
  enableScheduledExpire: boolean
  metaTitle: string
  metaDescription: string
  metaKeywords: string
}

type DraftSnapshot = {
  form: FormState
  selectedTags: string[]
  pendingCategoryName?: string
  pendingTagNames?: string[]
  updatedAt: string
}

const statusLabels: Record<ArticleStatus, string> = {
  DRAFT: '草稿',
  PUBLISHED: '发布',
  ARCHIVED: '归档',
}

const COVER_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp'])

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

function formatDateTime(value?: Date | string | null) {
  if (!value) return '暂无记录'

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '暂无记录'

  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
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
    enableScheduledPublish: article?.publishedAt ? new Date(article.publishedAt).getTime() > Date.now() : false,
    enableScheduledExpire: Boolean(article?.expiresAt),
    metaTitle: article?.metaTitle ?? '',
    metaDescription: article?.metaDescription ?? '',
    metaKeywords: article?.metaKeywords ?? '',
  }
}

function getDraftStorageKey(article?: ArticleFormValues) {
  return `seanblog:article-draft:${article?.id ?? 'new'}`
}

function isInputLike(element: Element | null) {
  if (!element) return false
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)
}

export function ArticleEditor({ article, categories, tags }: ArticleEditorProps) {
  const [form, setForm] = useState<FormState>(() => getInitialState(article))
  const [categoryOptions, setCategoryOptions] = useState(categories)
  const [tagOptions, setTagOptions] = useState(tags)
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set(article?.tagIds ?? []))
  const [pendingTagNames, setPendingTagNames] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [slugError, setSlugError] = useState<string | null>(null)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [pendingCategoryName, setPendingCategoryName] = useState('')
  const [tagQuery, setTagQuery] = useState('')
  const [slugTouched, setSlugTouched] = useState(Boolean(article?.slug))
  const [editorMode, setEditorMode] = useState<EditorMode>('split')
  const [previewHtml, setPreviewHtml] = useState(article?.contentHtml ?? '')
  const [previewStatus, setPreviewStatus] = useState('预览会在输入后自动更新。')
  const [pendingDraft, setPendingDraft] = useState<DraftSnapshot | null>(null)
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<Date | null>(null)
  const [dirty, setDirty] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isSlugPending, startSlugTransition] = useTransition()
  const [isRevisionPending, startRevisionTransition] = useTransition()
  const markdownTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const dirtyRef = useRef(false)
  const allowNavigationRef = useRef(false)
  const draftStorageKey = useMemo(() => getDraftStorageKey(article), [article])

  const statusSummary = useMemo(() => {
    const labels = [statusLabels[form.status]]
    const now = Date.now()
    const publishedAt = form.publishedAt ? new Date(form.publishedAt).getTime() : null
    const expiresAt = form.expiresAt ? new Date(form.expiresAt).getTime() : null

    if (form.isPinned) labels.push('置顶')
    if (form.enableScheduledPublish && publishedAt && publishedAt > now) labels.push('定时发布')
    if (form.enableScheduledExpire && expiresAt && expiresAt <= now) labels.push('已过期')
    if (form.enableScheduledExpire && expiresAt && expiresAt > now) labels.push('定时过期')

    return labels
  }, [form.enableScheduledExpire, form.enableScheduledPublish, form.expiresAt, form.isPinned, form.publishedAt, form.status])

  const editorGridClass = editorMode === 'split' ? 'lg:grid-cols-2' : 'lg:grid-cols-1'
  const showEditor = editorMode === 'edit' || editorMode === 'split'
  const showPreview = editorMode === 'preview' || editorMode === 'split'
  const selectedTagItems = useMemo(() => tagOptions.filter((tag) => selectedTags.has(tag.id)), [selectedTags, tagOptions])
  const tagQueryText = tagQuery.trim()
  const tagSuggestions = tagQueryText
    ? tagOptions.filter((tag) => !selectedTags.has(tag.id) && tag.name.toLocaleLowerCase().includes(tagQueryText.toLocaleLowerCase())).slice(0, 6)
    : []
  const recentTags = tagOptions.filter((tag) => !selectedTags.has(tag.id)).slice(0, 8)

  function markDirty() {
    dirtyRef.current = true
    setDirty(true)
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }))
    markDirty()
  }

  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])

  useEffect(() => {
    const rawDraft = window.localStorage.getItem(draftStorageKey)
    if (!rawDraft) return

    try {
      const draft = JSON.parse(rawDraft) as DraftSnapshot
      if (draft?.form?.contentMarkdown || draft?.form?.title) {
        const serverUpdatedAt = article?.updatedAt ? new Date(article.updatedAt).getTime() : 0
        const draftUpdatedAt = new Date(draft.updatedAt).getTime()

        if (!article?.id || draftUpdatedAt > serverUpdatedAt) {
          setPendingDraft(draft)
        }
      }
    } catch {
      window.localStorage.removeItem(draftStorageKey)
    }
  }, [article?.id, article?.updatedAt, draftStorageKey])

  useEffect(() => {
    if (!dirty) return

    const timeout = window.setTimeout(() => {
      const snapshot: DraftSnapshot = {
        form,
        selectedTags: [...selectedTags],
        pendingCategoryName,
        pendingTagNames,
        updatedAt: new Date().toISOString(),
      }

      window.localStorage.setItem(draftStorageKey, JSON.stringify(snapshot))
      setLastDraftSavedAt(new Date(snapshot.updatedAt))
    }, 900)

    return () => window.clearTimeout(timeout)
  }, [dirty, draftStorageKey, form, pendingCategoryName, pendingTagNames, selectedTags])

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

  useEffect(() => {
    if (!showPreview) return

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setPreviewStatus('正在更新预览…')

      try {
        const response = await fetch('/api/admin/articles/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ markdown: form.contentMarkdown }),
          signal: controller.signal,
        })
        const data = (await response.json()) as PreviewResponse

        if (!response.ok || typeof data.html !== 'string') {
          throw new Error(data.error?.message ?? '预览生成失败。')
        }

        setPreviewHtml(data.html)
        setPreviewStatus('预览已更新。')
      } catch (error) {
        if (!controller.signal.aborted) {
          setPreviewStatus(error instanceof Error ? error.message : '预览生成失败。')
        }
      }
    }, 450)

    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [form.contentMarkdown, showPreview])

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirtyRef.current || allowNavigationRef.current) return

      event.preventDefault()
      event.returnValue = ''
    }

    function handleDocumentClick(event: MouseEvent) {
      if (!dirtyRef.current || allowNavigationRef.current) return

      const target = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!target || isInputLike(event.target instanceof Element ? event.target : null)) return
      if (target.getAttribute('target') === '_blank') return

      const href = target.getAttribute('href')
      if (!href || href.startsWith('#')) return

      if (!window.confirm('当前文章有未保存内容，确认离开吗？')) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('click', handleDocumentClick, true)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('click', handleDocumentClick, true)
    }
  }, [])

  function restoreDraft() {
    if (!pendingDraft) return

    setForm(pendingDraft.form)
    setSelectedTags(new Set(pendingDraft.selectedTags))
    setPendingCategoryName(pendingDraft.pendingCategoryName ?? '')
    setPendingTagNames(pendingDraft.pendingTagNames ?? [])
    setLastDraftSavedAt(new Date(pendingDraft.updatedAt))
    setPendingDraft(null)
    markDirty()
    setMessage('已恢复本地自动保存草稿，请检查后保存。')
  }

  function discardDraft() {
    window.localStorage.removeItem(draftStorageKey)
    setPendingDraft(null)
    setMessage('已忽略本地草稿。')
  }

  function addExistingTag(tagId: string) {
    setSelectedTags((previous) => new Set(previous).add(tagId))
    markDirty()
  }

  function removeExistingTag(tagId: string) {
    setSelectedTags((previous) => {
      const next = new Set(previous)
      next.delete(tagId)
      return next
    })
    markDirty()
  }

  function addPendingTag(name: string) {
    const normalized = name.trim()
    if (!normalized) return

    const existing = tagOptions.find((tag) => tag.name.trim().toLocaleLowerCase() === normalized.toLocaleLowerCase())
    if (existing) {
      addExistingTag(existing.id)
      setTagQuery('')
      return
    }

    setPendingTagNames((previous) => previous.some((item) => item.toLocaleLowerCase() === normalized.toLocaleLowerCase()) ? previous : [...previous, normalized])
    setTagQuery('')
    markDirty()
  }

  function removePendingTag(name: string) {
    setPendingTagNames((previous) => previous.filter((item) => item !== name))
    markDirty()
  }

  function commitTagQuery(rawValue = tagQuery) {
    const value = rawValue.trim()
    if (!value) return
    addPendingTag(value)
  }

  function toggleTag(tagId: string) {
    setSelectedTags((previous) => {
      const next = new Set(previous)
      next.has(tagId) ? next.delete(tagId) : next.add(tagId)
      return next
    })
    markDirty()
  }

  async function uploadImage(file: File) {
    if (!file.type.startsWith('image/')) {
      throw new Error('只能上传图片。')
    }

    const formData = new FormData()
    formData.append('file', file)
    const response = await fetch('/api/admin/media/upload', { method: 'POST', body: formData })
    const data = (await response.json()) as UploadResponse

    if (!response.ok || !data.media) {
      throw new Error(data.error?.message ?? '图片上传失败。')
    }

    return data.media.url
  }

  async function uploadCoverImage(file: File) {
    if (!COVER_IMAGE_MIME_TYPES.has(file.type)) {
      setMessage('头图仅支持 png、jpg、jpeg、gif、webp 图片。')
      return
    }

    setMessage('正在上传头图…')

    try {
      const url = await uploadImage(file)
      updateField('coverImage', url)
      setMessage('头图已上传并填入 URL。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '头图上传失败。')
    }
  }

  function handleCoverPaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const file = Array.from(event.clipboardData.files).find((item) => item.type.startsWith('image/'))
    if (!file) return

    event.preventDefault()

    if (!COVER_IMAGE_MIME_TYPES.has(file.type)) {
      setMessage('头图仅支持 png、jpg、jpeg、gif、webp 图片。')
      return
    }

    void uploadCoverImage(file)
  }

  function insertMarkdownAtCursor(markdown: string) {
    const textarea = markdownTextareaRef.current
    const start = textarea?.selectionStart ?? form.contentMarkdown.length
    const end = textarea?.selectionEnd ?? form.contentMarkdown.length
    const nextMarkdown = `${form.contentMarkdown.slice(0, start)}${markdown}${form.contentMarkdown.slice(end)}`

    setForm((previous) => ({ ...previous, contentMarkdown: nextMarkdown }))
    markDirty()

    window.requestAnimationFrame(() => {
      textarea?.focus()
      textarea?.setSelectionRange(start + markdown.length, start + markdown.length)
    })
  }

  function handleMarkdownPaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const file = Array.from(event.clipboardData.files).find((item) => item.type.startsWith('image/'))
    if (!file) return

    event.preventDefault()
    setMessage('正在上传并插入图片…')

    void uploadImage(file)
      .then((url) => {
        const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
        insertMarkdownAtCursor(`![${timestamp}](${url})`)
        setMessage('图片已上传并插入 Markdown。')
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : '图片上传失败。')
      })
  }

  function selectCategory(categoryId: string) {
    setPendingCategoryName('')
    updateField('categoryId', categoryId)
  }

  function stageNewCategory() {
    const name = newCategoryName.trim()
    if (!name) {
      setMessage('请输入分类名称。')
      return
    }

    setPendingCategoryName(name)
    setNewCategoryName('')
    updateField('categoryId', '')
    setMessage(`已选择待创建分类「${name}」，保存文章时才会创建。`)
  }

  async function resolveCategoryIdForSubmit() {
    const name = pendingCategoryName.trim()
    if (!name) return form.categoryId || null

    const existing = categoryOptions.find((category) => category.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())
    if (existing) return existing.id

    const response = await fetch('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const data = (await response.json()) as TaxonomyResponse

    if (!response.ok || !data.category) {
      throw new Error(data.error?.message ?? '创建分类失败。')
    }

    setCategoryOptions((previous) => [...previous, data.category!].sort((left, right) => left.name.localeCompare(right.name, 'zh-CN')))
    setPendingCategoryName('')
    updateField('categoryId', data.category.id)

    return data.category.id
  }

  async function resolveTagIdsForSubmit() {
    const resolvedIds = new Set(selectedTags)

    for (const name of pendingTagNames) {
      const existing = tagOptions.find((tag) => tag.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())
      if (existing) {
        resolvedIds.add(existing.id)
        continue
      }

      const response = await fetch('/api/admin/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = (await response.json()) as TaxonomyResponse

      if (!response.ok || !data.tag) {
        throw new Error(data.error?.message ?? `创建标签「${name}」失败。`)
      }

      resolvedIds.add(data.tag.id)
      setTagOptions((previous) => [...previous, data.tag!].sort((left, right) => left.name.localeCompare(right.name, 'zh-CN')))
    }

    setPendingTagNames([])
    setSelectedTags(resolvedIds)

    return [...resolvedIds]
  }

  function restoreRevision(revisionId: string) {
    if (!article?.id) return

    if (dirtyRef.current && !window.confirm('恢复历史版本会覆盖当前未保存正文，确认继续吗？')) {
      return
    }

    startRevisionTransition(async () => {
      try {
        const response = await fetch(`/api/admin/articles/${article.id}/revisions/${revisionId}`)
        const data = (await response.json()) as RevisionResponse

        if (!response.ok || !data.revision) {
          throw new Error(data.error?.message ?? '读取历史版本失败。')
        }

        setForm((previous) => ({
          ...previous,
          title: data.revision!.title,
          contentMarkdown: data.revision!.contentMarkdown,
        }))
        setPreviewHtml(data.revision.contentHtml)
        markDirty()
        setMessage(`已恢复版本 v${data.revision.version} 到编辑器，请保存后生效。`)
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '读取历史版本失败。')
      }
    })
  }

  function validateSchedule(mode: 'save' | 'publish') {
    const now = Date.now()
    let publishedAt: string | null = null
    let publishTime: number | null = null
    let expiresAt: string | null = null

    if (form.enableScheduledPublish) {
      if (!form.publishedAt) {
        setMessage('开启定时发布后必须填写发布时间。')
        return null
      }

      publishTime = new Date(form.publishedAt).getTime()
      if (Number.isNaN(publishTime) || publishTime <= now) {
        setMessage('定时发布时间必须大于当前时间。')
        return null
      }

      publishedAt = fromDateTimeLocal(form.publishedAt)
    }

    if (form.enableScheduledExpire) {
      if (!form.expiresAt) {
        setMessage('开启定时过期后必须填写过期时间。')
        return null
      }

      const expireTime = new Date(form.expiresAt).getTime()
      if (Number.isNaN(expireTime) || expireTime <= now) {
        setMessage('定时过期时间必须大于当前时间。')
        return null
      }

      if (publishTime && expireTime <= publishTime) {
        setMessage('定时过期时间必须晚于定时发布时间。')
        return null
      }

      expiresAt = fromDateTimeLocal(form.expiresAt)
    }

    return { publishedAt, expiresAt }
  }

  function submit(mode: 'save' | 'publish') {
    setMessage(null)

    if (!form.slug) {
      setSlugError('Slug 必填。')
      return
    }

    if (slugError) {
      setMessage('请先修正 Slug 错误。')
      return
    }

    const schedule = validateSchedule(mode)
    if (!schedule) return

    startTransition(async () => {
      try {
        const categoryId = await resolveCategoryIdForSubmit()
        const tagIds = await resolveTagIdsForSubmit()
        const payload = {
          title: form.title,
          slug: form.slug,
          excerpt: form.excerpt || null,
          contentMarkdown: form.contentMarkdown,
          coverImage: form.coverImage || null,
          status: mode === 'publish' ? 'PUBLISHED' : 'DRAFT',
          commentsMode: form.commentsMode,
          categoryId,
          tagIds,
          isPinned: form.isPinned,
          publishedAt: schedule.publishedAt,
          expiresAt: schedule.expiresAt,
          metaTitle: form.metaTitle || null,
          metaDescription: form.metaDescription || null,
          metaKeywords: form.metaKeywords || null,
        }

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

        window.localStorage.removeItem(draftStorageKey)
        allowNavigationRef.current = true
        dirtyRef.current = false
        setDirty(false)
        window.location.assign('/admin/articles?saved=1')
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '保存失败。')
      }
    })
  }

  return (
    <form onSubmit={(event) => { event.preventDefault(); submit('save') }} className="space-y-7">
      {pendingDraft && (
        <section className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-900/70 dark:bg-blue-950/40 dark:text-blue-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>检测到 {formatDateTime(pendingDraft.updatedAt)} 的本地自动保存草稿。</p>
            <div className="flex gap-2">
              <button type="button" onClick={restoreDraft} className="rounded-md bg-blue-700 px-3 py-1.5 text-white">恢复草稿</button>
              <button type="button" onClick={discardDraft} className="rounded-md border border-blue-300 px-3 py-1.5 dark:border-blue-800">忽略</button>
            </div>
          </div>
        </section>
      )}

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
          头图 URL <span className="font-normal text-neutral-500">（可手填 URL，也可直接在输入框中粘贴图片上传）</span>
          <input name="coverImage" value={form.coverImage} onChange={(event) => updateField('coverImage', event.target.value)} onPaste={handleCoverPaste} maxLength={2048} placeholder="https://example.com/cover.jpg 或粘贴 png/jpg/gif/webp 图片" className="h-10 rounded-md border border-neutral-300 bg-white px-3 font-normal outline-none focus:border-blue-600 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-blue-400" />
          <span className="text-xs font-normal text-neutral-500">支持直接输入图片 URL；粘贴本地图片时仅支持 .png、.jpg、.jpeg、.gif、.webp。</span>
        </label>

        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">正文（Markdown）</p>
              <p className="mt-1 text-xs text-neutral-500">支持实时预览、代码块高亮和粘贴图片自动上传。</p>
            </div>
            <div className="inline-flex rounded-md border border-neutral-300 p-1 dark:border-neutral-700" aria-label="编辑器视图模式">
              {(['edit', 'split', 'preview'] as EditorMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setEditorMode(mode)}
                  className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${editorMode === mode ? 'bg-neutral-950 text-white dark:bg-neutral-100 dark:text-neutral-950' : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'}`}
                >
                  {mode === 'edit' ? '编辑' : mode === 'split' ? '分栏' : '预览'}
                </button>
              ))}
            </div>
          </div>
          <div className={`grid gap-4 ${editorGridClass}`}>
            {showEditor && (
              <textarea
                ref={markdownTextareaRef}
                name="contentMarkdown"
                value={form.contentMarkdown}
                onChange={(event) => updateField('contentMarkdown', event.target.value)}
                onPaste={handleMarkdownPaste}
                required
                rows={24}
                className="min-h-[34rem] rounded-md border border-neutral-300 bg-white p-3 font-mono text-sm font-normal leading-6 outline-none focus:border-blue-600 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-blue-400"
              />
            )}
            {showPreview && (
              <div className="min-h-[34rem] overflow-auto rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
                <p className="mb-4 text-xs text-neutral-500" role="status">{previewStatus}</p>
                {previewHtml ? <div className="article-content" dangerouslySetInnerHTML={{ __html: previewHtml }} /> : <p className="text-sm text-neutral-500">输入 Markdown 后显示预览。</p>}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-5 rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <p className="mb-2 text-sm font-medium">当前组合状态</p>
          <div className="flex flex-wrap gap-2">
            {statusSummary.map((item) => <span key={item} className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">{item}</span>)}
          </div>
        </div>
        <div className="grid gap-3 text-sm font-medium">
          发布控制
          <div className="rounded-md border border-neutral-200 p-4 text-sm text-neutral-500 dark:border-neutral-800">
            文章状态由底部“保存草稿 / 发布文章”按钮控制，归档请在文章列表批量操作中处理。
          </div>
        </div>
        <label className="grid gap-1.5 text-sm font-medium">
          评论
          <select name="commentsMode" value={form.commentsMode} onChange={(event) => updateField('commentsMode', event.target.value as ArticleCommentsMode)} className="h-10 rounded-md border border-neutral-300 bg-white px-3 font-normal outline-none dark:border-neutral-700 dark:bg-neutral-900">
            <option value="enabled">允许评论</option>
            <option value="readOnly">关闭新增评论</option>
            <option value="disabled">关闭评论</option>
          </select>
        </label>
        <div className="grid gap-3 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
          <label className="inline-flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={form.enableScheduledPublish} onChange={(event) => {
              const checked = event.target.checked
              updateField('enableScheduledPublish', checked)
              if (!checked) updateField('publishedAt', '')
            }} />
            定时发布
          </label>
          {form.enableScheduledPublish && (
            <label className="grid gap-1.5 text-sm font-medium">
              发布时间
              <input required type="datetime-local" name="publishedAt" value={form.publishedAt} onChange={(event) => updateField('publishedAt', event.target.value)} className="h-10 rounded-md border border-neutral-300 bg-white px-3 font-normal outline-none dark:border-neutral-700 dark:bg-neutral-900" />
              <span className="text-xs font-normal text-neutral-500">开启后必须填写，且时间必须大于当前时间。</span>
            </label>
          )}
        </div>
        <div className="grid gap-3 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
          <label className="inline-flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={form.enableScheduledExpire} onChange={(event) => {
              const checked = event.target.checked
              updateField('enableScheduledExpire', checked)
              if (!checked) updateField('expiresAt', '')
            }} />
            定时过期
          </label>
          {form.enableScheduledExpire && (
            <label className="grid gap-1.5 text-sm font-medium">
              过期时间
              <input required type="datetime-local" name="expiresAt" value={form.expiresAt} onChange={(event) => updateField('expiresAt', event.target.value)} className="h-10 rounded-md border border-neutral-300 bg-white px-3 font-normal outline-none dark:border-neutral-700 dark:bg-neutral-900" />
              <span className="text-xs font-normal text-neutral-500">开启后必须填写，且必须大于当前时间；如果同时定时发布，则必须晚于发布时间。</span>
            </label>
          )}
        </div>
        <div className="grid gap-3 text-sm font-medium sm:col-span-2">
          分类
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700">
              <input type="radio" name="categoryId" checked={!form.categoryId && !pendingCategoryName} onChange={() => selectCategory('')} />
              未分类
            </label>
            {categoryOptions.map((category) => (
              <label key={category.id} className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700">
                <input type="radio" name="categoryId" checked={form.categoryId === category.id && !pendingCategoryName} onChange={() => selectCategory(category.id)} />
                {category.name}
              </label>
            ))}
            {pendingCategoryName && (
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/40 dark:text-blue-300">
                <input type="radio" name="categoryId" checked readOnly />
                待创建：{pendingCategoryName}
                <button type="button" onClick={() => { setPendingCategoryName(''); markDirty() }} className="text-blue-500 hover:text-blue-800 dark:hover:text-blue-200" aria-label="移除待创建分类">×</button>
              </label>
            )}
          </div>
          <div className="flex max-w-md gap-2">
            <input value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="新增分类名称（保存文章时创建）" className="h-10 min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-3 font-normal outline-none dark:border-neutral-700 dark:bg-neutral-900" />
            <button type="button" onClick={stageNewCategory} className="rounded-md border border-neutral-300 px-3 text-sm font-medium transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800">添加</button>
          </div>
          <p className="text-xs font-normal text-neutral-500">新增分类会先作为待创建项显示，只有保存文章时才写入数据库。</p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm font-medium"><input name="isPinned" type="checkbox" checked={form.isPinned} onChange={(event) => updateField('isPinned', event.target.checked)} /> 置顶文章</label>
        <div className="sm:col-span-2">
          <p className="mb-2 text-sm font-medium">标签</p>
          <div className="flex flex-wrap gap-2">
            {selectedTagItems.map((tag) => (
              <span key={tag.id} className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1.5 text-sm text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                {tag.name}
                <button type="button" onClick={() => removeExistingTag(tag.id)} className="text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-50" aria-label={`移除标签 ${tag.name}`}>×</button>
              </span>
            ))}
            {pendingTagNames.map((name) => (
              <span key={name} className="inline-flex items-center gap-2 rounded-full border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/40 dark:text-blue-300">
                待创建：{name}
                <button type="button" onClick={() => removePendingTag(name)} className="text-blue-500 hover:text-blue-800 dark:hover:text-blue-200" aria-label={`移除待创建标签 ${name}`}>×</button>
              </span>
            ))}
            {selectedTagItems.length === 0 && pendingTagNames.length === 0 && <span className="text-sm text-neutral-500">尚未选择标签。</span>}
          </div>
          <div className="relative mt-3 max-w-xl">
            <input
              value={tagQuery}
              onChange={(event) => setTagQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ',') {
                  event.preventDefault()
                  commitTagQuery(event.currentTarget.value)
                }
              }}
              placeholder="输入标签名称，按回车或逗号确认"
              className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm outline-none dark:border-neutral-700 dark:bg-neutral-900"
            />
            {tagQueryText && (
              <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-md border border-neutral-200 bg-white text-sm shadow-lg dark:border-neutral-800 dark:bg-neutral-950">
                {tagSuggestions.map((tag) => (
                  <button key={tag.id} type="button" onClick={() => { addExistingTag(tag.id); setTagQuery('') }} className="block w-full px-3 py-2 text-left hover:bg-neutral-100 dark:hover:bg-neutral-900">{tag.name}</button>
                ))}
                {!tagOptions.some((tag) => tag.name.trim().toLocaleLowerCase() === tagQueryText.toLocaleLowerCase()) && (
                  <button type="button" onClick={() => addPendingTag(tagQueryText)} className="block w-full px-3 py-2 text-left text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40">创建：{tagQueryText}</button>
                )}
              </div>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-xs text-neutral-500">最近使用</span>
            {recentTags.length > 0 ? recentTags.map((tag) => <button key={tag.id} type="button" onClick={() => addExistingTag(tag.id)} className="rounded-full border border-neutral-300 px-3 py-1 text-xs hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800">{tag.name}</button>) : <span className="text-xs text-neutral-500">暂无可选标签</span>}
          </div>
          <p className="mt-2 text-xs text-neutral-500">新标签会先作为待创建项显示，只有保存文章时才写入数据库。</p>
        </div>
      </section>

      {article?.id && article.revisions && article.revisions.length > 0 && (
        <section className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold">版本管理</h2>
              <p className="mt-1 text-sm text-neutral-500">恢复历史版本会填入编辑器，保存后才会覆盖当前文章。</p>
            </div>
            <span className="text-xs text-neutral-500">共 {article.revisions.length} 个版本</span>
          </div>
          <div className="divide-y divide-neutral-100 dark:divide-neutral-900">
            {article.revisions.slice(0, 8).map((revision) => (
              <div key={revision.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium">v{revision.version} · {revision.title}</p>
                  <p className="mt-1 text-xs text-neutral-500">{formatDateTime(revision.createdAt)}{revision.changeNote ? ` · ${revision.changeNote}` : ''}</p>
                </div>
                <button type="button" disabled={isRevisionPending} onClick={() => restoreRevision(revision.id)} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm transition-colors hover:bg-neutral-100 disabled:opacity-60 dark:border-neutral-700 dark:hover:bg-neutral-800">恢复到编辑器</button>
              </div>
            ))}
          </div>
        </section>
      )}

      <details className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
        <summary className="cursor-pointer text-sm font-medium">SEO 设置</summary>
        <div className="mt-5 grid gap-5">
          <label className="grid gap-1.5 text-sm">SEO 标题<input name="metaTitle" value={form.metaTitle} onChange={(event) => updateField('metaTitle', event.target.value)} className="h-10 rounded-md border border-neutral-300 bg-white px-3 outline-none dark:border-neutral-700 dark:bg-neutral-900" /></label>
          <label className="grid gap-1.5 text-sm">SEO 描述<textarea name="metaDescription" value={form.metaDescription} onChange={(event) => updateField('metaDescription', event.target.value)} rows={3} className="rounded-md border border-neutral-300 bg-white p-3 outline-none dark:border-neutral-700 dark:bg-neutral-900" /></label>
          <label className="grid gap-1.5 text-sm">关键词<input name="metaKeywords" value={form.metaKeywords} onChange={(event) => updateField('metaKeywords', event.target.value)} className="h-10 rounded-md border border-neutral-300 bg-white px-3 outline-none dark:border-neutral-700 dark:bg-neutral-900" /></label>
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={isPending || Boolean(slugError)} className="rounded-md border border-neutral-300 px-5 py-2.5 text-sm font-medium disabled:opacity-60 dark:border-neutral-700">保存草稿</button>
        <button type="button" onClick={() => submit('publish')} disabled={isPending || Boolean(slugError)} className="rounded-md bg-neutral-950 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-950">{isPending ? '正在保存…' : '发布文章'}</button>
        <div className="text-sm text-neutral-500" role="status">
          <p>{message ?? (dirty ? '有未保存内容。' : '没有未保存内容。')}</p>
          <p className="mt-1 text-xs">最近数据库保存：{formatDateTime(article?.updatedAt)} · 本地草稿保存：{formatDateTime(lastDraftSavedAt)}</p>
        </div>
      </div>
    </form>
  )
}
