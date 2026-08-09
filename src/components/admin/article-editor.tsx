'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'

import Link from 'next/link'

import { useAdminToast } from '@/components/admin/admin-toast-provider'
import type { ArticleCommentsMode } from '@/lib/comment-settings'
import { createSlugFromTitle } from '@/lib/content/pinyin-slug'

type ArticleStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
type EditorMode = 'edit' | 'preview'

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
  description?: string | null
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
  enableScheduledPublish: boolean
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
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const URL_PATTERN = /^https?:\/\/|^\//

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
    enableScheduledPublish: article?.publishedAt ? new Date(article.publishedAt).getTime() > Date.now() : false,
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

function EditorAccordionSection({ title, summary, defaultOpen = false, children }: { title: string; summary?: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className="border-t border-neutral-200 first:border-t-0 dark:border-neutral-800">
      <button type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 py-4 text-left text-sm font-medium">
        <span className="mt-1 text-lg font-semibold">{title}</span>
        <span className="ml-auto text-xs font-normal text-neutral-400">{summary}</span>
        <i className={`fa-solid fa-chevron-down text-[10px] text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div className="grid gap-4 pb-5 text-sm">
          {children}
        </div>
      )}
    </section>
  )
}

export function ArticleEditor({ article, categories, tags }: ArticleEditorProps) {
  const [form, setForm] = useState<FormState>(() => getInitialState(article))
  const toast = useAdminToast()
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
  const [editorMode, setEditorMode] = useState<EditorMode>('edit')
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

    if (form.isPinned) labels.push('置顶')
    if (form.enableScheduledPublish && publishedAt && publishedAt > now) labels.push('定时发布')

    return labels
  }, [form.enableScheduledPublish, form.isPinned, form.publishedAt, form.status])

  const showPreview = editorMode === 'preview'
  const selectedTagItems = useMemo(() => tagOptions.filter((tag) => selectedTags.has(tag.id)), [selectedTags, tagOptions])
  const tagQueryText = tagQuery.trim()
  const tagSuggestions = tagQueryText
    ? tagOptions.filter((tag) => !selectedTags.has(tag.id) && tag.name.toLocaleLowerCase().includes(tagQueryText.toLocaleLowerCase())).slice(0, 6)
    : []
  const recentTags = tagOptions.filter((tag) => !selectedTags.has(tag.id)).slice(0, 8)

  function showInfo(message: string) {
    setMessage(message)
    toast.info(message)
  }

  function showSuccess(message: string) {
    setMessage(message)
    toast.success(message)
  }

  function showError(message: string) {
    setMessage(message)
    toast.error(message)
  }

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
    const textarea = markdownTextareaRef.current
    if (!textarea || showPreview) return

    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [form.contentMarkdown, showPreview])

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
    window.history.pushState({ articleEditorGuard: true }, '', window.location.href)

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

    function handlePopState() {
      if (!dirtyRef.current || allowNavigationRef.current) {
        allowNavigationRef.current = true
        window.history.back()
        return
      }

      if (window.confirm('当前文章有未保存内容，确认离开吗？')) {
        allowNavigationRef.current = true
        window.history.back()
        return
      }

      window.history.pushState({ articleEditorGuard: true }, '', window.location.href)
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('popstate', handlePopState)
    document.addEventListener('click', handleDocumentClick, true)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('popstate', handlePopState)
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
    showSuccess('已恢复本地自动保存草稿，请检查后保存。')
  }

  function discardDraft() {
    window.localStorage.removeItem(draftStorageKey)
    setPendingDraft(null)
    showInfo('已忽略本地草稿。')
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
      showError('头图仅支持 png、jpg、jpeg、gif、webp 图片。')
      return
    }

    showInfo('正在上传头图…')

    try {
      const url = await uploadImage(file)
      updateField('coverImage', url)
      showSuccess('头图已上传并填入 URL。')
    } catch (error) {
      showError(error instanceof Error ? error.message : '头图上传失败。')
    }
  }

  function handleCoverPaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const file = Array.from(event.clipboardData.files).find((item) => item.type.startsWith('image/'))
    if (!file) return

    event.preventDefault()

    if (!COVER_IMAGE_MIME_TYPES.has(file.type)) {
      showError('头图仅支持 png、jpg、jpeg、gif、webp 图片。')
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
    showInfo('正在上传并插入图片…')

    void uploadImage(file)
      .then((url) => {
        const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
        insertMarkdownAtCursor(`![${timestamp}](${url})`)
        showSuccess('图片已上传并插入 Markdown。')
      })
      .catch((error) => {
        showError(error instanceof Error ? error.message : '图片上传失败。')
      })
  }

  function selectCategory(categoryId: string) {
    setPendingCategoryName('')
    updateField('categoryId', categoryId)
  }

  function stageNewCategory() {
    const name = newCategoryName.trim()
    if (!name) {
      showError('请输入分类名称。')
      return
    }

    setPendingCategoryName(name)
    setNewCategoryName('')
    updateField('categoryId', '')
    showInfo(`已选择待创建分类「${name}」，保存文章时才会创建。`)
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
        showSuccess(`已恢复 ${formatDateTime(data.revision.createdAt)} 的历史版本到编辑器，请保存后生效。`)
      } catch (error) {
        showError(error instanceof Error ? error.message : '读取历史版本失败。')
      }
    })
  }

  function parseLocalDateTime(value: string, label: string) {
    const timestamp = new Date(value).getTime()

    if (!value || Number.isNaN(timestamp)) {
      showError(`${label}格式无效，请重新选择。`)
      return null
    }

    return timestamp
  }

  function validateRequiredFields() {
    const title = form.title.trim()
    const slug = form.slug.trim()
    const markdown = form.contentMarkdown.trim()
    const coverImage = form.coverImage.trim()

    if (!title) {
      showError('标题不能为空，请先填写文章标题。')
      return false
    }

    if (title.length > 200) {
      showError('标题不能超过 200 个字符。')
      return false
    }

    if (!slug) {
      setSlugError('Slug 必填。')
      showError('Slug 不能为空，请先填写或根据标题生成 Slug。')
      return false
    }

    if (!SLUG_PATTERN.test(slug)) {
      setSlugError('Slug 只能包含小写字母、数字和连字符。')
      showError('Slug 格式无效，只能包含小写字母、数字和连字符，且不能以连字符开头或结尾。')
      return false
    }

    if (isSlugPending) {
      showError('Slug 正在校验，请稍后再保存。')
      return false
    }

    if (slugError) {
      showError(slugError)
      return false
    }

    if (!markdown) {
      showError('正文不能为空，请先填写文章内容。')
      return false
    }

    if (coverImage && !URL_PATTERN.test(coverImage)) {
      showError('头图 URL 格式无效，请输入 http(s) 链接或站内 /uploads 路径。')
      return false
    }

    return true
  }

  function validateSchedule(mode: 'save' | 'publish') {
    const now = Date.now()
    let publishedAt: string | null = null
    let publishTime: number | null = null

    if (form.enableScheduledPublish) {
      if (!form.publishedAt) {
        showError('开启定时发布后必须填写发布时间。')
        return null
      }

      publishTime = parseLocalDateTime(form.publishedAt, '定时发布时间')
      if (publishTime === null) return null

      if (publishTime <= now) {
        showError('定时发布时间必须大于当前时间。')
        return null
      }

      publishedAt = fromDateTimeLocal(form.publishedAt)
    }
    return { publishedAt }
  }

  function submit(mode: 'save' | 'publish') {
    setMessage(null)

    if (!validateRequiredFields()) return

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
        showError(error instanceof Error ? error.message : '保存失败。')
      }
    })
  }

  return (
    <form noValidate onSubmit={(event) => { event.preventDefault(); submit('save') }} className="-m-8 min-h-screen bg-neutral-50 text-neutral-950 dark:bg-neutral-900 dark:text-neutral-50 lg:-m-12 lg:h-screen lg:overflow-hidden">
      <div className="fixed right-4 top-4 z-40 flex flex-wrap items-center justify-end gap-2 rounded-full p-1.5 lg:right-84">
        <div className="inline-flex rounded-full border border-neutral-300 bg-white/70 p-1 text-xs dark:border-neutral-700 dark:bg-neutral-950/70" aria-label="编辑器视图模式">
          {(['edit', 'preview'] as EditorMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setEditorMode(mode)}
              className={`rounded-full px-3 py-1.5 font-medium transition-colors ${editorMode === mode ? 'bg-neutral-950 text-white dark:bg-neutral-100 dark:text-neutral-950' : 'text-neutral-600 hover:text-neutral-950 dark:text-neutral-300 dark:hover:text-neutral-50'}`}
            >
              {mode === 'edit' ? '编辑' : '预览'}
            </button>
          ))}
        </div>
        <button type="submit" disabled={isPending} className="rounded-full border border-neutral-300 bg-white/70 px-4 py-2 text-sm font-medium transition-colors hover:bg-white disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950/70 dark:hover:bg-neutral-900">保存草稿</button>
        <button type="button" onClick={() => submit('publish')} disabled={isPending} className="rounded-full bg-neutral-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-950 dark:hover:bg-neutral-300">{isPending ? '正在保存…' : '发布文章'}</button>
      </div>

      <main className="min-h-screen lg:mr-80 lg:h-screen lg:overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl px-6 pb-8 pt-24 sm:px-10 lg:px-14 lg:pb-10 lg:pt-10">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <Link href="/admin/articles" className="text-sm text-neutral-500 transition-colors hover:text-neutral-950 dark:hover:text-neutral-50">
              ← 返回文章列表
            </Link>
          </div>

          {pendingDraft && (
            <section className="mb-8 rounded-2xl border border-blue-200 bg-blue-50/80 p-4 text-sm text-blue-800 dark:border-blue-900/70 dark:bg-blue-950/40 dark:text-blue-200">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p>检测到 {formatDateTime(pendingDraft.updatedAt)} 的本地自动保存草稿。</p>
                <div className="flex gap-2">
                  <button type="button" onClick={restoreDraft} className="rounded-full bg-blue-700 px-3 py-1.5 text-white">恢复草稿</button>
                  <button type="button" onClick={discardDraft} className="rounded-full border border-blue-300 px-3 py-1.5 dark:border-blue-800">忽略</button>
                </div>
              </div>
            </section>
          )}

          <input
            name="title"
            value={form.title}
            onChange={(event) => updateField('title', event.target.value)}
            required
            maxLength={200}
            placeholder="文章标题"
            className="w-full border-0 bg-transparent px-0 text-4xl font-semibold tracking-tight text-neutral-950 outline-none placeholder:text-neutral-300 focus:ring-0 dark:text-neutral-50 dark:placeholder:text-neutral-700 sm:text-5xl lg:text-6xl"
          />

          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-neutral-500" role="status">
            <span>{message ?? (dirty ? '有未保存内容。' : '没有未保存内容。')}</span>
            <span className="hidden text-neutral-300 dark:text-neutral-700 sm:inline">/</span>
            <span>最近数据库保存：{formatDateTime(article?.updatedAt)}</span>
            <span className="hidden text-neutral-300 dark:text-neutral-700 sm:inline">/</span>
            <span>本地草稿保存：{formatDateTime(lastDraftSavedAt)}</span>
          </div>

          <section className="mt-10 grid min-h-[calc(100vh-20rem)]">
            <div className={`col-start-1 row-start-1 min-h-[calc(100vh-20rem)] bg-transparent pb-24 transition-all duration-300 ease-out ${showPreview ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'}`} aria-hidden={!showPreview}>
              <p className="mb-6 text-xs text-neutral-500" role="status">{previewStatus}</p>
              {previewHtml ? <div className="article-content" dangerouslySetInnerHTML={{ __html: previewHtml }} /> : <p className="text-sm text-neutral-500">输入 Markdown 后显示预览。</p>}
            </div>
            <textarea
              ref={markdownTextareaRef}
              name="contentMarkdown"
              value={form.contentMarkdown}
              onChange={(event) => updateField('contentMarkdown', event.target.value)}
              onPaste={handleMarkdownPaste}
              required
              rows={1}
              placeholder="从这里开始写正文…"
              className={`col-start-1 row-start-1 min-h-[calc(100vh-20rem)] w-full resize-none overflow-hidden border-0 bg-transparent px-0 pb-24 font-mono text-base font-normal leading-8 text-neutral-900 outline-none placeholder:text-neutral-300 transition-all duration-300 ease-out focus:ring-0 dark:text-neutral-100 dark:placeholder:text-neutral-700 ${showPreview ? 'pointer-events-none -translate-y-3 opacity-0' : 'translate-y-0 opacity-100'}`}
              aria-hidden={showPreview}
              tabIndex={showPreview ? -1 : undefined}
            />
          </section>
        </div>
      </main>

      <aside className="border-t border-neutral-200 bg-neutral-50/95 dark:border-neutral-800 dark:bg-neutral-950/95 lg:fixed lg:right-0 lg:top-0 lg:z-20 lg:h-screen lg:w-80 lg:overflow-hidden lg:border-l lg:border-t-0">
        <div className="sticky top-0 z-10 border-b border-neutral-200 bg-neutral-50/95 px-4 py-5 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
          <p className="text-xs uppercase tracking-[0.24em] text-neutral-400">Article settings</p>
          <div className="flex items-center justify-between gap-3">
            <h2 className="mt-1 text-xl font-semibold">文章设置</h2>
            <span className="rounded-full bg-neutral-100 px-2 py-1 text-sm text-neutral-500 dark:bg-neutral-900">{statusSummary.join(' / ')}</span>
          </div>
        </div>
        <div className="px-4 pb-5 lg:h-[calc(100vh-5.5rem)] lg:overflow-y-auto">

          <EditorAccordionSection title="发布" summary="状态、评论、定时" defaultOpen>
            <label className="grid gap-1.5 text-sm font-medium">
              评论
              <select name="commentsMode" value={form.commentsMode} onChange={(event) => updateField('commentsMode', event.target.value as ArticleCommentsMode)} className="h-10 rounded-md border border-neutral-300 bg-white px-3 font-normal outline-none dark:border-neutral-700 dark:bg-neutral-900">
                <option value="enabled">允许评论</option>
                <option value="readOnly">关闭新增评论</option>
                <option value="disabled">关闭评论</option>
              </select>
            </label>
            <label className="inline-flex items-center gap-2 text-sm font-medium"><input name="isPinned" type="checkbox" checked={form.isPinned} onChange={(event) => updateField('isPinned', event.target.checked)} /> 置顶文章</label>
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
                <div className="flex items-center gap-1">
                  发布时间<span className="text-xs font-normal text-neutral-500">（必填）</span>
                </div>
                <input required type="datetime-local" name="publishedAt" value={form.publishedAt} onChange={(event) => updateField('publishedAt', event.target.value)} className="h-10 rounded-md border border-neutral-300 bg-white px-3 font-normal outline-none dark:border-neutral-700 dark:bg-neutral-900" />
              </label>
            )}
          </EditorAccordionSection>

          <EditorAccordionSection title="基础信息" summary="Slug、摘要、头图" defaultOpen>
            <label className="grid gap-1.5 text-sm font-medium">
              <div className="flex items-center gap-1">
                Slug <span className="font-normal text-neutral-500">（自动生成）</span>
              </div>
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
              <div className="flex items-center gap-1">
                摘要 <span className="font-normal text-neutral-500">（可选）</span>
              </div>
              <textarea name="excerpt" value={form.excerpt} onChange={(event) => updateField('excerpt', event.target.value)} rows={3} className="rounded-md border border-neutral-300 bg-white p-3 font-normal outline-none focus:border-blue-600 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-blue-400" />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              <div className="flex items-center gap-1">
                文章头图<span className="font-normal text-neutral-500">（填写url或粘贴图片）</span>
              </div>
              <input name="coverImage" value={form.coverImage} onChange={(event) => updateField('coverImage', event.target.value)} onPaste={handleCoverPaste} maxLength={2048} placeholder="https://xxx.com/xxx.jpg 或 粘贴图片" className="h-10 rounded-md border border-neutral-300 bg-white px-3 font-normal outline-none focus:border-blue-600 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-blue-400" />
            </label>
          </EditorAccordionSection>

          <EditorAccordionSection title="分类与标签" summary="选择分类、标签" defaultOpen>
            <div className="grid gap-3 text-sm font-medium">
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
                    新建：{pendingCategoryName}
                    <button type="button" onClick={() => { setPendingCategoryName(''); markDirty() }} className="text-blue-500 hover:text-blue-800 dark:hover:text-blue-200" aria-label="移除待创建分类">×</button>
                  </label>
                )}
              </div>
              <input
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    stageNewCategory()
                  }
                }}
                placeholder="新增分类，回车确认"
                className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 font-normal outline-none dark:border-neutral-700 dark:bg-neutral-900"
              />
            </div>
            <div>
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
                    新建：{name}
                    <button type="button" onClick={() => removePendingTag(name)} className="text-blue-500 hover:text-blue-800 dark:hover:text-blue-200" aria-label={`移除待创建标签 ${name}`}>×</button>
                  </span>
                ))}
                {selectedTagItems.length === 0 && pendingTagNames.length === 0 && <span className="text-sm text-neutral-500">尚未选择标签。</span>}
              </div>
              <div className="relative mt-3">
                <input
                  value={tagQuery}
                  onChange={(event) => setTagQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      commitTagQuery(event.currentTarget.value)
                    }
                  }}
                  placeholder="输入标签名称，回车确认"
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
                {recentTags.length > 0 ? recentTags.map((tag) => <button key={tag.id} type="button" onClick={() => addExistingTag(tag.id)} className="rounded-full border border-neutral-300 px-3 py-1 text-xs hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800">{tag.name}</button>) : <span className="text-xs text-neutral-500">暂无可选标签</span>}
              </div>
            </div>
          </EditorAccordionSection>

          <EditorAccordionSection title="SEO" summary="标题、描述、关键词">
            <label className="grid gap-1.5 text-sm">SEO 标题<input name="metaTitle" value={form.metaTitle} onChange={(event) => updateField('metaTitle', event.target.value)} className="h-10 rounded-md border border-neutral-300 bg-white px-3 outline-none dark:border-neutral-700 dark:bg-neutral-900" /></label>
            <label className="grid gap-1.5 text-sm">SEO 描述<textarea name="metaDescription" value={form.metaDescription} onChange={(event) => updateField('metaDescription', event.target.value)} rows={3} className="rounded-md border border-neutral-300 bg-white p-3 outline-none dark:border-neutral-700 dark:bg-neutral-900" /></label>
            <label className="grid gap-1.5 text-sm">关键词<input name="metaKeywords" value={form.metaKeywords} onChange={(event) => updateField('metaKeywords', event.target.value)} className="h-10 rounded-md border border-neutral-300 bg-white px-3 outline-none dark:border-neutral-700 dark:bg-neutral-900" /></label>
          </EditorAccordionSection>

          {article?.id && article.revisions && article.revisions.length > 0 && (
            <EditorAccordionSection title="版本管理" summary={`共 ${article.revisions.length} 条`}>
              <div className="max-h-72 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-900">
                {article.revisions.map((revision) => (
                  <div key={revision.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                    <div>
                      <p className="font-medium">{formatDateTime(revision.createdAt)}</p>
                      {revision.changeNote && <p className="mt-1 text-xs text-neutral-500">{revision.changeNote}</p>}
                    </div>
                    <button type="button" disabled={isRevisionPending} onClick={() => restoreRevision(revision.id)} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm transition-colors hover:bg-neutral-100 disabled:opacity-60 dark:border-neutral-700 dark:hover:bg-neutral-800">恢复</button>
                  </div>
                ))}
              </div>
            </EditorAccordionSection>
          )}
        </div>
      </aside>
    </form>
  )
}
