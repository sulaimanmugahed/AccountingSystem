import { useMemo, useState } from 'react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowLeftRight, Eye, Plus, RefreshCw, RotateCcw, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { DataTable, DataTableColumnHeader } from '@/components/data-table/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Form, FormField } from '@/components/ui/form'
import { ComboboxField, DateField, TextField } from '@/components/ui/fields'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { EmptyState, ErrorState, Money } from '@/components/common/misc'
import { useAccounts, useJournalEntries } from '@/hooks/queries'
import { useCreateJournalEntry, useReverseJournalEntry } from '@/hooks/mutations'
import { useAuth } from '@/lib/auth'
import { journalEntryStatusLabels, journalSourceTypeLabels, JournalSourceType } from '@/lib/enums'
import { formatDate, today } from '@/lib/format'
import { cn, toNumber } from '@/lib/utils'
import { journalStatusTone, type JournalEntry } from '@/lib/types'

const lineSchema = z
  .object({
    accountId: z.string().min(1, 'Choose an account'),
    description: z.string().max(200).optional().or(z.literal('')),
    debit: z.coerce.number().min(0, 'Cannot be negative'),
    credit: z.coerce.number().min(0, 'Cannot be negative'),
  })
  .refine((line) => !(line.debit > 0 && line.credit > 0), {
    message: 'A line cannot be both a debit and a credit',
    path: ['credit'],
  })
  .refine((line) => line.debit > 0 || line.credit > 0, {
    message: 'Enter a debit or a credit',
    path: ['debit'],
  })

const entrySchema = z.object({
  entryDate: z.string().min(1, 'Entry date is required'),
  memo: z.string().max(300).optional().or(z.literal('')),
  currencyCode: z.string().min(3).max(3),
  exchangeRateToBase: z.coerce.number().positive('Rate must be greater than zero'),
  lines: z.array(lineSchema).min(2, 'A journal entry needs at least two lines'),
})

type EntryFormValues = z.infer<typeof entrySchema>

export function JournalEntriesPage() {
  const { hasRole } = useAuth()
  const canPost = hasRole('Admin', 'Accountant')

  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [selected, setSelected] = useState<JournalEntry | null>(null)
  const [entryToReverse, setEntryToReverse] = useState<JournalEntry | null>(null)

  const entriesQuery = useJournalEntries({ from: fromDate || undefined, to: toDate || undefined })
  const reverseEntry = useReverseJournalEntry()
  const entries = entriesQuery.data ?? []

  const totals = useMemo(
    () =>
      entries.reduce(
        (accumulator, entry) => ({
          debit: accumulator.debit + entry.totalDebit,
          posted: accumulator.posted + (entry.status === 2 ? 1 : 0),
        }),
        { debit: 0, posted: 0 },
      ),
    [entries],
  )

  const columns = useMemo<ColumnDef<JournalEntry>[]>(
    () => [
      {
        accessorKey: 'entryNumber',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Entry #" />,
        cell: ({ row }) => <span className="font-mono text-xs font-medium">{row.original.entryNumber}</span>,
      },
      {
        accessorKey: 'entryDate',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
        cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.entryDate)}</span>,
      },
      {
        accessorKey: 'sourceType',
        header: 'Source',
        cell: ({ row }) => (
          <Badge variant="secondary">{journalSourceTypeLabels[row.original.sourceType] ?? 'Manual'}</Badge>
        ),
      },
      {
        accessorKey: 'memo',
        header: 'Memo',
        cell: ({ row }) => (
          <span className="line-clamp-1 max-w-[320px] text-muted-foreground">{row.original.memo || '—'}</span>
        ),
      },
      {
        id: 'accounts',
        header: 'Accounts',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="max-w-[360px] space-y-0.5">
            {row.original.lines.slice(0, 3).map((line, index) => (
              <p key={`${line.accountId}-${index}`} className="truncate text-xs text-muted-foreground">
                <span className="font-mono">{line.accountCode}</span> {line.accountName}
              </p>
            ))}
            {row.original.lines.length > 3 ? (
              <p className="text-xs text-muted-foreground">+{row.original.lines.length - 3} more…</p>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: 'totalDebit',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Debit" align="right" />,
        cell: ({ row }) => (
          <div className="text-right">
            <Money value={row.original.totalDebit} />
          </div>
        ),
      },
      {
        accessorKey: 'totalCredit',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Credit" align="right" />,
        cell: ({ row }) => (
          <div className="text-right">
            <Money value={row.original.totalCredit} />
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={journalStatusTone[row.original.status] ?? 'secondary'}>
            {journalEntryStatusLabels[row.original.status] ?? '—'}
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
              <Eye className="h-4 w-4" /> View
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={!canPost || row.original.status !== 2}
              onClick={() => setEntryToReverse(row.original)}
            >
              <RotateCcw className="h-4 w-4" /> Reverse
            </Button>
          </div>
        ),
      },
    ],
    [canPost],
  )

  return (
    <div className="space-y-5">
      <PageHeader
        title="Journal entries"
        description="Append-only double-entry ledger. Entries are validated for balance and for an open fiscal period; corrections are made by posting a reversal."
        breadcrumbs={[{ label: 'General Ledger' }, { label: 'Journal Entries' }]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => entriesQuery.refetch()} loading={entriesQuery.isFetching}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Button size="sm" disabled={!canPost} onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> New entry
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Entries in view</p>
            <p className="text-2xl font-semibold tabular-nums">{entries.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Posted</p>
            <p className="text-2xl font-semibold tabular-nums">{totals.posted}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total debits</p>
            <p className="text-2xl font-semibold tabular-nums">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totals.debit)}</p>
          </CardContent>
        </Card>
      </div>

      {entriesQuery.error ? (
        <ErrorState error={entriesQuery.error} onRetry={() => entriesQuery.refetch()} title="Could not load journal entries" />
      ) : (
        <DataTable
          columns={columns}
          data={entries}
          isLoading={entriesQuery.isLoading}
          searchPlaceholder="Search by entry number, memo or account…"
          getRowId={(row) => row.id}
          onRowClick={(row) => setSelected(row)}
          initialSorting={[{ id: 'entryDate', desc: true }]}
          toolbar={
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">From</span>
                <Input
                  type="date"
                  value={fromDate}
                  max={toDate || undefined}
                  onChange={(event) => setFromDate(event.target.value)}
                  className="h-8 w-[150px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">To</span>
                <Input
                  type="date"
                  value={toDate}
                  min={fromDate || undefined}
                  onChange={(event) => setToDate(event.target.value)}
                  className="h-8 w-[150px]"
                />
              </div>
              {fromDate || toDate ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFromDate('')
                    setToDate('')
                  }}
                >
                  Clear
                </Button>
              ) : null}
            </div>
          }
        />
      )}

      <CreateJournalEntryDialog open={createOpen} onOpenChange={setCreateOpen} />
      <JournalEntryDetailDialog entry={selected} onOpenChange={(open) => !open && setSelected(null)} />

      <ConfirmDialog
        open={!!entryToReverse}
        onOpenChange={(open) => !open && setEntryToReverse(null)}
        title="Post a reversing entry?"
        description={
          entryToReverse
            ? `${entryToReverse.entryNumber} will be reversed with an equal and opposite entry dated today. The original entry stays in the ledger, marked as reversed.`
            : undefined
        }
        confirmLabel="Post reversal"
        loading={reverseEntry.isPending}
        onConfirm={() => {
          if (!entryToReverse) return
          reverseEntry.mutate(
            { id: entryToReverse.id, reversalDate: today() },
            { onSuccess: () => setEntryToReverse(null) },
          )
        }}
      />
    </div>
  )
}

function JournalEntryDetailDialog({
  entry,
  onOpenChange,
}: {
  entry: JournalEntry | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={!!entry} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono">{entry?.entryNumber}</span>
            {entry ? (
              <Badge variant={journalStatusTone[entry.status] ?? 'secondary'}>{journalEntryStatusLabels[entry.status]}</Badge>
            ) : null}
          </DialogTitle>
          <DialogDescription>
            {entry ? `${formatDate(entry.entryDate)} · ${journalSourceTypeLabels[entry.sourceType] ?? 'Manual'}` : ''}
            {entry?.memo ? ` · ${entry.memo}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Account</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entry?.lines.map((line, index) => (
                <TableRow key={`${line.accountId}-${index}`}>
                  <TableCell className="font-mono text-xs">{line.accountCode}</TableCell>
                  <TableCell>{line.accountName}</TableCell>
                  <TableCell className="text-muted-foreground">{line.description || '—'}</TableCell>
                  <TableCell className="text-right">
                    {line.debit ? <Money value={line.debit} /> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    {line.credit ? <Money value={line.credit} /> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-2 text-sm">
          <span className="text-muted-foreground">Totals</span>
          <div className="flex gap-6 tabular-nums">
            <span>Debit {entry ? <Money value={entry.totalDebit} /> : null}</span>
            <span>Credit {entry ? <Money value={entry.totalCredit} /> : null}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CreateJournalEntryDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const accountsQuery = useAccounts()
  const createEntry = useCreateJournalEntry()

  const form = useForm<EntryFormValues>({
    resolver: zodResolver(entrySchema),
    defaultValues: {
      entryDate: today(),
      memo: '',
      currencyCode: 'USD',
      exchangeRateToBase: 1,
      lines: [
        { accountId: '', description: '', debit: 0, credit: 0 },
        { accountId: '', description: '', debit: 0, credit: 0 },
      ],
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' })
  const watchedLines = form.watch('lines')

  const accountOptions = useMemo(
    () =>
      (accountsQuery.data ?? [])
        .filter((account) => account.isActive)
        .map((account) => ({ value: account.id, label: `${account.code} · ${account.name}` })),
    [accountsQuery.data],
  )

  const totals = useMemo(() => {
    const debit = watchedLines.reduce((sum, line) => sum + toNumber(line?.debit), 0)
    const credit = watchedLines.reduce((sum, line) => sum + toNumber(line?.credit), 0)
    return { debit, credit, balanced: Math.abs(debit - credit) < 0.005 && debit > 0 }
  }, [watchedLines])

  const onSubmit = (values: EntryFormValues) => {
    if (!totals.balanced) return
    createEntry.mutate(
      {
        entryDate: values.entryDate,
        memo: values.memo?.trim() ? values.memo.trim() : null,
        sourceType: JournalSourceType.Manual,
        currencyCode: values.currencyCode.toUpperCase(),
        exchangeRateToBase: values.exchangeRateToBase,
        lines: values.lines.map((line) => ({
          accountId: line.accountId,
          debit: toNumber(line.debit),
          credit: toNumber(line.credit),
          description: line.description?.trim() ? line.description.trim() : null,
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
              form.setError(field as keyof EntryFormValues, { message: messages[0] })
            }
          }
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>New journal entry</DialogTitle>
          <DialogDescription>
            Manual entries post immediately. The server rejects unbalanced entries and dates outside an open period.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="create-journal-entry" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-4">
              <FormField
                control={form.control}
                name="entryDate"
                render={({ field }) => <DateField label="Entry date" required {...field} />}
              />
              <FormField
                control={form.control}
                name="currencyCode"
                render={({ field }) => <TextField label="Currency" maxLength={3} {...field} />}
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
                render={({ field }) => <TextField label="Memo" placeholder="What is this entry for?" {...field} value={field.value ?? ''} />}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Lines</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ accountId: '', description: '', debit: 0, credit: 0 })}
                >
                  <Plus className="h-4 w-4" /> Add line
                </Button>
              </div>

              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div key={field.id} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[2fr_2fr_1fr_1fr_auto]">
                    <Controller
                      control={form.control}
                      name={`lines.${index}.accountId`}
                      render={({ field: accountField, fieldState }) => (
                        <div className="space-y-1">
                          <ComboboxField
                            label={index === 0 ? 'Account' : undefined}
                            options={accountOptions}
                            value={accountField.value}
                            onChange={(value) => accountField.onChange(value ?? '')}
                            placeholder="Select account"
                            allowClear={false}
                          />
                          {fieldState.error ? (
                            <p className="text-xs font-medium text-destructive">{fieldState.error.message}</p>
                          ) : null}
                        </div>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`lines.${index}.description`}
                      render={({ field: descriptionField }) => (
                        <TextField
                          label={index === 0 ? 'Description' : undefined}
                          placeholder="Line memo"
                          {...descriptionField}
                          value={descriptionField.value ?? ''}
                        />
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`lines.${index}.debit`}
                      render={({ field: debitField }) => (
                        <TextField
                          label={index === 0 ? 'Debit' : undefined}
                          type="number"
                          step="any"
                          min={0}
                          className="text-right tabular-nums"
                          {...debitField}
                        />
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`lines.${index}.credit`}
                      render={({ field: creditField }) => (
                        <TextField
                          label={index === 0 ? 'Credit' : undefined}
                          type="number"
                          step="any"
                          min={0}
                          className="text-right tabular-nums"
                          {...creditField}
                        />
                      )}
                    />
                    <div className={cn('flex items-start', index === 0 && 'pt-6')}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={fields.length <= 2}
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {typeof form.formState.errors.lines?.message === 'string' ? (
                <p className="text-xs font-medium text-destructive">{form.formState.errors.lines.message}</p>
              ) : null}
            </div>

            <div
              className={cn(
                'flex flex-wrap items-center justify-between gap-4 rounded-lg border px-4 py-3 text-sm',
                totals.balanced ? 'border-success/40 bg-success/5' : 'border-warning/40 bg-warning/5',
              )}
            >
              <div className="flex items-center gap-2">
                <ArrowLeftRight className={cn('h-4 w-4', totals.balanced ? 'text-success' : 'text-warning')} />
                <span>
                  {totals.balanced
                    ? 'Entry is balanced and ready to post.'
                    : 'Debits must equal credits before the entry can be posted.'}
                </span>
              </div>
              <div className="flex gap-6 tabular-nums">
                <span>
                  Debits <strong>{totals.debit.toFixed(2)}</strong>
                </span>
                <span>
                  Credits <strong>{totals.credit.toFixed(2)}</strong>
                </span>
                <span className={cn(Math.abs(totals.debit - totals.credit) < 0.005 ? 'text-muted-foreground' : 'text-warning')}>
                  Difference <strong>{(totals.debit - totals.credit).toFixed(2)}</strong>
                </span>
              </div>
            </div>

            {accountOptions.length === 0 && !accountsQuery.isLoading ? (
              <EmptyState title="No active accounts" description="Create accounts in the chart of accounts first." />
            ) : null}
          </form>
        </Form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-journal-entry"
            loading={createEntry.isPending}
            disabled={!totals.balanced}
          >
            Post entry
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
