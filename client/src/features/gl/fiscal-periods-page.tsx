import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import { FiscalPeriodStatus } from '@/lib/enums'
import { useLabels } from '@/lib/labels'
import { formatDate } from '@/lib/format'
import type { FiscalPeriod } from '@/lib/types'

export function FiscalPeriodsPage() {
  const { t } = useTranslation()
  const labels = useLabels()
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
        title={t('periods.title')}
        description={t('periods.description')}
        breadcrumbs={[{ label: t('nav.groups.generalLedger') }, { label: t('periods.breadcrumb') }]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => yearsQuery.refetch()} loading={yearsQuery.isFetching}>
              <RefreshCw className="h-4 w-4" /> {t('common.refresh')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!canManage || !activeYear || activeYear.isClosed}
              onClick={() => setYearToClose(true)}
            >
              <Lock className="h-4 w-4" /> {t('periods.closeYear')}
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('periods.statYears')}
          value={years.length}
          hint={t('periods.statOpenCount', { count: years.filter((year) => !year.isClosed).length })}
          icon={CalendarClock}
        />
        <StatCard
          label={t('periods.statSelectedYear')}
          value={activeYear?.name ?? t('common.dash')}
          hint={activeYear ? `${formatDate(activeYear.startDate)} → ${formatDate(activeYear.endDate)}` : undefined}
        />
        <StatCard label={t('periods.statOpenPeriods')} value={openCount} />
        <StatCard label={t('periods.statClosedPeriods')} value={periods.length - openCount} />
      </div>

      {yearsQuery.error ? (
        <ErrorState error={yearsQuery.error} onRetry={() => yearsQuery.refetch()} title={t('periods.couldNotLoadYears')} />
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm">{t('periods.periods')}</CardTitle>
            <Select value={activeYearId} onValueChange={setSelectedYearId}>
              <SelectTrigger className="h-8 w-[200px]">
                <SelectValue placeholder={t('periods.selectYear')} />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year.id} value={year.id}>
                    {year.name} {year.isClosed ? t('periods.closedSuffix') : ''}
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
                    <TableHead>{t('periods.period')}</TableHead>
                    <TableHead>{t('periods.start')}</TableHead>
                    <TableHead>{t('periods.end')}</TableHead>
                    <TableHead>{t('common.status')}</TableHead>
                    <TableHead>{t('periods.closedBy')}</TableHead>
                    <TableHead className="text-end">{t('periods.action')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periods.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">
                        {t('periods.noPeriods')}
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
                            {labels.fiscalPeriodStatus[period.status] ?? t('common.dash')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {period.closedBy ?? t('common.dash')}
                          {period.closedAtUtc ? <span className="block">{formatDate(period.closedAtUtc)}</span> : null}
                        </TableCell>
                        <TableCell className="text-end">
                          {period.status === FiscalPeriodStatus.Open ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!canManage}
                              onClick={() => setPeriodToClose(period)}
                            >
                              <Lock className="h-4 w-4" /> {t('periods.close')}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={!canManage}
                              onClick={() => setPeriodToReopen(period)}
                            >
                              <LockOpen className="h-4 w-4" /> {t('periods.reopen')}
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
        title={t('periods.closePeriodTitle')}
        description={
          periodToClose ? t('periods.closePeriodDescription', { period: periodToClose.name }) : undefined
        }
        confirmLabel={t('periods.closePeriodConfirm')}
        loading={closePeriod.isPending}
        onConfirm={() => {
          if (!periodToClose) return
          closePeriod.mutate(periodToClose.id, { onSuccess: () => setPeriodToClose(null) })
        }}
      />

      <ConfirmDialog
        open={!!periodToReopen}
        onOpenChange={(open) => !open && setPeriodToReopen(null)}
        title={t('periods.reopenPeriodTitle')}
        description={
          periodToReopen ? t('periods.reopenPeriodDescription', { period: periodToReopen.name }) : undefined
        }
        confirmLabel={t('periods.reopenPeriodConfirm')}
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
        title={t('periods.closeYearTitle')}
        description={
          activeYear
            ? t('periods.closeYearDescription', { year: activeYear.name })
            : undefined
        }
        confirmLabel={t('periods.closeYearConfirm')}
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
