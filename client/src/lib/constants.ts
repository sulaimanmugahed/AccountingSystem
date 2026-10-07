import { AccountType, TaxType } from '@/lib/enums'

/** Currencies seeded by the API's DataSeeder. */
export const CURRENCIES = [
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
]

export const ROLES = ['Admin', 'Accountant', 'ARClerk', 'APClerk', 'Viewer'] as const
export type Role = (typeof ROLES)[number]

/** Roles allowed to create/publish financial documents. */
export const WRITE_ROLES: string[] = ['Admin', 'Accountant', 'ARClerk', 'APClerk']

export const ACCOUNT_TYPE_OPTIONS = [
  { value: AccountType.Asset, label: 'Asset' },
  { value: AccountType.Liability, label: 'Liability' },
  { value: AccountType.Equity, label: 'Equity' },
  { value: AccountType.Revenue, label: 'Revenue' },
  { value: AccountType.Expense, label: 'Expense' },
]

export const TAX_TYPE_OPTIONS = [
  { value: TaxType.Sales, label: 'Sales' },
  { value: TaxType.Purchase, label: 'Purchase' },
]

export const ACCOUNT_SUBTYPE_SUGGESTIONS = [
  'Current Asset',
  'Fixed Asset',
  'Other Asset',
  'Current Liability',
  'Long Term Liability',
  'Equity',
  'Operating Revenue',
  'Other Revenue',
  'Cost of Goods Sold',
  'Operating Expense',
  'Other Expense',
]

export const PAYMENT_METHOD_OPTIONS_FALLBACK = [
  { value: 1, label: 'Cash' },
  { value: 2, label: 'Check' },
  { value: 3, label: 'Bank Transfer' },
  { value: 4, label: 'Credit Card' },
  { value: 5, label: 'Debit Card' },
  { value: 6, label: 'Other' },
]
