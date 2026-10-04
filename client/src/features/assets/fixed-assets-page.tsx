import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { ColumnDef } from '@tanstack/react-table'
import { Calculator, Landmark, MoreHorizontal, Plus, RefreshCw, TrendingDown } from 'lucide-react'
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
import { ComboboxField, DateField, SelectField, TextField } from '@/components/ui/fields'
import { ErrorState, StatCard } from '@/components/common/misc'
import { Money } from '@/components/common/misc'
import { useAccounts, useFixedAssets } from '@/hooks/queries'
import { useCreateFixedAsset, useDisposeAsset, useRunDepreciation } from '@/hooks/mutations'
import { useAuth } from '@/lib/auth'
import { assetStatusLabels, depreciationMethodLabels, DepreciationMethod } from '@/lib/enums'
import { assetStatusTone } from '@/lib/types'
import { endOfMonth, formatDate, formatMoney, today } from '@/lib/format'
import { toNumber } from '@/lib/utils'
import type { FixedAsset, FixedAssetRequest } from '@/lib/types'

const assetSchema = z.object({
  code: z.string().min(1, 'Asset code is required').max(30),
  name: z.string().min(2, 'Asset name is required').max(160),
  acquisitionDate: z.string().min(1, 'Acquisition date is required'),
  acquisitionCost: z.coerce.number().positive('Cost must be greater than zero'),
  salvageValue: z.coerce.number().min(0),
  usefulLifeMonths: z.coerce.number().int().positive('Useful life must be at least one month'),
  method: z.coerce.number().int().min(1).max(2),
  assetAccountId: z.string().min(1, 'Select the asset account'),
  accumulatedDepreciationAccountId: z.string().min(1, 'Select the accumulated depreciation account'),
  depreciationExpenseAccountId: z.string().min(1, 'Select the depreciation expense account'),
})

type AssetFormValues = z.infer<typeof assetSchema>

const disposeSchema = z.object({
  disposalDate: z.string().min(1, 'Disposal date is required'),
  proceeds: z.coerce.number().min(0),
})

type DisposeFormValues = z.infer<typeof disposeSchema>

export function FixedAssetsPage() {
  const { hasRole } = useAuth()
  const canManage = hasRole('Admin', 'Accountant')

  const [createOpen, setCreateOpen] = useState(false)
  const [depreciationOpen, setDepreciationOpen] = useState(false)
  const [assetToDispose, setAssetToDispose] = useState<FixedAsset | null>(null)

  const assetsQuery = useFixedAssets()
  const assets = assetsQuery.data ?? []

  const totals = useMemo(() => {
    const cost = assets.reduce((sum, asset) => sum + asset.acquisitionCost, 0)
    const depreciation = assets.reduce((sum, asset) => sum + asset.accumulatedDepreciation, 0)
    return {
      cost,
      depreciation,
      bookValue: cost - depreciation,
      active: assets.filter((asset) => asset.status === 1).length,
    }
  }, [assets])

  const columns = useMemo<ColumnDef<FixedAsset>[]>(
    () => [
      {
        accessorKey: 'code',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Code" />,
        cell: ({ row }) => <span className="font-mono text-xs font-medium">{row.original.code}</span>,
      },
      {
        accessorKey: 'name',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Asset" />,
        cell: ({ row }) => (
          <div className="min-w-[200px]">
            <p className="font-medium">{row.original.name}</p>
            <p className="text-xs text-muted-foreground">
              {depreciationMethodLabels[row.original.method]} · {row.original.usefulLifeMonths} months
            </p>
          </div>
        ),
      },
      {
        accessorKey: 'acquisitionDate',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Acquired" />,
        cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.acquisitionDate)}</span>,
      },
      {
        accessorKey: 'acquisitionCost',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Cost" align="right" />,
        cell: ({ row }) => (
          <div className="text-right">
            <Money value={row.original.acquisitionCost} />
          </div>
        ),
      },
      {
        accessorKey: 'accumulatedDepreciation',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Accum. dep." align="right" />,
        cell: ({ row }) => (
          <div className="text-right text-muted-foreground">
            <Money value={row.original.accumulatedDepreciation} />
          </div>
        ),
      },
      {
        id: 'bookValue',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Book value" align="right" />,
        accessorFn: (row) => row.acquisitionCost - row.accumulatedDepreciation,
        cell: ({ row }) => (
          <div className="text-right font-medium">
            <Money value={row.original.acquisitionCost - row.original.accumulatedDepreciation} />
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={assetStatusTone[row.original.status] ?? 'secondary'}>
            {assetStatusLabels[row.original.status] ?? '—'}
          </Badge>
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
                  disabled={!canManage || row.original.status === 3}
                  className="text-destructive focus:text-destructive"
                  onClick={() => setAssetToDispose(row.original)}
                >
                  <TrendingDown /> Dispose
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
        title="Fixed assets"
        description="Register depreciable assets, run the monthly depreciation posting, and record disposals with automatic gain/loss."
        breadcrumbs={[{ label: 'Assets & Banking' }, { label: 'Fixed Assets' }]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => assetsQuery.refetch()} loading={assetsQuery.isFetching}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Button variant="outline" size="sm" disabled={!canManage} onClick={() => setDepreciationOpen(true)}>
              <Calculator className="h-4 w-4" /> Run depreciation
            </Button>
            <Button size="sm" disabled={!canManage} onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> New asset
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Assets" value={assets.length} hint={`${totals.active} active`} icon={Landmark} />
        <StatCard label="Acquisition cost" value={formatMoney(totals.cost)} />
        <StatCard label="Accumulated depreciation" value={formatMoney(totals.depreciation)} />
        <StatCard label="Net book value" value={formatMoney(totals.bookValue)} tone="positive" />
      </div>

      {assetsQuery.error ? (
        <ErrorState error={assetsQuery.error} onRetry={() => assetsQuery.refetch()} title="Could not load fixed assets" />
      ) : (
        <DataTable
          columns={columns}
          data={assets}
          isLoading={assetsQuery.isLoading}
          searchPlaceholder="Search assets by code or name…"
          getRowId={(row) => row.id}
          initialSorting={[{ id: 'code', desc: false }]}
        />
      )}

      <CreateAssetDialog open={createOpen} onOpenChange={setCreateOpen} />
      <RunDepreciationDialog open={depreciationOpen} onOpenChange={setDepreciationOpen} />
      <DisposeAssetDialog asset={assetToDispose} onOpenChange={(open) => !open && setAssetToDispose(null)} />
    </div>
  )
}

function CreateAssetDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const accountsQuery = useAccounts()
  const createAsset = useCreateFixedAsset()

  const form = useForm<AssetFormValues>({
    resolver: zodResolver(assetSchema),
    defaultValues: {
      code: '',
      name: '',
      acquisitionDate: today(),
      acquisitionCost: 0,
      salvageValue: 0,
      usefulLifeMonths: 60,
      method: DepreciationMethod.StraightLine,
      assetAccountId: '',
      accumulatedDepreciationAccountId: '',
      depreciationExpenseAccountId: '',
    },
  })

  const assetAccounts = useMemo(
    () =>
      (accountsQuery.data ?? [])
        .filter((account) => account.isActive && account.type === 1)
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

  const onSubmit = (values: AssetFormValues) => {
    const payload: FixedAssetRequest = {
      code: values.code.trim(),
      name: values.name.trim(),
      acquisitionDate: values.acquisitionDate,
      acquisitionCost: toNumber(values.acquisitionCost),
      salvageValue: toNumber(values.salvageValue),
      usefulLifeMonths: toNumber(values.usefulLifeMonths),
      method: values.method as DepreciationMethod,
      assetAccountId: values.assetAccountId,
      accumulatedDepreciationAccountId: values.accumulatedDepreciationAccountId,
      depreciationExpenseAccountId: values.depreciationExpenseAccountId,
    }
    createAsset.mutate(payload, {
      onSuccess: () => {
        form.reset()
        onOpenChange(false)
      },
      onError: (error) => {
        if (error.fieldErrors) {
          for (const [field, messages] of Object.entries(error.fieldErrors)) {
            form.setError(field as keyof AssetFormValues, { message: messages[0] })
          }
        }
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Register fixed asset</DialogTitle>
          <DialogDescription>
            Depreciation posts monthly to the expense account against accumulated depreciation.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="create-asset" onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => <TextField label="Asset code" placeholder="FA-1005" required {...field} />}
            />
            <FormField
              control={form.control}
              name="method"
              render={({ field }) => (
                <SelectField
                  label="Method"
                  required
                  value={field.value}
                  onChange={(value) => field.onChange(Number(value))}
                  options={Object.entries(depreciationMethodLabels).map(([value, label]) => ({ value, label }))}
                />
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <TextField label="Name" placeholder="Delivery Van" required className="sm:col-span-2" {...field} />
              )}
            />
            <FormField
              control={form.control}
              name="acquisitionDate"
              render={({ field }) => <DateField label="Acquisition date" required {...field} />}
            />
            <FormField
              control={form.control}
              name="usefulLifeMonths"
              render={({ field }) => <TextField label="Useful life (months)" type="number" min={1} {...field} />}
            />
            <FormField
              control={form.control}
              name="acquisitionCost"
              render={({ field }) => (
                <TextField label="Acquisition cost" type="number" step="any" min={0} className="text-right" required {...field} />
              )}
            />
            <FormField
              control={form.control}
              name="salvageValue"
              render={({ field }) => (
                <TextField label="Salvage value" type="number" step="any" min={0} className="text-right" {...field} />
              )}
            />
            <FormField
              control={form.control}
              name="assetAccountId"
              render={({ field }) => (
                <ComboboxField
                  label="Asset account"
                  required
                  options={assetAccounts}
                  value={field.value}
                  onChange={(value) => field.onChange(value ?? '')}
                  placeholder="1500 · Fixed Assets"
                  allowClear={false}
                />
              )}
            />
            <FormField
              control={form.control}
              name="accumulatedDepreciationAccountId"
              render={({ field }) => (
                <ComboboxField
                  label="Accumulated depreciation"
                  required
                  options={assetAccounts}
                  value={field.value}
                  onChange={(value) => field.onChange(value ?? '')}
                  placeholder="1590 · Accumulated Depreciation"
                  allowClear={false}
                />
              )}
            />
            <FormField
              control={form.control}
              name="depreciationExpenseAccountId"
              render={({ field }) => (
                <ComboboxField
                  label="Depreciation expense"
                  required
                  options={expenseAccounts}
                  value={field.value}
                  onChange={(value) => field.onChange(value ?? '')}
                  placeholder="6400 · Depreciation Expense"
                  allowClear={false}
                  className="sm:col-span-2"
                />
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="create-asset" loading={createAsset.isPending}>
            Register asset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RunDepreciationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const runDepreciation = useRunDepreciation()
  const [periodEndDate, setPeriodEndDate] = useState(endOfMonth())

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Run monthly depreciation</DialogTitle>
          <DialogDescription>
            Posts one depreciation entry per active asset for the chosen period end date. Straight-line assets use
            (cost − salvage) ÷ life; declining-balance assets use a fixed monthly rate.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="period-end">
            Period end date
          </label>
          <input
            id="period-end"
            type="date"
            value={periodEndDate}
            onChange={(event) => setPeriodEndDate(event.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <p className="text-xs text-muted-foreground">
            The date must fall inside an open fiscal period or the API will reject the posting.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            loading={runDepreciation.isPending}
            onClick={() => runDepreciation.mutate(periodEndDate, { onSuccess: () => onOpenChange(false) })}
          >
            <Calculator className="h-4 w-4" /> Post depreciation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DisposeAssetDialog({ asset, onOpenChange }: { asset: FixedAsset | null; onOpenChange: (open: boolean) => void }) {
  const disposeAsset = useDisposeAsset()

  const form = useForm<DisposeFormValues>({
    resolver: zodResolver(disposeSchema),
    values: { disposalDate: today(), proceeds: 0 },
  })

  const bookValue = asset ? asset.acquisitionCost - asset.accumulatedDepreciation : 0
  const proceeds = toNumber(form.watch('proceeds'))
  const gainLoss = proceeds - bookValue

  return (
    <Dialog open={!!asset} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Dispose {asset?.name}</DialogTitle>
          <DialogDescription>
            Removes the asset at cost, clears accumulated depreciation and books the gain or loss on disposal.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id="dispose-asset"
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={form.handleSubmit((values) => {
              if (!asset) return
              disposeAsset.mutate(
                { id: asset.id, disposalDate: values.disposalDate, proceeds: toNumber(values.proceeds) },
                { onSuccess: () => onOpenChange(false) },
              )
            })}
          >
            <FormField
              control={form.control}
              name="disposalDate"
              render={({ field }) => <DateField label="Disposal date" required {...field} />}
            />
            <FormField
              control={form.control}
              name="proceeds"
              render={({ field }) => (
                <TextField label="Proceeds" type="number" step="any" min={0} className="text-right" {...field} />
              )}
            />
          </form>
        </Form>

        <div className="rounded-lg bg-muted/40 p-4 text-sm">
          <div className="flex justify-between py-1">
            <span className="text-muted-foreground">Book value</span>
            <span className="tabular-nums">{formatMoney(bookValue)}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-muted-foreground">Proceeds</span>
            <span className="tabular-nums">{formatMoney(proceeds)}</span>
          </div>
          <div className="flex justify-between border-t pt-2 font-medium">
            <span>{gainLoss >= 0 ? 'Gain on disposal' : 'Loss on disposal'}</span>
            <span className={gainLoss >= 0 ? 'text-success' : 'text-destructive'}>{formatMoney(Math.abs(gainLoss))}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="dispose-asset" variant="destructive" loading={disposeAsset.isPending}>
            Dispose asset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
