/**
 * Enum → translated label maps.
 *
 * `enums.ts` holds the numeric enums (they mirror the C# values); the display
 * strings live in the locale files, so every screen reads them through this hook.
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AccountType,
  AssetStatus,
  BankTransactionType,
  BillStatus,
  DepreciationMethod,
  FiscalPeriodStatus,
  InventoryValuationMethod,
  InvoiceStatus,
  ItemType,
  JournalEntryStatus,
  JournalSourceType,
  NormalBalance,
  PaymentMethod,
  StockTransactionType,
  TaxType,
} from '@/lib/enums'

export interface EnumLabels {
  accountType: Record<number, string>
  normalBalance: Record<number, string>
  journalStatus: Record<number, string>
  journalSourceType: Record<number, string>
  invoiceStatus: Record<number, string>
  billStatus: Record<number, string>
  paymentMethod: Record<number, string>
  bankTransactionType: Record<number, string>
  itemType: Record<number, string>
  valuationMethod: Record<number, string>
  stockTransactionType: Record<number, string>
  taxType: Record<number, string>
  assetStatus: Record<number, string>
  depreciationMethod: Record<number, string>
  fiscalPeriodStatus: Record<number, string>
}

export function useLabels(): EnumLabels {
  const { t } = useTranslation()
  return useMemo(
    () => ({
      accountType: {
        [AccountType.Asset]: t('enums.accountType.asset'),
        [AccountType.Liability]: t('enums.accountType.liability'),
        [AccountType.Equity]: t('enums.accountType.equity'),
        [AccountType.Revenue]: t('enums.accountType.revenue'),
        [AccountType.Expense]: t('enums.accountType.expense'),
      },
      normalBalance: {
        [NormalBalance.Debit]: t('enums.normalBalance.debit'),
        [NormalBalance.Credit]: t('enums.normalBalance.credit'),
      },
      journalStatus: {
        [JournalEntryStatus.Draft]: t('enums.journalStatus.draft'),
        [JournalEntryStatus.Posted]: t('enums.journalStatus.posted'),
        [JournalEntryStatus.Voided]: t('enums.journalStatus.voided'),
      },
      journalSourceType: {
        [JournalSourceType.Manual]: t('enums.journalSourceType.manual'),
        [JournalSourceType.SalesInvoice]: t('enums.journalSourceType.salesInvoice'),
        [JournalSourceType.CustomerPayment]: t('enums.journalSourceType.customerPayment'),
        [JournalSourceType.CreditMemo]: t('enums.journalSourceType.creditMemo'),
        [JournalSourceType.VendorBill]: t('enums.journalSourceType.vendorBill'),
        [JournalSourceType.VendorPayment]: t('enums.journalSourceType.vendorPayment'),
        [JournalSourceType.VendorCredit]: t('enums.journalSourceType.vendorCredit'),
        [JournalSourceType.BankTransaction]: t('enums.journalSourceType.bankTransaction'),
        [JournalSourceType.Depreciation]: t('enums.journalSourceType.depreciation'),
        [JournalSourceType.OpeningBalance]: t('enums.journalSourceType.openingBalance'),
        [JournalSourceType.Adjustment]: t('enums.journalSourceType.adjustment'),
        [JournalSourceType.InventoryAdjustment]: t('enums.journalSourceType.inventoryAdjustment'),
        [JournalSourceType.PeriodClosing]: t('enums.journalSourceType.periodClosing'),
      },
      invoiceStatus: {
        [InvoiceStatus.Draft]: t('enums.invoiceStatus.draft'),
        [InvoiceStatus.Sent]: t('enums.invoiceStatus.sent'),
        [InvoiceStatus.PartiallyPaid]: t('enums.invoiceStatus.partiallyPaid'),
        [InvoiceStatus.Paid]: t('enums.invoiceStatus.paid'),
        [InvoiceStatus.Overdue]: t('enums.invoiceStatus.overdue'),
        [InvoiceStatus.Voided]: t('enums.invoiceStatus.voided'),
      },
      billStatus: {
        [BillStatus.Draft]: t('enums.billStatus.draft'),
        [BillStatus.Approved]: t('enums.billStatus.approved'),
        [BillStatus.PartiallyPaid]: t('enums.billStatus.partiallyPaid'),
        [BillStatus.Paid]: t('enums.billStatus.paid'),
        [BillStatus.Voided]: t('enums.billStatus.voided'),
      },
      paymentMethod: {
        [PaymentMethod.Cash]: t('enums.paymentMethod.cash'),
        [PaymentMethod.Check]: t('enums.paymentMethod.check'),
        [PaymentMethod.BankTransfer]: t('enums.paymentMethod.bankTransfer'),
        [PaymentMethod.CreditCard]: t('enums.paymentMethod.creditCard'),
        [PaymentMethod.DebitCard]: t('enums.paymentMethod.debitCard'),
        [PaymentMethod.Other]: t('enums.paymentMethod.other'),
      },
      bankTransactionType: {
        [BankTransactionType.Deposit]: t('enums.bankTransactionType.deposit'),
        [BankTransactionType.Withdrawal]: t('enums.bankTransactionType.withdrawal'),
        [BankTransactionType.Transfer]: t('enums.bankTransactionType.transfer'),
        [BankTransactionType.Fee]: t('enums.bankTransactionType.fee'),
        [BankTransactionType.Interest]: t('enums.bankTransactionType.interest'),
      },
      itemType: {
        [ItemType.Inventory]: t('enums.itemType.inventory'),
        [ItemType.Service]: t('enums.itemType.service'),
        [ItemType.NonInventory]: t('enums.itemType.nonInventory'),
      },
      valuationMethod: {
        [InventoryValuationMethod.FIFO]: t('enums.valuationMethod.fifo'),
        [InventoryValuationMethod.WeightedAverage]: t('enums.valuationMethod.weightedAverage'),
      },
      stockTransactionType: {
        [StockTransactionType.PurchaseReceipt]: t('enums.stockTransactionType.purchaseReceipt'),
        [StockTransactionType.SaleIssue]: t('enums.stockTransactionType.saleIssue'),
        [StockTransactionType.AdjustmentIncrease]: t('enums.stockTransactionType.adjustmentIncrease'),
        [StockTransactionType.AdjustmentDecrease]: t('enums.stockTransactionType.adjustmentDecrease'),
        [StockTransactionType.OpeningStock]: t('enums.stockTransactionType.openingStock'),
      },
      taxType: {
        [TaxType.Sales]: t('enums.taxType.sales'),
        [TaxType.Purchase]: t('enums.taxType.purchase'),
      },
      assetStatus: {
        [AssetStatus.Active]: t('enums.assetStatus.active'),
        [AssetStatus.FullyDepreciated]: t('enums.assetStatus.fullyDepreciated'),
        [AssetStatus.Disposed]: t('enums.assetStatus.disposed'),
      },
      depreciationMethod: {
        [DepreciationMethod.StraightLine]: t('enums.depreciationMethod.straightLine'),
        [DepreciationMethod.DecliningBalance]: t('enums.depreciationMethod.decliningBalance'),
      },
      fiscalPeriodStatus: {
        [FiscalPeriodStatus.Open]: t('enums.fiscalPeriodStatus.open'),
        [FiscalPeriodStatus.Closed]: t('enums.fiscalPeriodStatus.closed'),
      },
    }),
    [t],
  )
}

/** Non-hook variant for one-off lookups outside React (kept for completeness). */
export function enumLabels(t: (key: string) => string): EnumLabels {
  const build = (prefix: string, entries: Array<[number, string]>) =>
    Object.fromEntries(entries.map(([value, key]) => [value, t(`${prefix}.${key}`)]))
  return {
    accountType: build('enums.accountType', [[1, 'asset'], [2, 'liability'], [3, 'equity'], [4, 'revenue'], [5, 'expense']]),
    normalBalance: build('enums.normalBalance', [[1, 'debit'], [2, 'credit']]),
    journalStatus: build('enums.journalStatus', [[1, 'draft'], [2, 'posted'], [3, 'voided']]),
    journalSourceType: build('enums.journalSourceType', Array.from({ length: 13 }, (_, i) => [i + 1, [
      'manual', 'salesInvoice', 'customerPayment', 'creditMemo', 'vendorBill', 'vendorPayment', 'vendorCredit',
      'bankTransaction', 'depreciation', 'openingBalance', 'adjustment', 'inventoryAdjustment', 'periodClosing',
    ][i]])),
    invoiceStatus: build('enums.invoiceStatus', [[1, 'draft'], [2, 'sent'], [3, 'partiallyPaid'], [4, 'paid'], [5, 'overdue'], [6, 'voided']]),
    billStatus: build('enums.billStatus', [[1, 'draft'], [2, 'approved'], [3, 'partiallyPaid'], [4, 'paid'], [5, 'voided']]),
    paymentMethod: build('enums.paymentMethod', [[1, 'cash'], [2, 'check'], [3, 'bankTransfer'], [4, 'creditCard'], [5, 'debitCard'], [6, 'other']]),
    bankTransactionType: build('enums.bankTransactionType', [[1, 'deposit'], [2, 'withdrawal'], [3, 'transfer'], [4, 'fee'], [5, 'interest']]),
    itemType: build('enums.itemType', [[1, 'inventory'], [2, 'service'], [3, 'nonInventory']]),
    valuationMethod: build('enums.valuationMethod', [[1, 'fifo'], [2, 'weightedAverage']]),
    stockTransactionType: build('enums.stockTransactionType', [[1, 'purchaseReceipt'], [2, 'saleIssue'], [3, 'adjustmentIncrease'], [4, 'adjustmentDecrease'], [5, 'openingStock']]),
    taxType: build('enums.taxType', [[1, 'sales'], [2, 'purchase']]),
    assetStatus: build('enums.assetStatus', [[1, 'active'], [2, 'fullyDepreciated'], [3, 'disposed']]),
    depreciationMethod: build('enums.depreciationMethod', [[1, 'straightLine'], [2, 'decliningBalance']]),
    fiscalPeriodStatus: build('enums.fiscalPeriodStatus', [[1, 'open'], [2, 'closed']]),
  }
}
