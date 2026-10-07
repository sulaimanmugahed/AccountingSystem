/**
 * In-browser mock of the AccountingSystem API.
 *
 * It mirrors the .NET controllers' routes, payload shapes and — importantly —
 * their accounting behaviour: documents post through a single balanced
 * `postEntry()` "journal engine" that refuses entries outside an open fiscal
 * period. Everything the reports endpoints return is derived from those entries,
 * so the numbers in the UI stay internally consistent.
 *
 * Enabled with `npm run dev:mock` (VITE_USE_MOCK=true).
 */

/* ------------------------------------------------------------------- enums */

export const AccountType = { Asset: 1, Liability: 2, Equity: 3, Revenue: 4, Expense: 5 } as const
export const NormalBalance = { Debit: 1, Credit: 2 } as const
export const JournalEntryStatus = { Draft: 1, Posted: 2, Voided: 3 } as const
export const JournalSourceType = {
  Manual: 1,
  SalesInvoice: 2,
  CustomerPayment: 3,
  CreditMemo: 4,
  VendorBill: 5,
  VendorPayment: 6,
  VendorCredit: 7,
  BankTransaction: 8,
  Depreciation: 9,
  OpeningBalance: 10,
  Adjustment: 11,
  InventoryAdjustment: 12,
  PeriodClosing: 13,
} as const
export const InvoiceStatus = { Draft: 1, Sent: 2, PartiallyPaid: 3, Paid: 4, Overdue: 5, Voided: 6 } as const
export const BillStatus = { Draft: 1, Approved: 2, PartiallyPaid: 3, Paid: 4, Voided: 5 } as const
export const TaxType = { Sales: 1, Purchase: 2 } as const
export const ItemType = { Inventory: 1, Service: 2, NonInventory: 3 } as const
export const AssetStatus = { Active: 1, FullyDepreciated: 2, Disposed: 3 } as const
export const DepreciationMethod = { StraightLine: 1, DecliningBalance: 2 } as const
export const FiscalPeriodStatus = { Open: 1, Closed: 2 } as const

/* -------------------------------------------------------------------- types */

export interface Account {
  id: string
  companyId: string
  code: string
  name: string
  description?: string | null
  type: number
  subType?: string | null
  parentAccountId?: string | null
  isActive: boolean
  isSystemAccount: boolean
  systemAccountKey?: string | null
  normalBalance: number
}

export interface JournalEntryLine {
  id: string
  journalEntryId: string
  lineNumber: number
  accountId: string
  debit: number
  credit: number
  description?: string | null
}

export interface JournalEntry {
  id: string
  companyId: string
  entryNumber: string
  entryDate: string
  fiscalPeriodId: string
  status: number
  sourceType: number
  sourceId?: string | null
  memo?: string | null
  currencyCode: string
  exchangeRateToBase: number
  postedAtUtc?: string | null
  postedBy?: string | null
  reversalOfEntryId?: string | null
  isReversed: boolean
  lines: JournalEntryLine[]
}

export interface Customer {
  id: string
  companyId: string
  code: string
  name: string
  email?: string | null
  phone?: string | null
  paymentTermsDays: number
  creditLimit: number
  taxExempt: boolean
  currencyCode: string
  isActive: boolean
  notes?: string | null
}

export interface Vendor {
  id: string
  companyId: string
  code: string
  name: string
  email?: string | null
  phone?: string | null
  paymentTermsDays: number
  currencyCode: string
  is1099Vendor: boolean
  isActive: boolean
}

export interface Item {
  id: string
  companyId: string
  sku: string
  name: string
  description?: string | null
  type: number
  salesPrice: number
  purchaseCost: number
  incomeAccountId?: string | null
  expenseAccountId?: string | null
  inventoryAssetAccountId?: string | null
  valuationMethod: number
  quantityOnHand: number
  averageCost: number
  reorderPoint: number
  defaultTaxCodeId?: string | null
  isActive: boolean
}

export interface StockTransaction {
  id: string
  itemId: string
  transactionDate: string
  type: number
  quantity: number
  unitCost: number
  runningQuantity: number
  runningValue: number
  referenceType?: string | null
  referenceId?: string | null
}

export interface TaxCode {
  id: string
  companyId: string
  code: string
  name: string
  ratePercent: number
  type: number
  taxPayableOrReceivableAccountId: string
  isActive: boolean
}

export interface InvoiceLine {
  id: string
  invoiceId: string
  lineNumber: number
  itemId?: string | null
  description: string
  quantity: number
  unitPrice: number
  discountPercent: number
  taxCodeId?: string | null
  taxAmount: number
  lineTotal: number
  revenueAccountId?: string | null
}

export interface Invoice {
  id: string
  companyId: string
  invoiceNumber: string
  customerId: string
  invoiceDate: string
  dueDate: string
  status: number
  currencyCode: string
  exchangeRateToBase: number
  subTotal: number
  taxTotal: number
  total: number
  amountPaid: number
  memo?: string | null
  terms?: string | null
  journalEntryId?: string | null
  lines: InvoiceLine[]
}

export interface BillLine {
  id: string
  billId: string
  lineNumber: number
  itemId?: string | null
  description: string
  quantity: number
  unitCost: number
  taxCodeId?: string | null
  taxAmount: number
  lineTotal: number
  expenseAccountId?: string | null
}

export interface Bill {
  id: string
  companyId: string
  billNumber: string
  vendorInvoiceNumber?: string | null
  vendorId: string
  billDate: string
  dueDate: string
  status: number
  currencyCode: string
  exchangeRateToBase: number
  subTotal: number
  taxTotal: number
  total: number
  amountPaid: number
  memo?: string | null
  journalEntryId?: string | null
  lines: BillLine[]
}

export interface CustomerPayment {
  id: string
  companyId: string
  paymentNumber: string
  customerId: string
  paymentDate: string
  amount: number
  method: number
  referenceNumber?: string | null
  bankAccountId: string
  currencyCode: string
  unappliedAmount: number
  journalEntryId?: string | null
  memo?: string | null
  applications: { id: string; invoiceId: string; amountApplied: number }[]
}

export interface VendorPayment {
  id: string
  companyId: string
  paymentNumber: string
  vendorId: string
  paymentDate: string
  amount: number
  method: number
  referenceNumber?: string | null
  bankAccountId: string
  currencyCode: string
  unappliedAmount: number
  journalEntryId?: string | null
  memo?: string | null
  applications: { id: string; billId: string; amountApplied: number }[]
}

export interface BankAccount {
  id: string
  companyId: string
  name: string
  bankName?: string | null
  accountNumberMasked?: string | null
  glAccountId: string
  currencyCode: string
  openingBalance: number
  openingBalanceDate: string
  isActive: boolean
}

export interface BankTransaction {
  id: string
  bankAccountId: string
  transactionDate: string
  description: string
  type: number
  amount: number
  referenceNumber?: string | null
  journalEntryId?: string | null
  isReconciled: boolean
  bankReconciliationId?: string | null
}

export interface BankReconciliation {
  id: string
  bankAccountId: string
  statementDate: string
  statementBeginningBalance: number
  statementEndingBalance: number
  isCompleted: boolean
  completedAtUtc?: string | null
  completedBy?: string | null
}

export interface FixedAsset {
  id: string
  companyId: string
  code: string
  name: string
  acquisitionDate: string
  acquisitionCost: number
  salvageValue: number
  usefulLifeMonths: number
  method: number
  decliningBalanceRatePercent?: number | null
  assetAccountId: string
  accumulatedDepreciationAccountId: string
  depreciationExpenseAccountId: string
  status: number
  disposalDate?: string | null
  disposalProceeds?: number | null
  accumulatedDepreciation: number
  depreciationEntries: { id: string; periodDate: string; amount: number }[]
}

export interface Budget {
  id: string
  companyId: string
  name: string
  fiscalYearId: string
  isActive: boolean
  lines: { id: string; accountId: string; fiscalPeriodId: string; amount: number }[]
}

export interface FiscalYear {
  id: string
  companyId: string
  name: string
  startDate: string
  endDate: string
  isClosed: boolean
  closedAtUtc?: string | null
  closedBy?: string | null
}

export interface FiscalPeriod {
  id: string
  companyId: string
  fiscalYearId: string
  name: string
  periodNumber: number
  startDate: string
  endDate: string
  status: number
  closedAtUtc?: string | null
  closedBy?: string | null
}

export interface Company {
  id: string
  name: string
  legalName?: string | null
  taxRegistrationNumber?: string | null
  baseCurrencyCode: string
  fiscalYearStartMonth: number
  addressLine1?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  country?: string | null
  phone?: string | null
  email?: string | null
  isActive: boolean
}

export interface User {
  id: string
  email: string
  password: string
  fullName: string
  companyId: string
  roles: string[]
  isActive: boolean
}

export interface Store {
  company: Company
  fiscalYears: FiscalYear[]
  fiscalPeriods: FiscalPeriod[]
  accounts: Account[]
  journalEntries: JournalEntry[]
  sequences: Record<string, number>
  customers: Customer[]
  vendors: Vendor[]
  items: Item[]
  stockTransactions: StockTransaction[]
  taxCodes: TaxCode[]
  invoices: Invoice[]
  bills: Bill[]
  customerPayments: CustomerPayment[]
  vendorPayments: VendorPayment[]
  bankAccounts: BankAccount[]
  bankTransactions: BankTransaction[]
  reconciliations: BankReconciliation[]
  fixedAssets: FixedAsset[]
  budgets: Budget[]
  users: User[]
}

/* ------------------------------------------------------------------ helpers */

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

let counter = 1000
export function guid(prefix = '0000'): string {
  counter += 1
  const hex = counter.toString(16).padStart(4, '0')
  const rand = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0')
  return `${prefix.padEnd(8, '0').slice(0, 8)}-${hex}-4${rand().slice(1)}-a${rand().slice(1)}-${rand()}${rand().slice(0, 4)}`
}

export function stableId(seed: number, entity: number): string {
  const entityHex = entity.toString(16).padStart(8, '0')
  const seedHex = seed.toString(16).padStart(12, '0')
  return `${entityHex}-0000-4000-8000-${seedHex}`
}

export const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

export function isoDate(value: Date | string) {
  const date = typeof value === 'string' ? new Date(value) : value
  return date.toISOString()
}

/** `yyyy-MM-dd` shifted by `days` from `from`. */
export function shiftDays(from: string | Date, days: number) {
  const date = typeof from === 'string' ? new Date(from) : new Date(from.getTime())
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

export function yearStart(year: number) {
  return new Date(Date.UTC(year, 0, 1, 12)).toISOString()
}

/* ------------------------------------------------------------------- errors */

export class MockHttpError extends Error {
  status: number
  payload: unknown
  constructor(status: number, message: string, payload?: unknown) {
    super(message)
    this.status = status
    this.payload = payload ?? { error: message }
  }
}

/* ---------------------------------------------------------------- the store */

export const companyId = 'a1b2c3d4-0000-4000-8000-000000000001'

export const store: Store = {
  company: {
    id: companyId,
    name: 'Demo Company Inc.',
    legalName: 'Demo Company Incorporated',
    taxRegistrationNumber: 'US-88-1234567',
    baseCurrencyCode: 'USD',
    fiscalYearStartMonth: 1,
    addressLine1: '500 Market Street, Suite 1200',
    city: 'San Francisco',
    state: 'CA',
    postalCode: '94105',
    country: 'USA',
    phone: '+1 (415) 555-0142',
    email: 'finance@demo.local',
    isActive: true,
  },
  fiscalYears: [],
  fiscalPeriods: [],
  accounts: [],
  journalEntries: [],
  sequences: {},
  customers: [],
  vendors: [],
  items: [],
  stockTransactions: [],
  taxCodes: [],
  invoices: [],
  bills: [],
  customerPayments: [],
  vendorPayments: [],
  bankAccounts: [],
  bankTransactions: [],
  reconciliations: [],
  fixedAssets: [],
  budgets: [],
  users: [],
}

/* -------------------------------------------------------------- chart setup */

const SYSTEM_KEYS = {
  AccountsReceivable: 'AccountsReceivable',
  AccountsPayable: 'AccountsPayable',
  SalesTaxPayable: 'SalesTaxPayable',
  PurchaseTaxReceivable: 'PurchaseTaxReceivable',
  RetainedEarnings: 'RetainedEarnings',
  OpeningBalanceEquity: 'OpeningBalanceEquity',
  DefaultSalesRevenue: 'DefaultSalesRevenue',
  DefaultCogs: 'DefaultCogs',
} as const

export function accountByKey(key: string): Account {
  const account = store.accounts.find((candidate) => candidate.systemAccountKey === key && candidate.isActive)
  if (!account) throw new MockHttpError(400, `System account "${key}" is not configured for this company.`)
  return account
}

export function accountByCode(code: string): Account {
  const account = store.accounts.find((candidate) => candidate.code === code)
  if (!account) throw new MockHttpError(400, `Account ${code} not found.`)
  return account
}

function makeAccount(
  seed: number,
  code: string,
  name: string,
  type: number,
  subType: string | null,
  key: string | null = null,
): Account {
  return {
    id: stableId(seed, 1),
    companyId,
    code,
    name,
    description: null,
    type,
    subType,
    parentAccountId: null,
    isActive: true,
    isSystemAccount: !!key,
    systemAccountKey: key,
    normalBalance: type === AccountType.Asset || type === AccountType.Expense ? NormalBalance.Debit : NormalBalance.Credit,
  }
}

/* --------------------------------------------------------------- sequences */

export function nextNumber(documentType: string, prefix: string): string {
  const next = (store.sequences[documentType] ?? 1)
  store.sequences[documentType] = next + 1
  return `${prefix}-${String(next).padStart(6, '0')}`
}

/* ------------------------------------------------------- the journal engine */

export interface PostLine {
  accountId: string
  debit?: number
  credit?: number
  description?: string
  customerId?: string | null
  vendorId?: string | null
}

export function findOpenPeriod(date: string): FiscalPeriod {
  const time = new Date(date).getTime()
  const period = store.fiscalPeriods.find(
    (candidate) =>
      (candidate.status === FiscalPeriodStatus.Open || candidate.status === (2 as number)) &&
      time >= new Date(candidate.startDate).getTime() &&
      time <= new Date(candidate.endDate).getTime(),
  )
  if (!period) throw new MockHttpError(400, `No fiscal period is open for ${date.slice(0, 10)}. Open or create the period first.`)
  if (period.status === FiscalPeriodStatus.Closed) {
    throw new MockHttpError(400, `Fiscal period ${period.name} is closed. Reopen it before posting.`)
  }
  return period
}

export function postEntry(options: {
  entryDate: string
  sourceType: number
  sourceId?: string | null
  memo?: string | null
  lines: PostLine[]
  postedBy?: string | null
  currencyCode?: string
  exchangeRateToBase?: number
  entryNumber?: string
}): JournalEntry {
  const { entryDate, sourceType, sourceId, memo, lines, postedBy } = options

  if (lines.length < 2) throw new MockHttpError(400, 'A journal entry requires at least two lines.')

  for (const line of lines) {
    const debit = round2(line.debit ?? 0)
    const credit = round2(line.credit ?? 0)
    if (debit < 0 || credit < 0) throw new MockHttpError(400, 'Journal entry line amounts cannot be negative.')
    if (debit > 0 && credit > 0)
      throw new MockHttpError(400, 'A journal entry line cannot have both a debit and a credit amount.')
    if (debit === 0 && credit === 0)
      throw new MockHttpError(400, 'A journal entry line must have a non-zero debit or credit amount.')
    if (!store.accounts.some((account) => account.id === line.accountId))
      throw new MockHttpError(400, 'One of the selected accounts no longer exists.')
  }

  const totalDebit = round2(lines.reduce((sum, line) => sum + (line.debit ?? 0), 0))
  const totalCredit = round2(lines.reduce((sum, line) => sum + (line.credit ?? 0), 0))
  if (totalDebit !== totalCredit)
    throw new MockHttpError(
      400,
      `Journal entry is not balanced: total debits ${totalDebit} != total credits ${totalCredit}.`,
    )

  const period = findOpenPeriod(entryDate)

  const entry: JournalEntry = {
    id: guid('eeee'),
    companyId,
    entryNumber: options.entryNumber ?? nextNumber('JE', 'JE'),
    entryDate,
    fiscalPeriodId: period.id,
    status: JournalEntryStatus.Posted,
    sourceType,
    sourceId: sourceId ?? null,
    memo: memo ?? null,
    currencyCode: options.currencyCode ?? 'USD',
    exchangeRateToBase: options.exchangeRateToBase ?? 1,
    postedAtUtc: new Date().toISOString(),
    postedBy: postedBy ?? 'System Administrator',
    reversalOfEntryId: null,
    isReversed: false,
    lines: lines.map((line, index) => ({
      id: guid('11e1'),
      journalEntryId: '',
      lineNumber: index + 1,
      accountId: line.accountId,
      debit: round2(line.debit ?? 0),
      credit: round2(line.credit ?? 0),
      description: line.description ?? null,
    })),
  }
  entry.lines.forEach((line) => (line.journalEntryId = entry.id))
  store.journalEntries.push(entry)
  return entry
}

/* ------------------------------------------------------------- stock ledger */

function recordStock(
  itemId: string,
  date: string,
  type: number,
  quantity: number,
  unitCost: number,
  referenceType?: string,
  referenceId?: string,
) {
  const item = store.items.find((candidate) => candidate.id === itemId)
  if (!item) return
  const previousQuantity = item.quantityOnHand
  const previousValue = previousQuantity * item.averageCost
  const newQuantity = previousQuantity + quantity
  const newValue = previousValue + quantity * unitCost
  item.quantityOnHand = round2(newQuantity)
  item.averageCost = newQuantity === 0 ? 0 : round2(newValue / newQuantity)

  for (const transaction of store.stockTransactions) {
    if (transaction.itemId === itemId) {
      transaction.runningQuantity = item.quantityOnHand
      transaction.runningValue = round2(item.quantityOnHand * item.averageCost)
    }
  }

  store.stockTransactions.push({
    id: guid('57cc'),
    itemId,
    transactionDate: date,
    type,
    quantity: round2(quantity),
    unitCost: round2(unitCost),
    runningQuantity: item.quantityOnHand,
    runningValue: round2(item.quantityOnHand * item.averageCost),
    referenceType: referenceType ?? null,
    referenceId: referenceId ?? null,
  })
}

/* --------------------------------------------------------------- subledgers */

export function computeInvoiceTotals(lines: { quantity: number; unitPrice: number; discountPercent: number; taxAmount: number }[]) {
  const subTotal = round2(lines.reduce((sum, line) => sum + line.quantity * line.unitPrice * (1 - line.discountPercent / 100), 0))
  const taxTotal = round2(lines.reduce((sum, line) => sum + line.taxAmount, 0))
  return { subTotal, taxTotal, total: round2(subTotal + taxTotal) }
}

export function applyTax(itemAmount: number, taxCodeId?: string | null) {
  if (!taxCodeId) return 0
  const taxCode = store.taxCodes.find((candidate) => candidate.id === taxCodeId)
  if (!taxCode) return 0
  return round2(itemAmount * (taxCode.ratePercent / 100))
}

export function postInvoice(invoice: Invoice, postedBy = 'System Administrator') {
  const ar = accountByKey(SYSTEM_KEYS.AccountsReceivable)
  const taxPayable = accountByKey(SYSTEM_KEYS.SalesTaxPayable)
  const defaultRevenue = accountByKey(SYSTEM_KEYS.DefaultSalesRevenue)
  const cogs = accountByKey(SYSTEM_KEYS.DefaultCogs)
  const inventory = accountByCode('1200')

  const lines: PostLine[] = [
    { accountId: ar.id, debit: invoice.total, description: `Invoice ${invoice.invoiceNumber}` },
  ]

  for (const line of invoice.lines) {
    const net = round2(line.quantity * line.unitPrice * (1 - line.discountPercent / 100))
    lines.push({
      accountId: line.revenueAccountId ?? defaultRevenue.id,
      credit: net,
      description: line.description,
    })
  }

  if (invoice.taxTotal > 0) {
    lines.push({ accountId: taxPayable.id, credit: invoice.taxTotal, description: 'Sales tax' })
  }

  const entry = postEntry({
    entryDate: invoice.invoiceDate,
    sourceType: JournalSourceType.SalesInvoice,
    sourceId: invoice.id,
    memo: `Invoice ${invoice.invoiceNumber}`,
    lines,
    postedBy,
  })
  invoice.journalEntryId = entry.id
  invoice.status = InvoiceStatus.Sent

  // Inventory items leave the warehouse and book COGS.
  for (const line of invoice.lines) {
    if (!line.itemId) continue
    const item = store.items.find((candidate) => candidate.id === line.itemId)
    if (!item || item.type !== ItemType.Inventory || item.quantityOnHand < line.quantity) continue
    const cost = round2(line.quantity * item.averageCost)
    recordStock(line.itemId, invoice.invoiceDate, 2, -line.quantity, item.averageCost, 'Invoice', invoice.id)
    if (cost > 0) {
      const cogsEntry = postEntry({
        entryDate: invoice.invoiceDate,
        sourceType: JournalSourceType.SalesInvoice,
        sourceId: invoice.id,
        memo: `COGS for ${invoice.invoiceNumber}`,
        lines: [
          { accountId: cogs.id, debit: cost, description: line.description },
          { accountId: (item.inventoryAssetAccountId ?? inventory.id), credit: cost, description: line.description },
        ],
        postedBy,
      })
      void cogsEntry
    }
  }
}

export function postBill(bill: Bill, postedBy = 'System Administrator') {
  const ap = accountByKey(SYSTEM_KEYS.AccountsPayable)
  const purchaseTax = accountByKey(SYSTEM_KEYS.PurchaseTaxReceivable)
  const inventory = accountByCode('1200')
  const defaultExpense = accountByCode('6900')

  const lines: PostLine[] = [{ accountId: ap.id, credit: bill.total, description: `Bill ${bill.billNumber}` }]

  for (const line of bill.lines) {
    const net = round2(line.quantity * line.unitCost)
    const item = line.itemId ? store.items.find((candidate) => candidate.id === line.itemId) : undefined
    const accountId =
      line.expenseAccountId ??
      (item && item.type === ItemType.Inventory ? (item.inventoryAssetAccountId ?? inventory.id) : (item?.expenseAccountId ?? defaultExpense.id))
    lines.push({ accountId, debit: net, description: line.description })
  }

  if (bill.taxTotal > 0) {
    lines.push({ accountId: purchaseTax.id, debit: bill.taxTotal, description: 'Purchase tax' })
  }

  const entry = postEntry({
    entryDate: bill.billDate,
    sourceType: JournalSourceType.VendorBill,
    sourceId: bill.id,
    memo: `Bill ${bill.billNumber}`,
    lines,
    postedBy,
  })
  bill.journalEntryId = entry.id
  bill.status = BillStatus.Approved

  for (const line of bill.lines) {
    if (!line.itemId) continue
    const item = store.items.find((candidate) => candidate.id === line.itemId)
    if (!item || item.type !== ItemType.Inventory) continue
    recordStock(line.itemId, bill.billDate, 1, line.quantity, line.unitCost, 'Bill', bill.id)
  }
}

export function postCustomerPayment(payment: CustomerPayment, postedBy = 'System Administrator') {
  const ar = accountByKey(SYSTEM_KEYS.AccountsReceivable)
  const bank = store.bankAccounts.find((candidate) => candidate.id === payment.bankAccountId)
  const glAccountId = bank?.glAccountId ?? accountByCode('1000').id

  const entry = postEntry({
    entryDate: payment.paymentDate,
    sourceType: JournalSourceType.CustomerPayment,
    sourceId: payment.id,
    memo: `Customer payment ${payment.paymentNumber}`,
    lines: [
      { accountId: glAccountId, debit: payment.amount, description: payment.referenceNumber ?? undefined },
      { accountId: ar.id, credit: payment.amount },
    ],
    postedBy,
  })
  payment.journalEntryId = entry.id

  for (const application of payment.applications) {
    const invoice = store.invoices.find((candidate) => candidate.id === application.invoiceId)
    if (!invoice) continue
    invoice.amountPaid = round2(invoice.amountPaid + application.amountApplied)
    const balance = round2(invoice.total - invoice.amountPaid)
    invoice.status = balance <= 0.001 ? InvoiceStatus.Paid : InvoiceStatus.PartiallyPaid
  }
}

export function postVendorPayment(payment: VendorPayment, postedBy = 'System Administrator') {
  const ap = accountByKey(SYSTEM_KEYS.AccountsPayable)
  const bank = store.bankAccounts.find((candidate) => candidate.id === payment.bankAccountId)
  const glAccountId = bank?.glAccountId ?? accountByCode('1000').id

  const entry = postEntry({
    entryDate: payment.paymentDate,
    sourceType: JournalSourceType.VendorPayment,
    sourceId: payment.id,
    memo: `Vendor payment ${payment.paymentNumber}`,
    lines: [
      { accountId: ap.id, debit: payment.amount },
      { accountId: glAccountId, credit: payment.amount, description: payment.referenceNumber ?? undefined },
    ],
    postedBy,
  })
  payment.journalEntryId = entry.id

  for (const application of payment.applications) {
    const bill = store.bills.find((candidate) => candidate.id === application.billId)
    if (!bill) continue
    bill.amountPaid = round2(bill.amountPaid + application.amountApplied)
    const balance = round2(bill.total - bill.amountPaid)
    bill.status = balance <= 0.001 ? BillStatus.Paid : BillStatus.PartiallyPaid
  }
}

/* -------------------------------------------------------------------- seed */

export function seed() {
  const year = new Date().getFullYear()

  store.fiscalYears = []
  store.fiscalPeriods = []
  store.accounts = []
  store.journalEntries = []
  store.sequences = {}
  store.customers = []
  store.vendors = []
  store.items = []
  store.stockTransactions = []
  store.taxCodes = []
  store.invoices = []
  store.bills = []
  store.customerPayments = []
  store.vendorPayments = []
  store.bankAccounts = []
  store.bankTransactions = []
  store.reconciliations = []
  store.fixedAssets = []
  store.budgets = []
  store.users = [
    {
      id: stableId(900, 3),
      email: 'admin@demo.local',
      password: 'Admin@12345',
      fullName: 'System Administrator',
      companyId,
      roles: ['Admin'],
      isActive: true,
    },
    {
      id: stableId(901, 3),
      email: 'accountant@demo.local',
      password: 'Accountant@123',
      fullName: 'Dana Accountant',
      companyId,
      roles: ['Accountant'],
      isActive: true,
    },
    {
      id: stableId(902, 3),
      email: 'arclerk@demo.local',
      password: 'ArClerk@1234',
      fullName: 'Riley AR Clerk',
      companyId,
      roles: ['ARClerk'],
      isActive: true,
    },
    {
      id: stableId(903, 3),
      email: 'apclerk@demo.local',
      password: 'ApClerk@1234',
      fullName: 'Alex AP Clerk',
      companyId,
      roles: ['APClerk'],
      isActive: true,
    },
    {
      id: stableId(904, 3),
      email: 'viewer@demo.local',
      password: 'Viewer@1234',
      fullName: 'Vic Viewer',
      companyId,
      roles: ['Viewer'],
      isActive: true,
    },
  ]

  /* Fiscal year + periods */
  const fiscalYear: FiscalYear = {
    id: stableId(1, 2),
    companyId,
    name: `FY${year}`,
    startDate: yearStart(year),
    endDate: new Date(Date.UTC(year, 11, 31, 12)).toISOString(),
    isClosed: false,
    closedAtUtc: null,
    closedBy: null,
  }
  store.fiscalYears.push(fiscalYear)

  for (let month = 1; month <= 12; month += 1) {
    store.fiscalPeriods.push({
      id: stableId(100 + month, 2),
      companyId,
      fiscalYearId: fiscalYear.id,
      name: `${MONTHS[month - 1]} ${year}`,
      periodNumber: month,
      startDate: new Date(Date.UTC(year, month - 1, 1, 12)).toISOString(),
      endDate: new Date(Date.UTC(year, month, 0, 12)).toISOString(),
      status: FiscalPeriodStatus.Open,
      closedAtUtc: null,
      closedBy: null,
    })
  }

  /* Previous fiscal year (closed) so period management has some history */
  const previousYear: FiscalYear = {
    id: stableId(2, 2),
    companyId,
    name: `FY${year - 1}`,
    startDate: yearStart(year - 1),
    endDate: new Date(Date.UTC(year - 1, 11, 31, 12)).toISOString(),
    isClosed: true,
    closedAtUtc: new Date(Date.UTC(year, 0, 20, 12)).toISOString(),
    closedBy: 'System Administrator',
  }
  store.fiscalYears.unshift(previousYear)
  for (let month = 1; month <= 12; month += 1) {
    store.fiscalPeriods.push({
      id: stableId(50 + month, 2),
      companyId,
      fiscalYearId: previousYear.id,
      name: `${MONTHS[month - 1]} ${year - 1}`,
      periodNumber: month,
      startDate: new Date(Date.UTC(year - 1, month - 1, 1, 12)).toISOString(),
      endDate: new Date(Date.UTC(year - 1, month, 0, 12)).toISOString(),
      status: FiscalPeriodStatus.Closed,
      closedAtUtc: new Date(Date.UTC(year, 0, 20, 12)).toISOString(),
      closedBy: 'System Administrator',
    })
  }

  /* Chart of accounts */
  const chart: Array<[string, string, number, string, string?]> = [
    ['1000', 'Cash and Bank', AccountType.Asset, 'Current Asset'],
    ['1100', 'Accounts Receivable', AccountType.Asset, 'Current Asset', SYSTEM_KEYS.AccountsReceivable],
    ['1200', 'Inventory Asset', AccountType.Asset, 'Current Asset'],
    ['1300', 'Purchase Tax Receivable', AccountType.Asset, 'Current Asset', SYSTEM_KEYS.PurchaseTaxReceivable],
    ['1500', 'Fixed Assets', AccountType.Asset, 'Fixed Asset'],
    ['1590', 'Accumulated Depreciation', AccountType.Asset, 'Fixed Asset'],
    ['2000', 'Accounts Payable', AccountType.Liability, 'Current Liability', SYSTEM_KEYS.AccountsPayable],
    ['2100', 'Sales Tax Payable', AccountType.Liability, 'Current Liability', SYSTEM_KEYS.SalesTaxPayable],
    ["3000", "Owner's Equity", AccountType.Equity, 'Equity', SYSTEM_KEYS.OpeningBalanceEquity],
    ['3900', 'Retained Earnings', AccountType.Equity, 'Equity', SYSTEM_KEYS.RetainedEarnings],
    ['4000', 'Sales Revenue', AccountType.Revenue, 'Operating Revenue', SYSTEM_KEYS.DefaultSalesRevenue],
    ['5000', 'Cost of Goods Sold', AccountType.Expense, 'Cost of Sales', SYSTEM_KEYS.DefaultCogs],
    ['6000', 'Rent Expense', AccountType.Expense, 'Operating Expense'],
    ['6100', 'Salaries and Wages', AccountType.Expense, 'Operating Expense'],
    ['6200', 'Utilities Expense', AccountType.Expense, 'Operating Expense'],
    ['6300', 'Office Supplies Expense', AccountType.Expense, 'Operating Expense'],
    ['6400', 'Depreciation Expense', AccountType.Expense, 'Operating Expense'],
    ['6900', 'Miscellaneous Expense', AccountType.Expense, 'Operating Expense'],
  ]
  chart.forEach(([code, name, type, subType, key], index) => {
    store.accounts.push(makeAccount(10 + index, code, name, type, subType, key ?? null))
  })

  /* Tax codes */
  const salesTax = accountByKey(SYSTEM_KEYS.SalesTaxPayable)
  const purchaseTax = accountByKey(SYSTEM_KEYS.PurchaseTaxReceivable)
  store.taxCodes.push(
    {
      id: stableId(1, 4),
      companyId,
      code: 'TAX8.5',
      name: 'Sales Tax 8.5%',
      ratePercent: 8.5,
      type: TaxType.Sales,
      taxPayableOrReceivableAccountId: salesTax.id,
      isActive: true,
    },
    {
      id: stableId(2, 4),
      companyId,
      code: 'TAX0',
      name: 'Exempt (0%)',
      ratePercent: 0,
      type: TaxType.Sales,
      taxPayableOrReceivableAccountId: salesTax.id,
      isActive: true,
    },
    {
      id: stableId(3, 4),
      companyId,
      code: 'PTAX5',
      name: 'Purchase Tax 5%',
      ratePercent: 5,
      type: TaxType.Purchase,
      taxPayableOrReceivableAccountId: purchaseTax.id,
      isActive: true,
    },
  )

  /* Customers */
  const customerSeeds: Array<[string, string, string, string, number, number]> = [
    ['C-1001', 'Northwind Traders', 'ap@northwind.example', '+1 (415) 555-0101', 30, 75000],
    ['C-1002', 'Acme Industrial Supply', 'billing@acme.example', '+1 (212) 555-0122', 15, 40000],
    ['C-1003', 'Blue Harbour Logistics', 'accounts@blueharbour.example', '+1 (305) 555-0193', 45, 120000],
    ['C-1004', 'Summit Health Group', 'payables@summithealth.example', '+1 (303) 555-0164', 30, 60000],
    ['C-1005', 'Redwood Consulting LLC', 'finance@redwood.example', '+1 (503) 555-0110', 30, 25000],
    ['C-1006', 'Coastal Retail Partners', 'invoices@coastalretail.example', '+1 (619) 555-0175', 60, 90000],
  ]
  customerSeeds.forEach(([code, name, email, phone, terms, limit], index) => {
    store.customers.push({
      id: stableId(1 + index, 5),
      companyId,
      code,
      name,
      email,
      phone,
      paymentTermsDays: terms,
      creditLimit: limit,
      taxExempt: index === 3,
      currencyCode: 'USD',
      isActive: true,
      notes: null,
    })
  })

  /* Vendors */
  const vendorSeeds: Array<[string, string, string, number, boolean]> = [
    ['V-2001', 'Pacific Office Supplies', 'sales@pacificoffice.example', 30, false],
    ['V-2002', 'Grid Energy Utilities', 'billing@gridenergy.example', 15, false],
    ['V-2003', 'Harbour Property Group', 'rent@harbourproperty.example', 5, false],
    ['V-2004', 'Brightline Marketing', 'ar@brightline.example', 30, true],
    ['V-2005', 'Vector Components Inc.', 'orders@vectorcomponents.example', 45, false],
  ]
  vendorSeeds.forEach(([code, name, email, terms, is1099], index) => {
    store.vendors.push({
      id: stableId(1 + index, 6),
      companyId,
      code,
      name,
      email,
      phone: null,
      paymentTermsDays: terms,
      currencyCode: 'USD',
      is1099Vendor: is1099,
      isActive: true,
    })
  })

  /* Items */
  const revenue = accountByKey(SYSTEM_KEYS.DefaultSalesRevenue)
  const cogs = accountByKey(SYSTEM_KEYS.DefaultCogs)
  const inventoryAsset = accountByCode('1200')
  const itemSeeds: Array<[string, string, number, number, number, number]> = [
    ['SKU-100', 'Ergonomic Mesh Chair', ItemType.Inventory, 349, 189, 40],
    ['SKU-101', 'Standing Desk 160cm', ItemType.Inventory, 799, 455, 25],
    ['SKU-102', '27" 4K Monitor', ItemType.Inventory, 529, 372, 30],
    ['SKU-103', 'Docking Station USB-C', ItemType.Inventory, 189, 98, 60],
    ['SKU-200', 'Onsite Installation', ItemType.Service, 250, 0, 0],
    ['SKU-201', 'Annual Support Plan', ItemType.Service, 1200, 0, 0],
    ['SKU-300', 'Thermal Paper Rolls (box)', ItemType.NonInventory, 42, 21, 0],
    ['SKU-301', 'Whiteboard Markers (pack)', ItemType.NonInventory, 18, 7.5, 0],
  ]
  itemSeeds.forEach(([sku, name, type, price, cost, reorder], index) => {
    store.items.push({
      id: stableId(1 + index, 7),
      companyId,
      sku,
      name,
      description: null,
      type,
      salesPrice: price,
      purchaseCost: cost,
      incomeAccountId: revenue.id,
      expenseAccountId: type === ItemType.Inventory ? cogs.id : accountByCode('6300').id,
      inventoryAssetAccountId: type === ItemType.Inventory ? inventoryAsset.id : null,
      valuationMethod: 2,
      quantityOnHand: type === ItemType.Inventory ? 400 + index * 60 : 0,
      averageCost: cost,
      reorderPoint: reorder,
      defaultTaxCodeId: type === ItemType.Inventory ? store.taxCodes[0].id : null,
      isActive: true,
    })
  })

  /* Bank accounts */
  const cash = accountByCode('1000')
  store.bankAccounts.push(
    {
      id: stableId(1, 8),
      companyId,
      name: 'Operating Account',
      bankName: 'First Republic Bank',
      accountNumberMasked: '•••• 4821',
      glAccountId: cash.id,
      currencyCode: 'USD',
      openingBalance: 250000,
      openingBalanceDate: yearStart(year),
      isActive: true,
    },
    {
      id: stableId(2, 8),
      companyId,
      name: 'Payroll Account',
      bankName: 'First Republic Bank',
      accountNumberMasked: '•••• 7734',
      glAccountId: cash.id,
      currencyCode: 'USD',
      openingBalance: 60000,
      openingBalanceDate: yearStart(year),
      isActive: true,
    },
  )

  /* Opening balances */
  postEntry({
    entryDate: yearStart(year),
    sourceType: JournalSourceType.OpeningBalance,
    memo: 'Opening balances for the fiscal year',
    lines: [
      { accountId: cash.id, debit: 310000, description: 'Cash and bank' },
      { accountId: inventoryAsset.id, debit: 535180, description: 'Inventory on hand' },
      { accountId: accountByCode('1500').id, debit: 180000, description: 'Fixed assets at cost' },
      { accountId: accountByKey(SYSTEM_KEYS.OpeningBalanceEquity).id, credit: 1025180, description: 'Opening equity' },
    ],
  })

  /* Historical activity: invoices + bills + payments */
  const base = new Date(Date.UTC(year, new Date().getMonth(), 1, 12))

  const invoiceSeeds: Array<{
    customer: number
    daysAgo: number
    terms: number
    status: number
    lines: Array<[number, number, number?]>
  }> = [
    { customer: 0, daysAgo: 150, terms: 30, status: InvoiceStatus.Paid, lines: [[0, 240], [3, 360]] },
    { customer: 1, daysAgo: 120, terms: 15, status: InvoiceStatus.Paid, lines: [[2, 180], [4, 48]] },
    { customer: 2, daysAgo: 75, terms: 45, status: InvoiceStatus.PartiallyPaid, lines: [[1, 200], [0, 120]] },
    { customer: 3, daysAgo: 40, terms: 30, status: InvoiceStatus.Sent, lines: [[5, 72], [4, 96]] },
    { customer: 4, daysAgo: 18, terms: 30, status: InvoiceStatus.Sent, lines: [[3, 280], [2, 88]] },
    { customer: 5, daysAgo: 5, terms: 60, status: InvoiceStatus.Draft, lines: [[1, 120]] },
  ]

  invoiceSeeds.forEach((seedInvoice, index) => {
    const date = shiftDays(base, -seedInvoice.daysAgo)
    const customer = store.customers[seedInvoice.customer]
    const lines: InvoiceLine[] = seedInvoice.lines.map(([itemIndex, quantity, discount], lineIndex) => {
      const item = store.items[itemIndex]
      const gross = round2(quantity * item.salesPrice * (1 - (discount ?? 0) / 100))
      return {
        id: guid('11e2'),
        invoiceId: '',
        lineNumber: lineIndex + 1,
        itemId: item.id,
        description: item.name,
        quantity,
        unitPrice: item.salesPrice,
        discountPercent: discount ?? 0,
        taxCodeId: store.taxCodes[0].id,
        taxAmount: applyTax(gross, store.taxCodes[0].id),
        lineTotal: gross,
        revenueAccountId: revenue.id,
      }
    })
    const totals = computeInvoiceTotals(lines)
    const invoice: Invoice = {
      id: guid('1a0c'),
      companyId,
      invoiceNumber: `INV-${String(1 + index).padStart(6, '0')}`,
      customerId: customer.id,
      invoiceDate: date,
      dueDate: shiftDays(date, seedInvoice.terms),
      status: InvoiceStatus.Draft,
      currencyCode: 'USD',
      exchangeRateToBase: 1,
      subTotal: totals.subTotal,
      taxTotal: totals.taxTotal,
      total: totals.total,
      amountPaid: 0,
      memo: null,
      terms: `Net ${seedInvoice.terms}`,
      journalEntryId: null,
      lines,
    }
    invoice.lines.forEach((line) => (line.invoiceId = invoice.id))
    store.invoices.push(invoice)

    if (seedInvoice.status === InvoiceStatus.Draft) return
    postInvoice(invoice)

    if (seedInvoice.status === InvoiceStatus.Paid) {
      const payment: CustomerPayment = {
        id: guid('1a0d'),
        companyId,
        paymentNumber: nextNumber('CP', 'PMT'),
        customerId: customer.id,
        paymentDate: shiftDays(date, 12),
        amount: invoice.total,
        method: 3,
        referenceNumber: `WIRE-${1000 + index}`,
        bankAccountId: store.bankAccounts[0].id,
        currencyCode: 'USD',
        unappliedAmount: 0,
        journalEntryId: null,
        memo: null,
        applications: [{ id: guid('1a0e'), invoiceId: invoice.id, amountApplied: invoice.total }],
      }
      store.customerPayments.push(payment)
      postCustomerPayment(payment)
    }

    if (seedInvoice.status === InvoiceStatus.PartiallyPaid) {
      const partial = round2(invoice.total * 0.4)
      const payment: CustomerPayment = {
        id: guid('1a0d'),
        companyId,
        paymentNumber: nextNumber('CP', 'PMT'),
        customerId: customer.id,
        paymentDate: shiftDays(date, 20),
        amount: partial,
        method: 2,
        referenceNumber: `CHK-${4000 + index}`,
        bankAccountId: store.bankAccounts[0].id,
        currencyCode: 'USD',
        unappliedAmount: 0,
        journalEntryId: null,
        memo: null,
        applications: [{ id: guid('1a0e'), invoiceId: invoice.id, amountApplied: partial }],
      }
      store.customerPayments.push(payment)
      postCustomerPayment(payment)
    }
  })

  const billSeeds: Array<{ vendor: number; daysAgo: number; terms: number; status: number; lines: Array<[number, number]> }> = [
    { vendor: 0, daysAgo: 130, terms: 30, status: BillStatus.Paid, lines: [[6, 30], [7, 40]] },
    { vendor: 2, daysAgo: 95, terms: 5, status: BillStatus.Paid, lines: [[0, 0]] },
    { vendor: 1, daysAgo: 60, terms: 15, status: BillStatus.PartiallyPaid, lines: [[0, 0]] },
    { vendor: 4, daysAgo: 25, terms: 45, status: BillStatus.Approved, lines: [[2, 15], [3, 25]] },
    { vendor: 3, daysAgo: 8, terms: 30, status: BillStatus.Draft, lines: [[0, 0]] },
  ]

  billSeeds.forEach((seedBill, index) => {
    const date = shiftDays(base, -seedBill.daysAgo)
    const vendor = store.vendors[seedBill.vendor]
    const lines: BillLine[] = seedBill.lines.map(([itemIndex, quantity], lineIndex) => {
      const item = store.items[itemIndex]
      const qty = quantity || 1
      const net = round2(qty * item.purchaseCost)
      return {
        id: guid('1b0c'),
        billId: '',
        lineNumber: lineIndex + 1,
        itemId: item.id,
        description: item.name,
        quantity: qty,
        unitCost: item.purchaseCost,
        taxCodeId: null,
        taxAmount: 0,
        lineTotal: net,
        expenseAccountId: item.type === ItemType.Inventory ? inventoryAsset.id : accountByCode('6300').id,
      }
    })

    // Rent / utility vendors have no catalogue items — model them as service lines.
    if (seedBill.lines.length === 1 && seedBill.lines[0][1] === 0) {
      const amount = seedBill.vendor === 2 ? 8000 : seedBill.vendor === 1 ? 1620 : 5000
      const accountCode = seedBill.vendor === 2 ? '6000' : seedBill.vendor === 1 ? '6200' : '6900'
      lines.length = 0
      lines.push({
        id: guid('1b0c'),
        billId: '',
        lineNumber: 1,
        itemId: null,
        description:
          seedBill.vendor === 2 ? 'Monthly office rent' : seedBill.vendor === 1 ? 'Electricity and water' : 'Professional services',
        quantity: 1,
        unitCost: amount,
        taxCodeId: null,
        taxAmount: 0,
        lineTotal: amount,
        expenseAccountId: accountByCode(accountCode).id,
      })
    }

    const subTotal = round2(lines.reduce((sum, line) => sum + line.lineTotal, 0))
    const bill: Bill = {
      id: guid('1b0d'),
      companyId,
      billNumber: `BILL-${String(1 + index).padStart(6, '0')}`,
      vendorInvoiceNumber: `VINV-${9000 + index}`,
      vendorId: vendor.id,
      billDate: date,
      dueDate: shiftDays(date, seedBill.terms),
      status: BillStatus.Draft,
      currencyCode: 'USD',
      exchangeRateToBase: 1,
      subTotal,
      taxTotal: 0,
      total: subTotal,
      amountPaid: 0,
      memo: null,
      journalEntryId: null,
      lines,
    }
    bill.lines.forEach((line) => (line.billId = bill.id))
    store.bills.push(bill)

    if (seedBill.status === BillStatus.Draft) return
    postBill(bill)

    if (seedBill.status === BillStatus.Paid) {
      const payment: VendorPayment = {
        id: guid('1b0e'),
        companyId,
        paymentNumber: nextNumber('VP', 'VPMT'),
        vendorId: vendor.id,
        paymentDate: shiftDays(date, 10),
        amount: bill.total,
        method: 3,
        referenceNumber: `ACH-${2000 + index}`,
        bankAccountId: store.bankAccounts[0].id,
        currencyCode: 'USD',
        unappliedAmount: 0,
        journalEntryId: null,
        memo: null,
        applications: [{ id: guid('1b0f'), billId: bill.id, amountApplied: bill.total }],
      }
      store.vendorPayments.push(payment)
      postVendorPayment(payment)
    }

    if (seedBill.status === BillStatus.PartiallyPaid) {
      const partial = round2(bill.total * 0.5)
      const payment: VendorPayment = {
        id: guid('1b0e'),
        companyId,
        paymentNumber: nextNumber('VP', 'VPMT'),
        vendorId: vendor.id,
        paymentDate: shiftDays(date, 18),
        amount: partial,
        method: 2,
        referenceNumber: `CHK-${7000 + index}`,
        bankAccountId: store.bankAccounts[0].id,
        currencyCode: 'USD',
        unappliedAmount: 0,
        journalEntryId: null,
        memo: null,
        applications: [{ id: guid('1b0f'), billId: bill.id, amountApplied: partial }],
      }
      store.vendorPayments.push(payment)
      postVendorPayment(payment)
    }
  })

  /* Recurring operating expenses */
  const rent = accountByCode('6000').id
  const salaries = accountByCode('6100').id
  const utilities = accountByCode('6200').id
  for (let month = 0; month < new Date().getMonth(); month += 1) {
    const date = new Date(Date.UTC(year, month, 28, 12)).toISOString()
    postEntry({
      entryDate: date,
      sourceType: JournalSourceType.Adjustment,
      memo: `Operating expenses ${MONTHS[month]} ${year}`,
      lines: [
        { accountId: rent, debit: 8000, description: 'Office rent' },
        { accountId: salaries, debit: 16000, description: 'Payroll' },
        { accountId: utilities, debit: round2(1600 + month * 45), description: 'Utilities' },
        { accountId: cash.id, credit: round2(25600 + month * 45), description: 'Paid from operating account' },
      ],
    })
  }

  /* Fixed assets + a depreciation run */
  const assetAccount = accountByCode('1500')
  const accumDep = accountByCode('1590')
  const depExpense = accountByCode('6400')
  const assetSeeds: Array<[string, string, number, number, number, number]> = [
    ['FA-1001', 'Delivery Van — Ford Transit', 48000, 6000, 60, DepreciationMethod.StraightLine],
    ['FA-1002', 'Server Rack & Infrastructure', 32000, 2000, 48, DepreciationMethod.StraightLine],
    ['FA-1003', 'Office Fit-out', 65000, 0, 84, DepreciationMethod.StraightLine],
    ['FA-1004', 'Warehouse Forklift', 27500, 3500, 72, DepreciationMethod.DecliningBalance],
  ]
  assetSeeds.forEach(([code, name, cost, salvage, life, method], index) => {
    store.fixedAssets.push({
      id: guid('1f0a'),
      companyId,
      code,
      name,
      acquisitionDate: shiftDays(yearStart(year), -(40 + index * 25)),
      acquisitionCost: cost,
      salvageValue: salvage,
      usefulLifeMonths: life,
      method,
      decliningBalanceRatePercent: method === DepreciationMethod.DecliningBalance ? 25 : null,
      assetAccountId: assetAccount.id,
      accumulatedDepreciationAccountId: accumDep.id,
      depreciationExpenseAccountId: depExpense.id,
      status: AssetStatus.Active,
      disposalDate: null,
      disposalProceeds: null,
      accumulatedDepreciation: 0,
      depreciationEntries: [],
    })
  })

  runDepreciation(new Date(Date.UTC(year, Math.max(new Date().getMonth() - 1, 0), 0, 12)).toISOString())

  /* Bank transactions (unreconciled) */
  store.bankTransactions.push(
    {
      id: guid('1c0a'),
      bankAccountId: store.bankAccounts[0].id,
      transactionDate: shiftDays(new Date(), -12),
      description: 'Card payment — Pacific Office Supplies',
      type: 2,
      amount: 1840,
      referenceNumber: 'CARD-88213',
      journalEntryId: null,
      isReconciled: false,
      bankReconciliationId: null,
    },
    {
      id: guid('1c0b'),
      bankAccountId: store.bankAccounts[0].id,
      transactionDate: shiftDays(new Date(), -7),
      description: 'Bank service charge',
      type: 4,
      amount: 65,
      referenceNumber: 'FEE-OCT',
      journalEntryId: null,
      isReconciled: false,
      bankReconciliationId: null,
    },
    {
      id: guid('1c0c'),
      bankAccountId: store.bankAccounts[0].id,
      transactionDate: shiftDays(new Date(), -3),
      description: 'Customer deposit — Northwind Traders',
      type: 1,
      amount: 8450,
      referenceNumber: 'DEP-55231',
      journalEntryId: null,
      isReconciled: false,
      bankReconciliationId: null,
    },
    {
      id: guid('1c0d'),
      bankAccountId: store.bankAccounts[0].id,
      transactionDate: shiftDays(new Date(), -40),
      description: 'Interest earned',
      type: 5,
      amount: 412.55,
      referenceNumber: 'INT-Q3',
      journalEntryId: null,
      isReconciled: true,
      bankReconciliationId: null,
    },
  )

  /* Budget for the fiscal year */
  const budget: Budget = {
    id: guid('1d0a'),
    companyId,
    name: `Operating Budget FY${year}`,
    fiscalYearId: fiscalYear.id,
    isActive: true,
    lines: [],
  }
  const budgetTargets: Array<[string, number]> = [
    ['4000', 540000],
    ['5000', 210000],
    ['6000', 96000],
    ['6100', 192000],
    ['6200', 21000],
    ['6300', 18000],
    ['6400', 36000],
  ]
  for (const [code, annual] of budgetTargets) {
    const account = accountByCode(code)
    for (let month = 1; month <= 12; month += 1) {
      budget.lines.push({
        id: guid('1d0b'),
        accountId: account.id,
        fiscalPeriodId: store.fiscalPeriods.find((period) => period.fiscalYearId === fiscalYear.id && period.periodNumber === month)!.id,
        amount: round2(annual / 12),
      })
    }
  }
  store.budgets.push(budget)
}

/** Straight-line / declining-balance depreciation for a period end date. */
export function runDepreciation(periodEndDate: string): number {
  let count = 0
  for (const asset of store.fixedAssets) {
    if (asset.status !== AssetStatus.Active) continue
    if (new Date(asset.acquisitionDate).getTime() > new Date(periodEndDate).getTime()) continue

    const depreciableBase = asset.acquisitionCost - asset.salvageValue
    let amount: number
    if (asset.method === DepreciationMethod.DecliningBalance) {
      const rate = (asset.decliningBalanceRatePercent ?? 25) / 100 / 12
      amount = round2((asset.acquisitionCost - asset.accumulatedDepreciation) * rate)
    } else {
      amount = round2(depreciableBase / asset.usefulLifeMonths)
    }

    if (asset.accumulatedDepreciation + amount > depreciableBase) {
      amount = round2(depreciableBase - asset.accumulatedDepreciation)
    }
    if (amount <= 0) {
      continue
    }

    asset.accumulatedDepreciation = round2(asset.accumulatedDepreciation + amount)
    if (asset.accumulatedDepreciation >= depreciableBase - 0.01) asset.status = AssetStatus.FullyDepreciated
    asset.depreciationEntries.push({ id: guid('1f0b'), periodDate: periodEndDate, amount })

    postEntry({
      entryDate: periodEndDate,
      sourceType: JournalSourceType.Depreciation,
      sourceId: asset.id,
      memo: `Depreciation ${asset.code} — ${asset.name}`,
      lines: [
        { accountId: asset.depreciationExpenseAccountId, debit: amount, description: asset.name },
        { accountId: asset.accumulatedDepreciationAccountId, credit: amount, description: asset.name },
      ],
    })
    count += 1
  }
  return count
}

export { SYSTEM_KEYS }
