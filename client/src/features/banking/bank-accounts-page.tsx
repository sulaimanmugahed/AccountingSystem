import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
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

type Translate = (key: string, options?: Record<string, unknown>) => string

const bankAccountSchema = (t: Translate) =>
  z.object({
    name: z.string().min(2, t('banking.errNameRequired')).max(120),
    bankName: z.string().max(120).optional().or(z.literal('')),
    accountNumberMasked: z.string().max(40).optional().or(z.literal('')),
    glAccountId: z.string().min(1, t('banking.errMapGlAccount')),
    currencyCode: z.string().length(3),
    openingBalance: z.coerce.number().min(0, t('banking.errOpeningBalanceNegative')),
    openingBalanceDate: z.string().min(1, t('banking.errOpeningBalanceDateRequired')),
  })

type BankAccountFormValues = z.infer<ReturnType<typeof bankAccountSchema>>

export function BankAccountsPage() {
  const { t } = useTranslation()
  const { hasRole } = useAuth()
  const canManage = hasRole('Admin', 'Accountant')

  const [dialogOpen, setDialogOpen] = useState(false)
  const accountsQuery = useBankAccounts()

  const columns = useMemo<ColumnDef<BankAccount>[]>(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('banking.accountName')} />,
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-muted p-2">
              <Landmark className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">{row.original.name}</p>
              <p className="text-xs text-muted-foreground">
                {row.original.bankName ?? t('common.dash')}{' '}
                {row.original.accountNumberMasked ? `· ${row.original.accountNumberMasked}` : ''}
              </p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'currencyCode',
        header: t('common.currency'),
        cell: ({ row }) => <Badge variant="secondary">{row.original.currencyCode}</Badge>,
      },
      {
        accessorKey: 'openingBalance',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('banking.openingBalance')} align="right" />,
        cell: ({ row }) => (
          <div className="text-end">
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
                {t('banking.open')} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        ),
      },
    ],
    [t],
  )

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('banking.accountsTitle')}
        description={t('banking.accountsPageDescription')}
        breadcrumbs={[{ label: t('nav.groups.assetsBanking') }, { label: t('banking.accountsBreadcrumb') }]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => accountsQuery.refetch()} loading={accountsQuery.isFetching}>
              <RefreshCw className="h-4 w-4" /> {t('common.refresh')}
            </Button>
            <Button size="sm" disabled={!canManage} onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" /> {t('banking.newAccount')}
            </Button>
          </>
        }
      />

      {accountsQuery.error ? (
        <ErrorState
          error={accountsQuery.error}
          onRetry={() => accountsQuery.refetch()}
          title={t('banking.couldNotLoad')}
        />
      ) : (
        <DataTable
          columns={columns}
          data={accountsQuery.data ?? []}
          isLoading={accountsQuery.isLoading}
          searchPlaceholder={t('banking.searchPlaceholder')}
          getRowId={(row) => row.id}
          hideColumnToggle
        />
      )}

      <CreateBankAccountDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}

function CreateBankAccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation()
  const accountsQuery = useAccounts()
  const createBankAccount = useCreateBankAccount()

  const form = useForm<BankAccountFormValues>({
    resolver: zodResolver(bankAccountSchema(t)),
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
          <DialogTitle>{t('banking.newAccountTitle')}</DialogTitle>
          <DialogDescription>{t('banking.addAccountDescription')}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="create-bank-account" onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <TextField
                  label={t('banking.accountName')}
                  placeholder={t('banking.accountNamePlaceholder')}
                  required
                  {...field}
                />
              )}
            />
            <FormField
              control={form.control}
              name="bankName"
              render={({ field }) => (
                <TextField
                  label={t('banking.bankName')}
                  placeholder="First Republic Bank"
                  {...field}
                  value={field.value ?? ''}
                />
              )}
            />
            <FormField
              control={form.control}
              name="accountNumberMasked"
              render={({ field }) => (
                <TextField
                  label={t('banking.accountNumberMasked')}
                  placeholder={t('banking.accountNumberPlaceholder')}
                  {...field}
                  value={field.value ?? ''}
                />
              )}
            />
            <FormField
              control={form.control}
              name="currencyCode"
              render={({ field }) => (
                <SelectField
                  label={t('common.currency')}
                  value={field.value}
                  onChange={field.onChange}
                  options={CURRENCIES}
                />
              )}
            />
            <FormField
              control={form.control}
              name="glAccountId"
              render={({ field }) => (
                <ComboboxField
                  label={t('banking.glAccount')}
                  required
                  options={glOptions}
                  value={field.value}
                  onChange={(value) => field.onChange(value ?? '')}
                  placeholder={t('banking.glAccountHint')}
                  allowClear={false}
                  className="sm:col-span-2"
                />
              )}
            />
            <FormField
              control={form.control}
              name="openingBalance"
              render={({ field }) => (
                <TextField
                  label={t('banking.openingBalance')}
                  type="number"
                  step="any"
                  min={0}
                  className="text-end"
                  {...field}
                />
              )}
            />
            <FormField
              control={form.control}
              name="openingBalanceDate"
              render={({ field }) => (
                <DateField label={t('banking.openingBalanceDate')} required {...field} />
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="create-bank-account" loading={createBankAccount.isPending}>
            {t('banking.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function BankAccountSummaryCards({ bankAccountId }: { bankAccountId: string }) {
  const { t } = useTranslation()
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
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t('banking.statementActivity')}
          </p>
          <p className="text-2xl font-semibold tabular-nums">{totals.count}</p>
          <p className="text-xs text-muted-foreground">{t('banking.transactionsRecorded')}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('banking.deposits')}</p>
          <p className="text-2xl font-semibold tabular-nums text-success">{formatMoney(totals.deposits)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t('banking.withdrawalsFees')}
          </p>
          <p className="text-2xl font-semibold tabular-nums text-destructive">{formatMoney(totals.withdrawals)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t('banking.unclearedItems')}
          </p>
          <p className="text-2xl font-semibold tabular-nums">{totals.uncleared}</p>
          <p className="text-xs text-muted-foreground">
            {t('banking.openingBalanceShort', {
              amount: account ? formatMoney(account.openingBalance) : t('common.dash'),
            })}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
