import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { ColumnDef } from '@tanstack/react-table'
import { MoreHorizontal, Plus, Power, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/page-header'
import { DataTable, DataTableColumnHeader } from '@/components/data-table/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Form, FormField } from '@/components/ui/form'
import { ComboboxField, SelectField, TextAreaField, TextField } from '@/components/ui/fields'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { ErrorState, StatCard } from '@/components/common/misc'
import { useAccounts } from '@/hooks/queries'
import { useCreateAccount, useDeactivateAccount } from '@/hooks/mutations'
import { useAuth } from '@/lib/auth'
import { accountTypeLabels } from '@/lib/enums'
import { AccountType, NormalBalance } from '@/lib/enums'
import type { Account, CreateAccountRequest } from '@/lib/types'

const accountSchema = z.object({
  code: z
    .string()
    .min(1, 'Account code is required')
    .max(20, 'Keep the code under 20 characters')
    .regex(/^[0-9A-Za-z][0-9A-Za-z.\-]*$/, 'Use letters, digits, dots or dashes only'),
  name: z.string().min(2, 'Account name is required').max(120),
  type: z.coerce.number().int().min(1).max(5),
  subType: z.string().max(60).optional().or(z.literal('')),
  parentAccountId: z.string().nullable().optional(),
  description: z.string().max(400).optional().or(z.literal('')),
})

type AccountFormValues = z.infer<typeof accountSchema>

const typeTone: Record<number, 'default' | 'secondary' | 'success' | 'warning' | 'outline'> = {
  [AccountType.Asset]: 'default',
  [AccountType.Liability]: 'warning',
  [AccountType.Equity]: 'secondary',
  [AccountType.Revenue]: 'success',
  [AccountType.Expense]: 'outline',
}

export function AccountsPage() {
  const { hasRole } = useAuth()
  const canManage = hasRole('Admin', 'Accountant')

  const [includeInactive, setIncludeInactive] = useState(true)
  const [typeFilter, setTypeFilter] = useState<'all' | string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [accountToDeactivate, setAccountToDeactivate] = useState<Account | null>(null)

  const accountsQuery = useAccounts(includeInactive)
  const deactivateAccount = useDeactivateAccount()

  const accounts = accountsQuery.data ?? []

  const filtered = useMemo(
    () => (typeFilter === 'all' ? accounts : accounts.filter((account) => String(account.type) === typeFilter)),
    [accounts, typeFilter],
  )

  const summary = useMemo(() => {
    const byType = (type: AccountType) => accounts.filter((account) => account.type === type).length
    return {
      total: accounts.length,
      active: accounts.filter((account) => account.isActive).length,
      assets: byType(AccountType.Asset),
      revenue: byType(AccountType.Revenue),
      expenses: byType(AccountType.Expense),
    }
  }, [accounts])

  const columns = useMemo<ColumnDef<Account>[]>(
    () => [
      {
        accessorKey: 'code',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Code" />,
        cell: ({ row }) => <span className="font-mono text-xs font-medium">{row.original.code}</span>,
      },
      {
        accessorKey: 'name',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Account" />,
        cell: ({ row }) => (
          <div className="min-w-[200px]">
            <p className="font-medium">{row.original.name}</p>
            {row.original.subType ? (
              <p className="text-xs text-muted-foreground">{row.original.subType}</p>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: 'type',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
        cell: ({ row }) => (
          <Badge variant={typeTone[row.original.type] ?? 'secondary'}>
            {accountTypeLabels[row.original.type] ?? '—'}
          </Badge>
        ),
        filterFn: (row, _columnId, filterValue) => String(row.original.type) === String(filterValue),
      },
      {
        accessorKey: 'normalBalance',
        header: 'Normal balance',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.normalBalance === NormalBalance.Debit ? 'Debit' : 'Credit'}
          </span>
        ),
      },
      {
        accessorKey: 'isActive',
        header: 'Status',
        cell: ({ row }) =>
          row.original.isActive ? (
            <Badge variant="success">Active</Badge>
          ) : (
            <Badge variant="outline">Inactive</Badge>
          ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{row.original.code}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={!canManage || !row.original.isActive}
                  onClick={() => setAccountToDeactivate(row.original)}
                  className="text-destructive focus:text-destructive"
                >
                  <Power /> Deactivate
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [canManage],
  )

  return (
    <div className="space-y-5">
      <PageHeader
        title="Chart of accounts"
        description="Every account the posting engine can post to. System accounts are tagged so invoices, bills and tax codes resolve their default GL accounts automatically."
        breadcrumbs={[{ label: 'General Ledger' }, { label: 'Chart of Accounts' }]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => accountsQuery.refetch()} loading={accountsQuery.isFetching}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Button size="sm" disabled={!canManage} onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" /> New account
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Accounts" value={summary.total} hint={`${summary.active} active`} />
        <StatCard label="Asset accounts" value={summary.assets} />
        <StatCard label="Revenue accounts" value={summary.revenue} />
        <StatCard label="Expense accounts" value={summary.expenses} />
      </div>

      {accountsQuery.error ? (
        <ErrorState error={accountsQuery.error} onRetry={() => accountsQuery.refetch()} title="Could not load the chart of accounts" />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          isLoading={accountsQuery.isLoading}
          searchPlaceholder="Search accounts by code or name…"
          initialSorting={[{ id: 'code', desc: false }]}
          getRowId={(row) => row.id}
          toolbar={
            <>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-8 w-[170px]">
                  <SelectValue placeholder="All account types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All account types</SelectItem>
                  {Object.entries(accountTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant={includeInactive ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setIncludeInactive((value) => !value)}
              >
                {includeInactive ? 'Showing inactive' : 'Active only'}
              </Button>
            </>
          }
        />
      )}

      <CreateAccountDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        accounts={accounts}
        onCreated={() => setDialogOpen(false)}
      />

      <ConfirmDialog
        open={!!accountToDeactivate}
        onOpenChange={(open) => !open && setAccountToDeactivate(null)}
        title="Deactivate account?"
        description={
          accountToDeactivate
            ? `${accountToDeactivate.code} · ${accountToDeactivate.name} will no longer accept new postings. Historical entries are unaffected.`
            : undefined
        }
        confirmLabel="Deactivate"
        destructive
        loading={deactivateAccount.isPending}
        onConfirm={() => {
          if (!accountToDeactivate) return
          deactivateAccount.mutate(accountToDeactivate.id, {
            onSuccess: () => setAccountToDeactivate(null),
            onError: (error) => toast.error(error.message),
          })
        }}
      />
    </div>
  )
}

function CreateAccountDialog({
  open,
  onOpenChange,
  accounts,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  accounts: Account[]
  onCreated: () => void
}) {
  const createAccount = useCreateAccount()
  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: { code: '', name: '', type: AccountType.Asset, subType: '', parentAccountId: null, description: '' },
  })

  const parentOptions = useMemo(
    () =>
      accounts
        .filter((account) => account.isActive)
        .map((account) => ({ value: account.id, label: `${account.code} · ${account.name}` })),
    [accounts],
  )

  const onSubmit = (values: AccountFormValues) => {
    const payload: CreateAccountRequest = {
      code: values.code.trim(),
      name: values.name.trim(),
      type: values.type as AccountType,
      subType: values.subType?.trim() ? values.subType.trim() : null,
      parentAccountId: values.parentAccountId ?? null,
      description: values.description?.trim() ? values.description.trim() : null,
    }
    createAccount.mutate(payload, {
      onSuccess: () => {
        form.reset()
        onCreated()
      },
      onError: (error) => {
        if (error.fieldErrors) {
          for (const [field, messages] of Object.entries(error.fieldErrors)) {
            form.setError(field as keyof AccountFormValues, { message: messages[0] })
          }
        }
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>New GL account</DialogTitle>
          <DialogDescription>
            Add an account to the chart. The normal balance is derived from the account type on the server.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="create-account-form" onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => <TextField label="Code" placeholder="1010" required {...field} />}
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
                  options={Object.entries(accountTypeLabels).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                />
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <TextField label="Name" placeholder="Petty Cash" required className="sm:col-span-2" {...field} />
              )}
            />
            <FormField
              control={form.control}
              name="subType"
              render={({ field }) => (
                <TextField label="Sub-type" placeholder="Current Asset" {...field} value={field.value ?? ''} />
              )}
            />
            <FormField
              control={form.control}
              name="parentAccountId"
              render={({ field }) => (
                <ComboboxField
                  label="Parent account"
                  options={parentOptions}
                  value={field.value ?? null}
                  onChange={(value) => field.onChange(value)}
                  placeholder="None"
                />
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <TextAreaField
                  label="Description"
                  placeholder="Optional notes shown in reports"
                  className="sm:col-span-2"
                  {...field}
                  value={field.value ?? ''}
                />
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="create-account-form" loading={createAccount.isPending}>
            Create account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
