import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Banknote,
  BookOpen,
  FileText,
  Landmark,
  Percent,
  Scale,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Money, SectionCard, StatCard } from '@/components/common/misc'
import { useApAging, useArAging, useBalanceSheet, useIncomeStatement, useJournalEntries } from '@/hooks/queries'
import { journalSourceTypeLabels } from '@/lib/enums'
import { endOfMonth, formatDate, formatMoney, startOfYear, today } from '@/lib/format'
import { cn } from '@/lib/utils'

export function DashboardPage() {
  const asOf = today()
  const periodStart = startOfYear()
  const periodEnd = endOfMonth()

  const balanceSheet = useBalanceSheet(asOf)
  const incomeStatement = useIncomeStatement(periodStart, periodEnd)
  const arAging = useArAging(asOf)
  const apAging = useApAging(asOf)
  const recentEntries = useJournalEntries({})

  const netIncome = incomeStatement.data?.netIncome ?? 0
  const cash = balanceSheet.data?.assets.find((row) => row.accountCode === '1000')?.amount ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial overview"
        description={`Live position as of ${formatDate(asOf)} — computed straight from the posted journal.`}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link to="/reports">
                <Scale className="h-4 w-4" /> All reports
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/gl/journal-entries">
                <BookOpen className="h-4 w-4" /> Journal
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Revenue (YTD to date)"
          value={formatMoney(incomeStatement.data?.totalRevenue ?? 0)}
          hint={`${formatDate(periodStart)} → ${formatDate(periodEnd)}`}
          icon={TrendingUp}
        />
        <StatCard
          label="Net income (YTD)"
          value={formatMoney(netIncome)}
          tone={netIncome >= 0 ? 'positive' : 'negative'}
          hint="Revenue less operating expenses"
          icon={TrendingUp}
        />
        <StatCard
          label="Accounts receivable"
          value={formatMoney(arAging.data?.grandTotal ?? 0)}
          hint={`${arAging.data?.rows.length ?? 0} customer(s) with open invoices`}
          icon={Users}
        />
        <StatCard
          label="Accounts payable"
          value={formatMoney(apAging.data?.grandTotal ?? 0)}
          hint={`${apAging.data?.rows.length ?? 0} vendor(s) with open bills`}
          icon={Banknote}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard
          title="Balance sheet snapshot"
          description={`As of ${formatDate(asOf)}`}
          actions={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/reports/balance-sheet">
                Details <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          }
          className="lg:col-span-2"
        >
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Assets</p>
              <p className="text-lg font-semibold tabular-nums">{formatMoney(balanceSheet.data?.totalAssets ?? 0)}</p>
              <div className="space-y-1 text-xs text-muted-foreground">
                {(balanceSheet.data?.assets ?? []).slice(0, 5).map((row) => (
                  <div key={row.accountCode} className="flex justify-between gap-3">
                    <span className="truncate">
                      {row.accountCode} {row.accountName}
                    </span>
                    <span className="tabular-nums">{formatMoney(row.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Liabilities</p>
              <p className="text-lg font-semibold tabular-nums">{formatMoney(balanceSheet.data?.totalLiabilities ?? 0)}</p>
              <div className="space-y-1 text-xs text-muted-foreground">
                {(balanceSheet.data?.liabilities ?? []).length === 0 ? (
                  <p>No open liabilities.</p>
                ) : (
                  (balanceSheet.data?.liabilities ?? []).map((row) => (
                    <div key={row.accountCode} className="flex justify-between gap-3">
                      <span className="truncate">
                        {row.accountCode} {row.accountName}
                      </span>
                      <span className="tabular-nums">{formatMoney(row.amount)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Equity</p>
              <p className="text-lg font-semibold tabular-nums">{formatMoney(balanceSheet.data?.totalEquity ?? 0)}</p>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between gap-3">
                  <span>Opening equity & retained</span>
                  <span className="tabular-nums">
                    {formatMoney(balanceSheet.data?.totalEquityExcludingNetIncome ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>Current year earnings</span>
                  <span className="tabular-nums">{formatMoney(balanceSheet.data?.netIncomeYearToDate ?? 0)}</span>
                </div>
              </div>
              <Separator className="my-1" />
              <div className="flex justify-between gap-3 text-xs">
                <span className="text-muted-foreground">Liabilities + equity</span>
                <span className="font-medium tabular-nums">
                  {formatMoney(balanceSheet.data?.totalLiabilitiesAndEquity ?? 0)}
                </span>
              </div>
              <p
                className={cn(
                  'text-xs font-medium',
                  Math.abs(
                    (balanceSheet.data?.totalAssets ?? 0) - (balanceSheet.data?.totalLiabilitiesAndEquity ?? 0),
                  ) < 0.01
                    ? 'text-success'
                    : 'text-destructive',
                )}
              >
                {Math.abs(
                  (balanceSheet.data?.totalAssets ?? 0) - (balanceSheet.data?.totalLiabilitiesAndEquity ?? 0),
                ) < 0.01
                  ? 'Books balance ✓'
                  : 'Out of balance — review the journal'}
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Cash position" description="Bank & cash GL accounts">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-muted p-2">
                <Landmark className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Cash and bank</p>
                <p className="text-xl font-semibold tabular-nums">{formatMoney(cash)}</p>
              </div>
            </div>
            <Separator />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Net cash from operations (YTD)</span>
                <span className="tabular-nums">
                  {formatMoney(incomeStatement.data?.netIncome ?? 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total expenses (YTD)</span>
                <span className="tabular-nums">{formatMoney(incomeStatement.data?.totalExpense ?? 0)}</span>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link to="/reports/cash-flow">
                <TrendingDown className="h-4 w-4" /> Cash flow statement
              </Link>
            </Button>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard
          title="Recent journal activity"
          description="Latest 6 postings"
          actions={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/gl/journal-entries">
                Open ledger <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          }
          className="lg:col-span-2"
          contentClassName="p-0"
        >
          <div className="divide-y">
            {(recentEntries.data ?? []).slice(0, 6).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    <span className="font-mono text-xs">{entry.entryNumber}</span> · {entry.memo || 'Journal entry'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(entry.entryDate)} · {journalSourceTypeLabels[entry.sourceType]}
                  </p>
                </div>
                <div className="text-right">
                  <Money value={entry.totalDebit} className="text-sm font-medium" />
                  <p className="text-xs text-muted-foreground">{entry.lines.length} lines</p>
                </div>
              </div>
            ))}
            {(recentEntries.data ?? []).length === 0 && !recentEntries.isLoading ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">No journal activity yet.</p>
            ) : null}
          </div>
        </SectionCard>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {[
              { to: '/ar/invoices', label: 'Create an invoice', icon: FileText },
              { to: '/ap/bills', label: 'Enter a vendor bill', icon: Users },
              { to: '/ar/payments', label: 'Record a customer payment', icon: Banknote },
              { to: '/gl/journal-entries', label: 'Post a manual journal', icon: BookOpen },
              { to: '/tax/codes', label: 'Manage tax codes', icon: Percent },
            ].map((action) => (
              <Button key={action.to} variant="outline" className="justify-start" asChild>
                <Link to={action.to}>
                  <action.icon className="h-4 w-4" /> {action.label}
                </Link>
              </Button>
            ))}
            <Badge variant="secondary" className="mt-2 w-fit">
              Role-based access enforced client & server side
            </Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
