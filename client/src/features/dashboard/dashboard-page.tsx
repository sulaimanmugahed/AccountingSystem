import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
import { useLabels } from '@/lib/labels'
import { endOfMonth, formatDate, formatMoney, startOfYear, today } from '@/lib/format'
import { cn } from '@/lib/utils'

export function DashboardPage() {
  const { t } = useTranslation()
  const labels = useLabels()
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
        title={t('dashboard.title')}
        description={t('dashboard.description', { date: formatDate(asOf) })}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link to="/reports">
                <Scale className="h-4 w-4" /> {t('dashboard.allReports')}
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/gl/journal-entries">
                <BookOpen className="h-4 w-4" /> {t('dashboard.journal')}
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('dashboard.revenueYtd')}
          value={formatMoney(incomeStatement.data?.totalRevenue ?? 0)}
          hint={`${formatDate(periodStart)} → ${formatDate(periodEnd)}`}
          icon={TrendingUp}
        />
        <StatCard
          label={t('dashboard.netIncomeYtd')}
          value={formatMoney(netIncome)}
          tone={netIncome >= 0 ? 'positive' : 'negative'}
          hint={t('dashboard.netIncomeHint')}
          icon={TrendingUp}
        />
        <StatCard
          label={t('dashboard.receivable')}
          value={formatMoney(arAging.data?.grandTotal ?? 0)}
          hint={t('dashboard.receivableHint', { count: arAging.data?.rows.length ?? 0 })}
          icon={Users}
        />
        <StatCard
          label={t('dashboard.payable')}
          value={formatMoney(apAging.data?.grandTotal ?? 0)}
          hint={t('dashboard.payableHint', { count: apAging.data?.rows.length ?? 0 })}
          icon={Banknote}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard
          title={t('dashboard.balanceSheetSnapshot')}
          description={t('dashboard.asOf', { date: formatDate(asOf) })}
          actions={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/reports/balance-sheet">
                {t('common.details')} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          }
          className="lg:col-span-2"
        >
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('dashboard.assets')}</p>
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
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('dashboard.liabilities')}</p>
              <p className="text-lg font-semibold tabular-nums">{formatMoney(balanceSheet.data?.totalLiabilities ?? 0)}</p>
              <div className="space-y-1 text-xs text-muted-foreground">
                {(balanceSheet.data?.liabilities ?? []).length === 0 ? (
                  <p>{t('dashboard.noLiabilities')}</p>
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
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('dashboard.equity')}</p>
              <p className="text-lg font-semibold tabular-nums">{formatMoney(balanceSheet.data?.totalEquity ?? 0)}</p>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between gap-3">
                  <span>{t('dashboard.openingEquity')}</span>
                  <span className="tabular-nums">
                    {formatMoney(balanceSheet.data?.totalEquityExcludingNetIncome ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>{t('dashboard.currentYearEarnings')}</span>
                  <span className="tabular-nums">{formatMoney(balanceSheet.data?.netIncomeYearToDate ?? 0)}</span>
                </div>
              </div>
              <Separator className="my-1" />
              <div className="flex justify-between gap-3 text-xs">
                <span className="text-muted-foreground">{t('dashboard.liabilitiesAndEquity')}</span>
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
                  ? t('dashboard.booksBalance')
                  : t('dashboard.outOfBalance')}
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title={t('dashboard.cashPosition')} description={t('dashboard.cashPositionHint')}>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-muted p-2">
                <Landmark className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('dashboard.cashAndBank')}</p>
                <p className="text-xl font-semibold tabular-nums">{formatMoney(cash)}</p>
              </div>
            </div>
            <Separator />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('dashboard.netCashOperations')}</span>
                <span className="tabular-nums">
                  {formatMoney(incomeStatement.data?.netIncome ?? 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('dashboard.totalExpenses')}</span>
                <span className="tabular-nums">{formatMoney(incomeStatement.data?.totalExpense ?? 0)}</span>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link to="/reports/cash-flow">
                <TrendingDown className="h-4 w-4" /> {t('dashboard.cashFlowStatement')}
              </Link>
            </Button>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard
          title={t('dashboard.recentActivity')}
          description={t('dashboard.latestPostings')}
          actions={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/gl/journal-entries">
                {t('dashboard.openLedger')} <ArrowRight className="h-4 w-4" />
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
                    <span className="font-mono text-xs">{entry.entryNumber}</span> ·{' '}
                    {entry.memo || t('dashboard.journalEntryFallback')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(entry.entryDate)} · {labels.journalSourceType[entry.sourceType]}
                  </p>
                </div>
                <div className="text-end">
                  <Money value={entry.totalDebit} className="text-sm font-medium" />
                  <p className="text-xs text-muted-foreground">
                    {t('dashboard.lineCount', { count: entry.lines.length })}
                  </p>
                </div>
              </div>
            ))}
            {(recentEntries.data ?? []).length === 0 && !recentEntries.isLoading ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">{t('dashboard.noActivity')}</p>
            ) : null}
          </div>
        </SectionCard>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{t('dashboard.quickActions')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {[
              { to: '/ar/invoices', label: t('dashboard.createInvoice'), icon: FileText },
              { to: '/ap/bills', label: t('dashboard.enterBill'), icon: Users },
              { to: '/ar/payments', label: t('dashboard.recordPayment'), icon: Banknote },
              { to: '/gl/journal-entries', label: t('dashboard.postJournal'), icon: BookOpen },
              { to: '/tax/codes', label: t('dashboard.manageTaxCodes'), icon: Percent },
            ].map((action) => (
              <Button key={action.to} variant="outline" className="justify-start" asChild>
                <Link to={action.to}>
                  <action.icon className="h-4 w-4" /> {action.label}
                </Link>
              </Button>
            ))}
            <Badge variant="secondary" className="mt-2 w-fit">
              {t('dashboard.roleNotice')}
            </Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
