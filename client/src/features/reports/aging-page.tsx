import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Money, StatCard } from '@/components/common/misc'
import { useApAging, useArAging } from '@/hooks/queries'
import { downloadCsv } from '@/lib/csv'
import { formatDate, formatMoney, today } from '@/lib/format'
import { DateRangeControls, ReportPage, ReportTableShell } from '@/features/reports/report-shell'
import type { AgingReport } from '@/lib/types'

export function AgingPage({ kind }: { kind: 'ar' | 'ap' }) {
  const [asOfDate, setAsOfDate] = useState(today())
  const arQuery = useArAging(asOfDate)
  const apQuery = useApAging(asOfDate)
  const report = (kind === 'ar' ? arQuery : apQuery) as typeof arQuery & { data?: AgingReport }

  const rows = report.data?.rows ?? []
  const label = kind === 'ar' ? 'Accounts receivable' : 'Accounts payable'
  const partyLabel = kind === 'ar' ? 'Customer' : 'Vendor'

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
      title={`${label} aging`}
      description={`Open${kind === 'ar' ? ' invoice' : ' bill'} balances bucketed by how far past due they are as of ${formatDate(asOfDate)}.`}
      onRefresh={() => report.refetch()}
      isLoading={report.isLoading}
      error={report.error}
      onExport={() =>
        downloadCsv(
          `${kind}-aging-${asOfDate}`,
          [partyLabel, 'Current', '1-30', '31-60', '61-90', 'Over 90', 'Total due'],
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
          <DateRangeControls from="" to={asOfDate} onToChange={setAsOfDate} toLabel="As of date" />
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Total outstanding" value={formatMoney(report.data?.grandTotal ?? 0)} />
            <StatCard label="Overdue" value={formatMoney(overdue)} tone={overdue > 0 ? 'negative' : 'default'} />
            <StatCard label="Current (not yet due)" value={formatMoney(bucketTotals.current)} tone="positive" />
          </div>
        </>
      }
      actions={
        <Link
          to={`/reports/${kind === 'ar' ? 'ap' : 'ar'}-aging`}
          className="text-sm text-primary hover:underline"
        >
          Switch to {kind === 'ar' ? 'AP' : 'AR'} aging
        </Link>
      }
    >
      <ReportTableShell
        footer={
          <div className="flex flex-wrap items-center justify-between gap-4 border-t bg-muted/50 px-4 py-3 text-sm font-medium">
            <span className="text-muted-foreground">{rows.length} {partyLabel.toLowerCase()}(s)</span>
            <span className="tabular-nums">Grand total {formatMoney(report.data?.grandTotal ?? 0)}</span>
          </div>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{partyLabel}</TableHead>
              <TableHead className="text-right">Current</TableHead>
              <TableHead className="text-right">1–30 days</TableHead>
              <TableHead className="text-right">31–60 days</TableHead>
              <TableHead className="text-right">61–90 days</TableHead>
              <TableHead className="text-right">Over 90</TableHead>
              <TableHead className="text-right">Total due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">
                  Nothing outstanding as of {asOfDate}. 🎉
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.partyId}>
                  <TableCell className="font-medium">{row.partyName}</TableCell>
                  <TableCell className="text-right">
                    {row.buckets.current ? <Money value={row.buckets.current} /> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.buckets.days1To30 ? <Money value={row.buckets.days1To30} /> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.buckets.days31To60 ? <Money value={row.buckets.days31To60} /> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.buckets.days61To90 ? <Money value={row.buckets.days61To90} /> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right text-destructive">
                    {row.buckets.over90 ? <Money value={row.buckets.over90} /> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    <Money value={row.totalDue} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {rows.length ? (
            <TableFooter>
              <TableRow>
                <TableCell>Total</TableCell>
                <TableCell className="text-right">
                  <Money value={bucketTotals.current} />
                </TableCell>
                <TableCell className="text-right">
                  <Money value={bucketTotals.days1To30} />
                </TableCell>
                <TableCell className="text-right">
                  <Money value={bucketTotals.days31To60} />
                </TableCell>
                <TableCell className="text-right">
                  <Money value={bucketTotals.days61To90} />
                </TableCell>
                <TableCell className="text-right">
                  <Money value={bucketTotals.over90} />
                </TableCell>
                <TableCell className="text-right">
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
