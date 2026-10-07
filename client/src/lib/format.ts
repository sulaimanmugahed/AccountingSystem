import { currentLocale } from '@/lib/i18n'

const currencyFormatters = new Map<string, Intl.NumberFormat>()

function currencyFormatter(currency: string) {
  const locale = currentLocale()
  const key = `${locale}:${currency}`
  let formatter = currencyFormatters.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    currencyFormatters.set(key, formatter)
  }
  return formatter
}

/** `1234.5 -> $1,234.50` — falls back to a plain number if the code is unknown. */
export function formatMoney(value: number | null | undefined, currency = 'USD') {
  const amount = Number(value ?? 0)
  try {
    return currencyFormatter(currency).format(amount)
  } catch {
    return `${formatNumber(amount)} ${currency}`
  }
}

export function formatMoneyOrDash(value: number | null | undefined, currency = 'USD') {
  if (value === null || value === undefined || Number(value) === 0) return '—'
  return formatMoney(value, currency)
}

const numberFormatters = new Map<string, Intl.NumberFormat>()

export function formatNumber(value: number | null | undefined, decimals = 2) {
  const locale = currentLocale()
  const key = `${locale}:${decimals}`
  let formatter = numberFormatters.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
    numberFormatters.set(key, formatter)
  }
  return formatter.format(Number(value ?? 0))
}

export function formatPercent(value: number | null | undefined, decimals = 2) {
  return `${formatNumber(value ?? 0, decimals)}%`
}

const dateFormatters = new Map<string, Intl.DateTimeFormat>()

function dateFormatter(options: Intl.DateTimeFormatOptions) {
  const locale = currentLocale()
  const key = `${locale}:${JSON.stringify(options)}`
  let formatter = dateFormatters.get(key)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options)
    dateFormatters.set(key, formatter)
  }
  return formatter
}

/** Longer, month-name form used on report headers (e.g. "As of Oct 04, 2026"). */
export function formatDate(value?: string | Date | null) {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'
  return dateFormatter({ year: 'numeric', month: 'short', day: '2-digit' }).format(date)
}

export function formatDateTime(value?: string | Date | null) {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'
  return dateFormatter({
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

/** Month + year only — used for period labels. */
export function formatMonthYear(value?: string | Date | null) {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'
  return dateFormatter({ month: 'long', year: 'numeric' }).format(date)
}

/** `yyyy-MM-dd` in local time — the format `<input type="date">` and the API expect. */
export function toDateInput(value?: string | Date | null) {
  const date = value ? (typeof value === 'string' ? new Date(value) : value) : new Date()
  if (Number.isNaN(date.getTime())) return ''
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function today() {
  return toDateInput(new Date())
}

export function addDays(value: string | Date, days: number) {
  const date = typeof value === 'string' ? new Date(value) : new Date(value.getTime())
  date.setDate(date.getDate() + days)
  return toDateInput(date)
}

export function startOfMonth(value: string | Date = new Date()) {
  const date = typeof value === 'string' ? new Date(value) : value
  return toDateInput(new Date(date.getFullYear(), date.getMonth(), 1))
}

export function startOfYear(value: string | Date = new Date()) {
  const date = typeof value === 'string' ? new Date(value) : value
  return toDateInput(new Date(date.getFullYear(), 0, 1))
}

export function endOfMonth(value: string | Date = new Date()) {
  const date = typeof value === 'string' ? new Date(value) : value
  return toDateInput(new Date(date.getFullYear(), date.getMonth() + 1, 0))
}

export function isOverdue(dueDate?: string | null, status?: number) {
  if (!dueDate) return false
  if (status === 4 || status === 6 || status === 5) return false // Paid / Voided / Overdue handled by API
  return new Date(dueDate).getTime() < new Date(new Date().toDateString()).getTime()
}

export function daysBetween(from: string | Date, to: string | Date = new Date()) {
  const a = typeof from === 'string' ? new Date(from) : from
  const b = typeof to === 'string' ? new Date(to) : to
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}
