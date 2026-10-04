import { useMemo, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
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
import { accountTypeLabels } from '@/lib/enums'
import { endOfMonth, formatNumber, startOfYear } from '@/lib/format'
import { toNumber } from '@/lib/utils'

const budgetSchema = z.object({
  name: z.string().min(2, 'Budget name is required').max(120),
  fiscalYearId: z.string().min(1, 'Select the fiscal year'),
  lines: z
    .array(
      z.object({
        accountId: z.string().min(1, 'Select an account'),
        annualAmount: z.coerce.number().min(0),
      }),
    )
    .min(1, 'Add at least one account'),
})

type BudgetFormValues = z.infer<typeof budgetSchema>

export function BudgetsPage() {
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
    return account ? `${account.code} · ${account.name}` : '—'
  }

  const revenueActual = incomeStatement.data?.totalRevenue ?? 0
  const expenseActual = incomeStatement.data?.totalExpense ?? 0

  return (
    <div className="space-y-5">
      <PageHeader
        title="Budgets"
        description="Annual budgets spread across fiscal periods by account — compare against actuals to track performance."
        breadcrumbs={[{ label: 'Configuration' }, { label: 'Budgets' }]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => budgetsQuery.refetch()} loading={budgetsQuery.isFetching}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Button size="sm" disabled={!canManage} onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" /> New budget
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Budgets</p>
            <p className="text-2xl font-semibold tabular-nums">{budgets.length}</p>
            <p className="text-xs text-muted-foreground">Total budgeted {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(budgetsTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">YTD revenue actual</p>
            <p className="text-2xl font-semibold tabular-nums text-success">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(revenueActual)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">YTD expense actual</p>
            <p className="text-2xl font-semibold tabular-nums text-destructive">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(expenseActual)}
            </p>
          </CardContent>
        </Card>
      </div>

      {budgetsQuery.error ? (
        <ErrorState error={budgetsQuery.error} onRetry={() => budgetsQuery.refetch()} title="Could not load budgets" />
      ) : budgets.length === 0 && !budgetsQuery.isLoading ? (
        <EmptyState
          title="No budgets yet"
          description="Create a budget to compare planned versus actual revenue and expenses."
          action={
            <Button size="sm" disabled={!canManage} onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" /> New budget
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
                        {budget.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {fiscalYear?.name ?? 'Fiscal year'} · {byAccount.size} account(s) · {budget.lines.length} period lines
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Annual total</p>
                    <p className="text-lg font-semibold tabular-nums">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(total)}
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account</TableHead>
                        <TableHead className="text-right">Annual budget</TableHead>
                        <TableHead className="text-right">Monthly average</TableHead>
                        <TableHead className="text-right">Share of budget</TableHead>
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
                                <span className="ml-2 text-xs text-muted-foreground">
                                  {accountTypeLabels[account.type]}
                                </span>
                              ) : null}
                            </TableCell>
                            <TableCell className="text-right">
                              <Money value={amount} />
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              <Money value={amount / 12} />
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {total > 0 ? `${formatNumber((amount / total) * 100, 1)}%` : '—'}
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
  const accountsQuery = useAccounts()
  const yearsQuery = useFiscalYears()
  const createBudget = useCreateBudget()

  const form = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      name: '',
      fiscalYearId: '',
      lines: [{ accountId: '', annualAmount: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' })
  const fiscalYearId = form.watch('fiscalYearId')
  const periodsQuery = useFiscalPeriods(fiscalYearId)
  const watchedLines = form.watch('lines')

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
      form.setError('fiscalYearId', { message: 'The selected fiscal year has no periods.' })
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
          <DialogTitle>New budget</DialogTitle>
          <DialogDescription>
            Enter an annual amount per account — it is spread evenly across the periods of the selected fiscal year.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="create-budget" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <TextField label="Budget name" placeholder="Operating Budget FY2026" required {...field} />
                )}
              />
              <FormField
                control={form.control}
                name="fiscalYearId"
                render={({ field }) => (
                  <SelectField
                    label="Fiscal year"
                    required
                    value={field.value}
                    onChange={field.onChange}
                    options={(yearsQuery.data ?? []).map((year) => ({ value: year.id, label: year.name }))}
                    placeholder="Select fiscal year"
                  />
                )}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Accounts</p>
                <Button type="button" variant="outline" size="sm" onClick={() => append({ accountId: '', annualAmount: 0 })}>
                  <Plus className="h-4 w-4" /> Add account
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
                          label={index === 0 ? 'Account' : undefined}
                          options={accountOptions}
                          value={accountField.value}
                          onChange={(value) => accountField.onChange(value ?? '')}
                          placeholder="Select account"
                          allowClear={false}
                        />
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`lines.${index}.annualAmount`}
                      render={({ field: amountField }) => (
                        <TextField
                          label={index === 0 ? 'Annual amount' : undefined}
                          type="number"
                          step="any"
                          min={0}
                          className="text-right"
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
                {periodsQuery.data?.length ?? 0} period(s) · {watchedLines.length} account(s)
              </span>
              <span className="font-medium tabular-nums">
                Annual total{' '}
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(annualTotal)}
              </span>
            </div>

            {watchedLines.length ? (
              <p className="text-xs text-muted-foreground">
                Preview: {watchedLines.slice(0, 3).map((line) => accountLabel(line.accountId)).filter((label) => label !== '—').join(' · ')}
                {watchedLines.length > 3 ? ` · +${watchedLines.length - 3} more` : ''}
              </p>
            ) : null}
          </form>
        </Form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="create-budget" loading={createBudget.isPending}>
            Create budget
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
