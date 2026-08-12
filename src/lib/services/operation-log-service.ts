import type { Prisma } from '@prisma/client'

import { ApiError } from '@/lib/api/errors'
import { getPrisma } from '@/lib/prisma'
import { pageMeta, paginate } from '@/lib/services/shared'
import type { OperationLogQuery } from '@/lib/validations/cms'

type OperationActor = {
  id?: string | null
  name?: string | null
  type?: string
}

type OperationMetadata = Prisma.InputJsonObject

type OperationLogInput = {
  actor?: OperationActor | null
  module: string
  action: string
  targetType?: string | null
  targetId?: string | null
  summary: string
  result?: 'SUCCESS' | 'FAILURE'
  error?: unknown
  metadata?: OperationMetadata | null
  request?: Request
}

type LoggedOperationInput<T> = Omit<OperationLogInput, 'summary' | 'targetId' | 'metadata' | 'result' | 'error'> & {
  summary: string | ((result: T) => string)
  targetId?: string | null | ((result: T) => string | null)
  metadata?: OperationMetadata | null | ((result: T) => OperationMetadata | null)
  failureSummary?: string
  failureMetadata?: OperationMetadata | null
}

function resolveOperationValue<T, V>(value: V | ((result: T) => V) | undefined, result: T) {
  return typeof value === 'function' ? (value as (result: T) => V)(result) : value
}

export function adminLogActor(session: { user?: { id?: string | null; name?: string | null } } | null) {
  return {
    id: session?.user?.id ?? null,
    name: session?.user?.name ?? null,
    type: 'admin',
  }
}

function getClientIp(request?: Request) {
  const forwardedFor = request?.headers.get('x-forwarded-for')
  if (forwardedFor) return forwardedFor.split(',')[0]?.trim() ?? null
  return request?.headers.get('x-real-ip') ?? null
}

function normalizeError(error: unknown) {
  if (!error) return { errorCode: null, errorMessage: null }

  if (error instanceof ApiError) {
    return { errorCode: error.code, errorMessage: error.message }
  }

  if (error instanceof Error) {
    return { errorCode: error.name || 'ERROR', errorMessage: error.message }
  }

  return { errorCode: 'UNKNOWN_ERROR', errorMessage: String(error) }
}

function safePath(request?: Request) {
  if (!request) return null

  try {
    const url = new URL(request.url)
    return `${url.pathname}${url.search}`
  } catch {
    return null
  }
}

export async function recordOperationLog(input: OperationLogInput) {
  const { errorCode, errorMessage } = normalizeError(input.error)

  try {
    await getPrisma().operationLog.create({
      data: {
        actorId: input.actor?.id ?? null,
        actorName: input.actor?.name ?? null,
        actorType: input.actor?.type ?? (input.actor ? 'admin' : 'system'),
        module: input.module,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        summary: input.summary,
        result: input.result ?? (input.error ? 'FAILURE' : 'SUCCESS'),
        errorCode,
        errorMessage,
        metadata: input.metadata ?? undefined,
        ipAddress: getClientIp(input.request),
        userAgent: input.request?.headers.get('user-agent') ?? null,
        method: input.request?.method ?? null,
        path: safePath(input.request),
      },
    })
  } catch (logError) {
    console.error('Failed to write operation log.', logError)
  }
}

export async function recordOperation<T>(input: LoggedOperationInput<T>, operation: () => Promise<T>) {
  try {
    const result = await operation()
    await recordOperationLog({
      ...input,
      targetId: resolveOperationValue(input.targetId, result) ?? null,
      summary: resolveOperationValue(input.summary, result) ?? `${input.module}.${input.action}`,
      metadata: resolveOperationValue(input.metadata, result) ?? null,
      result: 'SUCCESS',
    })

    return result
  } catch (error) {
    await recordOperationLog({
      ...input,
      targetId: typeof input.targetId === 'string' ? input.targetId : null,
      summary: input.failureSummary ?? (typeof input.summary === 'string' ? input.summary : `${input.module}.${input.action} failed`),
      metadata: input.failureMetadata ?? null,
      result: 'FAILURE',
      error,
    })
    throw error
  }
}

export async function listOperationLogs(query: OperationLogQuery) {
  const where: Prisma.OperationLogWhereInput = {
    ...(query.module ? { module: query.module } : {}),
    ...(query.result ? { result: query.result } : {}),
    ...(query.q ? {
      OR: [
        { summary: { contains: query.q, mode: 'insensitive' as const } },
        { action: { contains: query.q, mode: 'insensitive' as const } },
        { actorName: { contains: query.q, mode: 'insensitive' as const } },
        { targetId: { contains: query.q, mode: 'insensitive' as const } },
        { errorMessage: { contains: query.q, mode: 'insensitive' as const } },
      ],
    } : {}),
  }

  const [items, total] = await Promise.all([
    getPrisma().operationLog.findMany({
      where,
      ...paginate(query.page, query.pageSize),
      orderBy: { createdAt: 'desc' },
    }),
    getPrisma().operationLog.count({ where }),
  ])

  return {
    items,
    meta: pageMeta(total, query.page, query.pageSize),
  }
}

function escapeCsv(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export async function exportOperationLogsCsv(query: OperationLogQuery) {
  const result = await listOperationLogs({ ...query, page: 1, pageSize: 10000 })
  const rows = [
    ['createdAt', 'result', 'module', 'action', 'actorType', 'actorName', 'summary', 'targetType', 'targetId', 'errorCode', 'errorMessage', 'method', 'path', 'ipAddress', 'userAgent'],
    ...result.items.map((log) => [
      log.createdAt.toISOString(),
      log.result,
      log.module,
      log.action,
      log.actorType,
      log.actorName ?? '',
      log.summary,
      log.targetType ?? '',
      log.targetId ?? '',
      log.errorCode ?? '',
      log.errorMessage ?? '',
      log.method ?? '',
      log.path ?? '',
      log.ipAddress ?? '',
      log.userAgent ?? '',
    ]),
  ]

  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n')
}
