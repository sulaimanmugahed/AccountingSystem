import { useMemo, useState } from 'react'
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
import { bankTransactionTypeLabels, BankTransactionType } from '@/lib/enums'
import { formatDate, formatMoney, today } from '@/lib/format'
import { cn, toNumber } from '@/lib/utils'
import type { BankReconciliation } from '@/lib/types'

const transactionSchema = z.object({
  transactionDate: z.string().min(1, 'Date is required'),
  description: z.string().min(2, 'Description is required').max(200),
  type: z.coerce.number().int().min(1).max(5),
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  referenceNumber: z.string().max(60).optional().or(z.literal('')),
})

type TransactionFormValues = z.infer<typeof transactionSchema>

const reconciliationSchema = z.object({
  statementDate: z.string().min(1, 'Statement date is required'),
  statementBeginningBalance: z.coerce.number(),
  statementEndingBalance: z.coerce.number(),
})

type ReconciliationFormValues = z.infer<typeof reconciliationSchema>

export function BankAccountDetailPage() {
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
    resolver: zodResolver(reconciliationSchema),
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
        <PageHeader title="Bank account not found" breadcrumbs={[{ label: 'Banking', href: '/banking/accounts' }]} />
        <EmptyState
          title="This bank account no longer exists"
          description="It may have been deactivated."
          action={
            <Button asChild variant="outline">
              <Link to="/banking/accounts">Back to bank accounts</Link>
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={account?.name ?? 'Bank account'}
        description={
          account
            ? `${account.bankName ?? 'Bank'} ${account.accountNumberMasked ?? ''} · ${account.currencyCode} · opening balance ${formatMoney(account.openingBalance)} on ${formatDate(account.openingBalanceDate)}`
            : undefined
        }
        breadcrumbs={[{ label: 'Banking', href: '/banking/accounts' }, { label: account?.name ?? 'Account' }]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => transactionsQuery.refetch()} loading={transactionsQuery.isFetching}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Button size="sm" disabled={!canManage} onClick={() => setTransactionDialogOpen(true)}>
              <Plus className="h-4 w-4" /> Record transaction
            </Button>
          </>
        }
      />

      <Tabs defaultValue="transactions">
        <TabsList>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="reconcile">Reconciliation</TabsTrigger>
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
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                          No bank transactions recorded yet.
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
                              <Badge variant="secondary">{bankTransactionTypeLabels[transaction.type] ?? '—'}</Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {transaction.referenceNumber ?? '—'}
                            </TableCell>
                            <TableCell
                              className={cn('text-right font-medium', isDeposit ? 'text-success' : 'text-destructive')}
                            >
                              {isDeposit ? '+' : '−'}
                              <Money value={transaction.amount} />
                            </TableCell>
                            <TableCell>
                              {transaction.isReconciled ? (
                                <Badge variant="success">Cleared</Badge>
                              ) : (
                                <Badge variant="outline">Uncleared</Badge>
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
                  <ScrollText className="h-4 w-4" /> Statement reconciliation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {reconciliation ? (
                  <>
                    <div className="rounded-lg border bg-muted/40 p-4">
                      <SummaryRow label="Statement date" value={formatDate(reconciliation.statementDate)} />
                      <SummaryRow
                        label="Beginning balance"
                        value={formatMoney(reconciliation.statementBeginningBalance)}
                      />
                      <SummaryRow
                        label="Cleared activity"
                        value={formatMoney(totals.clearedBalance)}
                      />
                      <SummaryRow
                        label="Expected ending balance"
                        value={formatMoney(
                          toNumber(reconciliation.statementBeginningBalance) + totals.clearedBalance,
                        )}
                        strong
                      />
                      <SummaryRow
                        label="Statement ending balance"
                        value={formatMoney(toNumber(reconciliationForm.watch('statementEndingBalance')))}
                      />
                      <SummaryRow
                        label="Difference"
                        value={formatMoney(difference)}
                        strong
                        className={Math.abs(difference) < 0.01 ? 'text-success' : 'text-destructive'}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {Math.abs(difference) < 0.01
                        ? 'The statement agrees with the cleared ledger balance. You can complete the reconciliation.'
                        : 'Mark more transactions as cleared below until the difference is zero.'}
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
                      {reconciliation.isCompleted ? 'Reconciliation completed' : 'Complete reconciliation'}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setReconciliation(null)
                        reconciliationForm.reset()
                      }}
                    >
                      Start a new reconciliation
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
                        render={({ field }) => <DateField label="Statement date" required {...field} />}
                      />
                      <FormField
                        control={reconciliationForm.control}
                        name="statementBeginningBalance"
                        render={({ field }) => (
                          <TextField
                            label="Statement beginning balance"
                            type="number"
                            step="any"
                            className="text-right"
                            {...field}
                          />
                        )}
                      />
                      <FormField
                        control={reconciliationForm.control}
                        name="statementEndingBalance"
                        render={({ field }) => (
                          <TextField
                            label="Statement ending balance"
                            type="number"
                            step="any"
                            className="text-right"
                            {...field}
                          />
                        )}
                      />
                      <Button type="submit" className="w-full" loading={startReconciliation.isPending} disabled={!canManage}>
                        Start reconciliation
                      </Button>
                    </form>
                  </Form>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">
                  Uncleared items ({totals.unclearedCount}) · net {formatMoney(totals.unclearedBalance)}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.filter((transaction) => !transaction.isReconciled).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center text-sm text-muted-foreground">
                          Everything on this account is cleared. 🎉
                        </TableCell>
                      </TableRow>
                    ) : (
                      transactions
                        .filter((transaction) => !transaction.isReconciled)
                        .map((transaction) => (
                          <TableRow key={transaction.id}>
                            <TableCell className="whitespace-nowrap">{formatDate(transaction.transactionDate)}</TableCell>
                            <TableCell>{transaction.description}</TableCell>
                            <TableCell className="text-right">
                              <Money value={transaction.amount} />
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!reconciliation || reconciliation.isCompleted || clearTransaction.isPending}
                                onClick={() =>
                                  reconstructionClear(reconciliation, transaction.id, clearTransaction.mutate)
                                }
                              >
                                Mark cleared
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
                      Start a reconciliation on the left to begin clearing items.
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
  const addTransaction = useAddBankTransaction()

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
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
          <DialogTitle>Record bank transaction</DialogTitle>
          <DialogDescription>
            Deposits and interest increase cash; withdrawals, transfers and fees reduce it. A journal entry is posted
            automatically.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="record-bank-transaction" onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="transactionDate"
              render={({ field }) => <DateField label="Date" required {...field} />}
            />
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <SelectField
                  label="Type"
                  required
                  value={field.value}
                  onChange={(value) => field.onChange(Number(value))}
                  options={Object.entries(bankTransactionTypeLabels).map(([value, label]) => ({ value, label }))}
                />
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <TextField label="Description" placeholder="Customer deposit" required className="sm:col-span-2" {...field} />
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <TextField label="Amount" type="number" step="any" min={0} className="text-right" required {...field} />
              )}
            />
            <FormField
              control={form.control}
              name="referenceNumber"
              render={({ field }) => (
                <TextField label="Reference" placeholder="DEP-55231" {...field} value={field.value ?? ''} />
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="record-bank-transaction" loading={addTransaction.isPending}>
            Record transaction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
