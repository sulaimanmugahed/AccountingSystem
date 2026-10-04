import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/app-shell'
import { PageLoader } from '@/components/common/misc'
import { ProtectedRoute, RoleRoute } from '@/app/protected-route'

const LoginPage = lazy(() => import('@/features/auth/login-page').then((m) => ({ default: m.LoginPage })))
const DashboardPage = lazy(() =>
  import('@/features/dashboard/dashboard-page').then((m) => ({ default: m.DashboardPage })),
)
const AccountsPage = lazy(() => import('@/features/gl/accounts-page').then((m) => ({ default: m.AccountsPage })))
const JournalEntriesPage = lazy(() =>
  import('@/features/gl/journal-entries-page').then((m) => ({ default: m.JournalEntriesPage })),
)
const FiscalPeriodsPage = lazy(() =>
  import('@/features/gl/fiscal-periods-page').then((m) => ({ default: m.FiscalPeriodsPage })),
)
const CustomersPage = lazy(() =>
  import('@/features/ar/customers-page').then((m) => ({ default: m.CustomersPage })),
)
const InvoicesPage = lazy(() => import('@/features/ar/invoices-page').then((m) => ({ default: m.InvoicesPage })))
const CustomerPaymentsPage = lazy(() =>
  import('@/features/ar/customer-payments-page').then((m) => ({ default: m.CustomerPaymentsPage })),
)
const VendorsPage = lazy(() => import('@/features/ap/vendors-page').then((m) => ({ default: m.VendorsPage })))
const BillsPage = lazy(() => import('@/features/ap/bills-page').then((m) => ({ default: m.BillsPage })))
const VendorPaymentsPage = lazy(() =>
  import('@/features/ap/vendor-payments-page').then((m) => ({ default: m.VendorPaymentsPage })),
)
const BankAccountsPage = lazy(() =>
  import('@/features/banking/bank-accounts-page').then((m) => ({ default: m.BankAccountsPage })),
)
const BankAccountDetailPage = lazy(() =>
  import('@/features/banking/bank-account-detail-page').then((m) => ({ default: m.BankAccountDetailPage })),
)
const ItemsPage = lazy(() => import('@/features/inventory/items-page').then((m) => ({ default: m.ItemsPage })))
const FixedAssetsPage = lazy(() =>
  import('@/features/assets/fixed-assets-page').then((m) => ({ default: m.FixedAssetsPage })),
)
const BudgetsPage = lazy(() => import('@/features/budgeting/budgets-page').then((m) => ({ default: m.BudgetsPage })))
const TaxCodesPage = lazy(() => import('@/features/tax/tax-codes-page').then((m) => ({ default: m.TaxCodesPage })))
const CompanyPage = lazy(() => import('@/features/settings/company-page').then((m) => ({ default: m.CompanyPage })))
const ReportsIndexPage = lazy(() =>
  import('@/features/reports/reports-index-page').then((m) => ({ default: m.ReportsIndexPage })),
)
const TrialBalancePage = lazy(() =>
  import('@/features/reports/trial-balance-page').then((m) => ({ default: m.TrialBalancePage })),
)
const IncomeStatementPage = lazy(() =>
  import('@/features/reports/income-statement-page').then((m) => ({ default: m.IncomeStatementPage })),
)
const BalanceSheetPage = lazy(() =>
  import('@/features/reports/balance-sheet-page').then((m) => ({ default: m.BalanceSheetPage })),
)
const GeneralLedgerPage = lazy(() =>
  import('@/features/reports/general-ledger-page').then((m) => ({ default: m.GeneralLedgerPage })),
)
const AgingPage = lazy(() => import('@/features/reports/aging-page').then((m) => ({ default: m.AgingPage })))
const CashFlowPage = lazy(() =>
  import('@/features/reports/cash-flow-page').then((m) => ({ default: m.CashFlowPage })),
)
const NotFoundPage = lazy(() => import('@/features/misc/not-found-page').then((m) => ({ default: m.NotFoundPage })))

export function App() {
  return (
    <Suspense fallback={<PageLoader label="Loading module…" />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />

            <Route path="gl/accounts" element={<AccountsPage />} />
            <Route path="gl/journal-entries" element={<JournalEntriesPage />} />
            <Route path="gl/fiscal-periods" element={<FiscalPeriodsPage />} />

            <Route path="ar/customers" element={<CustomersPage />} />
            <Route path="ar/invoices" element={<InvoicesPage />} />
            <Route path="ar/payments" element={<CustomerPaymentsPage />} />

            <Route path="ap/vendors" element={<VendorsPage />} />
            <Route path="ap/bills" element={<BillsPage />} />
            <Route path="ap/payments" element={<VendorPaymentsPage />} />

            <Route path="banking/accounts" element={<BankAccountsPage />} />
            <Route path="banking/accounts/:id" element={<BankAccountDetailPage />} />

            <Route path="inventory/items" element={<ItemsPage />} />
            <Route path="assets/fixed-assets" element={<FixedAssetsPage />} />
            <Route path="budgets" element={<BudgetsPage />} />
            <Route path="tax/codes" element={<TaxCodesPage />} />

            <Route
              path="settings/company"
              element={
                <RoleRoute roles={['Admin', 'Accountant']}>
                  <CompanyPage />
                </RoleRoute>
              }
            />

            <Route path="reports" element={<ReportsIndexPage />} />
            <Route path="reports/trial-balance" element={<TrialBalancePage />} />
            <Route path="reports/income-statement" element={<IncomeStatementPage />} />
            <Route path="reports/balance-sheet" element={<BalanceSheetPage />} />
            <Route path="reports/general-ledger" element={<GeneralLedgerPage />} />
            <Route path="reports/ar-aging" element={<AgingPage kind="ar" />} />
            <Route path="reports/ap-aging" element={<AgingPage kind="ap" />} />
            <Route path="reports/cash-flow" element={<CashFlowPage />} />

            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
