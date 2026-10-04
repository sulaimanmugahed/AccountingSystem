import * as React from 'react'
import { Download, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/layout/page-header'
import { ErrorState, TableSkeleton } from '@/components/common/misc'

export function DateRangeControls({
  from,
  to,
  onFromChange,
  onToChange,
  fromLabel = 'From',
  toLabel = 'As of',
  children,
}: {
  from: string
  to: string
  onFromChange?: (value: string) => void
  onToChange: (value: string) => void
  fromLabel?: string
  toLabel?: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
      {onFromChange ? (
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{fromLabel}</label>
          <Input type="date" value={from} max={to || undefined} onChange={(event) => onFromChange(event.target.value)} className="w-[170px]" />
        </div>
      ) : null}
      <div className="space-y-1">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{toLabel}</label>
        <Input type="date" value={to} min={from || undefined} onChange={(event) => onToChange(event.target.value)} className="w-[170px]" />
      </div>
      {children}
    </div>
  )
}

export function ReportPage({
  title,
  description,
  breadcrumbs,
  onRefresh,
  onExport,
  controls,
  isLoading,
  error,
  children,
  actions,
}: {
  title: string
  description?: React.ReactNode
  breadcrumbs?: { label: string; href?: string }[]
  onRefresh?: () => void
  onExport?: () => void
  controls?: React.ReactNode
  isLoading?: boolean
  error?: unknown
  children: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        description={description}
        breadcrumbs={breadcrumbs ?? [{ label: 'Reports', href: '/reports' }, { label: title }]}
        actions={
          <>
            {actions}
            {onExport ? (
              <Button variant="outline" size="sm" onClick={onExport}>
                <Download className="h-4 w-4" /> Export CSV
              </Button>
            ) : null}
            {onRefresh ? (
              <Button variant="outline" size="sm" onClick={onRefresh}>
                <RefreshCw className="h-4 w-4" /> Refresh
              </Button>
            ) : null}
          </>
        }
      />

      {controls}

      {error ? <ErrorState error={error} onRetry={onRefresh} title={`Could not load the ${title.toLowerCase()}`} /> : null}
      {isLoading && !error ? <TableSkeleton rows={8} /> : null}
      {!isLoading && !error ? children : null}
    </div>
  )
}

export function ReportTableShell({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      {children}
      {footer}
    </div>
  )
}
