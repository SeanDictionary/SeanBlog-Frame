export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code = 'BAD_REQUEST',
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function notFound(message = 'Resource not found') {
  return new ApiError(message, 404, 'NOT_FOUND')
}

export function conflict(message = 'Resource already exists') {
  return new ApiError(message, 409, 'CONFLICT')
}

export function unauthorized(message = 'Unauthorized') {
  return new ApiError(message, 401, 'UNAUTHORIZED')
}

export function badRequest(message = 'Bad request', code = 'BAD_REQUEST') {
  return new ApiError(message, 400, code)
}

export function forbidden(message = 'Forbidden') {
  return new ApiError(message, 403, 'FORBIDDEN')
}
