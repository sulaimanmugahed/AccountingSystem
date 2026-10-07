import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { ColumnDef } from '@tanstack/react-table'
import { Mail, MoreHorizontal, Pencil, Phone, Plus, Power, RefreshCw } from 'lucide-react'
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
import { SelectField, TextField } from '@/components/ui/fields'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { ErrorState, Money } from '@/components/common/misc'
import { useCustomers, useInvoices } from '@/hooks/queries'
import { useCreateCustomer, useDeactivateCustomer, useUpdateCustomer } from '@/hooks/mutations'
import { useAuth } from '@/lib/auth'
import { CURRENCIES } from '@/lib/constants'
import { formatMoney } from '@/lib/format'
import type { Customer, CustomerRequest } from '@/lib/types'

type Translate = (key: string, options?: Record<string, unknown>) => string

const customerSchema = (t: Translate) =>
  z.object({
    code: z.string().min(1, t('customers.codeRequired')).max(30),
    name: z.string().min(2, t('customers.nameRequired')).max(160),
    email: z.union([z.string().email(t('validate.invalidEmail')), z.literal('')]).optional(),
    phone: z.string().max(40).optional().or(z.literal('')),
    paymentTermsDays: z.coerce.number().int().min(0, t('customers.termsNegative')).max(365),
    creditLimit: z.coerce.number().min(0, t('customers.creditNegative')),
    currencyCode: z.string().length(3, t('customers.currencyCode3')),
  })

type CustomerFormValues = z.infer<ReturnType<typeof customerSchema>>

export function CustomersPage() {
  const { t } = useTranslation()
  const { hasRole } = useAuth()
  const canManage = hasRole('Admin', 'Accountant', 'ARClerk')

  const [includeInactive, setIncludeInactive] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [customerToDeactivate, setCustomerToDeactivate] = useState<Customer | null>(null)

  const customersQuery = useCustomers(includeInactive)
  const invoicesQuery = useInvoices()
  const deactivateCustomer = useDeactivateCustomer()

  const openBalanceByCustomer = useMemo(() => {
    const map = new Map<string, number>()
    for (const invoice of invoicesQuery.data ?? []) {
      if (invoice.status === 6) continue // Voided
      map.set(invoice.customerId, (map.get(invoice.customerId) ?? 0) + invoice.balance)
    }
    return map
  }, [invoicesQuery.data])

  const columns = useMemo<ColumnDef<Customer>[]>(
    () => [
      {
        accessorKey: 'code',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('common.code')} />,
        cell: ({ row }) => <span className="font-mono text-xs font-medium">{row.original.code}</span>,
      },
      {
        accessorKey: 'name',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('customers.customer')} />,
        cell: ({ row }) => (
          <div className="min-w-[180px]">
            <p className="font-medium">{row.original.name}</p>
            <p className="text-xs text-muted-foreground">{row.original.currencyCode}</p>
          </div>
        ),
      },
      {
        id: 'contact',
        header: t('customers.contact'),
        enableSorting: false,
        cell: ({ row }) => (
          <div className="space-y-0.5 text-xs text-muted-foreground">
            {row.original.email ? (
              <p className="flex items-center gap-1.5">
                <Mail className="h-3 w-3" /> {row.original.email}
              </p>
            ) : null}
            {row.original.phone ? (
              <p className="flex items-center gap-1.5">
                <Phone className="h-3 w-3" /> {row.original.phone}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: 'paymentTermsDays',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('customers.terms')} />,
        cell: ({ row }) => <span className="text-sm">{t('common.netTerms', { days: row.original.paymentTermsDays })}</span>,
      },
      {
        accessorKey: 'creditLimit',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('customers.creditLimit')} align="right" />,
        cell: ({ row }) => (
          <div className="text-end">
            <Money value={row.original.creditLimit} />
          </div>
        ),
      },
      {
        id: 'openBalance',
        header: t('customers.openAr'),
        enableSorting: false,
        cell: ({ row }) => {
          const balance = openBalanceByCustomer.get(row.original.id) ?? 0
          return (
            <div className="text-end">
              {balance > 0 ? <Money value={balance} /> : <span className="text-muted-foreground">{t('common.dash')}</span>}
            </div>
          )
        },
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
                <DropdownMenuLabel>{row.original.name}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={!canManage}
                  onClick={() => {
                    setEditing(row.original)
                    setDialogOpen(true)
                  }}
                >
                  <Pencil /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!canManage || !row.original.isActive}
                  className="text-destructive focus:text-destructive"
                  onClick={() => setCustomerToDeactivate(row.original)}
                >
                  <Power /> Deactivate
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [canManage, openBalanceByCustomer],
  )

  const totalOpen = [...openBalanceByCustomer.values()].reduce((sum, value) => sum + value, 0)

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('customers.title')}
        description={
          totalOpen > 0
            ? t('customers.descriptionWithBalance', { amount: formatMoney(totalOpen) })
            : t('customers.description')
        }
        breadcrumbs={[{ label: t('nav.groups.receivables') }, { label: t('customers.breadcrumb') }]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => customersQuery.refetch()} loading={customersQuery.isFetching}>
              <RefreshCw className="h-4 w-4" /> {t('common.refresh')}
            </Button>
            <Button
              size="sm"
              disabled={!canManage}
              onClick={() => {
                setEditing(null)
                setDialogOpen(true)
              }}
            >
              <Plus className="h-4 w-4" /> {t('customers.newCustomer')}
            </Button>
          </>
        }
      />

      {customersQuery.error ? (
        <ErrorState error={customersQuery.error} onRetry={() => customersQuery.refetch()} title={t('customers.couldNotLoad')} />
      ) : (
        <DataTable
          columns={columns}
          data={customersQuery.data ?? []}
          isLoading={customersQuery.isLoading}
          searchPlaceholder={t('customers.searchPlaceholder')}
          getRowId={(row) => row.id}
          initialSorting={[{ id: 'name', desc: false }]}
          toolbar={
            <Button
              variant={includeInactive ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setIncludeInactive((value) => !value)}
            >
              {includeInactive ? t('common.showInactive') : t('common.activeOnly')}
            </Button>
          }
        />
      )}

      <CustomerDialog open={dialogOpen} onOpenChange={setDialogOpen} customer={editing} />

      <ConfirmDialog
        open={!!customerToDeactivate}
        onOpenChange={(open) => !open && setCustomerToDeactivate(null)}
        title={t('customers.deactivateTitle')}
        description={
          customerToDeactivate
            ? t('customers.deactivateDescription', { name: customerToDeactivate.name })
            : undefined
        }
        confirmLabel={t('customers.deactivate')}
        destructive
        loading={deactivateCustomer.isPending}
        onConfirm={() => {
          if (!customerToDeactivate) return
          deactivateCustomer.mutate(customerToDeactivate.id, { onSuccess: () => setCustomerToDeactivate(null) })
        }}
      />
    </div>
  )
}

function CustomerDialog({
  open,
  onOpenChange,
  customer,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer: Customer | null
}) {
  const { t } = useTranslation()
  const createCustomer = useCreateCustomer()
  const updateCustomer = useUpdateCustomer()
  const isEdit = !!customer

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema(t)),
    values: {
      code: customer?.code ?? '',
      name: customer?.name ?? '',
      email: customer?.email ?? '',
      phone: customer?.phone ?? '',
      paymentTermsDays: customer?.paymentTermsDays ?? 30,
      creditLimit: customer?.creditLimit ?? 0,
      currencyCode: customer?.currencyCode ?? 'USD',
    },
  })

  const onSubmit = (values: CustomerFormValues) => {
    const payload: CustomerRequest = {
      code: values.code.trim(),
      name: values.name.trim(),
      email: values.email?.trim() ? values.email.trim() : null,
      phone: values.phone?.trim() ? values.phone.trim() : null,
      paymentTermsDays: values.paymentTermsDays,
      creditLimit: values.creditLimit,
      currencyCode: values.currencyCode.toUpperCase(),
    }

    const onError = (error: { fieldErrors?: Record<string, string[]> }) => {
      if (!error.fieldErrors) return
      for (const [field, messages] of Object.entries(error.fieldErrors)) {
        form.setError(field as keyof CustomerFormValues, { message: messages[0] })
      }
    }

    if (isEdit && customer) {
      updateCustomer.mutate({ id: customer.id, ...payload }, { onSuccess: () => onOpenChange(false), onError })
    } else {
      createCustomer.mutate(payload, { onSuccess: () => onOpenChange(false), onError })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('customers.editCustomerTitle', { name: customer?.name ?? '' }) : t('customers.newCustomerTitle')}
          </DialogTitle>
          <DialogDescription>{t('customers.dialogDescription')}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="customer-form" onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => <TextField label={t('customers.customerCode')} placeholder="C-1007" required {...field} />}
            />
            <FormField
              control={form.control}
              name="currencyCode"
              render={({ field }) => (
                <SelectField
                  label={t('common.currency')}
                  required
                  value={field.value}
                  onChange={field.onChange}
                  options={CURRENCIES}
                />
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <TextField
                  label={t('customers.legalName')}
                  placeholder={t('customers.legalNamePlaceholder')}
                  required
                  className="sm:col-span-2"
                  {...field}
                />
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <TextField label={t('common.email')} type="email" placeholder="billing@example.com" {...field} value={field.value ?? ''} />
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <TextField label={t('common.phone')} placeholder="+1 (555) 010-0100" {...field} value={field.value ?? ''} />
              )}
            />
            <FormField
              control={form.control}
              name="paymentTermsDays"
              render={({ field }) => (
                <TextField label={t('customers.paymentTermsDays')} type="number" min={0} {...field} />
              )}
            />
            <FormField
              control={form.control}
              name="creditLimit"
              render={({ field }) => (
                <TextField label={t('customers.creditLimit')} type="number" step="any" min={0} className="text-end" {...field} />
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            form="customer-form"
            loading={createCustomer.isPending || updateCustomer.isPending}
          >
            {isEdit ? t('customers.saveChanges') : t('customers.createCustomer')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
