/**
 * @typedef {Object} AppError
 * @property {string} kind
 * @property {string} message
 * @property {boolean} recoverable
 * @property {unknown} [details]
 */

/**
 * @template T
 * @typedef {[T|null, AppError|null]} Result
 */

/**
 * Creates a normalized application error object for tuple-based error flow.
 * @param {string} errorKind
 * @param {string} errorMessage
 * @param {boolean} isRecoverable
 * @param {unknown} [errorDetails]
 * @returns {Result<AppError>}
 */
export function createApplicationErrorWithKindMessageAndRecoverability(errorKind, errorMessage, isRecoverable, errorDetails) {
  return [
    {
      kind: errorKind,
      message: errorMessage,
      recoverable: isRecoverable,
      details: errorDetails
    },
    null
  ]
}

/**
 * Validates that a monetary value is a finite number greater than or equal to zero.
 * Returns a validation error when the value is not a valid currency-compatible number.
 * @param {unknown} valueToValidate
 * @param {string} valueFieldName
 * @returns {Result<number>}
 */
export function validateMonetaryValueIsFiniteAndNonNegative(valueToValidate, valueFieldName) {
  if (typeof valueToValidate !== 'number' || Number.isNaN(valueToValidate) || !Number.isFinite(valueToValidate)) {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      `${valueFieldName} must be a finite number`,
      true,
      { valueFieldName, valueToValidate }
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  if (valueToValidate < 0) {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      `${valueFieldName} must be non-negative`,
      true,
      { valueFieldName, valueToValidate }
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  return [valueToValidate, null]
}

/**
 * Validates a budget record and normalizes defaults for core editable fields.
 * Returns an error when required fields are missing or values are invalid.
 * @param {'income'|'expense'|'asset'|'debt'|'credit'|'loan'|'goal'|'note'} recordType
 * @param {Record<string, unknown>} rawRecord
 * @returns {Result<Record<string, unknown>>}
 */
export function validateAndNormalizeBudgetRecordForStrictEditableStorage(recordType, rawRecord) {
  if (!rawRecord || typeof rawRecord !== 'object') {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'record payload must be an object',
      true,
      { recordType }
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const normalizedRecord = /** @type {Record<string, unknown>} */ ({
    ...rawRecord,
    // Critical path: default shape keeps downstream math and filters deterministic.
    notes: typeof rawRecord.notes === 'string' ? rawRecord.notes : '',
    tags: Array.isArray(rawRecord.tags) ? rawRecord.tags : []
  })

  if (recordType !== 'note') {
    const [validatedAmount, amountError] = validateMonetaryValueIsFiniteAndNonNegative(rawRecord.amount ?? 0, 'amount')
    if (amountError) return [null, amountError]
    normalizedRecord.amount = validatedAmount
  }

  if (recordType === 'credit') {
    const [validatedCreditLimit, creditLimitError] = validateMonetaryValueIsFiniteAndNonNegative(
      rawRecord.creditLimit ?? 0,
      'creditLimit'
    )
    if (creditLimitError) return [null, creditLimitError]
    normalizedRecord.creditLimit = validatedCreditLimit
  }

  if (recordType === 'debt' || recordType === 'credit' || recordType === 'loan') {
    const [validatedInterestRatePercent, interestRatePercentError] = validateMonetaryValueIsFiniteAndNonNegative(
      rawRecord.interestRatePercent ?? 0,
      'interestRatePercent'
    )
    if (interestRatePercentError) return [null, interestRatePercentError]
    normalizedRecord.interestRatePercent = validatedInterestRatePercent

    const [validatedRemainingPayments, remainingPaymentsError] = validateMonetaryValueIsFiniteAndNonNegative(
      Number(rawRecord.remainingPayments ?? 0),
      'remainingPayments'
    )
    if (remainingPaymentsError) return [null, remainingPaymentsError]
    normalizedRecord.remainingPayments = Math.round(validatedRemainingPayments)

    normalizedRecord.loanStartDate = typeof rawRecord.loanStartDate === 'string' ? rawRecord.loanStartDate : ''
    normalizedRecord.collateralAssetName = typeof rawRecord.collateralAssetName === 'string' ? rawRecord.collateralAssetName : ''
    const [validatedCollateralAssetMarketValue, collateralAssetMarketValueError] = validateMonetaryValueIsFiniteAndNonNegative(
      Number(rawRecord.collateralAssetMarketValue ?? 0),
      'collateralAssetMarketValue'
    )
    if (collateralAssetMarketValueError) return [null, collateralAssetMarketValueError]
    normalizedRecord.collateralAssetMarketValue = validatedCollateralAssetMarketValue
  }

  return [normalizedRecord, null]
}

/**
 * Estimates months to payoff for a balance using monthly payment and annual interest rate.
 * Returns 0 when balance is already zero or monthly payment is zero.
 * @param {number} principalBalance
 * @param {number} monthlyPayment
 * @param {number} annualInterestRatePercent
 * @returns {Result<number>}
 */
export function calculateEstimatedPayoffMonthsFromBalancePaymentAndInterestRate(
  principalBalance,
  monthlyPayment,
  annualInterestRatePercent
) {
  const [validatedPrincipalBalance, principalBalanceError] = validateMonetaryValueIsFiniteAndNonNegative(
    principalBalance,
    'principalBalance'
  )
  if (principalBalanceError) return [null, principalBalanceError]
  const [validatedMonthlyPayment, monthlyPaymentError] = validateMonetaryValueIsFiniteAndNonNegative(
    monthlyPayment,
    'monthlyPayment'
  )
  if (monthlyPaymentError) return [null, monthlyPaymentError]
  const [validatedAnnualInterestRatePercent, annualInterestRatePercentError] = validateMonetaryValueIsFiniteAndNonNegative(
    annualInterestRatePercent,
    'annualInterestRatePercent'
  )
  if (annualInterestRatePercentError) return [null, annualInterestRatePercentError]

  if (validatedPrincipalBalance === 0 || validatedMonthlyPayment === 0) return [0, null]
  if (validatedAnnualInterestRatePercent === 0) return [validatedPrincipalBalance / validatedMonthlyPayment, null]

  const monthlyInterestRate = validatedAnnualInterestRatePercent / 100 / 12
  const monthlyInterestCost = validatedPrincipalBalance * monthlyInterestRate
  // Critical path: if payment cannot cover monthly interest, payoff does not converge.
  if (validatedMonthlyPayment <= monthlyInterestCost) return [9999, null]

  const growthFactor = 1 + monthlyInterestRate
  const monthsToPayoff = -Math.log(1 - (monthlyInterestRate * validatedPrincipalBalance) / validatedMonthlyPayment) / Math.log(growthFactor)
  return [monthsToPayoff, null]
}

/**
 * Compares baseline and accelerated loan payoff outcomes using monthly compounding.
 * Returns months and interest paid deltas for base payment versus base + extra payment.
 * @param {number} principalBalance
 * @param {number} baseMonthlyPayment
 * @param {number} extraMonthlyPayment
 * @param {number} annualInterestRatePercent
 * @returns {Result<{baseMonths:number, acceleratedMonths:number, monthsSaved:number, baseInterestPaid:number, acceleratedInterestPaid:number, interestSaved:number, baseTotalPaid:number, acceleratedTotalPaid:number}>}
 */
export function calculateLoanPayoffComparisonFromBaseAndExtraPayments(
  principalBalance,
  baseMonthlyPayment,
  extraMonthlyPayment,
  annualInterestRatePercent
) {
  const [validatedPrincipalBalance, principalBalanceError] = validateMonetaryValueIsFiniteAndNonNegative(
    principalBalance,
    'principalBalance'
  )
  if (principalBalanceError) return [null, principalBalanceError]
  const [validatedBaseMonthlyPayment, baseMonthlyPaymentError] = validateMonetaryValueIsFiniteAndNonNegative(
    baseMonthlyPayment,
    'baseMonthlyPayment'
  )
  if (baseMonthlyPaymentError) return [null, baseMonthlyPaymentError]
  const [validatedExtraMonthlyPayment, extraMonthlyPaymentError] = validateMonetaryValueIsFiniteAndNonNegative(
    extraMonthlyPayment,
    'extraMonthlyPayment'
  )
  if (extraMonthlyPaymentError) return [null, extraMonthlyPaymentError]
  const [validatedAnnualInterestRatePercent, annualInterestRatePercentError] = validateMonetaryValueIsFiniteAndNonNegative(
    annualInterestRatePercent,
    'annualInterestRatePercent'
  )
  if (annualInterestRatePercentError) return [null, annualInterestRatePercentError]

  function simulateLoanPayoffForMonthlyPayment(monthlyPaymentAmount) {
    if (validatedPrincipalBalance === 0) {
      return [{ months: 0, interestPaid: 0, totalPaid: 0 }, null]
    }
    if (monthlyPaymentAmount === 0) {
      return [{ months: 9999, interestPaid: Number.POSITIVE_INFINITY, totalPaid: Number.POSITIVE_INFINITY }, null]
    }
    const monthlyInterestRate = validatedAnnualInterestRatePercent / 100 / 12
    let remainingBalance = validatedPrincipalBalance
    let months = 0
    let interestPaid = 0
    let totalPaid = 0

    // Critical path: stop runaway loops when payment cannot reduce principal.
    while (remainingBalance > 0.000001 && months < 1200) {
      const monthlyInterest = remainingBalance * monthlyInterestRate
      const principalPayment = monthlyPaymentAmount - monthlyInterest
      if (principalPayment <= 0) {
        return [{ months: 9999, interestPaid: Number.POSITIVE_INFINITY, totalPaid: Number.POSITIVE_INFINITY }, null]
      }
      const paymentApplied = Math.min(monthlyPaymentAmount, remainingBalance + monthlyInterest)
      remainingBalance = Math.max(0, remainingBalance + monthlyInterest - paymentApplied)
      interestPaid += monthlyInterest
      totalPaid += paymentApplied
      months += 1
    }

    if (months >= 1200 && remainingBalance > 0) {
      return [{ months: 9999, interestPaid: Number.POSITIVE_INFINITY, totalPaid: Number.POSITIVE_INFINITY }, null]
    }

    return [{ months, interestPaid, totalPaid }, null]
  }

  const [baseResult, baseResultError] = simulateLoanPayoffForMonthlyPayment(validatedBaseMonthlyPayment)
  if (baseResultError || !baseResult) return [null, baseResultError]
  const [acceleratedResult, acceleratedResultError] = simulateLoanPayoffForMonthlyPayment(validatedBaseMonthlyPayment + validatedExtraMonthlyPayment)
  if (acceleratedResultError || !acceleratedResult) return [null, acceleratedResultError]

  const monthsSaved = Math.max(0, baseResult.months - acceleratedResult.months)
  const interestSaved = Number.isFinite(baseResult.interestPaid) && Number.isFinite(acceleratedResult.interestPaid)
    ? Math.max(0, baseResult.interestPaid - acceleratedResult.interestPaid)
    : 0

  return [{
    baseMonths: baseResult.months,
    acceleratedMonths: acceleratedResult.months,
    monthsSaved,
    baseInterestPaid: baseResult.interestPaid,
    acceleratedInterestPaid: acceleratedResult.interestPaid,
    interestSaved,
    baseTotalPaid: baseResult.totalPaid,
    acceleratedTotalPaid: acceleratedResult.totalPaid
  }, null]
}

/**
 * Builds a sorted and filtered collection from records using global and local criteria.
 * Returns an error when filter or sorting criteria are malformed.
 * @param {Array<Record<string, unknown>>} recordsCollection
 * @param {{searchText?: string, tagAny?: string[], minAmount?: number, maxAmount?: number, sortBy?: string, sortDirection?: 'asc'|'desc'}} criteria
 * @returns {Result<Array<Record<string, unknown>>>}
 */
export function buildSortedAndFilteredCollectionFromRecordsUsingCriteria(recordsCollection, criteria) {
  if (!Array.isArray(recordsCollection)) {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'recordsCollection must be an array',
      true,
      { recordsCollection }
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const safeCriteria = criteria && typeof criteria === 'object' ? criteria : {}
  const lowercaseSearchText = typeof safeCriteria.searchText === 'string' ? safeCriteria.searchText.toLowerCase().trim() : ''
  const filterTags = Array.isArray(safeCriteria.tagAny) ? safeCriteria.tagAny : []
  const minimumAmount = typeof safeCriteria.minAmount === 'number' ? safeCriteria.minAmount : Number.NEGATIVE_INFINITY
  const maximumAmount = typeof safeCriteria.maxAmount === 'number' ? safeCriteria.maxAmount : Number.POSITIVE_INFINITY
  const sortByFieldName = typeof safeCriteria.sortBy === 'string' ? safeCriteria.sortBy : 'updatedAt'
  const sortDirection = safeCriteria.sortDirection === 'asc' ? 'asc' : 'desc'

  const filteredRecords = recordsCollection.filter((recordItem) => {
    const searchableSourceText = JSON.stringify(recordItem).toLowerCase()
    const hasSearchMatch = lowercaseSearchText === '' || searchableSourceText.includes(lowercaseSearchText)

    const recordAmount = typeof recordItem.amount === 'number' ? recordItem.amount : 0
    const isAmountMatch = recordAmount >= minimumAmount && recordAmount <= maximumAmount

    const recordTags = Array.isArray(recordItem.tags) ? recordItem.tags : []
    const hasTagMatch = filterTags.length === 0 || filterTags.some((tagValue) => recordTags.includes(tagValue))

    return hasSearchMatch && isAmountMatch && hasTagMatch
  })

  const sortedRecords = [...filteredRecords].sort((leftRecord, rightRecord) => {
    const leftValue = leftRecord[sortByFieldName]
    const rightValue = rightRecord[sortByFieldName]

    if (leftValue === rightValue) return 0
    if (leftValue === undefined || leftValue === null) return 1
    if (rightValue === undefined || rightValue === null) return -1

    if (sortDirection === 'asc') {
      return leftValue > rightValue ? 1 : -1
    }

    return leftValue < rightValue ? 1 : -1
  })

  return [sortedRecords, null]
}

/**
 * Calculates a comprehensive dashboard metric object with 20 health indicators.
 * Returns an error when required financial collections are missing or malformed.
 * @param {{income: Array<Record<string, unknown>>, expenses: Array<Record<string, unknown>>, assets: Array<Record<string, unknown>>, assetHoldings?: Array<Record<string, unknown>>, debts: Array<Record<string, unknown>>, credit: Array<Record<string, unknown>>, loans: Array<Record<string, unknown>>, goals: Array<Record<string, unknown>>}} financialCollections
 * @returns {Result<Record<string, number>>}
 */
export function calculateTwentyDashboardHealthMetricsFromFinancialCollections(financialCollections) {
  const requiredCollectionNames = /** @type {Array<'income'|'expenses'|'assets'|'debts'|'credit'|'loans'|'goals'>} */ (
    ['income', 'expenses', 'assets', 'debts', 'credit', 'loans', 'goals']
  )

  for (const requiredCollectionName of requiredCollectionNames) {
    if (!Array.isArray(financialCollections[requiredCollectionName])) {
      const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
        'VALIDATION',
        `${requiredCollectionName} must be an array`,
        true,
        { requiredCollectionName }
      )
      if (createErrorFailure) return [null, createErrorFailure]
      return [null, errorValue]
    }
  }

  /**
   * Sums numeric values from a collection by field name.
   * @param {Array<Record<string, unknown>>} collectionItems
   * @param {string} amountFieldName
   * @returns {number}
   */
  const sumAmountsFromCollection = (collectionItems, amountFieldName) =>
    collectionItems.reduce((runningTotal, collectionItem) => {
      const amountCandidate = collectionItem[amountFieldName]
      const amountValue = typeof amountCandidate === 'number' ? amountCandidate : 0
      return runningTotal + amountValue
    }, 0)

  const totalIncome = sumAmountsFromCollection(financialCollections.income, 'amount')
  const totalExpenses = sumAmountsFromCollection(financialCollections.expenses, 'amount')
  const totalDirectAssets = sumAmountsFromCollection(financialCollections.assets, 'amount')
  const totalAssetHoldingNetValue = Array.isArray(financialCollections.assetHoldings)
    ? financialCollections.assetHoldings.reduce((runningTotal, assetHoldingItem) => {
      const marketValue = typeof assetHoldingItem.assetMarketValue === 'number' ? assetHoldingItem.assetMarketValue : 0
      const owedValue = typeof assetHoldingItem.assetValueOwed === 'number' ? assetHoldingItem.assetValueOwed : 0
      return runningTotal + (marketValue - owedValue)
    }, 0)
    : 0
  // Critical path: overview net worth should be driven only by explicit asset datasets.
  const totalAssets = totalDirectAssets + totalAssetHoldingNetValue
  const totalDebts = sumAmountsFromCollection(financialCollections.debts, 'amount')
  const totalCreditBalance = sumAmountsFromCollection(financialCollections.credit, 'amount')
  const totalLoanBalance = sumAmountsFromCollection(financialCollections.loans, 'amount')
  const totalLiabilities = totalDebts + totalCreditBalance + totalLoanBalance
  const monthlySurplus = totalIncome - totalExpenses
  const netWorth = totalAssets - totalLiabilities

  // Critical path: guarded denominators prevent NaN/Infinity from leaking into dashboard KPIs.
  const safeIncomeDivisor = totalIncome > 0 ? totalIncome : 1
  const safeExpenseDivisor = totalExpenses > 0 ? totalExpenses : 1
  const safeAssetDivisor = totalAssets > 0 ? totalAssets : 1

  const averageCreditUtilization = financialCollections.credit.length === 0
    ? 0
    : financialCollections.credit.reduce((runningUtilization, creditRecord) => {
      const balance = typeof creditRecord.amount === 'number' ? creditRecord.amount : 0
      const creditLimit = typeof creditRecord.creditLimit === 'number' && creditRecord.creditLimit > 0 ? creditRecord.creditLimit : 1
      return runningUtilization + balance / creditLimit
    }, 0) / financialCollections.credit.length

  const totalGoalTarget = sumAmountsFromCollection(financialCollections.goals, 'targetAmount')
  const totalGoalCurrent = sumAmountsFromCollection(financialCollections.goals, 'currentAmount')
  const goalProgressScore = totalGoalTarget > 0 ? (totalGoalCurrent / totalGoalTarget) * 100 : 0

  const healthMetrics = {
    netWorth,
    netWorthChangeMonthToDate: monthlySurplus,
    totalAssets,
    totalLiabilities,
    debtToAssetRatio: totalLiabilities / safeAssetDivisor,
    debtToIncomeRatio: totalLiabilities / safeIncomeDivisor,
    savingsRatePercent: (monthlySurplus / safeIncomeDivisor) * 100,
    expenseRatioPercent: (totalExpenses / safeIncomeDivisor) * 100,
    needsVersusWantsSplitPercent: 50,
    cashRunwayMonths: totalAssets / safeExpenseDivisor,
    emergencyFundCoverageMonths: totalAssets / safeExpenseDivisor,
    monthlySurplusDeficit: monthlySurplus,
    burnRate: totalExpenses,
    incomeStabilityVariance: 0,
    creditUtilizationPercent: averageCreditUtilization * 100,
    averageAprDebtWeighted: 0,
    minimumPaymentBurdenPercentOfIncome: 0,
    loanPayoffEtaMonthsWeighted: 0,
    onTimePaymentStreakMonths: 0,
    goalProgressScorePercent: goalProgressScore
  }

  return [healthMetrics, null]
}

/**
 * Builds the default deterministic application state for core budgeting collections.
 * Returns a tuple error when static initialization unexpectedly fails.
 * @returns {Result<{income: Array<Record<string, unknown>>, expenses: Array<Record<string, unknown>>, assets: Array<Record<string, unknown>>, debts: Array<Record<string, unknown>>, credit: Array<Record<string, unknown>>, loans: Array<Record<string, unknown>>, goals: Array<Record<string, unknown>>, notes: Array<Record<string, unknown>>, schemaVersion: number}>}
 */
export function buildDefaultBudgetCollectionsStateForLocalFirstUsage() {
  return [
    {
      income: [],
      expenses: [],
      assets: [],
      assetHoldings: [],
      debts: [],
      credit: [],
      creditCards: [],
      loans: [],
      goals: [],
      notes: [],
      schemaVersion: 2
    },
    null
  ]
}

/**
 * Validates required text/date fields for income and expense records.
 * Returns an error when required values are missing or malformed.
 * @param {'income'|'expense'|'savings'} recordType
 * @param {Record<string, unknown>} rawRecord
 * @returns {Result<Record<string, unknown>>}
 */
export function validateRequiredIncomeExpenseRecordFieldsBeforePersistence(recordType, rawRecord) {
  const normalizedCategory = typeof rawRecord.category === 'string' ? rawRecord.category.trim() : ''
  if (normalizedCategory.length === 0) {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      `${recordType} category is required`,
      true,
      { recordType }
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const normalizedDate = typeof rawRecord.date === 'string' ? rawRecord.date.trim() : ''
  if (normalizedDate.length === 0) {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      `${recordType} date is required`,
      true,
      { recordType }
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const [normalizedRecord, normalizeError] = validateAndNormalizeBudgetRecordForStrictEditableStorage(recordType, rawRecord)
  if (normalizeError) return [null, normalizeError]
  if (!normalizedRecord) {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      `${recordType} normalization returned empty result unexpectedly`,
      true,
      { recordType }
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const normalizedDescription = typeof rawRecord.description === 'string' ? rawRecord.description.trim() : ''

  return [
    {
      ...normalizedRecord,
      category: normalizedCategory,
      date: normalizedDate,
      description: normalizedDescription
    },
    null
  ]
}

/**
 * Appends a validated income or expense record into immutable budgeting collections state.
 * Returns an error when existing state shape or record data is invalid.
 * @param {{income: Array<Record<string, unknown>>, expenses: Array<Record<string, unknown>>, assets: Array<Record<string, unknown>>, debts: Array<Record<string, unknown>>, credit: Array<Record<string, unknown>>, loans: Array<Record<string, unknown>>, goals: Array<Record<string, unknown>>, notes: Array<Record<string, unknown>>, schemaVersion: number}} currentCollectionsState
 * @param {'income'|'expense'|'savings'} recordType
 * @param {Record<string, unknown>} rawRecord
 * @param {string} isoTimestamp
 * @returns {Result<{income: Array<Record<string, unknown>>, expenses: Array<Record<string, unknown>>, assets: Array<Record<string, unknown>>, debts: Array<Record<string, unknown>>, credit: Array<Record<string, unknown>>, loans: Array<Record<string, unknown>>, goals: Array<Record<string, unknown>>, notes: Array<Record<string, unknown>>, schemaVersion: number}>}
 */
export function appendValidatedIncomeOrExpenseRecordIntoCollectionsState(
  currentCollectionsState,
  recordType,
  rawRecord,
  isoTimestamp
) {
  if (!currentCollectionsState || typeof currentCollectionsState !== 'object') {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'currentCollectionsState must be an object',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const targetCollectionName = recordType === 'income'
    ? 'income'
    : (recordType === 'savings' ? 'assets' : 'expenses')
  if (!Array.isArray(currentCollectionsState[targetCollectionName])) {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      `${targetCollectionName} collection must be an array`,
      true,
      { targetCollectionName }
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const [validatedRecord, validationError] = validateRequiredIncomeExpenseRecordFieldsBeforePersistence(recordType, rawRecord)
  if (validationError) return [null, validationError]
  if (!validatedRecord) {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'validated record is unexpectedly empty',
      true,
      { recordType }
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const nextRecord = {
    ...validatedRecord,
    recordType,
    // Critical path: preserve externally supplied IDs, otherwise generate stable write-time IDs.
    id: typeof validatedRecord.id === 'string' && validatedRecord.id.trim().length > 0
      ? validatedRecord.id
      : `${recordType}-${isoTimestamp}-${currentCollectionsState[targetCollectionName].length + 1}`,
    updatedAt: isoTimestamp
  }

  const nextState = {
    ...currentCollectionsState,
    [targetCollectionName]: [
      ...currentCollectionsState[targetCollectionName],
      nextRecord
    ]
  }

  return [nextState, null]
}

/**
 * Upserts recurring seeded expense rows into existing collections without duplicates.
 * Duplicate identity uses person+item+category+amount+description (case-insensitive for text).
 * @param {{income: Array<Record<string, unknown>>, expenses: Array<Record<string, unknown>>, assets: Array<Record<string, unknown>>, debts: Array<Record<string, unknown>>, credit: Array<Record<string, unknown>>, loans: Array<Record<string, unknown>>, goals: Array<Record<string, unknown>>, notes: Array<Record<string, unknown>>, schemaVersion: number}} currentCollectionsState
 * @returns {Result<{nextCollectionsState: {income: Array<Record<string, unknown>>, expenses: Array<Record<string, unknown>>, assets: Array<Record<string, unknown>>, debts: Array<Record<string, unknown>>, credit: Array<Record<string, unknown>>, loans: Array<Record<string, unknown>>, goals: Array<Record<string, unknown>>, notes: Array<Record<string, unknown>>, schemaVersion: number}, addedCount: number}>}
 */
export function upsertRecurringSeededExpenseRowsIntoCollectionsState(currentCollectionsState) {
  if (!currentCollectionsState || typeof currentCollectionsState !== 'object') {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'currentCollectionsState must be an object',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  if (!Array.isArray(currentCollectionsState.expenses)) {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'expenses collection must be an array',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const [defaultState, defaultStateError] = buildDefaultBudgetCollectionsStateForLocalFirstUsage()
  if (defaultStateError) return [null, defaultStateError]
  if (!defaultState) {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'default state is unexpectedly empty',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  /**
   * @param {Record<string, unknown>} rowItem
   * @returns {string}
   */
  const buildExpenseFingerprint = (rowItem) => {
    const person = typeof rowItem.person === 'string' ? rowItem.person.trim().toLowerCase() : ''
    const item = typeof rowItem.item === 'string' ? rowItem.item.trim().toLowerCase() : ''
    const category = typeof rowItem.category === 'string' ? rowItem.category.trim().toLowerCase() : ''
    const description = typeof rowItem.description === 'string' ? rowItem.description.trim().toLowerCase() : ''
    const amount = typeof rowItem.amount === 'number' ? rowItem.amount : 0
    return `${person}|${item}|${category}|${amount}|${description}`
  }

  const existingFingerprints = new Set(currentCollectionsState.expenses.map(buildExpenseFingerprint))
  const rowsToAdd = defaultState.expenses.filter((rowItem) => !existingFingerprints.has(buildExpenseFingerprint(rowItem)))

  // Critical path: remove legacy synthetic debt-payment expense rows to avoid debt minimum duplication.
  const cleanedExistingExpenses = currentCollectionsState.expenses.filter((rowItem) => {
    const item = typeof rowItem.item === 'string' ? rowItem.item.trim().toLowerCase() : ''
    const category = typeof rowItem.category === 'string' ? rowItem.category.trim().toLowerCase() : ''
    const description = typeof rowItem.description === 'string' ? rowItem.description.trim().toLowerCase() : ''
    return !(item === 'debts' && category === 'debt payment' && description === 'total debt payments')
  })

  const nextCollectionsState = rowsToAdd.length === 0
    ? { ...currentCollectionsState, expenses: cleanedExistingExpenses }
    : { ...currentCollectionsState, expenses: [...cleanedExistingExpenses, ...rowsToAdd] }

  return [{ nextCollectionsState, addedCount: rowsToAdd.length }, null]
}

/**
 * Validates required goal fields before persistence.
 * Returns an error when required values are missing or malformed.
 * @param {Record<string, unknown>} rawGoalRecord
 * @returns {Result<Record<string, unknown>>}
 */
export function validateRequiredGoalRecordFieldsBeforePersistence(rawGoalRecord) {
  if (!rawGoalRecord || typeof rawGoalRecord !== 'object') {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'goal payload must be an object',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const normalizedTitle = typeof rawGoalRecord.title === 'string' ? rawGoalRecord.title.trim() : ''
  if (normalizedTitle.length === 0) {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'goal title is required',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const timeframeMonths = typeof rawGoalRecord.timeframeMonths === 'number'
    ? rawGoalRecord.timeframeMonths
    : Number(rawGoalRecord.timeframeMonths ?? 0)
  if (!Number.isFinite(timeframeMonths) || timeframeMonths < 0) {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'goal timeframeMonths must be a non-negative number',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const status = typeof rawGoalRecord.status === 'string' ? rawGoalRecord.status.trim().toLowerCase() : ''
  const normalizedStatus = status === 'completed' || status === 'in progress' || status === 'not started'
    ? status
    : 'not started'

  const normalizedDescription = typeof rawGoalRecord.description === 'string' ? rawGoalRecord.description.trim() : ''

  return [
    {
      ...rawGoalRecord,
      title: normalizedTitle,
      status: normalizedStatus,
      timeframeMonths,
      description: normalizedDescription
    },
    null
  ]
}

/**
 * Calculates credit-card dashboard summary formulas from card information rows.
 * Returns an error when collection shape is invalid.
 * @param {Array<Record<string, unknown>>} creditCardInformationCollection
 * @returns {Result<{totalCurrent: number, totalMonthly: number, totalUtilizationPercent: number, remainingCapacity: number, maxCapacity: number}>}
 */
export function calculateCreditCardSummaryFormulasFromInformationCollection(creditCardInformationCollection) {
  if (!Array.isArray(creditCardInformationCollection)) {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'creditCardInformationCollection must be an array',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const totals = creditCardInformationCollection.reduce((runningTotals, creditCardRecord) => {
    const maxCapacity = typeof creditCardRecord.maxCapacity === 'number' ? creditCardRecord.maxCapacity : 0
    const currentBalance = typeof creditCardRecord.currentBalance === 'number' ? creditCardRecord.currentBalance : 0
    const monthlyPayment = typeof creditCardRecord.monthlyPayment === 'number' ? creditCardRecord.monthlyPayment : 0
    return {
      maxCapacity: runningTotals.maxCapacity + maxCapacity,
      totalCurrent: runningTotals.totalCurrent + currentBalance,
      totalMonthly: runningTotals.totalMonthly + monthlyPayment
    }
  }, { maxCapacity: 0, totalCurrent: 0, totalMonthly: 0 })

  // Critical path: utilization must stay defined even when no capacity exists yet.
  const totalUtilizationPercent = totals.maxCapacity > 0 ? (totals.totalCurrent / totals.maxCapacity) * 100 : 0
  const remainingCapacity = totals.maxCapacity - totals.totalCurrent

  return [
    {
      totalCurrent: totals.totalCurrent,
      totalMonthly: totals.totalMonthly,
      totalUtilizationPercent,
      remainingCapacity,
      maxCapacity: totals.maxCapacity
    },
    null
  ]
}

/**
 * Builds credit-card payment recommendations using weighted avalanche signals.
 * Returns an error when collections are malformed.
 * @param {{income: Array<Record<string, unknown>>, expenses: Array<Record<string, unknown>>, debts: Array<Record<string, unknown>>, loans: Array<Record<string, unknown>>}} currentCollectionsState
 * @param {Array<Record<string, unknown>>} creditCardInformationCollection
 * @returns {Result<{strategy: string, recommendedTotalMonthlyPayment: number, currentTotalMonthlyPayment: number, weightedPayoffMonthsCurrent: number, weightedPayoffMonthsRecommended: number, rows: Array<{id: string, person: string, item: string, currentBalance: number, minimumPayment: number, currentMonthlyPayment: number, interestRatePercent: number, utilizationPercent: number, recommendedMonthlyPayment: number, estimatedMonthsCurrent: number, estimatedMonthsRecommended: number, recommendationReason: string}>}>}
 */
export function calculateCreditCardPaymentRecommendationsFromCollectionsState(currentCollectionsState, creditCardInformationCollection) {
  if (!currentCollectionsState || typeof currentCollectionsState !== 'object') {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'currentCollectionsState must be an object',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  if (!Array.isArray(creditCardInformationCollection)) {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'creditCardInformationCollection must be an array',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const [monthlySummary, monthlySummaryError] = calculateMonthlyIncomeExpenseSummaryFromCollectionsState(currentCollectionsState)
  if (monthlySummaryError) return [null, monthlySummaryError]
  if (!monthlySummary) {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'monthly summary is unexpectedly empty',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const requiredDebtMinimums = (Array.isArray(currentCollectionsState.debts) ? currentCollectionsState.debts : []).reduce((runningTotal, debtItem) => (
    runningTotal + (typeof debtItem.minimumPayment === 'number' ? debtItem.minimumPayment : 0)
  ), 0) + (Array.isArray(currentCollectionsState.loans) ? currentCollectionsState.loans : []).reduce((runningTotal, loanItem) => (
    runningTotal + (typeof loanItem.minimumPayment === 'number' ? loanItem.minimumPayment : 0)
  ), 0)

  const totalCurrentCardPayment = creditCardInformationCollection.reduce((runningTotal, creditCardItem) => {
    const monthlyPayment = typeof creditCardItem.monthlyPayment === 'number' ? creditCardItem.monthlyPayment : 0
    const minimumPayment = typeof creditCardItem.minimumPayment === 'number' ? creditCardItem.minimumPayment : 0
    return runningTotal + Math.max(monthlyPayment, minimumPayment)
  }, 0)

  const availableCashAfterNonCardDebt = monthlySummary.totalIncome - monthlySummary.totalExpenses - requiredDebtMinimums
  const extraCardAccelerationBudget = Math.max(0, availableCashAfterNonCardDebt * 0.35)

  const scoredRows = creditCardInformationCollection.map((creditCardItem, cardIndex) => {
    const id = typeof creditCardItem.id === 'string' ? creditCardItem.id : `credit-card-reco-${cardIndex + 1}`
    const person = typeof creditCardItem.person === 'string' ? creditCardItem.person : 'Unknown'
    const item = typeof creditCardItem.item === 'string' ? creditCardItem.item : `Card ${cardIndex + 1}`
    const currentBalance = typeof creditCardItem.currentBalance === 'number' ? creditCardItem.currentBalance : 0
    const maxCapacity = typeof creditCardItem.maxCapacity === 'number' ? creditCardItem.maxCapacity : 0
    const minimumPayment = typeof creditCardItem.minimumPayment === 'number' ? creditCardItem.minimumPayment : 0
    const currentMonthlyPayment = typeof creditCardItem.monthlyPayment === 'number' ? creditCardItem.monthlyPayment : minimumPayment
    const interestRatePercent = typeof creditCardItem.interestRatePercent === 'number' ? creditCardItem.interestRatePercent : 0
    const utilizationPercent = maxCapacity > 0 ? (currentBalance / maxCapacity) * 100 : 0
    const aprScore = Math.min(1, interestRatePercent / 35)
    const utilizationScore = Math.min(1, utilizationPercent / 100)
    const balanceScore = Math.min(1, currentBalance / 15000)
    const weightedPriorityScore = (aprScore * 0.55) + (utilizationScore * 0.3) + (balanceScore * 0.15)
    return {
      id,
      person,
      item,
      currentBalance,
      minimumPayment,
      currentMonthlyPayment,
      interestRatePercent,
      utilizationPercent,
      weightedPriorityScore
    }
  })

  const totalPriorityScore = scoredRows.reduce((runningTotal, rowItem) => runningTotal + rowItem.weightedPriorityScore, 0)
  const normalizedPriorityDivisor = totalPriorityScore > 0 ? totalPriorityScore : 1
  const totalCardMinimumPayments = scoredRows.reduce((runningTotal, rowItem) => runningTotal + rowItem.minimumPayment, 0)
  // Critical path: recommendations should never undercut current payment posture.
  const baselineCardPaymentPool = Math.max(totalCurrentCardPayment, totalCardMinimumPayments)
  const allocatableCardPoolAboveMinimums = Math.max(0, (baselineCardPaymentPool + extraCardAccelerationBudget) - totalCardMinimumPayments)
  const equalShareCount = scoredRows.length > 0 ? scoredRows.length : 1

  const recommendationRows = []
  for (const rowItem of scoredRows) {
    const extraPaymentShare = totalPriorityScore > 0
      ? (rowItem.weightedPriorityScore / normalizedPriorityDivisor)
      : (1 / equalShareCount)
    const recommendedMonthlyPayment = rowItem.minimumPayment + (allocatableCardPoolAboveMinimums * extraPaymentShare)
    const [estimatedMonthsCurrent, estimatedMonthsCurrentError] = calculateEstimatedPayoffMonthsFromBalancePaymentAndInterestRate(
      rowItem.currentBalance,
      Math.max(rowItem.currentMonthlyPayment, rowItem.minimumPayment),
      rowItem.interestRatePercent
    )
    if (estimatedMonthsCurrentError) return [null, estimatedMonthsCurrentError]
    const [estimatedMonthsRecommended, estimatedMonthsRecommendedError] = calculateEstimatedPayoffMonthsFromBalancePaymentAndInterestRate(
      rowItem.currentBalance,
      Math.max(recommendedMonthlyPayment, rowItem.minimumPayment),
      rowItem.interestRatePercent
    )
    if (estimatedMonthsRecommendedError) return [null, estimatedMonthsRecommendedError]

    const recommendationReason = rowItem.interestRatePercent >= 20
      ? 'High APR priority in avalanche model.'
      : (rowItem.utilizationPercent >= 50 ? 'High utilization gets extra allocation.' : 'Balanced allocation based on score.')

    recommendationRows.push({
      id: rowItem.id,
      person: rowItem.person,
      item: rowItem.item,
      currentBalance: rowItem.currentBalance,
      minimumPayment: rowItem.minimumPayment,
      currentMonthlyPayment: Math.max(rowItem.currentMonthlyPayment, rowItem.minimumPayment),
      interestRatePercent: rowItem.interestRatePercent,
      utilizationPercent: rowItem.utilizationPercent,
      recommendedMonthlyPayment,
      estimatedMonthsCurrent: estimatedMonthsCurrent ?? 0,
      estimatedMonthsRecommended: estimatedMonthsRecommended ?? 0,
      recommendationReason
    })
  }

  const weightedPayoffMonthsCurrent = recommendationRows.reduce((runningTotal, rowItem) => runningTotal + (rowItem.estimatedMonthsCurrent * rowItem.currentBalance), 0) /
    Math.max(recommendationRows.reduce((runningTotal, rowItem) => runningTotal + rowItem.currentBalance, 0), 1)
  const weightedPayoffMonthsRecommended = recommendationRows.reduce((runningTotal, rowItem) => runningTotal + (rowItem.estimatedMonthsRecommended * rowItem.currentBalance), 0) /
    Math.max(recommendationRows.reduce((runningTotal, rowItem) => runningTotal + rowItem.currentBalance, 0), 1)

  return [
    {
      strategy: 'Weighted debt avalanche (APR + utilization + balance)',
      recommendedTotalMonthlyPayment: recommendationRows.reduce((runningTotal, rowItem) => runningTotal + rowItem.recommendedMonthlyPayment, 0),
      currentTotalMonthlyPayment: totalCurrentCardPayment,
      weightedPayoffMonthsCurrent,
      weightedPayoffMonthsRecommended,
      rows: recommendationRows.sort((leftRow, rightRow) => rightRow.interestRatePercent - leftRow.interestRatePercent)
    },
    null
  ]
}

/**
 * Appends a validated goal record into immutable budgeting collections state.
 * Returns an error when existing state shape or record data is invalid.
 * @param {{goals: Array<Record<string, unknown>>} & Record<string, unknown>} currentCollectionsState
 * @param {Record<string, unknown>} rawGoalRecord
 * @param {string} isoTimestamp
 * @returns {Result<Record<string, unknown>>}
 */
export function appendValidatedGoalRecordIntoCollectionsState(currentCollectionsState, rawGoalRecord, isoTimestamp) {
  if (!currentCollectionsState || typeof currentCollectionsState !== 'object') {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'currentCollectionsState must be an object',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  if (!Array.isArray(currentCollectionsState.goals)) {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'goals collection must be an array',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const [validatedGoalRecord, validationError] = validateRequiredGoalRecordFieldsBeforePersistence(rawGoalRecord)
  if (validationError) return [null, validationError]
  if (!validatedGoalRecord) {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'validated goal record is unexpectedly empty',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const nextGoalRecord = {
    ...validatedGoalRecord,
    // Critical path: ID generation strategy must mirror other append flows to avoid collision classes.
    id: typeof validatedGoalRecord.id === 'string' && validatedGoalRecord.id.trim().length > 0
      ? validatedGoalRecord.id
      : `goal-${isoTimestamp}-${currentCollectionsState.goals.length + 1}`,
    updatedAt: isoTimestamp
  }

  return [
    {
      ...currentCollectionsState,
      goals: [...currentCollectionsState.goals, nextGoalRecord]
    },
    null
  ]
}

/**
 * Updates an existing record by id inside a target collection and returns next immutable state.
 * Returns an error when state shape, collection name, or patch payload is invalid.
 * @param {Record<string, unknown>} currentCollectionsState
 * @param {'income'|'expenses'|'assets'|'assetHoldings'|'debts'|'credit'|'loans'|'creditCards'} collectionName
 * @param {string} recordId
 * @param {Record<string, unknown>} recordPatch
 * @param {string} isoTimestamp
 * @returns {Result<Record<string, unknown>>}
 */
export function updateExistingRecordInCollectionsStateByCollectionNameAndId(
  currentCollectionsState,
  collectionName,
  recordId,
  recordPatch,
  isoTimestamp
) {
  if (!currentCollectionsState || typeof currentCollectionsState !== 'object') {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'currentCollectionsState must be an object',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const supportedCollectionNames = ['income', 'expenses', 'assets', 'assetHoldings', 'debts', 'credit', 'loans', 'creditCards']
  if (!supportedCollectionNames.includes(collectionName)) {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'collectionName is not supported for editing',
      true,
      { collectionName }
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const targetCollection = currentCollectionsState[collectionName]
  if (!Array.isArray(targetCollection)) {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      `${collectionName} collection must be an array`,
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const targetIndex = targetCollection.findIndex((rowItem) => rowItem && typeof rowItem.id === 'string' && rowItem.id === recordId)
  if (targetIndex < 0) {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'record id was not found in target collection',
      true,
      { collectionName, recordId }
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const existingRecord = targetCollection[targetIndex]
  const candidateRecord = {
    ...existingRecord,
    ...recordPatch,
    id: existingRecord.id,
    updatedAt: isoTimestamp
  }

  if (collectionName === 'income' || collectionName === 'expenses' || collectionName === 'assets') {
    const recordType = collectionName === 'income' ? 'income' : (collectionName === 'assets' ? 'savings' : 'expense')
    const [validatedRecord, validationError] = validateRequiredIncomeExpenseRecordFieldsBeforePersistence(recordType, candidateRecord)
    if (validationError) return [null, validationError]
    if (!validatedRecord) {
      const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
        'VALIDATION',
        'validated record is unexpectedly empty',
        true
      )
      if (createErrorFailure) return [null, createErrorFailure]
      return [null, errorValue]
    }
    candidateRecord.amount = validatedRecord.amount
    candidateRecord.category = validatedRecord.category
    candidateRecord.date = validatedRecord.date
    candidateRecord.description = validatedRecord.description
  }

  if (collectionName === 'debts' || collectionName === 'credit' || collectionName === 'loans') {
    const recordType = collectionName === 'debts' ? 'debt' : (collectionName === 'credit' ? 'credit' : 'loan')
    const [normalizedRecord, normalizeError] = validateAndNormalizeBudgetRecordForStrictEditableStorage(recordType, candidateRecord)
    if (normalizeError) return [null, normalizeError]
    if (!normalizedRecord) {
      const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
        'VALIDATION',
        'normalized record is unexpectedly empty',
        true
      )
      if (createErrorFailure) return [null, createErrorFailure]
      return [null, errorValue]
    }
    candidateRecord.amount = normalizedRecord.amount
    candidateRecord.interestRatePercent = normalizedRecord.interestRatePercent
    candidateRecord.remainingPayments = normalizedRecord.remainingPayments
    candidateRecord.loanStartDate = normalizedRecord.loanStartDate
    candidateRecord.collateralAssetName = normalizedRecord.collateralAssetName
    candidateRecord.collateralAssetMarketValue = normalizedRecord.collateralAssetMarketValue
    if (recordType === 'credit') candidateRecord.creditLimit = normalizedRecord.creditLimit
  }

  if (collectionName === 'creditCards') {
    const numericFieldNames = ['maxCapacity', 'currentBalance', 'minimumPayment', 'monthlyPayment', 'interestRatePercent']
    for (const numericFieldName of numericFieldNames) {
      const [validatedValue, validationError] = validateMonetaryValueIsFiniteAndNonNegative(
        Number(candidateRecord[numericFieldName] ?? 0),
        numericFieldName
      )
      if (validationError) return [null, validationError]
      candidateRecord[numericFieldName] = validatedValue
    }
  }
  if (collectionName === 'assetHoldings') {
    const numericFieldNames = ['assetValueOwed', 'assetMarketValue']
    for (const numericFieldName of numericFieldNames) {
      const [validatedValue, validationError] = validateMonetaryValueIsFiniteAndNonNegative(
        Number(candidateRecord[numericFieldName] ?? 0),
        numericFieldName
      )
      if (validationError) return [null, validationError]
      candidateRecord[numericFieldName] = validatedValue
    }
    candidateRecord.person = typeof candidateRecord.person === 'string' ? candidateRecord.person : ''
    candidateRecord.item = typeof candidateRecord.item === 'string' ? candidateRecord.item : ''
    candidateRecord.description = typeof candidateRecord.description === 'string' ? candidateRecord.description : ''
    candidateRecord.date = typeof candidateRecord.date === 'string' ? candidateRecord.date : ''
  }

  const nextCollection = targetCollection.map((rowItem, rowIndex) => (rowIndex === targetIndex ? candidateRecord : rowItem))
  return [
    {
      ...currentCollectionsState,
      [collectionName]: nextCollection
    },
    null
  ]
}

/**
 * Merges imported collections into current collections with dedupe protections.
 * Prefers imported records when dedupe key collisions occur.
 * @param {Record<string, unknown>} currentCollectionsState
 * @param {Record<string, unknown>} importedCollectionsState
 * @returns {Result<Record<string, unknown>>}
 */
export function mergeImportedCollectionsStateWithExistingStateUsingDedupKeys(currentCollectionsState, importedCollectionsState) {
  if (!currentCollectionsState || typeof currentCollectionsState !== 'object' || Array.isArray(currentCollectionsState)) {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'currentCollectionsState must be an object',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  if (!importedCollectionsState || typeof importedCollectionsState !== 'object' || Array.isArray(importedCollectionsState)) {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'importedCollectionsState must be an object',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const collectionNamesToMerge = ['income', 'expenses', 'assets', 'assetHoldings', 'debts', 'credit', 'loans', 'creditCards', 'goals', 'personas', 'notes']

  /**
   * @param {Record<string, unknown>} rowItem
   * @returns {string}
   */
  function buildStableImportDedupeKeyFromRow(rowItem) {
    const idValue = typeof rowItem.id === 'string' ? rowItem.id.trim() : ''
    if (idValue.length > 0) return `id:${idValue}`
    const signatureFields = [
      rowItem.person,
      rowItem.item,
      rowItem.category,
      rowItem.recordType,
      rowItem.amount,
      rowItem.minimumPayment,
      rowItem.monthlyPayment,
      rowItem.creditLimit,
      rowItem.maxCapacity,
      rowItem.currentBalance,
      rowItem.assetValueOwed,
      rowItem.assetMarketValue,
      rowItem.date,
      rowItem.description
    ]
    return `sig:${signatureFields.map((fieldValue) => String(fieldValue ?? '').trim().toLowerCase()).join('|')}`
  }

  const nextCollectionsState = { ...currentCollectionsState, ...importedCollectionsState }
  for (const collectionName of collectionNamesToMerge) {
    const currentRows = Array.isArray(currentCollectionsState[collectionName]) ? currentCollectionsState[collectionName] : []
    const importedRows = Array.isArray(importedCollectionsState[collectionName]) ? importedCollectionsState[collectionName] : []
    const rowMap = new Map()
    for (const rowItem of currentRows) {
      if (!rowItem || typeof rowItem !== 'object' || Array.isArray(rowItem)) continue
      rowMap.set(buildStableImportDedupeKeyFromRow(rowItem), rowItem)
    }
    // Critical path: imported rows should win conflicts so imported profile can correct stale local values.
    for (const rowItem of importedRows) {
      if (!rowItem || typeof rowItem !== 'object' || Array.isArray(rowItem)) continue
      rowMap.set(buildStableImportDedupeKeyFromRow(rowItem), rowItem)
    }
    nextCollectionsState[collectionName] = [...rowMap.values()]
  }
  return [nextCollectionsState, null]
}

/**
 * Merges audit timeline entries and removes duplicates by id/timestamp/context.
 * @param {Array<Record<string, unknown>>} currentAuditTimelineEntries
 * @param {Array<Record<string, unknown>>} importedAuditTimelineEntries
 * @returns {Result<Array<Record<string, unknown>>>}
 */
export function mergeAuditTimelineEntriesUsingDedupKeys(currentAuditTimelineEntries, importedAuditTimelineEntries) {
  if (!Array.isArray(currentAuditTimelineEntries) || !Array.isArray(importedAuditTimelineEntries)) {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'audit timeline inputs must be arrays',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const timelineMap = new Map()
  /**
   * @param {Record<string, unknown>} rowItem
   * @returns {string}
   */
  function buildAuditDedupeKeyFromRow(rowItem) {
    const idValue = typeof rowItem.id === 'string' ? rowItem.id.trim() : ''
    if (idValue.length > 0) return `id:${idValue}`
    const timestamp = typeof rowItem.timestamp === 'string' ? rowItem.timestamp : ''
    const contextTag = typeof rowItem.contextTag === 'string' ? rowItem.contextTag : ''
    return `sig:${timestamp}|${contextTag}`
  }
  for (const rowItem of [...currentAuditTimelineEntries, ...importedAuditTimelineEntries]) {
    if (!rowItem || typeof rowItem !== 'object' || Array.isArray(rowItem)) continue
    timelineMap.set(buildAuditDedupeKeyFromRow(rowItem), rowItem)
  }
  const mergedRows = [...timelineMap.values()].sort((leftRow, rightRow) => {
    const leftTimestamp = typeof leftRow.timestamp === 'string' ? leftRow.timestamp : ''
    const rightTimestamp = typeof rightRow.timestamp === 'string' ? rightRow.timestamp : ''
    return rightTimestamp.localeCompare(leftTimestamp)
  })
  return [mergedRows.slice(0, 240), null]
}

/**
 * Builds a per-collection impact summary for a persona name.
 * Returns an error when collections state is malformed.
 * @param {Record<string, unknown>} currentCollectionsState
 * @param {string} personaName
 * @returns {Result<{income: number, expenses: number, assets: number, debts: number, credit: number, loans: number, creditCards: number, total: number}>}
 */
export function buildPersonaImpactSummaryFromCollectionsStateByPersonaName(currentCollectionsState, personaName) {
  if (!currentCollectionsState || typeof currentCollectionsState !== 'object') {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'currentCollectionsState must be an object',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const normalizedPersonaName = typeof personaName === 'string' ? personaName.trim().toLowerCase() : ''
  if (!normalizedPersonaName) {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'personaName must be a non-empty string',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const collectionNames = ['income', 'expenses', 'assets', 'debts', 'credit', 'loans', 'creditCards']
  /** @type {{income: number, expenses: number, assets: number, debts: number, credit: number, loans: number, creditCards: number, total: number}} */
  const summary = { income: 0, expenses: 0, assets: 0, debts: 0, credit: 0, loans: 0, creditCards: 0, total: 0 }

  for (const collectionName of collectionNames) {
    const rows = Array.isArray(currentCollectionsState[collectionName]) ? currentCollectionsState[collectionName] : []
    const count = rows.reduce((runningTotal, rowItem) => {
      const person = typeof rowItem.person === 'string' ? rowItem.person.trim().toLowerCase() : ''
      return runningTotal + (person === normalizedPersonaName ? 1 : 0)
    }, 0)
    summary[collectionName] = count
    summary.total += count
  }

  return [summary, null]
}

/**
 * Renames a persona everywhere across collections and persona list.
 * Returns an error when state is malformed or names are invalid.
 * @param {Record<string, unknown>} currentCollectionsState
 * @param {string} sourcePersonaName
 * @param {string} targetPersonaName
 * @param {{emoji?: string, note?: string, updatedAt?: string}} [personaPatch]
 * @returns {Result<Record<string, unknown>>}
 */
export function renamePersonaAcrossCollectionsStateByName(currentCollectionsState, sourcePersonaName, targetPersonaName, personaPatch = {}) {
  if (!currentCollectionsState || typeof currentCollectionsState !== 'object') {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'currentCollectionsState must be an object',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const normalizedSourceName = typeof sourcePersonaName === 'string' ? sourcePersonaName.trim() : ''
  const normalizedTargetName = typeof targetPersonaName === 'string' ? targetPersonaName.trim() : ''
  if (!normalizedSourceName || !normalizedTargetName) {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'sourcePersonaName and targetPersonaName must be non-empty strings',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const sourceLower = normalizedSourceName.toLowerCase()

  const collectionNames = ['income', 'expenses', 'assets', 'debts', 'credit', 'loans', 'creditCards']
  /** @type {Record<string, unknown>} */
  const nextState = { ...currentCollectionsState }
  for (const collectionName of collectionNames) {
    const rows = Array.isArray(currentCollectionsState[collectionName]) ? currentCollectionsState[collectionName] : []
    nextState[collectionName] = rows.map((rowItem) => {
      const person = typeof rowItem.person === 'string' ? rowItem.person.trim().toLowerCase() : ''
      if (person !== sourceLower) return rowItem
      return { ...rowItem, person: normalizedTargetName }
    })
  }

  const personas = Array.isArray(currentCollectionsState.personas) ? currentCollectionsState.personas : []
  nextState.personas = personas.map((personaItem) => {
    if (!personaItem || typeof personaItem !== 'object') return personaItem
    const name = typeof personaItem.name === 'string' ? personaItem.name.trim().toLowerCase() : ''
    if (name !== sourceLower) return personaItem
    return {
      ...personaItem,
      name: normalizedTargetName,
      note: typeof personaPatch.note === 'string' ? personaPatch.note : (typeof personaItem.note === 'string' ? personaItem.note : ''),
      emoji: typeof personaPatch.emoji === 'string' ? personaPatch.emoji : (typeof personaItem.emoji === 'string' ? personaItem.emoji : ''),
      updatedAt: typeof personaPatch.updatedAt === 'string' ? personaPatch.updatedAt : personaItem.updatedAt
    }
  })

  return [nextState, null]
}

/**
 * Deletes a persona with either reassignment or cascade removal.
 * Returns an error when input is malformed.
 * @param {Record<string, unknown>} currentCollectionsState
 * @param {string} sourcePersonaName
 * @param {'reassign'|'cascade'} deleteMode
 * @param {string} [reassignPersonaName]
 * @returns {Result<Record<string, unknown>>}
 */
export function deletePersonaAcrossCollectionsStateByName(currentCollectionsState, sourcePersonaName, deleteMode, reassignPersonaName = '') {
  if (!currentCollectionsState || typeof currentCollectionsState !== 'object') {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'currentCollectionsState must be an object',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const normalizedSourceName = typeof sourcePersonaName === 'string' ? sourcePersonaName.trim() : ''
  if (!normalizedSourceName) {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'sourcePersonaName must be a non-empty string',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  if (deleteMode !== 'reassign' && deleteMode !== 'cascade') {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'deleteMode must be reassign or cascade',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const sourceLower = normalizedSourceName.toLowerCase()
  const normalizedReassignName = typeof reassignPersonaName === 'string' ? reassignPersonaName.trim() : ''

  const collectionNames = ['income', 'expenses', 'assets', 'debts', 'credit', 'loans', 'creditCards']
  /** @type {Record<string, unknown>} */
  const nextState = { ...currentCollectionsState }
  for (const collectionName of collectionNames) {
    const rows = Array.isArray(currentCollectionsState[collectionName]) ? currentCollectionsState[collectionName] : []
    if (deleteMode === 'cascade') {
      nextState[collectionName] = rows.filter((rowItem) => {
        const person = typeof rowItem.person === 'string' ? rowItem.person.trim().toLowerCase() : ''
        return person !== sourceLower
      })
    } else {
      nextState[collectionName] = rows.map((rowItem) => {
        const person = typeof rowItem.person === 'string' ? rowItem.person.trim().toLowerCase() : ''
        if (person !== sourceLower) return rowItem
        return { ...rowItem, person: normalizedReassignName || 'User' }
      })
    }
  }

  const personas = Array.isArray(currentCollectionsState.personas) ? currentCollectionsState.personas : []
  nextState.personas = personas.filter((personaItem) => {
    if (!personaItem || typeof personaItem !== 'object') return false
    const name = typeof personaItem.name === 'string' ? personaItem.name.trim().toLowerCase() : ''
    return name !== sourceLower
  })

  return [nextState, null]
}

/**
 * Calculates power-goals formulas for dashboard status widgets.
 * Returns an error when goals collection is invalid.
 * @param {Array<Record<string, unknown>>} goalCollection
 * @returns {Result<{completedCount: number, inProgressCount: number, notStartedCount: number, averageTimeframeMonths: number, completionRatePercent: number, shortTermNotStartedCount: number}>}
 */
export function calculatePowerGoalsStatusFormulaSummaryFromGoalCollection(goalCollection) {
  if (!Array.isArray(goalCollection)) {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'goalCollection must be an array',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const aggregated = goalCollection.reduce((runningTotals, goalItem) => {
    const rawStatus = typeof goalItem.status === 'string' ? goalItem.status.trim().toLowerCase() : 'not started'
    const normalizedStatus = rawStatus === 'completed' || rawStatus === 'in progress' || rawStatus === 'not started'
      ? rawStatus
      : 'not started'
    const timeframeMonths = typeof goalItem.timeframeMonths === 'number'
      ? goalItem.timeframeMonths
      : Number(goalItem.timeframeMonths ?? 0)
    const safeTimeframeMonths = Number.isFinite(timeframeMonths) && timeframeMonths >= 0 ? timeframeMonths : 0

    return {
      completedCount: runningTotals.completedCount + (normalizedStatus === 'completed' ? 1 : 0),
      inProgressCount: runningTotals.inProgressCount + (normalizedStatus === 'in progress' ? 1 : 0),
      notStartedCount: runningTotals.notStartedCount + (normalizedStatus === 'not started' ? 1 : 0),
      timeframeMonthsSum: runningTotals.timeframeMonthsSum + safeTimeframeMonths,
      shortTermNotStartedCount: runningTotals.shortTermNotStartedCount + (normalizedStatus === 'not started' && safeTimeframeMonths <= 12 ? 1 : 0)
    }
  }, { completedCount: 0, inProgressCount: 0, notStartedCount: 0, timeframeMonthsSum: 0, shortTermNotStartedCount: 0 })

  const totalGoalCount = goalCollection.length
  const averageTimeframeMonths = totalGoalCount > 0 ? aggregated.timeframeMonthsSum / totalGoalCount : 0
  const completionRatePercent = totalGoalCount > 0 ? (aggregated.completedCount / totalGoalCount) * 100 : 0

  return [
    {
      completedCount: aggregated.completedCount,
      inProgressCount: aggregated.inProgressCount,
      notStartedCount: aggregated.notStartedCount,
      averageTimeframeMonths,
      completionRatePercent,
      shortTermNotStartedCount: aggregated.shortTermNotStartedCount
    },
    null
  ]
}

/**
 * Calculates current-month versus previous-month source totals for dashboard metadata tooltips.
 * Returns an error when required collections are missing.
 * @param {{income: Array<Record<string, unknown>>, expenses: Array<Record<string, unknown>>, assets: Array<Record<string, unknown>>, debts: Array<Record<string, unknown>>, credit: Array<Record<string, unknown>>, loans: Array<Record<string, unknown>>}} currentCollectionsState
 * @param {Date} [referenceDate]
 * @returns {Result<{income: {currentMonth: number, previousMonth: number, delta: number}, expenses: {currentMonth: number, previousMonth: number, delta: number}, assets: {currentMonth: number, previousMonth: number, delta: number}, liabilities: {currentMonth: number, previousMonth: number, delta: number}, netWorth: {currentMonth: number, previousMonth: number, delta: number}}>}
 */
export function calculateCurrentAndPreviousMonthSourceBreakdownFromCollectionsState(currentCollectionsState, referenceDate = new Date()) {
  if (!currentCollectionsState || typeof currentCollectionsState !== 'object') {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'currentCollectionsState must be an object',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const requiredCollectionNames = /** @type {Array<'income'|'expenses'|'assets'|'debts'|'credit'|'loans'>} */ (
    ['income', 'expenses', 'assets', 'debts', 'credit', 'loans']
  )

  for (const requiredCollectionName of requiredCollectionNames) {
    if (!Array.isArray(currentCollectionsState[requiredCollectionName])) {
      const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
        'VALIDATION',
        `${requiredCollectionName} collection must be an array`,
        true,
        { requiredCollectionName }
      )
      if (createErrorFailure) return [null, createErrorFailure]
      return [null, errorValue]
    }
  }

  const referenceYear = referenceDate.getUTCFullYear()
  const referenceMonth = referenceDate.getUTCMonth() + 1
  // Critical path: UTC month boundaries avoid local timezone drift in month-over-month deltas.
  const previousMonthDate = new Date(Date.UTC(referenceYear, referenceMonth - 2, 1))
  const previousYear = previousMonthDate.getUTCFullYear()
  const previousMonth = previousMonthDate.getUTCMonth() + 1

  /**
   * Extracts UTC year and month from a record date or updatedAt field.
   * @param {Record<string, unknown>} recordItem
   * @returns {{year: number, month: number}|null}
   */
  const readRecordYearAndMonth = (recordItem) => {
    const dateCandidate = typeof recordItem.date === 'string' ? recordItem.date : ''
    const updatedAtCandidate = typeof recordItem.updatedAt === 'string' ? recordItem.updatedAt : ''
    const sourceDate = dateCandidate || updatedAtCandidate
    if (!sourceDate) return null

    const parsedDate = new Date(sourceDate)
    if (Number.isNaN(parsedDate.getTime())) return null

    return {
      year: parsedDate.getUTCFullYear(),
      month: parsedDate.getUTCMonth() + 1
    }
  }

  /**
   * Sums amount values for one collection in one target year/month.
   * @param {Array<Record<string, unknown>>} collectionItems
   * @param {number} targetYear
   * @param {number} targetMonth
   * @returns {number}
   */
  const sumCollectionAmountForTargetMonth = (collectionItems, targetYear, targetMonth, fieldName = 'amount') =>
    collectionItems.reduce((runningTotal, collectionItem) => {
      const yearMonth = readRecordYearAndMonth(collectionItem)
      if (!yearMonth) return runningTotal

      if (yearMonth.year !== targetYear || yearMonth.month !== targetMonth) {
        return runningTotal
      }

      const amountCandidate = collectionItem[fieldName]
      const amountValue = typeof amountCandidate === 'number' ? amountCandidate : 0
      return runningTotal + amountValue
    }, 0)

  const incomeCurrentMonth = sumCollectionAmountForTargetMonth(currentCollectionsState.income, referenceYear, referenceMonth)
  const incomePreviousMonth = sumCollectionAmountForTargetMonth(currentCollectionsState.income, previousYear, previousMonth)

  const expensesCurrentMonth = sumCollectionAmountForTargetMonth(currentCollectionsState.expenses, referenceYear, referenceMonth)
  const expensesPreviousMonth = sumCollectionAmountForTargetMonth(currentCollectionsState.expenses, previousYear, previousMonth)

  const directAssetsCurrentMonth = sumCollectionAmountForTargetMonth(currentCollectionsState.assets, referenceYear, referenceMonth)
  const directAssetsPreviousMonth = sumCollectionAmountForTargetMonth(currentCollectionsState.assets, previousYear, previousMonth)
  const collateralAssetsCurrentMonth = sumCollectionAmountForTargetMonth(
    [...currentCollectionsState.debts, ...currentCollectionsState.loans],
    referenceYear,
    referenceMonth,
    'collateralAssetMarketValue'
  )
  const collateralAssetsPreviousMonth = sumCollectionAmountForTargetMonth(
    [...currentCollectionsState.debts, ...currentCollectionsState.loans],
    previousYear,
    previousMonth,
    'collateralAssetMarketValue'
  )
  const assetsCurrentMonth = directAssetsCurrentMonth + collateralAssetsCurrentMonth
  const assetsPreviousMonth = directAssetsPreviousMonth + collateralAssetsPreviousMonth

  const debtCurrentMonth = sumCollectionAmountForTargetMonth(currentCollectionsState.debts, referenceYear, referenceMonth)
  const debtPreviousMonth = sumCollectionAmountForTargetMonth(currentCollectionsState.debts, previousYear, previousMonth)
  const creditCurrentMonth = sumCollectionAmountForTargetMonth(currentCollectionsState.credit, referenceYear, referenceMonth)
  const creditPreviousMonth = sumCollectionAmountForTargetMonth(currentCollectionsState.credit, previousYear, previousMonth)
  const loanCurrentMonth = sumCollectionAmountForTargetMonth(currentCollectionsState.loans, referenceYear, referenceMonth)
  const loanPreviousMonth = sumCollectionAmountForTargetMonth(currentCollectionsState.loans, previousYear, previousMonth)

  const liabilitiesCurrentMonth = debtCurrentMonth + creditCurrentMonth + loanCurrentMonth
  const liabilitiesPreviousMonth = debtPreviousMonth + creditPreviousMonth + loanPreviousMonth

  const netWorthCurrentMonth = assetsCurrentMonth - liabilitiesCurrentMonth
  const netWorthPreviousMonth = assetsPreviousMonth - liabilitiesPreviousMonth

  return [
    {
      income: {
        currentMonth: incomeCurrentMonth,
        previousMonth: incomePreviousMonth,
        delta: incomeCurrentMonth - incomePreviousMonth
      },
      expenses: {
        currentMonth: expensesCurrentMonth,
        previousMonth: expensesPreviousMonth,
        delta: expensesCurrentMonth - expensesPreviousMonth
      },
      assets: {
        currentMonth: assetsCurrentMonth,
        previousMonth: assetsPreviousMonth,
        delta: assetsCurrentMonth - assetsPreviousMonth
      },
      liabilities: {
        currentMonth: liabilitiesCurrentMonth,
        previousMonth: liabilitiesPreviousMonth,
        delta: liabilitiesCurrentMonth - liabilitiesPreviousMonth
      },
      netWorth: {
        currentMonth: netWorthCurrentMonth,
        previousMonth: netWorthPreviousMonth,
        delta: netWorthCurrentMonth - netWorthPreviousMonth
      }
    },
    null
  ]
}

/**
 * Calculates a monthly summary from current income and expense records.
 * Returns an error when state collections are missing.
 * @param {{income: Array<Record<string, unknown>>, expenses: Array<Record<string, unknown>>}} currentCollectionsState
 * @returns {Result<{totalIncome: number, totalExpenses: number, monthlySurplusDeficit: number, savingsRatePercent: number}>}
 */
export function calculateMonthlyIncomeExpenseSummaryFromCollectionsState(currentCollectionsState) {
  if (!currentCollectionsState || typeof currentCollectionsState !== 'object') {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'currentCollectionsState must be an object',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  if (!Array.isArray(currentCollectionsState.income) || !Array.isArray(currentCollectionsState.expenses)) {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'income and expenses collections must be arrays',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const totalIncome = currentCollectionsState.income.reduce((runningTotal, recordItem) => {
    const amountValue = typeof recordItem.amount === 'number' ? recordItem.amount : 0
    return runningTotal + amountValue
  }, 0)

  const totalExpenses = currentCollectionsState.expenses.reduce((runningTotal, recordItem) => {
    const amountValue = typeof recordItem.amount === 'number' ? recordItem.amount : 0
    return runningTotal + amountValue
  }, 0)

  const monthlySurplusDeficit = totalIncome - totalExpenses
  // Critical path: avoid divide-by-zero so savings rate sorting/rendering remains stable.
  const safeIncomeDivisor = totalIncome > 0 ? totalIncome : 1
  const savingsRatePercent = (monthlySurplusDeficit / safeIncomeDivisor) * 100

  return [
    {
      totalIncome,
      totalExpenses,
      monthlySurplusDeficit,
      savingsRatePercent
    },
    null
  ]
}

/**
 * Calculates monthly savings and storage allocation summary from current collections.
 * Returns an error when required collections are malformed.
 * @param {{income: Array<Record<string, unknown>>, expenses: Array<Record<string, unknown>>, assets: Array<Record<string, unknown>>}} currentCollectionsState
 * @returns {Result<{monthlySavingsAmount: number, monthlySavingsRatePercent: number, totalStoredSavings: number, storageRows: Array<{id: string, person: string, location: string, balance: number, allocationPercent: number, description: string}>}>}
 */
export function calculateMonthlySavingsStorageSummaryFromCollectionsState(currentCollectionsState, referenceDate = new Date()) {
  if (!currentCollectionsState || typeof currentCollectionsState !== 'object') {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'currentCollectionsState must be an object',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  if (!Array.isArray(currentCollectionsState.income) || !Array.isArray(currentCollectionsState.expenses) || !Array.isArray(currentCollectionsState.assets)) {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'income, expenses, and assets collections must be arrays',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const [monthlySummary, monthlySummaryError] = calculateMonthlyIncomeExpenseSummaryFromCollectionsState(currentCollectionsState)
  if (monthlySummaryError) return [null, monthlySummaryError]
  if (!monthlySummary) {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'monthly summary is unexpectedly empty',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const referenceYear = referenceDate.getFullYear()
  const referenceMonth = referenceDate.getMonth()
  const monthlyTrackedSavingsContributions = currentCollectionsState.assets.reduce((runningTotal, assetItem) => {
    const recordType = typeof assetItem.recordType === 'string' ? assetItem.recordType : ''
    if (recordType !== 'savings') return runningTotal
    const amount = typeof assetItem.amount === 'number' ? assetItem.amount : 0
    const dateText = typeof assetItem.date === 'string' ? assetItem.date : ''
    if (dateText.length === 0) return runningTotal
    const parsedDate = new Date(dateText)
    if (Number.isNaN(parsedDate.getTime())) return runningTotal
    if (parsedDate.getFullYear() !== referenceYear || parsedDate.getMonth() !== referenceMonth) return runningTotal
    return runningTotal + amount
  }, 0)

  const totalStoredSavings = currentCollectionsState.assets.reduce((runningTotal, assetItem) => {
    const amount = typeof assetItem.amount === 'number' ? assetItem.amount : 0
    return runningTotal + amount
  }, 0)

  const allocationDivisor = totalStoredSavings > 0 ? totalStoredSavings : 1
  const storageRows = currentCollectionsState.assets.map((assetItem, assetIndex) => {
    const amount = typeof assetItem.amount === 'number' ? assetItem.amount : 0
    const location = typeof assetItem.item === 'string'
      ? assetItem.item
      : (typeof assetItem.category === 'string' ? assetItem.category : `Savings ${assetIndex + 1}`)
    return {
      id: typeof assetItem.id === 'string' ? assetItem.id : `savings-storage-${assetIndex + 1}`,
      person: typeof assetItem.person === 'string' ? assetItem.person : 'User',
      location,
      balance: amount,
      allocationPercent: (amount / allocationDivisor) * 100,
      description: typeof assetItem.description === 'string' ? assetItem.description : ''
    }
  })

  // Critical path: this section should reflect explicitly tracked savings transfers only.
  const monthlySavingsAmount = monthlyTrackedSavingsContributions
  const monthlySavingsRatePercent = monthlySummary.totalIncome > 0
    ? (monthlySavingsAmount / monthlySummary.totalIncome) * 100
    : 0

  return [
    {
      monthlySavingsAmount,
      monthlySavingsRatePercent,
      totalStoredSavings,
      storageRows
    },
    null
  ]
}

/**
 * Calculates emergency-fund tracking summary with liquid and invested buckets.
 * Returns an error when required collections are malformed.
 * @param {{expenses: Array<Record<string, unknown>>, assets: Array<Record<string, unknown>>, assetHoldings?: Array<Record<string, unknown>>, debts?: Array<Record<string, unknown>>, credit?: Array<Record<string, unknown>>, loans?: Array<Record<string, unknown>>}} currentCollectionsState
 * @returns {Result<{monthlyExpenses: number, monthlyDebtMinimums: number, monthlyObligations: number, emergencyFundGoal: number, liquidTarget: number, investedTarget: number, liquidAmount: number, investedAmount: number, totalEmergencyFundAmount: number, missingTotalAmount: number, missingLiquidAmount: number, liquidCoverageMonths: number, totalCoverageMonths: number, liquidSources: Array<{id: string, label: string, amount: number}>, investedSources: Array<{id: string, label: string, amount: number}>}>}
 */
export function calculateEmergencyFundTrackingSummaryFromCollectionsState(currentCollectionsState) {
  if (!currentCollectionsState || typeof currentCollectionsState !== 'object') {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'currentCollectionsState must be an object',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  if (!Array.isArray(currentCollectionsState.expenses) || !Array.isArray(currentCollectionsState.assets)) {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'expenses and assets collections must be arrays',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const assetHoldings = Array.isArray(currentCollectionsState.assetHoldings) ? currentCollectionsState.assetHoldings : []
  const monthlyExpenses = currentCollectionsState.expenses.reduce((runningTotal, expenseRow) => {
    const amount = typeof expenseRow.amount === 'number' ? expenseRow.amount : 0
    return runningTotal + amount
  }, 0)
  const monthlyDebtMinimums =
    (Array.isArray(currentCollectionsState.debts) ? currentCollectionsState.debts : []).reduce((runningTotal, debtRow) => {
      const minimumPayment = typeof debtRow.minimumPayment === 'number' ? debtRow.minimumPayment : 0
      return runningTotal + minimumPayment
    }, 0) +
    (Array.isArray(currentCollectionsState.credit) ? currentCollectionsState.credit : []).reduce((runningTotal, creditRow) => {
      const minimumPayment = typeof creditRow.minimumPayment === 'number' ? creditRow.minimumPayment : 0
      return runningTotal + minimumPayment
    }, 0) +
    (Array.isArray(currentCollectionsState.loans) ? currentCollectionsState.loans : []).reduce((runningTotal, loanRow) => {
      const minimumPayment = typeof loanRow.minimumPayment === 'number' ? loanRow.minimumPayment : 0
      return runningTotal + minimumPayment
    }, 0)
  const monthlyObligations = monthlyExpenses + monthlyDebtMinimums
  const emergencyFundGoal = monthlyObligations * 6
  const liquidTarget = monthlyObligations * 2
  const investedTarget = Math.max(0, emergencyFundGoal - liquidTarget)

  const LIQUID_KEYWORDS = ['cash', 'checking', 'bank', 'savings', 'hysa', 'money market']
  const INVESTED_KEYWORDS = ['stock', 'stocks', 'voo', 'etf', 'brokerage', 'fidelity', 'index fund']
  const liquidSources = []
  const investedSources = []

  const pushSourceIfMatched = (sourceIdPrefix, sourceIndex, label, amount) => {
    const normalizedLabel = String(label || '').toLowerCase()
    if (!Number.isFinite(amount) || amount <= 0) return
    if (LIQUID_KEYWORDS.some((keyword) => normalizedLabel.includes(keyword))) {
      liquidSources.push({ id: `${sourceIdPrefix}-liq-${sourceIndex}`, label: String(label || 'Liquid'), amount })
      return
    }
    if (INVESTED_KEYWORDS.some((keyword) => normalizedLabel.includes(keyword))) {
      investedSources.push({ id: `${sourceIdPrefix}-inv-${sourceIndex}`, label: String(label || 'Invested'), amount })
    }
  }

  currentCollectionsState.assets.forEach((assetRow, assetIndex) => {
    const amount = typeof assetRow.amount === 'number' ? assetRow.amount : 0
    const label = typeof assetRow.item === 'string'
      ? assetRow.item
      : (typeof assetRow.category === 'string' ? assetRow.category : `Asset ${assetIndex + 1}`)
    pushSourceIfMatched('asset', assetIndex, label, amount)
  })
  assetHoldings.forEach((holdingRow, holdingIndex) => {
    const market = typeof holdingRow.assetMarketValue === 'number' ? holdingRow.assetMarketValue : 0
    const owed = typeof holdingRow.assetValueOwed === 'number' ? holdingRow.assetValueOwed : 0
    const netValue = market - owed
    const label = typeof holdingRow.item === 'string' ? holdingRow.item : `Holding ${holdingIndex + 1}`
    pushSourceIfMatched('holding', holdingIndex, label, netValue)
  })

  const liquidAmount = liquidSources.reduce((runningTotal, row) => runningTotal + row.amount, 0)
  const investedAmount = investedSources.reduce((runningTotal, row) => runningTotal + row.amount, 0)
  const totalEmergencyFundAmount = liquidAmount + investedAmount
  const missingTotalAmount = Math.max(0, emergencyFundGoal - totalEmergencyFundAmount)
  const missingLiquidAmount = Math.max(0, liquidTarget - liquidAmount)
  const liquidCoverageMonths = monthlyObligations > 0 ? liquidAmount / monthlyObligations : 0
  const totalCoverageMonths = monthlyObligations > 0 ? totalEmergencyFundAmount / monthlyObligations : 0

  return [
    {
      monthlyExpenses,
      monthlyDebtMinimums,
      monthlyObligations,
      emergencyFundGoal,
      liquidTarget,
      investedTarget,
      liquidAmount,
      investedAmount,
      totalEmergencyFundAmount,
      missingTotalAmount,
      missingLiquidAmount,
      liquidCoverageMonths,
      totalCoverageMonths,
      liquidSources,
      investedSources
    },
    null
  ]
}

/**
 * Calculates a recommended monthly savings target using industry guidance and current cash flow.
 * Returns an error when required collections are malformed.
 * @param {{income: Array<Record<string, unknown>>, expenses: Array<Record<string, unknown>>, debts: Array<Record<string, unknown>>, credit: Array<Record<string, unknown>>, loans: Array<Record<string, unknown>>}} currentCollectionsState
 * @returns {Result<{totalIncomeForReference: number, recommendedMonthlySavings: number, recommendedSavingsRatePercent: number, minimumRecommendedSavings: number, stretchRecommendedSavings: number, currentMonthlySavings: number, gapToRecommendedSavings: number, recommendationReason: string}>}
 */
export function calculateRecommendedMonthlySavingsTargetFromCollectionsState(currentCollectionsState) {
  if (!currentCollectionsState || typeof currentCollectionsState !== 'object') {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'currentCollectionsState must be an object',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const requiredCollectionNames = /** @type {Array<'income'|'expenses'|'debts'|'credit'|'loans'>} */ (
    ['income', 'expenses', 'debts', 'credit', 'loans']
  )
  for (const requiredCollectionName of requiredCollectionNames) {
    if (!Array.isArray(currentCollectionsState[requiredCollectionName])) {
      const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
        'VALIDATION',
        `${requiredCollectionName} collection must be an array`,
        true,
        { requiredCollectionName }
      )
      if (createErrorFailure) return [null, createErrorFailure]
      return [null, errorValue]
    }
  }

  const [monthlySummary, monthlySummaryError] = calculateMonthlyIncomeExpenseSummaryFromCollectionsState(currentCollectionsState)
  if (monthlySummaryError) return [null, monthlySummaryError]
  if (!monthlySummary) {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'monthly summary is unexpectedly empty',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const totalMonthlyDebtMinimums = currentCollectionsState.debts.reduce((runningTotal, debtItem) => {
    const minimumPayment = typeof debtItem.minimumPayment === 'number' ? debtItem.minimumPayment : 0
    return runningTotal + minimumPayment
  }, 0) + currentCollectionsState.credit.reduce((runningTotal, creditItem) => {
    const minimumPayment = typeof creditItem.minimumPayment === 'number' ? creditItem.minimumPayment : 0
    return runningTotal + minimumPayment
  }, 0) + currentCollectionsState.loans.reduce((runningTotal, loanItem) => {
    const minimumPayment = typeof loanItem.minimumPayment === 'number' ? loanItem.minimumPayment : 0
    return runningTotal + minimumPayment
  }, 0)

  const totalIncome = monthlySummary.totalIncome
  const currentMonthlySavings = monthlySummary.monthlySurplusDeficit
  const baselineIndustryRatePercent = 20
  const stretchIndustryRatePercent = 30
  const debtPressurePercent = totalIncome > 0 ? (totalMonthlyDebtMinimums / totalIncome) * 100 : 0
  const adjustedIndustryRatePercent = debtPressurePercent > 36 ? 15 : baselineIndustryRatePercent
  const minimumRecommendedSavings = totalIncome * (adjustedIndustryRatePercent / 100)
  const stretchRecommendedSavings = totalIncome * (stretchIndustryRatePercent / 100)
  const affordableCeiling = Math.max(0, totalIncome - monthlySummary.totalExpenses)
  // Critical path: recommendation should not exceed current affordability window.
  const recommendedMonthlySavings = Math.min(Math.max(minimumRecommendedSavings, 0), affordableCeiling)
  const recommendationReason = debtPressurePercent > 36
    ? 'Debt burden is elevated; target 15% savings now, then raise toward 20% as debt pressure drops.'
    : 'Industry guidance is 20% monthly savings (stretch 30%) when cash flow supports it.'
  const gapToRecommendedSavings = recommendedMonthlySavings - currentMonthlySavings

  return [
    {
      totalIncomeForReference: totalIncome,
      recommendedMonthlySavings,
      recommendedSavingsRatePercent: totalIncome > 0 ? (recommendedMonthlySavings / totalIncome) * 100 : 0,
      minimumRecommendedSavings,
      stretchRecommendedSavings,
      currentMonthlySavings,
      gapToRecommendedSavings,
      recommendationReason
    },
    null
  ]
}

/**
 * Builds three net-worth projection profiles using deterministic monthly simulation.
 * Returns a tuple error when required collection inputs are missing.
 * @param {{income: Array<Record<string, unknown>>, expenses: Array<Record<string, unknown>>, assets: Array<Record<string, unknown>>, assetHoldings?: Array<Record<string, unknown>>, debts: Array<Record<string, unknown>>, credit: Array<Record<string, unknown>>, creditCards?: Array<Record<string, unknown>>, loans: Array<Record<string, unknown>>}} currentCollectionsState
 * @returns {Result<{horizons: Array<{id: string, label: string, months: number}>, baselineVariables: {startingAssetValueFromDataset: number, startingLiabilityBalanceFromDataset: number, totalMonthlyIncomeFromDataset: number, totalMonthlyExpensesFromDataset: number, monthlySavingsPaceBaselineFromDataset: number, totalMonthlyDebtPaymentsFromDataset: number, weightedAprPercentFromDataset: number}, profiles: Array<{id: 'conservative'|'base'|'accelerated', label: string, assumptions: {savingsPaceMultiplier: number, annualAssetGrowthPercent: number, debtPaymentExtraPercent: number, aprStressAdjustmentPercent: number}, points: Array<{horizonId: string, months: number, projectedAssets: number, projectedDebt: number, projectedNetWorth: number}>}>}>}
 */
export function calculateNetWorthProjectionProfilesUsingThreeAggressionLayers(currentCollectionsState) {
  if (!currentCollectionsState || typeof currentCollectionsState !== 'object') {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'currentCollectionsState must be an object',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const requiredCollectionNames = /** @type {Array<'income'|'expenses'|'assets'|'debts'|'credit'|'loans'>} */ (
    ['income', 'expenses', 'assets', 'debts', 'credit', 'loans']
  )
  for (const requiredCollectionName of requiredCollectionNames) {
    if (!Array.isArray(currentCollectionsState[requiredCollectionName])) {
      const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
        'VALIDATION',
        `${requiredCollectionName} collection must be an array`,
        true,
        { requiredCollectionName }
      )
      if (createErrorFailure) return [null, createErrorFailure]
      return [null, errorValue]
    }
  }

  const creditCardRows = Array.isArray(currentCollectionsState.creditCards) ? currentCollectionsState.creditCards : []
  const normalizedCreditCardLiabilityRows = creditCardRows.map((rowItem) => ({
    amount: typeof rowItem.currentBalance === 'number' ? rowItem.currentBalance : 0,
    monthlyPayment: typeof rowItem.monthlyPayment === 'number' ? rowItem.monthlyPayment : 0,
    minimumPayment: typeof rowItem.minimumPayment === 'number' ? rowItem.minimumPayment : 0,
    interestRatePercent: typeof rowItem.interestRatePercent === 'number' ? rowItem.interestRatePercent : 0,
    remainingPayments: typeof rowItem.remainingPayments === 'number' ? rowItem.remainingPayments : 0,
    id: typeof rowItem.id === 'string' ? rowItem.id : ''
  }))
  const liabilityRows = [
    ...currentCollectionsState.debts,
    ...currentCollectionsState.loans,
    ...currentCollectionsState.credit,
    ...normalizedCreditCardLiabilityRows
  ]
  // Critical path: trajectory asset baseline should follow asset market value convention.
  const startingAssetValue = (Array.isArray(currentCollectionsState.assetHoldings) ? currentCollectionsState.assetHoldings : []).reduce((runningTotal, rowItem) => {
    const marketValue = typeof rowItem.assetMarketValue === 'number' ? rowItem.assetMarketValue : 0
    return runningTotal + marketValue
  }, 0)
  const startingLiabilityBalance = liabilityRows.reduce((runningTotal, rowItem) => {
    const amount = typeof rowItem.amount === 'number' ? rowItem.amount : 0
    return runningTotal + amount
  }, 0)

  const totalMonthlyDebtPayments = liabilityRows.reduce((runningTotal, rowItem) => {
    const monthlyPayment = typeof rowItem.monthlyPayment === 'number'
      ? rowItem.monthlyPayment
      : (typeof rowItem.minimumPayment === 'number' ? rowItem.minimumPayment : 0)
    return runningTotal + monthlyPayment
  }, 0)

  const weightedAprNumerator = liabilityRows.reduce((runningTotal, rowItem) => {
    const principal = typeof rowItem.amount === 'number' ? rowItem.amount : 0
    const aprPercent = typeof rowItem.interestRatePercent === 'number' ? rowItem.interestRatePercent : 0
    return runningTotal + (principal * aprPercent)
  }, 0)
  const weightedAprPercent = startingLiabilityBalance > 0 ? (weightedAprNumerator / startingLiabilityBalance) : 0

  const [monthlySummary, monthlySummaryError] = calculateMonthlyIncomeExpenseSummaryFromCollectionsState(currentCollectionsState)
  if (monthlySummaryError) return [null, monthlySummaryError]
  if (!monthlySummary) {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'monthly summary is unexpectedly empty during projection',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const [monthlySavingsStorageSummary, monthlySavingsStorageSummaryError] = calculateMonthlySavingsStorageSummaryFromCollectionsState(currentCollectionsState)
  if (monthlySavingsStorageSummaryError) return [null, monthlySavingsStorageSummaryError]
  if (!monthlySavingsStorageSummary) {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'monthly savings summary is unexpectedly empty during projection',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const monthlySavingsPaceBaseline = Math.max(
    0,
    typeof monthlySavingsStorageSummary.monthlySavingsAmount === 'number'
      ? monthlySavingsStorageSummary.monthlySavingsAmount
      : monthlySummary.monthlySurplusDeficit
  )

  const horizons = [
    { id: 'current', label: 'Current', months: 0 },
    { id: '6-months', label: '6 Months', months: 6 },
    { id: '1-year', label: '1 Year', months: 12 },
    { id: '2-years', label: '2 Years', months: 24 },
    { id: '5-years', label: '5 Years', months: 60 },
    { id: '10-years', label: '10 Years', months: 120 }
  ]
  // Editable pacing profiles for the 3 trajectory options.
  const projectionProfiles = [
    {
      id: /** @type {'conservative'} */ ('conservative'),
      label: 'Conservative',
      assumptions: { savingsPaceMultiplier: 0.7, annualAssetGrowthPercent: 1.5, debtPaymentExtraPercent: 0, aprStressAdjustmentPercent: 1.0 }
    },
    {
      id: /** @type {'base'} */ ('base'),
      label: 'Base',
      assumptions: { savingsPaceMultiplier: 1.0, annualAssetGrowthPercent: 3.0, debtPaymentExtraPercent: 0, aprStressAdjustmentPercent: 0 }
    },
    {
      id: /** @type {'accelerated'} */ ('accelerated'),
      label: 'Accelerated',
      assumptions: { savingsPaceMultiplier: 1.25, annualAssetGrowthPercent: 4.5, debtPaymentExtraPercent: 0.15, aprStressAdjustmentPercent: -1.0 }
    }
  ]

  const liabilitySimulationRows = liabilityRows.map((rowItem, rowIndex) => {
    const openingBalance = typeof rowItem.amount === 'number' ? rowItem.amount : 0
    const aprPercent = typeof rowItem.interestRatePercent === 'number' ? rowItem.interestRatePercent : 0
    const baseMonthlyPayment = typeof rowItem.monthlyPayment === 'number'
      ? rowItem.monthlyPayment
      : (typeof rowItem.minimumPayment === 'number' ? rowItem.minimumPayment : 0)
    const remainingPayments = typeof rowItem.remainingPayments === 'number' ? rowItem.remainingPayments : 0
    return {
      id: typeof rowItem.id === 'string' ? rowItem.id : `liability-sim-${rowIndex}`,
      openingBalance: Math.max(0, openingBalance),
      aprPercent: Math.max(0, aprPercent),
      baseMonthlyPayment: Math.max(0, baseMonthlyPayment),
      remainingPayments: remainingPayments > 0 ? remainingPayments : null
    }
  })

  const profileRows = projectionProfiles.map((profileItem) => {
    const annualAssetGrowthRate = profileItem.assumptions.annualAssetGrowthPercent / 100
    const monthlyAssetGrowthRate = annualAssetGrowthRate / 12
    const monthlySavingsContribution = monthlySavingsPaceBaseline * profileItem.assumptions.savingsPaceMultiplier
    const points = []
    let projectedAssets = startingAssetValue
    let projectedLiabilities = startingLiabilityBalance
    let liabilityStates = liabilitySimulationRows.map((rowItem) => ({
      id: rowItem.id,
      balance: rowItem.openingBalance,
      aprPercent: rowItem.aprPercent,
      baseMonthlyPayment: rowItem.baseMonthlyPayment,
      remainingPayments: rowItem.remainingPayments,
      paymentsMade: 0
    }))

    for (let monthIndex = 0; monthIndex <= 120; monthIndex += 1) {
      if (monthIndex > 0) {
        projectedAssets = (projectedAssets * (1 + monthlyAssetGrowthRate)) + monthlySavingsContribution
        liabilityStates = liabilityStates.map((stateRow) => {
          if (stateRow.balance <= 0) return stateRow
          const adjustedAprPercent = Math.max(0, stateRow.aprPercent + profileItem.assumptions.aprStressAdjustmentPercent)
          const monthlyRate = (adjustedAprPercent / 100) / 12
          const monthlyInterestCost = stateRow.balance * monthlyRate
          const paymentsRemaining = typeof stateRow.remainingPayments === 'number'
            ? Math.max(0, stateRow.remainingPayments - stateRow.paymentsMade)
            : null
          const canPayThisMonth = paymentsRemaining === null || paymentsRemaining > 0
          const scheduledPayment = canPayThisMonth ? stateRow.baseMonthlyPayment : 0
          const profileAdjustedPayment = scheduledPayment * (1 + profileItem.assumptions.debtPaymentExtraPercent)
          const appliedPayment = Math.min(Math.max(0, profileAdjustedPayment), stateRow.balance + monthlyInterestCost)
          const nextBalance = Math.max(0, stateRow.balance + monthlyInterestCost - appliedPayment)
          return {
            ...stateRow,
            balance: nextBalance,
            paymentsMade: canPayThisMonth && appliedPayment > 0 ? stateRow.paymentsMade + 1 : stateRow.paymentsMade
          }
        })

        projectedLiabilities = liabilityStates.reduce((runningTotal, stateRow) => runningTotal + stateRow.balance, 0)
      }

      const horizonMatch = horizons.find((horizonItem) => horizonItem.months === monthIndex)
      if (horizonMatch) {
        points.push({
          horizonId: horizonMatch.id,
          months: horizonMatch.months,
          projectedAssets,
          projectedDebt: projectedLiabilities,
          projectedNetWorth: projectedAssets - projectedLiabilities
        })
      }
    }

    return {
      id: profileItem.id,
      label: profileItem.label,
      assumptions: profileItem.assumptions,
      points
    }
  })

  return [
    {
      horizons,
      baselineVariables: {
        startingAssetValueFromDataset: startingAssetValue,
        startingLiabilityBalanceFromDataset: startingLiabilityBalance,
        totalMonthlyIncomeFromDataset: monthlySummary.totalIncome,
        totalMonthlyExpensesFromDataset: monthlySummary.totalExpenses,
        monthlySavingsPaceBaselineFromDataset: monthlySavingsPaceBaseline,
        totalMonthlyDebtPaymentsFromDataset: totalMonthlyDebtPayments,
        weightedAprPercentFromDataset: weightedAprPercent
      },
      profiles: profileRows
    },
    null
  ]
}

/**
 * Builds detailed dashboard datapoint rows for table rendering with consistent descriptions.
 * Returns an error when required collections are missing.
 * @param {{income: Array<Record<string, unknown>>, expenses: Array<Record<string, unknown>>, assets: Array<Record<string, unknown>>, debts: Array<Record<string, unknown>>, credit: Array<Record<string, unknown>>, loans: Array<Record<string, unknown>>, goals: Array<Record<string, unknown>>}} currentCollectionsState
 * @returns {Result<Array<{metric: string, value: number, valueFormat: 'currency'|'percent'|'count'|'duration', description: string}>>}
 */
export function calculateDetailedDashboardDatapointRowsFromCurrentCollectionsState(currentCollectionsState) {
  const [healthMetrics, healthMetricsError] = calculateTwentyDashboardHealthMetricsFromFinancialCollections(currentCollectionsState)
  if (healthMetricsError) return [null, healthMetricsError]
  if (!healthMetrics) {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'health metrics are unexpectedly empty',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const [monthlySummary, monthlySummaryError] = calculateMonthlyIncomeExpenseSummaryFromCollectionsState(currentCollectionsState)
  if (monthlySummaryError) return [null, monthlySummaryError]
  if (!monthlySummary) {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'monthly summary is unexpectedly empty',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const [sourceBreakdown, sourceBreakdownError] = calculateCurrentAndPreviousMonthSourceBreakdownFromCollectionsState(currentCollectionsState)
  if (sourceBreakdownError) return [null, sourceBreakdownError]
  if (!sourceBreakdown) {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'source breakdown is unexpectedly empty',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const [monthlySavingsStorageSummary, monthlySavingsStorageSummaryError] = calculateMonthlySavingsStorageSummaryFromCollectionsState(currentCollectionsState)
  if (monthlySavingsStorageSummaryError) return [null, monthlySavingsStorageSummaryError]
  if (!monthlySavingsStorageSummary) {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'monthly savings summary is unexpectedly empty',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  /**
   * Sums numeric field values from collection items.
   * @param {Array<Record<string, unknown>>} collectionItems
   * @param {string} fieldName
   * @returns {number}
   */
  const sumNumericFieldFromCollectionItems = (collectionItems, fieldName) =>
    collectionItems.reduce((runningTotal, collectionItem) => {
      const candidateValue = collectionItem[fieldName]
      const numericValue = typeof candidateValue === 'number' ? candidateValue : 0
      return runningTotal + numericValue
    }, 0)

  const creditCardInformationCollection = Array.isArray(currentCollectionsState.creditCards) ? currentCollectionsState.creditCards : []
  const hasCreditCardInformationRows = creditCardInformationCollection.length > 0
  const totalCreditCapacity = hasCreditCardInformationRows
    ? sumNumericFieldFromCollectionItems(creditCardInformationCollection, 'maxCapacity')
    : sumNumericFieldFromCollectionItems(currentCollectionsState.credit, 'creditLimit')
  const totalCreditCardDebt = hasCreditCardInformationRows
    ? sumNumericFieldFromCollectionItems(creditCardInformationCollection, 'currentBalance')
    : sumNumericFieldFromCollectionItems(currentCollectionsState.credit, 'amount')
  const totalCreditMonthlyPayment = hasCreditCardInformationRows
    ? sumNumericFieldFromCollectionItems(creditCardInformationCollection, 'monthlyPayment')
    : sumNumericFieldFromCollectionItems(currentCollectionsState.credit, 'minimumPayment')
  // Critical path: missing limits should degrade to 0% utilization, not invalid numeric state.
  const creditUtilizationPercent = totalCreditCapacity > 0 ? (totalCreditCardDebt / totalCreditCapacity) * 100 : 0

  const totalMonthlyDebtPayback = sumNumericFieldFromCollectionItems(currentCollectionsState.debts, 'minimumPayment') +
    totalCreditMonthlyPayment +
    sumNumericFieldFromCollectionItems(currentCollectionsState.loans, 'minimumPayment')

  const debtToIncomeRatioPercent = monthlySummary.totalIncome > 0
    ? (totalMonthlyDebtPayback / monthlySummary.totalIncome) * 100
    : 0

  const [emergencyFundSummary, emergencyFundSummaryError] = calculateEmergencyFundTrackingSummaryFromCollectionsState(currentCollectionsState)
  if (emergencyFundSummaryError) return [null, emergencyFundSummaryError]
  if (!emergencyFundSummary) {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'emergency fund summary is unexpectedly empty',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const emergencyFundGoal = emergencyFundSummary.emergencyFundGoal
  const emergencyFundsCurrent = emergencyFundSummary.totalEmergencyFundAmount
  const emergencyFundGoalProgressPercent = emergencyFundGoal > 0
    ? (emergencyFundsCurrent / emergencyFundGoal) * 100
    : 0

  const goalProgressTotals = currentCollectionsState.goals.reduce((runningTotals, goalItem) => {
    const targetAmount = typeof goalItem.targetAmount === 'number' ? goalItem.targetAmount : 0
    const currentAmount = typeof goalItem.currentAmount === 'number' ? goalItem.currentAmount : 0

    if (targetAmount <= 0 || currentAmount <= 0) {
      return {
        ...runningTotals,
        notStarted: runningTotals.notStarted + 1
      }
    }

    if (currentAmount >= targetAmount) {
      return {
        ...runningTotals,
        completed: runningTotals.completed + 1
      }
    }

    return {
      ...runningTotals,
      inProgress: runningTotals.inProgress + 1
    }
  }, { completed: 0, inProgress: 0, notStarted: 0 })

  const travelGoals = currentCollectionsState.goals.filter((goalItem) => {
    const goalText = `${goalItem.title ?? ''} ${goalItem.name ?? ''} ${goalItem.category ?? ''}`.toLowerCase()
    return goalText.includes('travel') || goalText.includes('trip') || goalText.includes('vacation')
  })
  const travelGoalsCompleted = travelGoals.filter((goalItem) => {
    const targetAmount = typeof goalItem.targetAmount === 'number' ? goalItem.targetAmount : 0
    const currentAmount = typeof goalItem.currentAmount === 'number' ? goalItem.currentAmount : 0
    return targetAmount > 0 && currentAmount >= targetAmount
  }).length
  const travelGoalsOnBucketList = travelGoals.length

  const totalDebtBalance = sumNumericFieldFromCollectionItems(currentCollectionsState.debts, 'amount') +
    totalCreditCardDebt +
    sumNumericFieldFromCollectionItems(currentCollectionsState.loans, 'amount')
  const weightedCreditInterestRatePercent = hasCreditCardInformationRows
    ? (
        creditCardInformationCollection.reduce((runningTotal, creditCardItem) => {
          const balance = typeof creditCardItem.currentBalance === 'number' ? creditCardItem.currentBalance : 0
          const rate = typeof creditCardItem.interestRatePercent === 'number' ? creditCardItem.interestRatePercent : 0
          return runningTotal + (balance * rate)
        }, 0) / Math.max(totalCreditCardDebt, 1)
      )
    : (
        currentCollectionsState.credit.reduce((runningTotal, creditItem) => {
          const amount = typeof creditItem.amount === 'number' ? creditItem.amount : 0
          const rate = typeof creditItem.interestRatePercent === 'number' ? creditItem.interestRatePercent : 0
          return runningTotal + (amount * rate)
        }, 0) / Math.max(sumNumericFieldFromCollectionItems(currentCollectionsState.credit, 'amount'), 1)
      )
  const weightedAverageInterestRatePercent = totalDebtBalance > 0
    ? (
        sumNumericFieldFromCollectionItems(currentCollectionsState.debts, 'amount') *
          (sumNumericFieldFromCollectionItems(currentCollectionsState.debts, 'amount') > 0
            ? currentCollectionsState.debts.reduce((runningTotal, debtItem) => {
              const amount = typeof debtItem.amount === 'number' ? debtItem.amount : 0
              const rate = typeof debtItem.interestRatePercent === 'number' ? debtItem.interestRatePercent : 0
              return runningTotal + (amount * rate)
            }, 0) / Math.max(sumNumericFieldFromCollectionItems(currentCollectionsState.debts, 'amount'), 1)
            : 0) +
        totalCreditCardDebt * weightedCreditInterestRatePercent +
        sumNumericFieldFromCollectionItems(currentCollectionsState.loans, 'amount') *
          (sumNumericFieldFromCollectionItems(currentCollectionsState.loans, 'amount') > 0
            ? currentCollectionsState.loans.reduce((runningTotal, loanItem) => {
              const amount = typeof loanItem.amount === 'number' ? loanItem.amount : 0
              const rate = typeof loanItem.interestRatePercent === 'number' ? loanItem.interestRatePercent : 0
              return runningTotal + (amount * rate)
            }, 0) / Math.max(sumNumericFieldFromCollectionItems(currentCollectionsState.loans, 'amount'), 1)
            : 0)
      ) / totalDebtBalance
    : 0
  const [monthsUntilDebtFree, monthsUntilDebtFreeError] = calculateEstimatedPayoffMonthsFromBalancePaymentAndInterestRate(
    totalDebtBalance,
    totalMonthlyDebtPayback,
    weightedAverageInterestRatePercent
  )
  if (monthsUntilDebtFreeError) return [null, monthsUntilDebtFreeError]
  const incomeAfterDebtMinimums = monthlySummary.totalIncome - totalMonthlyDebtPayback
  const monthlySurplus = monthlySummary.monthlySurplusDeficit
  const projectedNetWorthThreeMonths = healthMetrics.netWorth + (monthlySurplus * 3)
  const projectedNetWorthSixMonths = healthMetrics.netWorth + (monthlySurplus * 6)
  const projectedNetWorthTwelveMonths = healthMetrics.netWorth + (monthlySurplus * 12)
  const emergencyFundGap = Math.max(0, emergencyFundGoal - emergencyFundsCurrent)
  const emergencyFundMonthsCovered = emergencyFundSummary.totalCoverageMonths
  const debtCoverageByAssetsPercent = totalDebtBalance > 0 ? (healthMetrics.totalAssets / totalDebtBalance) * 100 : 0
  const liabilitiesAsPercentOfAssets = healthMetrics.totalAssets > 0 ? (totalDebtBalance / healthMetrics.totalAssets) * 100 : 0
  const debtBalanceWithoutMortgage = Math.max(0, totalDebtBalance - currentCollectionsState.debts.reduce((runningTotal, debtItem) => {
    const isMortgage = typeof debtItem.item === 'string' && debtItem.item.toLowerCase().includes('mortgage')
    return runningTotal + (isMortgage && typeof debtItem.amount === 'number' ? debtItem.amount : 0)
  }, 0))
  const mortgageBalance = totalDebtBalance - debtBalanceWithoutMortgage
  const mortgageShareOfLiabilitiesPercent = totalDebtBalance > 0 ? (mortgageBalance / totalDebtBalance) * 100 : 0
  const nonMortgageDebtSharePercent = totalDebtBalance > 0 ? (debtBalanceWithoutMortgage / totalDebtBalance) * 100 : 0
  const debtMinimumsAsPercentOfExpenses = monthlySummary.totalExpenses > 0 ? (totalMonthlyDebtPayback / monthlySummary.totalExpenses) * 100 : 0
  const discretionaryAfterEssentialsAndDebt = monthlySummary.totalIncome - monthlySummary.totalExpenses - totalMonthlyDebtPayback
  const monthlyBurnAfterDebt = monthlySummary.totalExpenses + totalMonthlyDebtPayback
  const cashRunwayAfterDebtMonths = monthlyBurnAfterDebt > 0 ? emergencyFundsCurrent / monthlyBurnAfterDebt : 0
  const incomeChangeMonthOverMonth = sourceBreakdown.income.delta
  const expenseChangeMonthOverMonth = sourceBreakdown.expenses.delta
  const liabilitiesChangeMonthOverMonth = sourceBreakdown.liabilities.delta
  const netWorthChangeMonthOverMonth = sourceBreakdown.netWorth.delta
  const expensesToIncomeSpread = monthlySummary.totalIncome - monthlySummary.totalExpenses
  const debtPaydownVelocityPercent = totalDebtBalance > 0 ? (totalMonthlyDebtPayback / totalDebtBalance) * 100 : 0
  const annualDebtService = totalMonthlyDebtPayback * 12
  const securedDebtRows = [...currentCollectionsState.debts, ...currentCollectionsState.loans].filter((rowItem) => {
    const collateralAssetMarketValue = typeof rowItem.collateralAssetMarketValue === 'number' ? rowItem.collateralAssetMarketValue : 0
    return collateralAssetMarketValue > 0
  })
  const totalSecuredDebtBalance = securedDebtRows.reduce((runningTotal, rowItem) => runningTotal + (typeof rowItem.amount === 'number' ? rowItem.amount : 0), 0)
  const totalSecuredCollateralMarketValue = securedDebtRows.reduce((runningTotal, rowItem) => runningTotal + (typeof rowItem.collateralAssetMarketValue === 'number' ? rowItem.collateralAssetMarketValue : 0), 0)
  const securedDebtLoanToValuePercent = totalSecuredCollateralMarketValue > 0
    ? (totalSecuredDebtBalance / totalSecuredCollateralMarketValue) * 100
    : 0
  const securedEquityValue = totalSecuredCollateralMarketValue - totalSecuredDebtBalance

  const detailedRows = [
    {
      metric: 'Credit Card Capacity',
      value: totalCreditCapacity,
      valueFormat: /** @type {'currency'} */ ('currency'),
      description: hasCreditCardInformationRows
        ? 'Total capacity from the Credit Accounts section card limits.'
        : 'Total capacity of credit available across all recorded credit accounts.'
    },
    {
      metric: 'Credit Card Debt',
      value: totalCreditCardDebt,
      valueFormat: /** @type {'currency'} */ ('currency'),
      description: hasCreditCardInformationRows
        ? 'Current balance from the Credit Accounts section. Included in total debts.'
        : 'Current outstanding balance across all credit accounts. Included in total debts.'
    },
    {
      metric: 'Credit Card Utilization',
      value: creditUtilizationPercent,
      valueFormat: /** @type {'percent'} */ ('percent'),
      description: 'Credit balance divided by total credit capacity. A lower percentage is healthier.'
    },
    {
      metric: 'Debt to Income Ratio',
      value: debtToIncomeRatioPercent,
      valueFormat: /** @type {'percent'} */ ('percent'),
      description: 'Monthly required debt payments divided by monthly income.'
    },
    {
      metric: 'Emergency Funds',
      value: emergencyFundsCurrent,
      valueFormat: /** @type {'currency'} */ ('currency'),
      description: `Current emergency fund proxy from current-month assets. Progress: ${emergencyFundGoalProgressPercent.toFixed(2)}% of goal.`
    },
    {
      metric: 'Emergency Funds Goal',
      value: emergencyFundGoal,
      valueFormat: /** @type {'currency'} */ ('currency'),
      description: 'Six times monthly obligations (expenses plus debt minimums).'
    },
    {
      metric: 'Goals Completed',
      value: goalProgressTotals.completed,
      valueFormat: /** @type {'count'} */ ('count'),
      description: 'Goals where current amount is greater than or equal to target amount.'
    },
    {
      metric: 'Goals In Progress',
      value: goalProgressTotals.inProgress,
      valueFormat: /** @type {'count'} */ ('count'),
      description: 'Goals with positive progress that have not yet reached target.'
    },
    {
      metric: 'Goals Not Started',
      value: goalProgressTotals.notStarted,
      valueFormat: /** @type {'count'} */ ('count'),
      description: 'Goals with no positive progress recorded yet.'
    },
    {
      metric: 'Monthly Expenses',
      value: monthlySummary.totalExpenses,
      valueFormat: /** @type {'currency'} */ ('currency'),
      description: 'Total expenses from current recorded monthly expense entries.'
    },
    {
      metric: 'Monthly Income',
      value: monthlySummary.totalIncome,
      valueFormat: /** @type {'currency'} */ ('currency'),
      description: 'Total income from current recorded monthly income entries.'
    },
    {
      metric: 'Months Until Debt-Free',
      value: monthsUntilDebtFree,
      valueFormat: /** @type {'duration'} */ ('duration'),
      description: 'Estimated months to pay all debts at the current monthly debt payback pace.'
    },
    {
      metric: 'Monthly Debt Payback',
      value: totalMonthlyDebtPayback,
      valueFormat: /** @type {'currency'} */ ('currency'),
      description: 'Sum of minimum monthly payments across debt, credit, and loan records.'
    },
    {
      metric: 'Weighted Interest Rate',
      value: weightedAverageInterestRatePercent,
      valueFormat: /** @type {'percent'} */ ('percent'),
      description: 'Balance-weighted APR across debts, credit balances, and loans.'
    },
    {
      metric: 'Net Worth',
      value: healthMetrics.netWorth,
      valueFormat: /** @type {'currency'} */ ('currency'),
      description: `Assets minus liabilities. Change vs previous month: ${sourceBreakdown.netWorth.delta.toFixed(2)}.`
    },
    {
      metric: 'Savings Rate',
      value: monthlySavingsStorageSummary.monthlySavingsRatePercent,
      valueFormat: /** @type {'percent'} */ ('percent'),
      description: 'Tracked monthly savings contributions divided by monthly income.'
    },
    {
      metric: 'Total Debts',
      value: totalDebtBalance,
      valueFormat: /** @type {'currency'} */ ('currency'),
      description: 'Total liabilities including debts, credit balances, and loans.'
    },
    {
      metric: 'Travel Goals Completed',
      value: travelGoalsCompleted,
      valueFormat: /** @type {'count'} */ ('count'),
      description: 'Number of travel-related goals completed.'
    },
    {
      metric: 'Travel Goals On Bucket List',
      value: travelGoalsOnBucketList,
      valueFormat: /** @type {'count'} */ ('count'),
      description: 'Number of travel-related goals currently tracked.'
    },
    {
      metric: 'Yearly Income',
      value: monthlySummary.totalIncome * 12,
      valueFormat: /** @type {'currency'} */ ('currency'),
      description: 'Current monthly income annualized.'
    },
    {
      metric: 'Income After Debt Minimums',
      value: incomeAfterDebtMinimums,
      valueFormat: /** @type {'currency'} */ ('currency'),
      description: 'Monthly income remaining after minimum debt payments.'
    },
    {
      metric: 'Monthly Surplus / Deficit',
      value: monthlySurplus,
      valueFormat: /** @type {'currency'} */ ('currency'),
      description: 'Monthly income minus monthly expenses.'
    },
    {
      metric: 'Projected Net Worth (3 Months)',
      value: projectedNetWorthThreeMonths,
      valueFormat: /** @type {'currency'} */ ('currency'),
      description: 'Current net worth projected forward 3 months at current surplus pace.'
    },
    {
      metric: 'Projected Net Worth (6 Months)',
      value: projectedNetWorthSixMonths,
      valueFormat: /** @type {'currency'} */ ('currency'),
      description: 'Current net worth projected forward 6 months at current surplus pace.'
    },
    {
      metric: 'Projected Net Worth (12 Months)',
      value: projectedNetWorthTwelveMonths,
      valueFormat: /** @type {'currency'} */ ('currency'),
      description: 'Current net worth projected forward 12 months at current surplus pace.'
    },
    {
      metric: 'Emergency Fund Gap',
      value: emergencyFundGap,
      valueFormat: /** @type {'currency'} */ ('currency'),
      description: 'How much is still needed to hit the emergency fund goal.'
    },
    {
      metric: 'Emergency Fund Coverage (Months)',
      value: emergencyFundMonthsCovered,
      valueFormat: /** @type {'duration'} */ ('duration'),
      description: 'How many months of expenses plus debt minimums current emergency funds can cover.'
    },
    {
      metric: 'Debt Coverage By Assets',
      value: debtCoverageByAssetsPercent,
      valueFormat: /** @type {'percent'} */ ('percent'),
      description: 'Assets divided by total liabilities.'
    },
    {
      metric: 'Liabilities As % Of Assets',
      value: liabilitiesAsPercentOfAssets,
      valueFormat: /** @type {'percent'} */ ('percent'),
      description: 'Total liabilities divided by assets.'
    },
    {
      metric: 'Debt Balance Without Mortgage',
      value: debtBalanceWithoutMortgage,
      valueFormat: /** @type {'currency'} */ ('currency'),
      description: 'Total liabilities excluding identified mortgage balances.'
    },
    {
      metric: 'Mortgage Share Of Liabilities',
      value: mortgageShareOfLiabilitiesPercent,
      valueFormat: /** @type {'percent'} */ ('percent'),
      description: 'Mortgage balance as a share of total liabilities.'
    },
    {
      metric: 'Non-Mortgage Liability Share',
      value: nonMortgageDebtSharePercent,
      valueFormat: /** @type {'percent'} */ ('percent'),
      description: 'All non-mortgage liabilities as a share of total liabilities.'
    },
    {
      metric: 'Debt Minimums As % Of Expenses',
      value: debtMinimumsAsPercentOfExpenses,
      valueFormat: /** @type {'percent'} */ ('percent'),
      description: 'Monthly debt minimums divided by monthly expenses.'
    },
    {
      metric: 'Discretionary After Expenses + Debt',
      value: discretionaryAfterEssentialsAndDebt,
      valueFormat: /** @type {'currency'} */ ('currency'),
      description: 'Income remaining after expenses and monthly debt minimums.'
    },
    {
      metric: 'Cash Runway After Debt Service',
      value: cashRunwayAfterDebtMonths,
      valueFormat: /** @type {'duration'} */ ('duration'),
      description: 'Months current emergency funds can cover expenses plus debt minimums.'
    },
    {
      metric: 'Income Change vs Last Month',
      value: incomeChangeMonthOverMonth,
      valueFormat: /** @type {'currency'} */ ('currency'),
      description: 'Current-month income minus previous-month income.'
    },
    {
      metric: 'Expense Change vs Last Month',
      value: expenseChangeMonthOverMonth,
      valueFormat: /** @type {'currency'} */ ('currency'),
      description: 'Current-month expenses minus previous-month expenses.'
    },
    {
      metric: 'Liabilities Change vs Last Month',
      value: liabilitiesChangeMonthOverMonth,
      valueFormat: /** @type {'currency'} */ ('currency'),
      description: 'Current-month liabilities minus previous-month liabilities.'
    },
    {
      metric: 'Net Worth Change vs Last Month',
      value: netWorthChangeMonthOverMonth,
      valueFormat: /** @type {'currency'} */ ('currency'),
      description: 'Current-month net worth minus previous-month net worth.'
    },
    {
      metric: 'Annual Debt Service',
      value: annualDebtService,
      valueFormat: /** @type {'currency'} */ ('currency'),
      description: 'Annualized monthly debt minimum payments.'
    },
    {
      metric: 'Debt Paydown Velocity',
      value: debtPaydownVelocityPercent,
      valueFormat: /** @type {'percent'} */ ('percent'),
      description: 'Monthly debt minimums as a share of total liabilities.'
    },
    {
      metric: 'Secured Collateral Market Value',
      value: totalSecuredCollateralMarketValue,
      valueFormat: /** @type {'currency'} */ ('currency'),
      description: 'Combined market value of assets backing debt/loan balances.'
    },
    {
      metric: 'Secured Equity',
      value: securedEquityValue,
      valueFormat: /** @type {'currency'} */ ('currency'),
      description: 'Tracked collateral market value minus associated secured debt balances.'
    },
    {
      metric: 'Secured Debt Loan-To-Value',
      value: securedDebtLoanToValuePercent,
      valueFormat: /** @type {'percent'} */ ('percent'),
      description: 'Debt+loan balance divided by collateral market value (lower is safer).'
    }
  ]

  return [detailedRows, null]
}

/**
 * Extracts actionable financial risk findings from current collections.
 * Returns an error when required collections are malformed.
 * @param {{income: Array<Record<string, unknown>>, expenses: Array<Record<string, unknown>>, assets: Array<Record<string, unknown>>, debts: Array<Record<string, unknown>>, credit: Array<Record<string, unknown>>, loans: Array<Record<string, unknown>>, goals: Array<Record<string, unknown>>}} currentCollectionsState
 * @returns {Result<Array<{id: string, severity: 'high'|'medium'|'low', title: string, detail: string, metricValue: number}>>}
 */
export function extractFinancialRiskFindingsFromCurrentCollectionsState(currentCollectionsState) {
  const [healthMetrics, healthMetricsError] = calculateTwentyDashboardHealthMetricsFromFinancialCollections(currentCollectionsState)
  if (healthMetricsError) return [null, healthMetricsError]
  if (!healthMetrics) {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'health metrics are unexpectedly empty',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const [monthlySummary, monthlySummaryError] = calculateMonthlyIncomeExpenseSummaryFromCollectionsState(currentCollectionsState)
  if (monthlySummaryError) return [null, monthlySummaryError]
  if (!monthlySummary) {
    const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
      'VALIDATION',
      'monthly summary is unexpectedly empty',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const creditCardRows = Array.isArray(currentCollectionsState.creditCards) ? currentCollectionsState.creditCards : []
  const creditLimitTotalFromCards = creditCardRows.reduce((runningTotal, creditItem) => runningTotal + (typeof creditItem.maxCapacity === 'number' ? creditItem.maxCapacity : 0), 0)
  const creditBalanceTotalFromCards = creditCardRows.reduce((runningTotal, creditItem) => runningTotal + (typeof creditItem.currentBalance === 'number' ? creditItem.currentBalance : 0), 0)
  const creditLimitTotalFromLegacyCredit = currentCollectionsState.credit.reduce((runningTotal, creditItem) => runningTotal + (typeof creditItem.creditLimit === 'number' ? creditItem.creditLimit : 0), 0)
  const creditBalanceTotalFromLegacyCredit = currentCollectionsState.credit.reduce((runningTotal, creditItem) => runningTotal + (typeof creditItem.amount === 'number' ? creditItem.amount : 0), 0)
  const creditPaymentRows = creditCardRows.length > 0 ? creditCardRows : currentCollectionsState.credit
  const creditLimitTotal = creditLimitTotalFromCards > 0 ? creditLimitTotalFromCards : creditLimitTotalFromLegacyCredit
  const creditBalanceTotal = creditLimitTotalFromCards > 0 ? creditBalanceTotalFromCards : creditBalanceTotalFromLegacyCredit
  const debtBalanceTotal = currentCollectionsState.debts.reduce((runningTotal, debtItem) => runningTotal + (typeof debtItem.amount === 'number' ? debtItem.amount : 0), 0)
  const loanBalanceTotal = currentCollectionsState.loans.reduce((runningTotal, loanItem) => runningTotal + (typeof loanItem.amount === 'number' ? loanItem.amount : 0), 0)
  const liabilitiesTotal = debtBalanceTotal + creditBalanceTotal + loanBalanceTotal
  const debtPaymentTotal = currentCollectionsState.debts.reduce((runningTotal, debtItem) => runningTotal + (typeof debtItem.minimumPayment === 'number' ? debtItem.minimumPayment : 0), 0) +
    creditPaymentRows.reduce((runningTotal, creditItem) => runningTotal + (
      typeof creditItem.minimumPayment === 'number'
        ? creditItem.minimumPayment
        : (typeof creditItem.monthlyPayment === 'number' ? creditItem.monthlyPayment : 0)
    ), 0) +
    currentCollectionsState.loans.reduce((runningTotal, loanItem) => runningTotal + (typeof loanItem.minimumPayment === 'number' ? loanItem.minimumPayment : 0), 0)
  const creditUtilizationPercent = creditLimitTotal > 0 ? (creditBalanceTotal / creditLimitTotal) * 100 : 0
  const debtToIncomePercent = monthlySummary.totalIncome > 0 ? (debtPaymentTotal / monthlySummary.totalIncome) * 100 : 0
  let emergencyFundMonths = 0
  const debtServiceCoverageRatio = debtPaymentTotal > 0 ? monthlySummary.totalIncome / debtPaymentTotal : 999
  const liquidityRatio = liabilitiesTotal > 0 ? healthMetrics.totalAssets / liabilitiesTotal : 0
  const incomeVolatilityProxyPercent = monthlySummary.totalIncome > 0 ? (Math.abs(monthlySummary.monthlySurplusDeficit) / monthlySummary.totalIncome) * 100 : 0
  const securedDebtRows = [...currentCollectionsState.debts, ...currentCollectionsState.loans].filter((rowItem) => {
    const collateralAssetMarketValue = typeof rowItem.collateralAssetMarketValue === 'number' ? rowItem.collateralAssetMarketValue : 0
    return collateralAssetMarketValue > 0
  })
  const totalSecuredDebtBalance = securedDebtRows.reduce((runningTotal, rowItem) => runningTotal + (typeof rowItem.amount === 'number' ? rowItem.amount : 0), 0)
  const totalSecuredCollateralMarketValue = securedDebtRows.reduce((runningTotal, rowItem) => runningTotal + (typeof rowItem.collateralAssetMarketValue === 'number' ? rowItem.collateralAssetMarketValue : 0), 0)
  const securedDebtLoanToValuePercent = totalSecuredCollateralMarketValue > 0 ? (totalSecuredDebtBalance / totalSecuredCollateralMarketValue) * 100 : 0
  const safeIncomeDivisor = monthlySummary.totalIncome > 0 ? monthlySummary.totalIncome : 1
  const safeLiabilitiesDivisor = liabilitiesTotal > 0 ? liabilitiesTotal : 1
  const totalLiquidSavings = currentCollectionsState.assets.reduce((runningTotal, assetItem) => {
    const isSavings = typeof assetItem.recordType === 'string' ? assetItem.recordType === 'savings' : false
    const amount = typeof assetItem.amount === 'number' ? assetItem.amount : 0
    return isSavings ? runningTotal + amount : runningTotal
  }, 0)
  const totalCashEquivalentHoldings = (Array.isArray(currentCollectionsState.assetHoldings) ? currentCollectionsState.assetHoldings : []).reduce((runningTotal, assetItem) => {
    const itemName = typeof assetItem.item === 'string' ? assetItem.item.toLowerCase() : ''
    const isCashEquivalent = itemName.includes('bank') || itemName.includes('checking') || itemName.includes('cash') || itemName.includes('savings')
    const marketValue = typeof assetItem.assetMarketValue === 'number' ? assetItem.assetMarketValue : 0
    const owedValue = typeof assetItem.assetValueOwed === 'number' ? assetItem.assetValueOwed : 0
    const netValue = marketValue - owedValue
    return isCashEquivalent ? runningTotal + Math.max(0, netValue) : runningTotal
  }, 0)
  const totalLiquidCashEquivalents = totalLiquidSavings + totalCashEquivalentHoldings
  emergencyFundMonths = monthlySummary.totalExpenses > 0 ? totalLiquidCashEquivalents / monthlySummary.totalExpenses : 0
  const totalMonthlyObligations = monthlySummary.totalExpenses + debtPaymentTotal
  const cashRunwayWithDebtMonths = totalMonthlyObligations > 0 ? totalLiquidCashEquivalents / totalMonthlyObligations : 0
  const cashRunwayExpensesOnlyMonths = monthlySummary.totalExpenses > 0 ? totalLiquidCashEquivalents / monthlySummary.totalExpenses : 0
  const operatingCashFlow = monthlySummary.totalIncome - totalMonthlyObligations
  const discretionaryBuffer = monthlySummary.totalIncome - monthlySummary.totalExpenses - debtPaymentTotal
  const projectedMonthEndCashflow = discretionaryBuffer
  const debtMinimumsToExpensesPercent = monthlySummary.totalExpenses > 0 ? (debtPaymentTotal / monthlySummary.totalExpenses) * 100 : 0
  const maxSingleDebtPaymentSharePercent = (() => {
    const allDebtRows = [...currentCollectionsState.debts, ...creditPaymentRows, ...currentCollectionsState.loans]
    const maxPayment = allDebtRows.reduce((runningMax, rowItem) => {
      const minimumPayment = typeof rowItem.minimumPayment === 'number' ? rowItem.minimumPayment : 0
      const monthlyPayment = typeof rowItem.monthlyPayment === 'number' ? rowItem.monthlyPayment : 0
      return Math.max(runningMax, Math.max(minimumPayment, monthlyPayment))
    }, 0)
    return (maxPayment / safeIncomeDivisor) * 100
  })()
  const fixedExpenseCategories = new Set(['housing', 'utilities', 'insurance', 'internet', 'phone', 'hoa'])
  const fixedExpenseTotal = currentCollectionsState.expenses.reduce((runningTotal, expenseItem) => {
    const category = typeof expenseItem.category === 'string' ? expenseItem.category.toLowerCase() : ''
    const amount = typeof expenseItem.amount === 'number' ? expenseItem.amount : 0
    return fixedExpenseCategories.has(category) ? runningTotal + amount : runningTotal
  }, 0) + debtPaymentTotal
  const fixedCostRatioPercent = (fixedExpenseTotal / safeIncomeDivisor) * 100
  const topIncomeSourceSharePercent = (() => {
    const sourceTotals = new Map()
    for (const incomeItem of currentCollectionsState.income) {
      const sourceName = typeof incomeItem.item === 'string' && incomeItem.item.trim().length > 0 ? incomeItem.item.trim() : 'Income'
      const amount = typeof incomeItem.amount === 'number' ? incomeItem.amount : 0
      sourceTotals.set(sourceName, (sourceTotals.get(sourceName) ?? 0) + amount)
    }
    const topSource = [...sourceTotals.values()].reduce((runningTop, candidateValue) => Math.max(runningTop, candidateValue), 0)
    return safeIncomeDivisor > 0 ? (topSource / safeIncomeDivisor) * 100 : 0
  })()
  const staleBalanceCountOver45Days = (() => {
    const nowTimestamp = Date.now()
    const staleCutoffDays = 45
    const liabilityRows = [...currentCollectionsState.debts, ...creditPaymentRows, ...currentCollectionsState.loans]
    return liabilityRows.reduce((runningCount, rowItem) => {
      const timestampCandidate = typeof rowItem.updatedAt === 'string'
        ? rowItem.updatedAt
        : (typeof rowItem.date === 'string' ? rowItem.date : '')
      if (!timestampCandidate) return runningCount + 1
      const parsedTimestamp = new Date(timestampCandidate).getTime()
      if (!Number.isFinite(parsedTimestamp)) return runningCount + 1
      const ageDays = (nowTimestamp - parsedTimestamp) / (1000 * 60 * 60 * 24)
      return ageDays > staleCutoffDays ? runningCount + 1 : runningCount
    }, 0)
  })()
  const forecastingFieldMissingCount = (() => {
    const liabilityRows = [...currentCollectionsState.debts, ...creditPaymentRows, ...currentCollectionsState.loans]
    return liabilityRows.reduce((runningCount, rowItem) => {
      const amountCandidate = typeof rowItem.amount === 'number'
        ? rowItem.amount
        : (typeof rowItem.currentBalance === 'number' ? rowItem.currentBalance : null)
      const hasAmount = typeof amountCandidate === 'number' && amountCandidate >= 0
      const hasMinimum = typeof rowItem.minimumPayment === 'number' && rowItem.minimumPayment >= 0
      const hasRate = typeof rowItem.interestRatePercent === 'number' && rowItem.interestRatePercent >= 0
      return hasAmount && hasMinimum && hasRate ? runningCount : runningCount + 1
    }, 0)
  })()
  const creditUtilizationMismatchPercent = (() => {
    const cardLimit = creditLimitTotalFromCards
    const legacyLimit = creditLimitTotalFromLegacyCredit
    if (cardLimit <= 0 || legacyLimit <= 0) return 0
    const cardUtilization = cardLimit > 0 ? (creditBalanceTotalFromCards / cardLimit) * 100 : 0
    const legacyUtilization = legacyLimit > 0 ? (creditBalanceTotalFromLegacyCredit / legacyLimit) * 100 : 0
    return Math.abs(cardUtilization - legacyUtilization)
  })()
  const maxRevolvingAprExposure = creditPaymentRows.reduce((runningMax, creditItem) => {
    const apr = typeof creditItem.interestRatePercent === 'number' ? creditItem.interestRatePercent : 0
    const amount = typeof creditItem.amount === 'number'
      ? creditItem.amount
      : (typeof creditItem.currentBalance === 'number' ? creditItem.currentBalance : 0)
    if (amount <= 1000) return runningMax
    return Math.max(runningMax, apr)
  }, 0)
  const unsecuredOrUnderwaterSecuredCount = securedDebtRows.reduce((runningCount, rowItem) => {
    const balance = typeof rowItem.amount === 'number' ? rowItem.amount : 0
    const collateral = typeof rowItem.collateralAssetMarketValue === 'number' ? rowItem.collateralAssetMarketValue : 0
    if (collateral <= 0) return runningCount
    const ltvPercent = (balance / collateral) * 100
    const itemLabel = typeof rowItem.item === 'string' ? rowItem.item.toLowerCase() : ''
    const isMortgage = itemLabel.includes('mortgage')
    const threshold = isMortgage ? 90 : 100
    return ltvPercent > threshold ? runningCount + 1 : runningCount
  }, 0)
  const findings = []

  /**
   * @param {string} id
   * @param {'high'|'medium'|'low'} severity
   * @param {string} title
   * @param {string} detail
   * @param {number} metricValue
   * @returns {void}
   */
  function pushFinding(id, severity, title, detail, metricValue) {
    findings.push({ id, severity, title, detail, metricValue })
  }

  const thresholdChecks = [
    { id: 'dti-gt-20', severity: 'low', title: 'Debt-to-income is above 20%', detail: 'Debt payments are above conservative comfort range.', value: debtToIncomePercent, threshold: 20 },
    { id: 'dti-gt-30', severity: 'medium', title: 'Debt-to-income is above 30%', detail: 'Debt payments are approaching stressed affordability.', value: debtToIncomePercent, threshold: 30 },
    { id: 'dti-gt-36', severity: 'high', title: 'Debt-to-income is above 36%', detail: 'Debt payments exceed a common underwriting ceiling.', value: debtToIncomePercent, threshold: 36 },
    { id: 'dti-gt-43', severity: 'high', title: 'Debt-to-income is above 43%', detail: 'Debt payments indicate high leverage risk.', value: debtToIncomePercent, threshold: 43 },
    { id: 'dti-gt-50', severity: 'high', title: 'Debt-to-income is above 50%', detail: 'Debt payments indicate severe affordability risk.', value: debtToIncomePercent, threshold: 50 },
    { id: 'util-total-gt-30', severity: 'high', title: 'Total credit utilization is above 30%', detail: `Portfolio utilization is ${creditUtilizationPercent.toFixed(2)}% against a 30% threshold.`, value: creditUtilizationPercent, threshold: 30 },
    { id: 'savings-lt-20', severity: 'low', title: 'Savings rate is below 20%', detail: 'Savings rate is below strong accumulation pace.', value: monthlySummary.savingsRatePercent, threshold: 20, lessThan: true },
    { id: 'savings-lt-10', severity: 'medium', title: 'Savings rate is below 10%', detail: 'Savings rate may be insufficient for resilience goals.', value: monthlySummary.savingsRatePercent, threshold: 10, lessThan: true },
    { id: 'savings-lt-0', severity: 'high', title: 'Savings rate is negative', detail: 'Expenses currently exceed income.', value: monthlySummary.savingsRatePercent, threshold: 0, lessThan: true },
    { id: 'efund-lt-6', severity: 'low', title: 'Emergency fund below 6 months', detail: 'Coverage is below the ideal resilience target.', value: emergencyFundMonths, threshold: 6, lessThan: true },
    { id: 'efund-lt-3', severity: 'medium', title: 'Emergency fund below 3 months', detail: 'Coverage is below baseline safety target.', value: emergencyFundMonths, threshold: 3, lessThan: true },
    { id: 'efund-lt-1', severity: 'high', title: 'Emergency fund below 1 month', detail: 'Coverage is critically low for disruptions.', value: emergencyFundMonths, threshold: 1, lessThan: true },
    { id: 'runway-debt-lt-3', severity: 'high', title: 'Cash runway including debt is below 3 months', detail: 'Liquid savings coverage against expenses plus debt minimums is low.', value: cashRunwayWithDebtMonths, threshold: 3, lessThan: true },
    { id: 'runway-debt-lt-1', severity: 'high', title: 'Cash runway including debt is below 1 month', detail: 'Any disruption can force borrowing or missed obligations.', value: cashRunwayWithDebtMonths, threshold: 1, lessThan: true },
    { id: 'runway-expense-lt-1', severity: 'high', title: 'Liquid cash runway is below 1 month of expenses', detail: 'Cash-equivalent holdings cover less than one month of expenses.', value: cashRunwayExpensesOnlyMonths, threshold: 1, lessThan: true },
    { id: 'cash-equivalents-lt-1000', severity: 'high', title: 'Cash equivalents are below $1,000', detail: 'Low immediate liquidity increases disruption risk.', value: totalLiquidCashEquivalents, threshold: 1000, lessThan: true },
    { id: 'dsc-lt-2', severity: 'low', title: 'Debt service coverage below 2.0', detail: 'Income buffer over debt minimums is thinning.', value: debtServiceCoverageRatio, threshold: 2, lessThan: true },
    { id: 'dsc-lt-1.5', severity: 'medium', title: 'Debt service coverage below 1.5', detail: 'Debt minimums absorb substantial income.', value: debtServiceCoverageRatio, threshold: 1.5, lessThan: true },
    { id: 'dsc-lt-1.2', severity: 'high', title: 'Debt service coverage below 1.2', detail: 'Income has little room over mandatory debt payments.', value: debtServiceCoverageRatio, threshold: 1.2, lessThan: true },
    { id: 'liq-lt-1', severity: 'medium', title: 'Liquidity ratio below 1.0', detail: 'Assets are below total liabilities.', value: liquidityRatio, threshold: 1, lessThan: true },
    { id: 'liq-lt-0.5', severity: 'high', title: 'Liquidity ratio below 0.5', detail: 'Assets cover less than half of liabilities.', value: liquidityRatio, threshold: 0.5, lessThan: true },
    { id: 'expense-ratio-gt-80', severity: 'medium', title: 'Expense ratio above 80%', detail: 'Most income is consumed by expenses before debt.', value: (monthlySummary.totalExpenses / safeIncomeDivisor) * 100, threshold: 80 },
    { id: 'expense-ratio-gt-100', severity: 'high', title: 'Expense ratio above 100%', detail: 'Expenses exceed income before debt obligations.', value: (monthlySummary.totalExpenses / safeIncomeDivisor) * 100, threshold: 100 },
    { id: 'liability-ratio-gt-2x-income', severity: 'medium', title: 'Liabilities exceed 2x yearly income', detail: 'Leverage relative to income is elevated.', value: liabilitiesTotal / (monthlySummary.totalIncome * 12 || 1), threshold: 2 },
    { id: 'liability-ratio-gt-3x-income', severity: 'high', title: 'Liabilities exceed 3x yearly income', detail: 'Leverage relative to income is high risk.', value: liabilitiesTotal / (monthlySummary.totalIncome * 12 || 1), threshold: 3 },
    { id: 'liability-ratio-gt-4x-income', severity: 'high', title: 'Liabilities exceed 4x yearly income', detail: 'Leverage relative to income is severe.', value: liabilitiesTotal / (monthlySummary.totalIncome * 12 || 1), threshold: 4 },
    { id: 'payment-burden-gt-15', severity: 'low', title: 'Debt payment burden above 15%', detail: 'Mandatory debt payments reduce flexibility.', value: debtToIncomePercent, threshold: 15 },
    { id: 'payment-burden-gt-25', severity: 'medium', title: 'Debt payment burden above 25%', detail: 'Debt payments materially compress monthly cash flow.', value: debtToIncomePercent, threshold: 25 },
    { id: 'payment-burden-gt-40', severity: 'high', title: 'Debt payment burden above 40%', detail: 'Debt payments are in stressed range.', value: debtToIncomePercent, threshold: 40 },
    { id: 'debt-minimums-vs-expenses-gt-100', severity: 'high', title: 'Debt minimums exceed monthly expenses', detail: 'Debt minimum payments are larger than monthly expenses.', value: debtMinimumsToExpensesPercent, threshold: 100 },
    { id: 'single-payment-concentration-gt-25', severity: 'medium', title: 'A single debt payment exceeds 25% of income', detail: 'One recurring payment is highly concentrated against income.', value: maxSingleDebtPaymentSharePercent, threshold: 25 },
    { id: 'fixed-cost-ratio-gt-60', severity: 'high', title: 'Fixed-cost ratio is above 60%', detail: 'High fixed obligations reduce flexibility during shocks.', value: fixedCostRatioPercent, threshold: 60 },
    { id: 'income-concentration-gt-80', severity: 'medium', title: 'Income is concentrated above 80% in one source', detail: 'A single source dominates total income.', value: topIncomeSourceSharePercent, threshold: 80 },
    { id: 'income-concentration-gt-90', severity: 'high', title: 'Income is highly concentrated in one source', detail: 'A single-source income disruption would materially impact the plan.', value: topIncomeSourceSharePercent, threshold: 90 },
    { id: 'secured-ltv-gt-80', severity: 'medium', title: 'Secured debt LTV is above 80%', detail: 'Collateral cushion is thinning on secured balances.', value: securedDebtLoanToValuePercent, threshold: 80 },
    { id: 'secured-ltv-gt-100', severity: 'high', title: 'Secured debt LTV is above 100%', detail: 'Secured balances exceed tracked collateral market value.', value: securedDebtLoanToValuePercent, threshold: 100 },
    { id: 'income-volatility-gt-20', severity: 'low', title: 'Cash-flow swing proxy above 20%', detail: 'Surplus/deficit swing indicates unstable cash profile.', value: incomeVolatilityProxyPercent, threshold: 20 },
    { id: 'income-volatility-gt-40', severity: 'medium', title: 'Cash-flow swing proxy above 40%', detail: 'Cash profile variability may disrupt planning.', value: incomeVolatilityProxyPercent, threshold: 40 },
    { id: 'income-volatility-gt-60', severity: 'high', title: 'Cash-profile variability is severe', detail: 'Cash profile variability is severe.', value: incomeVolatilityProxyPercent, threshold: 60 },
    { id: 'util-mismatch-gt-5', severity: 'high', title: 'Utilization mismatch across sections', detail: 'Credit utilization inputs disagree between credit and card sources.', value: creditUtilizationMismatchPercent, threshold: 5 },
    { id: 'stale-balance-gt-0', severity: 'medium', title: 'Some liability balances are stale', detail: 'At least one liability balance is older than 45 days or missing timestamps.', value: staleBalanceCountOver45Days, threshold: 0 },
    { id: 'stale-balance-gt-3', severity: 'high', title: 'Multiple liability balances are stale', detail: 'Several liabilities are stale; forecast confidence is low.', value: staleBalanceCountOver45Days, threshold: 3 },
    { id: 'forecast-fields-missing-gt-0', severity: 'medium', title: 'Missing debt fields for forecasting', detail: 'One or more liabilities are missing amount, minimum payment, or APR.', value: forecastingFieldMissingCount, threshold: 0 }
  ]

  const triggeredThresholdChecks = thresholdChecks.filter((check) => (check.lessThan ? check.value < check.threshold : check.value > check.threshold))
  const bestTriggeredCheckByFamily = new Map()
  for (const check of triggeredThresholdChecks) {
    const familyId = check.id.replace(/-(gt|lt)-.*/, '')
    const existing = bestTriggeredCheckByFamily.get(familyId)
    if (!existing) {
      bestTriggeredCheckByFamily.set(familyId, check)
      continue
    }
    // Critical path: show only the closest triggered threshold per family to avoid duplicate tier flags.
    const isBetterCandidate = check.lessThan
      ? check.threshold < existing.threshold
      : check.threshold > existing.threshold
    if (isBetterCandidate) bestTriggeredCheckByFamily.set(familyId, check)
  }
  for (const check of bestTriggeredCheckByFamily.values()) {
    pushFinding(check.id, check.severity, check.title, check.detail, check.value)
  }

  const collectionDrilldownChecks = [
    ...creditCardRows.map((creditItem, creditIndex) => {
      const itemName = typeof creditItem.item === 'string' ? creditItem.item : `Credit ${creditIndex + 1}`
      const amount = typeof creditItem.currentBalance === 'number' ? creditItem.currentBalance : 0
      const limit = typeof creditItem.maxCapacity === 'number' ? creditItem.maxCapacity : 0
      const utilization = limit > 0 ? (amount / limit) * 100 : 0
      return { id: `credit-util-item-${creditIndex}`, severity: utilization > 80 ? 'high' : 'medium', title: `${itemName} card utilization is elevated`, detail: `${itemName} utilization is ${utilization.toFixed(2)}%.`, value: utilization, threshold: utilization > 80 ? 80 : 50 }
    }),
    ...currentCollectionsState.debts.map((debtItem, debtIndex) => {
      const itemName = typeof debtItem.item === 'string' ? debtItem.item : `Debt ${debtIndex + 1}`
      const amount = typeof debtItem.amount === 'number' ? debtItem.amount : 0
      const shareOfTotalLiabilitiesPercent = (amount / safeLiabilitiesDivisor) * 100
      return { id: `debt-concentration-${debtIndex}`, severity: shareOfTotalLiabilitiesPercent > 60 ? 'high' : (shareOfTotalLiabilitiesPercent > 35 ? 'medium' : 'low'), title: `${itemName} concentration is high`, detail: `${itemName} is a concentrated share of liabilities.`, value: shareOfTotalLiabilitiesPercent, threshold: 35 }
    }),
    ...currentCollectionsState.loans.map((loanItem, loanIndex) => {
      const itemName = typeof loanItem.item === 'string' ? loanItem.item : `Loan ${loanIndex + 1}`
      const minimumPayment = typeof loanItem.minimumPayment === 'number' ? loanItem.minimumPayment : 0
      const paymentShareOfIncomePercent = (minimumPayment / safeIncomeDivisor) * 100
      return { id: `loan-payment-share-${loanIndex}`, severity: paymentShareOfIncomePercent > 20 ? 'high' : (paymentShareOfIncomePercent > 10 ? 'medium' : 'low'), title: `${itemName} payment share is high`, detail: `${itemName} minimum payment is elevated relative to income.`, value: paymentShareOfIncomePercent, threshold: 10 }
    })
  ]

  for (const check of collectionDrilldownChecks) {
    if (check.value > check.threshold) pushFinding(check.id, check.severity, check.title, check.detail, check.value)
  }

  if (operatingCashFlow < 0) {
    pushFinding(
      'negative-operating-cashflow',
      'high',
      'Negative operating cash flow',
      'Monthly income is below expenses plus debt minimums.',
      operatingCashFlow
    )
  }
  if (discretionaryBuffer < 0) {
    pushFinding(
      'discretionary-buffer-lt-0',
      'high',
      'Discretionary buffer is negative',
      'There is no discretionary capacity after expenses and debt minimums.',
      discretionaryBuffer
    )
  } else if (discretionaryBuffer < 500) {
    pushFinding(
      'discretionary-buffer-lt-500',
      'medium',
      'Discretionary buffer is below $500',
      'Small surprise expenses can still destabilize the month.',
      discretionaryBuffer
    )
  }
  if (maxRevolvingAprExposure > 25) {
    pushFinding(
      'apr-exposure-gt-25',
      'high',
      'High APR exposure on revolving debt',
      'At least one revolving balance above $1,000 has APR above 25%.',
      maxRevolvingAprExposure
    )
  }
  if (unsecuredOrUnderwaterSecuredCount > 0) {
    pushFinding(
      'secured-specific-ltv-risk',
      'high',
      'One or more secured debts are near/above risk LTV thresholds',
      'Mortgage above 90% LTV or non-mortgage secured debt above 100% LTV detected.',
      unsecuredOrUnderwaterSecuredCount
    )
  }
  if (projectedMonthEndCashflow < 0) {
    pushFinding(
      'forecast-month-end-cash-lt-0',
      'high',
      'Projected month-end cash is negative',
      'Projected month-end cashflow falls below zero with current obligations.',
      projectedMonthEndCashflow
    )
  }
  const unrealizedIncomePlaceholderCount = currentCollectionsState.income.reduce((runningCount, incomeItem) => {
    const amount = typeof incomeItem.amount === 'number' ? incomeItem.amount : 0
    const itemName = typeof incomeItem.item === 'string' ? incomeItem.item.trim() : ''
    if (!itemName) return runningCount
    return amount === 0 ? runningCount + 1 : runningCount
  }, 0)
  if (unrealizedIncomePlaceholderCount > 0) {
    pushFinding(
      'income-placeholders-gt-0',
      'medium',
      'One or more income sources are unrealized ($0)',
      'Income assumptions include one or more $0 rows that may not be active.',
      unrealizedIncomePlaceholderCount
    )
  }
  const activeGoalsCount = currentCollectionsState.goals.reduce((runningTotal, goalItem) => {
    const status = typeof goalItem.status === 'string' ? goalItem.status.toLowerCase() : ''
    return status === 'in progress' ? runningTotal + 1 : runningTotal
  }, 0)
  if (activeGoalsCount === 0) {
    pushFinding(
      'no-active-goals',
      'medium',
      'No active goals in progress',
      'Without active goals, budget-to-action alignment is likely weak.',
      0
    )
  }

  const sortedFindings = [...findings].sort((leftFinding, rightFinding) => {
    const severityRank = { high: 3, medium: 2, low: 1 }
    const leftRank = severityRank[leftFinding.severity]
    const rightRank = severityRank[rightFinding.severity]
    if (leftRank !== rightRank) return rightRank - leftRank
    if (leftFinding.metricValue === rightFinding.metricValue) return leftFinding.id.localeCompare(rightFinding.id)
    return Math.abs(rightFinding.metricValue) - Math.abs(leftFinding.metricValue)
  })

  // Critical path: cap risk rows so UI stays stable while still supporting many checks.
  return [sortedFindings.slice(0, 50), null]
}

/**
 * Builds planning insights that convert current metrics into executable monthly plans.
 * Covers budget-vs-actual, recurring baseline, layered forecast, debt waterfall,
 * goal templates, scenario outcomes, risk provenance, and reconcile readiness.
 * @param {{income: Array<Record<string, unknown>>, expenses: Array<Record<string, unknown>>, assets: Array<Record<string, unknown>>, debts: Array<Record<string, unknown>>, credit: Array<Record<string, unknown>>, loans: Array<Record<string, unknown>>, goals: Array<Record<string, unknown>>}} currentCollectionsState
 * @returns {Result<{
 *  budgetVsActualRows: Array<{category: string, planned: number, actual: number, variance: number, runRateMonthEnd: number}>,
 *  recurringBaselineRows: Array<{category: string, amount: number, cadence: string, expectedNextMonthAmount: number}>,
 *  forecast: {committed: number, planned: number, optional: number, projectedMonthEndCashflow: number, projectedSavingsContribution: number, projectedRiskLevel: 'low'|'medium'|'high'},
 *  amortizationRows: Array<{id: string, item: string, startBalance: number, payment: number, interestRatePercent: number, remainingPayments: number, projectedPayoffMonths: number}>,
 *  waterfallRows: Array<{month: number, paymentMinimums: number, paymentExtra: number, interestPortion: number, principalPortion: number, endingBalance: number}>,
 *  goalTemplateRows: Array<{id: string, title: string, targetAmount: number, targetMonths: number, requiredMonthlyContribution: number, tradeoffDebtPaydownReduction: number}>,
 *  scenarioRows: Array<{id: string, label: string, monthlyDelta: number, debtFreeMonthsDelta: number, runwayMonths: number}>,
 *  riskProvenanceRows: Array<{id: string, title: string, formula: string, threshold: string, rawInputs: string, dataCompletenessPercent: number}>,
 *  reconcileChecklistRows: Array<{id: string, label: string, status: 'ready'|'needs_review', detail: string}>
 * }>}
 */
export function calculatePlanningCockpitInsightsFromCollectionsState(currentCollectionsState) {
  const requiredCollectionNames = /** @type {Array<'income'|'expenses'|'assets'|'debts'|'credit'|'loans'|'goals'>} */ (
    ['income', 'expenses', 'assets', 'debts', 'credit', 'loans', 'goals']
  )
  for (const collectionName of requiredCollectionNames) {
    if (!Array.isArray(currentCollectionsState[collectionName])) {
      const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
        'VALIDATION',
        `${collectionName} must be an array`,
        true,
        { collectionName }
      )
      if (createErrorFailure) return [null, createErrorFailure]
      return [null, errorValue]
    }
  }

  /** @param {Array<Record<string, unknown>>} rows @param {string} fieldName @returns {number} */
  const sumField = (rows, fieldName) => rows.reduce((runningTotal, rowItem) => (
    runningTotal + (typeof rowItem[fieldName] === 'number' ? Number(rowItem[fieldName]) : 0)
  ), 0)

  const totalIncome = sumField(currentCollectionsState.income, 'amount')
  const totalExpenses = sumField(currentCollectionsState.expenses, 'amount')
  const recurringRows = currentCollectionsState.expenses.filter((rowItem) => {
    const category = typeof rowItem.category === 'string' ? rowItem.category.toLowerCase() : ''
    return ['hoa', 'utilities', 'internet', 'phone', 'insurance', 'debt payment', 'subscriptions', 'services'].includes(category) ||
      (typeof rowItem.item === 'string' && ['hoa', 'internet', 'phone', 'insurance', 'services', 'debts'].includes(rowItem.item.toLowerCase()))
  })

  const budgetByCategory = new Map()
  for (const expenseItem of currentCollectionsState.expenses) {
    const category = typeof expenseItem.category === 'string' && expenseItem.category.trim().length > 0
      ? expenseItem.category.trim()
      : 'Uncategorized'
    const amount = typeof expenseItem.amount === 'number' ? expenseItem.amount : 0
    const previousBudget = budgetByCategory.get(category) ?? 0
    budgetByCategory.set(category, previousBudget + amount * 1.05)
  }
  const actualByCategory = new Map()
  for (const expenseItem of currentCollectionsState.expenses) {
    const category = typeof expenseItem.category === 'string' && expenseItem.category.trim().length > 0
      ? expenseItem.category.trim()
      : 'Uncategorized'
    const amount = typeof expenseItem.amount === 'number' ? expenseItem.amount : 0
    const previousActual = actualByCategory.get(category) ?? 0
    actualByCategory.set(category, previousActual + amount)
  }
  const now = new Date()
  const dayOfMonth = Math.max(1, now.getDate())
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const runRateMultiplier = daysInMonth / dayOfMonth
  const budgetVsActualRows = [...new Set([...budgetByCategory.keys(), ...actualByCategory.keys()])].map((category) => {
    const planned = budgetByCategory.get(category) ?? 0
    const actual = actualByCategory.get(category) ?? 0
    const variance = planned - actual
    return { category, planned, actual, variance, runRateMonthEnd: actual * runRateMultiplier }
  }).sort((leftRow, rightRow) => Math.abs(rightRow.variance) - Math.abs(leftRow.variance))

  const recurringBaselineRows = recurringRows.map((rowItem, rowIndex) => {
    const amount = typeof rowItem.amount === 'number' ? rowItem.amount : 0
    const category = typeof rowItem.category === 'string' && rowItem.category.trim().length > 0 ? rowItem.category : 'Recurring'
    return {
      category,
      amount,
      cadence: 'monthly',
      expectedNextMonthAmount: amount,
      id: `recurring-${rowIndex + 1}`
    }
  })

  const committed = sumField(currentCollectionsState.debts, 'minimumPayment') +
    sumField(currentCollectionsState.credit, 'minimumPayment') +
    sumField(currentCollectionsState.loans, 'minimumPayment') +
    recurringBaselineRows.reduce((runningTotal, rowItem) => runningTotal + rowItem.amount, 0)
  const planned = budgetVsActualRows.reduce((runningTotal, rowItem) => runningTotal + Math.max(0, rowItem.planned), 0)
  const optional = Math.max(0, totalExpenses - committed)
  const projectedMonthEndCashflow = totalIncome - committed - optional
  const projectedSavingsContribution = Math.max(0, totalIncome - planned)
  const projectedRiskLevel = projectedMonthEndCashflow >= 1000 ? 'low' : (projectedMonthEndCashflow >= 0 ? 'medium' : 'high')

  const forecast = {
    committed,
    planned,
    optional,
    projectedMonthEndCashflow,
    projectedSavingsContribution,
    projectedRiskLevel
  }

  const liabilities = [...currentCollectionsState.debts, ...currentCollectionsState.credit, ...currentCollectionsState.loans]
  const amortizationRows = liabilities.map((rowItem, rowIndex) => {
    const startBalance = typeof rowItem.amount === 'number' ? rowItem.amount : 0
    const payment = typeof rowItem.minimumPayment === 'number' ? rowItem.minimumPayment : 0
    const interestRatePercent = typeof rowItem.interestRatePercent === 'number' ? rowItem.interestRatePercent : 0
    const [estimatedMonths] = calculateEstimatedPayoffMonthsFromBalancePaymentAndInterestRate(startBalance, Math.max(payment, 1), interestRatePercent)
    const remainingPayments = typeof rowItem.remainingPayments === 'number' && rowItem.remainingPayments > 0 ? rowItem.remainingPayments : Math.ceil(Number(estimatedMonths ?? 0))
    return {
      id: typeof rowItem.id === 'string' ? rowItem.id : `amort-${rowIndex + 1}`,
      item: typeof rowItem.item === 'string' ? rowItem.item : `Liability ${rowIndex + 1}`,
      startBalance,
      payment,
      interestRatePercent,
      remainingPayments,
      projectedPayoffMonths: Number(estimatedMonths ?? 0)
    }
  })

  let runningBalance = amortizationRows.reduce((runningTotal, rowItem) => runningTotal + rowItem.startBalance, 0)
  const totalMinimums = amortizationRows.reduce((runningTotal, rowItem) => runningTotal + rowItem.payment, 0)
  const extraPaymentPool = Math.max(0, totalIncome - totalExpenses) * 0.5
  const weightedApr = amortizationRows.reduce((runningTotal, rowItem) => runningTotal + (rowItem.startBalance * rowItem.interestRatePercent), 0) / Math.max(1, runningBalance)
  const monthlyInterestRate = weightedApr / 100 / 12
  const waterfallRows = []
  for (let monthIndex = 1; monthIndex <= 12; monthIndex += 1) {
    const interestPortion = runningBalance * monthlyInterestRate
    const totalPayment = totalMinimums + extraPaymentPool
    const principalPortion = Math.max(0, totalPayment - interestPortion)
    runningBalance = Math.max(0, runningBalance - principalPortion)
    waterfallRows.push({
      month: monthIndex,
      paymentMinimums: totalMinimums,
      paymentExtra: extraPaymentPool,
      interestPortion,
      principalPortion,
      endingBalance: runningBalance
    })
  }

  const sixMonthExpensesTarget = totalExpenses * 6
  const totalCurrentSavings = currentCollectionsState.assets.reduce((runningTotal, rowItem) => {
    const isSavings = typeof rowItem.recordType === 'string' ? rowItem.recordType === 'savings' : false
    const amount = typeof rowItem.amount === 'number' ? rowItem.amount : 0
    return isSavings ? runningTotal + amount : runningTotal
  }, 0)
  const goalTemplateRows = [
    { id: 'template-emergency-fund', title: 'Emergency Fund', targetAmount: sixMonthExpensesTarget, targetMonths: 18 },
    { id: 'template-payoff-credit', title: 'Kill Highest APR Credit', targetAmount: sumField(currentCollectionsState.credit, 'amount'), targetMonths: 12 },
    { id: 'template-down-payment', title: 'Down Payment Fund', targetAmount: 30000, targetMonths: 36 },
    { id: 'template-travel-fund', title: 'Travel Fund', targetAmount: 8000, targetMonths: 18 }
  ].map((templateItem) => {
    const requiredMonthlyContribution = Math.max(0, (templateItem.targetAmount - (templateItem.id === 'template-emergency-fund' ? totalCurrentSavings : 0)) / Math.max(1, templateItem.targetMonths))
    return {
      ...templateItem,
      requiredMonthlyContribution,
      tradeoffDebtPaydownReduction: requiredMonthlyContribution
    }
  })

  const baseDebtMonths = amortizationRows.reduce((runningMax, rowItem) => Math.max(runningMax, rowItem.projectedPayoffMonths), 0)
  const baseRunwayMonths = totalExpenses > 0 ? totalCurrentSavings / totalExpenses : 0
  const scenarioRows = [
    { id: 'scenario-extra-card-300', label: 'Pay +$300/mo to highest APR debt', monthlyDelta: -300 },
    { id: 'scenario-cut-groceries-200', label: 'Cut groceries by $200/mo', monthlyDelta: 200 },
    { id: 'scenario-income-drop-20', label: 'Income drops by 20%', monthlyDelta: -totalIncome * 0.2 }
  ].map((scenarioItem) => {
    const debtFreeMonthsDelta = scenarioItem.monthlyDelta < 0 ? Math.abs(scenarioItem.monthlyDelta) / 40 : -scenarioItem.monthlyDelta / 40
    const runwayMonths = totalExpenses > 0 ? totalCurrentSavings / Math.max(1, totalExpenses - scenarioItem.monthlyDelta) : 0
    return {
      ...scenarioItem,
      debtFreeMonthsDelta,
      runwayMonths: Math.max(0, runwayMonths)
    }
  }).map((scenarioItem) => ({
    ...scenarioItem,
    debtFreeMonthsDelta: Math.max(0, baseDebtMonths + scenarioItem.debtFreeMonthsDelta) - baseDebtMonths
  }))

  const [riskFindings, riskFindingsError] = extractFinancialRiskFindingsFromCurrentCollectionsState(currentCollectionsState)
  if (riskFindingsError || !riskFindings) return [null, riskFindingsError]
  const riskProvenanceRows = riskFindings.slice(0, 10).map((findingItem) => {
    const thresholdText = findingItem.id.includes('util') ? '> 30%' : (findingItem.id.includes('dti') ? '> 36%' : 'custom threshold')
    const rawInputs = `metricValue=${Number(findingItem.metricValue ?? 0).toFixed(2)}`
    return {
      id: findingItem.id,
      title: findingItem.title,
      formula: 'computed metric compared to threshold',
      threshold: thresholdText,
      rawInputs,
      dataCompletenessPercent: 100
    }
  })

  const reconcileChecklistRows = [
    {
      id: 'reconcile-recurring',
      label: 'Recurring bills confirmed',
      status: recurringBaselineRows.length > 0 ? 'ready' : 'needs_review',
      detail: recurringBaselineRows.length > 0 ? `${recurringBaselineRows.length} recurring items available.` : 'No recurring baseline rows detected.'
    },
    {
      id: 'reconcile-credit',
      label: 'Credit balances updated this month',
      status: currentCollectionsState.creditCards?.length > 0 ? 'ready' : 'needs_review',
      detail: currentCollectionsState.creditCards?.length > 0 ? 'Credit account rows are present.' : 'No credit card rows found.'
    },
    {
      id: 'reconcile-month-close',
      label: 'Month can be closed',
      status: projectedMonthEndCashflow >= 0 ? 'ready' : 'needs_review',
      detail: projectedMonthEndCashflow >= 0 ? 'Projected month-end cashflow is non-negative.' : 'Projected month-end cashflow is negative.'
    }
  ]

  return [ {
    budgetVsActualRows,
    recurringBaselineRows,
    forecast,
    amortizationRows,
    waterfallRows,
    goalTemplateRows,
    scenarioRows,
    riskProvenanceRows,
    reconcileChecklistRows
  }, null ]
}

/**
 * Builds a canonical unified records feed from all financial collections.
 * This feed is designed to be the single source-of-truth for records views.
 * @param {{income: Array<Record<string, unknown>>, expenses: Array<Record<string, unknown>>, assets: Array<Record<string, unknown>>, debts: Array<Record<string, unknown>>, credit: Array<Record<string, unknown>>, loans: Array<Record<string, unknown>>, creditCards: Array<Record<string, unknown>>}} currentCollectionsState
 * @returns {Result<Array<Record<string, unknown>>>}
 */
export function calculateUnifiedFinancialRecordsSourceOfTruthFromCollectionsState(currentCollectionsState) {
  const requiredCollectionNames = /** @type {Array<'income'|'expenses'|'assets'|'debts'|'credit'|'loans'|'creditCards'>} */ (
    ['income', 'expenses', 'assets', 'debts', 'credit', 'loans', 'creditCards']
  )
  for (const collectionName of requiredCollectionNames) {
    if (!Array.isArray(currentCollectionsState[collectionName])) {
      const [errorValue, createErrorFailure] = createApplicationErrorWithKindMessageAndRecoverability(
        'VALIDATION',
        `${collectionName} must be an array`,
        true,
        { collectionName }
      )
      if (createErrorFailure) return [null, createErrorFailure]
      return [null, errorValue]
    }
  }

  const unifiedRows = [
    ...currentCollectionsState.income.map((recordItem) => ({
      ...recordItem,
      sourceCollectionName: 'income',
      recordType: 'income',
      signedAmount: typeof recordItem.amount === 'number' ? recordItem.amount : 0
    })),
    ...currentCollectionsState.expenses.map((recordItem) => ({
      ...recordItem,
      sourceCollectionName: 'expenses',
      recordType: 'expense',
      signedAmount: typeof recordItem.amount === 'number' ? -recordItem.amount : 0
    })),
    ...currentCollectionsState.assets
      .filter((recordItem) => (typeof recordItem.recordType === 'string' ? recordItem.recordType === 'savings' : false))
      .map((recordItem) => ({
        ...recordItem,
        sourceCollectionName: 'assets',
        recordType: 'savings',
        // Critical path: savings contributions are transfers from monthly cashflow, not inflow.
        signedAmount: typeof recordItem.amount === 'number' ? -recordItem.amount : 0
      })),
    ...currentCollectionsState.debts.map((recordItem) => ({
      ...recordItem,
      sourceCollectionName: 'debts',
      recordType: 'debt',
      amount: typeof recordItem.minimumPayment === 'number' ? recordItem.minimumPayment : 0,
      signedAmount: typeof recordItem.minimumPayment === 'number' ? -recordItem.minimumPayment : 0
    })),
    ...currentCollectionsState.loans.map((recordItem) => ({
      ...recordItem,
      sourceCollectionName: 'loans',
      recordType: 'loan',
      amount: typeof recordItem.minimumPayment === 'number' ? recordItem.minimumPayment : 0,
      signedAmount: typeof recordItem.minimumPayment === 'number' ? -recordItem.minimumPayment : 0
    })),
    ...currentCollectionsState.credit.map((recordItem) => ({
      ...recordItem,
      sourceCollectionName: 'credit',
      recordType: 'credit',
      amount: typeof recordItem.minimumPayment === 'number' ? recordItem.minimumPayment : 0,
      signedAmount: typeof recordItem.minimumPayment === 'number' ? -recordItem.minimumPayment : 0
    })),
    ...currentCollectionsState.creditCards.map((recordItem) => ({
      ...recordItem,
      sourceCollectionName: 'creditCards',
      recordType: 'credit card',
      category: typeof recordItem.item === 'string' ? recordItem.item : '',
      amount: typeof recordItem.monthlyPayment === 'number' ? recordItem.monthlyPayment : 0,
      signedAmount: typeof recordItem.monthlyPayment === 'number' ? -recordItem.monthlyPayment : 0,
      description: typeof recordItem.description === 'string' ? recordItem.description : ''
    })),
    ...(Array.isArray(currentCollectionsState.assetHoldings) ? currentCollectionsState.assetHoldings : []).map((recordItem) => {
      const owed = typeof recordItem.assetValueOwed === 'number' ? recordItem.assetValueOwed : 0
      const market = typeof recordItem.assetMarketValue === 'number' ? recordItem.assetMarketValue : 0
      const value = market - owed
      return {
        ...recordItem,
        sourceCollectionName: 'assetHoldings',
        recordType: 'asset',
        category: typeof recordItem.item === 'string' ? recordItem.item : '',
        amount: value,
        signedAmount: 0
      }
    })
  ]

  return [unifiedRows, null]
}


