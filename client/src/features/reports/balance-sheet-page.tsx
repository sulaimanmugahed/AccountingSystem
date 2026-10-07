import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Money, StatCard } from '@/components/common/misc'
import { useBalanceSheet } from '@/hooks/queries'
import { downloadCsv } from '@/lib/csv'
import { formatDate, formatMoney, today } from '@/lib/format'
import { cn } from '@/lib/utils'
import { DateRangeControls, ReportPage, ReportTableShell } from '@/features/reports/report-shell'
import type { BalanceSheetRow } from '@/lib/types'

function Section({ title, rows, total }: { title: string; rows: BalanceSheetRow[]; total: number }) {
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
                {t('reports.balanceSheet.noBalances')}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.accountCode} className="border-b last:border-0">
                <td className="px-4 py-2 text-muted-foreground">
                  <span className="font-mono text-xs">{row.accountCode}</span> {row.accountName}
                </td>
                <td className="px-4 py-2 text-end">
                  <Money value={row.amount} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </ReportTableShell>
  )
}

export function BalanceSheetPage() {
  const { t } = useTranslation()
  const [asOfDate, setAsOfDate] = useState(today())
  const report = useBalanceSheet(asOfDate)

  const difference = (report.data?.totalAssets ?? 0) - (report.data?.totalLiabilitiesAndEquity ?? 0)
  const balanced = Math.abs(difference) < 0.01

  return (
    <ReportPage
      title={t('reports.balanceSheet.title')}
      description={t('reports.balanceSheet.description', { date: formatDate(asOfDate) })}
      onRefresh={() => report.refetch()}
      isLoading={report.isLoading}
      error={report.error}
      actions={
        <Badge variant={balanced ? 'success' : 'destructive'}>
          {balanced ? t('reports.indexStats.balanced') : t('reports.indexStats.outOfBalance')}
        </Badge>
      }
      onExport={() =>
        downloadCsv(
          `balance-sheet-${asOfDate}`,
          ['Section', 'Account code', 'Account name', 'Amount'],
          [
            ...(report.data?.assets ?? []).map((row) => ['Asset', row.accountCode, row.accountName, row.amount]),
            ...(report.data?.liabilities ?? []).map((row) => ['Liability', row.accountCode, row.accountName, row.amount]),
            ...(report.data?.equity ?? []).map((row) => ['Equity', row.accountCode, row.accountName, row.amount]),
            ['Equity', '', 'Current year earnings', report.data?.netIncomeYearToDate ?? 0],
          ],
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
              label={t('reports.balanceSheet.totalAssets')}
              value={formatMoney(report.data?.totalAssets ?? 0)}
            />
            <StatCard
              label={t('reports.balanceSheet.totalLiabilities')}
              value={formatMoney(report.data?.totalLiabilities ?? 0)}
            />
            <StatCard
              label={t('reports.balanceSheet.totalEquity')}
              value={formatMoney(report.data?.totalEquity ?? 0)}
              tone="positive"
            />
          </div>
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <Section
          title={t('reports.balanceSheet.assets')}
          rows={report.data?.assets ?? []}
          total={report.data?.totalAssets ?? 0}
        />
        <Section
          title={t('reports.balanceSheet.liabilities')}
          rows={report.data?.liabilities ?? []}
          total={report.data?.totalLiabilities ?? 0}
        />
        <div className="space-y-4">
          <Section
            title={t('reports.balanceSheet.equity')}
            rows={report.data?.equity ?? []}
            total={report.data?.totalEquityExcludingNetIncome ?? 0}
          />
          <ReportTableShell>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b">
                  <td className="px-4 py-2 text-muted-foreground">
                    {t('reports.balanceSheet.currentYearEarnings')}
                  </td>
                  <td className="px-4 py-2 text-end">
                    <Money value={report.data?.netIncomeYearToDate ?? 0} />
                  </td>
                </tr>
                <tr className="bg-muted/40 font-medium">
                  <td className="px-4 py-2">{t('reports.balanceSheet.totalEquityLine')}</td>
                  <td className="px-4 py-2 text-end">
                    <Money value={report.data?.totalEquity ?? 0} />
                  </td>
                </tr>
              </tbody>
            </table>
          </ReportTableShell>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('reports.balanceSheet.totalAssets')}
            </p>
            <p className="text-xl font-semibold tabular-nums">{formatMoney(report.data?.totalAssets ?? 0)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('reports.balanceSheet.totalLiabilitiesEquity')}
            </p>
            <p className="text-xl font-semibold tabular-nums">
              {formatMoney(report.data?.totalLiabilitiesAndEquity ?? 0)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('reports.balanceSheet.difference')}
            </p>
            <p className={cn('text-xl font-semibold tabular-nums', balanced ? 'text-success' : 'text-destructive')}>
              {formatMoney(difference)}
            </p>
          </div>
        </CardContent>
      </Card>
    </ReportPage>
  )
}
