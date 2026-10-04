/**
 * Thin, dependency-free API client for the AccountingSystem .NET API.
 *
 * - Injects the JWT bearer token from the persisted session.
 * - Normalises ASP.NET Core ProblemDetails / validation payloads into ApiError.
 * - Broadcasts 401s so the shell can bounce the user back to the sign-in screen.
 */
import type { AuthSession } from '@/lib/types'

export const SESSION_STORAGE_KEY = 'ledgerly.session'
export const UNAUTHORIZED_EVENT = 'ledgerly:unauthorized'

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '')

export class ApiError extends Error {
  readonly status: number
  readonly fieldErrors?: Record<string, string[]>

  constructor(message: string, status: number, fieldErrors?: Record<string, string[]>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

let sessionCache: AuthSession | null = null

export function readSession(): AuthSession | null {
  if (sessionCache) return sessionCache
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null
    sessionCache = JSON.parse(raw) as AuthSession
    return sessionCache
  } catch {
    return null
  }
}

export function writeSession(session: AuthSession | null) {
  sessionCache = session
  if (session) localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
  else localStorage.removeItem(SESSION_STORAGE_KEY)
}

export function getAccessToken() {
  return readSession()?.token ?? null
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | boolean | null | undefined>
  signal?: AbortSignal
  auth?: boolean
}

function buildUrl(path: string, query?: RequestOptions['query']) {
  const url = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
  if (!query) return url
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    params.append(key, String(value))
  }
  const qs = params.toString()
  return qs ? `${url}?${qs}` : url
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return null
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('json')) {
    const text = await response.text()
    return text.length ? text : null
  }
  try {
    return await response.json()
  } catch {
    return null
  }
}

function extractError(status: number, payload: unknown): ApiError {
  if (typeof payload === 'string' && payload.trim().length) {
    return new ApiError(payload, status)
  }

  if (payload && typeof payload === 'object') {
    const problem = payload as Record<string, unknown>
    const fieldErrors: Record<string, string[]> = {}

    if (problem.errors && typeof problem.errors === 'object') {
      for (const [key, value] of Object.entries(problem.errors as Record<string, unknown>)) {
        const messages = Array.isArray(value) ? value.map(String) : [String(value)]
        fieldErrors[key.charAt(0).toLowerCase() + key.slice(1)] = messages
      }
    }

    const message =
      (typeof problem.error === 'string' && problem.error) ||
      (typeof problem.detail === 'string' && problem.detail) ||
      (typeof problem.title === 'string' && problem.title) ||
      Object.values(fieldErrors).flat()[0] ||
      `Request failed with status ${status}`

    return new ApiError(message, status, Object.keys(fieldErrors).length ? fieldErrors : undefined)
  }

  return new ApiError(`Request failed with status ${status}`, status)
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal, auth = true } = options
  const headers: Record<string, string> = { Accept: 'application/json' }

  if (body !== undefined) headers['Content-Type'] = 'application/json'

  if (auth) {
    const token = getAccessToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  let response: Response
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw error
    throw new ApiError(
      'Cannot reach the API. Is the .NET API running (dotnet run in src/AccountingSystem.Api)?',
      0,
    )
  }

  if (response.status === 401) {
    const error = extractError(401, await parseBody(response))
    if (auth) {
      writeSession(null)
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT, { detail: error.message }))
    }
    throw error
  }

  if (!response.ok) {
    throw extractError(response.status, await parseBody(response))
  }

  return (await parseBody(response)) as T
}

export const api = {
  get: <T>(path: string, query?: RequestOptions['query'], signal?: AbortSignal) =>
    request<T>(path, { method: 'GET', query, signal }),
  post: <T>(path: string, body?: unknown, query?: RequestOptions['query']) =>
    request<T>(path, { method: 'POST', body, query }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string, query?: RequestOptions['query']) =>
    request<T>(path, { method: 'DELETE', query }),
}
