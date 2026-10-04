import { useMemo, useState } from 'react'
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

const customerSchema = z.object({
  code: z.string().min(1, 'Customer code is required').max(30),
  name: z.string().min(2, 'Customer name is required').max(160),
  email: z.union([z.string().email('Enter a valid email address'), z.literal('')]).optional(),
  phone: z.string().max(40).optional().or(z.literal('')),
  paymentTermsDays: z.coerce.number().int().min(0, 'Terms cannot be negative').max(365),
  creditLimit: z.coerce.number().min(0, 'Credit limit cannot be negative'),
  currencyCode: z.string().length(3, 'Use a 3-letter currency code'),
})

type CustomerFormValues = z.infer<typeof customerSchema>

export function CustomersPage() {
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
        header: ({ column }) => <DataTableColumnHeader column={column} title="Code" />,
        cell: ({ row }) => <span className="font-mono text-xs font-medium">{row.original.code}</span>,
      },
      {
        accessorKey: 'name',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" />,
        cell: ({ row }) => (
          <div className="min-w-[180px]">
            <p className="font-medium">{row.original.name}</p>
            <p className="text-xs text-muted-foreground">{row.original.currencyCode}</p>
          </div>
        ),
      },
      {
        id: 'contact',
        header: 'Contact',
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
        header: ({ column }) => <DataTableColumnHeader column={column} title="Terms" />,
        cell: ({ row }) => <span className="text-sm">Net {row.original.paymentTermsDays}</span>,
      },
      {
        accessorKey: 'creditLimit',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Credit limit" align="right" />,
        cell: ({ row }) => (
          <div className="text-right">
            <Money value={row.original.creditLimit} />
          </div>
        ),
      },
      {
        id: 'openBalance',
        header: 'Open AR',
        enableSorting: false,
        cell: ({ row }) => {
          const balance = openBalanceByCustomer.get(row.original.id) ?? 0
          return (
            <div className="text-right">
              {balance > 0 ? <Money value={balance} /> : <span className="text-muted-foreground">—</span>}
            </div>
          )
        },
      },
      {
        accessorKey: 'isActive',
        header: 'Status',
        cell: ({ row }) =>
          row.original.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="outline">Inactive</Badge>,
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
        title="Customers"
        description={`Master data for accounts receivable.${totalOpen > 0 ? ` Total open AR is ${formatMoney(totalOpen)}.` : ''}`}
        breadcrumbs={[{ label: 'Receivables' }, { label: 'Customers' }]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => customersQuery.refetch()} loading={customersQuery.isFetching}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Button
              size="sm"
              disabled={!canManage}
              onClick={() => {
                setEditing(null)
                setDialogOpen(true)
              }}
            >
              <Plus className="h-4 w-4" /> New customer
            </Button>
          </>
        }
      />

      {customersQuery.error ? (
        <ErrorState error={customersQuery.error} onRetry={() => customersQuery.refetch()} title="Could not load customers" />
      ) : (
        <DataTable
          columns={columns}
          data={customersQuery.data ?? []}
          isLoading={customersQuery.isLoading}
          searchPlaceholder="Search customers by code, name or email…"
          getRowId={(row) => row.id}
          initialSorting={[{ id: 'name', desc: false }]}
          toolbar={
            <Button
              variant={includeInactive ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setIncludeInactive((value) => !value)}
            >
              {includeInactive ? 'Showing inactive' : 'Active only'}
            </Button>
          }
        />
      )}

      <CustomerDialog open={dialogOpen} onOpenChange={setDialogOpen} customer={editing} />

      <ConfirmDialog
        open={!!customerToDeactivate}
        onOpenChange={(open) => !open && setCustomerToDeactivate(null)}
        title="Deactivate customer?"
        description={customerToDeactivate ? `${customerToDeactivate.name} will no longer be selectable on new documents.` : undefined}
        confirmLabel="Deactivate"
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
  const createCustomer = useCreateCustomer()
  const updateCustomer = useUpdateCustomer()
  const isEdit = !!customer

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
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
          <DialogTitle>{isEdit ? `Edit ${customer?.name}` : 'New customer'}</DialogTitle>
          <DialogDescription>
            Payment terms drive invoice due dates; the credit limit is enforced on the customer dashboard.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="customer-form" onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => <TextField label="Customer code" placeholder="C-1007" required {...field} />}
            />
            <FormField
              control={form.control}
              name="currencyCode"
              render={({ field }) => (
                <SelectField
                  label="Currency"
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
                <TextField label="Legal name" placeholder="Northwind Traders" required className="sm:col-span-2" {...field} />
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <TextField label="Email" type="email" placeholder="billing@example.com" {...field} value={field.value ?? ''} />
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <TextField label="Phone" placeholder="+1 (555) 010-0100" {...field} value={field.value ?? ''} />
              )}
            />
            <FormField
              control={form.control}
              name="paymentTermsDays"
              render={({ field }) => <TextField label="Payment terms (days)" type="number" min={0} {...field} />}
            />
            <FormField
              control={form.control}
              name="creditLimit"
              render={({ field }) => (
                <TextField label="Credit limit" type="number" step="any" min={0} className="text-right" {...field} />
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="customer-form"
            loading={createCustomer.isPending || updateCustomer.isPending}
          >
            {isEdit ? 'Save changes' : 'Create customer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
