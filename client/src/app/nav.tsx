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
  /** i18n key resolved by the consumer (see AppShell). */
  titleKey: string
  href: string
  icon?: React.ComponentType<{ className?: string }>
  /** Roles allowed to see the entry. Empty = everyone. */
  roles?: string[]
  badge?: string
}

export interface NavGroup {
  /** i18n key resolved by the consumer (see AppShell). */
  titleKey: string
  items: NavItem[]
}

export const navGroups: NavGroup[] = [
  {
    titleKey: 'nav.groups.overview',
    items: [
      { titleKey: 'nav.items.dashboard', href: '/', icon: LayoutDashboard },
      { titleKey: 'nav.items.reports', href: '/reports', icon: BarChart3 },
    ],
  },
  {
    titleKey: 'nav.groups.generalLedger',
    items: [
      { titleKey: 'nav.items.accounts', href: '/gl/accounts', icon: Library },
      { titleKey: 'nav.items.journalEntries', href: '/gl/journal-entries', icon: BookOpen },
      { titleKey: 'nav.items.fiscalPeriods', href: '/gl/fiscal-periods', icon: CalendarClock },
    ],
  },
  {
    titleKey: 'nav.groups.receivables',
    items: [
      { titleKey: 'nav.items.customers', href: '/ar/customers', icon: Users },
      { titleKey: 'nav.items.invoices', href: '/ar/invoices', icon: FileText },
      { titleKey: 'nav.items.customerPayments', href: '/ar/payments', icon: Wallet },
    ],
  },
  {
    titleKey: 'nav.groups.payables',
    items: [
      { titleKey: 'nav.items.vendors', href: '/ap/vendors', icon: Users },
      { titleKey: 'nav.items.bills', href: '/ap/bills', icon: ScrollText },
      { titleKey: 'nav.items.vendorPayments', href: '/ap/payments', icon: CreditCard },
    ],
  },
  {
    titleKey: 'nav.groups.assetsBanking',
    items: [
      { titleKey: 'nav.items.bankAccounts', href: '/banking/accounts', icon: Landmark },
      { titleKey: 'nav.items.items', href: '/inventory/items', icon: Boxes },
      { titleKey: 'nav.items.fixedAssets', href: '/assets/fixed-assets', icon: PiggyBank },
    ],
  },
  {
    titleKey: 'nav.groups.configuration',
    items: [
      { titleKey: 'nav.items.budgets', href: '/budgets', icon: FileSpreadsheet },
      { titleKey: 'nav.items.taxCodes', href: '/tax/codes', icon: Percent },
      { titleKey: 'nav.items.company', href: '/settings/company', icon: Receipt },
    ],
  },
]

export const reportLinks: NavItem[] = [
  { titleKey: 'reports.trialBalance.title', href: '/reports/trial-balance' },
  { titleKey: 'reports.incomeStatement.title', href: '/reports/income-statement' },
  { titleKey: 'reports.balanceSheet.title', href: '/reports/balance-sheet' },
  { titleKey: 'reports.generalLedger.title', href: '/reports/general-ledger' },
  { titleKey: 'reports.arAging.title', href: '/reports/ar-aging' },
  { titleKey: 'reports.apAging.title', href: '/reports/ap-aging' },
  { titleKey: 'reports.cashFlow.title', href: '/reports/cash-flow' },
]
