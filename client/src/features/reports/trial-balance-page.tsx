import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Money } from '@/components/common/misc'
import { useTrialBalance } from '@/hooks/queries'
import { downloadCsv } from '@/lib/csv'
import { formatMoney, today } from '@/lib/format'
import { ReportPage, ReportTableShell, DateRangeControls } from '@/features/reports/report-shell'

export function TrialBalancePage() {
  const [asOfDate, setAsOfDate] = useState(today())
  const report = useTrialBalance(asOfDate)

  const rows = report.data?.rows ?? []
  const balanced = Math.abs((report.data?.totalDebit ?? 0) - (report.data?.totalCredit ?? 0)) < 0.01

  return (
    <ReportPage
      title="Trial balance"
      description="Net debit or credit movement per account up to the selected date. A balanced trial balance confirms the ledger is internally consistent."
      onRefresh={() => report.refetch()}
      isLoading={report.isLoading}
      error={report.error}
      onExport={() =>
        downloadCsv(
          `trial-balance-${asOfDate}`,
          ['Account code', 'Account name', 'Type', 'Debit', 'Credit'],
          rows.map((row) => [row.accountCode, row.accountName, row.accountType, row.debit, row.credit]),
        )
      }
      controls={<DateRangeControls from="" to={asOfDate} onToChange={setAsOfDate} toLabel="As of date" />}
      actions={
        <Badge variant={balanced ? 'success' : 'destructive'}>
          {balanced ? 'Balanced' : 'Out of balance'}
        </Badge>
      }
    >
      <ReportTableShell
        footer={
          <div className="flex flex-wrap items-center justify-between gap-4 border-t bg-muted/50 px-4 py-3 text-sm font-medium">
            <span className="text-muted-foreground">Totals</span>
            <div className="flex gap-8 tabular-nums">
              <span>Debits {formatMoney(report.data?.totalDebit ?? 0)}</span>
              <span>Credits {formatMoney(report.data?.totalCredit ?? 0)}</span>
            </div>
          </div>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[110px]">Code</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                  No posted activity up to {asOfDate}.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.accountId}>
                  <TableCell className="font-mono text-xs">{row.accountCode}</TableCell>
                  <TableCell className="font-medium">{row.accountName}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.accountType}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {row.debit ? <Money value={row.debit} /> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.credit ? <Money value={row.credit} /> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {rows.length ? (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3}>Total</TableCell>
                <TableCell className="text-right">
                  <Money value={report.data?.totalDebit ?? 0} />
                </TableCell>
                <TableCell className="text-right">
                  <Money value={report.data?.totalCredit ?? 0} />
                </TableCell>
              </TableRow>
            </TableFooter>
          ) : null}
        </Table>
      </ReportTableShell>
    </ReportPage>
  )
}
