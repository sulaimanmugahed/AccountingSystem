import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm, useWatch } from 'react-hook-form'
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
import { ItemType } from '@/lib/enums'
import { useLabels } from '@/lib/labels'
import { formatDate, formatMoney, formatNumber, today } from '@/lib/format'
import { cn, toNumber } from '@/lib/utils'
import type { Item, ItemRequest } from '@/lib/types'

type Translate = (key: string, options?: Record<string, unknown>) => string

const itemSchema = (t: Translate) =>
  z.object({
  sku: z.string().min(1, t('items.errSkuRequired')).max(40),
  name: z.string().min(2, t('items.errNameRequired')).max(160),
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

type ItemFormValues = z.infer<ReturnType<typeof itemSchema>>

export function ItemsPage() {
  const { t } = useTranslation()
  const labels = useLabels()
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
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('items.sku')} />,
        cell: ({ row }) => <span className="font-mono text-xs font-medium">{row.original.sku}</span>,
      },
      {
        accessorKey: 'name',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('items.item')} />,
        cell: ({ row }) => (
          <div className="min-w-[200px]">
            <p className="font-medium">{row.original.name}</p>
            <p className="text-xs text-muted-foreground">
              {labels.itemType[row.original.type]} ·{' '}
              {labels.valuationMethod[row.original.valuationMethod] ?? t('enums.valuationMethod.weightedAverage')}
            </p>
          </div>
        ),
      },
      {
        accessorKey: 'salesPrice',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('items.salesPrice')} align="right" />,
        cell: ({ row }) => (
          <div className="text-end">
            <Money value={row.original.salesPrice} />
          </div>
        ),
      },
      {
        accessorKey: 'purchaseCost',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('items.cost')} align="right" />,
        cell: ({ row }) => (
          <div className="text-end text-muted-foreground">
            <Money value={row.original.purchaseCost} />
          </div>
        ),
      },
      {
        id: 'quantityOnHand',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('items.onHand')} align="right" />,
        accessorFn: (row) => row.quantityOnHand,
        cell: ({ row }) => {
          if (row.original.type !== ItemType.Inventory)
            return <div className="text-end text-muted-foreground">{t('common.dash')}</div>
          const low = row.original.quantityOnHand <= row.original.reorderPoint
          return (
            <div className={cn('text-end font-medium tabular-nums', low && 'text-warning')}>
              {formatNumber(row.original.quantityOnHand, 2)}
            </div>
          )
        },
      },
      {
        id: 'value',
        header: t('items.inventoryValue'),
        enableSorting: false,
        cell: ({ row }) => {
          if (row.original.type !== ItemType.Inventory)
            return <div className="text-end text-muted-foreground">{t('common.dash')}</div>
          return (
            <div className="text-end">
              <Money value={row.original.quantityOnHand * row.original.averageCost} />
              <p className="text-xs text-muted-foreground">
                {t('items.averageShort', { cost: formatNumber(row.original.averageCost, 2) })}
              </p>
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
                <DropdownMenuItem onClick={() => setHistoryItem(row.original)}>
                  <History /> {t('items.stockHistory')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!canManage || !row.original.isActive}
                  className="text-destructive focus:text-destructive"
                  onClick={() => setItemToDeactivate(row.original)}
                >
                  <Power /> {t('items.deactivate')}
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
        title={t('items.title')}
        description={t('items.description', { value: formatMoney(inventoryValue) })}
        breadcrumbs={[{ label: t('nav.groups.assetsBanking') }, { label: t('items.breadcrumb') }]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => itemsQuery.refetch()} loading={itemsQuery.isFetching}>
              <RefreshCw className="h-4 w-4" /> {t('common.refresh')}
            </Button>
            <Button size="sm" disabled={!canManage} onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> {t('items.newItem')}
            </Button>
          </>
        }
      />

      {lowStock.length ? (
        <div className="rounded-lg border border-warning/40 bg-warning/5 px-4 py-3 text-sm">
          <span className="font-medium">{t('items.lowStock')}</span>{' '}
          {lowStock
            .slice(0, 5)
            .map((item) =>
              t('items.lowStockItem', { name: item.name, qty: formatNumber(item.quantityOnHand, 0) }),
            )
            .join(', ')}
          {lowStock.length > 5 ? ` ${t('items.lowStockMore', { count: lowStock.length - 5 })}` : ''}
        </div>
      ) : null}

      {itemsQuery.error ? (
        <ErrorState
          error={itemsQuery.error}
          onRetry={() => itemsQuery.refetch()}
          title={t('items.couldNotLoad')}
        />
      ) : (
        <DataTable
          columns={columns}
          data={items}
          isLoading={itemsQuery.isLoading}
          searchPlaceholder={t('items.searchPlaceholder')}
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

      <CreateItemDialog open={createOpen} onOpenChange={setCreateOpen} />
      <StockHistoryDialog item={historyItem} onOpenChange={(open) => !open && setHistoryItem(null)} />

      <ConfirmDialog
        open={!!itemToDeactivate}
        onOpenChange={(open) => !open && setItemToDeactivate(null)}
        title={t('items.deactivateTitle')}
        description={
          itemToDeactivate
            ? t('items.deactivateDescription', { name: itemToDeactivate.name })
            : undefined
        }
        confirmLabel={t('items.deactivate')}
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
  const { t } = useTranslation()
  const labels = useLabels()
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
            {t('items.stockLedgerDescription', {
              qty: formatNumber(item?.quantityOnHand ?? 0, 2),
              cost: formatNumber(item?.averageCost ?? 0, 2),
            })}
          </DialogDescription>
        </DialogHeader>

        {rows.length === 0 ? (
          <EmptyState title={t('items.noMovements')} description={t('items.noMovementsHint')} />
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('common.date')}</TableHead>
                  <TableHead>{t('common.type')}</TableHead>
                  <TableHead className="text-end">{t('invoices.qty')}</TableHead>
                  <TableHead className="text-end">{t('items.unitCost')}</TableHead>
                  <TableHead className="text-end">{t('items.runningQty')}</TableHead>
                  <TableHead className="text-end">{t('items.runningValue')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(row.transactionDate)}</TableCell>
                    <TableCell>
                      {labels.stockTransactionType[row.type] ?? t('common.dash')}
                    </TableCell>
                    <TableCell className={cn('text-end tabular-nums', row.quantity < 0 && 'text-destructive')}>
                      {formatNumber(row.quantity, 2)}
                    </TableCell>
                    <TableCell className="text-end">
                      <Money value={row.unitCost} />
                    </TableCell>
                    <TableCell className="text-end tabular-nums">{formatNumber(row.runningQuantity, 2)}</TableCell>
                    <TableCell className="text-end">
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
  const { t } = useTranslation()
  const labels = useLabels()
  const accountsQuery = useAccounts()
  const taxCodesQuery = useTaxCodes()
  const createItem = useCreateItem()

  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema(t)),
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

  const itemType = useWatch({ control: form.control, name: 'type' })

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
          <DialogTitle>{t('items.newItemTitle')}</DialogTitle>
          <DialogDescription>{t('items.newItemDescription')}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="create-item" onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="sku"
              render={({ field }) => (
                <TextField label={t('items.sku')} placeholder={t('items.skuPlaceholder')} required {...field} />
              )}
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
                  options={Object.entries(labels.itemType).map(([value, label]) => ({ value, label }))}
                />
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <TextField
                  label={t('common.name')}
                  placeholder={t('items.namePlaceholder')}
                  required
                  className="sm:col-span-2"
                  {...field}
                />
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <TextAreaField
                  label={t('common.description')}
                  className="sm:col-span-2"
                  {...field}
                  value={field.value ?? ''}
                />
              )}
            />
            <FormField
              control={form.control}
              name="salesPrice"
              render={({ field }) => (
                <TextField
                  label={t('items.salesPrice')}
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
              name="purchaseCost"
              render={({ field }) => (
                <TextField
                  label={t('items.purchaseCost')}
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
              name="incomeAccountId"
              render={({ field }) => (
                <ComboboxField
                  label={t('items.incomeAccount')}
                  options={revenueAccounts}
                  value={field.value ?? null}
                  onChange={field.onChange}
                  placeholder={t('items.companyDefault')}
                />
              )}
            />
            <FormField
              control={form.control}
              name="expenseAccountId"
              render={({ field }) => (
                <ComboboxField
                  label={t('items.expenseAccount')}
                  options={expenseAccounts}
                  value={field.value ?? null}
                  onChange={field.onChange}
                  placeholder={t('items.companyDefault')}
                />
              )}
            />
            {itemType === ItemType.Inventory ? (
              <FormField
                control={form.control}
                name="inventoryAssetAccountId"
                render={({ field }) => (
                  <ComboboxField
                    label={t('items.inventoryAssetAccount')}
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
                  label={t('items.defaultTaxCode')}
                  options={taxOptions}
                  value={field.value ?? null}
                  onChange={field.onChange}
                  placeholder={t('bills.noTax')}
                />
              )}
            />
            <FormField
              control={form.control}
              name="reorderPoint"
              render={({ field }) => (
                <TextField
                  label={t('items.reorderPoint')}
                  type="number"
                  step="any"
                  min={0}
                  className="text-end"
                  {...field}
                />
              )}
            />
            <p className="text-xs text-muted-foreground sm:col-span-2">
              {t('items.openingStockNote', { date: formatDate(today()) })}
            </p>
          </form>
        </Form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="create-item" loading={createItem.isPending}>
            {t('items.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
