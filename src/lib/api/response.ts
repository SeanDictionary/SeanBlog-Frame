import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { ApiError } from '@/lib/api/errors'
import { getDatabaseErrorCode, isDatabaseError } from '@/lib/database-errors'

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init)
}

export function created(data: unknown) {
  return json(data, { status: 201 })
}

export function noContent() {
  return new NextResponse(null, { status: 204 })
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return json(
      {
        error: {
          code: error.code,
          message: error.message,
        },
      },
      { status: error.status },
    )
  }

  if (error instanceof ZodError) {
    return json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed.',
          issues: error.issues,
        },
      },
      { status: 400 },
    )
  }

  if (isDatabaseError(error)) {
    console.error(error)

    return json(
      {
        error: {
          code: getDatabaseErrorCode(error),
          message: 'Database is unavailable. Check the PostgreSQL container and DATABASE_URL.',
        },
      },
      { status: 503 },
    )
  }

  console.error(error)

  return json(
    {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error.',
      },
    },
    { status: 500 },
  )
}

export async function parseJson(request: Request) {
  try {
    return await request.json()
  } catch {
    throw new ApiError('Request body must be valid JSON.', 400, 'INVALID_JSON')
  }
}
