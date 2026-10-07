import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
    titleKey: 'reports.trialBalance.title',
    descriptionKey: 'reports.indexStats.hintTrialBalance',
    href: '/reports/trial-balance',
    icon: Scale,
  },
  {
    titleKey: 'reports.incomeStatement.title',
    descriptionKey: 'reports.indexStats.hintIncomeStatement',
    href: '/reports/income-statement',
    icon: TrendingUp,
  },
  {
    titleKey: 'reports.balanceSheet.title',
    descriptionKey: 'reports.indexStats.hintBalanceSheet',
    href: '/reports/balance-sheet',
    icon: Landmark,
  },
  {
    titleKey: 'reports.generalLedger.title',
    descriptionKey: 'reports.indexStats.hintGeneralLedger',
    href: '/reports/general-ledger',
    icon: BookOpen,
  },
  {
    titleKey: 'reports.arAging.title',
    descriptionKey: 'reports.indexStats.hintArAging',
    href: '/reports/ar-aging',
    icon: Wallet,
  },
  {
    titleKey: 'reports.apAging.title',
    descriptionKey: 'reports.indexStats.hintApAging',
    href: '/reports/ap-aging',
    icon: Banknote,
  },
  {
    titleKey: 'reports.cashFlow.title',
    descriptionKey: 'reports.indexStats.hintCashFlow',
    href: '/reports/cash-flow',
    icon: BarChart3,
  },
]

export function ReportsIndexPage() {
  const { t } = useTranslation()
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
        title={t('reports.index.title')}
        description={t('reports.index.description', { date: formatDate(asOf) })}
        breadcrumbs={[{ label: t('nav.items.reports') }]}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('reports.indexStats.totalAssets')}
          value={formatMoney(balanceSheet.data?.totalAssets ?? 0)}
          hint={t('reports.indexStats.hintBalanceSheet')}
          icon={Landmark}
        />
        <StatCard
          label={t('reports.indexStats.netIncomeYtd')}
          value={formatMoney(incomeStatement.data?.netIncome ?? 0)}
          tone={(incomeStatement.data?.netIncome ?? 0) >= 0 ? 'positive' : 'negative'}
          hint={t('reports.indexStats.hintIncomeStatement')}
          icon={TrendingUp}
        />
        <StatCard
          label={t('reports.indexStats.openAr')}
          value={formatMoney(arAging.data?.grandTotal ?? 0)}
          hint={t('reports.indexStats.hintArAging')}
          icon={Wallet}
        />
        <StatCard
          label={t('reports.indexStats.openAp')}
          value={formatMoney(apAging.data?.grandTotal ?? 0)}
          hint={t('reports.indexStats.hintApAging')}
          icon={Banknote}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">{t('reports.indexStats.ledgerIntegrity')}</CardTitle>
          <Badge variant={balanced ? 'success' : 'destructive'}>
            {balanced
              ? t('reports.indexStats.trialBalanceBalanced')
              : t('reports.indexStats.outOfBalance')}
          </Badge>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('reports.indexStats.totalDebits')}
            </p>
            <p className="text-lg font-semibold tabular-nums">
              <Money value={trialBalance.data?.totalDebit ?? 0} />
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('reports.indexStats.totalCredits')}
            </p>
            <p className="text-lg font-semibold tabular-nums">
              <Money value={trialBalance.data?.totalCredit ?? 0} />
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('reports.indexStats.periodCovered')}
            </p>
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
                  <p className="font-medium">{t(report.titleKey)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t(report.descriptionKey)}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="w-fit" asChild>
                <Link to={report.href}>
                  {t('reports.indexStats.open')} <ArrowRight className="h-4 w-4" />
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
              <p className="font-medium">{t('reports.indexStats.closeWorkflowTitle')}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('reports.indexStats.closeWorkflowDescription')}
              </p>
              <Button variant="ghost" size="sm" className="mt-3" asChild>
                <Link to="/gl/fiscal-periods">
                  {t('reports.indexStats.managePeriods')} <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
