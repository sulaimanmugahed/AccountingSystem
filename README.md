# Accounting System

A full double-entry accounting system built on **.NET 8 / ASP.NET Core Web API**, using Clean Architecture (Domain / Application / Infrastructure / Api).

## Modules

- **General Ledger** — Chart of Accounts, manual & system-generated journal entries, balanced double-entry validation, reversals, fiscal year/period management and year-end closing.
- **Accounts Receivable** — Customers, invoices (with line-level tax and item integration), customer payments with multi-invoice application, credit memos, AR aging.
- **Accounts Payable** — Vendors, bills, vendor payments with multi-bill application, vendor credits, AP aging.
- **Banking** — Bank accounts, transactions, bank reconciliation workflow.
- **Inventory** — Inventory/service/non-inventory items, weighted-average costing, automatic COGS posting on sale, automatic stock receipt on purchase.
- **Fixed Assets** — Straight-line and declining-balance depreciation, monthly depreciation runs, disposals.
- **Budgeting** — Budgets by account/fiscal period.
- **Tax** — Configurable tax codes applied to invoice/bill lines, posted to tax payable/receivable accounts.
- **Multi-currency** — Per-document currency and exchange rate fields; base-currency company setting.
- **Reporting** — Trial Balance, Income Statement (P&L), Balance Sheet, General Ledger detail, AR/AP Aging, simplified Cash Flow Statement.
- **Security** — ASP.NET Core Identity + JWT bearer auth, role-based authorization (Admin, Accountant, ARClerk, APClerk, Viewer).
- **Audit** — Created/modified by & at on every record; append-only journal entries (voided via reversal, never deleted).

## Architecture

```
src/
  AccountingSystem.Domain          Entities, enums, domain exceptions. No dependencies.
  AccountingSystem.Application     Business logic services, DTOs, IApplicationDbContext abstraction.
  AccountingSystem.Infrastructure  EF Core DbContext + configurations, ASP.NET Identity, migrations.
  AccountingSystem.Api             REST controllers, JWT auth, Swagger.
tests/
  AccountingSystem.Application.Tests  Unit tests (EF Core InMemory) for posting logic and reports.
```

Every financial transaction (invoice, bill, payment, depreciation run, period close) posts through a single `JournalEntryService` that enforces:
- lines balance (total debits == total credits)
- the entry date falls in an **open** fiscal period
- entries are never hard-deleted — corrections are made by reversal

## Running locally

Requires the .NET 8 SDK.

```bash
cd src/AccountingSystem.Api
dotnet run
```

On first run the API automatically applies EF Core migrations and seeds:
- a demo company with a full chart of accounts (tagged with the system-account keys the posting engine relies on: AR, AP, Sales Tax Payable, Purchase Tax Receivable, Retained Earnings, Opening Balance Equity, default COGS/Revenue accounts)
- 12 open fiscal periods for the current year
- USD/EUR/GBP currencies
- an admin user: **admin@demo.local / Admin@12345**

Swagger UI is available at `/swagger` in Development. Authenticate via `POST /api/auth/login`, then use the returned JWT as a Bearer token for every other endpoint.

### Switching database provider

The API defaults to SQLite (`accounting.db`, zero setup). For SQL Server, set in `appsettings.json`:

```json
"DatabaseProvider": "SqlServer",
"ConnectionStrings": { "DefaultConnection": "Server=...;Database=Accounting;..." }
```

### Adding a migration

```bash
cd src/AccountingSystem.Api
dotnet ef migrations add <Name> --project ../AccountingSystem.Infrastructure --startup-project .
```

## React client (`client/`)

A complete single-page app for every API surface — dashboard, general ledger, AR, AP,
banking, inventory, fixed assets, budgeting, tax codes, company settings and all seven
reports. It ships with an in-browser mock of the API, so the whole UI can be run and
explored without the .NET SDK.

**Stack:** Vite + React 19 + TypeScript · TanStack Query (server state) · TanStack Table
(every table, sorting/filtering/pagination) · React Hook Form + Zod (every form) ·
shadcn/ui-style components on Tailwind CSS · React Router · i18next (English + العربية).

The UI is bilingual: every screen is translated, Arabic flips the layout to
right-to-left (logical Tailwind utilities throughout) and money/date/number formatting
follows the selected language. Pick the language from the switcher in the top bar; the
choice is remembered in `localStorage`.

### Run it against the real API

```bash
cd client
npm install
npm run dev            # proxies /api to http://localhost:5074
```

Start the .NET API first (`cd src/AccountingSystem.Api && dotnet run`). Override the
proxy target or API base URL with `VITE_API_PROXY_TARGET` / `VITE_API_BASE_URL`
(see `client/.env.example`).

### Run it with no backend (bundled mock API)

```bash
cd client
npm run dev:mock       # http://localhost:5173
```

`npm run dev:mock` installs a mock of the API in the browser: same routes, same DTO
shapes, same enums, seeded with a demo company, chart of accounts, customers, vendors,
items, invoices, bills, bank transactions, fixed assets and budgets. Sign in with
**admin@demo.local / Admin@12345**. Other seeded role logins (see `client/src/mocks/db.ts`):
`accountant@demo.local` / `Accountant@123`, `arclerk@demo.local` / `ArClerk@1234`,
`apclerk@demo.local` / `ApClerk@1234`, `viewer@demo.local` / `Viewer@1234`.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server against the .NET API |
| `npm run dev:mock` | Dev server against the bundled mock API |
| `npm run build` / `build:mock` | Type-check + production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run smoke` | Both smoke suites below |
| `npm run smoke:mock` | Headless checks of the mock API (every route, ledger integrity) |
| `npm run smoke:render` | Renders every route in jsdom, drives the sign-in and create-account forms |

Both smoke suites are dev-only, need no network and are what keeps the mock honest:
`smoke:mock` asserts the mock's DTO field names and posting behaviour match the .NET
controllers/services, and `smoke:render` fails on any React warning or blank page.

### Source map

```
client/src/
  app/          router, navigation, route guards
  components/   ui primitives (shadcn-style), data-table, layout, shared bits
  features/     one folder per module: auth, dashboard, gl, ar, ap, banking,
                inventory, assets, budgeting, tax, settings, reports
  hooks/        TanStack Query hooks (all reads) + mutation hooks
  lib/          typed API client, endpoint wrappers, enums/DTO types, formatters
  mocks/        in-browser mock API (db + route handlers) used by dev:mock
```

## Typical flow

1. `POST /api/auth/login` → JWT.
2. `POST /api/customers`, `POST /api/items`, `POST /api/taxcodes` as needed.
3. `POST /api/invoices` (draft) → `POST /api/invoices/{id}/post` (posts AR/Revenue/Tax/COGS to the GL).
4. `POST /api/customerpayments` with `applications` to settle one or more invoices — posts Bank/AR.
5. `GET /api/reports/trial-balance?asOfDate=...`, `.../income-statement`, `.../balance-sheet`, `.../ar-aging`, etc.
6. `POST /api/fiscalperiods/periods/{id}/close` and `.../years/{id}/close` at period/year end.

## Tests

```bash
cd tests/AccountingSystem.Application.Tests
dotnet test
```
