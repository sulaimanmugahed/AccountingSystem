import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, RefreshCw, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Form, FormField } from '@/components/ui/form'
import { ComboboxField, SelectField, TextField } from '@/components/ui/fields'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState, ErrorState, Money } from '@/components/common/misc'
import { useAccounts, useBudgets, useFiscalPeriods, useFiscalYears, useIncomeStatement } from '@/hooks/queries'
import { useCreateBudget } from '@/hooks/mutations'
import { useAuth } from '@/lib/auth'
import { useLabels } from '@/lib/labels'
import { endOfMonth, formatMoney, formatNumber, startOfYear } from '@/lib/format'
import { toNumber } from '@/lib/utils'

type Translate = (key: string, options?: Record<string, unknown>) => string

const budgetSchema = (t: Translate) =>
  z.object({
    name: z.string().min(2, t('budgets.errNameRequired')).max(120),
    fiscalYearId: z.string().min(1, t('budgets.errSelectYear')),
    lines: z
      .array(
        z.object({
          accountId: z.string().min(1, t('budgets.errSelectAccount')),
          annualAmount: z.coerce.number().min(0),
        }),
      )
      .min(1, t('budgets.errAddAccount')),
  })

type BudgetFormValues = z.infer<ReturnType<typeof budgetSchema>>

export function BudgetsPage() {
  const { t } = useTranslation()
  const labels = useLabels()
  const { hasRole } = useAuth()
  const canManage = hasRole('Admin', 'Accountant')

  const [dialogOpen, setDialogOpen] = useState(false)
  const budgetsQuery = useBudgets()
  const accountsQuery = useAccounts()
  const yearsQuery = useFiscalYears()
  const incomeStatement = useIncomeStatement(startOfYear(), endOfMonth())

  const budgets = budgetsQuery.data ?? []
  const budgetsTotal = budgets.reduce((sum, budget) => sum + budget.lines.reduce((total, line) => total + line.amount, 0), 0)

  const accountLabel = (accountId: string) => {
    const account = (accountsQuery.data ?? []).find((candidate) => candidate.id === accountId)
    return account ? `${account.code} · ${account.name}` : t('common.dash')
  }

  const revenueActual = incomeStatement.data?.totalRevenue ?? 0
  const expenseActual = incomeStatement.data?.totalExpense ?? 0

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('budgets.title')}
        description={t('budgets.description')}
        breadcrumbs={[{ label: t('nav.groups.configuration') }, { label: t('budgets.breadcrumb') }]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => budgetsQuery.refetch()} loading={budgetsQuery.isFetching}>
              <RefreshCw className="h-4 w-4" /> {t('common.refresh')}
            </Button>
            <Button size="sm" disabled={!canManage} onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" /> {t('budgets.newBudget')}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('budgets.count')}</p>
            <p className="text-2xl font-semibold tabular-nums">{budgets.length}</p>
            <p className="text-xs text-muted-foreground">
              {t('budgets.totalBudgeted', { amount: formatMoney(budgetsTotal) })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('budgets.ytdRevenue')}</p>
            <p className="text-2xl font-semibold tabular-nums text-success">
              {formatMoney(revenueActual)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('budgets.ytdExpense')}</p>
            <p className="text-2xl font-semibold tabular-nums text-destructive">
              {formatMoney(expenseActual)}
            </p>
          </CardContent>
        </Card>
      </div>

      {budgetsQuery.error ? (
        <ErrorState
          error={budgetsQuery.error}
          onRetry={() => budgetsQuery.refetch()}
          title={t('budgets.couldNotLoad')}
        />
      ) : budgets.length === 0 && !budgetsQuery.isLoading ? (
        <EmptyState
          title={t('budgets.noBudgets')}
          description={t('budgets.noBudgetsHint')}
          action={
            <Button size="sm" disabled={!canManage} onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" /> {t('budgets.newBudget')}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4">
          {budgets.map((budget) => {
            const total = budget.lines.reduce((sum, line) => sum + line.amount, 0)
            const fiscalYear = (yearsQuery.data ?? []).find((year) => year.id === budget.fiscalYearId)
            const byAccount = new Map<string, number>()
            for (const line of budget.lines) {
              byAccount.set(line.accountId, (byAccount.get(line.accountId) ?? 0) + line.amount)
            }

            return (
              <Card key={budget.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      {budget.name}
                      <Badge variant={budget.isActive ? 'success' : 'outline'}>
                        {budget.isActive ? t('budgets.active') : t('budgets.inactive')}
                      </Badge>
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {t('budgets.budgetMeta', {
                        year: fiscalYear?.name ?? t('budgets.fiscalYearFallback'),
                        accounts: byAccount.size,
                        lines: budget.lines.length,
                      })}
                    </p>
                  </div>
                  <div className="text-end">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('budgets.annualTotal')}</p>
                    <p className="text-lg font-semibold tabular-nums">
                      {formatMoney(total)}
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('budgets.account')}</TableHead>
                        <TableHead className="text-end">{t('budgets.annualBudget')}</TableHead>
                        <TableHead className="text-end">{t('budgets.monthlyAverage')}</TableHead>
                        <TableHead className="text-end">{t('budgets.shareOfBudget')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...byAccount.entries()].map(([accountId, amount]) => {
                        const account = (accountsQuery.data ?? []).find((candidate) => candidate.id === accountId)
                        return (
                          <TableRow key={accountId}>
                            <TableCell>
                              <span className="font-mono text-xs">{account?.code}</span> {account?.name}
                              {account ? (
                                <span className="ms-2 text-xs text-muted-foreground">
                                  {labels.accountType[account.type]}
                                </span>
                              ) : null}
                            </TableCell>
                            <TableCell className="text-end">
                              <Money value={amount} />
                            </TableCell>
                            <TableCell className="text-end text-muted-foreground">
                              <Money value={amount / 12} />
                            </TableCell>
                            <TableCell className="text-end tabular-nums">
                              {total > 0
                                ? `${formatNumber((amount / total) * 100, 1)}%`
                                : t('common.dash')}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <CreateBudgetDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        accountLabel={accountLabel}
      />
    </div>
  )
}

function CreateBudgetDialog({
  open,
  onOpenChange,
  accountLabel,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  accountLabel: (accountId: string) => string
}) {
  const { t } = useTranslation()
  const accountsQuery = useAccounts()
  const yearsQuery = useFiscalYears()
  const createBudget = useCreateBudget()

  const form = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetSchema(t)),
    defaultValues: {
      name: '',
      fiscalYearId: '',
      lines: [{ accountId: '', annualAmount: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' })
  const fiscalYearId = useWatch({ control: form.control, name: 'fiscalYearId' })
  const periodsQuery = useFiscalPeriods(fiscalYearId)
  const watchedLines = useWatch({ control: form.control, name: 'lines' })

  const accountOptions = useMemo(
    () =>
      (accountsQuery.data ?? [])
        .filter((account) => account.isActive && (account.type === 4 || account.type === 5))
        .map((account) => ({ value: account.id, label: `${account.code} · ${account.name}` })),
    [accountsQuery.data],
  )

  const annualTotal = watchedLines.reduce((sum, line) => sum + toNumber(line?.annualAmount), 0)

  const onSubmit = (values: BudgetFormValues) => {
    const periods = periodsQuery.data ?? []
    if (periods.length === 0) {
      form.setError('fiscalYearId', { message: t('budgets.errNoPeriods') })
      return
    }

    createBudget.mutate(
      {
        name: values.name.trim(),
        fiscalYearId: values.fiscalYearId,
        lines: values.lines.flatMap((line) =>
          periods.map((period) => ({
            accountId: line.accountId,
            fiscalPeriodId: period.id,
            amount: Number((toNumber(line.annualAmount) / periods.length).toFixed(2)),
          })),
        ),
      },
      {
        onSuccess: () => {
          form.reset()
          onOpenChange(false)
        },
        onError: (error) => {
          if (error.fieldErrors) {
            for (const [field, messages] of Object.entries(error.fieldErrors)) {
              form.setError(field as keyof BudgetFormValues, { message: messages[0] })
            }
          }
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('budgets.newBudgetTitle')}</DialogTitle>
          <DialogDescription>{t('budgets.newBudgetDescription')}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="create-budget" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <TextField
                    label={t('budgets.budgetName')}
                    placeholder={t('budgets.budgetNamePlaceholder')}
                    required
                    {...field}
                  />
                )}
              />
              <FormField
                control={form.control}
                name="fiscalYearId"
                render={({ field }) => (
                  <SelectField
                    label={t('budgets.fiscalYear')}
                    required
                    value={field.value}
                    onChange={field.onChange}
                    options={(yearsQuery.data ?? []).map((year) => ({ value: year.id, label: year.name }))}
                    placeholder={t('budgets.selectFiscalYear')}
                  />
                )}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{t('budgets.accounts')}</p>
                <Button type="button" variant="outline" size="sm" onClick={() => append({ accountId: '', annualAmount: 0 })}>
                  <Plus className="h-4 w-4" /> {t('budgets.addAccount')}
                </Button>
              </div>

              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div key={field.id} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[3fr_1fr_auto]">
                    <FormField
                      control={form.control}
                      name={`lines.${index}.accountId`}
                      render={({ field: accountField }) => (
                        <ComboboxField
                          label={index === 0 ? t('budgets.account') : undefined}
                          options={accountOptions}
                          value={accountField.value}
                          onChange={(value) => accountField.onChange(value ?? '')}
                          placeholder={t('budgets.selectAccount')}
                          allowClear={false}
                        />
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`lines.${index}.annualAmount`}
                      render={({ field: amountField }) => (
                        <TextField
                          label={index === 0 ? t('budgets.annualAmount') : undefined}
                          type="number"
                          step="any"
                          min={0}
                          className="text-end"
                          {...amountField}
                        />
                      )}
                    />
                    <div className={index === 0 ? 'flex items-end' : 'flex items-center'}>
                      <Button type="button" variant="ghost" size="icon" disabled={fields.length <= 1} onClick={() => remove(index)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-muted/40 p-4 text-sm">
              <span className="text-muted-foreground">
                {t('budgets.periodsAccounts', {
                  periods: periodsQuery.data?.length ?? 0,
                  accounts: watchedLines.length,
                })}
              </span>
              <span className="font-medium tabular-nums">
                {t('budgets.annualTotal')} {formatMoney(annualTotal)}
              </span>
            </div>

            {watchedLines.length ? (
              <p className="text-xs text-muted-foreground">
                {t('budgets.preview', {
                  names: watchedLines
                    .slice(0, 3)
                    .map((line) => accountLabel(line.accountId))
                    .filter((label) => label !== t('common.dash'))
                    .join(' · '),
                })}
                {watchedLines.length > 3 ? ` · ${t('budgets.more', { count: watchedLines.length - 3 })}` : ''}
              </p>
            ) : null}
          </form>
        </Form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="create-budget" loading={createBudget.isPending}>
            {t('budgets.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
