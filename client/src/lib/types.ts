import {
  AccountType,
  AssetStatus,
  BillStatus,
  DepreciationMethod,
  InvoiceStatus,
  ItemType,
  JournalEntryStatus,
  JournalSourceType,
  NormalBalance,
  PaymentMethod,
  TaxType,
} from '@/lib/enums'

/* ------------------------------------------------------------------ shared */

export interface AuthSession {
  token: string
  email: string
  fullName: string
  companyId: string
  roles: string[]
}

export interface LoginRequest {
  email: string
  password: string
}

export interface CurrentUser {
  id: string
  email: string
  fullName: string
  companyId: string
  roles: string[]
  isActive: boolean
}

export interface Company {
  id: string
  name: string
  legalName?: string | null
  taxRegistrationNumber?: string | null
  baseCurrencyCode: string
  fiscalYearStartMonth: number
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  country?: string | null
  phone?: string | null
  email?: string | null
  isActive: boolean
}

export interface Currency {
  code: string
  name: string
  symbol: string
  isActive: boolean
}

/* ---------------------------------------------------------- general ledger */

export interface Account {
  id: string
  code: string
  name: string
  type: AccountType
  subType?: string | null
  parentAccountId?: string | null
  isActive: boolean
  normalBalance: NormalBalance
}

export interface CreateAccountRequest {
  code: string
  name: string
  type: AccountType
  subType?: string | null
  parentAccountId?: string | null
  description?: string | null
}

export interface JournalLineRequest {
  accountId: string
  debit: number
  credit: number
  description?: string | null
  customerId?: string | null
  vendorId?: string | null
}

export interface CreateJournalEntryRequest {
  entryDate: string
  memo?: string | null
  lines: JournalLineRequest[]
  sourceType: JournalSourceType
  sourceId?: string | null
  currencyCode: string
  exchangeRateToBase: number
}

export interface JournalEntryLine {
  accountId: string
  accountCode: string
  accountName: string
  debit: number
  credit: number
  description?: string | null
}

export interface JournalEntry {
  id: string
  entryNumber: string
  entryDate: string
  status: JournalEntryStatus
  sourceType: JournalSourceType
  memo?: string | null
  totalDebit: number
  totalCredit: number
  lines: JournalEntryLine[]
}

/* ---------------------------------------------------------------- accounting */

export interface Customer {
  id: string
  code: string
  name: string
  email?: string | null
  phone?: string | null
  billingAddressLine1?: string | null
  billingCity?: string | null
  billingState?: string | null
  billingPostalCode?: string | null
  billingCountry?: string | null
  paymentTermsDays: number
  creditLimit: number
  taxExempt: boolean
  defaultTaxCodeId?: string | null
  currencyCode: string
  isActive: boolean
  notes?: string | null
}

export interface CustomerRequest {
  code: string
  name: string
  email?: string | null
  phone?: string | null
  paymentTermsDays: number
  creditLimit: number
  currencyCode: string
}

export interface Vendor {
  id: string
  code: string
  name: string
  email?: string | null
  phone?: string | null
  addressLine1?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  country?: string | null
  paymentTermsDays: number
  defaultTaxCodeId?: string | null
  currencyCode: string
  is1099Vendor: boolean
  isActive: boolean
  notes?: string | null
}

export interface VendorRequest {
  code: string
  name: string
  email?: string | null
  phone?: string | null
  paymentTermsDays: number
  currencyCode: string
  is1099Vendor: boolean
}

/* ------------------------------------------------------------------ sales */

export interface InvoiceLine {
  id: string
  description: string
  quantity: number
  unitPrice: number
  discountPercent: number
  taxAmount: number
  lineTotal: number
}

export interface Invoice {
  id: string
  invoiceNumber: string
  customerId: string
  customerName: string
  invoiceDate: string
  dueDate: string
  status: InvoiceStatus
  subTotal: number
  taxTotal: number
  total: number
  amountPaid: number
  balance: number
  lines: InvoiceLine[]
}

export interface InvoiceLineRequest {
  itemId?: string | null
  description: string
  quantity: number
  unitPrice: number
  discountPercent: number
  taxCodeId?: string | null
  revenueAccountId?: string | null
}

export interface CreateInvoiceRequest {
  customerId: string
  invoiceDate: string
  dueDate: string
  memo?: string | null
  terms?: string | null
  lines: InvoiceLineRequest[]
  currencyCode: string
  exchangeRateToBase: number
}

export interface ApplyPaymentRequest {
  invoiceId: string
  amount: number
}

export interface RecordCustomerPaymentRequest {
  customerId: string
  paymentDate: string
  amount: number
  method: PaymentMethod
  referenceNumber?: string | null
  bankAccountId: string
  applications: ApplyPaymentRequest[]
  memo?: string | null
}

export interface CustomerPayment {
  id: string
  paymentNumber: string
  customerId: string
  paymentDate: string
  amount: number
  unappliedAmount: number
}

/* -------------------------------------------------------------- purchases */

export interface BillLine {
  id: string
  description: string
  quantity: number
  unitCost: number
  taxAmount: number
  lineTotal: number
}

export interface Bill {
  id: string
  billNumber: string
  vendorId: string
  vendorName: string
  billDate: string
  dueDate: string
  status: BillStatus
  subTotal: number
  taxTotal: number
  total: number
  amountPaid: number
  balance: number
  lines: BillLine[]
}

export interface BillLineRequest {
  itemId?: string | null
  description: string
  quantity: number
  unitCost: number
  taxCodeId?: string | null
  expenseAccountId?: string | null
}

export interface CreateBillRequest {
  vendorId: string
  vendorInvoiceNumber?: string | null
  billDate: string
  dueDate: string
  memo?: string | null
  lines: BillLineRequest[]
  currencyCode: string
  exchangeRateToBase: number
}

export interface ApplyBillPaymentRequest {
  billId: string
  amount: number
}

export interface RecordVendorPaymentRequest {
  vendorId: string
  paymentDate: string
  amount: number
  method: PaymentMethod
  referenceNumber?: string | null
  bankAccountId: string
  applications: ApplyBillPaymentRequest[]
  memo?: string | null
}

export interface VendorPayment {
  id: string
  paymentNumber: string
  vendorId: string
  paymentDate: string
  amount: number
  unappliedAmount: number
}

/* ---------------------------------------------------------------- banking */

export interface BankAccount {
  id: string
  name: string
  bankName?: string | null
  accountNumberMasked?: string | null
  glAccountId: string
  currencyCode: string
  openingBalance: number
  openingBalanceDate: string
  isActive: boolean
}

export interface BankAccountRequest {
  name: string
  bankName?: string | null
  accountNumberMasked?: string | null
  glAccountId: string
  currencyCode: string
  openingBalance: number
  openingBalanceDate: string
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

export interface BankTransactionRequest {
  transactionDate: string
  description: string
  type: number
  amount: number
  referenceNumber?: string | null
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

/* -------------------------------------------------------------- inventory */

export interface Item {
  id: string
  sku: string
  name: string
  description?: string | null
  type: ItemType
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

export interface ItemRequest {
  sku: string
  name: string
  description?: string | null
  type: ItemType
  salesPrice: number
  purchaseCost: number
  incomeAccountId?: string | null
  expenseAccountId?: string | null
  inventoryAssetAccountId?: string | null
  defaultTaxCodeId?: string | null
  reorderPoint: number
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

/* ------------------------------------------------------------ fixed assets */

export interface FixedAsset {
  id: string
  code: string
  name: string
  acquisitionDate: string
  acquisitionCost: number
  salvageValue: number
  usefulLifeMonths: number
  method: DepreciationMethod
  decliningBalanceRatePercent?: number | null
  assetAccountId: string
  accumulatedDepreciationAccountId: string
  depreciationExpenseAccountId: string
  status: AssetStatus
  disposalDate?: string | null
  disposalProceeds?: number | null
  accumulatedDepreciation: number
}

export interface FixedAssetRequest {
  code: string
  name: string
  acquisitionDate: string
  acquisitionCost: number
  salvageValue: number
  usefulLifeMonths: number
  method: DepreciationMethod
  assetAccountId: string
  accumulatedDepreciationAccountId: string
  depreciationExpenseAccountId: string
}

export interface DisposeAssetRequest {
  disposalDate: string
  proceeds: number
}

/* --------------------------------------------------------------- budgeting */

export interface BudgetLine {
  id: string
  accountId: string
  fiscalPeriodId: string
  amount: number
}

export interface Budget {
  id: string
  name: string
  fiscalYearId: string
  isActive: boolean
  lines: BudgetLine[]
}

export interface BudgetLineRequest {
  accountId: string
  fiscalPeriodId: string
  amount: number
}

export interface CreateBudgetRequest {
  name: string
  fiscalYearId: string
  lines: BudgetLineRequest[]
}

/* --------------------------------------------------------------------- tax */

export interface TaxCode {
  id: string
  code: string
  name: string
  ratePercent: number
  type: TaxType
  taxPayableOrReceivableAccountId: string
  isActive: boolean
}

export interface TaxCodeRequest {
  code: string
  name: string
  ratePercent: number
  type: TaxType
  taxPayableOrReceivableAccountId: string
}

/* ------------------------------------------------------------- fiscal year */

export interface FiscalYear {
  id: string
  name: string
  startDate: string
  endDate: string
  isClosed: boolean
  closedAtUtc?: string | null
  closedBy?: string | null
}

export interface FiscalPeriod {
  id: string
  fiscalYearId: string
  name: string
  periodNumber: number
  startDate: string
  endDate: string
  status: number
  closedAtUtc?: string | null
  closedBy?: string | null
}

/* ----------------------------------------------------------------- reports */

export interface TrialBalanceRow {
  accountId: string
  accountCode: string
  accountName: string
  accountType: string
  debit: number
  credit: number
}

export interface TrialBalanceReport {
  asOfDate: string
  rows: TrialBalanceRow[]
  totalDebit: number
  totalCredit: number
}

export interface IncomeStatementRow {
  accountCode: string
  accountName: string
  amount: number
}

export interface IncomeStatementReport {
  startDate: string
  endDate: string
  revenues: IncomeStatementRow[]
  totalRevenue: number
  expenses: IncomeStatementRow[]
  totalExpense: number
  netIncome: number
}

export interface BalanceSheetRow {
  accountCode: string
  accountName: string
  amount: number
}

export interface BalanceSheetReport {
  asOfDate: string
  assets: BalanceSheetRow[]
  totalAssets: number
  liabilities: BalanceSheetRow[]
  totalLiabilities: number
  equity: BalanceSheetRow[]
  totalEquityExcludingNetIncome: number
  netIncomeYearToDate: number
  totalEquity: number
  totalLiabilitiesAndEquity: number
}

export interface GeneralLedgerLine {
  date: string
  entryNumber: string
  description?: string | null
  debit: number
  credit: number
  runningBalance: number
  journalEntryId: string
}

export interface GeneralLedgerReport {
  accountCode: string
  accountName: string
  openingBalance: number
  lines: GeneralLedgerLine[]
  closingBalance: number
}

export interface AgingBucket {
  current: number
  days1To30: number
  days31To60: number
  days61To90: number
  over90: number
}

export interface AgingRow {
  partyId: string
  partyName: string
  totalDue: number
  buckets: AgingBucket
}

export interface AgingReport {
  asOfDate: string
  rows: AgingRow[]
  grandTotal: number
}

export interface CashFlowReport {
  startDate: string
  endDate: string
  netIncome: number
  depreciation: number
  changeInAccountsReceivable: number
  changeInInventory: number
  changeInAccountsPayable: number
  netCashFromOperations: number
  netCashFromInvesting: number
  netCashFromFinancing: number
  netChangeInCash: number
  beginningCash: number
  endingCash: number
}

/** Convenience maps for rendering status badges. */
export const invoiceStatusTone: Record<number, 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'> = {
  [InvoiceStatus.Draft]: 'outline',
  [InvoiceStatus.Sent]: 'secondary',
  [InvoiceStatus.PartiallyPaid]: 'warning',
  [InvoiceStatus.Paid]: 'success',
  [InvoiceStatus.Overdue]: 'destructive',
  [InvoiceStatus.Voided]: 'outline',
}

export const billStatusTone: Record<number, 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'> = {
  [BillStatus.Draft]: 'outline',
  [BillStatus.Approved]: 'secondary',
  [BillStatus.PartiallyPaid]: 'warning',
  [BillStatus.Paid]: 'success',
  [BillStatus.Voided]: 'outline',
}

export const assetStatusTone: Record<number, 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'> = {
  [AssetStatus.Active]: 'success',
  [AssetStatus.FullyDepreciated]: 'secondary',
  [AssetStatus.Disposed]: 'outline',
}

export const journalStatusTone: Record<number, 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'> = {
  [JournalEntryStatus.Draft]: 'outline',
  [JournalEntryStatus.Posted]: 'success',
  [JournalEntryStatus.Voided]: 'destructive',
}

export type { AccountType, DepreciationMethod, ItemType, JournalSourceType, NormalBalance, PaymentMethod, TaxType }
