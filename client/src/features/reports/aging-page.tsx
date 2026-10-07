import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Money, StatCard } from '@/components/common/misc'
import { useApAging, useArAging } from '@/hooks/queries'
import { downloadCsv } from '@/lib/csv'
import { formatDate, formatMoney, today } from '@/lib/format'
import { DateRangeControls, ReportPage, ReportTableShell } from '@/features/reports/report-shell'
import type { AgingReport } from '@/lib/types'

export function AgingPage({ kind }: { kind: 'ar' | 'ap' }) {
  const { t } = useTranslation()
  const [asOfDate, setAsOfDate] = useState(today())
  const arQuery = useArAging(asOfDate)
  const apQuery = useApAging(asOfDate)
  const report = (kind === 'ar' ? arQuery : apQuery) as typeof arQuery & { data?: AgingReport }

  const rows = report.data?.rows ?? []
  const base = kind === 'ar' ? 'reports.arAging' : 'reports.apAging'
  const partyLabel = kind === 'ar' ? t('reports.agingCols.customer') : t('reports.agingCols.vendor')

  const bucketTotals = rows.reduce(
    (accumulator, row) => ({
      current: accumulator.current + row.buckets.current,
      days1To30: accumulator.days1To30 + row.buckets.days1To30,
      days31To60: accumulator.days31To60 + row.buckets.days31To60,
      days61To90: accumulator.days61To90 + row.buckets.days61To90,
      over90: accumulator.over90 + row.buckets.over90,
    }),
    { current: 0, days1To30: 0, days31To60: 0, days61To90: 0, over90: 0 },
  )

  const overdue = bucketTotals.days1To30 + bucketTotals.days31To60 + bucketTotals.days61To90 + bucketTotals.over90

  return (
    <ReportPage
      title={t(`${base}.title`)}
      description={t(`${base}.description`, { date: formatDate(asOfDate) })}
      onRefresh={() => report.refetch()}
      isLoading={report.isLoading}
      error={report.error}
      onExport={() =>
        downloadCsv(
          `${kind}-aging-${asOfDate}`,
          [
            partyLabel,
            t('reports.agingCols.current'),
            t('reports.agingCols.days1To30'),
            t('reports.agingCols.days31To60'),
            t('reports.agingCols.days61To90'),
            t('reports.agingCols.over90'),
            t('reports.agingCols.totalDue'),
          ],
          rows.map((row) => [
            row.partyName,
            row.buckets.current,
            row.buckets.days1To30,
            row.buckets.days31To60,
            row.buckets.days61To90,
            row.buckets.over90,
            row.totalDue,
          ]),
        )
      }
      controls={
        <>
          <DateRangeControls
            from=""
            to={asOfDate}
            onToChange={setAsOfDate}
            toLabel={t('common.asOf')}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard
              label={t(`${base}.totalOutstanding`)}
              value={formatMoney(report.data?.grandTotal ?? 0)}
            />
            <StatCard
              label={t(`${base}.overdue`)}
              value={formatMoney(overdue)}
              tone={overdue > 0 ? 'negative' : 'default'}
            />
            <StatCard
              label={t(`${base}.currentNotDue`)}
              value={formatMoney(bucketTotals.current)}
              tone="positive"
            />
          </div>
        </>
      }
      actions={
        <Link
          to={`/reports/${kind === 'ar' ? 'ap' : 'ar'}-aging`}
          className="text-sm text-primary hover:underline"
        >
          {t(`${base}.switchTo`)}
        </Link>
      }
    >
      <ReportTableShell
        footer={
          <div className="flex flex-wrap items-center justify-between gap-4 border-t bg-muted/50 px-4 py-3 text-sm font-medium">
            <span className="text-muted-foreground">
              {kind === 'ar'
                ? t('reports.arAging.customersCount', { count: rows.length })
                : t('reports.apAging.vendorsCount', { count: rows.length })}
            </span>
            <span className="tabular-nums">
              {t('reports.agingCols.grandTotal', {
                amount: formatMoney(report.data?.grandTotal ?? 0),
              })}
            </span>
          </div>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{partyLabel}</TableHead>
              <TableHead className="text-end">{t('reports.agingCols.current')}</TableHead>
              <TableHead className="text-end">{t('reports.agingCols.days1To30')}</TableHead>
              <TableHead className="text-end">{t('reports.agingCols.days31To60')}</TableHead>
              <TableHead className="text-end">{t('reports.agingCols.days61To90')}</TableHead>
              <TableHead className="text-end">{t('reports.agingCols.over90')}</TableHead>
              <TableHead className="text-end">{t('reports.agingCols.totalDue')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">
                  {t('reports.agingCols.nothingOutstanding', { date: asOfDate })}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.partyId}>
                  <TableCell className="font-medium">{row.partyName}</TableCell>
                  <TableCell className="text-end">
                    {row.buckets.current ? (
                      <Money value={row.buckets.current} />
                    ) : (
                      <span className="text-muted-foreground">{t('common.dash')}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-end">
                    {row.buckets.days1To30 ? (
                      <Money value={row.buckets.days1To30} />
                    ) : (
                      <span className="text-muted-foreground">{t('common.dash')}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-end">
                    {row.buckets.days31To60 ? (
                      <Money value={row.buckets.days31To60} />
                    ) : (
                      <span className="text-muted-foreground">{t('common.dash')}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-end">
                    {row.buckets.days61To90 ? (
                      <Money value={row.buckets.days61To90} />
                    ) : (
                      <span className="text-muted-foreground">{t('common.dash')}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-end text-destructive">
                    {row.buckets.over90 ? (
                      <Money value={row.buckets.over90} />
                    ) : (
                      <span className="text-muted-foreground">{t('common.dash')}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-end font-semibold">
                    <Money value={row.totalDue} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {rows.length ? (
            <TableFooter>
              <TableRow>
                <TableCell>{t('reports.agingCols.total')}</TableCell>
                <TableCell className="text-end">
                  <Money value={bucketTotals.current} />
                </TableCell>
                <TableCell className="text-end">
                  <Money value={bucketTotals.days1To30} />
                </TableCell>
                <TableCell className="text-end">
                  <Money value={bucketTotals.days31To60} />
                </TableCell>
                <TableCell className="text-end">
                  <Money value={bucketTotals.days61To90} />
                </TableCell>
                <TableCell className="text-end">
                  <Money value={bucketTotals.over90} />
                </TableCell>
                <TableCell className="text-end">
                  <Money value={report.data?.grandTotal ?? 0} />
                </TableCell>
              </TableRow>
            </TableFooter>
          ) : null}
        </Table>
      </ReportTableShell>
    </ReportPage>
  )
}
