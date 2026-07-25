import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { ApiError } from '@/lib/api/errors'

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

  if (error instanceof Error && error.message === 'Unauthorized') {
    return json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Unauthorized',
        },
      },
      { status: 401 },
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
    return {}
  }
}
