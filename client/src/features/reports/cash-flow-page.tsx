import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Money, StatCard, SummaryRow } from '@/components/common/misc'
import { useCashFlow } from '@/hooks/queries'
import { downloadCsv } from '@/lib/csv'
import { endOfMonth, formatDate, formatMoney, startOfYear } from '@/lib/format'
import { DateRangeControls, ReportPage, ReportTableShell } from '@/features/reports/report-shell'

export function CashFlowPage() {
  const [startDate, setStartDate] = useState(startOfYear())
  const [endDate, setEndDate] = useState(endOfMonth())
  const report = useCashFlow(startDate, endDate)

  const data = report.data

  const exportRows: Array<[string, number]> = data
    ? [
        ['Net income', data.netIncome],
        ['Depreciation', data.depreciation],
        ['Change in accounts receivable', -data.changeInAccountsReceivable],
        ['Change in inventory', -data.changeInInventory],
        ['Change in accounts payable', data.changeInAccountsPayable],
        ['Net cash from operations', data.netCashFromOperations],
        ['Net cash from investing', data.netCashFromInvesting],
        ['Net cash from financing', data.netCashFromFinancing],
        ['Net change in cash', data.netChangeInCash],
        ['Beginning cash', data.beginningCash],
        ['Ending cash', data.endingCash],
      ]
    : []

  return (
    <ReportPage
      title="Cash flow statement"
      description={`Indirect-method cash flow for ${formatDate(startDate)} → ${formatDate(endDate)}. Investing and financing lines are only populated where the ledger tracks them explicitly.`}
      onRefresh={() => report.refetch()}
      isLoading={report.isLoading}
      error={report.error}
      onExport={() => downloadCsv(`cash-flow-${startDate}-to-${endDate}`, ['Line', 'Amount'], exportRows)}
      controls={
        <>
          <DateRangeControls from={startDate} to={endDate} onFromChange={setStartDate} onToChange={setEndDate} toLabel="To" />
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard
              label="Cash from operations"
              value={formatMoney(data?.netCashFromOperations ?? 0)}
              tone={(data?.netCashFromOperations ?? 0) >= 0 ? 'positive' : 'negative'}
            />
            <StatCard label="Beginning cash" value={formatMoney(data?.beginningCash ?? 0)} />
            <StatCard label="Ending cash" value={formatMoney(data?.endingCash ?? 0)} />
          </div>
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <ReportTableShell>
          <div className="border-b bg-muted/50 px-4 py-2.5 text-sm font-semibold">Operating activities</div>
          <div className="p-4">
            <SummaryRow label="Net income" value={<Money value={data?.netIncome ?? 0} />} />
            <SummaryRow label="Add back depreciation" value={<Money value={data?.depreciation ?? 0} />} />
            <SummaryRow
              label="Change in accounts receivable"
              value={<Money value={-(data?.changeInAccountsReceivable ?? 0)} />}
            />
            <SummaryRow label="Change in inventory" value={<Money value={-(data?.changeInInventory ?? 0)} />} />
            <SummaryRow label="Change in accounts payable" value={<Money value={data?.changeInAccountsPayable ?? 0} />} />
            <SummaryRow
              label="Net cash from operations"
              value={<Money value={data?.netCashFromOperations ?? 0} />}
              strong
            />
          </div>
        </ReportTableShell>

        <div className="space-y-4">
          <ReportTableShell>
            <div className="border-b bg-muted/50 px-4 py-2.5 text-sm font-semibold">Investing activities</div>
            <div className="p-4">
              <SummaryRow label="Net cash from investing" value={<Money value={data?.netCashFromInvesting ?? 0} />} strong />
              <p className="pt-2 text-xs text-muted-foreground">
                Fixed-asset purchases and disposals are not separated in this simplified statement.
              </p>
            </div>
          </ReportTableShell>

          <ReportTableShell>
            <div className="border-b bg-muted/50 px-4 py-2.5 text-sm font-semibold">Financing activities</div>
            <div className="p-4">
              <SummaryRow label="Net cash from financing" value={<Money value={data?.netCashFromFinancing ?? 0} />} strong />
              <p className="pt-2 text-xs text-muted-foreground">
                Equity injections and owner draws are treated as financing only where mapped.
              </p>
            </div>
          </ReportTableShell>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Net change in cash</p>
            <p className="text-xl font-semibold tabular-nums">{formatMoney(data?.netChangeInCash ?? 0)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Beginning cash</p>
            <p className="text-xl font-semibold tabular-nums">{formatMoney(data?.beginningCash ?? 0)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Ending cash (bank GL accounts)</p>
            <p className="text-xl font-semibold tabular-nums text-success">{formatMoney(data?.endingCash ?? 0)}</p>
          </div>
        </CardContent>
      </Card>
    </ReportPage>
  )
}
