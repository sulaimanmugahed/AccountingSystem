import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
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
import { JournalSourceType } from '@/lib/enums'
import { useLabels } from '@/lib/labels'
import { formatDate, formatMoney, today } from '@/lib/format'
import { cn, toNumber } from '@/lib/utils'
import { journalStatusTone, type JournalEntry } from '@/lib/types'

type Translate = (key: string, options?: Record<string, unknown>) => string

const entrySchema = (t: Translate) => {
  const lineSchema = z
    .object({
      accountId: z.string().min(1, t('journal.errChooseAccount')),
      description: z.string().max(200).optional().or(z.literal('')),
      debit: z.coerce.number().min(0, t('journal.errNegative')),
      credit: z.coerce.number().min(0, t('journal.errNegative')),
    })
    .refine((line) => !(line.debit > 0 && line.credit > 0), {
      message: t('journal.errDebitAndCredit'),
      path: ['credit'],
    })
    .refine((line) => line.debit > 0 || line.credit > 0, {
      message: t('journal.errDebitOrCredit'),
      path: ['debit'],
    })

  return z.object({
    entryDate: z.string().min(1, t('journal.errEntryDateRequired')),
    memo: z.string().max(300).optional().or(z.literal('')),
    currencyCode: z.string().min(3).max(3),
    exchangeRateToBase: z.coerce.number().positive(t('journal.errRatePositive')),
    lines: z.array(lineSchema).min(2, t('journal.errMinLines')),
  })
}

type EntryFormValues = z.infer<ReturnType<typeof entrySchema>>

export function JournalEntriesPage() {
  const { t } = useTranslation()
  const labels = useLabels()
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
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('journal.entryNumber')} />,
        cell: ({ row }) => <span className="font-mono text-xs font-medium">{row.original.entryNumber}</span>,
      },
      {
        accessorKey: 'entryDate',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('common.date')} />,
        cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.entryDate)}</span>,
      },
      {
        accessorKey: 'sourceType',
        header: t('journal.source'),
        cell: ({ row }) => (
          <Badge variant="secondary">{labels.journalSourceType[row.original.sourceType]}</Badge>
        ),
      },
      {
        accessorKey: 'memo',
        header: t('common.memo'),
        cell: ({ row }) => (
          <span className="line-clamp-1 max-w-[320px] text-muted-foreground">{row.original.memo || '—'}</span>
        ),
      },
      {
        id: 'accounts',
        header: t('journal.accounts'),
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
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('journal.debit')} align="right" />,
        cell: ({ row }) => (
          <div className="text-right">
            <Money value={row.original.totalDebit} />
          </div>
        ),
      },
      {
        accessorKey: 'totalCredit',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('journal.credit')} align="right" />,
        cell: ({ row }) => (
          <div className="text-right">
            <Money value={row.original.totalCredit} />
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: t('common.status'),
        cell: ({ row }) => (
          <Badge variant={journalStatusTone[row.original.status] ?? 'secondary'}>
            {labels.journalStatus[row.original.status] ?? t('common.dash')}
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
              <Eye className="h-4 w-4" /> {t('common.view')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={!canPost || row.original.status !== 2}
              onClick={() => setEntryToReverse(row.original)}
            >
              <RotateCcw className="h-4 w-4" /> {t('journal.reverse')}
            </Button>
          </div>
        ),
      },
    ],
    [canPost, labels, t],
  )

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('journal.title')}
        description={t('journal.description')}
        breadcrumbs={[{ label: t('nav.groups.generalLedger') }, { label: t('journal.breadcrumb') }]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => entriesQuery.refetch()} loading={entriesQuery.isFetching}>
              <RefreshCw className="h-4 w-4" /> {t('common.refresh')}
            </Button>
            <Button size="sm" disabled={!canPost} onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> {t('journal.newEntry')}
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('journal.entriesInView')}</p>
            <p className="text-2xl font-semibold tabular-nums">{entries.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('journal.posted')}</p>
            <p className="text-2xl font-semibold tabular-nums">{totals.posted}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('journal.totalDebits')}</p>
            <p className="text-2xl font-semibold tabular-nums">
              <Money value={totals.debit} />
            </p>
          </CardContent>
        </Card>
      </div>

      {entriesQuery.error ? (
        <ErrorState error={entriesQuery.error} onRetry={() => entriesQuery.refetch()} title={t('journal.couldNotLoad')} />
      ) : (
        <DataTable
          columns={columns}
          data={entries}
          isLoading={entriesQuery.isLoading}
          searchPlaceholder={t('journal.searchPlaceholder')}
          getRowId={(row) => row.id}
          onRowClick={(row) => setSelected(row)}
          initialSorting={[{ id: 'entryDate', desc: true }]}
          toolbar={
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{t('common.from')}</span>
                <Input
                  type="date"
                  value={fromDate}
                  max={toDate || undefined}
                  onChange={(event) => setFromDate(event.target.value)}
                  className="h-8 w-[150px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{t('common.to')}</span>
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
                  {t('journal.clear')}
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
        title={t('journal.reverseTitle')}
        description={
          entryToReverse
            ? t('journal.reverseDescription', { entry: entryToReverse.entryNumber })
            : undefined
        }
        confirmLabel={t('journal.postReversal')}
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
  const { t } = useTranslation()
  const labels = useLabels()
  return (
    <Dialog open={!!entry} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono">{entry?.entryNumber}</span>
            {entry ? (
              <Badge variant={journalStatusTone[entry.status] ?? 'secondary'}>{labels.journalStatus[entry.status]}</Badge>
            ) : null}
          </DialogTitle>
          <DialogDescription>
            {entry ? `${formatDate(entry.entryDate)} · ${labels.journalSourceType[entry.sourceType]}` : ''}
            {entry?.memo ? ` · ${entry.memo}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">{t('journal.account')}</TableHead>
                <TableHead>{t('common.name')}</TableHead>
                <TableHead>{t('common.description')}</TableHead>
                <TableHead className="text-end">{t('journal.debit')}</TableHead>
                <TableHead className="text-end">{t('journal.credit')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entry?.lines.map((line, index) => (
                <TableRow key={`${line.accountId}-${index}`}>
                  <TableCell className="font-mono text-xs">{line.accountCode}</TableCell>
                  <TableCell>{line.accountName}</TableCell>
                  <TableCell className="text-muted-foreground">{line.description || t('common.dash')}</TableCell>
                  <TableCell className="text-end">
                    {line.debit ? <Money value={line.debit} /> : <span className="text-muted-foreground">{t('common.dash')}</span>}
                  </TableCell>
                  <TableCell className="text-end">
                    {line.credit ? <Money value={line.credit} /> : <span className="text-muted-foreground">{t('common.dash')}</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-2 text-sm">
          <span className="text-muted-foreground">{t('journal.totals')}</span>
          <div className="flex gap-6 tabular-nums">
            <span>{t('journal.debit')} {entry ? <Money value={entry.totalDebit} /> : null}</span>
            <span>{t('journal.credit')} {entry ? <Money value={entry.totalCredit} /> : null}</span>
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
  const { t } = useTranslation()
  const accountsQuery = useAccounts()
  const createEntry = useCreateJournalEntry()

  const form = useForm<EntryFormValues>({
    resolver: zodResolver(entrySchema(t)),
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
  const watchedLines = useWatch({ control: form.control, name: 'lines' })

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
          <DialogTitle>{t('journal.newEntryTitle')}</DialogTitle>
          <DialogDescription>{t('journal.newEntryDescription')}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="create-journal-entry" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-4">
              <FormField
                control={form.control}
                name="entryDate"
                render={({ field }) => <DateField label={t('journal.entryDate')} required {...field} />}
              />
              <FormField
                control={form.control}
                name="currencyCode"
                render={({ field }) => <TextField label={t('common.currency')} maxLength={3} {...field} />}
              />
              <FormField
                control={form.control}
                name="exchangeRateToBase"
                render={({ field }) => (
                  <TextField label={t('common.exchangeRate')} type="number" step="any" className="text-end" {...field} />
                )}
              />
              <FormField
                control={form.control}
                name="memo"
                render={({ field }) => (
                  <TextField label={t('common.memo')} placeholder={t('journal.memoPlaceholder')} {...field} value={field.value ?? ''} />
                )}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{t('journal.lines')}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ accountId: '', description: '', debit: 0, credit: 0 })}
                >
                  <Plus className="h-4 w-4" /> {t('journal.addLine')}
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
                            label={index === 0 ? t('journal.account') : undefined}
                            options={accountOptions}
                            value={accountField.value}
                            onChange={(value) => accountField.onChange(value ?? '')}
                            placeholder={t('journal.selectAccount')}
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
                          label={index === 0 ? t('common.description') : undefined}
                          placeholder={t('journal.lineMemo')}
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
                          label={index === 0 ? t('journal.debit') : undefined}
                          type="number"
                          step="any"
                          min={0}
                          className="text-end tabular-nums"
                          {...debitField}
                        />
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`lines.${index}.credit`}
                      render={({ field: creditField }) => (
                        <TextField
                          label={index === 0 ? t('journal.credit') : undefined}
                          type="number"
                          step="any"
                          min={0}
                          className="text-end tabular-nums"
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
                  {totals.balanced ? t('journal.balanced') : t('journal.unbalanced')}
                </span>
              </div>
              <div className="flex gap-6 tabular-nums">
                <span>
                  {t('journal.debtsLabel')} <strong>{formatMoney(totals.debit)}</strong>
                </span>
                <span>
                  {t('journal.creditsLabel')} <strong>{formatMoney(totals.credit)}</strong>
                </span>
                <span className={cn(Math.abs(totals.debit - totals.credit) < 0.005 ? 'text-muted-foreground' : 'text-warning')}>
                  {t('journal.difference')} <strong>{formatMoney(totals.debit - totals.credit)}</strong>
                </span>
              </div>
            </div>

            {accountOptions.length === 0 && !accountsQuery.isLoading ? (
              <EmptyState title={t('journal.noActiveAccounts')} description={t('journal.noActiveAccountsHint')} />
            ) : null}
          </form>
        </Form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            form="create-journal-entry"
            loading={createEntry.isPending}
            disabled={!totals.balanced}
          >
            {t('journal.postEntry')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
