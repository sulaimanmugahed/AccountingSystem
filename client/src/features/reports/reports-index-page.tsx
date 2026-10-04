import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  Banknote,
  BookOpen,
  Clock,
  Landmark,
  Scale,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Money, StatCard } from '@/components/common/misc'
import { useApAging, useArAging, useBalanceSheet, useIncomeStatement, useTrialBalance } from '@/hooks/queries'
import { endOfMonth, formatDate, formatMoney, startOfYear, today } from '@/lib/format'

const reports = [
  {
    title: 'Trial balance',
    description: 'Debit and credit movement per account — verifies the ledger balances.',
    href: '/reports/trial-balance',
    icon: Scale,
  },
  {
    title: 'Income statement',
    description: 'Revenue and expenses for a period, with net income and margin.',
    href: '/reports/income-statement',
    icon: TrendingUp,
  },
  {
    title: 'Balance sheet',
    description: 'Assets, liabilities and equity as of a date, including current-year earnings.',
    href: '/reports/balance-sheet',
    icon: Landmark,
  },
  {
    title: 'General ledger detail',
    description: 'Every posted line for a single account with a running balance.',
    href: '/reports/general-ledger',
    icon: BookOpen,
  },
  {
    title: 'AR aging',
    description: 'Customer balances bucketed by days past due.',
    href: '/reports/ar-aging',
    icon: Wallet,
  },
  {
    title: 'AP aging',
    description: 'Vendor balances bucketed by days past due.',
    href: '/reports/ap-aging',
    icon: Banknote,
  },
  {
    title: 'Cash flow statement',
    description: 'Indirect-method operating cash flow with changes in working capital.',
    href: '/reports/cash-flow',
    icon: BarChart3,
  },
]

export function ReportsIndexPage() {
  const asOf = today()
  const trialBalance = useTrialBalance(asOf)
  const balanceSheet = useBalanceSheet(asOf)
  const incomeStatement = useIncomeStatement(startOfYear(), endOfMonth())
  const arAging = useArAging(asOf)
  const apAging = useApAging(asOf)

  const balanced = Math.abs((trialBalance.data?.totalDebit ?? 0) - (trialBalance.data?.totalCredit ?? 0)) < 0.01

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports & financial statements"
        description={`Statements are computed live from the posted journal as of ${formatDate(asOf)} — there are no stored report snapshots to reconcile.`}
        breadcrumbs={[{ label: 'Reports' }]}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total assets"
          value={formatMoney(balanceSheet.data?.totalAssets ?? 0)}
          hint="Balance sheet"
          icon={Landmark}
        />
        <StatCard
          label="Net income (YTD)"
          value={formatMoney(incomeStatement.data?.netIncome ?? 0)}
          tone={(incomeStatement.data?.netIncome ?? 0) >= 0 ? 'positive' : 'negative'}
          hint="Income statement"
          icon={TrendingUp}
        />
        <StatCard label="Open AR" value={formatMoney(arAging.data?.grandTotal ?? 0)} hint="Receivables aging" icon={Wallet} />
        <StatCard label="Open AP" value={formatMoney(apAging.data?.grandTotal ?? 0)} hint="Payables aging" icon={Banknote} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">Ledger integrity</CardTitle>
          <Badge variant={balanced ? 'success' : 'destructive'}>
            {balanced ? 'Trial balance is balanced' : 'Out of balance'}
          </Badge>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total debits</p>
            <p className="text-lg font-semibold tabular-nums">
              <Money value={trialBalance.data?.totalDebit ?? 0} />
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total credits</p>
            <p className="text-lg font-semibold tabular-nums">
              <Money value={trialBalance.data?.totalCredit ?? 0} />
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Period covered</p>
            <p className="text-sm font-medium">
              {formatDate(incomeStatement.data?.startDate ?? startOfYear())} →{' '}
              {formatDate(incomeStatement.data?.endDate ?? endOfMonth())}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {reports.map((report) => (
          <Card key={report.href} className="transition-shadow hover:shadow-md">
            <CardContent className="flex h-full flex-col justify-between gap-4 p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-muted p-2">
                  <report.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">{report.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{report.description}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="w-fit" asChild>
                <Link to={report.href}>
                  Open <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
        <Card className="border-dashed">
          <CardContent className="flex h-full items-start gap-3 p-5">
            <div className="rounded-lg bg-muted p-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">Period close workflow</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Close a period or fiscal year from General Ledger → Fiscal Periods. Year-end closing rolls results into
                retained earnings.
              </p>
              <Button variant="ghost" size="sm" className="mt-3" asChild>
                <Link to="/gl/fiscal-periods">
                  Manage periods <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
