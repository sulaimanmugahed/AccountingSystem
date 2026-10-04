/**
 * Numeric enums mirrored from `AccountingSystem.Domain.Enums`.
 * The API serialises enums as numbers (System.Text.Json default), so the
 * numeric values here must stay in sync with the C# definitions.
 */

export enum AccountType {
  Asset = 1,
  Liability = 2,
  Equity = 3,
  Revenue = 4,
  Expense = 5,
}

export enum NormalBalance {
  Debit = 1,
  Credit = 2,
}

export enum FiscalPeriodStatus {
  Open = 1,
  Closed = 2,
}

export enum JournalEntryStatus {
  Draft = 1,
  Posted = 2,
  Voided = 3,
}

export enum JournalSourceType {
  Manual = 1,
  SalesInvoice = 2,
  CustomerPayment = 3,
  CreditMemo = 4,
  VendorBill = 5,
  VendorPayment = 6,
  VendorCredit = 7,
  BankTransaction = 8,
  Depreciation = 9,
  OpeningBalance = 10,
  Adjustment = 11,
  InventoryAdjustment = 12,
  PeriodClosing = 13,
}

export enum InvoiceStatus {
  Draft = 1,
  Sent = 2,
  PartiallyPaid = 3,
  Paid = 4,
  Overdue = 5,
  Voided = 6,
}

export enum BillStatus {
  Draft = 1,
  Approved = 2,
  PartiallyPaid = 3,
  Paid = 4,
  Voided = 5,
}

export enum PaymentMethod {
  Cash = 1,
  Check = 2,
  BankTransfer = 3,
  CreditCard = 4,
  DebitCard = 5,
  Other = 6,
}

export enum BankTransactionType {
  Deposit = 1,
  Withdrawal = 2,
  Transfer = 3,
  Fee = 4,
  Interest = 5,
}

export enum ItemType {
  Inventory = 1,
  Service = 2,
  NonInventory = 3,
}

export enum InventoryValuationMethod {
  FIFO = 1,
  WeightedAverage = 2,
}

export enum StockTransactionType {
  PurchaseReceipt = 1,
  SaleIssue = 2,
  AdjustmentIncrease = 3,
  AdjustmentDecrease = 4,
  OpeningStock = 5,
}

export enum TaxType {
  Sales = 1,
  Purchase = 2,
}

export enum AssetStatus {
  Active = 1,
  FullyDepreciated = 2,
  Disposed = 3,
}

export enum DepreciationMethod {
  StraightLine = 1,
  DecliningBalance = 2,
}

/** Builds `{ value, label }` option lists for <Select> controls. */
export function optionsFrom<T extends Record<string, string | number>>(
  enumeration: T,
  labels: Record<number, string>,
): Array<{ value: number; label: string }> {
  return Object.values(enumeration)
    .filter((value): value is number => typeof value === 'number')
    .map((value) => ({ value, label: labels[value] ?? String(value) }))
}

export const accountTypeLabels: Record<number, string> = {
  [AccountType.Asset]: 'Asset',
  [AccountType.Liability]: 'Liability',
  [AccountType.Equity]: 'Equity',
  [AccountType.Revenue]: 'Revenue',
  [AccountType.Expense]: 'Expense',
}

export const normalBalanceLabels: Record<number, string> = {
  [NormalBalance.Debit]: 'Debit',
  [NormalBalance.Credit]: 'Credit',
}

export const fiscalPeriodStatusLabels: Record<number, string> = {
  [FiscalPeriodStatus.Open]: 'Open',
  [FiscalPeriodStatus.Closed]: 'Closed',
}

export const journalEntryStatusLabels: Record<number, string> = {
  [JournalEntryStatus.Draft]: 'Draft',
  [JournalEntryStatus.Posted]: 'Posted',
  [JournalEntryStatus.Voided]: 'Voided',
}

export const journalSourceTypeLabels: Record<number, string> = {
  [JournalSourceType.Manual]: 'Manual',
  [JournalSourceType.SalesInvoice]: 'Sales Invoice',
  [JournalSourceType.CustomerPayment]: 'Customer Payment',
  [JournalSourceType.CreditMemo]: 'Credit Memo',
  [JournalSourceType.VendorBill]: 'Vendor Bill',
  [JournalSourceType.VendorPayment]: 'Vendor Payment',
  [JournalSourceType.VendorCredit]: 'Vendor Credit',
  [JournalSourceType.BankTransaction]: 'Bank Transaction',
  [JournalSourceType.Depreciation]: 'Depreciation',
  [JournalSourceType.OpeningBalance]: 'Opening Balance',
  [JournalSourceType.Adjustment]: 'Adjustment',
  [JournalSourceType.InventoryAdjustment]: 'Inventory Adjustment',
  [JournalSourceType.PeriodClosing]: 'Period Closing',
}

export const invoiceStatusLabels: Record<number, string> = {
  [InvoiceStatus.Draft]: 'Draft',
  [InvoiceStatus.Sent]: 'Sent',
  [InvoiceStatus.PartiallyPaid]: 'Partially Paid',
  [InvoiceStatus.Paid]: 'Paid',
  [InvoiceStatus.Overdue]: 'Overdue',
  [InvoiceStatus.Voided]: 'Voided',
}

export const billStatusLabels: Record<number, string> = {
  [BillStatus.Draft]: 'Draft',
  [BillStatus.Approved]: 'Approved',
  [BillStatus.PartiallyPaid]: 'Partially Paid',
  [BillStatus.Paid]: 'Paid',
  [BillStatus.Voided]: 'Voided',
}

export const paymentMethodLabels: Record<number, string> = {
  [PaymentMethod.Cash]: 'Cash',
  [PaymentMethod.Check]: 'Check',
  [PaymentMethod.BankTransfer]: 'Bank Transfer',
  [PaymentMethod.CreditCard]: 'Credit Card',
  [PaymentMethod.DebitCard]: 'Debit Card',
  [PaymentMethod.Other]: 'Other',
}

export const bankTransactionTypeLabels: Record<number, string> = {
  [BankTransactionType.Deposit]: 'Deposit',
  [BankTransactionType.Withdrawal]: 'Withdrawal',
  [BankTransactionType.Transfer]: 'Transfer',
  [BankTransactionType.Fee]: 'Fee',
  [BankTransactionType.Interest]: 'Interest',
}

export const itemTypeLabels: Record<number, string> = {
  [ItemType.Inventory]: 'Inventory',
  [ItemType.Service]: 'Service',
  [ItemType.NonInventory]: 'Non-Inventory',
}

export const inventoryValuationMethodLabels: Record<number, string> = {
  [InventoryValuationMethod.FIFO]: 'FIFO',
  [InventoryValuationMethod.WeightedAverage]: 'Weighted Average',
}

export const stockTransactionTypeLabels: Record<number, string> = {
  [StockTransactionType.PurchaseReceipt]: 'Purchase Receipt',
  [StockTransactionType.SaleIssue]: 'Sale Issue',
  [StockTransactionType.AdjustmentIncrease]: 'Adjustment Increase',
  [StockTransactionType.AdjustmentDecrease]: 'Adjustment Decrease',
  [StockTransactionType.OpeningStock]: 'Opening Stock',
}

export const taxTypeLabels: Record<number, string> = {
  [TaxType.Sales]: 'Sales',
  [TaxType.Purchase]: 'Purchase',
}

export const assetStatusLabels: Record<number, string> = {
  [AssetStatus.Active]: 'Active',
  [AssetStatus.FullyDepreciated]: 'Fully Depreciated',
  [AssetStatus.Disposed]: 'Disposed',
}

export const depreciationMethodLabels: Record<number, string> = {
  [DepreciationMethod.StraightLine]: 'Straight Line',
  [DepreciationMethod.DecliningBalance]: 'Declining Balance',
}
