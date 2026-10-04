/**
 * Installs an in-browser fetch interceptor that serves the AccountingSystem API
 * from memory. Activated with `npm run dev:mock` (VITE_USE_MOCK=true) so the UI
 * can be explored without the .NET runtime.
 */
import { MockHttpError, seed, store, type User } from '@/mocks/db'
import { routes, type MockContext, type MockRoute } from '@/mocks/handlers'

function matchRoute(method: string, pathname: string): { route: MockRoute; params: Record<string, string> } | null {
  const requestSegments = pathname.split('/').filter(Boolean)

  for (const route of routes) {
    if (route.method !== method) continue
    const routeSegments = route.pattern.split('/').filter(Boolean)
    if (routeSegments.length !== requestSegments.length) continue

    const params: Record<string, string> = {}
    let matched = true
    for (let index = 0; index < routeSegments.length; index += 1) {
      const routeSegment = routeSegments[index]
      const requestSegment = requestSegments[index]
      if (routeSegment.startsWith(':')) {
        params[routeSegment.slice(1)] = decodeURIComponent(requestSegment)
      } else if (routeSegment.toLowerCase() !== requestSegment.toLowerCase()) {
        matched = false
        break
      }
    }
    if (matched) return { route, params }
  }
  return null
}

function currentUser(headers: Headers): User | null {
  const header = headers.get('Authorization') ?? headers.get('authorization')
  if (!header?.startsWith('Bearer ')) return null
  const token = header.slice(7)
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const payload = JSON.parse(atob(parts[1])) as { sub: string; exp: number }
    if (payload.exp && payload.exp < Date.now()) return null
    return store.users.find((user) => user.id === payload.sub) ?? null
  } catch {
    return null
  }
}

function jsonResponse(body: unknown, status = 200) {
  if (status === 204 || body === null || body === undefined) {
    return new Response(null, { status: status === 200 ? 204 : status })
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

const latency = () => 110 + Math.random() * 240

let installed = false

export function installMockApi() {
  if (installed) return
  installed = true

  seed()

  const originalFetch = window.fetch.bind(window)

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === 'string'
        ? new URL(input, window.location.origin)
        : input instanceof URL
          ? input
          : new URL(input.url, window.location.origin)

    // Only intercept our own API surface — assets, HMR, etc. pass through.
    if (!url.pathname.includes('/api/')) {
      return originalFetch(input as RequestInfo, init)
    }

    const apiPath = url.pathname.slice(url.pathname.indexOf('/api/') + 4)
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))

    let body: any = undefined
    const rawBody = init?.body
    if (typeof rawBody === 'string' && rawBody.length) {
      try {
        body = JSON.parse(rawBody)
      } catch {
        body = undefined
      }
    }

    await new Promise((resolve) => setTimeout(resolve, latency()))

    const match = matchRoute(method, apiPath)
    if (!match) {
      return jsonResponse({ error: `Mock API has no handler for ${method} ${apiPath}` }, 404)
    }

    const user = currentUser(headers)
    if (match.route.auth !== false && !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const context: MockContext = {
      params: match.params,
      query: url.searchParams,
      body,
      user: (user ?? store.users[0]) as User,
    }

    try {
      const result = match.route.handler(context)
      return jsonResponse(result)
    } catch (error) {
      if (error instanceof MockHttpError) {
        return jsonResponse(error.payload ?? { error: error.message }, error.status)
      }
      console.error('[mock-api]', method, apiPath, error)
      return jsonResponse({ error: (error as Error).message ?? 'Mock API failure.' }, 500)
    }
  }

  // eslint-disable-next-line no-console
  console.info(
    '%c[mock-api]%c Serving the AccountingSystem API from memory. Sign in with admin@demo.local / Admin@12345.',
    'background:#0f172a;color:#fff;padding:2px 6px;border-radius:4px',
    'color:inherit',
  )
}

export const MOCK_CREDENTIALS = [
  { email: 'admin@demo.local', password: 'Admin@12345', role: 'Admin' },
  { email: 'accountant@demo.local', password: 'Accountant@123', role: 'Accountant' },
  { email: 'arclerk@demo.local', password: 'ArClerk@1234', role: 'ARClerk' },
  { email: 'apclerk@demo.local', password: 'ApClerk@1234', role: 'APClerk' },
  { email: 'viewer@demo.local', password: 'Viewer@1234', role: 'Viewer' },
]
