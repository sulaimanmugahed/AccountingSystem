import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { ColumnDef } from '@tanstack/react-table'
import { Landmark, Plus, RefreshCw, Wand2 } from 'lucide-react'
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
import { ComboboxField, DateField, SelectField, TextAreaField, TextField } from '@/components/ui/fields'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ErrorState, Money, SummaryRow } from '@/components/common/misc'
import { useBankAccounts, useBills, useVendorPayments, useVendors } from '@/hooks/queries'
import { useCreateVendorPayment } from '@/hooks/mutations'
import { useAuth } from '@/lib/auth'
import { PaymentMethod } from '@/lib/enums'
import { useLabels } from '@/lib/labels'
import { formatDate, formatMoney, today } from '@/lib/format'
import { toNumber } from '@/lib/utils'
import { billStatusTone, type VendorPayment } from '@/lib/types'

type Translate = (key: string, options?: Record<string, unknown>) => string

const paymentSchema = (t: Translate) =>
  z.object({
  vendorId: z.string().min(1, t('vendorPayments.errSelectVendor')),
  paymentDate: z.string().min(1, t('vendorPayments.errPaymentDateRequired')),
  amount: z.coerce.number().positive(t('vendorPayments.errAmountPositive')),
  method: z.coerce.number().int().min(1).max(6),
  referenceNumber: z.string().max(60).optional().or(z.literal('')),
  bankAccountId: z.string().min(1, t('vendorPayments.errSelectBank')),
  memo: z.string().max(300).optional().or(z.literal('')),
  applications: z.array(
    z.object({
      billId: z.string(),
      amount: z.coerce.number().min(0),
    }),
  ),
})

type PaymentFormValues = z.infer<ReturnType<typeof paymentSchema>>

export function VendorPaymentsPage() {
  const { t } = useTranslation()
  const labels = useLabels()
  const { hasRole } = useAuth()
  const canRecord = hasRole('Admin', 'Accountant', 'APClerk')

  const [vendorFilter, setVendorFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)

  const paymentsQuery = useVendorPayments()
  const vendorsQuery = useVendors()

  const payments = useMemo(
    () => (paymentsQuery.data ?? []).filter((payment) => vendorFilter === 'all' || payment.vendorId === vendorFilter),
    [paymentsQuery.data, vendorFilter],
  )

  const vendorName = (vendorId: string) =>
    (vendorsQuery.data ?? []).find((vendor) => vendor.id === vendorId)?.name ?? t('common.dash')

  const columns = useMemo<ColumnDef<VendorPayment>[]>(
    () => [
      {
        accessorKey: 'paymentNumber',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('vendorPayments.paymentNumber')} />,
        cell: ({ row }) => <span className="font-mono text-xs font-medium">{row.original.paymentNumber}</span>,
      },
      {
        accessorKey: 'vendorId',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('vendorPayments.vendor')} />,
        cell: ({ row }) => <span className="font-medium">{vendorName(row.original.vendorId)}</span>,
      },
      {
        accessorKey: 'paymentDate',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('common.date')} />,
        cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.paymentDate)}</span>,
      },
      {
        accessorKey: 'amount',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('common.amount')} align="right" />,
        cell: ({ row }) => (
          <div className="text-end font-medium">
            <Money value={row.original.amount} />
          </div>
        ),
      },
      {
        accessorKey: 'unappliedAmount',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('vendorPayments.unapplied')} align="right" />,
        cell: ({ row }) => (
          <div className="text-end">
            {row.original.unappliedAmount > 0 ? (
              <Badge variant="warning">{formatMoney(row.original.unappliedAmount)}</Badge>
            ) : (
              <span className="text-muted-foreground">{t('vendorPayments.fullyApplied')}</span>
            )}
          </div>
        ),
      },
    ],
    [vendorsQuery.data, labels, t],
  )

  const total = payments.reduce((sum, payment) => sum + payment.amount, 0)

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('vendorPayments.title')}
        description={t('vendorPayments.description')}
        breadcrumbs={[{ label: t('nav.groups.payables') }, { label: t('vendorPayments.breadcrumb') }]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => paymentsQuery.refetch()} loading={paymentsQuery.isFetching}>
              <RefreshCw className="h-4 w-4" /> {t('common.refresh')}
            </Button>
            <Button size="sm" disabled={!canRecord} onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" /> {t('vendorPayments.newPayment')}
            </Button>
          </>
        }
      />

      {paymentsQuery.error ? (
        <ErrorState
          error={paymentsQuery.error}
          onRetry={() => paymentsQuery.refetch()}
          title={t('vendorPayments.couldNotLoad')}
        />
      ) : (
        <DataTable
          columns={columns}
          data={payments}
          isLoading={paymentsQuery.isLoading}
          searchPlaceholder={t('vendorPayments.searchPlaceholder')}
          getRowId={(row) => row.id}
          initialSorting={[{ id: 'paymentDate', desc: true }]}
          toolbar={
            <div className="flex items-center gap-2">
              <Select value={vendorFilter} onValueChange={setVendorFilter}>
                <SelectTrigger className="h-8 w-[200px]">
                  <SelectValue placeholder={t('vendorPayments.allVendors')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('vendorPayments.allVendors')}</SelectItem>
                  {(vendorsQuery.data ?? []).map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge variant="outline">Total {formatMoney(total)}</Badge>
            </div>
          }
        />
      )}

      <RecordVendorPaymentDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}

function RecordVendorPaymentDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation()
  const labels = useLabels()
  const vendorsQuery = useVendors()
  const billsQuery = useBills()
  const bankAccountsQuery = useBankAccounts()
  const createPayment = useCreateVendorPayment()

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema(t)),
    defaultValues: {
      vendorId: '',
      paymentDate: today(),
      amount: 0,
      method: PaymentMethod.BankTransfer,
      referenceNumber: '',
      bankAccountId: '',
      memo: '',
      applications: [],
    },
  })

  const { fields, replace } = useFieldArray({ control: form.control, name: 'applications' })
  const watched = useWatch({ control: form.control })

  const openBills = useMemo(
    () =>
      (billsQuery.data ?? []).filter(
        (bill) => bill.vendorId === watched.vendorId && bill.balance > 0 && bill.status !== 5 && bill.status !== 1,
      ),
    [billsQuery.data, watched.vendorId],
  )

  const applied = (watched.applications ?? []).reduce((sum, application) => sum + toNumber(application?.amount), 0)
  const remaining = toNumber(watched.amount) - applied

  const vendorOptions = useMemo(
    () => (vendorsQuery.data ?? []).map((vendor) => ({ value: vendor.id, label: `${vendor.code} · ${vendor.name}` })),
    [vendorsQuery.data],
  )
  const bankAccountOptions = useMemo(
    () => (bankAccountsQuery.data ?? []).map((account) => ({ value: account.id, label: `${account.name} · ${account.currencyCode}` })),
    [bankAccountsQuery.data],
  )

  const handleVendorChange = (vendorId: string | null) => {
    form.setValue('vendorId', vendorId ?? '', { shouldValidate: true })
    const bills = (billsQuery.data ?? []).filter(
      (bill) => bill.vendorId === vendorId && bill.balance > 0 && bill.status !== 5 && bill.status !== 1,
    )
    replace(bills.map((bill) => ({ billId: bill.id, amount: 0 })))
  }

  const applyOldestFirst = () => {
    let available = toNumber(form.getValues('amount'))
    replace(
      openBills.map((bill) => {
        const amount = Math.min(bill.balance, available)
        available -= amount
        return { billId: bill.id, amount: Number(amount.toFixed(2)) }
      }),
    )
  }

  const onSubmit = (values: PaymentFormValues) => {
    createPayment.mutate(
      {
        vendorId: values.vendorId,
        paymentDate: values.paymentDate,
        amount: toNumber(values.amount),
        method: values.method,
        referenceNumber: values.referenceNumber?.trim() ? values.referenceNumber.trim() : null,
        bankAccountId: values.bankAccountId,
        memo: values.memo?.trim() ? values.memo.trim() : null,
        applications: values.applications
          .filter((application) => toNumber(application.amount) > 0)
          .map((application) => ({ billId: application.billId, amount: toNumber(application.amount) })),
      },
      {
        onSuccess: () => {
          form.reset()
          replace([])
          onOpenChange(false)
        },
        onError: (error) => {
          if (error.fieldErrors) {
            for (const [field, messages] of Object.entries(error.fieldErrors)) {
              form.setError(field as keyof PaymentFormValues, { message: messages[0] })
            }
          }
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('vendorPayments.newPaymentTitle2')}</DialogTitle>
          <DialogDescription>{t('vendorPayments.newPaymentDescription2')}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="record-vendor-payment" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="vendorId"
                render={({ field }) => (
                  <ComboboxField
                    label={t('vendorPayments.vendor')}
                    required
                    options={vendorOptions}
                    value={field.value}
                    onChange={handleVendorChange}
                    placeholder={t('vendorPayments.selectVendorPlaceholder')}
                    allowClear={false}
                  />
                )}
              />
              <FormField
                control={form.control}
                name="paymentDate"
                render={({ field }) => <DateField label={t('vendorPayments.paymentDate')} required {...field} />}
              />
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <TextField
                    label={t('vendorPayments.amount')}
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
                name="method"
                render={({ field }) => (
                  <SelectField
                    label={t('vendorPayments.method')}
                    value={field.value}
                    onChange={(value) => field.onChange(Number(value))}
                    options={Object.entries(labels.paymentMethod).map(([value, label]) => ({ value, label }))}
                  />
                )}
              />
              <FormField
                control={form.control}
                name="referenceNumber"
                render={({ field }) => (
                  <TextField
                    label={t('common.reference')}
                    placeholder={t('vendorPayments.referencePlaceholder')}
                    {...field}
                    value={field.value ?? ''}
                  />
                )}
              />
              <FormField
                control={form.control}
                name="bankAccountId"
                render={({ field }) => (
                  <SelectField
                    label={t('vendorPayments.depositFrom')}
                    required
                    value={field.value}
                    onChange={field.onChange}
                    options={bankAccountOptions}
                    placeholder={t('vendorPayments.selectBankAccount')}
                  />
                )}
              />
              <FormField
                control={form.control}
                name="memo"
                render={({ field }) => (
                  <TextAreaField
                    label={t('common.memo')}
                    className="sm:col-span-3"
                    {...field}
                    value={field.value ?? ''}
                  />
                )}
              />
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{t('vendorPayments.applyToOpen')}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('vendorPayments.openSummary', {
                      count: openBills.length,
                      applied: formatMoney(applied),
                      remaining: formatMoney(remaining),
                    })}
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={applyOldestFirst} disabled={!openBills.length}>
                  <Wand2 className="h-4 w-4" /> {t('vendorPayments.applyOldestFirst')}
                </Button>
              </div>

              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('bills.billNumber')}</TableHead>
                      <TableHead>{t('common.dueDate')}</TableHead>
                      <TableHead>{t('common.status')}</TableHead>
                      <TableHead className="text-end">{t('invoices.balance')}</TableHead>
                      <TableHead className="w-[160px] text-end">{t('vendorPayments.colApply')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-20 text-center text-sm text-muted-foreground">
                          {watched.vendorId
                            ? t('vendorPayments.noOpenBills')
                            : t('vendorPayments.selectVendorHint')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      fields.map((field, index) => {
                        const bill = openBills.find((candidate) => candidate.id === field.billId)
                        if (!bill) return null
                        return (
                          <TableRow key={field.id}>
                            <TableCell className="font-mono text-xs">{bill.billNumber}</TableCell>
                            <TableCell>{formatDate(bill.dueDate)}</TableCell>
                            <TableCell>
                              <Badge variant={billStatusTone[bill.status] ?? 'secondary'}>
                                {labels.billStatus[bill.status]}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-end">
                              <Money value={bill.balance} />
                            </TableCell>
                            <TableCell>
                              <FormField
                                control={form.control}
                                name={`applications.${index}.amount`}
                                render={({ field: amountField }) => (
                                  <Input
                                    type="number"
                                    step="any"
                                    min={0}
                                    max={bill.balance}
                                    className="text-end tabular-nums"
                                    value={amountField.value}
                                    onChange={(event) => amountField.onChange(event.target.value)}
                                  />
                                )}
                              />
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="rounded-lg bg-muted/40 p-4">
              <SummaryRow label={t('vendorPayments.paymentAmount')} value={formatMoney(toNumber(watched.amount))} />
              <SummaryRow label={t('vendorPayments.appliedToBills')} value={formatMoney(applied)} />
              <SummaryRow
                label={t('vendorPayments.unappliedCredit')}
                value={formatMoney(Math.max(remaining, 0))}
                strong
              />
            </div>
            {remaining < -0.005 ? (
              <p className="text-xs font-medium text-destructive">{t('vendorPayments.exceedsWarning')}</p>
            ) : null}
          </form>
        </Form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            form="record-vendor-payment"
            loading={createPayment.isPending}
            disabled={remaining < -0.005 || toNumber(watched.amount) <= 0}
          >
            <Landmark className="h-4 w-4" /> {t('vendorPayments.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
