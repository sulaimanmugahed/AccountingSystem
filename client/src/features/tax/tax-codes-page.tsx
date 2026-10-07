import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { ColumnDef } from '@tanstack/react-table'
import { Percent, Plus, RefreshCw } from 'lucide-react'
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
import { Form, FormField } from '@/components/ui/form'
import { ComboboxField, SelectField, TextField } from '@/components/ui/fields'
import { ErrorState } from '@/components/common/misc'
import { useAccounts, useTaxCodes } from '@/hooks/queries'
import { useCreateTaxCode } from '@/hooks/mutations'
import { useAuth } from '@/lib/auth'
import { TaxType } from '@/lib/enums'
import { useLabels } from '@/lib/labels'
import { formatPercent } from '@/lib/format'
import { toNumber } from '@/lib/utils'
import type { TaxCode, TaxCodeRequest } from '@/lib/types'

type Translate = (key: string, options?: Record<string, unknown>) => string

const taxCodeSchema = (t: Translate) =>
  z.object({
    code: z.string().min(1, t('tax.errCodeRequired')).max(30),
    name: z.string().min(2, t('tax.errNameRequired')).max(120),
    ratePercent: z.coerce.number().min(0, t('tax.errRateNegative')).max(100, t('tax.errRateMax')),
    type: z.coerce.number().int().min(1).max(2),
    taxPayableOrReceivableAccountId: z.string().min(1, t('tax.errSelectAccount')),
  })

type TaxCodeFormValues = z.infer<ReturnType<typeof taxCodeSchema>>

export function TaxCodesPage() {
  const { t } = useTranslation()
  const labels = useLabels()
  const { hasRole } = useAuth()
  const canManage = hasRole('Admin', 'Accountant')

  const [dialogOpen, setDialogOpen] = useState(false)
  const taxCodesQuery = useTaxCodes()
  const accountsQuery = useAccounts()

  const accountLabel = (accountId: string) => {
    const account = (accountsQuery.data ?? []).find((candidate) => candidate.id === accountId)
    return account ? `${account.code} · ${account.name}` : t('common.dash')
  }

  const columns = useMemo<ColumnDef<TaxCode>[]>(
    () => [
      {
        accessorKey: 'code',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('common.code')} />,
        cell: ({ row }) => <span className="font-mono text-xs font-medium">{row.original.code}</span>,
      },
      {
        accessorKey: 'name',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('common.name')} />,
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        accessorKey: 'ratePercent',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('tax.rate')} align="right" />,
        cell: ({ row }) => (
          <div className="text-end font-medium tabular-nums">{formatPercent(row.original.ratePercent)}</div>
        ),
      },
      {
        accessorKey: 'type',
        header: t('tax.appliesTo'),
        cell: ({ row }) => (
          <Badge variant={row.original.type === TaxType.Sales ? 'default' : 'secondary'}>
            {labels.taxType[row.original.type] ?? t('common.dash')}
          </Badge>
        ),
      },
      {
        id: 'account',
        header: t('tax.taxAccount'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{accountLabel(row.original.taxPayableOrReceivableAccountId)}</span>
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
    ],
    [accountsQuery.data, labels, t],
  )

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('tax.title')}
        description={t('tax.description')}
        breadcrumbs={[{ label: t('nav.groups.configuration') }, { label: t('tax.breadcrumb') }]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => taxCodesQuery.refetch()} loading={taxCodesQuery.isFetching}>
              <RefreshCw className="h-4 w-4" /> {t('common.refresh')}
            </Button>
            <Button size="sm" disabled={!canManage} onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" /> {t('tax.newTaxCode')}
            </Button>
          </>
        }
      />

      {taxCodesQuery.error ? (
        <ErrorState
          error={taxCodesQuery.error}
          onRetry={() => taxCodesQuery.refetch()}
          title={t('tax.couldNotLoad')}
        />
      ) : (
        <DataTable
          columns={columns}
          data={taxCodesQuery.data ?? []}
          isLoading={taxCodesQuery.isLoading}
          searchPlaceholder={t('tax.searchPlaceholder')}
          getRowId={(row) => row.id}
        />
      )}

      <CreateTaxCodeDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}

function CreateTaxCodeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation()
  const labels = useLabels()
  const accountsQuery = useAccounts()
  const createTaxCode = useCreateTaxCode()

  const form = useForm<TaxCodeFormValues>({
    resolver: zodResolver(taxCodeSchema(t)),
    defaultValues: { code: '', name: '', ratePercent: 0, type: TaxType.Sales, taxPayableOrReceivableAccountId: '' },
  })

  const taxType = useWatch({ control: form.control, name: 'type' })
  const accountOptions = useMemo(() => {
    const allowedType = taxType === TaxType.Sales ? 2 : 1 // Liability for sales tax, Asset for purchase tax
    return (accountsQuery.data ?? [])
      .filter((account) => account.isActive && account.type === allowedType)
      .map((account) => ({ value: account.id, label: `${account.code} · ${account.name}` }))
  }, [accountsQuery.data, taxType])

  const onSubmit = (values: TaxCodeFormValues) => {
    const payload: TaxCodeRequest = {
      code: values.code.trim().toUpperCase(),
      name: values.name.trim(),
      ratePercent: toNumber(values.ratePercent),
      type: values.type as TaxType,
      taxPayableOrReceivableAccountId: values.taxPayableOrReceivableAccountId,
    }
    createTaxCode.mutate(payload, {
      onSuccess: () => {
        form.reset()
        onOpenChange(false)
      },
      onError: (error) => {
        if (error.fieldErrors) {
          for (const [field, messages] of Object.entries(error.fieldErrors)) {
            form.setError(field as keyof TaxCodeFormValues, { message: messages[0] })
          }
        }
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Percent className="h-4 w-4" /> {t('tax.newTaxCodeTitle')}
          </DialogTitle>
          <DialogDescription>{t('tax.newTaxCodeDescription')}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="create-tax-code" onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <TextField label={t('common.code')} placeholder={t('tax.codePlaceholder')} required {...field} />
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
                  onChange={(value) => {
                    field.onChange(Number(value))
                    form.setValue('taxPayableOrReceivableAccountId', '')
                  }}
                  options={Object.entries(labels.taxType).map(([value, label]) => ({ value, label }))}
                />
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <TextField
                  label={t('common.name')}
                  placeholder={t('tax.namePlaceholder')}
                  required
                  className="sm:col-span-2"
                  {...field}
                />
              )}
            />
            <FormField
              control={form.control}
              name="ratePercent"
              render={({ field }) => (
                <TextField
                  label={t('tax.ratePercent')}
                  type="number"
                  step="any"
                  min={0}
                  max={100}
                  className="text-end"
                  required
                  {...field}
                />
              )}
            />
            <FormField
              control={form.control}
              name="taxPayableOrReceivableAccountId"
              render={({ field }) => (
                <ComboboxField
                  label={
                    taxType === TaxType.Sales ? t('tax.taxPayableAccount') : t('tax.taxReceivableAccount')
                  }
                  required
                  options={accountOptions}
                  value={field.value}
                  onChange={(value) => field.onChange(value ?? '')}
                  placeholder={taxType === TaxType.Sales ? '2100 · Sales Tax Payable' : '1300 · Purchase Tax Receivable'}
                  allowClear={false}
                />
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="create-tax-code" loading={createTaxCode.isPending}>
            {t('tax.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
