import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildDefaultBudgetCollectionsStateForLocalFirstUsage,
  validateMonetaryValueIsFiniteAndNonNegative,
  validateAndNormalizeBudgetRecordForStrictEditableStorage,
  validateRequiredIncomeExpenseRecordFieldsBeforePersistence,
  appendValidatedIncomeOrExpenseRecordIntoCollectionsState,
  calculateMonthlyIncomeExpenseSummaryFromCollectionsState,
  buildSortedAndFilteredCollectionFromRecordsUsingCriteria,
  calculateTwentyDashboardHealthMetricsFromFinancialCollections,
  calculateCurrentAndPreviousMonthSourceBreakdownFromCollectionsState
} from './pure.js'

test('buildDefaultBudgetCollectionsStateForLocalFirstUsage returns empty collections', () => {
  const [defaultState, defaultStateError] = buildDefaultBudgetCollectionsStateForLocalFirstUsage()
  assert.equal(defaultStateError, null)
  if (!defaultState) assert.fail('expected defaultState to be present')
  assert.deepEqual(defaultState.income, [])
  assert.deepEqual(defaultState.expenses, [])
  assert.equal(defaultState.schemaVersion, 1)
})

test('validateMonetaryValueIsFiniteAndNonNegative returns value on success', () => {
  const [validatedValue, validationError] = validateMonetaryValueIsFiniteAndNonNegative(1200, 'amount')
  assert.equal(validationError, null)
  assert.equal(validatedValue, 1200)
})

test('validateMonetaryValueIsFiniteAndNonNegative returns error on invalid input', () => {
  const [validatedValue, validationError] = validateMonetaryValueIsFiniteAndNonNegative(Number.NaN, 'amount')
  assert.equal(validatedValue, null)
  assert.ok(validationError)
  assert.equal(validationError.kind, 'VALIDATION')
})

test('validateAndNormalizeBudgetRecordForStrictEditableStorage normalizes tags and notes', () => {
  const [normalizedRecord, normalizationError] = validateAndNormalizeBudgetRecordForStrictEditableStorage('income', {
    amount: 4200,
    description: 'Salary'
  })
  assert.equal(normalizationError, null)
  if (!normalizedRecord) assert.fail('expected normalizedRecord to be present')
  assert.deepEqual(normalizedRecord.tags, [])
  assert.equal(normalizedRecord.notes, '')
})

test('validateRequiredIncomeExpenseRecordFieldsBeforePersistence returns error when category is missing', () => {
  const [validatedRecord, validationError] = validateRequiredIncomeExpenseRecordFieldsBeforePersistence('expense', {
    amount: 100,
    date: '2026-02-01',
    category: ''
  })
  assert.equal(validatedRecord, null)
  assert.ok(validationError)
  assert.equal(validationError.kind, 'VALIDATION')
})

test('appendValidatedIncomeOrExpenseRecordIntoCollectionsState appends income row successfully', () => {
  const [defaultState, defaultStateError] = buildDefaultBudgetCollectionsStateForLocalFirstUsage()
  assert.equal(defaultStateError, null)
  if (!defaultState) assert.fail('expected defaultState to be present')

  const [nextState, appendError] = appendValidatedIncomeOrExpenseRecordIntoCollectionsState(
    defaultState,
    'income',
    {
      amount: 3200,
      category: 'Salary',
      date: '2026-02-10',
      description: 'Primary job'
    },
    '2026-02-10T12:00:00.000Z'
  )

  assert.equal(appendError, null)
  if (!nextState) assert.fail('expected nextState to be present')
  assert.equal(nextState.income.length, 1)
  assert.equal(nextState.income[0].category, 'Salary')
})

test('calculateMonthlyIncomeExpenseSummaryFromCollectionsState returns totals and savings rate', () => {
  const [summary, summaryError] = calculateMonthlyIncomeExpenseSummaryFromCollectionsState({
    income: [{ amount: 5000 }, { amount: 1000 }],
    expenses: [{ amount: 3000 }, { amount: 500 }]
  })

  assert.equal(summaryError, null)
  if (!summary) assert.fail('expected summary to be present')
  assert.equal(summary.totalIncome, 6000)
  assert.equal(summary.totalExpenses, 3500)
  assert.equal(summary.monthlySurplusDeficit, 2500)
  assert.equal(summary.savingsRatePercent, (2500 / 6000) * 100)
})

test('buildSortedAndFilteredCollectionFromRecordsUsingCriteria filters by search and sorts descending', () => {
  const recordsCollection = [
    { description: 'Groceries', amount: 90, updatedAt: '2026-01-02' },
    { description: 'Salary', amount: 3000, updatedAt: '2026-01-03' },
    { description: 'Gas', amount: 45, updatedAt: '2026-01-01' }
  ]

  const [filteredRecords, filterError] = buildSortedAndFilteredCollectionFromRecordsUsingCriteria(recordsCollection, {
    searchText: 'g',
    sortBy: 'amount',
    sortDirection: 'desc'
  })

  assert.equal(filterError, null)
  if (!filteredRecords) assert.fail('expected filteredRecords to be present')
  assert.equal(filteredRecords.length, 2)
  assert.equal(filteredRecords[0].description, 'Groceries')
})

test('calculateTwentyDashboardHealthMetricsFromFinancialCollections returns all expected metric keys', () => {
  const [metricsObject, metricsError] = calculateTwentyDashboardHealthMetricsFromFinancialCollections({
    income: [{ amount: 5000 }],
    expenses: [{ amount: 3000 }],
    assets: [{ amount: 20000 }],
    debts: [{ amount: 1000 }],
    credit: [{ amount: 500, creditLimit: 2000 }],
    loans: [{ amount: 4000 }],
    goals: [{ targetAmount: 10000, currentAmount: 5000 }]
  })

  assert.equal(metricsError, null)
  assert.ok(metricsObject)

  const metricKeys = Object.keys(metricsObject)
  assert.equal(metricKeys.length, 20)
  assert.ok(metricKeys.includes('netWorth'))
  assert.ok(metricKeys.includes('creditUtilizationPercent'))
  assert.ok(metricKeys.includes('goalProgressScorePercent'))
})

test('calculateCurrentAndPreviousMonthSourceBreakdownFromCollectionsState returns month deltas from dated records', () => {
  const [breakdown, breakdownError] = calculateCurrentAndPreviousMonthSourceBreakdownFromCollectionsState(
    {
      income: [{ amount: 3000, date: '2026-02-10' }, { amount: 2500, date: '2026-01-15' }],
      expenses: [{ amount: 1200, date: '2026-02-04' }, { amount: 800, date: '2026-01-20' }],
      assets: [{ amount: 10000, date: '2026-02-02' }, { amount: 9000, date: '2026-01-02' }],
      debts: [{ amount: 1500, date: '2026-02-06' }, { amount: 1400, date: '2026-01-06' }],
      credit: [{ amount: 400, date: '2026-02-08' }, { amount: 300, date: '2026-01-08' }],
      loans: [{ amount: 2000, date: '2026-02-09' }, { amount: 1900, date: '2026-01-09' }]
    },
    new Date('2026-02-20T00:00:00.000Z')
  )

  assert.equal(breakdownError, null)
  if (!breakdown) assert.fail('expected breakdown to be present')
  assert.equal(breakdown.income.currentMonth, 3000)
  assert.equal(breakdown.income.previousMonth, 2500)
  assert.equal(breakdown.income.delta, 500)
  assert.equal(breakdown.liabilities.currentMonth, 3900)
  assert.equal(breakdown.liabilities.previousMonth, 3600)
  assert.equal(breakdown.netWorth.currentMonth, 6100)
  assert.equal(breakdown.netWorth.previousMonth, 5400)
})

test('calculateCurrentAndPreviousMonthSourceBreakdownFromCollectionsState returns validation error for malformed state', () => {
  const [breakdown, breakdownError] = calculateCurrentAndPreviousMonthSourceBreakdownFromCollectionsState(
    /** @type {any} */ ({ income: [] }),
    new Date('2026-02-20T00:00:00.000Z')
  )

  assert.equal(breakdown, null)
  assert.ok(breakdownError)
  assert.equal(breakdownError.kind, 'VALIDATION')
})
