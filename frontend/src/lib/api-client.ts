const rawBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || '/api'

export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '')

export type QueryParamPrimitive = string | number | boolean | null | undefined
export type QueryParamValue =
  | QueryParamPrimitive
  | readonly QueryParamPrimitive[]
export type QueryParams = Record<string, QueryParamValue>

export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  params?: QueryParams
  body?: unknown
}

export class ApiError extends Error {
  readonly status: number
  readonly statusText: string
  readonly detail: unknown

  constructor(
    status: number,
    statusText: string,
    detail: unknown,
    message?: string,
  ) {
    super(
      message ||
        (typeof detail === 'string' && detail.length > 0
          ? detail
          : `Request failed with status ${status} ${statusText}`.trim()),
    )
    this.name = 'ApiError'
    this.status = status
    this.statusText = statusText
    this.detail = detail
  }
}

export function buildQueryString(params?: QueryParams): string {
  if (!params) {
    return ''
  }

  const searchParams = new URLSearchParams()

  for (const [key, rawValue] of Object.entries(params)) {
    if (rawValue === undefined || rawValue === null) {
      continue
    }

    if (Array.isArray(rawValue)) {
      for (const item of rawValue) {
        if (item !== undefined && item !== null) {
          searchParams.append(key, String(item))
        }
      }
      continue
    }

    searchParams.append(key, String(rawValue))
  }

  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

function formatFastApiDetail(detail: unknown): string | undefined {
  if (typeof detail === 'string' && detail.trim().length > 0) {
    return detail
  }

  if (Array.isArray(detail) && detail.length > 0) {
    const messages = detail
      .map((entry) => {
        if (
          entry !== null &&
          typeof entry === 'object' &&
          'msg' in entry &&
          typeof entry.msg === 'string'
        ) {
          return entry.msg
        }
        return null
      })
      .filter((msg): msg is string => msg !== null)

    if (messages.length > 0) {
      return messages.join('; ')
    }
  }

  return undefined
}

function isRawBodyInit(body: unknown): body is BodyInit {
  return (
    typeof body === 'string' ||
    body instanceof Blob ||
    body instanceof FormData ||
    body instanceof URLSearchParams ||
    body instanceof ArrayBuffer ||
    ArrayBuffer.isView(body) ||
    body instanceof ReadableStream
  )
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { params, body, headers: customHeaders, ...requestInit } = options

  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const url = `${API_BASE_URL}${normalizedPath}${buildQueryString(params)}`

  const headers = new Headers(customHeaders)
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json')
  }

  let resolvedBody: BodyInit | undefined
  if (body !== undefined) {
    if (isRawBodyInit(body)) {
      resolvedBody = body
    } else {
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json')
      }
      resolvedBody = JSON.stringify(body)
    }
  }

  const response = await fetch(url, {
    ...requestInit,
    headers,
    body: resolvedBody,
  })

  if (!response.ok) {
    let detail: unknown = null
    let message: string | undefined

    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      try {
        const errorJson: unknown = await response.json()
        if (
          errorJson !== null &&
          typeof errorJson === 'object' &&
          'detail' in errorJson
        ) {
          detail = errorJson.detail
          message = formatFastApiDetail(errorJson.detail)
        } else {
          detail = errorJson
        }
      } catch {
        detail = null
      }
    } else {
      try {
        const errorText = await response.text()
        if (errorText.trim().length > 0) {
          detail = errorText
          message = errorText
        }
      } catch {
        detail = null
      }
    }

    throw new ApiError(response.status, response.statusText, detail, message)
  }

  if (response.status === 204) {
    return undefined as T
  }

  const text = await response.text()
  if (text.trim().length === 0) {
    return undefined as T
  }

  return JSON.parse(text) as T
}
