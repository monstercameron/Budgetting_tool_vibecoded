# AGENTS.md

## Quick Contract (Read First)
- Use JavaScript only for app source. Do not add `.ts` or `.tsx` source files.
- Keep core logic in `src/core/pure.js` and `src/core/impure.js`.
- Use tuple results for project functions: `[value, err]`.
- Check tuple errors immediately after each call that can fail.
- `src/core/pure.js` must stay deterministic and side-effect free.
- `src/core/impure.js` owns side effects (browser APIs, network, storage, time, Google APIs).
- No exception-driven control flow.

## Purpose
This document defines non-negotiable repository standards for all agent-authored and human-authored code in this project.

## 1) Global Rules (MUST)
- Use JavaScript only. No TypeScript syntax in source files.
- Use JSDoc for function contracts and type checking context.
- Use Go-style tuple errors for project functions: return `[val, err]`.
- Perform immediate error checks after tuple-returning calls.
- Keep code simple, explicit, and review-friendly.
- Use descriptive long function names (target 6-12 words).
- Prefer pure functions first. Use impure code only for real side effects.
- Add concise single-line comments only on correctness-critical paths.
- Target modern JavaScript for evergreen browsers.
- Use Tailwind CSS for frontend styling unless a specific task requires otherwise.
- Keep the local dev server running in the background while implementing UI changes to validate behavior in real time.
- After each code-change batch, verify the dev server still boots and report the result before proceeding.
- Frontend visual direction should favor sleek modern color systems with glass/transparency layers, soft blurs, and rounded squircle-like surfaces.
- Every new UI component must include explicit dark-mode CSS treatment (background, text, border, and interactive states) at implementation time.
- Every new UI component must include explicit dark-mode CSS treatment (background, text, border, and interactive states) at implementation time.

## 2) Repository Structure (MUST)
- Core application logic lives in two files:
  - `src/core/pure.js`: deterministic business/domain logic.
  - `src/core/impure.js`: side effects and adapters.
- Unit tests use:
  - `src/tests/pure.test.js`
  - `src/tests/impure.test.js`
- Avoid introducing extra logic files unless there is a hard technical blocker.

## 3) Function Contract Standard (MUST)
All project functions should return tuple results.

```js
/**
 * @template T
 * @typedef {[T|null, AppError|null]} Result
 */
```

### Success
```js
return [value, null]
```

### Failure
```js
return [null, appError]
```

### Immediate Error Handling Pattern (MUST)
```js
const [data, fetchErr] = fetchCurrentMonthIncomeAndExpensesTotals()
if (fetchErr) return [null, fetchErr]
```

### Async Tuple Pattern (MUST)
- Async project functions return `Promise<[value|null, AppError|null]>`.
- Callers must `await` and immediately handle errors.

```js
const [rows, loadErr] = await fetchCurrentMonthRowsFromCloud()
if (loadErr) return [null, loadErr]
```

## 4) Exception Policy (MUST)
- Do not use exceptions for normal control flow.
- `try/catch` is disallowed in domain/orchestration code.
- Narrow exception: `try/catch` is allowed only inside `impure.js` wrappers that normalize throw-prone APIs into tuple errors.
- Wrapper catch blocks must return normalized tuple errors immediately.

### AppError Contract (MUST)
- Use a single normalized shape everywhere:
  - `kind`: one of `validation | auth | network | storage | sync | conflict | not_found | unexpected`
  - `message`: human-readable summary
  - `recoverable`: boolean
  - `code`: optional machine-readable short code
  - `cause`: optional original error object/string
- Helpers in `pure.js` should return `validation` or `unexpected`.
- Wrappers in `impure.js` should map external failures to one of the allowed kinds.

## 5) Pure vs Impure Boundaries (MUST)
### `pure.js`
- Validation
- Sorting/filtering
- Metrics/stat calculations
- Goal progress math
- Debt/credit/loan projections
- Deterministic transforms

### `impure.js`
- Google auth/session
- Google Sheets read/write/provisioning
- Local storage and file import/export
- Time/date access
- Browser API interaction

### Boundary Rule
- `pure.js` must not call browser APIs, network APIs, Google SDKs, or storage APIs.

## 6) Naming Convention (MUST)
- Use descriptive names that communicate purpose and scope.
- Preferred style: `verb_subject_context_expectedOutcome`.
- Example:
  - `calculateDebtToIncomeRatioForCurrentFilteredDateRange`
  - `buildSortableAndFilterableGoalRowsFromCurrentUserState`

## 7) JSDoc Standard (MUST)
Every function must include JSDoc with:
- Purpose summary
- `@param` for all params
- `@returns` tuple type
- Failure conditions in plain language

## 8) Critical Path Comments (MUST)
Add concise single-line comments only where misunderstanding risks correctness:
- Sync conflict decisions
- Auth/session initialization boundaries
- Import/export integrity checks
- Dashboard-driving metric calculations

## 9) Testing Rules (MUST)
- Every exported function must have direct unit test coverage.
- Tuple success and tuple error paths must both be tested.
- `src/tests/pure.test.js` covers deterministic logic.
- `src/tests/impure.test.js` covers wrappers/adapters with mocks/stubs.
- No function may be merged without tests.
- Add one integration test per critical flow:
  - auth/session init
  - cloud sheet provisioning/read-write roundtrip
  - JSON import/export roundtrip with schema version
  - sync conflict decision path

## 10) Tooling Clarification
- `tsconfig.json` and `tsc --checkJs` are allowed for JavaScript type checking only.
- This does not permit TypeScript source files.
- Required scripts: `npm run dev`, `npm run test`, `npm run lint`, `npm run checkjs`.
- CI must fail merge on any failing required script.

## 11) Gitignore Standards (MUST)
- Keep `.gitignore` current and explicit for this repo.
- Always ignore runtime logs and local dev-server artifacts.
- Always ignore build outputs and coverage artifacts.
- Always ignore editor/IDE folders and machine-specific files.
- Never commit `.env` files or other local secret-bearing environment files.

## 12) Data Contract and Sync Rules (MUST)
- Exported JSON must include `schemaVersion` at root.
- Import must reject unknown major versions with a tuple error.
- Import may migrate known older versions before validation.
- Sync conflict policy must support three explicit actions:
  - `keep_local`: local row overwrites cloud row
  - `keep_cloud`: cloud row overwrites local row
  - `manual_merge`: merge only when both rows pass validation
- Use deterministic conflict tie-break:
  - newer `updatedAt` wins when user does not choose
  - if equal, local wins

## 13) Security and Privacy Rules (MUST)
- Never log tokens, secrets, or full auth payloads.
- Store auth/session data only through `impure.js` wrappers.
- Log only safe metadata (`kind`, `code`, entity id).

## 14) Performance and Scale Guardrails (MUST)
- Target smooth UI at 1,000 rows per entity type on modern evergreen browsers.
- Keep pure transform operations linear where feasible (`O(n)` preferred).
- Avoid repeated full recomputation when a scoped update is possible.

## 15) Deployment Acceptance (MUST)
- GitHub Pages build must complete with no errors.
- Verify app loads from the deployed base path.
- Verify sign-in gate, dashboard render, and local import/export smoke flows post-deploy.

## 16) Code Review Checklist (MUST)
Before merge, verify all are true:
- [ ] No TypeScript source files or TS syntax introduced.
- [ ] Every project function returns `[val, err]`.
- [ ] Every async project function returns `Promise<[val, err]>`.
- [ ] Every tuple-returning call has immediate `if (err)` handling.
- [ ] `try/catch` exists only in `impure.js` wrappers that normalize thrown errors.
- [ ] `pure.js` remains side-effect free.
- [ ] `impure.js` contains side-effecting operations.
- [ ] Function names are long and descriptive.
- [ ] JSDoc exists for every function and matches implementation.
- [ ] Critical-path comments are present and concise.
- [ ] Every exported function has unit tests for success and error branches.
- [ ] Integration tests cover auth, sync, and import/export roundtrips.
- [ ] JSON import/export includes `schemaVersion` and migration/rejection behavior.
- [ ] Sync conflict tie-break behavior is deterministic and tested.
- [ ] Logs do not contain tokens or secret payloads.
- [ ] Required scripts (`test`, `lint`, `checkjs`) pass in CI.
- [ ] Syntax stays modern ES for evergreen browsers.

## 17) Agent Operating Expectations
- Implement in `pure.js` first, then wire through `impure.js`.
- Reject shortcuts that violate tuple and immediate error-check rules.
- Optimize for readability and future agent handoff quality.
- Keep implementations explicit and deterministic.
