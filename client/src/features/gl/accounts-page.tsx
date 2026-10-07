import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import { AccountType, NormalBalance } from '@/lib/enums'
import { useLabels } from '@/lib/labels'
import type { Account, CreateAccountRequest } from '@/lib/types'

type Translate = (key: string, options?: Record<string, unknown>) => string

const accountSchema = (t: Translate) =>
  z.object({
  code: z
    .string()
    .min(1, t('accounts.codeRequired'))
    .max(20, t('accounts.codeMax'))
    .regex(/^[0-9A-Za-z][0-9A-Za-z.\-]*$/, t('accounts.codeFormat')),
  name: z.string().min(2, t('accounts.nameRequired')).max(120),
  type: z.coerce.number().int().min(1).max(5),
  subType: z.string().max(60).optional().or(z.literal('')),
  parentAccountId: z.string().nullable().optional(),
  description: z.string().max(400).optional().or(z.literal('')),
})

type AccountFormValues = z.infer<ReturnType<typeof accountSchema>>

const typeTone: Record<number, 'default' | 'secondary' | 'success' | 'warning' | 'outline'> = {
  [AccountType.Asset]: 'default',
  [AccountType.Liability]: 'warning',
  [AccountType.Equity]: 'secondary',
  [AccountType.Revenue]: 'success',
  [AccountType.Expense]: 'outline',
}

export function AccountsPage() {
  const { t } = useTranslation()
  const labels = useLabels()
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
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('accounts.code')} />,
        cell: ({ row }) => <span className="font-mono text-xs font-medium">{row.original.code}</span>,
      },
      {
        accessorKey: 'name',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('accounts.account')} />,
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
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('common.type')} />,
        cell: ({ row }) => (
          <Badge variant={typeTone[row.original.type] ?? 'secondary'}>
            {labels.accountType[row.original.type] ?? t('common.dash')}
          </Badge>
        ),
        filterFn: (row, _columnId, filterValue) => String(row.original.type) === String(filterValue),
      },
      {
        accessorKey: 'normalBalance',
        header: t('accounts.normalBalance'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.normalBalance === NormalBalance.Debit
              ? labels.normalBalance[NormalBalance.Debit]
              : labels.normalBalance[NormalBalance.Credit]}
          </span>
        ),
      },
      {
        accessorKey: 'isActive',
        header: t('common.status'),
        cell: ({ row }) =>
          row.original.isActive ? (
            <Badge variant="success">{t('common.active')}</Badge>
          ) : (
            <Badge variant="outline">{t('common.inactive')}</Badge>
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
                  <Power /> {t('accounts.deactivate')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [canManage, labels, t],
  )

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('accounts.title')}
        description={t('accounts.description')}
        breadcrumbs={[{ label: t('accounts.breadcrumbGl') }, { label: t('accounts.breadcrumbAccounts') }]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => accountsQuery.refetch()} loading={accountsQuery.isFetching}>
              <RefreshCw className="h-4 w-4" /> {t('common.refresh')}
            </Button>
            <Button size="sm" disabled={!canManage} onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" /> {t('accounts.newAccount')}
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t('accounts.statAccounts')} value={summary.total} hint={t('accounts.statActive', { count: summary.active })} />
        <StatCard label={t('accounts.statAssets')} value={summary.assets} />
        <StatCard label={t('accounts.statRevenue')} value={summary.revenue} />
        <StatCard label={t('accounts.statExpenses')} value={summary.expenses} />
      </div>

      {accountsQuery.error ? (
        <ErrorState error={accountsQuery.error} onRetry={() => accountsQuery.refetch()} title={t('accounts.couldNotLoad')} />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          isLoading={accountsQuery.isLoading}
          searchPlaceholder={t('accounts.searchPlaceholder')}
          initialSorting={[{ id: 'code', desc: false }]}
          getRowId={(row) => row.id}
          toolbar={
            <>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-8 w-[170px]">
                  <SelectValue placeholder={t('accounts.allTypes')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('accounts.allTypes')}</SelectItem>
                  {Object.entries(labels.accountType).map(([value, label]) => (
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
                {includeInactive ? t('common.showInactive') : t('common.activeOnly')}
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
        title={t('accounts.deactivateTitle')}
        description={
          accountToDeactivate
            ? t('accounts.deactivateDescription', {
                account: `${accountToDeactivate.code} · ${accountToDeactivate.name}`,
              })
            : undefined
        }
        confirmLabel={t('accounts.deactivate')}
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
  const { t } = useTranslation()
  const labels = useLabels()
  const createAccount = useCreateAccount()
  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema(t)),
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
          <DialogTitle>{t('accounts.newAccountTitle')}</DialogTitle>
          <DialogDescription>{t('accounts.newAccountDescription')}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="create-account-form" onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => <TextField label={t('accounts.fieldCode')} placeholder="1010" required {...field} />}
            />
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <SelectField
                  label={t('accounts.fieldType')}
                  required
                  value={field.value}
                  onChange={(value) => field.onChange(Number(value))}
                  options={Object.entries(labels.accountType).map(([value, label]) => ({
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
                <TextField
                  label={t('accounts.fieldName')}
                  placeholder={t('accounts.namePlaceholder')}
                  required
                  className="sm:col-span-2"
                  {...field}
                />
              )}
            />
            <FormField
              control={form.control}
              name="subType"
              render={({ field }) => (
                <TextField
                  label={t('accounts.fieldSubType')}
                  placeholder={t('accounts.subTypePlaceholder')}
                  {...field}
                  value={field.value ?? ''}
                />
              )}
            />
            <FormField
              control={form.control}
              name="parentAccountId"
              render={({ field }) => (
                <ComboboxField
                  label={t('accounts.fieldParent')}
                  options={parentOptions}
                  value={field.value ?? null}
                  onChange={(value) => field.onChange(value)}
                  placeholder={t('common.none')}
                />
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <TextAreaField
                  label={t('accounts.fieldDescription')}
                  placeholder={t('accounts.descriptionPlaceholder')}
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
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="create-account-form" loading={createAccount.isPending}>
            {t('accounts.createAccount')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
