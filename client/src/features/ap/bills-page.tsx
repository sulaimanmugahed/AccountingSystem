import { useMemo, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
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
import { useAccounts, useBills, useItems, useTaxCodes, useVendors } from '@/hooks/queries'
import { useCreateBill, usePostBill, useVoidBill } from '@/hooks/mutations'
import { useAuth } from '@/lib/auth'
import { CURRENCIES } from '@/lib/constants'
import { billStatusLabels } from '@/lib/enums'
import { addDays, formatDate, formatMoney, isOverdue, today } from '@/lib/format'
import { cn, toNumber } from '@/lib/utils'
import { billStatusTone, type Bill } from '@/lib/types'

const lineSchema = z.object({
  itemId: z.string().nullable().optional(),
  description: z.string().min(1, 'Describe the line').max(300),
  quantity: z.coerce.number().positive('Quantity must be greater than zero'),
  unitCost: z.coerce.number().min(0, 'Cost cannot be negative'),
  taxCodeId: z.string().nullable().optional(),
  expenseAccountId: z.string().nullable().optional(),
})

const billSchema = z.object({
  vendorId: z.string().min(1, 'Select a vendor'),
  vendorInvoiceNumber: z.string().max(60).optional().or(z.literal('')),
  billDate: z.string().min(1, 'Bill date is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  currencyCode: z.string().length(3),
  exchangeRateToBase: z.coerce.number().positive(),
  memo: z.string().max(300).optional().or(z.literal('')),
  lines: z.array(lineSchema).min(1, 'Add at least one line'),
})

type BillFormValues = z.infer<typeof billSchema>

const emptyLine: BillFormValues['lines'][number] = {
  itemId: null,
  description: '',
  quantity: 1,
  unitCost: 0,
  taxCodeId: null,
  expenseAccountId: null,
}

export function BillsPage() {
  const { hasRole } = useAuth()
  const canManage = hasRole('Admin', 'Accountant', 'APClerk')

  const [vendorFilter, setVendorFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [selected, setSelected] = useState<Bill | null>(null)
  const [billToPost, setBillToPost] = useState<Bill | null>(null)
  const [billToVoid, setBillToVoid] = useState<Bill | null>(null)

  const vendorsQuery = useVendors()
  const billsQuery = useBills()
  const postBill = usePostBill()
  const voidBill = useVoidBill()

  const bills = useMemo(
    () =>
      (billsQuery.data ?? []).filter((bill) => {
        if (vendorFilter !== 'all' && bill.vendorId !== vendorFilter) return false
        if (statusFilter === 'open' && !(bill.status === 2 || bill.status === 3)) return false
        if (statusFilter === 'overdue') return bill.status !== 4 && bill.status !== 5 && isOverdue(bill.dueDate)
        if (statusFilter !== 'all' && statusFilter !== 'open' && String(bill.status) !== statusFilter) return false
        return true
      }),
    [billsQuery.data, vendorFilter, statusFilter],
  )

  const outstanding = bills.reduce((sum, bill) => sum + (bill.status === 5 ? 0 : bill.balance), 0)

  const columns = useMemo<ColumnDef<Bill>[]>(
    () => [
      {
        accessorKey: 'billNumber',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Bill #" />,
        cell: ({ row }) => <span className="font-mono text-xs font-medium">{row.original.billNumber}</span>,
      },
      {
        accessorKey: 'vendorName',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Vendor" />,
        cell: ({ row }) => <span className="font-medium">{row.original.vendorName}</span>,
      },
      {
        accessorKey: 'billDate',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
        cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.billDate)}</span>,
      },
      {
        accessorKey: 'dueDate',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Due" />,
        cell: ({ row }) => {
          const overdue = isOverdue(row.original.dueDate, row.original.status)
          return (
            <span className={cn('whitespace-nowrap', overdue && 'font-medium text-destructive')}>
              {formatDate(row.original.dueDate)}
            </span>
          )
        },
      },
      {
        accessorKey: 'total',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Total" align="right" />,
        cell: ({ row }) => (
          <div className="text-right">
            <Money value={row.original.total} />
          </div>
        ),
      },
      {
        accessorKey: 'balance',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Balance" align="right" />,
        cell: ({ row }) => (
          <div className="text-right font-medium">
            {row.original.balance > 0 ? <Money value={row.original.balance} /> : <span className="text-muted-foreground">—</span>}
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={billStatusTone[row.original.status] ?? 'secondary'}>
            {billStatusLabels[row.original.status] ?? '—'}
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
              onClick={() => setBillToPost(row.original)}
            >
              <Send className="h-4 w-4" /> Post
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={!canManage || row.original.status === 5 || row.original.amountPaid > 0}
              onClick={() => setBillToVoid(row.original)}
            >
              <Ban className="h-4 w-4" /> Void
            </Button>
          </div>
        ),
      },
    ],
    [canManage],
  )

  return (
    <div className="space-y-5">
      <PageHeader
        title="Vendor bills"
        description="Enter supplier invoices as drafts, then post them to book AP against the expense or inventory account on each line."
        breadcrumbs={[{ label: 'Payables' }, { label: 'Bills' }]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => billsQuery.refetch()} loading={billsQuery.isFetching}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Button size="sm" disabled={!canManage} onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> New bill
            </Button>
          </>
        }
      />

      {billsQuery.error ? (
        <ErrorState error={billsQuery.error} onRetry={() => billsQuery.refetch()} title="Could not load bills" />
      ) : (
        <DataTable
          columns={columns}
          data={bills}
          isLoading={billsQuery.isLoading}
          searchPlaceholder="Search by bill number or vendor…"
          getRowId={(row) => row.id}
          onRowClick={(row) => setSelected(row)}
          initialSorting={[{ id: 'billDate', desc: true }]}
          toolbar={
            <div className="flex flex-wrap items-center gap-2">
              <Select value={vendorFilter} onValueChange={setVendorFilter}>
                <SelectTrigger className="h-8 w-[200px]">
                  <SelectValue placeholder="All vendors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All vendors</SelectItem>
                  {(vendorsQuery.data ?? []).map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-[160px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="overdue">Overdue only</SelectItem>
                  <SelectItem value="1">Draft</SelectItem>
                  <SelectItem value="2">Approved</SelectItem>
                  <SelectItem value="3">Partially paid</SelectItem>
                  <SelectItem value="4">Paid</SelectItem>
                  <SelectItem value="5">Voided</SelectItem>
                </SelectContent>
              </Select>
              <Badge variant="outline">Outstanding {formatMoney(outstanding)}</Badge>
            </div>
          }
        />
      )}

      <CreateBillDialog open={createOpen} onOpenChange={setCreateOpen} />
      <BillDetailDialog bill={selected} onOpenChange={(open) => !open && setSelected(null)} />

      <ConfirmDialog
        open={!!billToPost}
        onOpenChange={(open) => !open && setBillToPost(null)}
        title="Post this bill?"
        description={
          billToPost
            ? `${billToPost.billNumber} for ${formatMoney(billToPost.total)} will book AP and the line expenses. Stocked items are received into inventory at cost.`
            : undefined
        }
        confirmLabel="Post bill"
        loading={postBill.isPending}
        onConfirm={() => {
          if (!billToPost) return
          postBill.mutate(billToPost.id, { onSuccess: () => setBillToPost(null) })
        }}
      />

      <ConfirmDialog
        open={!!billToVoid}
        onOpenChange={(open) => !open && setBillToVoid(null)}
        title="Void this bill?"
        description={
          billToVoid
            ? `${billToVoid.billNumber} will be voided. Posted bills are reversed with a mirror journal entry rather than deleted.`
            : undefined
        }
        confirmLabel="Void bill"
        destructive
        loading={voidBill.isPending}
        onConfirm={() => {
          if (!billToVoid) return
          voidBill.mutate(billToVoid.id, { onSuccess: () => setBillToVoid(null) })
        }}
      />
    </div>
  )
}

function BillDetailDialog({ bill, onOpenChange }: { bill: Bill | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={!!bill} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono">{bill?.billNumber}</span>
            {bill ? <Badge variant={billStatusTone[bill.status] ?? 'secondary'}>{billStatusLabels[bill.status]}</Badge> : null}
          </DialogTitle>
          <DialogDescription>
            {bill?.vendorName} · received {bill ? formatDate(bill.billDate) : ''} · due{' '}
            {bill ? formatDate(bill.dueDate) : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit cost</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead className="text-right">Line total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bill?.lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>{line.description}</TableCell>
                  <TableCell className="text-right tabular-nums">{line.quantity}</TableCell>
                  <TableCell className="text-right">
                    <Money value={line.unitCost} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={line.taxAmount} />
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <Money value={line.lineTotal} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="rounded-lg bg-muted/40 p-4">
          <SummaryRow label="Subtotal" value={bill ? formatMoney(bill.subTotal) : '—'} />
          <SummaryRow label="Tax" value={bill ? formatMoney(bill.taxTotal) : '—'} />
          <SummaryRow label="Total" value={bill ? formatMoney(bill.total) : '—'} strong />
          <SummaryRow label="Paid" value={bill ? formatMoney(bill.amountPaid) : '—'} />
          <SummaryRow label="Balance due" value={bill ? formatMoney(bill.balance) : '—'} strong />
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CreateBillDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const vendorsQuery = useVendors()
  const itemsQuery = useItems()
  const accountsQuery = useAccounts()
  const taxCodesQuery = useTaxCodes()
  const createBill = useCreateBill()

  const form = useForm<BillFormValues>({
    resolver: zodResolver(billSchema),
    defaultValues: {
      vendorId: '',
      vendorInvoiceNumber: '',
      billDate: today(),
      dueDate: addDays(today(), 30),
      currencyCode: 'USD',
      exchangeRateToBase: 1,
      memo: '',
      lines: [{ ...emptyLine }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' })
  const watched = form.watch()

  const vendorOptions = useMemo(
    () => (vendorsQuery.data ?? []).map((vendor) => ({ value: vendor.id, label: `${vendor.code} · ${vendor.name}` })),
    [vendorsQuery.data],
  )
  const itemOptions = useMemo(
    () => (itemsQuery.data ?? []).map((item) => ({ value: item.id, label: `${item.sku} · ${item.name}` })),
    [itemsQuery.data],
  )
  const expenseAccountOptions = useMemo(
    () =>
      (accountsQuery.data ?? [])
        .filter((account) => account.isActive && account.type === 5)
        .map((account) => ({ value: account.id, label: `${account.code} · ${account.name}` })),
    [accountsQuery.data],
  )
  const purchaseTaxOptions = useMemo(
    () =>
      (taxCodesQuery.data ?? [])
        .filter((taxCode) => taxCode.type === 2)
        .map((taxCode) => ({ value: taxCode.id, label: `${taxCode.code} · ${taxCode.ratePercent}%` })),
    [taxCodesQuery.data],
  )

  const computed = useMemo(() => {
    const taxRate = (taxCodeId?: string | null) =>
      (taxCodesQuery.data ?? []).find((taxCode) => taxCode.id === taxCodeId)?.ratePercent ?? 0

    const lines = (watched.lines ?? []).map((line) => {
      const net = toNumber(line?.quantity) * toNumber(line?.unitCost)
      const tax = (net * taxRate(line?.taxCodeId)) / 100
      return { net, tax }
    })
    const subTotal = lines.reduce((sum, line) => sum + line.net, 0)
    const taxTotal = lines.reduce((sum, line) => sum + line.tax, 0)
    return { lines, subTotal, taxTotal, total: subTotal + taxTotal }
  }, [watched.lines, taxCodesQuery.data])

  const onSubmit = (values: BillFormValues) => {
    createBill.mutate(
      {
        vendorId: values.vendorId,
        vendorInvoiceNumber: values.vendorInvoiceNumber?.trim() ? values.vendorInvoiceNumber.trim() : null,
        billDate: values.billDate,
        dueDate: values.dueDate,
        memo: values.memo?.trim() ? values.memo.trim() : null,
        currencyCode: values.currencyCode.toUpperCase(),
        exchangeRateToBase: values.exchangeRateToBase,
        lines: values.lines.map((line) => ({
          itemId: line.itemId ?? null,
          description: line.description,
          quantity: toNumber(line.quantity),
          unitCost: toNumber(line.unitCost),
          taxCodeId: line.taxCodeId ?? null,
          expenseAccountId: line.expenseAccountId ?? null,
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
              form.setError(field as keyof BillFormValues, { message: messages[0] })
            }
          }
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>New vendor bill</DialogTitle>
          <DialogDescription>Saved as a draft — post it from the bill list to update AP and inventory.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="create-bill" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="vendorId"
                render={({ field }) => (
                  <ComboboxField
                    label="Vendor"
                    required
                    options={vendorOptions}
                    value={field.value}
                    onChange={(value) => {
                      field.onChange(value ?? '')
                      const vendor = (vendorsQuery.data ?? []).find((candidate) => candidate.id === value)
                      if (vendor) {
                        form.setValue('dueDate', addDays(form.getValues('billDate'), vendor.paymentTermsDays))
                        form.setValue('currencyCode', vendor.currencyCode)
                      }
                    }}
                    placeholder="Select a vendor"
                    allowClear={false}
                  />
                )}
              />
              <FormField
                control={form.control}
                name="vendorInvoiceNumber"
                render={({ field }) => (
                  <TextField label="Vendor invoice #" placeholder="VINV-9012" {...field} value={field.value ?? ''} />
                )}
              />
              <FormField
                control={form.control}
                name="billDate"
                render={({ field }) => (
                  <DateField
                    label="Bill date"
                    required
                    {...field}
                    onChange={(event) => {
                      field.onChange(event)
                      form.setValue('dueDate', addDays(event.target.value, 30))
                    }}
                  />
                )}
              />
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => <DateField label="Due date" required {...field} />}
              />
              <FormField
                control={form.control}
                name="currencyCode"
                render={({ field }) => (
                  <SelectField label="Currency" value={field.value} onChange={field.onChange} options={CURRENCIES} />
                )}
              />
              <FormField
                control={form.control}
                name="exchangeRateToBase"
                render={({ field }) => (
                  <TextField label="Exchange rate" type="number" step="any" className="text-right" {...field} />
                )}
              />
              <FormField
                control={form.control}
                name="memo"
                render={({ field }) => (
                  <TextAreaField label="Memo" className="sm:col-span-3" {...field} value={field.value ?? ''} />
                )}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Lines</p>
                <Button type="button" variant="outline" size="sm" onClick={() => append({ ...emptyLine })}>
                  <Plus className="h-4 w-4" /> Add line
                </Button>
              </div>

              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div key={field.id} className="grid gap-3 rounded-lg border p-3 lg:grid-cols-12">
                    <div className="lg:col-span-3">
                      <FormField
                        control={form.control}
                        name={`lines.${index}.itemId`}
                        render={({ field: itemField }) => (
                          <ComboboxField
                            label={index === 0 ? 'Item' : undefined}
                            options={itemOptions}
                            value={itemField.value ?? null}
                            onChange={(value) => {
                              itemField.onChange(value)
                              const item = (itemsQuery.data ?? []).find((candidate) => candidate.id === value)
                              if (item) {
                                form.setValue(`lines.${index}.description`, item.name)
                                form.setValue(`lines.${index}.unitCost`, item.purchaseCost)
                                if (item.expenseAccountId) form.setValue(`lines.${index}.expenseAccountId`, item.expenseAccountId)
                                if (item.defaultTaxCodeId) form.setValue(`lines.${index}.taxCodeId`, item.defaultTaxCodeId)
                              }
                            }}
                            placeholder="Optional"
                          />
                        )}
                      />
                    </div>
                    <div className="lg:col-span-3">
                      <FormField
                        control={form.control}
                        name={`lines.${index}.description`}
                        render={({ field: descriptionField }) => (
                          <TextField label={index === 0 ? 'Description' : undefined} {...descriptionField} />
                        )}
                      />
                    </div>
                    <div className="lg:col-span-1">
                      <FormField
                        control={form.control}
                        name={`lines.${index}.quantity`}
                        render={({ field: quantityField }) => (
                          <TextField
                            label={index === 0 ? 'Qty' : undefined}
                            type="number"
                            step="any"
                            min={0}
                            className="text-right"
                            {...quantityField}
                          />
                        )}
                      />
                    </div>
                    <div className="lg:col-span-1">
                      <FormField
                        control={form.control}
                        name={`lines.${index}.unitCost`}
                        render={({ field: costField }) => (
                          <TextField
                            label={index === 0 ? 'Cost' : undefined}
                            type="number"
                            step="any"
                            min={0}
                            className="text-right"
                            {...costField}
                          />
                        )}
                      />
                    </div>
                    <div className="lg:col-span-2">
                      <FormField
                        control={form.control}
                        name={`lines.${index}.taxCodeId`}
                        render={({ field: taxField }) => (
                          <ComboboxField
                            label={index === 0 ? 'Tax code' : undefined}
                            options={purchaseTaxOptions}
                            value={taxField.value ?? null}
                            onChange={(value) => taxField.onChange(value)}
                            placeholder="No tax"
                          />
                        )}
                      />
                    </div>
                    <div className="lg:col-span-2">
                      <FormField
                        control={form.control}
                        name={`lines.${index}.expenseAccountId`}
                        render={({ field: accountField }) => (
                          <ComboboxField
                            label={index === 0 ? 'Expense / asset' : undefined}
                            options={expenseAccountOptions}
                            value={accountField.value ?? null}
                            onChange={(value) => accountField.onChange(value)}
                            placeholder="Company default"
                          />
                        )}
                      />
                    </div>
                    <div className="flex items-end justify-end lg:col-span-1">
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
                ))}
              </div>
            </div>

            <div className="flex flex-col items-end gap-1 rounded-lg bg-muted/40 p-4">
              <SummaryRow label="Subtotal" value={formatMoney(computed.subTotal)} className="w-full max-w-sm" />
              <SummaryRow label="Purchase tax" value={formatMoney(computed.taxTotal)} className="w-full max-w-sm" />
              <SummaryRow label="Bill total" value={formatMoney(computed.total)} strong className="w-full max-w-sm" />
            </div>

            {vendorOptions.length === 0 && !vendorsQuery.isLoading ? (
              <EmptyState title="No vendors yet" description="Add a vendor before entering a bill." />
            ) : null}
          </form>
        </Form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="create-bill" loading={createBill.isPending}>
            Save draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
