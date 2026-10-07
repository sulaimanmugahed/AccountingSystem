import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Money } from '@/components/common/misc'
import { useTrialBalance } from '@/hooks/queries'
import { downloadCsv } from '@/lib/csv'
import { formatMoney, today } from '@/lib/format'
import { ReportPage, ReportTableShell, DateRangeControls } from '@/features/reports/report-shell'

export function TrialBalancePage() {
  const { t } = useTranslation()
  const [asOfDate, setAsOfDate] = useState(today())
  const report = useTrialBalance(asOfDate)

  const rows = report.data?.rows ?? []
  const balanced = Math.abs((report.data?.totalDebit ?? 0) - (report.data?.totalCredit ?? 0)) < 0.01

  return (
    <ReportPage
      title={t('reports.trialBalance.title')}
      description={t('reports.trialBalance.description')}
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
      controls={
        <DateRangeControls
          from=""
          to={asOfDate}
          onToChange={setAsOfDate}
          toLabel={t('common.asOf')}
        />
      }
      actions={
        <Badge variant={balanced ? 'success' : 'destructive'}>
          {balanced ? t('reports.indexStats.balanced') : t('reports.indexStats.outOfBalance')}
        </Badge>
      }
    >
      <ReportTableShell
        footer={
          <div className="flex flex-wrap items-center justify-between gap-4 border-t bg-muted/50 px-4 py-3 text-sm font-medium">
            <span className="text-muted-foreground">{t('reports.trialBalance.totals')}</span>
            <div className="flex gap-8 tabular-nums">
              <span>
                {t('reports.trialBalance.debits', {
                  amount: formatMoney(report.data?.totalDebit ?? 0),
                })}
              </span>
              <span>
                {t('reports.trialBalance.credits', {
                  amount: formatMoney(report.data?.totalCredit ?? 0),
                })}
              </span>
            </div>
          </div>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[110px]">{t('reports.trialBalance.code')}</TableHead>
              <TableHead>{t('reports.trialBalance.account')}</TableHead>
              <TableHead>{t('reports.trialBalance.type')}</TableHead>
              <TableHead className="text-end">{t('reports.trialBalance.debit')}</TableHead>
              <TableHead className="text-end">{t('reports.trialBalance.credit')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                  {t('reports.trialBalance.noActivity', { date: asOfDate })}
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
                  <TableCell className="text-end">
                    {row.debit ? (
                      <Money value={row.debit} />
                    ) : (
                      <span className="text-muted-foreground">{t('common.dash')}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-end">
                    {row.credit ? (
                      <Money value={row.credit} />
                    ) : (
                      <span className="text-muted-foreground">{t('common.dash')}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {rows.length ? (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3}>{t('reports.trialBalance.total')}</TableCell>
                <TableCell className="text-end">
                  <Money value={report.data?.totalDebit ?? 0} />
                </TableCell>
                <TableCell className="text-end">
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
