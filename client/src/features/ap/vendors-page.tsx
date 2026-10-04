import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { ColumnDef } from '@tanstack/react-table'
import { Mail, MoreHorizontal, Pencil, Plus, Power, RefreshCw } from 'lucide-react'
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
import { CheckboxField, SelectField, TextField } from '@/components/ui/fields'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { ErrorState, Money } from '@/components/common/misc'
import { useBills, useVendors } from '@/hooks/queries'
import { useCreateVendor, useDeactivateVendor, useUpdateVendor } from '@/hooks/mutations'
import { useAuth } from '@/lib/auth'
import { CURRENCIES } from '@/lib/constants'
import { formatMoney } from '@/lib/format'
import type { Vendor, VendorRequest } from '@/lib/types'

const vendorSchema = z.object({
  code: z.string().min(1, 'Vendor code is required').max(30),
  name: z.string().min(2, 'Vendor name is required').max(160),
  email: z.union([z.string().email('Enter a valid email address'), z.literal('')]).optional(),
  phone: z.string().max(40).optional().or(z.literal('')),
  paymentTermsDays: z.coerce.number().int().min(0).max(365),
  currencyCode: z.string().length(3, 'Use a 3-letter currency code'),
  is1099Vendor: z.boolean(),
})

type VendorFormValues = z.infer<typeof vendorSchema>

export function VendorsPage() {
  const { hasRole } = useAuth()
  const canManage = hasRole('Admin', 'Accountant', 'APClerk')

  const [includeInactive, setIncludeInactive] = useState(false)
  const [editing, setEditing] = useState<Vendor | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [vendorToDeactivate, setVendorToDeactivate] = useState<Vendor | null>(null)

  const vendorsQuery = useVendors(includeInactive)
  const billsQuery = useBills()
  const deactivateVendor = useDeactivateVendor()

  const openBalanceByVendor = useMemo(() => {
    const map = new Map<string, number>()
    for (const bill of billsQuery.data ?? []) {
      if (bill.status === 5) continue // Voided
      map.set(bill.vendorId, (map.get(bill.vendorId) ?? 0) + bill.balance)
    }
    return map
  }, [billsQuery.data])

  const columns = useMemo<ColumnDef<Vendor>[]>(
    () => [
      {
        accessorKey: 'code',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Code" />,
        cell: ({ row }) => <span className="font-mono text-xs font-medium">{row.original.code}</span>,
      },
      {
        accessorKey: 'name',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Vendor" />,
        cell: ({ row }) => (
          <div className="min-w-[180px]">
            <p className="font-medium">{row.original.name}</p>
            {row.original.is1099Vendor ? <p className="text-xs text-muted-foreground">1099 vendor</p> : null}
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
            {row.original.phone ? <p>{row.original.phone}</p> : null}
          </div>
        ),
      },
      {
        accessorKey: 'paymentTermsDays',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Terms" />,
        cell: ({ row }) => <span className="text-sm">Net {row.original.paymentTermsDays}</span>,
      },
      {
        id: 'openBalance',
        header: 'Open AP',
        enableSorting: false,
        cell: ({ row }) => {
          const balance = openBalanceByVendor.get(row.original.id) ?? 0
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
                  onClick={() => setVendorToDeactivate(row.original)}
                >
                  <Power /> Deactivate
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [canManage, openBalanceByVendor],
  )

  const totalOpen = [...openBalanceByVendor.values()].reduce((sum, value) => sum + value, 0)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Vendors"
        description={`Supplier master data.${totalOpen > 0 ? ` Total open AP is ${formatMoney(totalOpen)}.` : ''}`}
        breadcrumbs={[{ label: 'Payables' }, { label: 'Vendors' }]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => vendorsQuery.refetch()} loading={vendorsQuery.isFetching}>
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
              <Plus className="h-4 w-4" /> New vendor
            </Button>
          </>
        }
      />

      {vendorsQuery.error ? (
        <ErrorState error={vendorsQuery.error} onRetry={() => vendorsQuery.refetch()} title="Could not load vendors" />
      ) : (
        <DataTable
          columns={columns}
          data={vendorsQuery.data ?? []}
          isLoading={vendorsQuery.isLoading}
          searchPlaceholder="Search vendors by code, name or email…"
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

      <VendorDialog open={dialogOpen} onOpenChange={setDialogOpen} vendor={editing} />

      <ConfirmDialog
        open={!!vendorToDeactivate}
        onOpenChange={(open) => !open && setVendorToDeactivate(null)}
        title="Deactivate vendor?"
        description={vendorToDeactivate ? `${vendorToDeactivate.name} will no longer be selectable on new documents.` : undefined}
        confirmLabel="Deactivate"
        destructive
        loading={deactivateVendor.isPending}
        onConfirm={() => {
          if (!vendorToDeactivate) return
          deactivateVendor.mutate(vendorToDeactivate.id, { onSuccess: () => setVendorToDeactivate(null) })
        }}
      />
    </div>
  )
}

function VendorDialog({
  open,
  onOpenChange,
  vendor,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  vendor: Vendor | null
}) {
  const createVendor = useCreateVendor()
  const updateVendor = useUpdateVendor()
  const isEdit = !!vendor

  const form = useForm<VendorFormValues>({
    resolver: zodResolver(vendorSchema),
    values: {
      code: vendor?.code ?? '',
      name: vendor?.name ?? '',
      email: vendor?.email ?? '',
      phone: vendor?.phone ?? '',
      paymentTermsDays: vendor?.paymentTermsDays ?? 30,
      currencyCode: vendor?.currencyCode ?? 'USD',
      is1099Vendor: vendor?.is1099Vendor ?? false,
    },
  })

  const onSubmit = (values: VendorFormValues) => {
    const payload: VendorRequest = {
      code: values.code.trim(),
      name: values.name.trim(),
      email: values.email?.trim() ? values.email.trim() : null,
      phone: values.phone?.trim() ? values.phone.trim() : null,
      paymentTermsDays: values.paymentTermsDays,
      currencyCode: values.currencyCode.toUpperCase(),
      is1099Vendor: values.is1099Vendor,
    }

    const onError = (error: { fieldErrors?: Record<string, string[]> }) => {
      if (!error.fieldErrors) return
      for (const [field, messages] of Object.entries(error.fieldErrors)) {
        form.setError(field as keyof VendorFormValues, { message: messages[0] })
      }
    }

    if (isEdit && vendor) {
      updateVendor.mutate({ id: vendor.id, ...payload }, { onSuccess: () => onOpenChange(false), onError })
    } else {
      createVendor.mutate(payload, { onSuccess: () => onOpenChange(false), onError })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${vendor?.name}` : 'New vendor'}</DialogTitle>
          <DialogDescription>Payment terms default the due date on new bills.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="vendor-form" onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => <TextField label="Vendor code" placeholder="V-2006" required {...field} />}
            />
            <FormField
              control={form.control}
              name="currencyCode"
              render={({ field }) => (
                <SelectField label="Currency" required value={field.value} onChange={field.onChange} options={CURRENCIES} />
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <TextField label="Legal name" placeholder="Pacific Office Supplies" required className="sm:col-span-2" {...field} />
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
              render={({ field }) => <TextField label="Phone" {...field} value={field.value ?? ''} />}
            />
            <FormField
              control={form.control}
              name="paymentTermsDays"
              render={({ field }) => <TextField label="Payment terms (days)" type="number" min={0} {...field} />}
            />
            <FormField
              control={form.control}
              name="is1099Vendor"
              render={({ field }) => (
                <CheckboxField
                  label="1099 vendor"
                  description="Include in 1099 reporting"
                  checked={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="vendor-form" loading={createVendor.isPending || updateVendor.isPending}>
            {isEdit ? 'Save changes' : 'Create vendor'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
