import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/card'
import { Money, StatCard, SummaryRow } from '@/components/common/misc'
import { useCashFlow } from '@/hooks/queries'
import { downloadCsv } from '@/lib/csv'
import { endOfMonth, formatDate, formatMoney, startOfYear } from '@/lib/format'
import { DateRangeControls, ReportPage, ReportTableShell } from '@/features/reports/report-shell'

export function CashFlowPage() {
  const { t } = useTranslation()
  const [startDate, setStartDate] = useState(startOfYear())
  const [endDate, setEndDate] = useState(endOfMonth())
  const report = useCashFlow(startDate, endDate)

  const data = report.data

  const exportRows: Array<[string, number]> = data
    ? [
        [t('reports.cashFlow.netIncome'), data.netIncome],
        [t('reports.cashFlow.addBackDepreciation'), data.depreciation],
        [t('reports.cashFlow.changeInAr'), -data.changeInAccountsReceivable],
        [t('reports.cashFlow.changeInInventory'), -data.changeInInventory],
        [t('reports.cashFlow.changeInAp'), data.changeInAccountsPayable],
        [t('reports.cashFlow.netCashFromOperations'), data.netCashFromOperations],
        [t('reports.cashFlow.netCashFromInvesting'), data.netCashFromInvesting],
        [t('reports.cashFlow.netCashFromFinancing'), data.netCashFromFinancing],
        [t('reports.cashFlow.netChangeInCash'), data.netChangeInCash],
        [t('reports.cashFlow.beginningCash'), data.beginningCash],
        [t('reports.cashFlow.endingCash'), data.endingCash],
      ]
    : []

  return (
    <ReportPage
      title={t('reports.cashFlow.title')}
      description={t('reports.cashFlow.description', {
        from: formatDate(startDate),
        to: formatDate(endDate),
      })}
      onRefresh={() => report.refetch()}
      isLoading={report.isLoading}
      error={report.error}
      onExport={() =>
        downloadCsv(
          `cash-flow-${startDate}-to-${endDate}`,
          [t('reports.cashFlow.line'), t('reports.cashFlow.amount')],
          exportRows,
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
              label={t('reports.cashFlow.cashFromOperations')}
              value={formatMoney(data?.netCashFromOperations ?? 0)}
              tone={(data?.netCashFromOperations ?? 0) >= 0 ? 'positive' : 'negative'}
            />
            <StatCard
              label={t('reports.cashFlow.beginningCash')}
              value={formatMoney(data?.beginningCash ?? 0)}
            />
            <StatCard label={t('reports.cashFlow.endingCash')} value={formatMoney(data?.endingCash ?? 0)} />
          </div>
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <ReportTableShell>
          <div className="border-b bg-muted/50 px-4 py-2.5 text-sm font-semibold">
            {t('reports.cashFlow.operatingActivities')}
          </div>
          <div className="p-4">
            <SummaryRow
              label={t('reports.cashFlow.netIncome')}
              value={<Money value={data?.netIncome ?? 0} />}
            />
            <SummaryRow
              label={t('reports.cashFlow.addBackDepreciation')}
              value={<Money value={data?.depreciation ?? 0} />}
            />
            <SummaryRow
              label={t('reports.cashFlow.changeInAr')}
              value={<Money value={-(data?.changeInAccountsReceivable ?? 0)} />}
            />
            <SummaryRow
              label={t('reports.cashFlow.changeInInventory')}
              value={<Money value={-(data?.changeInInventory ?? 0)} />}
            />
            <SummaryRow
              label={t('reports.cashFlow.changeInAp')}
              value={<Money value={data?.changeInAccountsPayable ?? 0} />}
            />
            <SummaryRow
              label={t('reports.cashFlow.netCashFromOperations')}
              value={<Money value={data?.netCashFromOperations ?? 0} />}
              strong
            />
          </div>
        </ReportTableShell>

        <div className="space-y-4">
          <ReportTableShell>
            <div className="border-b bg-muted/50 px-4 py-2.5 text-sm font-semibold">
              {t('reports.cashFlow.investingActivities')}
            </div>
            <div className="p-4">
              <SummaryRow
                label={t('reports.cashFlow.netCashFromInvesting')}
                value={<Money value={data?.netCashFromInvesting ?? 0} />}
                strong
              />
              <p className="pt-2 text-xs text-muted-foreground">{t('reports.cashFlow.investingHint')}</p>
            </div>
          </ReportTableShell>

          <ReportTableShell>
            <div className="border-b bg-muted/50 px-4 py-2.5 text-sm font-semibold">
              {t('reports.cashFlow.financingActivities')}
            </div>
            <div className="p-4">
              <SummaryRow
                label={t('reports.cashFlow.netCashFromFinancing')}
                value={<Money value={data?.netCashFromFinancing ?? 0} />}
                strong
              />
              <p className="pt-2 text-xs text-muted-foreground">{t('reports.cashFlow.financingHint')}</p>
            </div>
          </ReportTableShell>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('reports.cashFlow.netChangeInCash')}
            </p>
            <p className="text-xl font-semibold tabular-nums">{formatMoney(data?.netChangeInCash ?? 0)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('reports.cashFlow.beginningCash')}
            </p>
            <p className="text-xl font-semibold tabular-nums">{formatMoney(data?.beginningCash ?? 0)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('reports.cashFlow.endingCashBank')}
            </p>
            <p className="text-xl font-semibold tabular-nums text-success">{formatMoney(data?.endingCash ?? 0)}</p>
          </div>
        </CardContent>
      </Card>
    </ReportPage>
  )
}
