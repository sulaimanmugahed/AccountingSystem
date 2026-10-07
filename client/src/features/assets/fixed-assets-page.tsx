import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm, useWatch } from 'react-hook-form'
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
import { DepreciationMethod } from '@/lib/enums'
import { useLabels } from '@/lib/labels'
import { assetStatusTone } from '@/lib/types'
import { endOfMonth, formatDate, formatMoney, today } from '@/lib/format'
import { toNumber } from '@/lib/utils'
import type { FixedAsset, FixedAssetRequest } from '@/lib/types'

type Translate = (key: string, options?: Record<string, unknown>) => string

const assetSchema = (t: Translate) =>
  z.object({
    code: z.string().min(1, t('fixedAssets.errCodeRequired')).max(30),
    name: z.string().min(2, t('fixedAssets.errNameRequired')).max(160),
    acquisitionDate: z.string().min(1, t('fixedAssets.errDateRequired')),
    acquisitionCost: z.coerce.number().positive(t('fixedAssets.errCostPositive')),
    salvageValue: z.coerce.number().min(0),
    usefulLifeMonths: z.coerce.number().int().positive(t('fixedAssets.errLifePositive')),
    method: z.coerce.number().int().min(1).max(2),
    assetAccountId: z.string().min(1, t('fixedAssets.errSelectAssetAccount')),
    accumulatedDepreciationAccountId: z
      .string()
      .min(1, t('fixedAssets.errSelectAccumAccount')),
    depreciationExpenseAccountId: z.string().min(1, t('fixedAssets.errSelectExpenseAccount')),
  })

type AssetFormValues = z.infer<ReturnType<typeof assetSchema>>

const disposeSchema = (t: Translate) =>
  z.object({
    disposalDate: z.string().min(1, t('fixedAssets.errDisposalDateRequired')),
    proceeds: z.coerce.number().min(0),
  })

type DisposeFormValues = z.infer<ReturnType<typeof disposeSchema>>

export function FixedAssetsPage() {
  const { t } = useTranslation()
  const labels = useLabels()
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
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('common.code')} />,
        cell: ({ row }) => <span className="font-mono text-xs font-medium">{row.original.code}</span>,
      },
      {
        accessorKey: 'name',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('fixedAssets.asset')} />,
        cell: ({ row }) => (
          <div className="min-w-[200px]">
            <p className="font-medium">{row.original.name}</p>
            <p className="text-xs text-muted-foreground">
              {labels.depreciationMethod[row.original.method]} ·{' '}
              {t('fixedAssets.months', { count: row.original.usefulLifeMonths })}
            </p>
          </div>
        ),
      },
      {
        accessorKey: 'acquisitionDate',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('fixedAssets.acquired')} />,
        cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.acquisitionDate)}</span>,
      },
      {
        accessorKey: 'acquisitionCost',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('fixedAssets.cost')} align="right" />,
        cell: ({ row }) => (
          <div className="text-end">
            <Money value={row.original.acquisitionCost} />
          </div>
        ),
      },
      {
        accessorKey: 'accumulatedDepreciation',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('fixedAssets.accumDep')} align="right" />,
        cell: ({ row }) => (
          <div className="text-end text-muted-foreground">
            <Money value={row.original.accumulatedDepreciation} />
          </div>
        ),
      },
      {
        id: 'bookValue',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('fixedAssets.bookValue')} align="right" />,
        accessorFn: (row) => row.acquisitionCost - row.accumulatedDepreciation,
        cell: ({ row }) => (
          <div className="text-end font-medium">
            <Money value={row.original.acquisitionCost - row.original.accumulatedDepreciation} />
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: t('common.status'),
        cell: ({ row }) => (
          <Badge variant={assetStatusTone[row.original.status] ?? 'secondary'}>
            {labels.assetStatus[row.original.status] ?? t('common.dash')}
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
                  <TrendingDown /> {t('fixedAssets.dispose')}
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
        title={t('fixedAssets.title')}
        description={t('fixedAssets.description')}
        breadcrumbs={[{ label: t('nav.groups.assetsBanking') }, { label: t('fixedAssets.breadcrumb') }]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => assetsQuery.refetch()} loading={assetsQuery.isFetching}>
              <RefreshCw className="h-4 w-4" /> {t('common.refresh')}
            </Button>
            <Button variant="outline" size="sm" disabled={!canManage} onClick={() => setDepreciationOpen(true)}>
              <Calculator className="h-4 w-4" /> {t('fixedAssets.runDepreciation')}
            </Button>
            <Button size="sm" disabled={!canManage} onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> {t('fixedAssets.newAsset')}
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('fixedAssets.assetsCount')}
          value={assets.length}
          hint={t('fixedAssets.activeCount', { count: totals.active })}
          icon={Landmark}
        />
        <StatCard label={t('fixedAssets.acquisitionCostTotal')} value={formatMoney(totals.cost)} />
        <StatCard
          label={t('fixedAssets.accumulatedDepreciationTotal')}
          value={formatMoney(totals.depreciation)}
        />
        <StatCard label={t('fixedAssets.netBookValue')} value={formatMoney(totals.bookValue)} tone="positive" />
      </div>

      {assetsQuery.error ? (
        <ErrorState
          error={assetsQuery.error}
          onRetry={() => assetsQuery.refetch()}
          title={t('fixedAssets.couldNotLoad')}
        />
      ) : (
        <DataTable
          columns={columns}
          data={assets}
          isLoading={assetsQuery.isLoading}
          searchPlaceholder={t('fixedAssets.searchPlaceholder')}
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
  const { t } = useTranslation()
  const labels = useLabels()
  const accountsQuery = useAccounts()
  const createAsset = useCreateFixedAsset()

  const form = useForm<AssetFormValues>({
    resolver: zodResolver(assetSchema(t)),
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
          <DialogTitle>{t('fixedAssets.registerTitle')}</DialogTitle>
          <DialogDescription>{t('fixedAssets.registerDescription')}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="create-asset" onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <TextField
                  label={t('fixedAssets.assetCode')}
                  placeholder={t('fixedAssets.assetCodePlaceholder')}
                  required
                  {...field}
                />
              )}
            />
            <FormField
              control={form.control}
              name="method"
              render={({ field }) => (
                <SelectField
                  label={t('fixedAssets.method')}
                  required
                  value={field.value}
                  onChange={(value) => field.onChange(Number(value))}
                  options={Object.entries(labels.depreciationMethod).map(([value, label]) => ({
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
                  label={t('common.name')}
                  placeholder={t('fixedAssets.namePlaceholder')}
                  required
                  className="sm:col-span-2"
                  {...field}
                />
              )}
            />
            <FormField
              control={form.control}
              name="acquisitionDate"
              render={({ field }) => <DateField label={t('fixedAssets.acquisitionDate')} required {...field} />}
            />
            <FormField
              control={form.control}
              name="usefulLifeMonths"
              render={({ field }) => (
                <TextField label={t('fixedAssets.usefulLife')} type="number" min={1} {...field} />
              )}
            />
            <FormField
              control={form.control}
              name="acquisitionCost"
              render={({ field }) => (
                <TextField
                  label={t('fixedAssets.acquisitionCost')}
                  type="number"
                  step="any"
                  min={0}
                  className="text-end"
                  required
                  {...field}
                />
              )}
            />
            <FormField
              control={form.control}
              name="salvageValue"
              render={({ field }) => (
                <TextField
                  label={t('fixedAssets.salvageValue')}
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
              name="assetAccountId"
              render={({ field }) => (
                <ComboboxField
                  label={t('fixedAssets.assetAccount')}
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
                  label={t('fixedAssets.accumulatedDepreciation')}
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
                  label={t('fixedAssets.depreciationExpense')}
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
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="create-asset" loading={createAsset.isPending}>
            {t('fixedAssets.register')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RunDepreciationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation()
  const runDepreciation = useRunDepreciation()
  const [periodEndDate, setPeriodEndDate] = useState(endOfMonth())

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('fixedAssets.runTitle')}</DialogTitle>
          <DialogDescription>{t('fixedAssets.runDescription')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="period-end">
            {t('fixedAssets.periodEndDate')}
          </label>
          <input
            id="period-end"
            type="date"
            value={periodEndDate}
            onChange={(event) => setPeriodEndDate(event.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <p className="text-xs text-muted-foreground">
            {t('fixedAssets.periodEndHint')}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            loading={runDepreciation.isPending}
            onClick={() => runDepreciation.mutate(periodEndDate, { onSuccess: () => onOpenChange(false) })}
          >
            <Calculator className="h-4 w-4" /> {t('fixedAssets.postDepreciation')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DisposeAssetDialog({ asset, onOpenChange }: { asset: FixedAsset | null; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation()
  const disposeAsset = useDisposeAsset()

  const form = useForm<DisposeFormValues>({
    resolver: zodResolver(disposeSchema(t)),
    values: { disposalDate: today(), proceeds: 0 },
  })

  const bookValue = asset ? asset.acquisitionCost - asset.accumulatedDepreciation : 0
  const proceeds = toNumber(useWatch({ control: form.control, name: 'proceeds' }))
  const gainLoss = proceeds - bookValue

  return (
    <Dialog open={!!asset} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('fixedAssets.disposeTitle', { name: asset?.name })}</DialogTitle>
          <DialogDescription>{t('fixedAssets.disposeDescription')}</DialogDescription>
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
              render={({ field }) => <DateField label={t('fixedAssets.disposalDate')} required {...field} />}
            />
            <FormField
              control={form.control}
              name="proceeds"
              render={({ field }) => (
                <TextField
                  label={t('fixedAssets.proceeds')}
                  type="number"
                  step="any"
                  min={0}
                  className="text-end"
                  {...field}
                />
              )}
            />
          </form>
        </Form>

        <div className="rounded-lg bg-muted/40 p-4 text-sm">
          <div className="flex justify-between py-1">
            <span className="text-muted-foreground">{t('fixedAssets.bookValue')}</span>
            <span className="tabular-nums">{formatMoney(bookValue)}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-muted-foreground">{t('fixedAssets.proceeds')}</span>
            <span className="tabular-nums">{formatMoney(proceeds)}</span>
          </div>
          <div className="flex justify-between border-t pt-2 font-medium">
            <span>
              {gainLoss >= 0 ? t('fixedAssets.gainOnDisposal') : t('fixedAssets.lossOnDisposal')}
            </span>
            <span className={gainLoss >= 0 ? 'text-success' : 'text-destructive'}>{formatMoney(Math.abs(gainLoss))}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="dispose-asset" variant="destructive" loading={disposeAsset.isPending}>
            {t('fixedAssets.disposeAsset')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
