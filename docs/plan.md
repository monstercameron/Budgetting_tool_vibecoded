# Budgeting Tool Implementation Plan

## 0) Source of Truth
This plan follows `AGENTS.md` as the governing standard. If this plan conflicts with `AGENTS.md`, `AGENTS.md` wins.

## 1) Fast Implementation Contract
- Core logic files: `src/core/pure.js` and `src/core/impure.js`.
- Tests: `src/tests/pure.test.js` and `src/tests/impure.test.js`.
- All project functions return `[value, err]`.
- Tuple errors are checked immediately (`if (err)`).
- `pure.js` is deterministic only; `impure.js` contains all side effects.
- No exception-driven control flow.
- `try/catch` is only allowed inside `impure.js` wrappers to normalize throw-prone APIs to tuples.
- Use Tailwind CSS for UI styling and layout consistency.
- During active implementation, run the dev server in the background for real-time visual verification.

## 2) Product Scope
Build a frontend-only budgeting tool (GitHub Pages) with:
- Expense, income, asset, debt, credit, loan, and goals tracking
- Notes in global and contextual flows
- Light/dark theme
- JSON import/export
- Google sign-in and Google Sheets cloud sync
- Sort/filter across sections
- Dashboard health metrics and reports

## 3) Architecture (Reconciled)
### 3.1 `pure.js`
Contains deterministic logic only:
- Validation and normalization
- Sorting/filtering transforms
- Dashboard/report calculations
- Debt/credit/loan math and payoff projections
- Goal progress calculations

### 3.2 `impure.js`
Contains side effects and wrappers:
- Google auth/session calls
- Google Sheets read/write/provisioning
- Local storage and JSON/file IO
- Time/date sourcing
- Browser API access
- Error normalization adapters for throw-prone APIs

### 3.3 UI Wiring
UI files may orchestrate state/rendering only, but business logic and side effects must route through `pure.js` and `impure.js`.
UI files must not implement domain decisions; they should call exported orchestration adapters.

## 4) Error Model
Use one tuple convention everywhere:
- Success: `[value, null]`
- Failure: `[null, appErr]`
- Every tuple-returning call that can fail must be followed immediately by `if (err)` handling.
- Async functions return `Promise<[value|null, appErr|null]>` and must be handled with immediate post-`await` checks.

Normalized `appErr` shape:
- `kind`
- `message`
- `recoverable`
- `cause` (optional)
- `code` (optional)

Allowed `kind` values:
- `validation`
- `auth`
- `network`
- `storage`
- `sync`
- `conflict`
- `not_found`
- `unexpected`

## 5) Data Entities
Track these entities with strict validation:
- Expense
- Income
- Asset
- Debt
- Credit
- Loan
- Goal
- Note
- Settings

## 6) Cloud Storage Plan
- Google Sheets is the cloud backend.
- Separate spreadsheet per data type:
  - expenses, income, assets, debts, credit, loans, goals, notes
- Each spreadsheet includes:
  - `Data` sheet
  - `Meta` sheet
- On sign-in, provision missing sheets and store IDs in settings/cache.
- Conflict tie-break default: newer `updatedAt` wins; if equal, local wins.
- Explicit conflict actions: `keep_local`, `keep_cloud`, `manual_merge`.

## 7) Features
- Lock screen until sign-in
- CRUD for all major entities with strict validation
- Global and local sorting/filtering
- Dashboard datapoints table (normalized from legacy spreadsheet model):
  - Credit Card Capacity
  - Credit Card Debt
  - Credit Card Utilization
  - Debt to Income Ratio
  - Emergency Funds
  - Emergency Funds Goal
  - Goals Completed / In Progress / Not Started
  - Monthly Expenses / Monthly Income
  - Months Until Debt-Free
  - Monthly Debt Payback
  - Net Worth
  - Savings Rate
  - Total Debts
  - Travel Goals Completed
  - Travel Goals On Bucket List
  - Yearly Income
- Reports:
  - Monthly income vs expense
  - Category spend breakdown
  - Debt payoff forecast
  - Cashflow trend
- Conflict handling prompts on sync mismatch:
  - keep local
  - keep cloud
  - manual merge when feasible

## 8) Testing and Quality Gates
- Unit tests for every exported function in `pure.js` and `impure.js`.
- Test both tuple success and tuple error branches.
- Keep test placement in `src/tests/pure.test.js` and `src/tests/impure.test.js` unless a hard technical blocker exists.
- Include smoke coverage for auth/sync/import-export orchestration.
- Add integration tests for auth/session init, cloud roundtrip, import/export roundtrip, and conflict decision path.

## 9) Delivery Phases
1. Foundation: tuple primitives, validation baseline, pure/impure boundaries.
2. Local features: CRUD, metrics, reports, theme, JSON import/export.
3. Google integration: auth, sheet provisioning, cloud read/write.
4. Sync hardening: conflicts, fallback logic, resilience.
5. Release: tests green, docs clear, GitHub Pages verified.

## 10) Tooling Clarification
- JavaScript source only.
- `tsconfig.json` + `tsc --checkJs` are allowed for JS checking.
- No `.ts`/`.tsx` source files.
- Required scripts: `npm run dev`, `npm run test`, `npm run lint`, `npm run checkjs`.
- CI blocks merge if any required script fails.

## 11) Data Contract and Security
- JSON import/export includes root `schemaVersion`.
- Unknown major schema versions must return tuple errors.
- Known older schemas may migrate before validation.
- Never log tokens, secrets, or full auth payloads.
- Log only safe metadata (`kind`, `code`, entity id).
- Keep auth/session storage operations inside `impure.js`.

## 12) Performance Guardrails
- Target smooth UI at 1,000 rows per entity type on evergreen browsers.
- Prefer linear-time pure transforms where possible.
- Avoid repeated full recomputation for scoped updates.

## 13) Definition of Done
Done means:
- Requested modules are usable end-to-end.
- Tuple-based error handling is consistent.
- Pure/impure boundaries are enforced.
- Exported functions have tests for success and failure.
- JSON import/export and Google Sheets sync work with conflict prompts.
- Deployment instructions for GitHub Pages are complete and accurate.
- Post-deploy smoke checks pass for sign-in gate, dashboard render, and local import/export.
