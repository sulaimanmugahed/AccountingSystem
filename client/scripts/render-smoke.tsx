/**
 * Development smoke test that renders every route of the client against the
 * in-browser mock API using jsdom. Catches render-time crashes (bad imports,
 * Radix misuse, undefined data shapes) without needing a browser.
 *
 * Run with:  npm run render:smoke      (requires jsdom, installed with --no-save)
 */
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:5173/',
  pretendToBeVisual: true,
})

// jsdom ships no fetch implementation. Wire Node's fetch underneath the mock layer:
// installMockApi() patches `window.fetch`, and the app's bare `fetch(...)` calls are
// routed to that same patched function below.
const domWindow = dom.window as any
const nodeFetch = (globalThis as any).fetch.bind(globalThis)
domWindow.fetch = nodeFetch
domWindow.Response = (globalThis as any).Response
domWindow.Headers = (globalThis as any).Headers
domWindow.Request = (globalThis as any).Request
domWindow.btoa = (value: string) => Buffer.from(value, 'binary').toString('base64')
domWindow.atob = (value: string) => Buffer.from(value, 'base64').toString('binary')

const globalAny = globalThis as any

// Mirror the jsdom DOM globals (HTMLFormElement, HTMLInputElement, …) onto globalThis;
// React DOM and react-hook-form look them up there.
for (const key of Object.getOwnPropertyNames(dom.window)) {
  if (key in globalAny) continue
  try {
    globalAny[key] = (dom.window as any)[key]
  } catch {
    /* ignore read-only globals */
  }
}

globalAny.window = dom.window
globalAny.document = dom.window.document
Object.defineProperty(globalAny, 'navigator', { value: dom.window.navigator, configurable: true, writable: true })
globalAny.HTMLElement = dom.window.HTMLElement
globalAny.Element = dom.window.Element
globalAny.Node = dom.window.Node
globalAny.Event = dom.window.Event
globalAny.CustomEvent = dom.window.CustomEvent
globalAny.MouseEvent = dom.window.MouseEvent
globalAny.KeyboardEvent = dom.window.KeyboardEvent
globalAny.PointerEvent = dom.window.PointerEvent ?? dom.window.MouseEvent
globalAny.getComputedStyle = dom.window.getComputedStyle
globalAny.requestAnimationFrame = (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 0)
globalAny.cancelAnimationFrame = (handle: number) => clearTimeout(handle)
globalAny.localStorage = dom.window.localStorage
globalAny.fetch = (...args: any[]) => (globalAny.window.fetch as any)(...args)
globalAny.IS_REACT_ACT_ENVIRONMENT = true

if (!dom.window.matchMedia) {
  dom.window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as any
}
globalAny.matchMedia = dom.window.matchMedia

// jsdom omits a few layout APIs Radix uses.
;(dom.window.Element.prototype as any).scrollIntoView = () => {}
;(dom.window.Element.prototype as any).hasPointerCapture = () => false
;(dom.window.Element.prototype as any).releasePointerCapture = () => {}

class Observer {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}
globalAny.ResizeObserver = Observer
globalAny.IntersectionObserver = Observer
globalAny.MutationObserver = dom.window.MutationObserver

let reactModule: any = null

async function main() {
  const React = await import('react')
  reactModule = React
  const { createRoot } = await import('react-dom/client')
  const { act } = await import('react')
  const { QueryClientProvider } = await import('@tanstack/react-query')
  const { MemoryRouter } = await import('react-router-dom')
  const { queryClient } = await import('../src/lib/query-client')
  const { AuthProvider } = await import('../src/lib/auth')
  const { ThemeProvider } = await import('../src/lib/theme')
  const { TooltipProvider } = await import('../src/components/ui/tooltip')
  const { App } = await import('../src/app/app')
  const { installMockApi } = await import('../src/mocks')
  const { store } = await import('../src/mocks/db')
  const { SESSION_STORAGE_KEY } = await import('../src/lib/api/client')

  installMockApi()

  const admin = store.users[0]
  const tokenPayload = Buffer.from(
    JSON.stringify({ sub: admin.id, email: admin.email, exp: Date.now() + 3600_000 }),
  ).toString('base64')
  localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      token: `mock.${tokenPayload}.${admin.id.slice(0, 8)}`,
      email: admin.email,
      fullName: admin.fullName,
      companyId: admin.companyId,
      roles: admin.roles,
    }),
  )

  const errors: string[] = []
  const stackTrace = process.env.RENDER_SMOKE_TRACE === '1'
  const originalError = console.error
  console.error = (...args: unknown[]) => {
    const message = args.map(String).join(' ')
    if (
      message.includes('not wrapped in act') ||
      message.includes('React Router Future Flag') ||
      message.includes('Warning: validateDOMNesting')
    ) {
      return
    }
    errors.push(message)
    originalError(...args)
    if (stackTrace && message.includes('unique "key"')) {
      const ownerStack = reactModule?.captureOwnerStack?.() ?? '(captureOwnerStack unavailable)'
      originalError('  ↳ owner stack:', String(ownerStack).split('\n').slice(0, 6).join('\n'))
    }
  }

  const routesToTest: Array<{ path: string; expect: string; expectsRows?: boolean }> = [
    { path: '/', expect: 'Financial overview', expectsRows: false },
    { path: '/gl/accounts', expect: 'Accounts Receivable', expectsRows: true },
    { path: '/gl/journal-entries', expect: 'JE-', expectsRows: true },
    { path: '/gl/fiscal-periods', expect: 'Jan', expectsRows: true },
    { path: '/ar/customers', expect: 'Northwind Traders', expectsRows: true },
    { path: '/ar/invoices', expect: 'INV-', expectsRows: true },
    { path: '/ar/payments', expect: 'PMT-', expectsRows: true },
    { path: '/ap/vendors', expect: 'Pacific Office Supplies', expectsRows: true },
    { path: '/ap/bills', expect: 'BILL-', expectsRows: true },
    { path: '/ap/payments', expect: 'VPMT-', expectsRows: true },
    { path: '/banking/accounts', expect: 'Operating Account', expectsRows: true },
    { path: '/inventory/items', expect: 'SKU-100', expectsRows: true },
    { path: '/assets/fixed-assets', expect: 'FA-1001', expectsRows: true },
    { path: '/budgets', expect: 'Operating Budget', expectsRows: false },
    { path: '/tax/codes', expect: 'TAX8.5', expectsRows: true },
    { path: '/settings/company', expect: 'Demo Company Inc.', expectsRows: false },
    { path: '/reports', expect: 'Trial balance', expectsRows: false },
    { path: '/reports/trial-balance', expect: 'Accounts Receivable', expectsRows: true },
    { path: '/reports/income-statement', expect: 'Net income', expectsRows: true },
    { path: '/reports/balance-sheet', expect: 'Total equity', expectsRows: true },
    { path: '/reports/general-ledger', expect: 'Opening balance', expectsRows: true },
    { path: '/reports/ar-aging', expect: 'Total due', expectsRows: true },
    { path: '/reports/ap-aging', expect: 'Total due', expectsRows: true },
    { path: '/reports/cash-flow', expect: 'Net cash from operations', expectsRows: false },
  ]

  let failures = 0

  for (const { path: route, expect: expected, expectsRows } of routesToTest) {
    const container = dom.window.document.createElement('div')
    dom.window.document.body.appendChild(container)

    const before = errors.length

    const root = createRoot(container)
    await act(async () => {
      root.render(
        React.createElement(
          ThemeProvider,
          null,
          React.createElement(
            QueryClientProvider,
            { client: queryClient },
            React.createElement(
              MemoryRouter,
              { initialEntries: [route] },
              React.createElement(
                AuthProvider,
                null,
                React.createElement(TooltipProvider, null, React.createElement(App, null)),
              ),
            ),
          ),
        ),
      )
    })

    // Let TanStack Query resolve against the mock API.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 900))
    })

    const text = container.textContent ?? ''
    const newErrors = errors.slice(before)
    const rowCount = container.querySelectorAll('tbody tr').length

    if (newErrors.length) {
      failures += 1
      console.log(`  ✗ ${route} → ${newErrors[0]?.slice(0, 220)}`)
    } else if (!text.includes(expected)) {
      failures += 1
      console.log(`  ✗ ${route} → expected to find "${expected}" in the rendered output | got: ${text.slice(-500).replace(/\s+/g, ' ')}`)
    } else if (expectsRows && rowCount === 0) {
      failures += 1
      console.log(`  ✗ ${route} → table rendered with no rows`)
    } else {
      console.log(`  ✓ ${route}  (${rowCount} table row(s), contains "${expected}")`)
    }

    await act(async () => {
      root.unmount()
    })
    container.remove()
    queryClient.clear()
  }

  /* ------------------------------------------------- driven write flow (RHF → dialog → mutation → table) */
  queryClient.clear()
  const writeContainer = dom.window.document.createElement('div')
  dom.window.document.body.appendChild(writeContainer)
  const writeRoot = createRoot(writeContainer)
  const beforeWrite = errors.length

  await act(async () => {
    writeRoot.render(
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(
          QueryClientProvider,
          { client: queryClient },
          React.createElement(
            MemoryRouter,
            { initialEntries: ['/gl/accounts'] },
            React.createElement(AuthProvider, null, React.createElement(TooltipProvider, null, React.createElement(App, null))),
          ),
        ),
      ),
    )
  })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 900))
  })

  const setValue = (element: Element, value: string) => {
    const prototype = Object.getPrototypeOf(element) as object
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value')
    if (descriptor?.set) descriptor.set.call(element, value)
    element.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
    element.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
  }

  const dialogChecks: Array<{ route: string; button: string; expect: string }> = [
    { route: '/gl/journal-entries', button: 'New entry', expect: 'Lines' },
    { route: '/ar/invoices', button: 'New invoice', expect: 'Add line' },
    { route: '/ap/bills', button: 'New bill', expect: 'Add line' },
    { route: '/ar/payments', button: 'Record payment', expect: 'Amount' },
    { route: '/ap/payments', button: 'New payment', expect: 'Amount' },
    { route: '/inventory/items', button: 'New item', expect: 'SKU' },
    { route: '/assets/fixed-assets', button: 'New asset', expect: 'Asset code' },
    { route: '/tax/codes', button: 'New tax code', expect: 'Rate' },
  ]

  const findButton = (label: string) =>
    Array.from(dom.window.document.querySelectorAll('button')).find((button: Element) =>
      (button.textContent ?? '').includes(label),
    ) as HTMLButtonElement | undefined

  for (const check of dialogChecks) {
    const dialogContainer = dom.window.document.createElement('div')
    dom.window.document.body.appendChild(dialogContainer)
    const dialogRoot = createRoot(dialogContainer)
    const beforeDialog = errors.length

    await act(async () => {
      dialogRoot.render(
        React.createElement(
          ThemeProvider,
          null,
          React.createElement(
            QueryClientProvider,
            { client: queryClient },
            React.createElement(
              MemoryRouter,
              { initialEntries: [check.route] },
              React.createElement(AuthProvider, null, React.createElement(TooltipProvider, null, React.createElement(App, null))),
            ),
          ),
        ),
      )
    })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 800))
    })

    const trigger = findButton(check.button)
    await act(async () => {
      trigger?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await new Promise((resolve) => setTimeout(resolve, 400))
    })

    const dialog = dom.window.document.querySelector('[role="dialog"]')
    const dialogText = (dialog?.textContent ?? '').replace(/\s+/g, ' ')
    const dialogErrors = errors.slice(beforeDialog)

    if (dialogErrors.length) {
      failures += 1
      console.log(`  ✗ ${check.route} dialog → ${dialogErrors[0]?.slice(0, 180)}`)
    } else if (!dialog || !dialogText.includes(check.expect)) {
      failures += 1
      console.log(`  ✗ ${check.route} dialog → "${check.button}" did not open the expected dialog | got: ${dialogText.slice(0, 160)}`)
    } else {
      console.log(`  ✓ ${check.route} → "${check.button}" dialog opens with "${check.expect}"`)
    }

    await act(async () => {
      dialogRoot.unmount()
    })
    dialogContainer.remove()
    queryClient.clear()
  }


  /* --------------------- journal-entry flow (field array + account comboboxes) */
  const jeContainer = dom.window.document.createElement('div')
  dom.window.document.body.appendChild(jeContainer)
  const jeRoot = createRoot(jeContainer)
  const beforeJe = errors.length

  await act(async () => {
    jeRoot.render(
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(
          QueryClientProvider,
          { client: queryClient },
          React.createElement(
            MemoryRouter,
            { initialEntries: ['/gl/journal-entries'] },
            React.createElement(AuthProvider, null, React.createElement(TooltipProvider, null, React.createElement(App, null))),
          ),
        ),
      ),
    )
  })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 900))
  })

  const clickElement = async (element: Element | undefined | null, settle = 300) => {
    await act(async () => {
      element?.dispatchEvent(new dom.window.PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }))
      element?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
      await new Promise((resolve) => setTimeout(resolve, settle))
    })
  }

  const pickAccount = async (lineIndex: number, accountLabel: string) => {
    const dialog = dom.window.document.querySelector('[role="dialog"]')
    const triggers = Array.from(dialog?.querySelectorAll('button[role="combobox"]') ?? []) as HTMLElement[]
    await clickElement(triggers[lineIndex])
    const option = Array.from(dom.window.document.querySelectorAll('button')).find((button: Element) =>
      (button.textContent ?? '').includes(accountLabel),
    ) as HTMLButtonElement | undefined
    await clickElement(option, 200)
    return Boolean(option)
  }

  await clickElement(findButton('New entry'), 400)
  const pickedCash = await pickAccount(0, '1000 · Cash and Bank')
  const pickedRevenue = await pickAccount(1, '4000 · Sales Revenue')

  await act(async () => {
    const memo = dom.window.document.querySelector('[name="memo"]')
    const debit = dom.window.document.querySelector('[name="lines.0.debit"]')
    const credit = dom.window.document.querySelector('[name="lines.1.credit"]')
    if (memo) setValue(memo, 'Render smoke journal')
    if (debit) setValue(debit, '125.25')
    if (credit) setValue(credit, '125.25')
    await new Promise((resolve) => setTimeout(resolve, 150))
  })

  await clickElement(findButton('Post entry'), 1200)

  const jeText = jeContainer.textContent ?? ''
  const jeErrors = errors.slice(beforeJe)
  if (jeErrors.length) {
    failures += 1
    console.log(`  ✗ journal-entry flow → ${jeErrors[0]?.slice(0, 200)}`)
  } else if (!pickedCash || !pickedRevenue) {
    failures += 1
    console.log('  ✗ journal-entry flow → could not pick accounts from the combobox list')
  } else if (!jeText.includes('Render smoke journal')) {
    const bodyText = (dom.window.document.body.textContent ?? '').replace(/\s+/g, ' ')
    failures += 1
    console.log(`  ✗ journal-entry flow → entry never appeared in the ledger | body: ${bodyText.slice(-220)}`)
  } else {
    console.log('  ✓ journal-entry flow (field array, account comboboxes, balanced post → ledger)')
  }

  await act(async () => {
    jeRoot.unmount()
  })
  jeContainer.remove()
  queryClient.clear()

  const openButton = findButton('New account')
  await act(async () => {
    openButton?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 300))
  })

  const codeInput = dom.window.document.querySelector('[name="code"]')
  const nameInput = dom.window.document.querySelector('[name="name"]')
  const form = codeInput?.closest('form')
  await act(async () => {
    if (codeInput) setValue(codeInput, '1050')
    if (nameInput) setValue(nameInput, 'Render Smoke Checking')
    await new Promise((resolve) => setTimeout(resolve, 100))
  })

  // The account type field is a Radix select — open it and pick an option.
  const typeTrigger = dom.window.document.querySelector('[name="type"]') as HTMLElement | null
  await act(async () => {
    if (typeTrigger) {
      typeTrigger.dispatchEvent(new dom.window.PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }))
      typeTrigger.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  })
  const option = Array.from(dom.window.document.querySelectorAll('[role="option"]')).find((element: Element) =>
    (element.textContent ?? '').includes('Expense'),
  ) as HTMLElement | undefined
  await act(async () => {
    option?.dispatchEvent(new dom.window.PointerEvent('pointerup', { bubbles: true, cancelable: true, button: 0 }))
    option?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 150))
  })

  await act(async () => {
    form?.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))
    await new Promise((resolve) => setTimeout(resolve, 900))
  })

  const writeText = writeContainer.textContent ?? ''
  const writeErrors = errors.slice(beforeWrite)
  const created = writeText.includes('Render Smoke Checking')
  if (writeErrors.length) {
    failures += 1
    console.log(`  ✗ create-account flow → ${writeErrors[0]?.slice(0, 200)}`)
  } else if (!created) {
    failures += 1
    const bodyText = (dom.window.document.body.textContent ?? '').replace(/\s+/g, ' ')
    console.log(`  ✗ create-account flow → the new account never appeared in the table | body: ${bodyText.slice(-260)}`)
  } else {
    console.log('  ✓ create-account flow (dialog → RHF validation → mutation → table refresh)')
  }
  await act(async () => {
    writeRoot.unmount()
  })
  writeContainer.remove()

  // Sign-in screen renders without a stored session. Sign out through the API so the
  // module-level session cache (readSession) is cleared too, not just localStorage.
  const { writeSession } = await import('../src/lib/api/client')
  writeSession(null)
  queryClient.clear()
  const loginContainer = dom.window.document.createElement('div')
  dom.window.document.body.appendChild(loginContainer)
  const before = errors.length
  const loginRoot = createRoot(loginContainer)
  await act(async () => {
    loginRoot.render(
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(
          QueryClientProvider,
          { client: queryClient },
          React.createElement(
            MemoryRouter,
            { initialEntries: ['/login'] },
            React.createElement(AuthProvider, null, React.createElement(TooltipProvider, null, React.createElement(App, null))),
          ),
        ),
      ),
    )
  })
  const loginText = loginContainer.textContent ?? ''
  if (errors.length > before) {
    failures += 1
    console.log(`  ✗ /login → ${errors[before]?.slice(0, 220)}`)
  } else if (!/sign in/i.test(loginText)) {
    failures += 1
    console.log(`  ✗ /login → sign-in form did not render | got: ${loginText.slice(0, 400).replace(/\s+/g, ' ')}`)
  } else {
    console.log(`  ✓ /login (prefilled demo credentials present: ${loginText.includes('admin@demo.local')})`)
  }

  // Signing in through the form must reach the dashboard.
  const signInButton = Array.from(dom.window.document.querySelectorAll('button')).find(
    (button: Element) => (button.textContent ?? '').trim() === 'Sign in',
  ) as HTMLButtonElement | undefined
  const beforeSignIn = errors.length
  await act(async () => {
    signInButton?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 900))
  })
  const signedInText = loginContainer.textContent ?? ''
  if (errors.length > beforeSignIn) {
    failures += 1
    console.log(`  ✗ sign-in flow → ${errors[beforeSignIn]?.slice(0, 200)}`)
  } else if (!/financial overview|dashboard/i.test(signedInText)) {
    failures += 1
    console.log(`  ✗ sign-in flow → stayed on the sign-in screen | got: ${signedInText.slice(0, 200).replace(/\s+/g, ' ')}`)
  } else {
    console.log(`  ✓ sign-in flow (form → mock JWT → dashboard)`)
  }
  await act(async () => {
    loginRoot.unmount()
  })

  console.error = originalError

  const totalChecks = routesToTest.length + dialogChecks.length + 4
  console.log(`\n${failures === 0 ? '✅' : '❌'} ${totalChecks - failures}/${totalChecks} checks passed`)
  // jsdom keeps timers/handles alive — exit explicitly (after flushing stdout).
  await new Promise((resolve) => setTimeout(resolve, 50))
  process.exit(failures > 0 ? 1 : 0)
}

void main()
