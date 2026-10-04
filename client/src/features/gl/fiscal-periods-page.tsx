import { useMemo, useState } from 'react'
import { CalendarClock, Lock, LockOpen, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { ErrorState, StatCard } from '@/components/common/misc'
import { useFiscalPeriods, useFiscalYears } from '@/hooks/queries'
import { useCloseFiscalYear, useClosePeriod, useReopenPeriod } from '@/hooks/mutations'
import { useAuth } from '@/lib/auth'
import { fiscalPeriodStatusLabels, FiscalPeriodStatus } from '@/lib/enums'
import { formatDate } from '@/lib/format'
import type { FiscalPeriod } from '@/lib/types'

export function FiscalPeriodsPage() {
  const { hasRole } = useAuth()
  const canManage = hasRole('Admin', 'Accountant')

  const yearsQuery = useFiscalYears()
  const years = yearsQuery.data ?? []
  const currentYear = useMemo(() => {
    const open = years.find((year) => !year.isClosed)
    return open ?? years[years.length - 1]
  }, [years])

  const [selectedYearId, setSelectedYearId] = useState<string>('')
  const activeYearId = selectedYearId || currentYear?.id || ''
  const activeYear = years.find((year) => year.id === activeYearId)

  const periodsQuery = useFiscalPeriods(activeYearId)
  const closePeriod = useClosePeriod()
  const reopenPeriod = useReopenPeriod()
  const closeYear = useCloseFiscalYear()

  const [periodToClose, setPeriodToClose] = useState<FiscalPeriod | null>(null)
  const [periodToReopen, setPeriodToReopen] = useState<FiscalPeriod | null>(null)
  const [yearToClose, setYearToClose] = useState(false)

  const periods = periodsQuery.data ?? []
  const openCount = periods.filter((period) => period.status === FiscalPeriodStatus.Open).length

  return (
    <div className="space-y-5">
      <PageHeader
        title="Fiscal periods"
        description="Journal entries can only be posted into an open period. Closing a year posts the closing entry that rolls revenue and expenses into retained earnings."
        breadcrumbs={[{ label: 'General Ledger' }, { label: 'Fiscal Periods' }]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => yearsQuery.refetch()} loading={yearsQuery.isFetching}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!canManage || !activeYear || activeYear.isClosed}
              onClick={() => setYearToClose(true)}
            >
              <Lock className="h-4 w-4" /> Close fiscal year
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Fiscal years" value={years.length} hint={`${years.filter((year) => !year.isClosed).length} open`} icon={CalendarClock} />
        <StatCard label="Selected year" value={activeYear?.name ?? '—'} hint={activeYear ? `${formatDate(activeYear.startDate)} → ${formatDate(activeYear.endDate)}` : undefined} />
        <StatCard label="Open periods" value={openCount} />
        <StatCard label="Closed periods" value={periods.length - openCount} />
      </div>

      {yearsQuery.error ? (
        <ErrorState error={yearsQuery.error} onRetry={() => yearsQuery.refetch()} title="Could not load fiscal years" />
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm">Periods</CardTitle>
            <Select value={activeYearId} onValueChange={setSelectedYearId}>
              <SelectTrigger className="h-8 w-[200px]">
                <SelectValue placeholder="Select fiscal year" />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year.id} value={year.id}>
                    {year.name} {year.isClosed ? '(closed)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="p-0">
            {periodsQuery.error ? (
              <div className="p-5">
                <ErrorState error={periodsQuery.error} onRetry={() => periodsQuery.refetch()} />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Closed by</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periods.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">
                        No periods for this fiscal year.
                      </TableCell>
                    </TableRow>
                  ) : (
                    periods.map((period) => (
                      <TableRow key={period.id}>
                        <TableCell className="text-muted-foreground">{period.periodNumber}</TableCell>
                        <TableCell className="font-medium">{period.name}</TableCell>
                        <TableCell>{formatDate(period.startDate)}</TableCell>
                        <TableCell>{formatDate(period.endDate)}</TableCell>
                        <TableCell>
                          <Badge variant={period.status === FiscalPeriodStatus.Open ? 'success' : 'secondary'}>
                            {fiscalPeriodStatusLabels[period.status] ?? '—'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {period.closedBy ?? '—'}
                          {period.closedAtUtc ? <span className="block">{formatDate(period.closedAtUtc)}</span> : null}
                        </TableCell>
                        <TableCell className="text-right">
                          {period.status === FiscalPeriodStatus.Open ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!canManage}
                              onClick={() => setPeriodToClose(period)}
                            >
                              <Lock className="h-4 w-4" /> Close
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={!canManage}
                              onClick={() => setPeriodToReopen(period)}
                            >
                              <LockOpen className="h-4 w-4" /> Reopen
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={!!periodToClose}
        onOpenChange={(open) => !open && setPeriodToClose(null)}
        title="Close fiscal period?"
        description={
          periodToClose
            ? `${periodToClose.name} will stop accepting new postings until it is reopened. Existing entries are unaffected.`
            : undefined
        }
        confirmLabel="Close period"
        loading={closePeriod.isPending}
        onConfirm={() => {
          if (!periodToClose) return
          closePeriod.mutate(periodToClose.id, { onSuccess: () => setPeriodToClose(null) })
        }}
      />

      <ConfirmDialog
        open={!!periodToReopen}
        onOpenChange={(open) => !open && setPeriodToReopen(null)}
        title="Reopen fiscal period?"
        description={periodToReopen ? `${periodToReopen.name} will accept new postings again.` : undefined}
        confirmLabel="Reopen period"
        destructive
        loading={reopenPeriod.isPending}
        onConfirm={() => {
          if (!periodToReopen) return
          reopenPeriod.mutate(periodToReopen.id, { onSuccess: () => setPeriodToReopen(null) })
        }}
      />

      <ConfirmDialog
        open={yearToClose}
        onOpenChange={setYearToClose}
        title="Close the fiscal year?"
        description={
          activeYear
            ? `${activeYear.name} will be closed: all periods are locked and a closing entry transfers the year's revenue and expenses to retained earnings. This is normally done once a year.`
            : undefined
        }
        confirmLabel="Close fiscal year"
        destructive
        loading={closeYear.isPending}
        onConfirm={() => {
          if (!activeYear) return
          closeYear.mutate(activeYear.id, { onSuccess: () => setYearToClose(false) })
        }}
      />
    </div>
  )
}
