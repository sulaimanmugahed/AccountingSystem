import {
  BarChart3,
  BookOpen,
  Boxes,
  CalendarClock,
  CreditCard,
  FileSpreadsheet,
  FileText,
  Landmark,
  LayoutDashboard,
  Library,
  Percent,
  PiggyBank,
  Receipt,
  ScrollText,
  Users,
  Wallet,
} from 'lucide-react'

export interface NavItem {
  title: string
  href: string
  icon?: React.ComponentType<{ className?: string }>
  /** Roles allowed to see the entry. Empty = everyone. */
  roles?: string[]
  badge?: string
}

export interface NavGroup {
  title: string
  items: NavItem[]
}

export const navGroups: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      { title: 'Dashboard', href: '/', icon: LayoutDashboard },
      { title: 'Reports', href: '/reports', icon: BarChart3 },
    ],
  },
  {
    title: 'General Ledger',
    items: [
      { title: 'Chart of Accounts', href: '/gl/accounts', icon: Library },
      { title: 'Journal Entries', href: '/gl/journal-entries', icon: BookOpen },
      { title: 'Fiscal Periods', href: '/gl/fiscal-periods', icon: CalendarClock },
    ],
  },
  {
    title: 'Receivables',
    items: [
      { title: 'Customers', href: '/ar/customers', icon: Users },
      { title: 'Invoices', href: '/ar/invoices', icon: FileText },
      { title: 'Payments', href: '/ar/payments', icon: Wallet },
    ],
  },
  {
    title: 'Payables',
    items: [
      { title: 'Vendors', href: '/ap/vendors', icon: Users },
      { title: 'Bills', href: '/ap/bills', icon: ScrollText },
      { title: 'Payments', href: '/ap/payments', icon: CreditCard },
    ],
  },
  {
    title: 'Assets & Banking',
    items: [
      { title: 'Bank Accounts', href: '/banking/accounts', icon: Landmark },
      { title: 'Items & Inventory', href: '/inventory/items', icon: Boxes },
      { title: 'Fixed Assets', href: '/assets/fixed-assets', icon: PiggyBank },
    ],
  },
  {
    title: 'Configuration',
    items: [
      { title: 'Budgets', href: '/budgets', icon: FileSpreadsheet },
      { title: 'Tax Codes', href: '/tax/codes', icon: Percent },
      { title: 'Company', href: '/settings/company', icon: Receipt },
    ],
  },
]

export const reportLinks: NavItem[] = [
  { title: 'Trial Balance', href: '/reports/trial-balance' },
  { title: 'Income Statement', href: '/reports/income-statement' },
  { title: 'Balance Sheet', href: '/reports/balance-sheet' },
  { title: 'General Ledger', href: '/reports/general-ledger' },
  { title: 'AR Aging', href: '/reports/ar-aging' },
  { title: 'AP Aging', href: '/reports/ap-aging' },
  { title: 'Cash Flow', href: '/reports/cash-flow' },
]
