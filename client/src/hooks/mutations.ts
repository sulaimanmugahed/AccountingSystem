/**
 * Write-side TanStack Query hooks. Each one invalidates the ledger-dependent
 * query keys so balances, lists and reports refresh after a posting action.
 */
import { useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ApiError } from '@/lib/api/client'
import { ledgerDependentKeys } from '@/lib/api/keys'
import {
  accountsApi,
  bankAccountsApi,
  billsApi,
  budgetsApi,
  customerPaymentsApi,
  customersApi,
  fixedAssetsApi,
  fiscalPeriodsApi,
  invoicesApi,
  itemsApi,
  journalEntriesApi,
  taxCodesApi,
  vendorPaymentsApi,
  vendorsApi,
} from '@/lib/api/endpoints'

interface ApiMutationOptions<TData, TVars> extends Omit<UseMutationOptions<TData, ApiError, TVars>, 'mutationFn'> {
  mutationFn: (variables: TVars) => Promise<TData>
  successMessage?: string | ((data: TData, variables: TVars) => string)
  /** Query-key roots to invalidate on success. Defaults to everything ledger-dependent. */
  invalidate?: string[]
  /** Suppress the automatic error toast (e.g. when the form renders the error itself). */
  silentError?: boolean
}

export function useApiMutation<TData, TVars>({
  mutationFn,
  successMessage,
  invalidate = ledgerDependentKeys,
  silentError = false,
  ...options
}: ApiMutationOptions<TData, TVars>) {
  const queryClient = useQueryClient()

  return useMutation<TData, ApiError, TVars>({
    ...options,
    mutationFn: async (variables: TVars) => {
      try {
        return await mutationFn(variables)
      } catch (error) {
        throw error instanceof ApiError ? error : new ApiError((error as Error)?.message ?? 'Request failed.', 0)
      }
    },
    onSuccess: (data, variables, onMutateResult, context) => {
      for (const key of invalidate) {
        queryClient.invalidateQueries({ queryKey: [key] })
      }
      if (successMessage) {
        toast.success(typeof successMessage === 'function' ? successMessage(data, variables) : successMessage)
      }
      options.onSuccess?.(data, variables, onMutateResult, context)
    },
    onError: (error, variables, onMutateResult, context) => {
      if (!silentError && !options.onError) {
        toast.error(error instanceof ApiError ? error.message : 'Request failed. Please try again.')
      }
      options.onError?.(error, variables, onMutateResult, context)
    },
  })
}

/* ------------------------------------------------------------ general ledger */

export const useCreateAccount = () =>
  useApiMutation({ mutationFn: accountsApi.create, successMessage: 'Account created.', invalidate: ['accounts'] })

export const useDeactivateAccount = () =>
  useApiMutation({ mutationFn: accountsApi.deactivate, successMessage: 'Account deactivated.', invalidate: ['accounts'] })

export const useCreateJournalEntry = () =>
  useApiMutation({
    mutationFn: journalEntriesApi.create,
    successMessage: 'Journal entry posted.',
    invalidate: ['journal-entries', 'reports', 'accounts'],
  })

export const useReverseJournalEntry = () =>
  useApiMutation({
    mutationFn: ({ id, reversalDate }: { id: string; reversalDate?: string }) =>
      journalEntriesApi.reverse(id, reversalDate),
    successMessage: 'Reversing entry posted.',
    invalidate: ['journal-entries', 'reports', 'accounts'],
  })

/* -------------------------------------------------------------- receivables */

export const useCreateCustomer = () =>
  useApiMutation({ mutationFn: customersApi.create, successMessage: 'Customer created.', invalidate: ['customers'] })

export const useUpdateCustomer = () =>
  useApiMutation({
    mutationFn: ({ id, ...payload }: Parameters<typeof customersApi.update>[1] & { id: string }) =>
      customersApi.update(id, payload),
    successMessage: 'Customer updated.',
    invalidate: ['customers'],
  })

export const useDeactivateCustomer = () =>
  useApiMutation({ mutationFn: customersApi.deactivate, successMessage: 'Customer deactivated.', invalidate: ['customers'] })

export const useCreateInvoice = () =>
  useApiMutation({
    mutationFn: invoicesApi.create,
    successMessage: 'Invoice saved as draft.',
    invalidate: ['invoices', 'reports'],
  })

export const usePostInvoice = () =>
  useApiMutation({
    mutationFn: invoicesApi.post,
    successMessage: (invoice) => `Invoice ${invoice.invoiceNumber} posted to the ledger.`,
    invalidate: ['invoices', 'journal-entries', 'reports', 'accounts', 'items'],
  })

export const useVoidInvoice = () =>
  useApiMutation({
    mutationFn: invoicesApi.void,
    successMessage: 'Invoice voided with a reversing entry.',
    invalidate: ['invoices', 'journal-entries', 'reports', 'accounts', 'items'],
  })

export const useCreateCustomerPayment = () =>
  useApiMutation({
    mutationFn: customerPaymentsApi.create,
    successMessage: 'Customer payment recorded.',
    invalidate: ['customer-payments', 'invoices', 'journal-entries', 'reports', 'accounts', 'bank-accounts'],
  })

/* ----------------------------------------------------------------- payables */

export const useCreateVendor = () =>
  useApiMutation({ mutationFn: vendorsApi.create, successMessage: 'Vendor created.', invalidate: ['vendors'] })

export const useUpdateVendor = () =>
  useApiMutation({
    mutationFn: ({ id, ...payload }: Parameters<typeof vendorsApi.update>[1] & { id: string }) =>
      vendorsApi.update(id, payload),
    successMessage: 'Vendor updated.',
    invalidate: ['vendors'],
  })

export const useDeactivateVendor = () =>
  useApiMutation({ mutationFn: vendorsApi.deactivate, successMessage: 'Vendor deactivated.', invalidate: ['vendors'] })

export const useCreateBill = () =>
  useApiMutation({ mutationFn: billsApi.create, successMessage: 'Bill saved as draft.', invalidate: ['bills', 'reports'] })

export const usePostBill = () =>
  useApiMutation({
    mutationFn: billsApi.post,
    successMessage: (bill) => `Bill ${bill.billNumber} posted to the ledger.`,
    invalidate: ['bills', 'journal-entries', 'reports', 'accounts', 'items'],
  })

export const useVoidBill = () =>
  useApiMutation({
    mutationFn: billsApi.void,
    successMessage: 'Bill voided with a reversing entry.',
    invalidate: ['bills', 'journal-entries', 'reports', 'accounts', 'items'],
  })

export const useCreateVendorPayment = () =>
  useApiMutation({
    mutationFn: vendorPaymentsApi.create,
    successMessage: 'Vendor payment recorded.',
    invalidate: ['vendor-payments', 'bills', 'journal-entries', 'reports', 'accounts', 'bank-accounts'],
  })

/* ------------------------------------------------------------------ banking */

export const useCreateBankAccount = () =>
  useApiMutation({
    mutationFn: bankAccountsApi.create,
    successMessage: 'Bank account created.',
    invalidate: ['bank-accounts', 'accounts'],
  })

export const useAddBankTransaction = () =>
  useApiMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof bankAccountsApi.addTransaction>[1]) =>
      bankAccountsApi.addTransaction(id, payload),
    successMessage: 'Bank transaction recorded.',
    invalidate: ['bank-accounts', 'journal-entries', 'reports'],
  })

export const useStartReconciliation = () =>
  useApiMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof bankAccountsApi.startReconciliation>[1]) =>
      bankAccountsApi.startReconciliation(id, payload),
    successMessage: 'Reconciliation started.',
    invalidate: ['bank-accounts'],
  })

export const useClearBankTransaction = () =>
  useApiMutation({
    mutationFn: ({ reconciliationId, transactionId }: { reconciliationId: string; transactionId: string }) =>
      bankAccountsApi.clearTransaction(reconciliationId, transactionId),
    successMessage: 'Transaction marked as cleared.',
    invalidate: ['bank-accounts'],
  })

export const useCompleteReconciliation = () =>
  useApiMutation({
    mutationFn: bankAccountsApi.completeReconciliation,
    successMessage: 'Reconciliation completed.',
    invalidate: ['bank-accounts'],
  })

/* ---------------------------------------------------------------- inventory */

export const useCreateItem = () =>
  useApiMutation({ mutationFn: itemsApi.create, successMessage: 'Item created.', invalidate: ['items'] })

export const useDeactivateItem = () =>
  useApiMutation({ mutationFn: itemsApi.deactivate, successMessage: 'Item deactivated.', invalidate: ['items'] })

/* ------------------------------------------------------------- fixed assets */

export const useCreateFixedAsset = () =>
  useApiMutation({
    mutationFn: fixedAssetsApi.create,
    successMessage: 'Fixed asset registered.',
    invalidate: ['fixed-assets'],
  })

export const useRunDepreciation = () =>
  useApiMutation({
    mutationFn: fixedAssetsApi.runDepreciation,
    successMessage: (result) => `Depreciation posted for ${result.assetsDepreciated} asset(s).`,
    invalidate: ['fixed-assets', 'journal-entries', 'reports', 'accounts'],
  })

export const useDisposeAsset = () =>
  useApiMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof fixedAssetsApi.dispose>[1]) =>
      fixedAssetsApi.dispose(id, payload),
    successMessage: 'Asset disposed.',
    invalidate: ['fixed-assets', 'journal-entries', 'reports', 'accounts'],
  })

/* ------------------------------------------------------------------ budgets */

export const useCreateBudget = () =>
  useApiMutation({ mutationFn: budgetsApi.create, successMessage: 'Budget created.', invalidate: ['budgets'] })

/* ---------------------------------------------------------------------- tax */

export const useCreateTaxCode = () =>
  useApiMutation({ mutationFn: taxCodesApi.create, successMessage: 'Tax code created.', invalidate: ['tax-codes'] })

/* ------------------------------------------------------------- fiscal year */

export const useClosePeriod = () =>
  useApiMutation({
    mutationFn: fiscalPeriodsApi.closePeriod,
    successMessage: 'Fiscal period closed.',
    invalidate: ['fiscal-years', 'reports'],
  })

export const useReopenPeriod = () =>
  useApiMutation({
    mutationFn: fiscalPeriodsApi.reopenPeriod,
    successMessage: 'Fiscal period reopened.',
    invalidate: ['fiscal-years', 'reports'],
  })

export const useCloseFiscalYear = () =>
  useApiMutation({
    mutationFn: fiscalPeriodsApi.closeYear,
    successMessage: 'Fiscal year closed — retained earnings updated.',
    invalidate: ['fiscal-years', 'journal-entries', 'reports', 'accounts'],
  })
