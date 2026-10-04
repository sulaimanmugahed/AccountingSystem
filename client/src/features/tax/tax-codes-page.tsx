import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
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
import { taxTypeLabels, TaxType } from '@/lib/enums'
import { formatPercent } from '@/lib/format'
import { toNumber } from '@/lib/utils'
import type { TaxCode, TaxCodeRequest } from '@/lib/types'

const taxCodeSchema = z.object({
  code: z.string().min(1, 'Code is required').max(30),
  name: z.string().min(2, 'Name is required').max(120),
  ratePercent: z.coerce.number().min(0, 'Rate cannot be negative').max(100, 'Rate cannot exceed 100%'),
  type: z.coerce.number().int().min(1).max(2),
  taxPayableOrReceivableAccountId: z.string().min(1, 'Select the tax account'),
})

type TaxCodeFormValues = z.infer<typeof taxCodeSchema>

export function TaxCodesPage() {
  const { hasRole } = useAuth()
  const canManage = hasRole('Admin', 'Accountant')

  const [dialogOpen, setDialogOpen] = useState(false)
  const taxCodesQuery = useTaxCodes()
  const accountsQuery = useAccounts()

  const accountLabel = (accountId: string) => {
    const account = (accountsQuery.data ?? []).find((candidate) => candidate.id === accountId)
    return account ? `${account.code} · ${account.name}` : '—'
  }

  const columns = useMemo<ColumnDef<TaxCode>[]>(
    () => [
      {
        accessorKey: 'code',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Code" />,
        cell: ({ row }) => <span className="font-mono text-xs font-medium">{row.original.code}</span>,
      },
      {
        accessorKey: 'name',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        accessorKey: 'ratePercent',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Rate" align="right" />,
        cell: ({ row }) => <div className="text-right font-medium tabular-nums">{formatPercent(row.original.ratePercent)}</div>,
      },
      {
        accessorKey: 'type',
        header: 'Applies to',
        cell: ({ row }) => (
          <Badge variant={row.original.type === TaxType.Sales ? 'default' : 'secondary'}>
            {taxTypeLabels[row.original.type] ?? '—'}
          </Badge>
        ),
      },
      {
        id: 'account',
        header: 'Tax account',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{accountLabel(row.original.taxPayableOrReceivableAccountId)}</span>
        ),
      },
      {
        accessorKey: 'isActive',
        header: 'Status',
        cell: ({ row }) =>
          row.original.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="outline">Inactive</Badge>,
      },
    ],
    [accountsQuery.data],
  )

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tax codes"
        description="Line-level tax rates applied to invoices and bills. Sales tax posts to a payable account, purchase tax to a receivable account."
        breadcrumbs={[{ label: 'Configuration' }, { label: 'Tax Codes' }]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => taxCodesQuery.refetch()} loading={taxCodesQuery.isFetching}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Button size="sm" disabled={!canManage} onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" /> New tax code
            </Button>
          </>
        }
      />

      {taxCodesQuery.error ? (
        <ErrorState error={taxCodesQuery.error} onRetry={() => taxCodesQuery.refetch()} title="Could not load tax codes" />
      ) : (
        <DataTable
          columns={columns}
          data={taxCodesQuery.data ?? []}
          isLoading={taxCodesQuery.isLoading}
          searchPlaceholder="Search tax codes…"
          getRowId={(row) => row.id}
        />
      )}

      <CreateTaxCodeDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}

function CreateTaxCodeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const accountsQuery = useAccounts()
  const createTaxCode = useCreateTaxCode()

  const form = useForm<TaxCodeFormValues>({
    resolver: zodResolver(taxCodeSchema),
    defaultValues: { code: '', name: '', ratePercent: 0, type: TaxType.Sales, taxPayableOrReceivableAccountId: '' },
  })

  const taxType = form.watch('type')
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
            <Percent className="h-4 w-4" /> New tax code
          </DialogTitle>
          <DialogDescription>Sales tax codes are selectable on invoice lines; purchase codes on bill lines.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="create-tax-code" onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => <TextField label="Code" placeholder="TAX10" required {...field} />}
            />
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <SelectField
                  label="Type"
                  required
                  value={field.value}
                  onChange={(value) => {
                    field.onChange(Number(value))
                    form.setValue('taxPayableOrReceivableAccountId', '')
                  }}
                  options={Object.entries(taxTypeLabels).map(([value, label]) => ({ value, label }))}
                />
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <TextField label="Name" placeholder="Sales Tax 10%" required className="sm:col-span-2" {...field} />
              )}
            />
            <FormField
              control={form.control}
              name="ratePercent"
              render={({ field }) => (
                <TextField label="Rate %" type="number" step="any" min={0} max={100} className="text-right" required {...field} />
              )}
            />
            <FormField
              control={form.control}
              name="taxPayableOrReceivableAccountId"
              render={({ field }) => (
                <ComboboxField
                  label={taxType === TaxType.Sales ? 'Tax payable account' : 'Tax receivable account'}
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
            Cancel
          </Button>
          <Button type="submit" form="create-tax-code" loading={createTaxCode.isPending}>
            Create tax code
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
