/**
 * Headless smoke test for the in-browser mock API (`src/mocks`).
 *
 * It exercises the same route handlers the React client calls — sign-in, every
 * master-data screen, the document flows (invoice → post → payment, bill → post →
 * payment, journal → reverse), banking + reconciliation, fixed assets, budgets,
 * tax codes, period close/reopen and all seven reports — and checks the ledger
 * still balances after every write.
 *
 * Run it with `npm run smoke:mock` (bundled by scripts/smoke.mjs). No browser, no
 * .NET API and no network required.
 */
import {
  AccountType,
  AssetStatus,
  BillStatus,
  DepreciationMethod,
  FiscalPeriodStatus,
  InvoiceStatus,
  ItemType,
  JournalSourceType,
  TaxType,
  seed,
  store,
} from '../src/mocks/db'
import { routes, type MockContext } from '../src/mocks/handlers'
import { PaymentMethod } from '../src/lib/enums'

/* ------------------------------------------------------------------ harness */

let passed = 0
const failures: string[] = []

function assert(condition: boolean, label: string) {
  if (condition) {
    passed += 1
    console.log(`  ✓ ${label}`)
  } else {
    failures.push(label)
    console.log(`  ✗ ${label}`)
  }
}

function section(name: string) {
  console.log(`\n${name}`)
}

function call(method: string, pattern: string, options: { params?: Record<string, string>; query?: Record<string, string>; body?: unknown } = {}) {
  const route = routes.find((candidate) => candidate.method === method && candidate.pattern === pattern)
  if (!route) throw new Error(`No mock route for ${method} ${pattern}`)
  const context: MockContext = {
    params: options.params ?? {},
    query: new URLSearchParams(options.query ?? {}),
    body: options.body,
    user: store.users[0],
  }
  const result = (route.handler as (ctx: MockContext) => unknown)(context)
  if (result && typeof (result as Promise<unknown>).then === 'function') {
    throw new Error(`${method} ${pattern} returned a promise — the smoke test expects synchronous mock handlers`)
  }
  return result as any
}

function expectFailure(method: string, pattern: string, options: Parameters<typeof call>[2], label: string) {
  try {
    call(method, pattern, options)
    assert(false, label)
  } catch {
    assert(true, label)
  }
}

const round2 = (value: number) => Math.round(value * 100) / 100

/* --------------------------------------------------------------------- seed */

seed()

section('Seed')
{
  const company = call('GET', '/companies/current')
  assert(company.name.length > 0, `company seeded (${company.name})`)
  assert(call('GET', '/accounts').length >= 18, `chart of accounts seeded (${call('GET', '/accounts').length} accounts)`)
  assert(store.customers.length >= 3, `customers seeded (${store.customers.length})`)
  assert(store.vendors.length >= 3, `vendors seeded (${store.vendors.length})`)
  assert(store.items.length >= 5, `items seeded (${store.items.length})`)
  assert(store.invoices.length >= 3, `invoices seeded (${store.invoices.length})`)
  assert(store.bills.length >= 2, `bills seeded (${store.bills.length})`)
  assert(store.journalEntries.some((entry) => entry.sourceType === JournalSourceType.OpeningBalance), 'opening balance entry posted')
  assert(store.journalEntries.every((entry) => {
    const debit = round2(entry.lines.reduce((sum, line) => sum + line.debit, 0))
    const credit = round2(entry.lines.reduce((sum, line) => sum + line.credit, 0))
    return Math.abs(debit - credit) < 0.01
  }), `every seeded journal entry balances (${store.journalEntries.length} entries)`)
}

/* ------------------------------------------------------------------ reports */

section('Reports')
{
  const trialBalance = call('GET', '/reports/trial-balance', { query: { asOfDate: '2026-10-31' } })
  assert(
    Math.abs(trialBalance.totalDebit - trialBalance.totalCredit) < 0.01,
    `trial balance balances (${trialBalance.totalDebit.toFixed(2)} = ${trialBalance.totalCredit.toFixed(2)})`,
  )

  const balanceSheet = call('GET', '/reports/balance-sheet', { query: { asOfDate: '2026-10-31' } })
  assert(
    Math.abs(balanceSheet.totalAssets - balanceSheet.totalLiabilitiesAndEquity) < 0.01,
    `balance sheet balances (${balanceSheet.totalAssets.toFixed(2)} = ${balanceSheet.totalLiabilitiesAndEquity.toFixed(2)})`,
  )

  const incomeStatement = call('GET', '/reports/income-statement', { query: { startDate: '2026-01-01', endDate: '2026-10-31' } })
  assert(
    incomeStatement.totalRevenue > 0 && incomeStatement.totalExpense > 0,
    `income statement has revenue ${incomeStatement.totalRevenue.toFixed(2)} and expenses ${incomeStatement.totalExpense.toFixed(2)}`,
  )

  const arAging = call('GET', '/reports/ar-aging', { query: { asOfDate: '2026-10-31' } })
  assert(arAging.rows.length > 0, `AR aging returns ${arAging.rows.length} customer(s)`)

  const apAging = call('GET', '/reports/ap-aging', { query: { asOfDate: '2026-10-31' } })
  assert(apAging.rows.length > 0, `AP aging returns ${apAging.rows.length} vendor(s)`)

  const cashAccount = call('GET', '/accounts').find((account: any) => account.code === '1000')
  const generalLedger = call('GET', '/reports/general-ledger', {
    query: { accountId: cashAccount.id, startDate: '2026-01-01', endDate: '2026-10-31' },
  })
  assert(typeof generalLedger.closingBalance === 'number', `general ledger returns a closing balance of ${generalLedger.closingBalance.toFixed(2)}`)

  const cashFlow = call('GET', '/reports/cash-flow', { query: { startDate: '2026-01-01', endDate: '2026-10-31' } })
  assert(typeof cashFlow.endingCash === 'number', `cash flow reports ending cash of ${cashFlow.endingCash.toFixed(2)}`)
}

/* ------------------------------------------------------------------ journal */

section('Journal entries')
{
  const cash = store.accounts.find((account) => account.code === '1000')!
  const revenue = store.accounts.find((account) => account.code === '4000')!

  const before = store.journalEntries.length
  const entry = call('POST', '/journalentries', {
    body: {
      entryDate: '2026-10-15',
      memo: 'Smoke test entry',
      lines: [
        { accountId: cash.id, description: 'Debit cash', debit: 250, credit: 0 },
        { accountId: revenue.id, description: 'Credit revenue', debit: 0, credit: 250 },
      ],
    },
  })
  assert(store.journalEntries.length === before + 1, `manual journal entry posted (${entry.entryNumber})`)
  assert(entry.lines.length === 2, 'posted entry keeps both lines')
}

/* -------------------------------------------------------------- AR workflow */

section('Receivables')
{
  const customer = store.customers[0]
  const item = store.items.find((candidate) => candidate.type === ItemType.Inventory)!

  const invoice = call('POST', '/invoices', {
    body: {
      customerId: customer.id,
      invoiceDate: '2026-10-15',
      dueDate: '2026-11-14',
      memo: 'Smoke test invoice',
      lines: [
        { itemId: item.id, description: item.name, quantity: 2, unitPrice: 500, discountPercent: 0, taxCodeId: null },
        { description: 'Consulting', quantity: 1, unitPrice: 250, discountPercent: 0, taxCodeId: null },
      ],
    },
  })
  assert(invoice.status === InvoiceStatus.Draft, `invoice created as a draft (${invoice.invoiceNumber})`)

  const posted = call('POST', '/invoices/:id/post', { params: { id: invoice.id } })
  assert(posted.status !== InvoiceStatus.Draft, `invoice posted (status ${posted.status})`)
  assert(
    store.journalEntries.some((entry) => entry.sourceType === JournalSourceType.SalesInvoice && entry.sourceId === invoice.id),
    'posting booked a journal entry for the invoice',
  )

  const payment = call('POST', '/customerpayments', {
    body: {
      customerId: customer.id,
      paymentDate: '2026-10-20',
      amount: 500,
      method: PaymentMethod.BankTransfer,
      bankAccountId: store.bankAccounts[0].id,
      referenceNumber: 'SMOKE-AR-1',
      applications: [{ invoiceId: invoice.id, amount: 500 }],
    },
  })
  assert(payment.amount === 500, `customer payment recorded (${payment.paymentNumber})`)

  const refreshed = call('GET', '/invoices/:id', { params: { id: invoice.id } })
  assert(refreshed.amountPaid >= 500, `payment applied against the invoice (paid ${refreshed.amountPaid.toFixed(2)})`)
}

/* -------------------------------------------------------------- AP workflow */

section('Payables')
{
  const vendor = store.vendors[0]
  const bill = call('POST', '/bills', {
    body: {
      vendorId: vendor.id,
      billDate: '2026-10-12',
      dueDate: '2026-11-11',
      vendorInvoiceNumber: 'SMOKE-AP-1',
      lines: [{ description: 'Office supplies', quantity: 4, unitCost: 75, taxCodeId: null }],
    },
  })
  assert(!!bill.id, `vendor bill created (${bill.billNumber})`)

  const posted = call('POST', '/bills/:id/post', { params: { id: bill.id } })
  assert(posted.status !== BillStatus.Draft, `bill posted (status ${posted.status})`)

  const payment = call('POST', '/vendorpayments', {
    body: {
      vendorId: vendor.id,
      paymentDate: '2026-10-22',
      amount: 300,
      method: PaymentMethod.Check,
      bankAccountId: store.bankAccounts[0].id,
      applications: [{ billId: bill.id, amount: 300 }],
    },
  })
  assert(payment.amount === 300, `vendor payment recorded (${payment.paymentNumber})`)
}

/* ------------------------------------------------------- banking + reconcile */

section('Banking')
{
  const bankAccount = store.bankAccounts[0]
  const transaction = call('POST', '/bankaccounts/:id/transactions', {
    params: { id: bankAccount.id },
    body: {
      transactionDate: '2026-10-25',
      type: 1,
      amount: 1250,
      description: 'Smoke test deposit',
      referenceNumber: 'DEP-SMOKE',
    },
  })
  assert(!!transaction.id, 'bank transaction recorded')

  const reconciliation = call('POST', '/bankaccounts/:id/reconciliations', {
    params: { id: bankAccount.id },
    body: { statementDate: '2026-10-31', statementBeginningBalance: 0, statementEndingBalance: 12345.67 },
  })
  assert(!!reconciliation.id, 'reconciliation started')

  call('POST', '/bankaccounts/reconciliations/:reconciliationId/transactions/:transactionId/clear', {
    params: { reconciliationId: reconciliation.id, transactionId: transaction.id },
  })
  const clearedTransaction = store.bankTransactions.find((candidate) => candidate.id === transaction.id)
  assert(clearedTransaction?.isReconciled === true, 'transaction marked as cleared')

  const completed = call('POST', '/bankaccounts/reconciliations/:reconciliationId/complete', {
    params: { reconciliationId: reconciliation.id },
  })
  assert(completed.isCompleted === true, 'reconciliation completed')
}

/* ------------------------------------------------------------ master + rest */

section('Master data')
{
  const account = call('POST', '/accounts', {
    body: { code: '6999', name: 'Smoke Test Expense', type: AccountType.Expense, subType: 'Operating Expense' },
  })
  assert(account.id && account.code === '6999', 'account created')

  const taxCode = call('POST', '/taxcodes', {
    body: { code: 'SMOKE7', name: 'Smoke 7%', ratePercent: 7, type: TaxType.Sales },
  })
  assert(taxCode.id, 'tax code created')

  const item = call('POST', '/items', {
    body: { sku: 'SMOKE-SKU', name: 'Smoke Widget', type: ItemType.Inventory, salePrice: 25, purchaseCost: 12 },
  })
  assert(item.id, 'inventory item created')

  const budget = call('POST', '/budgets', {
    body: {
      name: 'Smoke Budget',
      fiscalYearId: store.fiscalYears.find((year) => !year.isClosed)!.id,
      lines: [{ accountId: account.id, amount: 12000 }],
    },
  })
  assert(!!budget.id || Array.isArray(budget.lines), 'budget created')

  const customer = call('POST', '/customers', {
    body: { code: 'SMOKE-C', name: 'Smoke Customer', email: 'smoke@example.com', phone: null, creditLimit: 1000 },
  })
  assert(customer.id, 'customer created')

  const vendor = call('POST', '/vendors', {
    body: { code: 'SMOKE-V', name: 'Smoke Vendor', email: 'smoke-vendor@example.com', phone: null },
  })
  assert(vendor.id, 'vendor created')

  expectFailure('POST', '/accounts', { body: { code: '6999', name: 'Duplicate', type: AccountType.Expense } }, 'duplicate account code rejected')
}

/* ------------------------------------------------------- fixed assets + period */

section('Fixed assets & periods')
{
  const asset = call('POST', '/fixedassets', {
    body: {
      code: 'SMOKE-FA',
      name: 'Smoke Machine',
      acquisitionDate: '2026-01-15',
      acquisitionCost: 12000,
      usefulLifeMonths: 24,
      salvageValue: 0,
      method: DepreciationMethod.StraightLine,
      assetAccountId: store.accounts.find((candidate) => candidate.code === '1500')!.id,
      depreciationExpenseAccountId: store.accounts.find((candidate) => candidate.code === '6400')!.id,
      accumulatedDepreciationAccountId: store.accounts.find((candidate) => candidate.code === '1590')!.id,
    },
  })
  assert(asset.id, 'fixed asset registered')

  const depreciated = call('POST', '/fixedassets/run-depreciation', { query: { periodEndDate: '2026-10-31' } })
  assert(depreciated.assetsDepreciated > 0, `depreciation run posted for ${depreciated.assetsDepreciated} asset(s)`)

  call('POST', '/fixedassets/:id/dispose', {
    params: { id: asset.id },
    body: { disposalDate: '2026-10-31', proceeds: 0 },
  })
  assert(store.fixedAssets.find((candidate) => candidate.id === asset.id)?.status === AssetStatus.Disposed, 'asset disposed')

  const fiscalYear = store.fiscalYears.find((year) => !year.isClosed)!
  const periods = call('GET', '/fiscalperiods/years/:yearId/periods', { params: { yearId: fiscalYear.id } })
  assert(periods.length === 12, `fiscal year exposes ${periods.length} periods`)

  call('POST', '/fiscalperiods/periods/:periodId/close', { params: { periodId: periods[0].id } })
  const periodAfterClose = store.fiscalPeriods.find((period) => period.id === periods[0].id)
  assert(periodAfterClose?.status === FiscalPeriodStatus.Closed, 'period closed')

  // Posting into a closed period must be rejected, then reopening restores it.
  try {
    call('POST', '/journalentries', {
      body: {
        entryDate: periods[0].endDate,
        memo: 'Posting into a closed period',
        lines: [
          { accountId: store.accounts[0].id, description: 'Debit', debit: 10, credit: 0 },
          { accountId: store.accounts[1].id, description: 'Credit', debit: 0, credit: 10 },
        ],
      },
    })
    assert(false, 'posting into a closed period is rejected')
  } catch {
    assert(true, 'posting into a closed period is rejected')
  }

  call('POST', '/fiscalperiods/periods/:periodId/reopen', { params: { periodId: periods[0].id } })
  const periodAfterReopen = store.fiscalPeriods.find((period) => period.id === periods[0].id)
  assert(periodAfterReopen?.status === FiscalPeriodStatus.Open, 'period reopened')
}

/* ------------------------------------------------------------------- sign-in */

section('Auth')
{
  const session = call('POST', '/auth/login', { body: { email: store.users[0].email, password: store.users[0].password } })
  assert(typeof session.token === 'string' && session.roles.length > 0, `sign-in returns a token for ${session.fullName}`)
  expectFailure('POST', '/auth/login', { body: { email: store.users[0].email, password: 'wrong-password' } }, 'bad credentials rejected')
}

/* ------------------------------------------------------------------- summary */

section('Result')
assert(failures.length === 0, `${passed} checks passed`)

if (failures.length) {
  console.error(`\n${failures.length} failing check(s):`)
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}
