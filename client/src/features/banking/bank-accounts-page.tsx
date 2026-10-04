import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowRight, Landmark, Plus, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { DataTable, DataTableColumnHeader } from '@/components/data-table/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Form, FormField } from '@/components/ui/form'
import { ComboboxField, DateField, SelectField, TextField } from '@/components/ui/fields'
import { ErrorState, Money } from '@/components/common/misc'
import { useAccounts, useBankAccounts, useBankTransactions } from '@/hooks/queries'
import { useCreateBankAccount } from '@/hooks/mutations'
import { useAuth } from '@/lib/auth'
import { CURRENCIES } from '@/lib/constants'
import { formatDate, formatMoney, today } from '@/lib/format'
import { toNumber } from '@/lib/utils'
import type { BankAccount } from '@/lib/types'

const bankAccountSchema = z.object({
  name: z.string().min(2, 'Account name is required').max(120),
  bankName: z.string().max(120).optional().or(z.literal('')),
  accountNumberMasked: z.string().max(40).optional().or(z.literal('')),
  glAccountId: z.string().min(1, 'Map the account to a GL account'),
  currencyCode: z.string().length(3),
  openingBalance: z.coerce.number().min(0, 'Opening balance cannot be negative'),
  openingBalanceDate: z.string().min(1, 'Opening balance date is required'),
})

type BankAccountFormValues = z.infer<typeof bankAccountSchema>

export function BankAccountsPage() {
  const { hasRole } = useAuth()
  const canManage = hasRole('Admin', 'Accountant')

  const [dialogOpen, setDialogOpen] = useState(false)
  const accountsQuery = useBankAccounts()

  const columns = useMemo<ColumnDef<BankAccount>[]>(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Account" />,
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-muted p-2">
              <Landmark className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">{row.original.name}</p>
              <p className="text-xs text-muted-foreground">
                {row.original.bankName ?? '—'} {row.original.accountNumberMasked ? `· ${row.original.accountNumberMasked}` : ''}
              </p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'currencyCode',
        header: 'Currency',
        cell: ({ row }) => <Badge variant="secondary">{row.original.currencyCode}</Badge>,
      },
      {
        accessorKey: 'openingBalance',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Opening balance" align="right" />,
        cell: ({ row }) => (
          <div className="text-right">
            <Money value={row.original.openingBalance} currency={row.original.currencyCode} />
            <p className="text-xs text-muted-foreground">{formatDate(row.original.openingBalanceDate)}</p>
          </div>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/banking/accounts/${row.original.id}`}>
                Open <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        ),
      },
    ],
    [],
  )

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bank accounts"
        description="Track cash, record bank transactions against their GL account, and reconcile statements month by month."
        breadcrumbs={[{ label: 'Banking' }, { label: 'Bank Accounts' }]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => accountsQuery.refetch()} loading={accountsQuery.isFetching}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Button size="sm" disabled={!canManage} onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" /> Add bank account
            </Button>
          </>
        }
      />

      {accountsQuery.error ? (
        <ErrorState error={accountsQuery.error} onRetry={() => accountsQuery.refetch()} title="Could not load bank accounts" />
      ) : (
        <DataTable
          columns={columns}
          data={accountsQuery.data ?? []}
          isLoading={accountsQuery.isLoading}
          searchPlaceholder="Search bank accounts…"
          getRowId={(row) => row.id}
          hideColumnToggle
        />
      )}

      <CreateBankAccountDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}

function CreateBankAccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const accountsQuery = useAccounts()
  const createBankAccount = useCreateBankAccount()

  const form = useForm<BankAccountFormValues>({
    resolver: zodResolver(bankAccountSchema),
    defaultValues: {
      name: '',
      bankName: '',
      accountNumberMasked: '',
      glAccountId: '',
      currencyCode: 'USD',
      openingBalance: 0,
      openingBalanceDate: today(),
    },
  })

  const glOptions = useMemo(
    () =>
      (accountsQuery.data ?? [])
        .filter((account) => account.isActive && account.type === 1)
        .map((account) => ({ value: account.id, label: `${account.code} · ${account.name}` })),
    [accountsQuery.data],
  )

  const onSubmit = (values: BankAccountFormValues) => {
    createBankAccount.mutate(
      {
        name: values.name.trim(),
        bankName: values.bankName?.trim() ? values.bankName.trim() : null,
        accountNumberMasked: values.accountNumberMasked?.trim() ? values.accountNumberMasked.trim() : null,
        glAccountId: values.glAccountId,
        currencyCode: values.currencyCode.toUpperCase(),
        openingBalance: toNumber(values.openingBalance),
        openingBalanceDate: values.openingBalanceDate,
      },
      {
        onSuccess: () => {
          form.reset()
          onOpenChange(false)
        },
        onError: (error) => {
          if (error.fieldErrors) {
            for (const [field, messages] of Object.entries(error.fieldErrors)) {
              form.setError(field as keyof BankAccountFormValues, { message: messages[0] })
            }
          }
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add bank account</DialogTitle>
          <DialogDescription>
            Bank accounts map to an asset GL account. Transactions recorded here post to that account.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="create-bank-account" onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => <TextField label="Account name" placeholder="Operating Account" required {...field} />}
            />
            <FormField
              control={form.control}
              name="bankName"
              render={({ field }) => (
                <TextField label="Bank" placeholder="First Republic Bank" {...field} value={field.value ?? ''} />
              )}
            />
            <FormField
              control={form.control}
              name="accountNumberMasked"
              render={({ field }) => (
                <TextField label="Account number (masked)" placeholder="•••• 4821" {...field} value={field.value ?? ''} />
              )}
            />
            <FormField
              control={form.control}
              name="currencyCode"
              render={({ field }) => (
                <SelectField label="Currency" value={field.value} onChange={field.onChange} options={CURRENCIES} />
              )}
            />
            <FormField
              control={form.control}
              name="glAccountId"
              render={({ field }) => (
                <ComboboxField
                  label="GL account"
                  required
                  options={glOptions}
                  value={field.value}
                  onChange={(value) => field.onChange(value ?? '')}
                  placeholder="Select an asset account"
                  allowClear={false}
                  className="sm:col-span-2"
                />
              )}
            />
            <FormField
              control={form.control}
              name="openingBalance"
              render={({ field }) => (
                <TextField label="Opening balance" type="number" step="any" min={0} className="text-right" {...field} />
              )}
            />
            <FormField
              control={form.control}
              name="openingBalanceDate"
              render={({ field }) => <DateField label="Opening balance date" required {...field} />}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="create-bank-account" loading={createBankAccount.isPending}>
            Create account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function BankAccountSummaryCards({ bankAccountId }: { bankAccountId: string }) {
  const transactionsQuery = useBankTransactions(bankAccountId)
  const accountsQuery = useBankAccounts()
  const account = (accountsQuery.data ?? []).find((candidate) => candidate.id === bankAccountId)

  const totals = useMemo(() => {
    const transactions = transactionsQuery.data ?? []
    const deposits = transactions
      .filter((transaction) => transaction.type === 1 || transaction.type === 5)
      .reduce((sum, transaction) => sum + transaction.amount, 0)
    const withdrawals = transactions
      .filter((transaction) => transaction.type !== 1 && transaction.type !== 5)
      .reduce((sum, transaction) => sum + transaction.amount, 0)
    const uncleared = transactions.filter((transaction) => !transaction.isReconciled).length
    return { deposits, withdrawals, uncleared, count: transactions.length }
  }, [transactionsQuery.data])

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card>
        <CardContent className="p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Statement activity</p>
          <p className="text-2xl font-semibold tabular-nums">{totals.count}</p>
          <p className="text-xs text-muted-foreground">transactions recorded</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Deposits</p>
          <p className="text-2xl font-semibold tabular-nums text-success">{formatMoney(totals.deposits)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Withdrawals &amp; fees</p>
          <p className="text-2xl font-semibold tabular-nums text-destructive">{formatMoney(totals.withdrawals)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Uncleared items</p>
          <p className="text-2xl font-semibold tabular-nums">{totals.uncleared}</p>
          <p className="text-xs text-muted-foreground">
            Opening balance {account ? formatMoney(account.openingBalance) : '—'}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
