import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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
              <td className="px-4 py-6 text-center text-muted-foreground">
                {t('reports.incomeStatement.noActivity')}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.accountCode} className="border-b last:border-0">
                <td className="px-4 py-2 text-muted-foreground">
                  <span className="font-mono text-xs">{row.accountCode}</span> {row.accountName}
                </td>
                <td className="px-4 py-2 text-end">
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
  const { t } = useTranslation()
  const [startDate, setStartDate] = useState(startOfYear())
  const [endDate, setEndDate] = useState(endOfMonth())
  const report = useIncomeStatement(startDate, endDate)

  const netIncome = report.data?.netIncome ?? 0

  return (
    <ReportPage
      title={t('reports.incomeStatement.title')}
      description={t('reports.incomeStatement.description', {
        from: formatDate(startDate),
        to: formatDate(endDate),
      })}
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
          <DateRangeControls
            from={startDate}
            to={endDate}
            onFromChange={setStartDate}
            onToChange={setEndDate}
            toLabel={t('common.to')}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard
              label={t('reports.incomeStatement.totalRevenue')}
              value={formatMoney(report.data?.totalRevenue ?? 0)}
              tone="positive"
            />
            <StatCard
              label={t('reports.incomeStatement.totalExpenses')}
              value={formatMoney(report.data?.totalExpense ?? 0)}
              tone="negative"
            />
            <StatCard
              label={t('reports.incomeStatement.netIncome')}
              value={formatMoney(netIncome)}
              tone={netIncome >= 0 ? 'positive' : 'negative'}
              hint={
                report.data?.totalRevenue
                  ? t('reports.incomeStatement.netMargin', {
                      value: ((netIncome / report.data.totalRevenue) * 100).toFixed(1),
                    })
                  : undefined
              }
            />
          </div>
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          title={t('reports.incomeStatement.revenue')}
          rows={report.data?.revenues ?? []}
          total={report.data?.totalRevenue ?? 0}
          tone="positive"
        />
        <Section
          title={t('reports.incomeStatement.expenses')}
          rows={report.data?.expenses ?? []}
          total={report.data?.totalExpense ?? 0}
          tone="negative"
        />
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('reports.incomeStatement.netIncome')}
            </p>
            <p className={`text-2xl font-semibold tabular-nums ${netIncome >= 0 ? 'text-success' : 'text-destructive'}`}>
              {formatMoney(netIncome)}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            {t('reports.incomeStatement.formula', {
              revenue: formatMoney(report.data?.totalRevenue ?? 0),
              expenses: formatMoney(report.data?.totalExpense ?? 0),
            })}
          </p>
        </CardContent>
      </Card>
    </ReportPage>
  )
}
