import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { ColumnDef } from '@tanstack/react-table'
import { HandCoins, Plus, RefreshCw, Wand2 } from 'lucide-react'
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
import { useBankAccounts, useCustomerPayments, useCustomers, useInvoices } from '@/hooks/queries'
import { useCreateCustomerPayment } from '@/hooks/mutations'
import { useAuth } from '@/lib/auth'
import { PaymentMethod } from '@/lib/enums'
import { useLabels } from '@/lib/labels'
import { formatDate, formatMoney, today } from '@/lib/format'
import { toNumber } from '@/lib/utils'
import { invoiceStatusTone, type CustomerPayment } from '@/lib/types'

type Translate = (key: string, options?: Record<string, unknown>) => string

const paymentSchema = (t: Translate) =>
  z.object({
  customerId: z.string().min(1, t('payments.errSelectCustomer')),
  paymentDate: z.string().min(1, t('payments.errPaymentDateRequired')),
  amount: z.coerce.number().positive(t('payments.errAmountPositive')),
  method: z.coerce.number().int().min(1).max(6),
  referenceNumber: z.string().max(60).optional().or(z.literal('')),
  bankAccountId: z.string().min(1, t('payments.errSelectBank')),
  memo: z.string().max(300).optional().or(z.literal('')),
  applications: z.array(
    z.object({
      invoiceId: z.string(),
      amount: z.coerce.number().min(0),
    }),
  ),
})

type PaymentFormValues = z.infer<ReturnType<typeof paymentSchema>>

export function CustomerPaymentsPage() {
  const { t } = useTranslation()
  const labels = useLabels()
  const { hasRole } = useAuth()
  const canRecord = hasRole('Admin', 'Accountant', 'ARClerk')

  const [customerFilter, setCustomerFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)

  const paymentsQuery = useCustomerPayments()
  const customersQuery = useCustomers()

  const payments = useMemo(
    () =>
      (paymentsQuery.data ?? []).filter(
        (payment) => customerFilter === 'all' || payment.customerId === customerFilter,
      ),
    [paymentsQuery.data, customerFilter],
  )

  const customerName = (customerId: string) =>
    (customersQuery.data ?? []).find((customer) => customer.id === customerId)?.name ?? t('common.dash')

  const columns = useMemo<ColumnDef<CustomerPayment>[]>(
    () => [
      {
        accessorKey: 'paymentNumber',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('payments.paymentNumber')} />,
        cell: ({ row }) => <span className="font-mono text-xs font-medium">{row.original.paymentNumber}</span>,
      },
      {
        accessorKey: 'customerId',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('payments.customer')} />,
        cell: ({ row }) => <span className="font-medium">{customerName(row.original.customerId)}</span>,
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
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('payments.unapplied')} align="right" />,
        cell: ({ row }) => (
          <div className="text-end">
            {row.original.unappliedAmount > 0 ? (
              <Badge variant="warning">{formatMoney(row.original.unappliedAmount)}</Badge>
            ) : (
              <span className="text-muted-foreground">{t('payments.fullyApplied')}</span>
            )}
          </div>
        ),
      },
    ],
    [customersQuery.data, labels, t],
  )

  const total = payments.reduce((sum, payment) => sum + payment.amount, 0)

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('payments.title')}
        description={t('payments.description')}
        breadcrumbs={[{ label: t('nav.groups.receivables') }, { label: t('payments.breadcrumb') }]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => paymentsQuery.refetch()} loading={paymentsQuery.isFetching}>
              <RefreshCw className="h-4 w-4" /> {t('common.refresh')}
            </Button>
            <Button size="sm" disabled={!canRecord} onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" /> {t('payments.record')}
            </Button>
          </>
        }
      />

      {paymentsQuery.error ? (
        <ErrorState error={paymentsQuery.error} onRetry={() => paymentsQuery.refetch()} title={t('payments.couldNotLoad')} />
      ) : (
        <DataTable
          columns={columns}
          data={payments}
          isLoading={paymentsQuery.isLoading}
          searchPlaceholder={t('payments.searchPlaceholder')}
          getRowId={(row) => row.id}
          initialSorting={[{ id: 'paymentDate', desc: true }]}
          toolbar={
            <div className="flex items-center gap-2">
              <Select value={customerFilter} onValueChange={setCustomerFilter}>
                <SelectTrigger className="h-8 w-[200px]">
                  <SelectValue placeholder={t('payments.allCustomers')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('payments.allCustomers')}</SelectItem>
                  {(customersQuery.data ?? []).map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge variant="outline">{t('payments.total', { amount: formatMoney(total) })}</Badge>
            </div>
          }
        />
      )}

      <RecordPaymentDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}

function RecordPaymentDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation()
  const labels = useLabels()
  const customersQuery = useCustomers()
  const invoicesQuery = useInvoices()
  const bankAccountsQuery = useBankAccounts()
  const createPayment = useCreateCustomerPayment()

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema(t)),
    defaultValues: {
      customerId: '',
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

  const openInvoices = useMemo(
    () =>
      (invoicesQuery.data ?? []).filter(
        (invoice) =>
          invoice.customerId === watched.customerId &&
          invoice.balance > 0 &&
          invoice.status !== 6 &&
          invoice.status !== 1,
      ),
    [invoicesQuery.data, watched.customerId],
  )

  const applied = (watched.applications ?? []).reduce((sum, application) => sum + toNumber(application?.amount), 0)
  const remaining = toNumber(watched.amount) - applied

  const customerOptions = useMemo(
    () => (customersQuery.data ?? []).map((customer) => ({ value: customer.id, label: `${customer.code} · ${customer.name}` })),
    [customersQuery.data],
  )
  const bankAccountOptions = useMemo(
    () => (bankAccountsQuery.data ?? []).map((account) => ({ value: account.id, label: `${account.name} · ${account.currencyCode}` })),
    [bankAccountsQuery.data],
  )

  const handleCustomerChange = (customerId: string | null) => {
    form.setValue('customerId', customerId ?? '', { shouldValidate: true })
    const invoices = (invoicesQuery.data ?? []).filter(
      (invoice) => invoice.customerId === customerId && invoice.balance > 0 && invoice.status !== 6 && invoice.status !== 1,
    )
    replace(invoices.map((invoice) => ({ invoiceId: invoice.id, amount: 0 })))
  }

  const applyOldestFirst = () => {
    let available = toNumber(form.getValues('amount'))
    const next = openInvoices.map((invoice) => {
      const amount = Math.min(invoice.balance, available)
      available -= amount
      return { invoiceId: invoice.id, amount: Number(amount.toFixed(2)) }
    })
    replace(next)
  }

  const onSubmit = (values: PaymentFormValues) => {
    const applications = values.applications
      .filter((application) => toNumber(application.amount) > 0)
      .map((application) => ({ invoiceId: application.invoiceId, amount: toNumber(application.amount) }))

    createPayment.mutate(
      {
        customerId: values.customerId,
        paymentDate: values.paymentDate,
        amount: toNumber(values.amount),
        method: values.method,
        referenceNumber: values.referenceNumber?.trim() ? values.referenceNumber.trim() : null,
        bankAccountId: values.bankAccountId,
        memo: values.memo?.trim() ? values.memo.trim() : null,
        applications,
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
          <DialogTitle>{t('payments.recordTitle')}</DialogTitle>
          <DialogDescription>{t('payments.description2')}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="record-customer-payment" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="customerId"
                render={({ field }) => (
                  <ComboboxField
                    label={t('payments.customer')}
                    required
                    options={customerOptions}
                    value={field.value}
                    onChange={handleCustomerChange}
                    placeholder={t('payments.selectCustomerPlaceholder')}
                    allowClear={false}
                  />
                )}
              />
              <FormField
                control={form.control}
                name="paymentDate"
                render={({ field }) => <DateField label={t('payments.paymentDate')} required {...field} />}
              />
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <TextField
                    label={t('payments.amount')}
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
                    label={t('payments.method')}
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
                    placeholder={t('payments.referencePlaceholder')}
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
                    label={t('payments.depositTo')}
                    required
                    value={field.value}
                    onChange={field.onChange}
                    options={bankAccountOptions}
                    placeholder={t('payments.selectBankAccount')}
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
                  <p className="text-sm font-medium">{t('payments.applyToOpen')}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('payments.openSummary', {
                      count: openInvoices.length,
                      applied: formatMoney(applied),
                      remaining: formatMoney(remaining),
                    })}
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={applyOldestFirst} disabled={!openInvoices.length}>
                  <Wand2 className="h-4 w-4" /> {t('payments.applyOldestFirst')}
                </Button>
              </div>

              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('invoices.invoiceNumber')}</TableHead>
                      <TableHead>{t('common.dueDate')}</TableHead>
                      <TableHead>{t('common.status')}</TableHead>
                      <TableHead className="text-end">{t('invoices.balance')}</TableHead>
                      <TableHead className="w-[160px] text-end">{t('payments.colApply')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-20 text-center text-sm text-muted-foreground">
                          {watched.customerId
                            ? t('payments.noOpenInvoices')
                            : t('payments.selectCustomerHint')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      fields.map((field, index) => {
                        const invoice = openInvoices.find((candidate) => candidate.id === field.invoiceId)
                        if (!invoice) return null
                        return (
                          <TableRow key={field.id}>
                            <TableCell className="font-mono text-xs">{invoice.invoiceNumber}</TableCell>
                            <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                            <TableCell>
                              <Badge variant={invoiceStatusTone[invoice.status] ?? 'secondary'}>
                                {labels.invoiceStatus[invoice.status]}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-end">
                              <Money value={invoice.balance} />
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
                                    max={invoice.balance}
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
              <SummaryRow label={t('payments.paymentAmount')} value={formatMoney(toNumber(watched.amount))} />
              <SummaryRow label={t('payments.appliedToInvoices')} value={formatMoney(applied)} />
              <SummaryRow
                label={t('payments.unappliedCredit')}
                value={formatMoney(Math.max(remaining, 0))}
                strong
                className={remaining < 0 ? 'text-destructive' : undefined}
              />
            </div>
            {remaining < -0.005 ? (
              <p className="text-xs font-medium text-destructive">
                {t('payments.exceedsWarning')}
              </p>
            ) : null}
          </form>
        </Form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            form="record-customer-payment"
            loading={createPayment.isPending}
            disabled={remaining < -0.005 || toNumber(watched.amount) <= 0}
          >
            <HandCoins className="h-4 w-4" /> {t('payments.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
