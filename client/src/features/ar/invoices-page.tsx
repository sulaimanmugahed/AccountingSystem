import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { ColumnDef } from '@tanstack/react-table'
import { Ban, Eye, Plus, RefreshCw, Send, Trash2 } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { EmptyState, ErrorState, Money, SummaryRow } from '@/components/common/misc'
import { useAccounts, useCustomers, useInvoices, useItems, useTaxCodes } from '@/hooks/queries'
import { useCreateInvoice, usePostInvoice, useVoidInvoice } from '@/hooks/mutations'
import { useAuth } from '@/lib/auth'
import { CURRENCIES } from '@/lib/constants'
import { InvoiceStatus } from '@/lib/enums'
import { useLabels } from '@/lib/labels'
import { addDays, formatDate, formatMoney, formatPercent, isOverdue, today } from '@/lib/format'
import { cn, toNumber } from '@/lib/utils'
import { invoiceStatusTone, type Invoice } from '@/lib/types'

const lineSchema = z.object({
  itemId: z.string().nullable().optional(),
  description: z.string().min(1, 'Describe the line').max(300),
  quantity: z.coerce.number().positive('Quantity must be greater than zero'),
  unitPrice: z.coerce.number().min(0, 'Price cannot be negative'),
  discountPercent: z.coerce.number().min(0).max(100, 'Discount cannot exceed 100%'),
  taxCodeId: z.string().nullable().optional(),
  revenueAccountId: z.string().nullable().optional(),
})

const invoiceSchema = z.object({
  customerId: z.string().min(1, 'Select a customer'),
  invoiceDate: z.string().min(1, 'Invoice date is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  currencyCode: z.string().length(3),
  exchangeRateToBase: z.coerce.number().positive(),
  memo: z.string().max(300).optional().or(z.literal('')),
  terms: z.string().max(120).optional().or(z.literal('')),
  lines: z.array(lineSchema).min(1, 'Add at least one line'),
})

type InvoiceFormValues = z.infer<typeof invoiceSchema>

const emptyLine: InvoiceFormValues['lines'][number] = {
  itemId: null,
  description: '',
  quantity: 1,
  unitPrice: 0,
  discountPercent: 0,
  taxCodeId: null,
  revenueAccountId: null,
}

export function InvoicesPage() {
  const { t } = useTranslation()
  const labels = useLabels()
  const { hasRole } = useAuth()
  const canManage = hasRole('Admin', 'Accountant', 'ARClerk')

  const [customerFilter, setCustomerFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [selected, setSelected] = useState<Invoice | null>(null)
  const [invoiceToPost, setInvoiceToPost] = useState<Invoice | null>(null)
  const [invoiceToVoid, setInvoiceToVoid] = useState<Invoice | null>(null)

  const customersQuery = useCustomers()
  const invoicesQuery = useInvoices()
  const postInvoice = usePostInvoice()
  const voidInvoice = useVoidInvoice()

  const invoices = useMemo(() => {
    return (invoicesQuery.data ?? []).filter((invoice) => {
      if (customerFilter !== 'all' && invoice.customerId !== customerFilter) return false
      if (statusFilter === 'open' && !(invoice.status === 2 || invoice.status === 3 || invoice.status === 5)) return false
      if (statusFilter === 'overdue') return invoice.status !== 4 && invoice.status !== 6 && isOverdue(invoice.dueDate)
      if (statusFilter !== 'all' && statusFilter !== 'open' && String(invoice.status) !== statusFilter) return false
      return true
    })
  }, [invoicesQuery.data, customerFilter, statusFilter])

  const outstanding = invoices.reduce((sum, invoice) => sum + (invoice.status === 6 ? 0 : invoice.balance), 0)

  const columns = useMemo<ColumnDef<Invoice>[]>(
    () => [
      {
        accessorKey: 'invoiceNumber',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('invoices.invoiceNumber')} />
        ),
        cell: ({ row }) => <span className="font-mono text-xs font-medium">{row.original.invoiceNumber}</span>,
      },
      {
        accessorKey: 'customerName',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('invoices.customer')} />,
        cell: ({ row }) => <span className="font-medium">{row.original.customerName}</span>,
      },
      {
        accessorKey: 'invoiceDate',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('common.date')} />,
        cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.invoiceDate)}</span>,
      },
      {
        accessorKey: 'dueDate',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('common.dueDate')} />,
        cell: ({ row }) => {
          const overdue = isOverdue(row.original.dueDate, row.original.status)
          return (
            <span className={cn('whitespace-nowrap', overdue && 'font-medium text-destructive')}>
              {formatDate(row.original.dueDate)}
              {overdue ? ' •' : ''}
            </span>
          )
        },
      },
      {
        accessorKey: 'total',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('common.total')} align="right" />,
        cell: ({ row }) => (
          <div className="text-end">
            <Money value={row.original.total} />
          </div>
        ),
      },
      {
        accessorKey: 'amountPaid',
        header: t('invoices.paid'),
        enableSorting: false,
        cell: ({ row }) => (
          <div className="text-end text-muted-foreground">
            <Money value={row.original.amountPaid} />
          </div>
        ),
      },
      {
        accessorKey: 'balance',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('invoices.balance')} align="right" />,
        cell: ({ row }) => (
          <div className="text-end font-medium">
            {row.original.balance > 0 ? (
              <Money value={row.original.balance} />
            ) : (
              <span className="text-muted-foreground">{t('common.dash')}</span>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: t('common.status'),
        cell: ({ row }) => (
          <Badge variant={invoiceStatusTone[row.original.status] ?? 'secondary'}>
            {labels.invoiceStatus[row.original.status] ?? t('common.dash')}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
            <Button variant="ghost" size="sm" onClick={() => setSelected(row.original)}>
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={!canManage || row.original.status !== 1}
              onClick={() => setInvoiceToPost(row.original)}
            >
              <Send className="h-4 w-4" /> Post
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={!canManage || row.original.status === 6 || row.original.amountPaid > 0}
              onClick={() => setInvoiceToVoid(row.original)}
            >
              <Ban className="h-4 w-4" /> Void
            </Button>
          </div>
        ),
      },
    ],
    [canManage, labels, t],
  )

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('invoices.title')}
        description={t('invoices.description')}
        breadcrumbs={[{ label: t('nav.groups.receivables') }, { label: t('invoices.breadcrumb') }]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => invoicesQuery.refetch()} loading={invoicesQuery.isFetching}>
              <RefreshCw className="h-4 w-4" /> {t('common.refresh')}
            </Button>
            <Button size="sm" disabled={!canManage} onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> {t('invoices.newInvoice')}
            </Button>
          </>
        }
      />

      {invoicesQuery.error ? (
        <ErrorState
          error={invoicesQuery.error}
          onRetry={() => invoicesQuery.refetch()}
          title={t('invoices.couldNotLoad')}
        />
      ) : (
        <DataTable
          columns={columns}
          data={invoices}
          isLoading={invoicesQuery.isLoading}
          searchPlaceholder={t('invoices.searchPlaceholder')}
          getRowId={(row) => row.id}
          onRowClick={(row) => setSelected(row)}
          initialSorting={[{ id: 'invoiceDate', desc: true }]}
          toolbar={
            <div className="flex flex-wrap items-center gap-2">
              <Select value={customerFilter} onValueChange={setCustomerFilter}>
                <SelectTrigger className="h-8 w-[200px]">
                  <SelectValue placeholder={t('invoices.allCustomers')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('invoices.allCustomers')}</SelectItem>
                  {(customersQuery.data ?? []).map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-[160px]">
                  <SelectValue placeholder={t('invoices.allStatuses')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('invoices.allStatuses')}</SelectItem>
                  <SelectItem value="open">{t('invoices.openAndOverdue')}</SelectItem>
                  <SelectItem value="overdue">{t('invoices.overdueOnly')}</SelectItem>
                  <SelectItem value="1">{labels.invoiceStatus[InvoiceStatus.Draft]}</SelectItem>
                  <SelectItem value="2">{labels.invoiceStatus[InvoiceStatus.Sent]}</SelectItem>
                  <SelectItem value="3">{labels.invoiceStatus[InvoiceStatus.PartiallyPaid]}</SelectItem>
                  <SelectItem value="4">{labels.invoiceStatus[InvoiceStatus.Paid]}</SelectItem>
                  <SelectItem value="6">{labels.invoiceStatus[InvoiceStatus.Voided]}</SelectItem>
                </SelectContent>
              </Select>
              <Badge variant="outline">
                {t('invoices.outstanding', { amount: formatMoney(outstanding) })}
              </Badge>
            </div>
          }
        />
      )}

      <CreateInvoiceDialog open={createOpen} onOpenChange={setCreateOpen} />
      <InvoiceDetailDialog invoice={selected} onOpenChange={(open) => !open && setSelected(null)} />

      <ConfirmDialog
        open={!!invoiceToPost}
        onOpenChange={(open) => !open && setInvoiceToPost(null)}
        title={t('invoices.postTitle')}
        description={
          invoiceToPost
            ? t('invoices.postDescription', {
                invoice: invoiceToPost.invoiceNumber,
                amount: formatMoney(invoiceToPost.total),
              })
            : undefined
        }
        confirmLabel={t('invoices.postConfirm')}
        loading={postInvoice.isPending}
        onConfirm={() => {
          if (!invoiceToPost) return
          postInvoice.mutate(invoiceToPost.id, { onSuccess: () => setInvoiceToPost(null) })
        }}
      />

      <ConfirmDialog
        open={!!invoiceToVoid}
        onOpenChange={(open) => !open && setInvoiceToVoid(null)}
        title={t('invoices.voidTitle')}
        description={
          invoiceToVoid
            ? `${invoiceToVoid.invoiceNumber} ${t('invoices.voidAndPrune')}`
            : undefined
        }
        confirmLabel={t('invoices.voidConfirm')}
        destructive
        loading={voidInvoice.isPending}
        onConfirm={() => {
          if (!invoiceToVoid) return
          voidInvoice.mutate(invoiceToVoid.id, { onSuccess: () => setInvoiceToVoid(null) })
        }}
      />
    </div>
  )
}

function InvoiceDetailDialog({ invoice, onOpenChange }: { invoice: Invoice | null; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation()
  const labels = useLabels()
  return (
    <Dialog open={!!invoice} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono">{invoice?.invoiceNumber}</span>
            {invoice ? (
              <Badge variant={invoiceStatusTone[invoice.status] ?? 'secondary'}>
                {labels.invoiceStatus[invoice.status]}
              </Badge>
            ) : null}
          </DialogTitle>
          <DialogDescription>
            {invoice?.customerName} · {t('invoices.issued', { date: invoice ? formatDate(invoice.invoiceDate) : '' })} ·{' '}
            {t('invoices.due', { date: invoice ? formatDate(invoice.dueDate) : '' })}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('common.description')}</TableHead>
                <TableHead className="text-end">{t('invoices.qty')}</TableHead>
                <TableHead className="text-end">{t('invoices.unitPrice')}</TableHead>
                <TableHead className="text-end">{t('invoices.discountPercent')}</TableHead>
                <TableHead className="text-end">{t('invoices.tax')}</TableHead>
                <TableHead className="text-end">{t('invoices.lineTotal')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice?.lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>{line.description}</TableCell>
                  <TableCell className="text-end tabular-nums">{line.quantity}</TableCell>
                  <TableCell className="text-end">
                    <Money value={line.unitPrice} />
                  </TableCell>
                  <TableCell className="text-end tabular-nums">{formatPercent(line.discountPercent, 0)}</TableCell>
                  <TableCell className="text-end">
                    <Money value={line.taxAmount} />
                  </TableCell>
                  <TableCell className="text-end font-medium">
                    <Money value={line.lineTotal} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="rounded-lg bg-muted/40 p-4">
          <SummaryRow
            label={t('invoices.subtotal')}
            value={invoice ? formatMoney(invoice.subTotal) : t('common.dash')}
          />
          <SummaryRow
            label={t('invoices.taxLabel')}
            value={invoice ? formatMoney(invoice.taxTotal) : t('common.dash')}
          />
          <SummaryRow
            label={t('common.total')}
            value={invoice ? formatMoney(invoice.total) : t('common.dash')}
            strong
          />
          <SummaryRow
            label={t('invoices.paid')}
            value={invoice ? formatMoney(invoice.amountPaid) : t('common.dash')}
          />
          <SummaryRow
            label={t('invoices.balanceDue')}
            value={invoice ? formatMoney(invoice.balance) : t('common.dash')}
            strong
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CreateInvoiceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation()
  const customersQuery = useCustomers()
  const itemsQuery = useItems()
  const taxCodesQuery = useTaxCodes()
  const accountsQuery = useAccounts()
  const createInvoice = useCreateInvoice()

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      customerId: '',
      invoiceDate: today(),
      dueDate: addDays(today(), 30),
      currencyCode: 'USD',
      exchangeRateToBase: 1,
      memo: '',
      terms: 'Net 30',
      lines: [{ ...emptyLine }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' })
  const watched = useWatch({ control: form.control })

  const customerOptions = useMemo(
    () => (customersQuery.data ?? []).map((customer) => ({ value: customer.id, label: `${customer.code} · ${customer.name}` })),
    [customersQuery.data],
  )
  const itemOptions = useMemo(
    () => (itemsQuery.data ?? []).map((item) => ({ value: item.id, label: `${item.sku} · ${item.name}` })),
    [itemsQuery.data],
  )
  const revenueAccountOptions = useMemo(
    () =>
      (accountsQuery.data ?? [])
        .filter((account) => account.isActive && account.type === 4)
        .map((account) => ({ value: account.id, label: `${account.code} · ${account.name}` })),
    [accountsQuery.data],
  )
  const taxOptions = useMemo(
    () =>
      (taxCodesQuery.data ?? [])
        .filter((taxCode) => taxCode.type === 1)
        .map((taxCode) => ({ value: taxCode.id, label: `${taxCode.code} · ${taxCode.ratePercent}%` })),
    [taxCodesQuery.data],
  )

  const computed = useMemo(() => {
    const taxRate = (taxCodeId?: string | null) =>
      (taxCodesQuery.data ?? []).find((taxCode) => taxCode.id === taxCodeId)?.ratePercent ?? 0

    const lines = (watched.lines ?? []).map((line) => {
      const net = toNumber(line?.quantity) * toNumber(line?.unitPrice) * (1 - toNumber(line?.discountPercent) / 100)
      const tax = (net * taxRate(line?.taxCodeId)) / 100
      return { net, tax, gross: net + tax }
    })

    const subTotal = lines.reduce((sum, line) => sum + line.net, 0)
    const taxTotal = lines.reduce((sum, line) => sum + line.tax, 0)
    return { lines, subTotal, taxTotal, total: subTotal + taxTotal }
  }, [watched.lines, taxCodesQuery.data])

  const onSubmit = (values: InvoiceFormValues) => {
    createInvoice.mutate(
      {
        customerId: values.customerId,
        invoiceDate: values.invoiceDate,
        dueDate: values.dueDate,
        memo: values.memo?.trim() ? values.memo.trim() : null,
        terms: values.terms?.trim() ? values.terms.trim() : null,
        currencyCode: values.currencyCode.toUpperCase(),
        exchangeRateToBase: values.exchangeRateToBase,
        lines: values.lines.map((line) => ({
          itemId: line.itemId ?? null,
          description: line.description,
          quantity: toNumber(line.quantity),
          unitPrice: toNumber(line.unitPrice),
          discountPercent: toNumber(line.discountPercent),
          taxCodeId: line.taxCodeId ?? null,
          revenueAccountId: line.revenueAccountId ?? null,
        })),
      },
      {
        onSuccess: () => {
          form.reset()
          onOpenChange(false)
        },
        onError: (error) => {
          if (error.fieldErrors) {
            for (const [field, messages] of Object.entries(error.fieldErrors)) {
              form.setError(field as keyof InvoiceFormValues, { message: messages[0] })
            }
          }
        },
      },
    )
  }

  const handleCustomerChange = (customerId: string | null) => {
    form.setValue('customerId', customerId ?? '', { shouldValidate: true })
    const customer = (customersQuery.data ?? []).find((candidate) => candidate.id === customerId)
    if (customer) {
      const invoiceDate = form.getValues('invoiceDate')
      form.setValue('dueDate', addDays(invoiceDate, customer.paymentTermsDays))
      form.setValue('terms', t('invoices.netTermsSeed', { days: customer.paymentTermsDays }))
      form.setValue('currencyCode', customer.currencyCode)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{t('invoices.newInvoiceTitle')}</DialogTitle>
          <DialogDescription>{t('invoices.newInvoiceDescription')}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="create-invoice" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="customerId"
                render={({ field }) => (
                  <ComboboxField
                    label={t('invoices.customer')}
                    required
                    options={customerOptions}
                    value={field.value}
                    onChange={handleCustomerChange}
                    placeholder={t('invoices.selectCustomer')}
                    allowClear={false}
                  />
                )}
              />
              <FormField
                control={form.control}
                name="invoiceDate"
                render={({ field }) => (
                  <DateField
                    label={t('invoices.invoiceDate')}
                    required
                    {...field}
                    onChange={(event) => {
                      field.onChange(event)
                      const terms = Number((form.getValues('terms') ?? '').replace(/\D/g, '')) || 30
                      form.setValue('dueDate', addDays(event.target.value, terms))
                    }}
                  />
                )}
              />
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => <DateField label={t('common.dueDate')} required {...field} />}
              />
              <FormField
                control={form.control}
                name="currencyCode"
                render={({ field }) => (
                  <SelectField
                    label={t('common.currency')}
                    value={field.value}
                    onChange={field.onChange}
                    options={CURRENCIES}
                  />
                )}
              />
              <FormField
                control={form.control}
                name="exchangeRateToBase"
                render={({ field }) => (
                  <TextField
                    label={t('common.exchangeRate')}
                    type="number"
                    step="any"
                    className="text-end"
                    {...field}
                  />
                )}
              />
              <FormField
                control={form.control}
                name="terms"
                render={({ field }) => (
                  <TextField
                    label={t('common.terms')}
                    placeholder={t('invoices.termsPlaceholder')}
                    {...field}
                    value={field.value ?? ''}
                  />
                )}
              />
              <FormField
                control={form.control}
                name="memo"
                render={({ field }) => (
                  <TextAreaField
                    label={t('common.memo')}
                    placeholder={t('invoices.memoPlaceholder')}
                    className="sm:col-span-3"
                    {...field}
                    value={field.value ?? ''}
                  />
                )}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{t('invoices.lines')}</p>
                <Button type="button" variant="outline" size="sm" onClick={() => append({ ...emptyLine })}>
                  <Plus className="h-4 w-4" /> {t('invoices.addLine')}
                </Button>
              </div>

              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div key={field.id} className="space-y-3 rounded-lg border p-3">
                    <div className="grid gap-3 lg:grid-cols-12">
                    <div className="lg:col-span-3">
                      <FormField
                        control={form.control}
                        name={`lines.${index}.itemId`}
                        render={({ field: itemField }) => (
                          <ComboboxField
                            label={index === 0 ? t('bills.item') : undefined}
                            options={itemOptions}
                            value={itemField.value ?? null}
                            onChange={(value) => {
                              itemField.onChange(value)
                              const item = (itemsQuery.data ?? []).find((candidate) => candidate.id === value)
                              if (item) {
                                form.setValue(`lines.${index}.description`, item.name)
                                form.setValue(`lines.${index}.unitPrice`, item.salesPrice)
                                if (item.defaultTaxCodeId) form.setValue(`lines.${index}.taxCodeId`, item.defaultTaxCodeId)
                                if (item.incomeAccountId) form.setValue(`lines.${index}.revenueAccountId`, item.incomeAccountId)
                              }
                            }}
                            placeholder={t('invoices.itemOptional')}
                          />
                        )}
                      />
                    </div>
                    <div className="lg:col-span-3">
                      <FormField
                        control={form.control}
                        name={`lines.${index}.description`}
                        render={({ field: descriptionField }) => (
                          <TextField
                            label={index === 0 ? t('common.description') : undefined}
                            placeholder={t('invoices.lineDescriptionPlaceholder')}
                            {...descriptionField}
                          />
                        )}
                      />
                    </div>
                    <div className="lg:col-span-1">
                      <FormField
                        control={form.control}
                        name={`lines.${index}.quantity`}
                        render={({ field: quantityField }) => (
                          <TextField
                            label={index === 0 ? t('invoices.qty') : undefined}
                            type="number"
                            step="any"
                            min={0}
                            className="text-end"
                            {...quantityField}
                          />
                        )}
                      />
                    </div>
                    <div className="lg:col-span-1">
                      <FormField
                        control={form.control}
                        name={`lines.${index}.unitPrice`}
                        render={({ field: priceField }) => (
                          <TextField
                            label={index === 0 ? t('invoices.price') : undefined}
                            type="number"
                            step="any"
                            min={0}
                            className="text-end"
                            {...priceField}
                          />
                        )}
                      />
                    </div>
                    <div className="lg:col-span-1">
                      <FormField
                        control={form.control}
                        name={`lines.${index}.discountPercent`}
                        render={({ field: discountField }) => (
                          <TextField
                            label={index === 0 ? t('invoices.discPct') : undefined}
                            type="number"
                            step="any"
                            min={0}
                            max={100}
                            className="text-end"
                            {...discountField}
                          />
                        )}
                      />
                    </div>
                    <div className="flex items-end justify-between gap-2 lg:col-span-1 lg:justify-end">
                      <div className="text-end text-sm tabular-nums lg:hidden">
                        {formatMoney(computed.lines[index]?.gross ?? 0)}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={fields.length <= 1}
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-12">
                      <div className="lg:col-span-3">
                        <FormField
                          control={form.control}
                          name={`lines.${index}.taxCodeId`}
                          render={({ field: taxField }) => (
                            <ComboboxField
                              label={t('invoices.taxCode')}
                              options={taxOptions}
                              value={taxField.value ?? null}
                              onChange={(value) => taxField.onChange(value)}
                              placeholder={t('invoices.noTax')}
                            />
                          )}
                        />
                      </div>
                      <div className="lg:col-span-3">
                        <FormField
                          control={form.control}
                          name={`lines.${index}.revenueAccountId`}
                          render={({ field: accountField }) => (
                            <ComboboxField
                              label={t('invoices.revenueAccount')}
                              options={revenueAccountOptions}
                              value={accountField.value ?? null}
                              onChange={(value) => accountField.onChange(value)}
                              placeholder={t('invoices.companyDefault')}
                            />
                          )}
                        />
                      </div>
                      <div className="flex items-end justify-end lg:col-span-6">
                        <p className="text-end text-sm text-muted-foreground">
                          {t('invoices.lineNet', {
                            net: formatMoney(computed.lines[index]?.net ?? 0),
                            tax: formatMoney(computed.lines[index]?.tax ?? 0),
                            total: formatMoney(computed.lines[index]?.gross ?? 0),
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {typeof form.formState.errors.lines?.message === 'string' ? (
                <p className="text-xs font-medium text-destructive">{form.formState.errors.lines.message}</p>
              ) : null}
            </div>

            <div className="flex flex-col items-end gap-1 rounded-lg bg-muted/40 p-4">
              <SummaryRow
                label={t('invoices.subtotal')}
                value={formatMoney(computed.subTotal)}
                className="w-full max-w-sm"
              />
              <SummaryRow
                label={t('invoices.taxLabel')}
                value={formatMoney(computed.taxTotal)}
                className="w-full max-w-sm"
              />
              <SummaryRow
                label={t('invoices.invoiceTotal')}
                value={formatMoney(computed.total)}
                strong
                className="w-full max-w-sm"
              />
              <p className="text-xs text-muted-foreground">
                {t('invoices.linesAndPosting', {
                  count: fields.length,
                  amount: formatMoney(computed.total),
                })}
              </p>
            </div>

            {customerOptions.length === 0 && !customersQuery.isLoading ? (
              <EmptyState
                title={t('invoices.noCustomers')}
                description={t('invoices.noCustomeredAdd')}
              />
            ) : null}
          </form>
        </Form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="create-invoice" loading={createInvoice.isPending}>
            {t('invoices.saveDraft')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
