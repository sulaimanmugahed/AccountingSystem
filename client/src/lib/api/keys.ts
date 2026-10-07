/**
 * Central TanStack Query key registry — keeps invalidation predictable.
 */
export const queryKeys = {
  company: ['company'] as const,
  session: ['session'] as const,

  accounts: (includeInactive = false) => ['accounts', { includeInactive }] as const,
  account: (id: string) => ['accounts', id] as const,

  journalEntries: (filters: { from?: string; to?: string } = {}) =>
    ['journal-entries', filters] as const,
  journalEntry: (id: string) => ['journal-entries', id] as const,

  customers: (includeInactive = false) => ['customers', { includeInactive }] as const,
  vendors: (includeInactive = false) => ['vendors', { includeInactive }] as const,

  invoices: (customerId?: string) => ['invoices', { customerId: customerId ?? null }] as const,
  invoice: (id: string) => ['invoices', id] as const,
  bills: (vendorId?: string) => ['bills', { vendorId: vendorId ?? null }] as const,
  bill: (id: string) => ['bills', id] as const,

  customerPayments: (customerId?: string) =>
    ['customer-payments', { customerId: customerId ?? null }] as const,
  vendorPayments: (vendorId?: string) =>
    ['vendor-payments', { vendorId: vendorId ?? null }] as const,

  bankAccounts: ['bank-accounts'] as const,
  bankTransactions: (id: string) => ['bank-accounts', id, 'transactions'] as const,

  items: (includeInactive = false) => ['items', { includeInactive }] as const,
  stockTransactions: (id: string) => ['items', id, 'stock-transactions'] as const,

  fixedAssets: ['fixed-assets'] as const,

  budgets: ['budgets'] as const,

  taxCodes: ['tax-codes'] as const,

  fiscalYears: ['fiscal-years'] as const,
  fiscalPeriods: (yearId: string) => ['fiscal-years', yearId, 'periods'] as const,

  trialBalance: (asOfDate: string) => ['reports', 'trial-balance', asOfDate] as const,
  incomeStatement: (startDate: string, endDate: string) =>
    ['reports', 'income-statement', startDate, endDate] as const,
  balanceSheet: (asOfDate: string) => ['reports', 'balance-sheet', asOfDate] as const,
  generalLedger: (accountId: string, startDate: string, endDate: string) =>
    ['reports', 'general-ledger', accountId, startDate, endDate] as const,
  arAging: (asOfDate: string) => ['reports', 'ar-aging', asOfDate] as const,
  apAging: (asOfDate: string) => ['reports', 'ap-aging', asOfDate] as const,
  cashFlow: (startDate: string, endDate: string) =>
    ['reports', 'cash-flow', startDate, endDate] as const,
}

/** Everything that a posting action can affect. Used to invalidate broadly after writes. */
export const ledgerDependentKeys = [
  'accounts',
  'journal-entries',
  'reports',
  'customers',
  'vendors',
  'invoices',
  'bills',
  'customer-payments',
  'vendor-payments',
  'bank-accounts',
  'items',
  'fixed-assets',
  'budgets',
  'tax-codes',
  'fiscal-years',
  'company',
]
