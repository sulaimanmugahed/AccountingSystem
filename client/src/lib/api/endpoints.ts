/**
 * One function per API endpoint, grouped by module. Pages/components should
 * consume these through TanStack Query hooks (see `src/features/**\/queries.ts`).
 */
import { api } from '@/lib/api/client'
import type {
  Account,
  AgingReport,
  AuthSession,
  BalanceSheetReport,
  BankAccount,
  BankAccountRequest,
  BankReconciliation,
  BankTransaction,
  BankTransactionRequest,
  Bill,
  Budget,
  CashFlowReport,
  Company,
  CreateAccountRequest,
  CreateBillRequest,
  CreateBudgetRequest,
  CreateInvoiceRequest,
  CreateJournalEntryRequest,
  Customer,
  CustomerPayment,
  CustomerRequest,
  DisposeAssetRequest,
  FixedAsset,
  FixedAssetRequest,
  FiscalPeriod,
  FiscalYear,
  GeneralLedgerReport,
  IncomeStatementReport,
  Invoice,
  Item,
  ItemRequest,
  JournalEntry,
  LoginRequest,
  RecordCustomerPaymentRequest,
  RecordVendorPaymentRequest,
  StockTransaction,
  TaxCode,
  TaxCodeRequest,
  TrialBalanceReport,
  Vendor,
  VendorPayment,
  VendorRequest,
} from '@/lib/types'

export const authApi = {
  login: (payload: LoginRequest) =>
    api.post<AuthSession>('/auth/login', payload, undefined),
  register: (payload: { email: string; password: string; fullName: string; role: string }) =>
    api.post<{ id: string; email: string }>('/auth/register', payload),
}

export const companyApi = {
  current: () => api.get<Company>('/companies/current'),
}

export const accountsApi = {
  list: (includeInactive = false) =>
    api.get<Account[]>('/accounts', { includeInactive: includeInactive || undefined }),
  get: (id: string) => api.get<Account>(`/accounts/${id}`),
  create: (payload: CreateAccountRequest) => api.post<Account>('/accounts', payload),
  deactivate: (id: string) => api.delete<void>(`/accounts/${id}`),
}

export const journalEntriesApi = {
  list: (filters: { from?: string; to?: string } = {}) =>
    api.get<JournalEntry[]>('/journalentries', { from: filters.from, to: filters.to }),
  get: (id: string) => api.get<JournalEntry>(`/journalentries/${id}`),
  create: (payload: CreateJournalEntryRequest) =>
    api.post<JournalEntry>('/journalentries', payload),
  reverse: (id: string, reversalDate?: string) =>
    api.post<JournalEntry>(`/journalentries/${id}/reverse`, undefined, { reversalDate }),
}

export const customersApi = {
  list: (includeInactive = false) =>
    api.get<Customer[]>('/customers', { includeInactive: includeInactive || undefined }),
  create: (payload: CustomerRequest) => api.post<Customer>('/customers', payload),
  update: (id: string, payload: CustomerRequest) => api.put<void>(`/customers/${id}`, payload),
  deactivate: (id: string) => api.delete<void>(`/customers/${id}`),
}

export const vendorsApi = {
  list: (includeInactive = false) =>
    api.get<Vendor[]>('/vendors', { includeInactive: includeInactive || undefined }),
  create: (payload: VendorRequest) => api.post<Vendor>('/vendors', payload),
  update: (id: string, payload: VendorRequest) => api.put<void>(`/vendors/${id}`, payload),
  deactivate: (id: string) => api.delete<void>(`/vendors/${id}`),
}

export const invoicesApi = {
  list: (customerId?: string) => api.get<Invoice[]>('/invoices', { customerId }),
  get: (id: string) => api.get<Invoice>(`/invoices/${id}`),
  create: (payload: CreateInvoiceRequest) => api.post<Invoice>('/invoices', payload),
  post: (id: string) => api.post<Invoice>(`/invoices/${id}/post`),
  void: (id: string) => api.post<void>(`/invoices/${id}/void`),
}

export const billsApi = {
  list: (vendorId?: string) => api.get<Bill[]>('/bills', { vendorId }),
  get: (id: string) => api.get<Bill>(`/bills/${id}`),
  create: (payload: CreateBillRequest) => api.post<Bill>('/bills', payload),
  post: (id: string) => api.post<Bill>(`/bills/${id}/post`),
  void: (id: string) => api.post<void>(`/bills/${id}/void`),
}

export const customerPaymentsApi = {
  list: (customerId?: string) => api.get<CustomerPayment[]>('/customerpayments', { customerId }),
  create: (payload: RecordCustomerPaymentRequest) =>
    api.post<CustomerPayment>('/customerpayments', payload),
}

export const vendorPaymentsApi = {
  list: (vendorId?: string) => api.get<VendorPayment[]>('/vendorpayments', { vendorId }),
  create: (payload: RecordVendorPaymentRequest) =>
    api.post<VendorPayment>('/vendorpayments', payload),
}

export const bankAccountsApi = {
  list: () => api.get<BankAccount[]>('/bankaccounts'),
  create: (payload: BankAccountRequest) => api.post<BankAccount>('/bankaccounts', payload),
  transactions: (id: string) =>
    api.get<BankTransaction[]>(`/bankaccounts/${id}/transactions`),
  addTransaction: (id: string, payload: BankTransactionRequest) =>
    api.post<BankTransaction>(`/bankaccounts/${id}/transactions`, payload),
  startReconciliation: (
    id: string,
    payload: { statementDate: string; statementBeginningBalance: number; statementEndingBalance: number },
  ) => api.post<BankReconciliation>(`/bankaccounts/${id}/reconciliations`, payload),
  clearTransaction: (reconciliationId: string, transactionId: string) =>
    api.post<void>(`/bankaccounts/reconciliations/${reconciliationId}/transactions/${transactionId}/clear`),
  completeReconciliation: (reconciliationId: string) =>
    api.post<BankReconciliation>(`/bankaccounts/reconciliations/${reconciliationId}/complete`),
}

export const itemsApi = {
  list: (includeInactive = false) =>
    api.get<Item[]>('/items', { includeInactive: includeInactive || undefined }),
  create: (payload: ItemRequest) => api.post<Item>('/items', payload),
  deactivate: (id: string) => api.delete<void>(`/items/${id}`),
  stockTransactions: (id: string) => api.get<StockTransaction[]>(`/items/${id}/stock-transactions`),
}

export const fixedAssetsApi = {
  list: () => api.get<FixedAsset[]>('/fixedassets'),
  create: (payload: FixedAssetRequest) => api.post<FixedAsset>('/fixedassets', payload),
  runDepreciation: (periodEndDate: string) =>
    api.post<{ assetsDepreciated: number }>('/fixedassets/run-depreciation', undefined, {
      periodEndDate,
    }),
  dispose: (id: string, payload: DisposeAssetRequest) =>
    api.post<void>(`/fixedassets/${id}/dispose`, payload),
}

export const budgetsApi = {
  list: () => api.get<Budget[]>('/budgets'),
  create: (payload: CreateBudgetRequest) => api.post<Budget>('/budgets', payload),
}

export const taxCodesApi = {
  list: () => api.get<TaxCode[]>('/taxcodes'),
  create: (payload: TaxCodeRequest) => api.post<TaxCode>('/taxcodes', payload),
}

export const fiscalPeriodsApi = {
  years: () => api.get<FiscalYear[]>('/fiscalperiods/years'),
  periods: (yearId: string) => api.get<FiscalPeriod[]>(`/fiscalperiods/years/${yearId}/periods`),
  closePeriod: (periodId: string) => api.post<void>(`/fiscalperiods/periods/${periodId}/close`),
  reopenPeriod: (periodId: string) => api.post<void>(`/fiscalperiods/periods/${periodId}/reopen`),
  closeYear: (yearId: string) => api.post<void>(`/fiscalperiods/years/${yearId}/close`),
}

export const reportsApi = {
  trialBalance: (asOfDate: string) =>
    api.get<TrialBalanceReport>('/reports/trial-balance', { asOfDate }),
  incomeStatement: (startDate: string, endDate: string) =>
    api.get<IncomeStatementReport>('/reports/income-statement', { startDate, endDate }),
  balanceSheet: (asOfDate: string) =>
    api.get<BalanceSheetReport>('/reports/balance-sheet', { asOfDate }),
  generalLedger: (accountId: string, startDate: string, endDate: string) =>
    api.get<GeneralLedgerReport>('/reports/general-ledger', { accountId, startDate, endDate }),
  arAging: (asOfDate: string) => api.get<AgingReport>('/reports/ar-aging', { asOfDate }),
  apAging: (asOfDate: string) => api.get<AgingReport>('/reports/ap-aging', { asOfDate }),
  cashFlow: (startDate: string, endDate: string) =>
    api.get<CashFlowReport>('/reports/cash-flow', { startDate, endDate }),
}
