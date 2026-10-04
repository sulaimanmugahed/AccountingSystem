import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Money, StatCard } from '@/components/common/misc'
import { useIncomeStatement } from '@/hooks/queries'
import { downloadCsv } from '@/lib/csv'
import { endOfMonth, formatDate, formatMoney, startOfYear } from '@/lib/format'
import { DateRangeControls, ReportPage, ReportTableShell } from '@/features/reports/report-shell'
import type { IncomeStatementRow } from '@/lib/types'

function Section({
  title,
  rows,
  total,
  tone,
}: {
  title: string
  rows: IncomeStatementRow[]
  total: number
  tone: 'positive' | 'negative'
}) {
  return (
    <ReportTableShell>
      <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-2.5">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-sm font-semibold tabular-nums">{formatMoney(total)}</span>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-4 py-6 text-center text-muted-foreground">No activity in this period.</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.accountCode} className="border-b last:border-0">
                <td className="px-4 py-2 text-muted-foreground">
                  <span className="font-mono text-xs">{row.accountCode}</span> {row.accountName}
                </td>
                <td className="px-4 py-2 text-right">
                  <Money value={row.amount} className={tone === 'negative' ? 'text-destructive' : undefined} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </ReportTableShell>
  )
}

export function IncomeStatementPage() {
  const [startDate, setStartDate] = useState(startOfYear())
  const [endDate, setEndDate] = useState(endOfMonth())
  const report = useIncomeStatement(startDate, endDate)

  const netIncome = report.data?.netIncome ?? 0

  return (
    <ReportPage
      title="Income statement"
      description={`Revenue and expenses posted between ${formatDate(startDate)} and ${formatDate(endDate)}.`}
      onRefresh={() => report.refetch()}
      isLoading={report.isLoading}
      error={report.error}
      onExport={() =>
        downloadCsv(
          `income-statement-${startDate}-to-${endDate}`,
          ['Section', 'Account code', 'Account name', 'Amount'],
          [
            ...(report.data?.revenues ?? []).map((row) => ['Revenue', row.accountCode, row.accountName, row.amount]),
            ...(report.data?.expenses ?? []).map((row) => ['Expense', row.accountCode, row.accountName, row.amount]),
            ['Net income', '', '', netIncome],
          ],
        )
      }
      controls={
        <>
          <DateRangeControls from={startDate} to={endDate} onFromChange={setStartDate} onToChange={setEndDate} toLabel="To" />
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Total revenue" value={formatMoney(report.data?.totalRevenue ?? 0)} tone="positive" />
            <StatCard label="Total expenses" value={formatMoney(report.data?.totalExpense ?? 0)} tone="negative" />
            <StatCard
              label="Net income"
              value={formatMoney(netIncome)}
              tone={netIncome >= 0 ? 'positive' : 'negative'}
              hint={
                report.data?.totalRevenue
                  ? `${((netIncome / report.data.totalRevenue) * 100).toFixed(1)}% net margin`
                  : undefined
              }
            />
          </div>
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          title="Revenue"
          rows={report.data?.revenues ?? []}
          total={report.data?.totalRevenue ?? 0}
          tone="positive"
        />
        <Section
          title="Expenses"
          rows={report.data?.expenses ?? []}
          total={report.data?.totalExpense ?? 0}
          tone="negative"
        />
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Net income</p>
            <p className={`text-2xl font-semibold tabular-nums ${netIncome >= 0 ? 'text-success' : 'text-destructive'}`}>
              {formatMoney(netIncome)}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            {formatMoney(report.data?.totalRevenue ?? 0)} revenue − {formatMoney(report.data?.totalExpense ?? 0)} expenses
          </p>
        </CardContent>
      </Card>
    </ReportPage>
  )
}
