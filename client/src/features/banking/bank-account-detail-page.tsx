import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle2, Plus, RefreshCw, ScrollText } from 'lucide-react'
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
import { DateField, SelectField, TextField } from '@/components/ui/fields'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState, ErrorState, Money, SummaryRow } from '@/components/common/misc'
import { useBankAccounts, useBankTransactions } from '@/hooks/queries'
import {
  useAddBankTransaction,
  useClearBankTransaction,
  useCompleteReconciliation,
  useStartReconciliation,
} from '@/hooks/mutations'
import { useAuth } from '@/lib/auth'
import { BankTransactionType } from '@/lib/enums'
import { useLabels } from '@/lib/labels'
import { formatDate, formatMoney, today } from '@/lib/format'
import { cn, toNumber } from '@/lib/utils'
import type { BankReconciliation } from '@/lib/types'

type Translate = (key: string, options?: Record<string, unknown>) => string

const transactionSchema = (t: Translate) =>
  z.object({
    transactionDate: z.string().min(1, t('banking.errDateRequired')),
    description: z.string().min(2, t('banking.errDescriptionRequired')).max(200),
    type: z.coerce.number().int().min(1).max(5),
    amount: z.coerce.number().positive(t('banking.errAmountPositive')),
    referenceNumber: z.string().max(60).optional().or(z.literal('')),
  })

type TransactionFormValues = z.infer<ReturnType<typeof transactionSchema>>

const reconciliationSchema = (t: Translate) =>
  z.object({
    statementDate: z.string().min(1, t('banking.errStatementDateRequired')),
    statementBeginningBalance: z.coerce.number(),
    statementEndingBalance: z.coerce.number(),
  })

type ReconciliationFormValues = z.infer<ReturnType<typeof reconciliationSchema>>

export function BankAccountDetailPage() {
  const { t } = useTranslation()
  const labels = useLabels()
  const { id = '' } = useParams()
  const { hasRole } = useAuth()
  const canManage = hasRole('Admin', 'Accountant')

  const accountsQuery = useBankAccounts()
  const transactionsQuery = useBankTransactions(id)

  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false)
  const [reconciliation, setReconciliation] = useState<BankReconciliation | null>(null)

  const startReconciliation = useStartReconciliation()
  const clearTransaction = useClearBankTransaction()
  const completeReconciliation = useCompleteReconciliation()

  const account = (accountsQuery.data ?? []).find((candidate) => candidate.id === id)
  const transactions = transactionsQuery.data ?? []

  const totals = useMemo(() => {
    const cleared = transactions.filter((transaction) => transaction.isReconciled)
    const uncleared = transactions.filter((transaction) => !transaction.isReconciled)
    const clearedBalance = cleared.reduce(
      (sum, transaction) => sum + (transaction.type === 1 || transaction.type === 5 ? transaction.amount : -transaction.amount),
      0,
    )
    const unclearedBalance = uncleared.reduce(
      (sum, transaction) => sum + (transaction.type === 1 || transaction.type === 5 ? transaction.amount : -transaction.amount),
      0,
    )
    return {
      clearedBalance,
      unclearedBalance,
      clearedCount: cleared.length,
      unclearedCount: uncleared.length,
    }
  }, [transactions])

  const reconciliationForm = useForm<ReconciliationFormValues>({
    resolver: zodResolver(reconciliationSchema(t)),
    defaultValues: {
      statementDate: today(),
      statementBeginningBalance: 0,
      statementEndingBalance: 0,
    },
  })

  const difference = reconciliation
    ? toNumber(reconciliationForm.watch('statementEndingBalance')) - (totals.clearedBalance + toNumber(reconciliation.statementBeginningBalance))
    : 0

  if (!account && !accountsQuery.isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader
          title={t('banking.notFoundTitle')}
          breadcrumbs={[{ label: t('nav.groups.assetsBanking'), href: '/banking/accounts' }]}
        />
        <EmptyState
          title={t('banking.notFoundHeading')}
          description={t('banking.notFoundHint')}
          action={
            <Button asChild variant="outline">
              <Link to="/banking/accounts">{t('banking.backToAccounts')}</Link>
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={account?.name ?? t('banking.detailTitle')}
        description={
          account
            ? t('banking.openingBalanceLine', {
                bank: account.bankName ?? t('banking.bankName'),
                number: account.accountNumberMasked ?? '',
                currency: account.currencyCode,
                amount: formatMoney(account.openingBalance),
                date: formatDate(account.openingBalanceDate),
              })
            : undefined
        }
        breadcrumbs={[
          { label: t('nav.groups.assetsBanking'), href: '/banking/accounts' },
          { label: account?.name ?? t('banking.accountFallback') },
        ]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => transactionsQuery.refetch()} loading={transactionsQuery.isFetching}>
              <RefreshCw className="h-4 w-4" /> {t('common.refresh')}
            </Button>
            <Button size="sm" disabled={!canManage} onClick={() => setTransactionDialogOpen(true)}>
              <Plus className="h-4 w-4" /> {t('banking.recordTransaction')}
            </Button>
          </>
        }
      />

      <Tabs defaultValue="transactions">
        <TabsList>
          <TabsTrigger value="transactions">{t('banking.tabTransactions')}</TabsTrigger>
          <TabsTrigger value="reconcile">{t('banking.tabReconcile')}</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions">
          {transactionsQuery.error ? (
            <ErrorState error={transactionsQuery.error} onRetry={() => transactionsQuery.refetch()} />
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('common.date')}</TableHead>
                      <TableHead>{t('common.description')}</TableHead>
                      <TableHead>{t('common.type')}</TableHead>
                      <TableHead>{t('common.reference')}</TableHead>
                      <TableHead className="text-end">{t('common.amount')}</TableHead>
                      <TableHead>{t('common.status')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                          {t('banking.noTransactions')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      transactions.map((transaction) => {
                        const isDeposit = transaction.type === 1 || transaction.type === 5
                        return (
                          <TableRow key={transaction.id}>
                            <TableCell className="whitespace-nowrap">{formatDate(transaction.transactionDate)}</TableCell>
                            <TableCell>{transaction.description}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {labels.bankTransactionType[transaction.type] ?? t('common.dash')}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {transaction.referenceNumber ?? t('common.dash')}
                            </TableCell>
                            <TableCell
                              className={cn('text-end font-medium', isDeposit ? 'text-success' : 'text-destructive')}
                            >
                              {isDeposit ? '+' : '−'}
                              <Money value={transaction.amount} />
                            </TableCell>
                            <TableCell>
                              {transaction.isReconciled ? (
                                <Badge variant="success">{t('banking.cleared')}</Badge>
                              ) : (
                                <Badge variant="outline">{t('banking.uncleared')}</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="reconcile">
          <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <ScrollText className="h-4 w-4" /> {t('banking.statementReconciliation')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {reconciliation ? (
                  <>
                    <div className="rounded-lg border bg-muted/40 p-4">
                      <SummaryRow
                        label={t('banking.statementDate')}
                        value={formatDate(reconciliation.statementDate)}
                      />
                      <SummaryRow
                        label={t('banking.beginningBalance')}
                        value={formatMoney(reconciliation.statementBeginningBalance)}
                      />
                      <SummaryRow
                        label={t('banking.clearedActivity')}
                        value={formatMoney(totals.clearedBalance)}
                      />
                      <SummaryRow
                        label={t('banking.expectedEndingBalance')}
                        value={formatMoney(
                          toNumber(reconciliation.statementBeginningBalance) + totals.clearedBalance,
                        )}
                        strong
                      />
                      <SummaryRow
                        label={t('banking.statementEndingBalance')}
                        value={formatMoney(toNumber(reconciliationForm.watch('statementEndingBalance')))}
                      />
                      <SummaryRow
                        label={t('banking.difference')}
                        value={formatMoney(difference)}
                        strong
                        className={Math.abs(difference) < 0.01 ? 'text-success' : 'text-destructive'}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {Math.abs(difference) < 0.01 ? t('banking.agrees') : t('banking.markMore')}
                    </p>
                    <Button
                      className="w-full"
                      disabled={reconciliation.isCompleted || Math.abs(difference) >= 0.01}
                      loading={completeReconciliation.isPending}
                      onClick={() =>
                        completeReconciliation.mutate(reconciliation.id, {
                          onSuccess: (result) => setReconciliation(result),
                        })
                      }
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {reconciliation.isCompleted
                        ? t('banking.reconciliationCompleted')
                        : t('banking.completeReconciliation')}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setReconciliation(null)
                        reconciliationForm.reset()
                      }}
                    >
                      {t('banking.newReconciliation')}
                    </Button>
                  </>
                ) : (
                  <Form {...reconciliationForm}>
                    <form
                      className="space-y-4"
                      onSubmit={reconciliationForm.handleSubmit((values) => {
                        startReconciliation.mutate(
                          {
                            id,
                            statementDate: values.statementDate,
                            statementBeginningBalance: toNumber(values.statementBeginningBalance),
                            statementEndingBalance: toNumber(values.statementEndingBalance),
                          },
                          { onSuccess: (result) => setReconciliation(result) },
                        )
                      })}
                    >
                      <FormField
                        control={reconciliationForm.control}
                        name="statementDate"
                        render={({ field }) => (
                          <DateField label={t('banking.statementDate')} required {...field} />
                        )}
                      />
                      <FormField
                        control={reconciliationForm.control}
                        name="statementBeginningBalance"
                        render={({ field }) => (
                          <TextField
                            label={t('banking.statementBeginningBalance')}
                            type="number"
                            step="any"
                            className="text-end"
                            {...field}
                          />
                        )}
                      />
                      <FormField
                        control={reconciliationForm.control}
                        name="statementEndingBalance"
                        render={({ field }) => (
                          <TextField
                            label={t('banking.statementEndingBalance')}
                            type="number"
                            step="any"
                            className="text-end"
                            {...field}
                          />
                        )}
                      />
                      <Button type="submit" className="w-full" loading={startReconciliation.isPending} disabled={!canManage}>
                        {t('banking.startReconciliation')}
                      </Button>
                    </form>
                  </Form>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">
                  {t('banking.unclearedTitle', {
                    count: totals.unclearedCount,
                    amount: formatMoney(totals.unclearedBalance),
                  })}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('common.date')}</TableHead>
                      <TableHead>{t('common.description')}</TableHead>
                      <TableHead className="text-end">{t('common.amount')}</TableHead>
                      <TableHead className="text-end">{t('common.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.filter((transaction) => !transaction.isReconciled).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center text-sm text-muted-foreground">
                          {t('banking.allCleared')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      transactions
                        .filter((transaction) => !transaction.isReconciled)
                        .map((transaction) => (
                          <TableRow key={transaction.id}>
                            <TableCell className="whitespace-nowrap">{formatDate(transaction.transactionDate)}</TableCell>
                            <TableCell>{transaction.description}</TableCell>
                            <TableCell className="text-end">
                              <Money value={transaction.amount} />
                            </TableCell>
                            <TableCell className="text-end">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!reconciliation || reconciliation.isCompleted || clearTransaction.isPending}
                                onClick={() =>
                                  reconstructionClear(reconciliation, transaction.id, clearTransaction.mutate)
                                }
                              >
                                {t('banking.markCleared')}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
                {!reconciliation ? (
                  <>
                    <Separator />
                    <p className="px-4 py-3 text-xs text-muted-foreground">
                      {t('banking.startHint')}
                    </p>
                  </>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <RecordTransactionDialog open={transactionDialogOpen} onOpenChange={setTransactionDialogOpen} bankAccountId={id} />
    </div>
  )
}

function reconstructionClear(
  reconciliation: BankReconciliation | null,
  transactionId: string,
  mutate: (variables: { reconciliationId: string; transactionId: string }) => void,
) {
  if (!reconciliation) return
  mutate({ reconciliationId: reconciliation.id, transactionId })
}

function RecordTransactionDialog({
  open,
  onOpenChange,
  bankAccountId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  bankAccountId: string
}) {
  const { t } = useTranslation()
  const labels = useLabels()
  const addTransaction = useAddBankTransaction()

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema(t)),
    defaultValues: {
      transactionDate: today(),
      description: '',
      type: BankTransactionType.Deposit,
      amount: 0,
      referenceNumber: '',
    },
  })

  const onSubmit = (values: TransactionFormValues) => {
    addTransaction.mutate(
      {
        id: bankAccountId,
        transactionDate: values.transactionDate,
        description: values.description.trim(),
        type: values.type,
        amount: toNumber(values.amount),
        referenceNumber: values.referenceNumber?.trim() ? values.referenceNumber.trim() : null,
      },
      {
        onSuccess: () => {
          form.reset()
          onOpenChange(false)
        },
        onError: (error) => {
          if (error.fieldErrors) {
            for (const [field, messages] of Object.entries(error.fieldErrors)) {
              form.setError(field as keyof TransactionFormValues, { message: messages[0] })
            }
          }
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('banking.recordTitle')}</DialogTitle>
          <DialogDescription>{t('banking.recordDescription')}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="record-bank-transaction" onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="transactionDate"
              render={({ field }) => <DateField label={t('common.date')} required {...field} />}
            />
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <SelectField
                  label={t('common.type')}
                  required
                  value={field.value}
                  onChange={(value) => field.onChange(Number(value))}
                  options={Object.entries(labels.bankTransactionType).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                />
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <TextField
                  label={t('common.description')}
                  placeholder={t('banking.depositPlaceholder')}
                  required
                  className="sm:col-span-2"
                  {...field}
                />
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <TextField
                  label={t('common.amount')}
                  type="number"
                  step="any"
                  min={0}
                  className="text-end"
                  required
                  {...field}
                />
              )}
            />
            <FormField
              control={form.control}
              name="referenceNumber"
              render={({ field }) => (
                <TextField
                  label={t('common.reference')}
                  placeholder={t('banking.referencePlaceholder')}
                  {...field}
                  value={field.value ?? ''}
                />
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="record-bank-transaction" loading={addTransaction.isPending}>
            {t('banking.recordTransaction')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
