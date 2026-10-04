/**
 * Every read-side TanStack Query hook used by the app lives here so cache keys,
 * stale times and gating (enabled/placeholderData) stay consistent.
 */
import { useQuery, type UseQueryOptions } from '@tanstack/react-query'
import { queryKeys } from '@/lib/api/keys'
import {
  accountsApi,
  bankAccountsApi,
  billsApi,
  budgetsApi,
  companyApi,
  customerPaymentsApi,
  customersApi,
  fiscalPeriodsApi,
  fixedAssetsApi,
  invoicesApi,
  itemsApi,
  journalEntriesApi,
  reportsApi,
  taxCodesApi,
  vendorPaymentsApi,
  vendorsApi,
} from '@/lib/api/endpoints'

/** 5 minutes for master data that rarely changes. */
const MASTER_STALE = 5 * 60_000

export function useCompany() {
  return useQuery({ queryKey: queryKeys.company, queryFn: companyApi.current, staleTime: 10 * 60_000 })
}

export function useAccounts(includeInactive = false) {
  return useQuery({
    queryKey: queryKeys.accounts(includeInactive),
    queryFn: () => accountsApi.list(includeInactive),
    staleTime: MASTER_STALE,
  })
}

export function useJournalEntries(filters: { from?: string; to?: string } = {}) {
  return useQuery({
    queryKey: queryKeys.journalEntries(filters),
    queryFn: () => journalEntriesApi.list(filters),
  })
}

export function useJournalEntry(id?: string) {
  return useQuery({
    queryKey: queryKeys.journalEntry(id ?? ''),
    queryFn: () => journalEntriesApi.get(id!),
    enabled: !!id,
  })
}

export function useCustomers(includeInactive = false) {
  return useQuery({
    queryKey: queryKeys.customers(includeInactive),
    queryFn: () => customersApi.list(includeInactive),
    staleTime: MASTER_STALE,
  })
}

export function useVendors(includeInactive = false) {
  return useQuery({
    queryKey: queryKeys.vendors(includeInactive),
    queryFn: () => vendorsApi.list(includeInactive),
    staleTime: MASTER_STALE,
  })
}

export function useInvoices(customerId?: string) {
  return useQuery({
    queryKey: queryKeys.invoices(customerId),
    queryFn: () => invoicesApi.list(customerId),
  })
}

export function useInvoice(id?: string) {
  return useQuery({
    queryKey: queryKeys.invoice(id ?? ''),
    queryFn: () => invoicesApi.get(id!),
    enabled: !!id,
  })
}

export function useBills(vendorId?: string) {
  return useQuery({
    queryKey: queryKeys.bills(vendorId),
    queryFn: () => billsApi.list(vendorId),
  })
}

export function useBill(id?: string) {
  return useQuery({
    queryKey: queryKeys.bill(id ?? ''),
    queryFn: () => billsApi.get(id!),
    enabled: !!id,
  })
}

export function useCustomerPayments(customerId?: string) {
  return useQuery({
    queryKey: queryKeys.customerPayments(customerId),
    queryFn: () => customerPaymentsApi.list(customerId),
  })
}

export function useVendorPayments(vendorId?: string) {
  return useQuery({
    queryKey: queryKeys.vendorPayments(vendorId),
    queryFn: () => vendorPaymentsApi.list(vendorId),
  })
}

export function useBankAccounts() {
  return useQuery({
    queryKey: queryKeys.bankAccounts,
    queryFn: bankAccountsApi.list,
    staleTime: MASTER_STALE,
  })
}

export function useBankTransactions(bankAccountId?: string) {
  return useQuery({
    queryKey: queryKeys.bankTransactions(bankAccountId ?? ''),
    queryFn: () => bankAccountsApi.transactions(bankAccountId!),
    enabled: !!bankAccountId,
  })
}

export function useItems(includeInactive = false) {
  return useQuery({
    queryKey: queryKeys.items(includeInactive),
    queryFn: () => itemsApi.list(includeInactive),
    staleTime: MASTER_STALE,
  })
}

export function useStockTransactions(itemId?: string) {
  return useQuery({
    queryKey: queryKeys.stockTransactions(itemId ?? ''),
    queryFn: () => itemsApi.stockTransactions(itemId!),
    enabled: !!itemId,
  })
}

export function useFixedAssets() {
  return useQuery({ queryKey: queryKeys.fixedAssets, queryFn: fixedAssetsApi.list })
}

export function useBudgets() {
  return useQuery({ queryKey: queryKeys.budgets, queryFn: budgetsApi.list })
}

export function useTaxCodes() {
  return useQuery({ queryKey: queryKeys.taxCodes, queryFn: taxCodesApi.list, staleTime: MASTER_STALE })
}

export function useFiscalYears() {
  return useQuery({ queryKey: queryKeys.fiscalYears, queryFn: fiscalPeriodsApi.years })
}

export function useFiscalPeriods(yearId?: string) {
  return useQuery({
    queryKey: queryKeys.fiscalPeriods(yearId ?? ''),
    queryFn: () => fiscalPeriodsApi.periods(yearId!),
    enabled: !!yearId,
  })
}

/* --------------------------------------------------------------- reports */

type ReportOptions<T> = Omit<UseQueryOptions<T, Error, T, readonly unknown[]>, 'queryKey' | 'queryFn'>

export function useTrialBalance(asOfDate: string, options?: ReportOptions<Awaited<ReturnType<typeof reportsApi.trialBalance>>>) {
  return useQuery({
    queryKey: queryKeys.trialBalance(asOfDate),
    queryFn: () => reportsApi.trialBalance(asOfDate),
    enabled: !!asOfDate,
    ...options,
  })
}

export function useIncomeStatement(startDate: string, endDate: string) {
  return useQuery({
    queryKey: queryKeys.incomeStatement(startDate, endDate),
    queryFn: () => reportsApi.incomeStatement(startDate, endDate),
    enabled: !!startDate && !!endDate,
  })
}

export function useBalanceSheet(asOfDate: string) {
  return useQuery({
    queryKey: queryKeys.balanceSheet(asOfDate),
    queryFn: () => reportsApi.balanceSheet(asOfDate),
    enabled: !!asOfDate,
  })
}

export function useGeneralLedger(accountId: string, startDate: string, endDate: string) {
  return useQuery({
    queryKey: queryKeys.generalLedger(accountId, startDate, endDate),
    queryFn: () => reportsApi.generalLedger(accountId, startDate, endDate),
    enabled: !!accountId && !!startDate && !!endDate,
  })
}

export function useArAging(asOfDate: string) {
  return useQuery({
    queryKey: queryKeys.arAging(asOfDate),
    queryFn: () => reportsApi.arAging(asOfDate),
    enabled: !!asOfDate,
  })
}

export function useApAging(asOfDate: string) {
  return useQuery({
    queryKey: queryKeys.apAging(asOfDate),
    queryFn: () => reportsApi.apAging(asOfDate),
    enabled: !!asOfDate,
  })
}

export function useCashFlow(startDate: string, endDate: string) {
  return useQuery({
    queryKey: queryKeys.cashFlow(startDate, endDate),
    queryFn: () => reportsApi.cashFlow(startDate, endDate),
    enabled: !!startDate && !!endDate,
  })
}
