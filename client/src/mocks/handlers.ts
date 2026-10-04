/**
 * Route handlers for the in-browser mock API — one entry per .NET controller action
 * that the React client calls. Response shapes match the real DTOs.
 */
import {
  AccountType,
  AssetStatus,
  BillStatus,
  DepreciationMethod,
  InvoiceStatus,
  JournalEntryStatus,
  JournalSourceType,
  MockHttpError,
  NormalBalance,
  SYSTEM_KEYS,
  accountByKey,
  applyTax,
  computeInvoiceTotals,
  guid,
  nextNumber,
  postBill,
  postCustomerPayment,
  postEntry,
  postInvoice,
  postVendorPayment,
  round2,
  runDepreciation,
  store,
  type Account,
  type BankTransaction,
  type Bill,
  type BillLine,
  type Company,
  type CustomerPayment,
  type Invoice,
  type InvoiceLine,
  type JournalEntry,
  type User,
  type VendorPayment,
} from '@/mocks/db'

export interface MockContext {
  params: Record<string, string>
  query: URLSearchParams
  body: any
  user: User
}

export interface MockRoute {
  method: string
  pattern: string
  /** false for the login/register endpoints that run before a token exists. */
  auth?: boolean
  handler: (ctx: MockContext) => unknown
}

/* ------------------------------------------------------------------ helpers */

const accountById = (id: string) => store.accounts.find((account) => account.id === id)

function requireAccount(id: string): Account {
  const account = accountById(id)
  if (!account) throw new MockHttpError(400, 'Account not found.')
  return account
}

function toAccountDto(account: Account) {
  return {
    id: account.id,
    code: account.code,
    name: account.name,
    type: account.type,
    subType: account.subType,
    parentAccountId: account.parentAccountId,
    isActive: account.isActive,
    normalBalance: account.normalBalance,
  }
}

function toJournalEntryDto(entry: JournalEntry) {
  return {
    id: entry.id,
    entryNumber: entry.entryNumber,
    entryDate: entry.entryDate,
    status: entry.status,
    sourceType: entry.sourceType,
    memo: entry.memo,
    totalDebit: round2(entry.lines.reduce((sum, line) => sum + line.debit, 0)),
    totalCredit: round2(entry.lines.reduce((sum, line) => sum + line.credit, 0)),
    lines: entry.lines
      .slice()
      .sort((a, b) => a.lineNumber - b.lineNumber)
      .map((line) => ({
        accountId: line.accountId,
        accountCode: accountById(line.accountId)?.code ?? '',
        accountName: accountById(line.accountId)?.name ?? '',
        debit: line.debit,
        credit: line.credit,
        description: line.description,
      })),
  }
}

function toInvoiceDto(invoice: Invoice) {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    customerId: invoice.customerId,
    customerName: store.customers.find((customer) => customer.id === invoice.customerId)?.name ?? '',
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    status: invoice.status,
    subTotal: invoice.subTotal,
    taxTotal: invoice.taxTotal,
    total: invoice.total,
    amountPaid: invoice.amountPaid,
    balance: round2(invoice.total - invoice.amountPaid),
    lines: invoice.lines
      .slice()
      .sort((a, b) => a.lineNumber - b.lineNumber)
      .map((line) => ({
        id: line.id,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountPercent: line.discountPercent,
        taxAmount: line.taxAmount,
        lineTotal: round2(line.quantity * line.unitPrice * (1 - line.discountPercent / 100)),
      })),
  }
}

function toBillDto(bill: Bill) {
  return {
    id: bill.id,
    billNumber: bill.billNumber,
    vendorId: bill.vendorId,
    vendorName: store.vendors.find((vendor) => vendor.id === bill.vendorId)?.name ?? '',
    billDate: bill.billDate,
    dueDate: bill.dueDate,
    status: bill.status,
    subTotal: bill.subTotal,
    taxTotal: bill.taxTotal,
    total: bill.total,
    amountPaid: bill.amountPaid,
    balance: round2(bill.total - bill.amountPaid),
    lines: bill.lines
      .slice()
      .sort((a, b) => a.lineNumber - b.lineNumber)
      .map((line) => ({
        id: line.id,
        description: line.description,
        quantity: line.quantity,
        unitCost: line.unitCost,
        taxAmount: line.taxAmount,
        lineTotal: round2(line.quantity * line.unitCost),
      })),
  }
}

const postedLines = (fromDate: string | null, toDate: string) =>
  store.journalEntries
    .filter(
      (entry) =>
        entry.status === JournalEntryStatus.Posted &&
        new Date(entry.entryDate).getTime() <= new Date(toDate).getTime() &&
        (!fromDate || new Date(entry.entryDate).getTime() >= new Date(fromDate).getTime()),
    )
    .flatMap((entry) => entry.lines.map((line) => ({ ...line, entry })))

function balanceAsOf(accountIds: string[], asOf: string, creditNormal: boolean) {
  const ids = new Set(accountIds)
  return round2(
    postedLines(null, asOf)
      .filter((line) => ids.has(line.accountId))
      .reduce((sum, line) => sum + (creditNormal ? line.credit - line.debit : line.debit - line.credit), 0),
  )
}

const emptyBucket = () => ({ current: 0, days1To30: 0, days31To60: 0, days61To90: 0, over90: 0 })

function buildAging(
  rows: Array<{ partyId: string; partyName: string; dueDate: string; balance: number }>,
  asOfDate: string,
) {
  const grouped = new Map<string, { partyId: string; partyName: string; totalDue: number; buckets: ReturnType<typeof emptyBucket> }>()
  for (const row of rows) {
    if (row.balance === 0) continue
    const entry =
      grouped.get(row.partyId) ?? { partyId: row.partyId, partyName: row.partyName, totalDue: 0, buckets: emptyBucket() }
    const daysPastDue = Math.round(
      (new Date(new Date(asOfDate).toDateString()).getTime() - new Date(new Date(row.dueDate).toDateString()).getTime()) /
        86_400_000,
    )
    if (daysPastDue <= 0) entry.buckets.current += row.balance
    else if (daysPastDue <= 30) entry.buckets.days1To30 += row.balance
    else if (daysPastDue <= 60) entry.buckets.days31To60 += row.balance
    else if (daysPastDue <= 90) entry.buckets.days61To90 += row.balance
    else entry.buckets.over90 += row.balance
    entry.totalDue = round2(entry.totalDue + row.balance)
    grouped.set(row.partyId, entry)
  }
  return [...grouped.values()]
    .map((row) => ({
      ...row,
      totalDue: round2(row.totalDue),
      buckets: {
        current: round2(row.buckets.current),
        days1To30: round2(row.buckets.days1To30),
        days31To60: round2(row.buckets.days31To60),
        days61To90: round2(row.buckets.days61To90),
        over90: round2(row.buckets.over90),
      },
    }))
    .filter((row) => row.totalDue !== 0)
    .sort((a, b) => b.totalDue - a.totalDue)
}

function findInvoice(id: string) {
  const invoice = store.invoices.find((candidate) => candidate.id === id)
  if (!invoice) throw new MockHttpError(404, 'Invoice not found.')
  return invoice
}

function findBill(id: string) {
  const bill = store.bills.find((candidate) => candidate.id === id)
  if (!bill) throw new MockHttpError(404, 'Bill not found.')
  return bill
}

function reverseEntry(sourceType: number, sourceId: string, memo: string, reversalDate: string) {
  const original = store.journalEntries.find(
    (entry) => entry.sourceId === sourceId && entry.sourceType === sourceType && !entry.isReversed,
  )
  if (!original) return null
  const reversal = postEntry({
    entryDate: reversalDate,
    sourceType: JournalSourceType.Adjustment,
    sourceId: original.id,
    memo,
    lines: original.lines.map((line) => ({
      accountId: line.accountId,
      debit: line.credit,
      credit: line.debit,
      description: line.description ?? undefined,
    })),
  })
  reversal.reversalOfEntryId = original.id
  original.isReversed = true
  return reversal
}

/* ------------------------------------------------------------------- routes */

export const routes: MockRoute[] = [
  /* ------------------------------------------------------------------- auth */
  {
    method: 'POST',
    pattern: '/auth/login',
    auth: false,
    handler: ({ body }) => {
      const user = store.users.find((candidate) => candidate.email.toLowerCase() === String(body?.email ?? '').toLowerCase())
      if (!user || user.password !== body?.password || !user.isActive) {
        throw new MockHttpError(401, 'Invalid credentials.')
      }
      const payload = btoa(JSON.stringify({ sub: user.id, email: user.email, exp: Date.now() + 7200_000 }))
      return {
        token: `mock.${payload}.${user.id.slice(0, 8)}`,
        email: user.email,
        fullName: user.fullName,
        companyId: user.companyId,
        roles: user.roles,
      }
    },
  },
  {
    method: 'POST',
    pattern: '/auth/register',
    handler: ({ body, user }) => {
      if (!user.roles.includes('Admin')) throw new MockHttpError(403, 'Only administrators can register users.')
      if (store.users.some((candidate) => candidate.email.toLowerCase() === String(body.email).toLowerCase())) {
        throw new MockHttpError(400, 'That email address is already registered.', {
          errors: { Email: ['That email address is already registered.'] },
        })
      }
      const created: User = {
        id: guid('1a0b'),
        email: body.email,
        password: body.password,
        fullName: body.fullName,
        companyId: user.companyId,
        roles: [body.role ?? 'Viewer'],
        isActive: true,
      }
      store.users.push(created)
      return { id: created.id, email: created.email }
    },
  },

  /* --------------------------------------------------------------- companies */
  { method: 'GET', pattern: '/companies/current', handler: () => store.company as Company },

  /* ---------------------------------------------------------------- accounts */
  {
    method: 'GET',
    pattern: '/accounts',
    handler: ({ query }) => {
      const includeInactive = query.get('includeInactive') === 'true'
      return store.accounts
        .filter((account) => includeInactive || account.isActive)
        .sort((a, b) => a.code.localeCompare(b.code))
        .map(toAccountDto)
    },
  },
  {
    method: 'GET',
    pattern: '/accounts/:id',
    handler: ({ params }) => {
      const account = accountById(params.id)
      if (!account) throw new MockHttpError(404, 'Account not found.')
      return toAccountDto(account)
    },
  },
  {
    method: 'POST',
    pattern: '/accounts',
    handler: ({ body }) => {
      if (store.accounts.some((account) => account.code.toLowerCase() === String(body.code).toLowerCase())) {
        throw new MockHttpError(400, `Account code ${body.code} is already in use.`)
      }
      if (!body.name || String(body.name).trim().length < 2) {
        throw new MockHttpError(400, 'Account name is required.', { errors: { Name: ['Account name is required.'] } })
      }
      const account: Account = {
        id: guid('1a0a'),
        companyId: store.company.id,
        code: body.code,
        name: body.name,
        description: body.description ?? null,
        type: Number(body.type),
        subType: body.subType ?? null,
        parentAccountId: body.parentAccountId ?? null,
        isActive: true,
        isSystemAccount: false,
        systemAccountKey: null,
        normalBalance:
          Number(body.type) === AccountType.Asset || Number(body.type) === AccountType.Expense
            ? NormalBalance.Debit
            : NormalBalance.Credit,
      }
      store.accounts.push(account)
      return toAccountDto(account)
    },
  },
  {
    method: 'DELETE',
    pattern: '/accounts/:id',
    handler: ({ params }) => {
      const account = requireAccount(params.id)
      if (account.isSystemAccount)
        throw new MockHttpError(400, 'System accounts cannot be deactivated — the posting engine depends on them.')
      const hasActivity = postedLines(null, new Date().toISOString()).some((line) => line.accountId === account.id)
      if (hasActivity)
        throw new MockHttpError(400, 'This account has posted activity and cannot be deactivated.')
      account.isActive = false
      return null
    },
  },

  /* --------------------------------------------------------- journal entries */
  {
    method: 'GET',
    pattern: '/journalentries',
    handler: ({ query }) => {
      const from = query.get('from')
      const to = query.get('to')
      return store.journalEntries
        .filter((entry) => {
          const time = new Date(entry.entryDate).getTime()
          if (from && time < new Date(from).getTime()) return false
          if (to && time > new Date(to).getTime()) return false
          return true
        })
        .sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime())
        .slice(0, 200)
        .map(toJournalEntryDto)
    },
  },
  {
    method: 'GET',
    pattern: '/journalentries/:id',
    handler: ({ params }) => {
      const entry = store.journalEntries.find((candidate) => candidate.id === params.id)
      if (!entry) throw new MockHttpError(404, 'Journal entry not found.')
      return toJournalEntryDto(entry)
    },
  },
  {
    method: 'POST',
    pattern: '/journalentries',
    handler: ({ body, user }) => {
      const lines = (body.lines ?? []).map((line: any) => ({
        accountId: line.accountId,
        debit: Number(line.debit ?? 0),
        credit: Number(line.credit ?? 0),
        description: line.description ?? undefined,
      }))
      const entry = postEntry({
        entryDate: body.entryDate,
        sourceType: Number(body.sourceType ?? JournalSourceType.Manual),
        memo: body.memo ?? null,
        lines,
        postedBy: user.fullName,
        currencyCode: body.currencyCode ?? 'USD',
        exchangeRateToBase: Number(body.exchangeRateToBase ?? 1),
      })
      return toJournalEntryDto(entry)
    },
  },
  {
    method: 'POST',
    pattern: '/journalentries/:id/reverse',
    handler: ({ params, query, user }) => {
      const original = store.journalEntries.find((candidate) => candidate.id === params.id)
      if (!original) throw new MockHttpError(404, 'Journal entry not found.')
      if (original.isReversed) throw new MockHttpError(400, 'This entry has already been reversed.')
      if (original.status !== JournalEntryStatus.Posted)
        throw new MockHttpError(400, 'Only posted entries can be reversed.')

      const reversalDate = query.get('reversalDate') ?? new Date().toISOString()
      const reversal = postEntry({
        entryDate: reversalDate,
        sourceType: JournalSourceType.Adjustment,
        sourceId: original.id,
        memo: `Reversal of ${original.entryNumber}`,
        lines: original.lines.map((line) => ({
          accountId: line.accountId,
          debit: line.credit,
          credit: line.debit,
          description: line.description ?? undefined,
        })),
        postedBy: user.fullName,
      })
      reversal.reversalOfEntryId = original.id
      original.isReversed = true
      return toJournalEntryDto(reversal)
    },
  },

  /* --------------------------------------------------------------- customers */
  {
    method: 'GET',
    pattern: '/customers',
    handler: ({ query }) => {
      const includeInactive = query.get('includeInactive') === 'true'
      return store.customers
        .filter((customer) => includeInactive || customer.isActive)
        .sort((a, b) => a.name.localeCompare(b.name))
    },
  },
  {
    method: 'GET',
    pattern: '/customers/:id',
    handler: ({ params }) => {
      const customer = store.customers.find((candidate) => candidate.id === params.id)
      if (!customer) throw new MockHttpError(404, 'Customer not found.')
      return customer
    },
  },
  {
    method: 'POST',
    pattern: '/customers',
    handler: ({ body }) => {
      if (store.customers.some((customer) => customer.code.toLowerCase() === String(body.code).toLowerCase())) {
        throw new MockHttpError(400, 'That customer code is already in use.')
      }
      const customer = {
        id: guid('1c0a'),
        companyId: store.company.id,
        code: body.code,
        name: body.name,
        email: body.email ?? null,
        phone: body.phone ?? null,
        paymentTermsDays: Number(body.paymentTermsDays ?? 30),
        creditLimit: Number(body.creditLimit ?? 0),
        taxExempt: false,
        currencyCode: body.currencyCode ?? 'USD',
        isActive: true,
        notes: null,
      }
      store.customers.push(customer)
      return customer
    },
  },
  {
    method: 'PUT',
    pattern: '/customers/:id',
    handler: ({ params, body }) => {
      const customer = store.customers.find((candidate) => candidate.id === params.id)
      if (!customer) throw new MockHttpError(404, 'Customer not found.')
      Object.assign(customer, {
        code: body.code,
        name: body.name,
        email: body.email ?? null,
        phone: body.phone ?? null,
        paymentTermsDays: Number(body.paymentTermsDays ?? 30),
        creditLimit: Number(body.creditLimit ?? 0),
        currencyCode: body.currencyCode ?? 'USD',
      })
      return null
    },
  },
  {
    method: 'DELETE',
    pattern: '/customers/:id',
    handler: ({ params }) => {
      const customer = store.customers.find((candidate) => candidate.id === params.id)
      if (!customer) throw new MockHttpError(404, 'Customer not found.')
      customer.isActive = false
      return null
    },
  },

  /* ----------------------------------------------------------------- vendors */
  {
    method: 'GET',
    pattern: '/vendors',
    handler: ({ query }) => {
      const includeInactive = query.get('includeInactive') === 'true'
      return store.vendors
        .filter((vendor) => includeInactive || vendor.isActive)
        .sort((a, b) => a.name.localeCompare(b.name))
    },
  },
  {
    method: 'GET',
    pattern: '/vendors/:id',
    handler: ({ params }) => {
      const vendor = store.vendors.find((candidate) => candidate.id === params.id)
      if (!vendor) throw new MockHttpError(404, 'Vendor not found.')
      return vendor
    },
  },
  {
    method: 'POST',
    pattern: '/vendors',
    handler: ({ body }) => {
      if (store.vendors.some((vendor) => vendor.code.toLowerCase() === String(body.code).toLowerCase())) {
        throw new MockHttpError(400, 'That vendor code is already in use.')
      }
      const vendor = {
        id: guid('1d0a'),
        companyId: store.company.id,
        code: body.code,
        name: body.name,
        email: body.email ?? null,
        phone: body.phone ?? null,
        paymentTermsDays: Number(body.paymentTermsDays ?? 30),
        currencyCode: body.currencyCode ?? 'USD',
        is1099Vendor: !!body.is1099Vendor,
        isActive: true,
      }
      store.vendors.push(vendor)
      return vendor
    },
  },
  {
    method: 'PUT',
    pattern: '/vendors/:id',
    handler: ({ params, body }) => {
      const vendor = store.vendors.find((candidate) => candidate.id === params.id)
      if (!vendor) throw new MockHttpError(404, 'Vendor not found.')
      Object.assign(vendor, {
        code: body.code,
        name: body.name,
        email: body.email ?? null,
        phone: body.phone ?? null,
        paymentTermsDays: Number(body.paymentTermsDays ?? 30),
        currencyCode: body.currencyCode ?? 'USD',
        is1099Vendor: !!body.is1099Vendor,
      })
      return null
    },
  },
  {
    method: 'DELETE',
    pattern: '/vendors/:id',
    handler: ({ params }) => {
      const vendor = store.vendors.find((candidate) => candidate.id === params.id)
      if (!vendor) throw new MockHttpError(404, 'Vendor not found.')
      vendor.isActive = false
      return null
    },
  },

  /* ---------------------------------------------------------------- invoices */
  {
    method: 'GET',
    pattern: '/invoices',
    handler: ({ query }) => {
      const customerId = query.get('customerId')
      return store.invoices
        .filter((invoice) => !customerId || invoice.customerId === customerId)
        .sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime())
        .map(toInvoiceDto)
    },
  },
  {
    method: 'GET',
    pattern: '/invoices/:id',
    handler: ({ params }) => toInvoiceDto(findInvoice(params.id)),
  },
  {
    method: 'POST',
    pattern: '/invoices',
    handler: ({ body }) => {
      if (!body.customerId) throw new MockHttpError(400, 'A customer is required.', { errors: { CustomerId: ['A customer is required.'] } })
      const rawLines: any[] = body.lines ?? []
      if (!rawLines.length) throw new MockHttpError(400, 'An invoice needs at least one line.')
      if (rawLines.some((line) => !line.description || Number(line.quantity) <= 0)) {
        throw new MockHttpError(400, 'Each invoice line needs a description and a positive quantity.')
      }

      const invoice: Invoice = {
        id: guid('1a0c'),
        companyId: store.company.id,
        invoiceNumber: nextNumber('INV', 'INV'),
        customerId: body.customerId,
        invoiceDate: body.invoiceDate,
        dueDate: body.dueDate,
        status: InvoiceStatus.Draft,
        currencyCode: body.currencyCode ?? 'USD',
        exchangeRateToBase: Number(body.exchangeRateToBase ?? 1),
        subTotal: 0,
        taxTotal: 0,
        total: 0,
        amountPaid: 0,
        memo: body.memo ?? null,
        terms: body.terms ?? null,
        journalEntryId: null,
        lines: [],
      }

      invoice.lines = rawLines.map<InvoiceLine>((line, index) => {
        const gross = round2(Number(line.quantity) * Number(line.unitPrice) * (1 - Number(line.discountPercent ?? 0) / 100))
        return {
          id: guid('11e2'),
          invoiceId: invoice.id,
          lineNumber: index + 1,
          itemId: line.itemId ?? null,
          description: line.description,
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
          discountPercent: Number(line.discountPercent ?? 0),
          taxCodeId: line.taxCodeId ?? null,
          taxAmount: applyTax(gross, line.taxCodeId),
          lineTotal: gross,
          revenueAccountId: line.revenueAccountId ?? null,
        }
      })

      const totals = computeInvoiceTotals(invoice.lines)
      invoice.subTotal = totals.subTotal
      invoice.taxTotal = totals.taxTotal
      invoice.total = totals.total
      store.invoices.push(invoice)
      return toInvoiceDto(invoice)
    },
  },
  {
    method: 'POST',
    pattern: '/invoices/:id/post',
    handler: ({ params, user }) => {
      const invoice = findInvoice(params.id)
      if (invoice.status !== InvoiceStatus.Draft) throw new MockHttpError(400, 'Only draft invoices can be posted.')
      postInvoice(invoice, user.fullName)
      return toInvoiceDto(invoice)
    },
  },
  {
    method: 'POST',
    pattern: '/invoices/:id/void',
    handler: ({ params, user }) => {
      const invoice = findInvoice(params.id)
      if (invoice.status === InvoiceStatus.Voided) throw new MockHttpError(400, 'Invoice is already voided.')
      if (invoice.amountPaid > 0) throw new MockHttpError(400, 'Invoices with applied payments cannot be voided.')
      if (invoice.status !== InvoiceStatus.Draft) {
        reverseEntry(JournalSourceType.SalesInvoice, invoice.id, `Void invoice ${invoice.invoiceNumber}`, new Date().toISOString())
      }
      invoice.status = InvoiceStatus.Voided
      void user
      return null
    },
  },

  /* ------------------------------------------------------------------- bills */
  {
    method: 'GET',
    pattern: '/bills',
    handler: ({ query }) => {
      const vendorId = query.get('vendorId')
      return store.bills
        .filter((bill) => !vendorId || bill.vendorId === vendorId)
        .sort((a, b) => new Date(b.billDate).getTime() - new Date(a.billDate).getTime())
        .map(toBillDto)
    },
  },
  { method: 'GET', pattern: '/bills/:id', handler: ({ params }) => toBillDto(findBill(params.id)) },
  {
    method: 'POST',
    pattern: '/bills',
    handler: ({ body }) => {
      if (!body.vendorId) throw new MockHttpError(400, 'A vendor is required.', { errors: { VendorId: ['A vendor is required.'] } })
      const rawLines: any[] = body.lines ?? []
      if (!rawLines.length) throw new MockHttpError(400, 'A bill needs at least one line.')
      if (rawLines.some((line) => !line.description || Number(line.quantity) <= 0)) {
        throw new MockHttpError(400, 'Each bill line needs a description and a positive quantity.')
      }

      const bill: Bill = {
        id: guid('1b0d'),
        companyId: store.company.id,
        billNumber: nextNumber('BILL', 'BILL'),
        vendorInvoiceNumber: body.vendorInvoiceNumber ?? null,
        vendorId: body.vendorId,
        billDate: body.billDate,
        dueDate: body.dueDate,
        status: BillStatus.Draft,
        currencyCode: body.currencyCode ?? 'USD',
        exchangeRateToBase: Number(body.exchangeRateToBase ?? 1),
        subTotal: 0,
        taxTotal: 0,
        total: 0,
        amountPaid: 0,
        memo: body.memo ?? null,
        journalEntryId: null,
        lines: [],
      }

      bill.lines = rawLines.map<BillLine>((line, index) => {
        const net = round2(Number(line.quantity) * Number(line.unitCost))
        return {
          id: guid('1b0c'),
          billId: bill.id,
          lineNumber: index + 1,
          itemId: line.itemId ?? null,
          description: line.description,
          quantity: Number(line.quantity),
          unitCost: Number(line.unitCost),
          taxCodeId: line.taxCodeId ?? null,
          taxAmount: applyTax(net, line.taxCodeId),
          lineTotal: net,
          expenseAccountId: line.expenseAccountId ?? null,
        }
      })

      bill.subTotal = round2(bill.lines.reduce((sum, line) => sum + line.lineTotal, 0))
      bill.taxTotal = round2(bill.lines.reduce((sum, line) => sum + line.taxAmount, 0))
      bill.total = round2(bill.subTotal + bill.taxTotal)
      store.bills.push(bill)
      return toBillDto(bill)
    },
  },
  {
    method: 'POST',
    pattern: '/bills/:id/post',
    handler: ({ params, user }) => {
      const bill = findBill(params.id)
      if (bill.status !== BillStatus.Draft) throw new MockHttpError(400, 'Only draft bills can be posted.')
      postBill(bill, user.fullName)
      return toBillDto(bill)
    },
  },
  {
    method: 'POST',
    pattern: '/bills/:id/void',
    handler: ({ params }) => {
      const bill = findBill(params.id)
      if (bill.status === BillStatus.Voided) throw new MockHttpError(400, 'Bill is already voided.')
      if (bill.amountPaid > 0) throw new MockHttpError(400, 'Bills with applied payments cannot be voided.')
      if (bill.status !== BillStatus.Draft) {
        reverseEntry(JournalSourceType.VendorBill, bill.id, `Void bill ${bill.billNumber}`, new Date().toISOString())
      }
      bill.status = BillStatus.Voided
      return null
    },
  },

  /* --------------------------------------------------------- customer payments */
  {
    method: 'GET',
    pattern: '/customerpayments',
    handler: ({ query }) => {
      const customerId = query.get('customerId')
      return store.customerPayments
        .filter((payment) => !customerId || payment.customerId === customerId)
        .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
        .slice(0, 200)
        .map((payment) => ({
          id: payment.id,
          paymentNumber: payment.paymentNumber,
          customerId: payment.customerId,
          paymentDate: payment.paymentDate,
          amount: payment.amount,
          unappliedAmount: payment.unappliedAmount,
        }))
    },
  },
  {
    method: 'POST',
    pattern: '/customerpayments',
    handler: ({ body, user }) => {
      const amount = round2(Number(body.amount))
      if (!(amount > 0)) throw new MockHttpError(400, 'Payment amount must be greater than zero.')
      const applications = (body.applications ?? []).map((application: any) => ({
        id: guid('1a0e'),
        invoiceId: application.invoiceId,
        amountApplied: round2(Number(application.amount)),
      }))
      const applied = round2(applications.reduce((sum: number, application: any) => sum + application.amountApplied, 0))
      if (applied > amount) throw new MockHttpError(400, 'Applied amount cannot exceed the payment amount.')

      for (const application of applications) {
        const invoice = findInvoice(application.invoiceId)
        const open = round2(invoice.total - invoice.amountPaid)
        if (application.amountApplied > open)
          throw new MockHttpError(400, `Invoice ${invoice.invoiceNumber} only has ${open.toFixed(2)} open.`)
      }

      const payment: CustomerPayment = {
        id: guid('1a0d'),
        companyId: store.company.id,
        paymentNumber: nextNumber('CP', 'PMT'),
        customerId: body.customerId,
        paymentDate: body.paymentDate,
        amount,
        method: Number(body.method ?? 3),
        referenceNumber: body.referenceNumber ?? null,
        bankAccountId: body.bankAccountId,
        currencyCode: 'USD',
        unappliedAmount: round2(amount - applied),
        journalEntryId: null,
        memo: body.memo ?? null,
        applications,
      }
      store.customerPayments.push(payment)
      postCustomerPayment(payment, user.fullName)
      return {
        id: payment.id,
        paymentNumber: payment.paymentNumber,
        customerId: payment.customerId,
        paymentDate: payment.paymentDate,
        amount: payment.amount,
        unappliedAmount: payment.unappliedAmount,
      }
    },
  },

  /* ----------------------------------------------------------- vendor payments */
  {
    method: 'GET',
    pattern: '/vendorpayments',
    handler: ({ query }) => {
      const vendorId = query.get('vendorId')
      return store.vendorPayments
        .filter((payment) => !vendorId || payment.vendorId === vendorId)
        .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
        .slice(0, 200)
        .map((payment) => ({
          id: payment.id,
          paymentNumber: payment.paymentNumber,
          vendorId: payment.vendorId,
          paymentDate: payment.paymentDate,
          amount: payment.amount,
          unappliedAmount: payment.unappliedAmount,
        }))
    },
  },
  {
    method: 'POST',
    pattern: '/vendorpayments',
    handler: ({ body, user }) => {
      const amount = round2(Number(body.amount))
      if (!(amount > 0)) throw new MockHttpError(400, 'Payment amount must be greater than zero.')
      const applications = (body.applications ?? []).map((application: any) => ({
        id: guid('1b0f'),
        billId: application.billId,
        amountApplied: round2(Number(application.amount)),
      }))
      const applied = round2(applications.reduce((sum: number, application: any) => sum + application.amountApplied, 0))
      if (applied > amount) throw new MockHttpError(400, 'Applied amount cannot exceed the payment amount.')

      const payment: VendorPayment = {
        id: guid('1b0e'),
        companyId: store.company.id,
        paymentNumber: nextNumber('VP', 'VPMT'),
        vendorId: body.vendorId,
        paymentDate: body.paymentDate,
        amount,
        method: Number(body.method ?? 3),
        referenceNumber: body.referenceNumber ?? null,
        bankAccountId: body.bankAccountId,
        currencyCode: 'USD',
        unappliedAmount: round2(amount - applied),
        journalEntryId: null,
        memo: body.memo ?? null,
        applications,
      }
      store.vendorPayments.push(payment)
      postVendorPayment(payment, user.fullName)
      return {
        id: payment.id,
        paymentNumber: payment.paymentNumber,
        vendorId: payment.vendorId,
        paymentDate: payment.paymentDate,
        amount: payment.amount,
        unappliedAmount: payment.unappliedAmount,
      }
    },
  },

  /* ------------------------------------------------------------ bank accounts */
  { method: 'GET', pattern: '/bankaccounts', handler: () => store.bankAccounts.filter((account) => account.isActive) },
  {
    method: 'POST',
    pattern: '/bankaccounts',
    handler: ({ body }) => {
      const account = {
        id: guid('1e0a'),
        companyId: store.company.id,
        name: body.name,
        bankName: body.bankName ?? null,
        accountNumberMasked: body.accountNumberMasked ?? null,
        glAccountId: body.glAccountId,
        currencyCode: body.currencyCode ?? 'USD',
        openingBalance: round2(Number(body.openingBalance ?? 0)),
        openingBalanceDate: body.openingBalanceDate,
        isActive: true,
      }
      store.bankAccounts.push(account)
      if (account.openingBalance > 0) {
        postEntry({
          entryDate: account.openingBalanceDate,
          sourceType: JournalSourceType.OpeningBalance,
          sourceId: account.id,
          memo: `Opening balance for bank account ${account.name}`,
          lines: [
            { accountId: account.glAccountId, debit: account.openingBalance, description: account.name },
            { accountId: accountByKey(SYSTEM_KEYS.OpeningBalanceEquity).id, credit: account.openingBalance },
          ],
        })
      }
      return account
    },
  },
  {
    method: 'GET',
    pattern: '/bankaccounts/:id/transactions',
    handler: ({ params }) =>
      store.bankTransactions
        .filter((transaction) => transaction.bankAccountId === params.id)
        .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime())
        .slice(0, 500),
  },
  {
    method: 'POST',
    pattern: '/bankaccounts/:id/transactions',
    handler: ({ params, body }) => {
      const bankAccount = store.bankAccounts.find((candidate) => candidate.id === params.id)
      if (!bankAccount) throw new MockHttpError(404, 'Bank account not found.')
      const transaction: BankTransaction = {
        id: guid('1c0a'),
        bankAccountId: params.id,
        transactionDate: body.transactionDate,
        description: body.description,
        type: Number(body.type),
        amount: round2(Number(body.amount)),
        referenceNumber: body.referenceNumber ?? null,
        journalEntryId: null,
        isReconciled: false,
        bankReconciliationId: null,
      }
      store.bankTransactions.push(transaction)

      // Deposits/interest increase cash; withdrawals, transfers and fees reduce it.
      const increasesCash = transaction.type === 1 || transaction.type === 5
      const entry = postEntry({
        entryDate: transaction.transactionDate,
        sourceType: JournalSourceType.BankTransaction,
        sourceId: transaction.id,
        memo: `Bank transaction — ${transaction.description}`,
        lines: increasesCash
          ? [
              { accountId: bankAccount.glAccountId, debit: transaction.amount, description: transaction.description },
              { accountId: accountByKey(SYSTEM_KEYS.DefaultSalesRevenue).id, credit: transaction.amount },
            ]
          : [
              { accountId: accountByCodeSafe('6900'), debit: transaction.amount, description: transaction.description },
              { accountId: bankAccount.glAccountId, credit: transaction.amount },
            ],
      })
      transaction.journalEntryId = entry.id
      return transaction
    },
  },
  {
    method: 'POST',
    pattern: '/bankaccounts/:id/reconciliations',
    handler: ({ params, body }) => {
      const bankAccount = store.bankAccounts.find((candidate) => candidate.id === params.id)
      if (!bankAccount) throw new MockHttpError(404, 'Bank account not found.')
      const reconciliation = {
        id: guid('1f1c'),
        bankAccountId: params.id,
        statementDate: body.statementDate,
        statementBeginningBalance: round2(Number(body.statementBeginningBalance)),
        statementEndingBalance: round2(Number(body.statementEndingBalance)),
        isCompleted: false,
        completedAtUtc: null,
        completedBy: null,
      }
      store.reconciliations.push(reconciliation)
      return reconciliation
    },
  },
  {
    method: 'POST',
    pattern: '/bankaccounts/reconciliations/:reconciliationId/transactions/:transactionId/clear',
    handler: ({ params }) => {
      const transaction = store.bankTransactions.find((candidate) => candidate.id === params.transactionId)
      if (!transaction) throw new MockHttpError(404, 'Bank transaction not found.')
      transaction.isReconciled = true
      transaction.bankReconciliationId = params.reconciliationId
      return null
    },
  },
  {
    method: 'POST',
    pattern: '/bankaccounts/reconciliations/:reconciliationId/complete',
    handler: ({ params, user }) => {
      const reconciliation = store.reconciliations.find((candidate) => candidate.id === params.reconciliationId)
      if (!reconciliation) throw new MockHttpError(404, 'Reconciliation not found.')
      reconciliation.isCompleted = true
      reconciliation.completedAtUtc = new Date().toISOString()
      reconciliation.completedBy = user.fullName
      return reconciliation
    },
  },

  /* ------------------------------------------------------------------- items */
  {
    method: 'GET',
    pattern: '/items',
    handler: ({ query }) => {
      const includeInactive = query.get('includeInactive') === 'true'
      return store.items
        .filter((item) => includeInactive || item.isActive)
        .sort((a, b) => a.name.localeCompare(b.name))
    },
  },
  {
    method: 'GET',
    pattern: '/items/:id',
    handler: ({ params }) => {
      const item = store.items.find((candidate) => candidate.id === params.id)
      if (!item) throw new MockHttpError(404, 'Item not found.')
      return item
    },
  },
  {
    method: 'POST',
    pattern: '/items',
    handler: ({ body }) => {
      if (store.items.some((item) => item.sku.toLowerCase() === String(body.sku).toLowerCase())) {
        throw new MockHttpError(400, 'That SKU is already in use.', { errors: { Sku: ['That SKU is already in use.'] } })
      }
      const item = {
        id: guid('1f0a'),
        companyId: store.company.id,
        sku: body.sku,
        name: body.name,
        description: body.description ?? null,
        type: Number(body.type),
        salesPrice: round2(Number(body.salesPrice ?? 0)),
        purchaseCost: round2(Number(body.purchaseCost ?? 0)),
        incomeAccountId: body.incomeAccountId ?? null,
        expenseAccountId: body.expenseAccountId ?? null,
        inventoryAssetAccountId: body.inventoryAssetAccountId ?? null,
        valuationMethod: 2,
        quantityOnHand: 0,
        averageCost: round2(Number(body.purchaseCost ?? 0)),
        reorderPoint: round2(Number(body.reorderPoint ?? 0)),
        defaultTaxCodeId: body.defaultTaxCodeId ?? null,
        isActive: true,
      }
      store.items.push(item)
      return item
    },
  },
  {
    method: 'DELETE',
    pattern: '/items/:id',
    handler: ({ params }) => {
      const item = store.items.find((candidate) => candidate.id === params.id)
      if (!item) throw new MockHttpError(404, 'Item not found.')
      item.isActive = false
      return null
    },
  },
  {
    method: 'GET',
    pattern: '/items/:id/stock-transactions',
    handler: ({ params }) =>
      store.stockTransactions
        .filter((transaction) => transaction.itemId === params.id)
        .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime()),
  },

  /* ------------------------------------------------------------ fixed assets */
  { method: 'GET', pattern: '/fixedassets', handler: () => store.fixedAssets },
  {
    method: 'POST',
    pattern: '/fixedassets',
    handler: ({ body }) => {
      const asset = {
        id: guid('1a0f'),
        companyId: store.company.id,
        code: body.code,
        name: body.name,
        acquisitionDate: body.acquisitionDate,
        acquisitionCost: round2(Number(body.acquisitionCost)),
        salvageValue: round2(Number(body.salvageValue)),
        usefulLifeMonths: Number(body.usefulLifeMonths),
        method: Number(body.method ?? DepreciationMethod.StraightLine),
        decliningBalanceRatePercent: null as number | null,
        assetAccountId: body.assetAccountId,
        accumulatedDepreciationAccountId: body.accumulatedDepreciationAccountId,
        depreciationExpenseAccountId: body.depreciationExpenseAccountId,
        status: AssetStatus.Active,
        disposalDate: null as string | null,
        disposalProceeds: null as number | null,
        accumulatedDepreciation: 0,
        depreciationEntries: [] as { id: string; periodDate: string; amount: number }[],
      }
      store.fixedAssets.push(asset)
      return asset
    },
  },
  {
    method: 'POST',
    pattern: '/fixedassets/run-depreciation',
    handler: ({ query }) => {
      const periodEnd = query.get('periodEndDate')
      if (!periodEnd) throw new MockHttpError(400, 'periodEndDate is required.')
      return { assetsDepreciated: runDepreciation(periodEnd) }
    },
  },
  {
    method: 'POST',
    pattern: '/fixedassets/:id/dispose',
    handler: ({ params, body, user }) => {
      const asset = store.fixedAssets.find((candidate) => candidate.id === params.id)
      if (!asset) throw new MockHttpError(404, 'Asset not found.')
      if (asset.status === AssetStatus.Disposed) throw new MockHttpError(400, 'Asset is already disposed.')

      // Mirrors FixedAssetService.DisposeAssetAsync: the .NET API only flags the asset,
      // it does not post a disposal journal entry.
      asset.status = AssetStatus.Disposed
      asset.disposalDate = body.disposalDate
      asset.disposalProceeds = round2(Number(body.proceeds ?? 0))
      void user
      return null
    },
  },

  /* ----------------------------------------------------------------- budgets */
  { method: 'GET', pattern: '/budgets', handler: () => store.budgets },
  {
    method: 'POST',
    pattern: '/budgets',
    handler: ({ body }) => {
      const budget = {
        id: guid('1b0a'),
        companyId: store.company.id,
        name: body.name,
        fiscalYearId: body.fiscalYearId,
        isActive: true,
        lines: (body.lines ?? []).map((line: any) => ({
          id: guid('1b0b'),
          accountId: line.accountId,
          fiscalPeriodId: line.fiscalPeriodId,
          amount: round2(Number(line.amount)),
        })),
      }
      store.budgets.push(budget)
      return budget
    },
  },

  /* --------------------------------------------------------------- tax codes */
  { method: 'GET', pattern: '/taxcodes', handler: () => store.taxCodes.filter((taxCode) => taxCode.isActive) },
  {
    method: 'POST',
    pattern: '/taxcodes',
    handler: ({ body }) => {
      const taxCode = {
        id: guid('1c0b'),
        companyId: store.company.id,
        code: body.code,
        name: body.name,
        ratePercent: round2(Number(body.ratePercent)),
        type: Number(body.type),
        taxPayableOrReceivableAccountId: body.taxPayableOrReceivableAccountId,
        isActive: true,
      }
      store.taxCodes.push(taxCode)
      return taxCode
    },
  },

  /* ----------------------------------------------------------- fiscal periods */
  {
    method: 'GET',
    pattern: '/fiscalperiods/years',
    handler: () => store.fiscalYears.slice().sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()),
  },
  {
    method: 'GET',
    pattern: '/fiscalperiods/years/:yearId/periods',
    handler: ({ params }) =>
      store.fiscalPeriods
        .filter((period) => period.fiscalYearId === params.yearId)
        .sort((a, b) => a.periodNumber - b.periodNumber),
  },
  {
    method: 'POST',
    pattern: '/fiscalperiods/periods/:periodId/close',
    handler: ({ params, user }) => {
      const period = store.fiscalPeriods.find((candidate) => candidate.id === params.periodId)
      if (!period) throw new MockHttpError(404, 'Fiscal period not found.')
      period.status = 2
      period.closedAtUtc = new Date().toISOString()
      period.closedBy = user.fullName
      return null
    },
  },
  {
    method: 'POST',
    pattern: '/fiscalperiods/periods/:periodId/reopen',
    handler: ({ params }) => {
      const period = store.fiscalPeriods.find((candidate) => candidate.id === params.periodId)
      if (!period) throw new MockHttpError(404, 'Fiscal period not found.')
      period.status = 1
      period.closedAtUtc = null
      period.closedBy = null
      return null
    },
  },
  {
    method: 'POST',
    pattern: '/fiscalperiods/years/:yearId/close',
    handler: ({ params, user }) => {
      const fiscalYear = store.fiscalYears.find((candidate) => candidate.id === params.yearId)
      if (!fiscalYear) throw new MockHttpError(404, 'Fiscal year not found.')
      if (fiscalYear.isClosed) throw new MockHttpError(400, 'Fiscal year is already closed.')

      const lines = postedLines(fiscalYear.startDate, fiscalYear.endDate).filter((line) => {
        const type = accountById(line.accountId)?.type
        return type === AccountType.Revenue || type === AccountType.Expense
      })

      const byAccount = new Map<string, number>()
      for (const line of lines) {
        byAccount.set(line.accountId, (byAccount.get(line.accountId) ?? 0) + line.debit - line.credit)
      }

      const retained = accountByKey(SYSTEM_KEYS.RetainedEarnings)
      const closingLines = [...byAccount.entries()]
        .map(([accountId, netDebit]) => {
          const amount = round2(netDebit)
          return amount > 0 ? { accountId, credit: amount } : { accountId, debit: -amount }
        })
        .filter((line) => ('debit' in line ? line.debit : line.credit) !== 0)

      const netIncome = round2(-[...byAccount.values()].reduce((sum, net) => sum + net, 0))
      if (netIncome > 0) closingLines.push({ accountId: retained.id, credit: netIncome })
      if (netIncome < 0) closingLines.push({ accountId: retained.id, debit: -netIncome })

      if (closingLines.length > 1) {
        postEntry({
          entryDate: fiscalYear.endDate,
          sourceType: JournalSourceType.PeriodClosing,
          sourceId: fiscalYear.id,
          memo: `Year-end closing FY${fiscalYear.name}`,
          lines: closingLines,
          postedBy: user.fullName,
        })
      }

      store.fiscalPeriods
        .filter((period) => period.fiscalYearId === fiscalYear.id)
        .forEach((period) => {
          period.status = 2
          period.closedAtUtc = new Date().toISOString()
          period.closedBy = user.fullName
        })

      fiscalYear.isClosed = true
      fiscalYear.closedAtUtc = new Date().toISOString()
      fiscalYear.closedBy = user.fullName
      return null
    },
  },

  /* ----------------------------------------------------------------- reports */
  {
    method: 'GET',
    pattern: '/reports/trial-balance',
    handler: ({ query }) => {
      const asOfDate = query.get('asOfDate') ?? new Date().toISOString()
      const grouped = new Map<string, { code: string; name: string; type: string; debit: number; credit: number }>()
      for (const line of postedLines(null, asOfDate)) {
        const account = accountById(line.accountId)
        if (!account) continue
        const row = grouped.get(account.id) ?? {
          code: account.code,
          name: account.name,
          type: Object.keys(AccountType).find((key) => (AccountType as any)[key] === account.type) ?? '',
          debit: 0,
          credit: 0,
        }
        row.debit += line.debit
        row.credit += line.credit
        grouped.set(account.id, row)
      }
      const rows = [...grouped.entries()]
        .map(([accountId, row]) => {
          const net = round2(row.debit - row.credit)
          return {
            accountId,
            accountCode: row.code,
            accountName: row.name,
            accountType: row.type,
            debit: net >= 0 ? net : 0,
            credit: net < 0 ? -net : 0,
          }
        })
        .sort((a, b) => a.accountCode.localeCompare(b.accountCode))
      return {
        asOfDate,
        rows,
        totalDebit: round2(rows.reduce((sum, row) => sum + row.debit, 0)),
        totalCredit: round2(rows.reduce((sum, row) => sum + row.credit, 0)),
      }
    },
  },
  {
    method: 'GET',
    pattern: '/reports/income-statement',
    handler: ({ query }) => {
      const startDate = query.get('startDate') ?? ''
      const endDate = query.get('endDate') ?? ''
      const lines = postedLines(startDate, endDate).filter((line) => {
        const type = accountById(line.accountId)?.type
        return type === AccountType.Revenue || type === AccountType.Expense
      })

      const group = (type: number, creditNormal: boolean) => {
        const map = new Map<string, { accountCode: string; accountName: string; amount: number }>()
        for (const line of lines) {
          const account = accountById(line.accountId)
          if (!account || account.type !== type) continue
          const row = map.get(account.id) ?? { accountCode: account.code, accountName: account.name, amount: 0 }
          row.amount += creditNormal ? line.credit - line.debit : line.debit - line.credit
          map.set(account.id, row)
        }
        return [...map.values()]
          .map((row) => ({ ...row, amount: round2(row.amount) }))
          .sort((a, b) => a.accountCode.localeCompare(b.accountCode))
      }

      const revenues = group(AccountType.Revenue, true)
      const expenses = group(AccountType.Expense, false)
      const totalRevenue = round2(revenues.reduce((sum, row) => sum + row.amount, 0))
      const totalExpense = round2(expenses.reduce((sum, row) => sum + row.amount, 0))
      return { startDate, endDate, revenues, totalRevenue, expenses, totalExpense, netIncome: round2(totalRevenue - totalExpense) }
    },
  },
  {
    method: 'GET',
    pattern: '/reports/balance-sheet',
    handler: ({ query }) => {
      const asOfDate = query.get('asOfDate') ?? new Date().toISOString()
      const lines = postedLines(null, asOfDate)

      const rowsFor = (type: number, creditNormal: boolean) => {
        const map = new Map<string, { accountCode: string; accountName: string; amount: number }>()
        for (const line of lines) {
          const account = accountById(line.accountId)
          if (!account || account.type !== type) continue
          const row = map.get(account.id) ?? { accountCode: account.code, accountName: account.name, amount: 0 }
          row.amount += creditNormal ? line.credit - line.debit : line.debit - line.credit
          map.set(account.id, row)
        }
        return [...map.values()]
          .map((row) => ({ ...row, amount: round2(row.amount) }))
          .sort((a, b) => a.accountCode.localeCompare(b.accountCode))
      }

      const assets = rowsFor(AccountType.Asset, false)
      const liabilities = rowsFor(AccountType.Liability, true)
      const equity = rowsFor(AccountType.Equity, true)

      const revenue = round2(
        lines
          .filter((line) => accountById(line.accountId)?.type === AccountType.Revenue)
          .reduce((sum, line) => sum + line.credit - line.debit, 0),
      )
      const expense = round2(
        lines
          .filter((line) => accountById(line.accountId)?.type === AccountType.Expense)
          .reduce((sum, line) => sum + line.debit - line.credit, 0),
      )
      const netIncomeYearToDate = round2(revenue - expense)
      const totalAssets = round2(assets.reduce((sum, row) => sum + row.amount, 0))
      const totalLiabilities = round2(liabilities.reduce((sum, row) => sum + row.amount, 0))
      const totalEquityExcludingNetIncome = round2(equity.reduce((sum, row) => sum + row.amount, 0))
      const totalEquity = round2(totalEquityExcludingNetIncome + netIncomeYearToDate)

      return {
        asOfDate,
        assets,
        totalAssets,
        liabilities,
        totalLiabilities,
        equity,
        totalEquityExcludingNetIncome,
        netIncomeYearToDate,
        totalEquity,
        totalLiabilitiesAndEquity: round2(totalLiabilities + totalEquity),
      }
    },
  },
  {
    method: 'GET',
    pattern: '/reports/general-ledger',
    handler: ({ query }) => {
      const accountId = query.get('accountId') ?? ''
      const startDate = query.get('startDate') ?? ''
      const endDate = query.get('endDate') ?? ''
      const account = accountById(accountId)
      if (!account) throw new MockHttpError(400, 'Account not found.')

      const prior = postedLines(null, new Date(new Date(startDate).getTime() - 1).toISOString()).filter(
        (line) => line.accountId === accountId,
      )
      const openingMovement = round2(prior.reduce((sum, line) => sum + line.debit - line.credit, 0))
      const openingBalance =
        account.normalBalance === NormalBalance.Debit ? openingMovement : round2(-openingMovement)

      let running = openingBalance
      const lines = postedLines(startDate, endDate)
        .filter((line) => line.accountId === accountId)
        .sort(
          (a, b) =>
            new Date(a.entry.entryDate).getTime() - new Date(b.entry.entryDate).getTime() || a.lineNumber - b.lineNumber,
        )
        .map((line) => {
          const delta = account.normalBalance === NormalBalance.Debit ? line.debit - line.credit : line.credit - line.debit
          running = round2(running + delta)
          return {
            date: line.entry.entryDate,
            entryNumber: line.entry.entryNumber,
            description: line.description,
            debit: line.debit,
            credit: line.credit,
            runningBalance: running,
            journalEntryId: line.entry.id,
          }
        })

      return {
        accountCode: account.code,
        accountName: account.name,
        openingBalance,
        lines,
        closingBalance: round2(running),
      }
    },
  },
  {
    method: 'GET',
    pattern: '/reports/ar-aging',
    handler: ({ query }) => {
      const asOfDate = query.get('asOfDate') ?? new Date().toISOString()
      const rows = buildAging(
        store.invoices
          .filter((invoice) => invoice.status !== InvoiceStatus.Paid && invoice.status !== InvoiceStatus.Voided)
          .map((invoice) => ({
            partyId: invoice.customerId,
            partyName: store.customers.find((customer) => customer.id === invoice.customerId)?.name ?? '',
            dueDate: invoice.dueDate,
            balance: round2(invoice.total - invoice.amountPaid),
          })),
        asOfDate,
      )
      return { asOfDate, rows, grandTotal: round2(rows.reduce((sum, row) => sum + row.totalDue, 0)) }
    },
  },
  {
    method: 'GET',
    pattern: '/reports/ap-aging',
    handler: ({ query }) => {
      const asOfDate = query.get('asOfDate') ?? new Date().toISOString()
      const rows = buildAging(
        store.bills
          .filter((bill) => bill.status !== BillStatus.Paid && bill.status !== BillStatus.Voided)
          .map((bill) => ({
            partyId: bill.vendorId,
            partyName: store.vendors.find((vendor) => vendor.id === bill.vendorId)?.name ?? '',
            dueDate: bill.dueDate,
            balance: round2(bill.total - bill.amountPaid),
          })),
        asOfDate,
      )
      return { asOfDate, rows, grandTotal: round2(rows.reduce((sum, row) => sum + row.totalDue, 0)) }
    },
  },
  {
    method: 'GET',
    pattern: '/reports/cash-flow',
    handler: ({ query }) => {
      const startDate = query.get('startDate') ?? ''
      const endDate = query.get('endDate') ?? ''

      const rangeLines = postedLines(startDate, endDate)
      const revenue = round2(
        rangeLines
          .filter((line) => accountById(line.accountId)?.type === AccountType.Revenue)
          .reduce((sum, line) => sum + line.credit - line.debit, 0),
      )
      const expense = round2(
        rangeLines
          .filter((line) => accountById(line.accountId)?.type === AccountType.Expense)
          .reduce((sum, line) => sum + line.debit - line.credit, 0),
      )
      const netIncome = round2(revenue - expense)
      const depreciation = round2(
        store.fixedAssets
          .flatMap((asset) => asset.depreciationEntries)
          .filter(
            (entry) =>
              new Date(entry.periodDate).getTime() >= new Date(startDate).getTime() &&
              new Date(entry.periodDate).getTime() <= new Date(endDate).getTime(),
          )
          .reduce((sum, entry) => sum + entry.amount, 0),
      )

      const dayBefore = new Date(new Date(startDate).getTime() - 86_400_000).toISOString()
      const ar = accountByKey(SYSTEM_KEYS.AccountsReceivable).id
      const ap = accountByKey(SYSTEM_KEYS.AccountsPayable).id
      const inventoryIds = [
        ...new Set(store.items.map((item) => item.inventoryAssetAccountId).filter((id): id is string => !!id)),
      ]
      const bankIds = [...new Set(store.bankAccounts.map((account) => account.glAccountId))]

      const changeInAr = round2(balanceAsOf([ar], endDate, false) - balanceAsOf([ar], dayBefore, false))
      const changeInInventory = round2(
        balanceAsOf(inventoryIds, endDate, false) - balanceAsOf(inventoryIds, dayBefore, false),
      )
      const changeInAp = round2(balanceAsOf([ap], endDate, true) - balanceAsOf([ap], dayBefore, true))

      const netCashFromOperations = round2(netIncome + depreciation - changeInAr - changeInInventory + changeInAp)

      return {
        startDate,
        endDate,
        netIncome,
        depreciation,
        changeInAccountsReceivable: changeInAr,
        changeInInventory,
        changeInAccountsPayable: changeInAp,
        netCashFromOperations,
        netCashFromInvesting: 0,
        netCashFromFinancing: 0,
        netChangeInCash: netCashFromOperations,
        beginningCash: balanceAsOf(bankIds, dayBefore, false),
        endingCash: balanceAsOf(bankIds, endDate, false),
      }
    },
  },
]

/* --------------------------------------------------------------- utilities */

function accountByCodeSafe(code: string): string {
  return store.accounts.find((account) => account.code === code)?.id ?? store.accounts[0].id
}

