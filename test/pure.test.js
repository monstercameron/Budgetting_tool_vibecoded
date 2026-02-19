import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildDefaultBudgetCollectionsStateForLocalFirstUsage,
  validateMonetaryValueIsFiniteAndNonNegative,
  validateAndNormalizeBudgetRecordForStrictEditableStorage,
  validateRequiredIncomeExpenseRecordFieldsBeforePersistence,
  appendValidatedIncomeOrExpenseRecordIntoCollectionsState,
  validateRequiredGoalRecordFieldsBeforePersistence,
  appendValidatedGoalRecordIntoCollectionsState,
  calculateMonthlyIncomeExpenseSummaryFromCollectionsState,
  calculateMonthlySavingsStorageSummaryFromCollectionsState,
  calculateEmergencyFundTrackingSummaryFromCollectionsState,
  calculateRecommendedMonthlySavingsTargetFromCollectionsState,
  buildSortedAndFilteredCollectionFromRecordsUsingCriteria,
  calculateTwentyDashboardHealthMetricsFromFinancialCollections,
  calculateCurrentAndPreviousMonthSourceBreakdownFromCollectionsState,
  calculateDetailedDashboardDatapointRowsFromCurrentCollectionsState,
  calculatePowerGoalsStatusFormulaSummaryFromGoalCollection,
  calculateCreditCardSummaryFormulasFromInformationCollection,
  calculateEstimatedPayoffMonthsFromBalancePaymentAndInterestRate,
  calculateLoanPayoffComparisonFromBaseAndExtraPayments,
  mergeImportedCollectionsStateWithExistingStateUsingDedupKeys,
  mergeAuditTimelineEntriesUsingDedupKeys,
  extractFinancialRiskFindingsFromCurrentCollectionsState,
  calculateCreditCardPaymentRecommendationsFromCollectionsState,
  buildPersonaImpactSummaryFromCollectionsStateByPersonaName,
  renamePersonaAcrossCollectionsStateByName,
  deletePersonaAcrossCollectionsStateByName,
  upsertRecurringSeededExpenseRowsIntoCollectionsState,
  calculatePlanningCockpitInsightsFromCollectionsState,
  calculateUnifiedFinancialRecordsSourceOfTruthFromCollectionsState,
  calculateNetWorthProjectionProfilesUsingThreeAggressionLayers
} from '../src/core/pure.js'

test('buildDefaultBudgetCollectionsStateForLocalFirstUsage returns empty collections', () => {
  const [defaultState, defaultStateError] = buildDefaultBudgetCollectionsStateForLocalFirstUsage()
  assert.equal(defaultStateError, null)
  if (!defaultState) assert.fail('expected defaultState to be present')
  assert.equal(defaultState.income.length, 0)
  assert.equal(defaultState.expenses.length, 0)
  assert.equal(defaultState.debts.length, 0)
  assert.equal(defaultState.credit.length, 0)
  assert.equal(defaultState.creditCards.length, 0)
  assert.equal(defaultState.assetHoldings.length, 0)
  assert.equal(defaultState.schemaVersion, 2)
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

test('validateAndNormalizeBudgetRecordForStrictEditableStorage normalizes interest rate for debt records', () => {
  const [normalizedRecord, normalizationError] = validateAndNormalizeBudgetRecordForStrictEditableStorage('debt', {
    amount: 5000,
    interestRatePercent: 8.5
  })
  assert.equal(normalizationError, null)
  if (!normalizedRecord) assert.fail('expected normalizedRecord to be present')
  assert.equal(normalizedRecord.interestRatePercent, 8.5)
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

test('validateRequiredGoalRecordFieldsBeforePersistence validates goal payload', () => {
  const [validatedGoal, validationError] = validateRequiredGoalRecordFieldsBeforePersistence({
    title: 'Build emergency fund',
    status: 'in progress',
    timeframeMonths: 18,
    description: 'Target six months runway'
  })

  assert.equal(validationError, null)
  if (!validatedGoal) assert.fail('expected validatedGoal to be present')
  assert.equal(validatedGoal.status, 'in progress')
  assert.equal(validatedGoal.timeframeMonths, 18)
})

test('appendValidatedGoalRecordIntoCollectionsState appends goal successfully', () => {
  const [defaultState, defaultStateError] = buildDefaultBudgetCollectionsStateForLocalFirstUsage()
  assert.equal(defaultStateError, null)
  if (!defaultState) assert.fail('expected defaultState to be present')

  const [nextState, appendError] = appendValidatedGoalRecordIntoCollectionsState(
    defaultState,
    {
      title: 'Travel to Japan',
      status: 'not started',
      timeframeMonths: 12,
      description: 'Need to plan'
    },
    '2026-02-10T12:00:00.000Z'
  )

  assert.equal(appendError, null)
  if (!nextState) assert.fail('expected nextState to be present')
  assert.equal(nextState.goals.length, 1)
  assert.equal(nextState.goals[0].title, 'Travel to Japan')
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

test('calculateTwentyDashboardHealthMetricsFromFinancialCollections excludes implicit secured collateral from total assets and net worth', () => {
  const [metricsObject, metricsError] = calculateTwentyDashboardHealthMetricsFromFinancialCollections({
    income: [{ amount: 5000 }],
    expenses: [{ amount: 3000 }],
    assets: [{ amount: 10000 }],
    debts: [{ amount: 4000, collateralAssetMarketValue: 25000 }],
    credit: [{ amount: 500, creditLimit: 2000 }],
    loans: [{ amount: 2000, collateralAssetMarketValue: 12000 }],
    goals: []
  })

  assert.equal(metricsError, null)
  if (!metricsObject) assert.fail('expected metricsObject to be present')
  assert.equal(metricsObject.totalAssets, 10000)
  assert.equal(metricsObject.totalLiabilities, 6500)
  assert.equal(metricsObject.netWorth, 3500)
})

test('calculateTwentyDashboardHealthMetricsFromFinancialCollections includes asset holdings net value in total assets and net worth', () => {
  const [metricsObject, metricsError] = calculateTwentyDashboardHealthMetricsFromFinancialCollections({
    income: [{ amount: 5000 }],
    expenses: [{ amount: 3000 }],
    assets: [{ amount: 10000 }],
    assetHoldings: [{ assetMarketValue: 120000, assetValueOwed: 90000 }],
    debts: [{ amount: 4000 }],
    credit: [{ amount: 500, creditLimit: 2000 }],
    loans: [{ amount: 2000 }],
    goals: []
  })

  assert.equal(metricsError, null)
  if (!metricsObject) assert.fail('expected metricsObject to be present')
  assert.equal(metricsObject.totalAssets, 40000)
  assert.equal(metricsObject.totalLiabilities, 6500)
  assert.equal(metricsObject.netWorth, 33500)
})

test('calculateMonthlySavingsStorageSummaryFromCollectionsState returns savings and allocation rows', () => {
  const [summary, summaryError] = calculateMonthlySavingsStorageSummaryFromCollectionsState({
    income: [{ amount: 6000 }],
    expenses: [{ amount: 4000 }],
    assets: [
      { id: 'a1', person: 'PersonA', item: 'HYSA', amount: 9000, description: 'Primary cash reserve' },
      { id: 'a2', person: 'PersonB', item: 'Brokerage Cash', amount: 1000, description: 'Secondary reserve' }
    ]
  })

  assert.equal(summaryError, null)
  if (!summary) assert.fail('expected summary to be present')
  assert.equal(summary.monthlySavingsAmount, 0)
  assert.equal(summary.monthlySavingsRatePercent, 0)
  assert.equal(summary.totalStoredSavings, 10000)
  assert.equal(summary.storageRows.length, 2)
})

test('calculateMonthlySavingsStorageSummaryFromCollectionsState uses tracked monthly savings entries when present', () => {
  const [summary, summaryError] = calculateMonthlySavingsStorageSummaryFromCollectionsState(
    {
      income: [{ amount: 5000 }],
      expenses: [{ amount: 4500 }],
      assets: [
        { id: 's1', person: 'PersonA', item: 'Savings Transfer', recordType: 'savings', amount: 700, date: '2026-02-02' },
        { id: 's2', person: 'PersonA', item: 'Older Savings Transfer', recordType: 'savings', amount: 400, date: '2026-01-02' }
      ]
    },
    new Date('2026-02-20T00:00:00.000Z')
  )

  assert.equal(summaryError, null)
  if (!summary) assert.fail('expected summary to be present')
  assert.equal(summary.monthlySavingsAmount, 700)
  assert.ok(Math.abs(summary.monthlySavingsRatePercent - 14) < 0.0001)
})

test('calculateRecommendedMonthlySavingsTargetFromCollectionsState returns industry-based target and gap', () => {
  const [recommendation, recommendationError] = calculateRecommendedMonthlySavingsTargetFromCollectionsState({
    income: [{ amount: 8000 }],
    expenses: [{ amount: 5000 }],
    debts: [{ minimumPayment: 600 }],
    credit: [{ minimumPayment: 200 }],
    loans: [{ minimumPayment: 200 }]
  })

  assert.equal(recommendationError, null)
  if (!recommendation) assert.fail('expected recommendation to be present')
  assert.equal(recommendation.totalIncomeForReference, 8000)
  assert.ok(recommendation.recommendedMonthlySavings >= 0)
  assert.ok(recommendation.minimumRecommendedSavings > 0)
  assert.ok(typeof recommendation.recommendationReason === 'string')
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

test('calculateCurrentAndPreviousMonthSourceBreakdownFromCollectionsState includes dated collateral market values in monthly assets', () => {
  const [breakdown, breakdownError] = calculateCurrentAndPreviousMonthSourceBreakdownFromCollectionsState(
    {
      income: [{ amount: 3000, date: '2026-02-10' }],
      expenses: [{ amount: 1200, date: '2026-02-04' }],
      assets: [{ amount: 10000, date: '2026-02-02' }],
      debts: [{ amount: 1500, collateralAssetMarketValue: 250000, date: '2026-02-06' }],
      credit: [{ amount: 400, date: '2026-02-08' }],
      loans: [{ amount: 2000, collateralAssetMarketValue: 26000, date: '2026-02-09' }]
    },
    new Date('2026-02-20T00:00:00.000Z')
  )

  assert.equal(breakdownError, null)
  if (!breakdown) assert.fail('expected breakdown to be present')
  assert.equal(breakdown.assets.currentMonth, 286000)
  assert.equal(breakdown.liabilities.currentMonth, 3900)
  assert.equal(breakdown.netWorth.currentMonth, 282100)
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

test('calculateDetailedDashboardDatapointRowsFromCurrentCollectionsState returns requested dashboard datapoints', () => {
  const [rows, rowsError] = calculateDetailedDashboardDatapointRowsFromCurrentCollectionsState({
    income: [{ amount: 4000, date: '2026-02-01' }],
    expenses: [{ amount: 2000, date: '2026-02-01' }],
    assets: [{ amount: 12000, date: '2026-02-01' }],
    debts: [{ amount: 3000, minimumPayment: 300, collateralAssetMarketValue: 5000, date: '2026-02-01' }],
    credit: [{ amount: 500, creditLimit: 2500, minimumPayment: 50, date: '2026-02-01' }],
    loans: [{ amount: 6000, minimumPayment: 200, date: '2026-02-01' }],
    goals: [
      { title: 'Travel Japan', targetAmount: 2000, currentAmount: 2000 },
      { title: 'Emergency Buffer', targetAmount: 5000, currentAmount: 1000 },
      { title: 'Travel Italy', targetAmount: 3000, currentAmount: 0 }
    ]
  })

  assert.equal(rowsError, null)
  if (!rows) assert.fail('expected rows to be present')
  assert.ok(rows.length >= 19)
  assert.ok(rows.some((row) => row.metric === 'Credit Card Capacity'))
  assert.ok(rows.some((row) => row.metric === 'Debt to Income Ratio'))
  assert.ok(rows.some((row) => row.metric === 'Savings Rate'))
  assert.ok(rows.some((row) => row.metric === 'Secured Debt Loan-To-Value'))
})

test('calculateDetailedDashboardDatapointRowsFromCurrentCollectionsState uses tracked monthly savings rate for Savings Rate metric', () => {
  const [rows, rowsError] = calculateDetailedDashboardDatapointRowsFromCurrentCollectionsState({
    income: [{ amount: 4000, date: '2026-02-01' }],
    expenses: [{ amount: 3950, date: '2026-02-01' }],
    assets: [{ amount: 400, recordType: 'savings', date: '2026-02-10' }],
    debts: [],
    credit: [],
    loans: [],
    goals: []
  })

  assert.equal(rowsError, null)
  if (!rows) assert.fail('expected rows to be present')
  const savingsRateRow = rows.find((rowItem) => rowItem.metric === 'Savings Rate')
  if (!savingsRateRow) assert.fail('expected Savings Rate row to be present')
  assert.equal(savingsRateRow.value, 10)
})

test('calculateDetailedDashboardDatapointRowsFromCurrentCollectionsState returns validation error for malformed state', () => {
  const [rows, rowsError] = calculateDetailedDashboardDatapointRowsFromCurrentCollectionsState(
    /** @type {any} */ ({ income: [], expenses: [] })
  )

  assert.equal(rows, null)
  assert.ok(rowsError)
  assert.equal(rowsError.kind, 'VALIDATION')
})

test('calculatePowerGoalsStatusFormulaSummaryFromGoalCollection returns goal formulas', () => {
  const [summary, summaryError] = calculatePowerGoalsStatusFormulaSummaryFromGoalCollection([
    { title: 'A', status: 'completed', timeframeMonths: 1 },
    { title: 'B', status: 'in progress', timeframeMonths: 6 },
    { title: 'C', status: 'not started', timeframeMonths: 12 }
  ])

  assert.equal(summaryError, null)
  if (!summary) assert.fail('expected summary to be present')
  assert.equal(summary.completedCount, 1)
  assert.equal(summary.inProgressCount, 1)
  assert.equal(summary.notStartedCount, 1)
  assert.equal(summary.shortTermNotStartedCount, 1)
})

test('calculatePowerGoalsStatusFormulaSummaryFromGoalCollection returns validation error for malformed payload', () => {
  const [summary, summaryError] = calculatePowerGoalsStatusFormulaSummaryFromGoalCollection(
    /** @type {any} */ ({ goals: [] })
  )

  assert.equal(summary, null)
  assert.ok(summaryError)
  assert.equal(summaryError.kind, 'VALIDATION')
})

test('calculateCreditCardSummaryFormulasFromInformationCollection returns aggregate formulas', () => {
  const [summary, summaryError] = calculateCreditCardSummaryFormulasFromInformationCollection([
    { maxCapacity: 12345, currentBalance: 0, monthlyPayment: 275 },
    { maxCapacity: 4321, currentBalance: 7654, monthlyPayment: 325 }
  ])

  assert.equal(summaryError, null)
  if (!summary) assert.fail('expected summary to be present')
  assert.equal(summary.totalCurrent, 7654)
  assert.equal(summary.totalMonthly, 600)
  assert.equal(summary.maxCapacity, 16666)
  assert.equal(summary.remainingCapacity, 9012)
})

test('calculateCreditCardSummaryFormulasFromInformationCollection returns validation error for malformed payload', () => {
  const [summary, summaryError] = calculateCreditCardSummaryFormulasFromInformationCollection(
    /** @type {any} */ ({ cards: [] })
  )

  assert.equal(summary, null)
  assert.ok(summaryError)
  assert.equal(summaryError.kind, 'VALIDATION')
})

test('calculateEstimatedPayoffMonthsFromBalancePaymentAndInterestRate returns amortized payoff duration', () => {
  const [monthsToPayoff, payoffError] = calculateEstimatedPayoffMonthsFromBalancePaymentAndInterestRate(10000, 300, 12)
  assert.equal(payoffError, null)
  assert.ok(typeof monthsToPayoff === 'number')
  assert.ok(monthsToPayoff > 0)
})

test('calculateLoanPayoffComparisonFromBaseAndExtraPayments returns faster payoff with interest savings', () => {
  const [comparison, comparisonError] = calculateLoanPayoffComparisonFromBaseAndExtraPayments(10000, 300, 100, 12)
  assert.equal(comparisonError, null)
  if (!comparison) assert.fail('expected comparison to be present')
  assert.ok(comparison.baseMonths > comparison.acceleratedMonths)
  assert.ok(comparison.monthsSaved > 0)
  assert.ok(comparison.interestSaved > 0)
})

test('calculateLoanPayoffComparisonFromBaseAndExtraPayments returns validation error on invalid values', () => {
  const [comparison, comparisonError] = calculateLoanPayoffComparisonFromBaseAndExtraPayments(10000, -1, 100, 12)
  assert.equal(comparison, null)
  assert.ok(comparisonError)
  assert.equal(comparisonError.kind, 'VALIDATION')
})

test('extractFinancialRiskFindingsFromCurrentCollectionsState caps at fifty findings', () => {
  const [findings, findingsError] = extractFinancialRiskFindingsFromCurrentCollectionsState({
    income: [{ amount: 1000 }],
    expenses: [{ amount: 4000 }],
    assets: [{ amount: 100 }],
    debts: Array.from({ length: 25 }, (_, index) => ({
      item: `Debt ${index + 1}`,
      amount: 10000,
      minimumPayment: 600
    })),
    credit: Array.from({ length: 25 }, (_, index) => ({
      item: `Card ${index + 1}`,
      amount: 9000,
      creditLimit: 1000,
      minimumPayment: 500
    })),
    loans: Array.from({ length: 25 }, (_, index) => ({
      item: `Loan ${index + 1}`,
      amount: 12000,
      minimumPayment: 700
    })),
    goals: []
  })

  assert.equal(findingsError, null)
  if (!findings) assert.fail('expected findings to be present')
  assert.ok(findings.length <= 50)
})

test('extractFinancialRiskFindingsFromCurrentCollectionsState includes new high-signal risk checks', () => {
  const [findings, findingsError] = extractFinancialRiskFindingsFromCurrentCollectionsState({
    income: [{ item: 'Salary', amount: 5000 }],
    expenses: [
      { category: 'Housing', amount: 1800 },
      { category: 'Utilities', amount: 500 },
      { category: 'Insurance', amount: 400 }
    ],
    assets: [{ recordType: 'savings', amount: 200 }],
    debts: [{ item: 'Mortgage', amount: 220000, minimumPayment: 1700, interestRatePercent: 7, collateralAssetMarketValue: 200000, updatedAt: '2024-01-01' }],
    credit: [{ item: 'Card A', amount: 5000, creditLimit: 10000, minimumPayment: 490, interestRatePercent: 29, updatedAt: '2024-01-01' }],
    loans: [{ item: 'Car Loan', amount: 18000, minimumPayment: 500, interestRatePercent: 9, collateralAssetMarketValue: 15000, updatedAt: '2024-01-01' }],
    goals: []
  })
  assert.equal(findingsError, null)
  if (!findings) assert.fail('expected findings to be present')
  const ids = new Set(findings.map((findingItem) => findingItem.id))
  assert.equal(ids.has('runway-debt-lt-1') || ids.has('runway-debt-lt-3'), true)
  assert.equal(ids.has('fixed-cost-ratio-gt-60'), true)
  assert.equal(ids.has('income-concentration-gt-90'), true)
  assert.equal(ids.has('apr-exposure-gt-25'), true)
  assert.equal(ids.has('secured-specific-ltv-risk'), true)
  assert.equal(ids.has('stale-balance-gt-0') || ids.has('stale-balance-gt-3'), true)
})

test('calculateCreditCardPaymentRecommendationsFromCollectionsState returns weighted recommendations', () => {
  const [recommendations, recommendationsError] = calculateCreditCardPaymentRecommendationsFromCollectionsState(
    {
      income: [{ amount: 8000 }],
      expenses: [{ amount: 4500 }],
      debts: [{ amount: 15000, minimumPayment: 500 }],
      loans: [{ amount: 5000, minimumPayment: 200 }]
    },
    [
      { id: 'a', person: 'PersonA', item: 'CardAlpha', currentBalance: 2450, maxCapacity: 7100, minimumPayment: 210, monthlyPayment: 420, interestRatePercent: 26.1 },
      { id: 'b', person: 'PersonA', item: 'CardBeta', currentBalance: 740, maxCapacity: 2900, minimumPayment: 95, monthlyPayment: 180, interestRatePercent: 21.7 }
    ]
  )

  assert.equal(recommendationsError, null)
  if (!recommendations) assert.fail('expected recommendations to be present')
  assert.equal(recommendations.strategy.includes('avalanche'), true)
  assert.equal(recommendations.rows.length, 2)
  assert.ok(recommendations.recommendedTotalMonthlyPayment >= recommendations.currentTotalMonthlyPayment)
  assert.ok(recommendations.weightedPayoffMonthsRecommended <= recommendations.weightedPayoffMonthsCurrent)
})

test('buildPersonaImpactSummaryFromCollectionsStateByPersonaName returns cross-collection counts', () => {
  const [summary, summaryError] = buildPersonaImpactSummaryFromCollectionsStateByPersonaName(
    {
      income: [{ person: 'PersonA' }],
      expenses: [{ person: 'PersonA' }, { person: 'PersonC' }],
      assets: [{ person: 'PersonA' }],
      debts: [],
      credit: [{ person: 'PersonA' }],
      loans: [],
      creditCards: [{ person: 'PersonA' }]
    },
    'PersonA'
  )
  assert.equal(summaryError, null)
  if (!summary) assert.fail('expected summary to be present')
  assert.equal(summary.total, 5)
})

test('renamePersonaAcrossCollectionsStateByName renames persona in records and persona list', () => {
  const [nextState, renameError] = renamePersonaAcrossCollectionsStateByName(
    {
      income: [{ person: 'PersonA' }],
      expenses: [{ person: 'PersonA' }],
      assets: [],
      debts: [],
      credit: [],
      loans: [],
      creditCards: [],
      personas: [{ name: 'PersonA', emoji: '🙂', note: '' }]
    },
    'PersonA',
    'PersonD',
    { emoji: '🧑‍💻', note: 'Updated' }
  )
  assert.equal(renameError, null)
  if (!nextState) assert.fail('expected nextState to be present')
  assert.equal(nextState.income[0].person, 'PersonD')
  assert.equal(nextState.personas[0].name, 'PersonD')
  assert.equal(nextState.personas[0].emoji, '🧑‍💻')
})

test('deletePersonaAcrossCollectionsStateByName supports reassign and cascade', () => {
  const baseState = {
    income: [{ person: 'PersonA' }],
    expenses: [{ person: 'PersonA' }, { person: 'PersonC' }],
    assets: [],
    debts: [],
    credit: [],
    loans: [],
    creditCards: [],
    personas: [{ name: 'PersonA' }, { name: 'PersonC' }]
  }
  const [reassignedState, reassignError] = deletePersonaAcrossCollectionsStateByName(baseState, 'PersonA', 'reassign', 'PersonC')
  assert.equal(reassignError, null)
  if (!reassignedState) assert.fail('expected reassignedState to be present')
  assert.equal(reassignedState.income[0].person, 'PersonC')

  const [cascadeState, cascadeError] = deletePersonaAcrossCollectionsStateByName(baseState, 'PersonA', 'cascade')
  assert.equal(cascadeError, null)
  if (!cascadeState) assert.fail('expected cascadeState to be present')
  assert.equal(cascadeState.income.length, 0)
})

test('upsertRecurringSeededExpenseRowsIntoCollectionsState preserves rows without injecting seeded expenses', () => {
  const [result, resultError] = upsertRecurringSeededExpenseRowsIntoCollectionsState({
    income: [],
    expenses: [{ person: 'PersonA', item: 'Gasoline', category: 'Fuel', amount: 0, description: 'No car right now' }],
    assets: [],
    debts: [],
    credit: [],
    loans: [],
    goals: [],
    notes: [],
    schemaVersion: 1
  })
  assert.equal(resultError, null)
  if (!result) assert.fail('expected result to be present')
  assert.equal(result.addedCount, 0)
  const gasolineRows = result.nextCollectionsState.expenses.filter((rowItem) => rowItem.item === 'Gasoline')
  assert.equal(gasolineRows.length, 1)
})

test('upsertRecurringSeededExpenseRowsIntoCollectionsState removes legacy synthetic debt payment expense row', () => {
  const [result, resultError] = upsertRecurringSeededExpenseRowsIntoCollectionsState({
    income: [],
    expenses: [{ person: 'PersonA', item: 'Debts', category: 'Debt Payment', amount: 2468, description: 'Total debt payments' }],
    assets: [],
    debts: [],
    credit: [],
    loans: [],
    goals: [],
    notes: [],
    schemaVersion: 1
  })
  assert.equal(resultError, null)
  if (!result) assert.fail('expected result to be present')
  const legacyRows = result.nextCollectionsState.expenses.filter((rowItem) => rowItem.item === 'Debts' && rowItem.category === 'Debt Payment')
  assert.equal(legacyRows.length, 0)
})

test('calculatePlanningCockpitInsightsFromCollectionsState returns executable planning sections', () => {
  const [planningInsights, planningError] = calculatePlanningCockpitInsightsFromCollectionsState({
    income: [{ amount: 8000 }],
    expenses: [{ amount: 300, category: 'Utilities', item: 'Internet' }, { amount: 600, category: 'Groceries', item: 'Groceries' }],
    assets: [{ amount: 1200, recordType: 'savings' }],
    debts: [{ id: 'd1', item: 'Mortgage', amount: 100000, minimumPayment: 1200, interestRatePercent: 6.5 }],
    credit: [{ id: 'c1', item: 'Card', amount: 2000, minimumPayment: 120, interestRatePercent: 24, creditLimit: 5000 }],
    loans: [{ id: 'l1', item: 'Car', amount: 10000, minimumPayment: 350, interestRatePercent: 8.5 }],
    goals: []
  })
  assert.equal(planningError, null)
  if (!planningInsights) assert.fail('expected planningInsights to be present')
  assert.ok(planningInsights.budgetVsActualRows.length > 0)
  assert.ok(planningInsights.recurringBaselineRows.length > 0)
  assert.ok(planningInsights.amortizationRows.length > 0)
  assert.equal(typeof planningInsights.forecast.projectedRiskLevel, 'string')
  assert.ok(planningInsights.scenarioRows.length >= 3)
  assert.ok(planningInsights.riskProvenanceRows.length > 0)
  assert.equal(planningInsights.reconcileChecklistRows.length, 3)
})

test('calculateUnifiedFinancialRecordsSourceOfTruthFromCollectionsState returns canonical merged records', () => {
  const [recordRows, recordRowsError] = calculateUnifiedFinancialRecordsSourceOfTruthFromCollectionsState({
    income: [{ id: 'i1', amount: 2000 }],
    expenses: [{ id: 'e1', amount: 500 }],
    assets: [{ id: 'a1', recordType: 'savings', amount: 300 }],
    debts: [{ id: 'd1', minimumPayment: 100 }],
    credit: [{ id: 'c1', minimumPayment: 80 }],
    loans: [{ id: 'l1', minimumPayment: 120 }],
    creditCards: [{ id: 'cc1', item: 'CardAlpha', monthlyPayment: 250 }],
    assetHoldings: [{ id: 'ah1', item: 'House', assetValueOwed: 100, assetMarketValue: 1000 }],
    goals: []
  })
  assert.equal(recordRowsError, null)
  if (!recordRows) assert.fail('expected recordRows to be present')
  assert.equal(recordRows.length, 8)
  const byType = new Map(recordRows.map((rowItem) => [String(rowItem.recordType), rowItem]))
  assert.equal(Number(byType.get('income')?.signedAmount ?? 0), 2000)
  assert.equal(Number(byType.get('expense')?.signedAmount ?? 0), -500)
  assert.equal(Number(byType.get('savings')?.signedAmount ?? 0), -300)
  assert.equal(Number(byType.get('debt')?.amount ?? 0), 100)
  assert.equal(Number(byType.get('loan')?.amount ?? 0), 120)
  assert.equal(Number(byType.get('credit')?.amount ?? 0), 80)
  assert.equal(Number(byType.get('credit card')?.amount ?? 0), 250)
  assert.equal(Number(byType.get('asset')?.amount ?? 0), 900)
})

test('mergeImportedCollectionsStateWithExistingStateUsingDedupKeys merges without duplicating records', () => {
  const [mergedState, mergeError] = mergeImportedCollectionsStateWithExistingStateUsingDedupKeys(
    {
      income: [{ id: 'i1', person: 'PersonA', amount: 1000, category: 'Salary', date: '2026-01-01' }],
      expenses: [{ id: 'e1', person: 'PersonA', amount: 200, category: 'Food', date: '2026-01-01' }],
      assets: [],
      debts: [],
      credit: [],
      loans: [],
      goals: []
    },
    {
      income: [{ id: 'i1', person: 'PersonA', amount: 1200, category: 'Salary', date: '2026-01-01' }, { id: 'i2', person: 'PersonA', amount: 300, category: 'Rent', date: '2026-01-01' }],
      expenses: [{ id: 'e1', person: 'PersonA', amount: 200, category: 'Food', date: '2026-01-01' }],
      assets: [],
      debts: [],
      credit: [],
      loans: [],
      goals: []
    }
  )
  assert.equal(mergeError, null)
  if (!mergedState) assert.fail('expected mergedState to be present')
  assert.equal(mergedState.income.length, 2)
  const mergedIncomeById = new Map(mergedState.income.map((rowItem) => [rowItem.id, rowItem]))
  assert.equal(mergedIncomeById.get('i1').amount, 1200)
  assert.equal(mergedIncomeById.get('i2').amount, 300)
  assert.equal(mergedState.expenses.length, 1)
})

test('mergeAuditTimelineEntriesUsingDedupKeys removes duplicate entries', () => {
  const [mergedTimeline, mergeError] = mergeAuditTimelineEntriesUsingDedupKeys(
    [{ id: 'a1', timestamp: '2026-02-01T00:00:00.000Z', contextTag: 'add-record' }],
    [{ id: 'a1', timestamp: '2026-02-01T00:00:00.000Z', contextTag: 'add-record' }, { id: 'a2', timestamp: '2026-02-02T00:00:00.000Z', contextTag: 'import' }]
  )
  assert.equal(mergeError, null)
  if (!mergedTimeline) assert.fail('expected mergedTimeline to be present')
  assert.equal(mergedTimeline.length, 2)
  assert.equal(mergedTimeline[0].id, 'a2')
})

test('calculateNetWorthProjectionProfilesUsingThreeAggressionLayers returns 3 profiles and required horizons', () => {
  const [defaultState, defaultStateError] = buildDefaultBudgetCollectionsStateForLocalFirstUsage()
  assert.equal(defaultStateError, null)
  if (!defaultState) assert.fail('expected defaultState to be present')

  const [projectionRows, projectionRowsError] = calculateNetWorthProjectionProfilesUsingThreeAggressionLayers(defaultState)
  assert.equal(projectionRowsError, null)
  if (!projectionRows) assert.fail('expected projectionRows to be present')

  assert.equal(projectionRows.profiles.length, 3)
  assert.equal(projectionRows.horizons.length, 6)
  assert.ok(projectionRows.horizons.some((horizonItem) => horizonItem.id === '10-years'))
  assert.ok(projectionRows.profiles.every((profileItem) => profileItem.points.length === 6))
  assert.ok(projectionRows.profiles.every((profileItem) => profileItem.points.every((pointItem) => typeof pointItem.projectedDebt === 'number')))
})

test('calculateNetWorthProjectionProfilesUsingThreeAggressionLayers returns validation error on malformed input', () => {
  const [projectionRows, projectionRowsError] = calculateNetWorthProjectionProfilesUsingThreeAggressionLayers(/** @type {any} */ ({ income: [] }))
  assert.equal(projectionRows, null)
  assert.ok(projectionRowsError)
  assert.equal(projectionRowsError.kind, 'VALIDATION')
})

test('calculateEmergencyFundTrackingSummaryFromCollectionsState uses 6 months obligations as goal', () => {
  const [summary, summaryError] = calculateEmergencyFundTrackingSummaryFromCollectionsState({
    expenses: [{ amount: 1000 }, { amount: 500 }],
    debts: [{ minimumPayment: 250 }],
    credit: [{ minimumPayment: 100 }],
    loans: [{ minimumPayment: 150 }],
    assets: [
      { item: 'Savings', amount: 800 },
      { item: 'Brokerage', amount: 1200 }
    ],
    assetHoldings: [
      { item: 'Bank', assetMarketValue: 200, assetValueOwed: 0 },
      { item: 'Stocks', assetMarketValue: 1000, assetValueOwed: 0 }
    ]
  })
  assert.equal(summaryError, null)
  if (!summary) assert.fail('expected summary to be present')
  assert.equal(summary.monthlyExpenses, 1500)
  assert.equal(summary.monthlyDebtMinimums, 500)
  assert.equal(summary.monthlyObligations, 2000)
  assert.equal(summary.emergencyFundGoal, 12000)
  assert.equal(summary.liquidTarget, 4000)
  assert.equal(summary.liquidAmount, 1000)
  assert.equal(summary.investedAmount, 2200)
  assert.equal(summary.missingTotalAmount, 8800)
})

