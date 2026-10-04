import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { ColumnDef } from '@tanstack/react-table'
import { Boxes, History, MoreHorizontal, Plus, Power, RefreshCw } from 'lucide-react'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { EmptyState, ErrorState, Money } from '@/components/common/misc'
import { useAccounts, useItems, useStockTransactions, useTaxCodes } from '@/hooks/queries'
import { useCreateItem, useDeactivateItem } from '@/hooks/mutations'
import { useAuth } from '@/lib/auth'
import { InventoryValuationMethod, itemTypeLabels, ItemType, stockTransactionTypeLabels } from '@/lib/enums'
import { formatDate, formatNumber, today } from '@/lib/format'
import { cn, toNumber } from '@/lib/utils'
import type { Item, ItemRequest } from '@/lib/types'

const itemSchema = z.object({
  sku: z.string().min(1, 'SKU is required').max(40),
  name: z.string().min(2, 'Item name is required').max(160),
  description: z.string().max(400).optional().or(z.literal('')),
  type: z.coerce.number().int().min(1).max(3),
  salesPrice: z.coerce.number().min(0),
  purchaseCost: z.coerce.number().min(0),
  incomeAccountId: z.string().nullable().optional(),
  expenseAccountId: z.string().nullable().optional(),
  inventoryAssetAccountId: z.string().nullable().optional(),
  defaultTaxCodeId: z.string().nullable().optional(),
  reorderPoint: z.coerce.number().min(0),
})

type ItemFormValues = z.infer<typeof itemSchema>

export function ItemsPage() {
  const { hasRole } = useAuth()
  const canManage = hasRole('Admin', 'Accountant')

  const [includeInactive, setIncludeInactive] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [historyItem, setHistoryItem] = useState<Item | null>(null)
  const [itemToDeactivate, setItemToDeactivate] = useState<Item | null>(null)

  const itemsQuery = useItems(includeInactive)
  const deactivateItem = useDeactivateItem()

  const items = itemsQuery.data ?? []
  const inventoryValue = items.reduce((sum, item) => sum + item.quantityOnHand * item.averageCost, 0)
  const lowStock = items.filter((item) => item.type === ItemType.Inventory && item.quantityOnHand <= item.reorderPoint)

  const columns = useMemo<ColumnDef<Item>[]>(
    () => [
      {
        accessorKey: 'sku',
        header: ({ column }) => <DataTableColumnHeader column={column} title="SKU" />,
        cell: ({ row }) => <span className="font-mono text-xs font-medium">{row.original.sku}</span>,
      },
      {
        accessorKey: 'name',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Item" />,
        cell: ({ row }) => (
          <div className="min-w-[200px]">
            <p className="font-medium">{row.original.name}</p>
            <p className="text-xs text-muted-foreground">
              {itemTypeLabels[row.original.type]} · {InventoryValuationMethod[row.original.valuationMethod] ?? 'Weighted Average'}
            </p>
          </div>
        ),
      },
      {
        accessorKey: 'salesPrice',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Sales price" align="right" />,
        cell: ({ row }) => (
          <div className="text-right">
            <Money value={row.original.salesPrice} />
          </div>
        ),
      },
      {
        accessorKey: 'purchaseCost',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Cost" align="right" />,
        cell: ({ row }) => (
          <div className="text-right text-muted-foreground">
            <Money value={row.original.purchaseCost} />
          </div>
        ),
      },
      {
        id: 'quantityOnHand',
        header: ({ column }) => <DataTableColumnHeader column={column} title="On hand" align="right" />,
        accessorFn: (row) => row.quantityOnHand,
        cell: ({ row }) => {
          if (row.original.type !== ItemType.Inventory) return <div className="text-right text-muted-foreground">—</div>
          const low = row.original.quantityOnHand <= row.original.reorderPoint
          return (
            <div className={cn('text-right font-medium tabular-nums', low && 'text-warning')}>
              {formatNumber(row.original.quantityOnHand, 2)}
            </div>
          )
        },
      },
      {
        id: 'value',
        header: 'Inventory value',
        enableSorting: false,
        cell: ({ row }) => {
          if (row.original.type !== ItemType.Inventory) return <div className="text-right text-muted-foreground">—</div>
          return (
            <div className="text-right">
              <Money value={row.original.quantityOnHand * row.original.averageCost} />
              <p className="text-xs text-muted-foreground">avg {formatNumber(row.original.averageCost, 2)}</p>
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
                <DropdownMenuItem onClick={() => setHistoryItem(row.original)}>
                  <History /> Stock history
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!canManage || !row.original.isActive}
                  className="text-destructive focus:text-destructive"
                  onClick={() => setItemToDeactivate(row.original)}
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
        title="Items & inventory"
        description={`Inventory, service and non-inventory items. Weighted-average costing drives COGS on sale and stock receipts on purchase. Inventory value on hand: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(inventoryValue)}.`}
        breadcrumbs={[{ label: 'Assets & Banking' }, { label: 'Items & Inventory' }]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => itemsQuery.refetch()} loading={itemsQuery.isFetching}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Button size="sm" disabled={!canManage} onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> New item
            </Button>
          </>
        }
      />

      {lowStock.length ? (
        <div className="rounded-lg border border-warning/40 bg-warning/5 px-4 py-3 text-sm">
          <span className="font-medium">Low stock:</span>{' '}
          {lowStock.slice(0, 5).map((item) => `${item.name} (${formatNumber(item.quantityOnHand, 0)} left)`).join(', ')}
          {lowStock.length > 5 ? ` and ${lowStock.length - 5} more` : ''}
        </div>
      ) : null}

      {itemsQuery.error ? (
        <ErrorState error={itemsQuery.error} onRetry={() => itemsQuery.refetch()} title="Could not load items" />
      ) : (
        <DataTable
          columns={columns}
          data={items}
          isLoading={itemsQuery.isLoading}
          searchPlaceholder="Search by SKU or item name…"
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

      <CreateItemDialog open={createOpen} onOpenChange={setCreateOpen} />
      <StockHistoryDialog item={historyItem} onOpenChange={(open) => !open && setHistoryItem(null)} />

      <ConfirmDialog
        open={!!itemToDeactivate}
        onOpenChange={(open) => !open && setItemToDeactivate(null)}
        title="Deactivate item?"
        description={itemToDeactivate ? `${itemToDeactivate.name} will no longer be selectable on new invoices or bills.` : undefined}
        confirmLabel="Deactivate"
        destructive
        loading={deactivateItem.isPending}
        onConfirm={() => {
          if (!itemToDeactivate) return
          deactivateItem.mutate(itemToDeactivate.id, { onSuccess: () => setItemToDeactivate(null) })
        }}
      />
    </div>
  )
}

function StockHistoryDialog({ item, onOpenChange }: { item: Item | null; onOpenChange: (open: boolean) => void }) {
  const historyQuery = useStockTransactions(item?.id)
  const rows = historyQuery.data ?? []

  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Boxes className="h-4 w-4" /> {item?.name}
          </DialogTitle>
          <DialogDescription>
            Weighted-average stock ledger. Quantity on hand {formatNumber(item?.quantityOnHand ?? 0, 2)} · average cost{' '}
            {formatNumber(item?.averageCost ?? 0, 2)}.
          </DialogDescription>
        </DialogHeader>

        {rows.length === 0 ? (
          <EmptyState title="No stock movements" description="Movements appear when invoices and bills post." />
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit cost</TableHead>
                  <TableHead className="text-right">Running qty</TableHead>
                  <TableHead className="text-right">Running value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(row.transactionDate)}</TableCell>
                    <TableCell>{stockTransactionTypeLabels[row.type] ?? '—'}</TableCell>
                    <TableCell className={cn('text-right tabular-nums', row.quantity < 0 && 'text-destructive')}>
                      {formatNumber(row.quantity, 2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={row.unitCost} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(row.runningQuantity, 2)}</TableCell>
                    <TableCell className="text-right">
                      <Money value={row.runningValue} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function CreateItemDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const accountsQuery = useAccounts()
  const taxCodesQuery = useTaxCodes()
  const createItem = useCreateItem()

  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      sku: '',
      name: '',
      description: '',
      type: ItemType.Inventory,
      salesPrice: 0,
      purchaseCost: 0,
      incomeAccountId: null,
      expenseAccountId: null,
      inventoryAssetAccountId: null,
      defaultTaxCodeId: null,
      reorderPoint: 0,
    },
  })

  const itemType = form.watch('type')

  const revenueAccounts = useMemo(
    () =>
      (accountsQuery.data ?? [])
        .filter((account) => account.isActive && account.type === 4)
        .map((account) => ({ value: account.id, label: `${account.code} · ${account.name}` })),
    [accountsQuery.data],
  )
  const expenseAccounts = useMemo(
    () =>
      (accountsQuery.data ?? [])
        .filter((account) => account.isActive && account.type === 5)
        .map((account) => ({ value: account.id, label: `${account.code} · ${account.name}` })),
    [accountsQuery.data],
  )
  const assetAccounts = useMemo(
    () =>
      (accountsQuery.data ?? [])
        .filter((account) => account.isActive && account.type === 1)
        .map((account) => ({ value: account.id, label: `${account.code} · ${account.name}` })),
    [accountsQuery.data],
  )
  const taxOptions = useMemo(
    () => (taxCodesQuery.data ?? []).map((taxCode) => ({ value: taxCode.id, label: `${taxCode.code} · ${taxCode.ratePercent}%` })),
    [taxCodesQuery.data],
  )

  const onSubmit = (values: ItemFormValues) => {
    const payload: ItemRequest = {
      sku: values.sku.trim(),
      name: values.name.trim(),
      description: values.description?.trim() ? values.description.trim() : null,
      type: values.type as ItemType,
      salesPrice: toNumber(values.salesPrice),
      purchaseCost: toNumber(values.purchaseCost),
      incomeAccountId: values.incomeAccountId ?? null,
      expenseAccountId: values.expenseAccountId ?? null,
      inventoryAssetAccountId: values.inventoryAssetAccountId ?? null,
      defaultTaxCodeId: values.defaultTaxCodeId ?? null,
      reorderPoint: toNumber(values.reorderPoint),
    }
    createItem.mutate(payload, {
      onSuccess: () => {
        form.reset()
        onOpenChange(false)
      },
      onError: (error) => {
        if (error.fieldErrors) {
          for (const [field, messages] of Object.entries(error.fieldErrors)) {
            form.setError(field as keyof ItemFormValues, { message: messages[0] })
          }
        }
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New item</DialogTitle>
          <DialogDescription>Inventory items are valued at weighted-average cost and post COGS through the ledger.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="create-item" onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="sku"
              render={({ field }) => <TextField label="SKU" placeholder="SKU-104" required {...field} />}
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
                  options={Object.entries(itemTypeLabels).map(([value, label]) => ({ value, label }))}
                />
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <TextField label="Name" placeholder="Wireless Keyboard" required className="sm:col-span-2" {...field} />
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <TextAreaField label="Description" className="sm:col-span-2" {...field} value={field.value ?? ''} />
              )}
            />
            <FormField
              control={form.control}
              name="salesPrice"
              render={({ field }) => (
                <TextField label="Sales price" type="number" step="any" min={0} className="text-right" {...field} />
              )}
            />
            <FormField
              control={form.control}
              name="purchaseCost"
              render={({ field }) => (
                <TextField label="Purchase cost" type="number" step="any" min={0} className="text-right" {...field} />
              )}
            />
            <FormField
              control={form.control}
              name="incomeAccountId"
              render={({ field }) => (
                <ComboboxField
                  label="Income account"
                  options={revenueAccounts}
                  value={field.value ?? null}
                  onChange={field.onChange}
                  placeholder="Company default"
                />
              )}
            />
            <FormField
              control={form.control}
              name="expenseAccountId"
              render={({ field }) => (
                <ComboboxField
                  label="Expense / COGS account"
                  options={expenseAccounts}
                  value={field.value ?? null}
                  onChange={field.onChange}
                  placeholder="Company default"
                />
              )}
            />
            {itemType === ItemType.Inventory ? (
              <FormField
                control={form.control}
                name="inventoryAssetAccountId"
                render={({ field }) => (
                  <ComboboxField
                    label="Inventory asset account"
                    options={assetAccounts}
                    value={field.value ?? null}
                    onChange={field.onChange}
                    placeholder="1200 · Inventory Asset"
                  />
                )}
              />
            ) : null}
            <FormField
              control={form.control}
              name="defaultTaxCodeId"
              render={({ field }) => (
                <ComboboxField
                  label="Default tax code"
                  options={taxOptions}
                  value={field.value ?? null}
                  onChange={field.onChange}
                  placeholder="No tax"
                />
              )}
            />
            <FormField
              control={form.control}
              name="reorderPoint"
              render={({ field }) => (
                <TextField label="Reorder point" type="number" step="any" min={0} className="text-right" {...field} />
              )}
            />
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Opening stock is recorded through a bill or an inventory adjustment — today is {formatDate(today())}.
            </p>
          </form>
        </Form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="create-item" loading={createItem.isPending}>
            Create item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
