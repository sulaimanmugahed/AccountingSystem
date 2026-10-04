import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Money, SummaryRow } from '@/components/common/misc'
import { useAccounts, useGeneralLedger } from '@/hooks/queries'
import { downloadCsv } from '@/lib/csv'
import { endOfMonth, formatDate, formatMoney, startOfYear } from '@/lib/format'
import { DateRangeControls, ReportPage, ReportTableShell } from '@/features/reports/report-shell'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function GeneralLedgerPage() {
  const accountsQuery = useAccounts()
  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data])

  const [accountId, setAccountId] = useState('')
  const [startDate, setStartDate] = useState(startOfYear())
  const [endDate, setEndDate] = useState(endOfMonth())

  const activeAccountId = accountId || accounts[0]?.id || ''
  const report = useGeneralLedger(activeAccountId, startDate, endDate)

  return (
    <ReportPage
      title="General ledger detail"
      description="Every posted line for one account, with an opening balance and a running balance that respects the account's normal balance."
      onRefresh={() => report.refetch()}
      isLoading={report.isLoading || accountsQuery.isLoading}
      error={report.error ?? accountsQuery.error}
      onExport={() =>
        downloadCsv(
          `general-ledger-${report.data?.accountCode ?? 'account'}-${startDate}-to-${endDate}`,
          ['Date', 'Entry', 'Description', 'Debit', 'Credit', 'Running balance'],
          (report.data?.lines ?? []).map((line) => [
            line.date.slice(0, 10),
            line.entryNumber,
            line.description ?? '',
            line.debit,
            line.credit,
            line.runningBalance,
          ]),
        )
      }
      controls={
        <DateRangeControls from={startDate} to={endDate} onFromChange={setStartDate} onToChange={setEndDate} toLabel="To">
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Account</label>
            <Select value={activeAccountId} onValueChange={setAccountId}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Select an account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.code} · {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </DateRangeControls>
      }
    >
      <ReportTableShell
        footer={
          <div className="space-y-1 border-t bg-muted/40 px-4 py-3">
            <SummaryRow label="Opening balance" value={formatMoney(report.data?.openingBalance ?? 0)} className="max-w-sm" />
            <SummaryRow label="Closing balance" value={formatMoney(report.data?.closingBalance ?? 0)} strong className="max-w-sm" />
          </div>
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/40 px-4 py-3">
          <div>
            <p className="text-sm font-semibold">
              {report.data ? `${report.data.accountCode} · ${report.data.accountName}` : 'Select an account'}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDate(startDate)} → {formatDate(endDate)} · {report.data?.lines.length ?? 0} movement(s)
            </p>
          </div>
          <Badge variant="secondary">Opening {formatMoney(report.data?.openingBalance ?? 0)}</Badge>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Entry</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
              <TableHead className="text-right">Running balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!report.data ? null : report.data.lines.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                  No movements in this period.
                </TableCell>
              </TableRow>
            ) : (
              report.data.lines.map((line, index) => (
                <TableRow key={`${line.journalEntryId}-${index}`}>
                  <TableCell className="whitespace-nowrap">{formatDate(line.date)}</TableCell>
                  <TableCell>
                    <Link
                      to="/gl/journal-entries"
                      className="font-mono text-xs text-primary hover:underline"
                      title="Open the journal entries list"
                    >
                      {line.entryNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{line.description || '—'}</TableCell>
                  <TableCell className="text-right">
                    {line.debit ? <Money value={line.debit} /> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    {line.credit ? <Money value={line.credit} /> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <Money value={line.runningBalance} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ReportTableShell>
    </ReportPage>
  )
}
