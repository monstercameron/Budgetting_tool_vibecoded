import React from 'react'
import {
  buildDefaultBudgetCollectionsStateForLocalFirstUsage,
  appendValidatedIncomeOrExpenseRecordIntoCollectionsState,
  appendValidatedGoalRecordIntoCollectionsState,
  calculateTwentyDashboardHealthMetricsFromFinancialCollections,
  calculateCurrentAndPreviousMonthSourceBreakdownFromCollectionsState,
  calculateDetailedDashboardDatapointRowsFromCurrentCollectionsState,
  calculateMonthlySavingsStorageSummaryFromCollectionsState,
  calculateEmergencyFundTrackingSummaryFromCollectionsState,
  calculateRecommendedMonthlySavingsTargetFromCollectionsState,
  calculateMonthlyIncomeExpenseSummaryFromCollectionsState,
  calculatePowerGoalsStatusFormulaSummaryFromGoalCollection,
  calculateCreditCardSummaryFormulasFromInformationCollection,
  calculateCreditCardPaymentRecommendationsFromCollectionsState,
  calculatePlanningCockpitInsightsFromCollectionsState,
  calculateNetWorthProjectionProfilesUsingThreeAggressionLayers,
  calculateUnifiedFinancialRecordsSourceOfTruthFromCollectionsState,
  updateExistingRecordInCollectionsStateByCollectionNameAndId,
  calculateEstimatedPayoffMonthsFromBalancePaymentAndInterestRate,
  calculateLoanPayoffComparisonFromBaseAndExtraPayments,
  mergeImportedCollectionsStateWithExistingStateUsingDedupKeys,
  mergeAuditTimelineEntriesUsingDedupKeys,
  renamePersonaAcrossCollectionsStateByName,
  deletePersonaAcrossCollectionsStateByName,
  buildPersonaImpactSummaryFromCollectionsStateByPersonaName
} from './core/pure.js'
import {
  loadBudgetCollectionsStateFromLocalStorageCache,
  persistBudgetCollectionsStateIntoLocalStorageCache,
  readCurrentIsoTimestampForBudgetRecordUpdates,
  persistUiPreferencesIntoLocalStorageCache,
  loadUiPreferencesFromLocalStorageCache,
  persistAuditTimelineIntoLocalStorageCache,
  loadAuditTimelineFromLocalStorageCache,
  applyThemeNameToDocumentBodyDataAttribute,
  scrollViewportToTopWithSmoothBehavior,
  copyTextToClipboardUsingBrowserApi,
  applyGlobalTextScaleMultiplierToDocumentRoot,
  computeFinancialRiskFindingsUsingBackgroundWorkerWhenAvailable,
  exportCompleteFinancialProfileAsJsonTextSnapshot,
  importCompleteFinancialProfileFromJsonTextSnapshot,
  loadSupabaseWebConfigFromLocalStorageCache,
  persistSupabaseWebConfigIntoLocalStorageCache,
  startSupabaseEmailOtpSignInWithRedirect,
  verifySupabaseEmailOtpCodeAndCreateSession,
  readSupabaseAuthenticatedUserSummary,
  signOutFromSupabaseCurrentSession,
  pushCompleteFinancialProfileIntoSupabaseForAuthenticatedUser,
  pullCompleteFinancialProfileFromSupabaseForAuthenticatedUser,
  loadFirebaseWebConfigFromLocalStorageCache,
  persistFirebaseWebConfigIntoLocalStorageCache,
  signInToFirebaseWithGooglePopup,
  signOutFromFirebaseCurrentSession,
  readFirebaseAuthenticatedUserSummary,
  pushCompleteFinancialProfileIntoFirebaseForAuthenticatedUser,
  pullCompleteFinancialProfileFromFirebaseForAuthenticatedUser
} from './core/impure.js'

const DASHBOARD_CURRENCY_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  currencySign: 'accounting',
  maximumFractionDigits: 2
})

const COMMON_BUDGET_CATEGORIES = [
  'Housing',
  'Utilities',
  'Groceries',
  'Dining',
  'Transportation',
  'Fuel',
  'Insurance',
  'Healthcare',
  'Debt Payment',
  'Savings',
  'Investments',
  'Income',
  'Entertainment',
  'Travel',
  'Education',
  'Childcare',
  'Pets',
  'Gifts',
  'Personal Care',
  'Miscellaneous'
]

const DEFAULT_PERSONA_NAMES = ['User']
const DEFAULT_PERSONA_NAME = 'User'
const DEFAULT_PERSONA_EMOJI = '🧑‍💻'
const PERSONA_EMOJI_OPTIONS = ['🧑‍💻', '👩', '👨', '👧', '👦', '👵', '👴', '🧑', '👩‍💼', '👨‍💼', '👩‍🔧', '👨‍🔧', '👩‍🏫', '👨‍🏫', '👩‍⚕️', '👨‍⚕️', '🧑‍🎓', '🧑‍🍳', '🧑‍🌾', '🧑‍🎨']

const ENABLE_FIREBASE_SYNC_UI = false

function normalizePersonaNameForDisplay(rawName) {
  const sourceName = typeof rawName === 'string' ? rawName.trim() : ''
  if (!sourceName) return DEFAULT_PERSONA_NAME
  return sourceName
    .toLowerCase()
    .split(/\s+/)
    .filter((partValue) => partValue.length > 0)
    .map((partValue) => `${partValue.slice(0, 1).toUpperCase()}${partValue.slice(1)}`)
    .join(' ')
}

function formatPersonaLabelWithEmoji(personName, emojiByName) {
  const normalizedName = normalizePersonaNameForDisplay(personName)
  const normalizedKey = normalizedName.toLowerCase()
  const resolvedEmoji = emojiByName.get(normalizedKey) ?? DEFAULT_PERSONA_EMOJI
  return `${resolvedEmoji} ${normalizedName}`
}

function buildInitialIncomeExpenseEntryFormState() {
  const todayIsoDate = new Date().toISOString().slice(0, 10)
  return {
    person: DEFAULT_PERSONA_NAME,
    customPerson: '',
    recordType: 'expense',
    amount: '',
    category: '',
    customCategory: '',
    item: '',
    minimumPayment: '',
    monthlyPayment: '',
    interestRatePercent: '',
    remainingPayments: '',
    loanStartDate: '',
    collateralAssetName: '',
    collateralAssetMarketValue: '',
    maxCapacity: '',
    currentBalance: '',
    date: todayIsoDate,
    description: ''
  }
}

function buildInitialGoalEntryFormState() {
  return { title: '', status: 'not started', timeframeMonths: '12', description: '' }
}

function buildInitialPersonaEntryFormState() {
  return { name: '', note: '', emojiPreset: DEFAULT_PERSONA_EMOJI, customEmoji: '' }
}

function buildInitialPersonaCrudFormState() {
  return {
    personaName: '',
    mode: 'edit',
    nextName: '',
    nextNote: '',
    nextEmojiPreset: DEFAULT_PERSONA_EMOJI,
    nextCustomEmoji: '',
    reassignToPersonaName: DEFAULT_PERSONA_NAME,
    deleteConfirmText: ''
  }
}

function buildInitialProfileTransferFormState() {
  return { mode: 'export', jsonText: '' }
}

function buildInitialSupabaseSyncFormState() {
  return {
    enabled: false,
    supabaseUrl: '',
    supabaseAnonKey: '',
    email: '',
    otpCode: '',
    otpPendingEmail: '',
    otpRequestedAtIso: ''
  }
}

function buildInitialSupabaseSyncStatusState() {
  return { tone: 'neutral', message: 'Supabase status idle.', detail: '' }
}

function validateSupabaseSyncConfigShapeForClientUsage(supabaseConfig) {
  if (!supabaseConfig || typeof supabaseConfig !== 'object') return [false, 'Supabase config must be an object.']
  if (supabaseConfig.enabled !== true) return [false, 'Supabase is disabled. Enable it to sign in and sync.']
  if (typeof supabaseConfig.supabaseUrl !== 'string' || supabaseConfig.supabaseUrl.trim().length === 0) return [false, 'Missing Supabase URL.']
  if (typeof supabaseConfig.supabaseAnonKey !== 'string' || supabaseConfig.supabaseAnonKey.trim().length === 0) return [false, 'Missing Supabase anon key.']
  return [true, 'Supabase config looks valid for client auth.']
}

function buildSupabaseUiStatusFromError(errorValue) {
  const safeError = errorValue && typeof errorValue === 'object' ? errorValue : {}
  const kind = typeof safeError.kind === 'string' ? safeError.kind : 'UNKNOWN'
  const rawMessage = typeof safeError.message === 'string' ? safeError.message : 'Supabase operation failed.'
  const details = safeError.details && typeof safeError.details === 'object' ? safeError.details : {}
  const detailText = (() => {
    const knownKeys = ['otpFailure', 'otpError', 'readFailure', 'writeFailure', 'insertFailure', 'upsertError', 'insertError', 'pullError']
    for (const keyName of knownKeys) {
      const value = details[keyName]
      if (value && typeof value === 'object') {
        const code = typeof value.code === 'string' ? value.code : ''
        const message = typeof value.message === 'string' ? value.message : ''
        const combined = `${code} ${message}`.trim()
        if (combined) return combined
      }
    }
    return ''
  })()
  if (kind === 'AUTH') return { tone: 'warning', message: rawMessage, detail: detailText || 'Check Supabase auth settings and use a valid email address.' }
  if (kind === 'NETWORK') return { tone: 'warning', message: rawMessage, detail: detailText || 'Check table schema and RLS policies.' }
  if (kind === 'NOT_FOUND') return { tone: 'neutral', message: rawMessage, detail: 'No remote profile exists yet for this user.' }
  return { tone: 'warning', message: rawMessage, detail: detailText || '' }
}

function buildInitialFirebaseSyncFormState() {
  return {
    enabled: false,
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: ''
  }
}

function buildInitialFirebaseSyncStatusState() {
  return { tone: 'neutral', message: 'Firebase status idle.', detail: '' }
}

function validateFirebaseSyncConfigShapeForClientUsage(firebaseConfig) {
  const config = buildFirebaseSyncConfigWithRequiredDefaults(firebaseConfig)
  if (config.enabled !== true) return [false, 'Firebase is disabled. Enable it to sign in and sync.']
  const requiredFields = [
    ['projectId', config.projectId],
    ['apiKey', config.apiKey],
    ['authDomain', config.authDomain],
    ['appId', config.appId]
  ]
  for (const [fieldName, fieldValue] of requiredFields) {
    if (typeof fieldValue !== 'string' || fieldValue.trim().length === 0) return [false, `Missing Firebase ${fieldName}.`]
  }
  if (!config.authDomain.includes('.')) return [false, 'Auth domain looks invalid.']
  if (config.projectId.includes(' ')) return [false, 'Project ID cannot contain spaces.']
  return [true, 'Firebase config looks valid for client auth.']
}

function buildFirebaseUiStatusFromError(errorValue) {
  const safeError = errorValue && typeof errorValue === 'object' ? errorValue : {}
  const kind = typeof safeError.kind === 'string' ? safeError.kind : 'UNKNOWN'
  const details = safeError.details && typeof safeError.details === 'object' ? safeError.details : {}
  const rawDetailsText = (() => {
    const popupFailure = details.popupFailure
    if (popupFailure && typeof popupFailure === 'object') {
      const popupCode = typeof popupFailure.code === 'string' ? popupFailure.code : ''
      const popupMessage = typeof popupFailure.message === 'string' ? popupFailure.message : ''
      return `${popupCode} ${popupMessage}`.trim()
    }
    return ''
  })()
  const detailCode = typeof details.popupFailureCode === 'string'
    ? details.popupFailureCode
    : (typeof details.writeFailureCode === 'string' ? details.writeFailureCode : (typeof details.readFailureCode === 'string' ? details.readFailureCode : ''))
  const detailMessage = typeof details.popupFailureMessage === 'string'
    ? details.popupFailureMessage
    : (typeof details.writeFailureMessage === 'string' ? details.writeFailureMessage : (typeof details.readFailureMessage === 'string' ? details.readFailureMessage : ''))
  const rawMessage = typeof safeError.message === 'string' ? safeError.message : 'Firebase operation failed.'
  const normalizedDetail = `${detailCode} ${detailMessage} ${rawDetailsText}`.trim()

  if (kind === 'VALIDATION') return { tone: 'warning', message: rawMessage, detail: normalizedDetail || 'Check Firebase config fields in this modal.' }
  if (kind === 'AUTH') {
    const hasConfigurationHint = normalizedDetail.toUpperCase().includes('CONFIGURATION_NOT_FOUND') || rawMessage.toUpperCase().includes('CONFIGURATION_NOT_FOUND')
    if (hasConfigurationHint) {
      return { tone: 'warning', message: 'Firebase auth configuration is missing in the project.', detail: 'Enable Google provider in Firebase Auth and add this origin in Authorized domains.' }
    }
    return { tone: 'warning', message: rawMessage, detail: normalizedDetail || 'Complete Google sign-in and auth setup in Firebase Console.' }
  }
  if (kind === 'NETWORK') return { tone: 'warning', message: rawMessage, detail: normalizedDetail || 'Check Firestore rules and network access.' }
  return { tone: 'warning', message: rawMessage, detail: normalizedDetail }
}

function buildFirebaseSyncConfigWithRequiredDefaults(rawConfig) {
  const defaults = buildInitialFirebaseSyncFormState()
  const nextConfig = { ...defaults, ...(rawConfig || {}) }
  return {
    ...nextConfig,
    enabled: nextConfig.enabled === true,
    apiKey: typeof nextConfig.apiKey === 'string' && nextConfig.apiKey.trim().length > 0 ? nextConfig.apiKey.trim() : defaults.apiKey,
    authDomain: typeof nextConfig.authDomain === 'string' && nextConfig.authDomain.trim().length > 0 ? nextConfig.authDomain.trim() : defaults.authDomain,
    projectId: typeof nextConfig.projectId === 'string' && nextConfig.projectId.trim().length > 0 ? nextConfig.projectId.trim() : defaults.projectId,
    appId: typeof nextConfig.appId === 'string' && nextConfig.appId.trim().length > 0 ? nextConfig.appId.trim() : defaults.appId,
    storageBucket: typeof nextConfig.storageBucket === 'string' && nextConfig.storageBucket.trim().length > 0 ? nextConfig.storageBucket.trim() : defaults.storageBucket,
    messagingSenderId: typeof nextConfig.messagingSenderId === 'string' && nextConfig.messagingSenderId.trim().length > 0 ? nextConfig.messagingSenderId.trim() : defaults.messagingSenderId
  }
}

function buildInitialAssetHoldingEntryFormState() {
  const todayIsoDate = new Date().toISOString().slice(0, 10)
  return { person: DEFAULT_PERSONA_NAME, customPerson: '', item: '', assetValueOwed: '', assetMarketValue: '', description: '', date: todayIsoDate }
}

function buildInitialLoanCalculatorFormState() {
  return {
    selectedLoanKey: '',
    principalBalance: '10000',
    annualInterestRatePercent: '12',
    baseMonthlyPayment: '300',
    extraMonthlyPayment: '100'
  }
}

function buildInitialEditRecordFormState() {
  return {
    collectionName: '',
    recordId: '',
    person: '',
    customPerson: '',
    item: '',
    category: '',
    customCategory: '',
    amount: '',
    minimumPayment: '',
    interestRatePercent: '',
    remainingPayments: '',
    loanStartDate: '',
    collateralAssetName: '',
    collateralAssetMarketValue: '',
    creditLimit: '',
    maxCapacity: '',
    currentBalance: '',
    monthlyPayment: '',
    assetValueOwed: '',
    assetMarketValue: '',
    date: '',
    description: ''
  }
}

function buildInitialRecordNotesFormState() {
  return {
    collectionName: '',
    recordId: '',
    recordLabel: '',
    notes: ''
  }
}

function readHasAnyMeaningfulFinancialRowsInCollections(collectionsState) {
  if (!collectionsState || typeof collectionsState !== 'object') return false
  const collectionNames = ['income', 'expenses', 'assets', 'assetHoldings', 'debts', 'credit', 'creditCards', 'loans']
  return collectionNames.some((collectionName) => Array.isArray(collectionsState[collectionName]) && collectionsState[collectionName].length > 0)
}

function buildEmptyBudgetCollectionsStateForHardReset() {
  return {
    income: [],
    expenses: [],
    assets: [],
    assetHoldings: [],
    debts: [],
    credit: [],
    creditCards: [],
    loans: [],
    goals: [],
    personas: [{ id: `persona-reset-${Date.now()}`, name: DEFAULT_PERSONA_NAME, emoji: DEFAULT_PERSONA_EMOJI, note: '', updatedAt: new Date().toISOString() }],
    notes: [],
    schemaVersion: 2
  }
}

const DEFAULT_TABLE_SORT_STATE = {
  goals: { key: 'timeframeMonths', direction: 'asc' },
  debts: { key: 'amount', direction: 'desc' },
  credit: { key: 'currentBalance', direction: 'desc' },
  assets: { key: 'value', direction: 'desc' },
  savings: { key: 'balance', direction: 'desc' },
  detailed: { key: 'metric', direction: 'asc' },
  records: { key: 'updatedAt', direction: 'desc' }
}

const SUPABASE_PROVISIONING_SQL_SCRIPT = `create table if not exists public.profile_current (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile_payload jsonb not null,
  saved_at_iso text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_history (
  id bigint generated by default as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_payload jsonb not null,
  saved_at_iso text not null,
  created_at timestamptz not null default now()
);

alter table public.profile_current enable row level security;
alter table public.profile_history enable row level security;

drop policy if exists profile_current_select_own on public.profile_current;
drop policy if exists profile_current_upsert_own on public.profile_current;
drop policy if exists profile_current_update_own on public.profile_current;
drop policy if exists profile_history_select_own on public.profile_history;
drop policy if exists profile_history_insert_own on public.profile_history;

create policy profile_current_select_own on public.profile_current
for select using (auth.uid() = user_id);

create policy profile_current_upsert_own on public.profile_current
for insert with check (auth.uid() = user_id);

create policy profile_current_update_own on public.profile_current
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy profile_history_select_own on public.profile_history
for select using (auth.uid() = user_id);

create policy profile_history_insert_own on public.profile_history
for insert with check (auth.uid() = user_id);`

function formatCurrencyValueForDashboard(value) {
  return DASHBOARD_CURRENCY_FORMATTER.format(value)
}

function formatSignedCurrencyDeltaForMetadata(value) {
  const signPrefix = value > 0 ? '+' : ''
  return `${signPrefix}${formatCurrencyValueForDashboard(value)}`
}

function formatDashboardDatapointValueByFormat(value, valueFormat) {
  if (valueFormat === 'currency') return formatCurrencyValueForDashboard(value)
  if (valueFormat === 'percent') return `${value.toFixed(2)}%`
  if (valueFormat === 'duration') return `${value.toFixed(1)} months`
  return `${Math.round(value)}`
}

function formatPlainNumericValueForDashboard(value, valueFormat) {
  if (valueFormat === 'count') return `${Math.round(value)}`
  return value.toFixed(2)
}

function formatProjectedPayoffDateFromMonthsOffset(monthsOffset) {
  if (!Number.isFinite(monthsOffset) || monthsOffset <= 0) return '-'
  if (monthsOffset >= 9999) return 'Not reachable'
  const projectedDate = new Date()
  projectedDate.setMonth(projectedDate.getMonth() + Math.ceil(monthsOffset))
  return projectedDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short' })
}

function renderIconGlyphForAction(actionName) {
  if (actionName === 'edit') return 'E'
  if (actionName === 'notes') return 'N'
  if (actionName === 'delete') return '🗑'
  return '•'
}

const NUMERIC_SORT_KEYS = new Set([
  'amount',
  'minimumPayment',
  'interestRatePercent',
  'remainingPayments',
  'collateralAssetMarketValue',
  'maxCapacity',
  'currentBalance',
  'monthlyPayment',
  'assetValueOwed',
  'assetMarketValue',
  'creditLimit',
  'balance',
  'allocationPercent',
  'value',
  'timeframeMonths',
  'targetAmount',
  'currentAmount',
  'signedAmount'
])
const NUMERIC_TEXT_SANITIZER_REGEX = /[$,%\s,()]/g

/**
 * Returns true when a record has not been updated in the last 3 months.
 * Uses updatedAt first, then date as fallback for legacy rows.
 * @param {Record<string, unknown>} recordItem
 * @returns {boolean}
 */
function readIsRecordOlderThanThreeMonths(recordItem) {
  const rawTimestamp = typeof recordItem.updatedAt === 'string'
    ? recordItem.updatedAt
    : (typeof recordItem.date === 'string' ? recordItem.date : '')
  if (!rawTimestamp) return false
  const recordDate = new Date(rawTimestamp)
  if (Number.isNaN(recordDate.getTime())) return false
  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
  return recordDate < threeMonthsAgo
}

function renderStaleUpdateIconIfNeeded(recordItem) {
  if (!readIsRecordOlderThanThreeMonths(recordItem)) return null
  return (
    <span className="ml-2 inline-flex items-center rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-amber-700" title="Record has not been updated in at least 3 months.">
      <svg className="mr-1 h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M12 8v5l3 2" />
        <circle cx="12" cy="12" r="9" />
      </svg>
      stale
    </span>
  )
}

function readComparableValueFromRowByKey(rowValue, keyName) {
  const value = rowValue[keyName]
  if (NUMERIC_SORT_KEYS.has(keyName)) {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
      const trimmedValue = value.trim()
      const normalizedNumericText = trimmedValue.replace(NUMERIC_TEXT_SANITIZER_REGEX, (token) => (token === '(' ? '-' : ''))
      const parsedNumericValue = Number(normalizedNumericText)
      return Number.isFinite(parsedNumericValue) ? parsedNumericValue : 0
    }
    return 0
  }
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const trimmedValue = value.trim()
    if (trimmedValue.length > 0) {
      const normalizedNumericText = trimmedValue.replace(NUMERIC_TEXT_SANITIZER_REGEX, (token) => (token === '(' ? '-' : ''))
      const parsedNumericValue = Number(normalizedNumericText)
      if (Number.isFinite(parsedNumericValue)) return parsedNumericValue
    }
    return trimmedValue.toLowerCase()
  }
  return ''
}

function buildRowsSortedByKeyAndDirection(rowCollection, keyName, direction) {
  const decoratedRows = rowCollection.map((rowItem) => ({
    rowItem,
    comparableValue: readComparableValueFromRowByKey(rowItem, keyName)
  }))
  const sortedRows = decoratedRows.sort((leftRow, rightRow) => {
    const leftValue = leftRow.comparableValue
    const rightValue = rightRow.comparableValue
    if (leftValue === rightValue) return 0
    if (direction === 'asc') return leftValue > rightValue ? 1 : -1
    return leftValue < rightValue ? 1 : -1
  })
  return sortedRows.map((item) => item.rowItem)
}

function renderHoverMetadataBoxForElement(props) {
  const { label, lines, children, className = '', boxClassName = '' } = props
  return (
    <div className={`meta-hover group relative ${className}`}>
      {children}
      <aside className={`meta-hover-box squircle-sm pointer-events-none absolute left-0 top-full z-50 mt-2 w-72 border border-white/70 bg-slate-950/90 p-3 text-xs text-slate-100 opacity-0 shadow-2xl transition duration-150 group-hover:opacity-100 group-focus-within:opacity-100 ${boxClassName}`}>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-200">{label}</p>
        <ul className="space-y-1 text-slate-200">
          {lines.map((lineItem, lineIndex) => (
            <li key={`${label}-${lineIndex}-${lineItem}`}>{lineItem}</li>
          ))}
        </ul>
      </aside>
    </div>
  )
}

function renderMetadataTableHeaderCell(props) {
  const { label, lines, columnLabel, isRightAligned = false } = props
  return (
    <th className={`px-3 py-2 font-semibold ${isRightAligned ? 'text-right' : 'text-left'}`}>
      <span className="meta-hover group relative inline-flex">
        <span>{columnLabel}</span>
        <aside className="meta-hover-box squircle-sm pointer-events-none absolute left-0 top-full mt-2 w-72 border border-white/70 bg-slate-950/90 p-3 text-xs text-slate-100 opacity-0 shadow-2xl transition duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-200">{label}</p>
          <ul className="space-y-1 text-slate-200">
            {lines.map((lineItem, lineIndex) => (
              <li key={`${label}-${lineIndex}-${lineItem}`}>{lineItem}</li>
            ))}
          </ul>
        </aside>
      </span>
    </th>
  )
}

function buildOverviewHoverContextLinesForMetric(metricRow, sourceBreakdown, emergencyFundSummary) {
  const metricLabel = typeof metricRow.metric === 'string' ? metricRow.metric : 'Metric'
  const metricValue = typeof metricRow.value === 'number' ? metricRow.value : 0

  if (metricLabel === 'Net Worth') {
    const status = metricValue >= 0 ? 'Good: positive net worth.' : 'Risk: liabilities exceed assets.'
    return [
      status,
      `Assets this month: ${formatCurrencyValueForDashboard(sourceBreakdown.assets.currentMonth)}`,
      `Liabilities this month: ${formatCurrencyValueForDashboard(sourceBreakdown.liabilities.currentMonth)}`,
      `Change vs last month: ${formatSignedCurrencyDeltaForMetadata(sourceBreakdown.netWorth.delta)}`
    ]
  }
  if (metricLabel === 'Credit Card Utilization') {
    const status = metricValue <= 30 ? 'Good: at or below 30% utilization.' : (metricValue <= 50 ? 'Watch: above 30% utilization.' : 'Risk: very high utilization.')
    return [status, 'Target: keep below 30% (ideal below 10%).', `Current utilization: ${metricValue.toFixed(2)}%.`, 'Higher utilization can increase borrowing cost and score pressure.']
  }
  if (metricLabel === 'Debt to Income Ratio') {
    const status = metricValue <= 36 ? 'Good: within common affordability target.' : (metricValue <= 43 ? 'Watch: elevated debt burden.' : 'Risk: high debt burden.')
    return [status, 'Target: below 36% (common underwriting comfort).', `Current DTI: ${metricValue.toFixed(2)}%.`, 'Lowering minimum debt obligations improves resilience.']
  }
  if (metricLabel === 'Savings Rate') {
    const status = metricValue >= 20 ? 'Good: strong savings rate.' : (metricValue >= 0 ? 'Watch: positive but low savings rate.' : 'Risk: negative savings rate.')
    return [status, 'Target: 20%+ if possible, minimum positive trend.', `Current savings rate: ${metricValue.toFixed(2)}%.`, 'Negative values mean expenses are exceeding income.']
  }
  if (metricLabel === 'Emergency Funds') {
    const liquidAmount = typeof emergencyFundSummary?.liquidAmount === 'number' ? emergencyFundSummary.liquidAmount : 0
    const investedAmount = typeof emergencyFundSummary?.investedAmount === 'number' ? emergencyFundSummary.investedAmount : 0
    const totalCoverageMonths = typeof emergencyFundSummary?.totalCoverageMonths === 'number' ? emergencyFundSummary.totalCoverageMonths : 0
    const status = totalCoverageMonths >= 3 ? 'Good: at least 3-month baseline coverage likely.' : 'Watch: emergency reserve may be thin.'
    return [status, 'Target: 6 months of expenses plus debt minimums.', `Liquid emergency funds: ${formatCurrencyValueForDashboard(liquidAmount)}.`, `Invested emergency funds: ${formatCurrencyValueForDashboard(investedAmount)}.`]
  }
  if (metricLabel === 'Months Until Debt-Free') {
    const status = metricValue <= 24 ? 'Good: short payoff horizon.' : (metricValue <= 60 ? 'Watch: medium payoff horizon.' : 'Risk: long payoff horizon.')
    return [status, 'Lower is better for debt freedom pace.', `Estimated payoff timeline: ${metricValue.toFixed(1)} months.`, 'Increasing monthly payments shortens this timeline fastest.']
  }
  if (metricLabel === 'Monthly Savings') {
    const status = metricValue >= 0 ? 'Good: positive monthly savings.' : 'Risk: monthly deficit.'
    return [status, `Current value: ${formatCurrencyValueForDashboard(metricValue)}.`, 'Positive monthly savings supports goals and emergency reserves.', 'Deficits usually require expense cuts or income growth.']
  }
  if (metricLabel === 'Total Debts') {
    const status = metricValue <= 0 ? 'Good: no tracked liabilities.' : 'Watch: active liabilities require ongoing management.'
    return [status, `Current liabilities: ${formatCurrencyValueForDashboard(metricValue)}.`, 'Track trend month-over-month for reduction momentum.', 'Pair payoff strategy with APR and utilization priorities.']
  }
  if (metricLabel === 'Credit Card Debt') {
    const status = metricValue <= 1000 ? 'Good: low revolving debt.' : (metricValue <= 5000 ? 'Watch: moderate revolving debt.' : 'Risk: high revolving debt.')
    return [status, 'Lower revolving balances reduce interest drag.', `Current credit card debt: ${formatCurrencyValueForDashboard(metricValue)}.`, 'Priority: pay highest APR card first.']
  }
  if (metricLabel === 'Credit Card Capacity') {
    const status = metricValue >= 10000 ? 'Good: strong available capacity.' : (metricValue >= 3000 ? 'Watch: moderate capacity.' : 'Risk: thin credit buffer.')
    return [status, `Current total capacity: ${formatCurrencyValueForDashboard(metricValue)}.`, 'More capacity can improve utilization if spending stays controlled.', 'Avoid increasing limits if it drives more debt usage.']
  }
  if (metricLabel === 'Monthly Debt Payback') {
    const status = metricValue <= sourceBreakdown.income.currentMonth * 0.2 ? 'Good: manageable debt payment load.' : (metricValue <= sourceBreakdown.income.currentMonth * 0.35 ? 'Watch: elevated debt payment load.' : 'Risk: heavy debt payment load.')
    return [status, 'Target: debt payback below ~20-35% of income.', `Current monthly debt payback: ${formatCurrencyValueForDashboard(metricValue)}.`, 'Restructure high payments to improve cash flexibility.']
  }
  if (metricLabel === 'Income After Debt Minimums') {
    const status = metricValue >= 2000 ? 'Good: strong post-debt cash buffer.' : (metricValue >= 500 ? 'Watch: limited post-debt buffer.' : 'Risk: minimal post-debt buffer.')
    return [status, `Current post-debt income: ${formatCurrencyValueForDashboard(metricValue)}.`, 'Higher buffer supports saving and shocks.', 'If low, reduce fixed costs or boost income.']
  }
  if (metricLabel === 'Monthly Expenses') {
    const ratio = sourceBreakdown.income.currentMonth > 0 ? (metricValue / sourceBreakdown.income.currentMonth) * 100 : 0
    const status = ratio <= 70 ? 'Good: spending ratio is controlled.' : (ratio <= 90 ? 'Watch: spending ratio is elevated.' : 'Risk: spending ratio is too high.')
    return [status, `Expense-to-income ratio: ${ratio.toFixed(2)}%.`, `Current monthly expenses: ${formatCurrencyValueForDashboard(metricValue)}.`, 'Target: keep below 70-80% when possible.']
  }
  if (metricLabel === 'Monthly Income') {
    const status = metricValue >= 7000 ? 'Good: strong monthly income base.' : (metricValue >= 4000 ? 'Watch: moderate monthly income base.' : 'Risk: low monthly income base.')
    return [status, `Current monthly income: ${formatCurrencyValueForDashboard(metricValue)}.`, 'Use stability and growth of this metric as a core health signal.', 'Diversified income streams reduce volatility risk.']
  }
  if (metricLabel === 'Yearly Income') {
    const status = metricValue >= 100000 ? 'Good: six-figure annual income range.' : (metricValue >= 60000 ? 'Watch: stable mid-range annual income.' : 'Risk: tighter annual income range.')
    return [status, `Current annualized income: ${formatCurrencyValueForDashboard(metricValue)}.`, 'Compare liabilities and goals against annual income scale.', 'Higher annual income improves refinancing and savings options.']
  }
  if (metricLabel === 'Emergency Funds Goal') {
    const status = metricValue > 0 ? 'Target: this is your 6-month reserve benchmark.' : 'Risk: emergency goal is not defined.'
    return [status, `Target amount: ${formatCurrencyValueForDashboard(metricValue)}.`, 'Typical range: 3-6 months of obligations (expenses + debt minimums).', 'Track progress monthly against this goal.']
  }
  if (metricLabel === 'Emergency Fund Gap') {
    const status = metricValue > 0 ? 'Gap: this is the amount still needed to fully fund 6 months.' : 'Good: emergency fund target is currently met.'
    return [status, `Current shortfall: ${formatCurrencyValueForDashboard(metricValue)}.`, 'Target benchmark: 6 months of obligations.', 'Reduce this gap with recurring monthly emergency contributions.']
  }
  if (metricLabel === 'Goals Completed') {
    const status = metricValue >= 10 ? 'Good: strong execution pace.' : (metricValue >= 3 ? 'Watch: moderate completion pace.' : 'Risk: low completion pace.')
    return [status, `Completed goals: ${Math.round(metricValue)}.`, 'Pair with in-progress goals to assess momentum.', 'Use monthly milestone check-ins to improve completion rate.']
  }
  if (metricLabel === 'Goals In Progress') {
    const status = metricValue >= 5 ? 'Good: active progress pipeline.' : (metricValue >= 1 ? 'Watch: limited active progress.' : 'Risk: no active goals.')
    return [status, `Goals in progress: ${Math.round(metricValue)}.`, 'Healthy systems keep a few active goals moving at once.', 'Too many active goals can dilute focus.']
  }
  if (metricLabel === 'Goals Not Started') {
    const status = metricValue <= 5 ? 'Good: backlog is manageable.' : (metricValue <= 15 ? 'Watch: backlog is growing.' : 'Risk: backlog is too large.')
    return [status, `Goals not started: ${Math.round(metricValue)}.`, 'Large backlogs reduce execution confidence.', 'Convert backlog items into phased plans.']
  }
  if (metricLabel === 'Travel Goals Completed') {
    const status = metricValue >= 3 ? 'Good: travel goals are advancing well.' : (metricValue >= 1 ? 'Watch: some travel progress exists.' : 'Risk: no travel goals completed yet.')
    return [status, `Travel goals completed: ${Math.round(metricValue)}.`, 'Use budget-safe planning so travel does not delay core goals.', 'Track this alongside savings health metrics.']
  }
  if (metricLabel === 'Travel Goals On Bucket List') {
    const status = metricValue <= 5 ? 'Good: travel backlog is realistic.' : (metricValue <= 10 ? 'Watch: travel backlog is large.' : 'Risk: travel backlog may be unrealistic.')
    return [status, `Travel goals pending: ${Math.round(metricValue)}.`, 'Large lists are fine if sequenced by cost and timing.', 'Prioritize low-cost or high-value trips first.']
  }
  if (metricLabel === 'Weighted Interest Rate') {
    const status = metricValue <= 8 ? 'Good: low blended borrowing cost.' : (metricValue <= 15 ? 'Watch: moderate blended borrowing cost.' : 'Risk: high blended borrowing cost.')
    return [status, 'Target: lower blended rate through payoff/refinance sequencing.', `Current weighted rate: ${metricValue.toFixed(2)}%.`, 'High rates make minimum-only repayment inefficient.']
  }
  if (metricLabel === 'Annual Debt Service') {
    const status = metricValue <= sourceBreakdown.income.currentMonth * 12 * 0.25 ? 'Good: annual debt service is manageable.' : (metricValue <= sourceBreakdown.income.currentMonth * 12 * 0.4 ? 'Watch: annual debt service is elevated.' : 'Risk: annual debt service is high.')
    return [status, `Current annual debt service: ${formatCurrencyValueForDashboard(metricValue)}.`, 'Target: keep annual debt service proportion controlled.', 'Reducing this improves long-term investing capacity.']
  }
  if (metricLabel === 'Debt Paydown Velocity') {
    const status = metricValue >= 5 ? 'Good: fast debt paydown pace.' : (metricValue >= 2 ? 'Watch: moderate debt paydown pace.' : 'Risk: slow debt paydown pace.')
    return [status, `Current paydown velocity: ${metricValue.toFixed(2)}%.`, 'Higher is better if cash flow remains healthy.', 'Add targeted extra payments to accelerate velocity.']
  }
  if (metricLabel === 'Cash Runway After Debt Service') {
    const status = metricValue >= 6 ? 'Good: strong post-debt runway.' : (metricValue >= 3 ? 'Watch: moderate post-debt runway.' : 'Risk: low post-debt runway.')
    return [status, `Current runway after debt: ${metricValue.toFixed(1)} months.`, 'Target: maintain at least 3 months; prefer 6+', 'Runway includes debt minimum obligations.']
  }
  if (metricLabel === 'Emergency Fund Coverage (Months)') {
    const status = metricValue >= 6 ? 'Good: fully funded emergency coverage.' : (metricValue >= 3 ? 'Watch: baseline emergency coverage.' : 'Risk: emergency coverage is low.')
    return [status, `Current coverage: ${metricValue.toFixed(1)} months.`, 'Coverage is against expenses plus debt minimums.', 'Target bands: 3 months minimum, 6 months preferred.']
  }
  if (metricLabel === 'Discretionary After Expenses + Debt') {
    const status = metricValue >= 1000 ? 'Good: healthy discretionary capacity.' : (metricValue >= 0 ? 'Watch: thin discretionary capacity.' : 'Risk: negative discretionary cash flow.')
    return [status, `Current discretionary buffer: ${formatCurrencyValueForDashboard(metricValue)}.`, 'Positive buffer supports flexibility and faster payoff.', 'Negative buffer requires immediate budget adjustment.']
  }
  if (metricLabel === 'Projected Net Worth (12 Months)') {
    const status = metricValue >= 0 ? 'Good: projected net worth is positive.' : 'Risk: projected net worth remains negative.'
    return [status, `12-month projection: ${formatCurrencyValueForDashboard(metricValue)}.`, 'Projection assumes current monthly surplus continues.', 'Improve surplus to bend this trajectory upward faster.']
  }

  return [
    `Status: ${metricValue >= 0 ? 'neutral-positive' : 'neutral-negative'} trend.`,
    `Current value: ${formatDashboardDatapointValueByFormat(metricValue, metricRow.valueFormat)}.`,
    metricRow.description,
    'Check trend direction across the last 3 updates for confidence.'
  ]
}

function buildRiskDetailTemplateFromFindingAndPersonas(findingItem, personaNames) {
  const safeId = typeof findingItem.id === 'string' ? findingItem.id : ''
  const safeTitle = typeof findingItem.title === 'string' ? findingItem.title : 'Risk Flag'
  const safeDetail = typeof findingItem.detail === 'string' ? findingItem.detail : 'No detail available.'
  const safeSeverity = typeof findingItem.severity === 'string' ? findingItem.severity : 'medium'
  const safeMetricValue = typeof findingItem.metricValue === 'number' ? findingItem.metricValue : 0
  const defaultPersonaLabel = `${DEFAULT_PERSONA_EMOJI} ${DEFAULT_PERSONA_NAME}`
  const affectedPersonas = personaNames.length > 0 ? personaNames.join(', ') : defaultPersonaLabel
  const primaryPersona = personaNames.length > 0 ? personaNames[0] : defaultPersonaLabel

  const meaningText = `${safeTitle}: ${safeDetail}`
  const impactText = `${safeTitle} can affect ${affectedPersonas} through tighter cash flow, higher financing costs, and reduced flexibility for goals.`

  let fixChecklist = [
    'Validate all related records first (balance, limit, payment, and last-updated date).',
    `Assign one accountable owner (${primaryPersona}) and a 30-day target.`,
    'Track progress for at least 3 updates and only then tighten the target.'
  ]

  if (safeId.includes('util-') || safeTitle.toLowerCase().includes('utilization')) {
    fixChecklist = [
      `Current utilization is ${safeMetricValue.toFixed(2)}%; target below 30% (ideal below 10%).`,
      'Route extra monthly cash to the highest-utilization card first while maintaining all minimums.',
      'Freeze non-essential card spend until utilization trend is down for 3 consecutive updates.'
    ]
  } else if (safeId.includes('dti-') || safeTitle.toLowerCase().includes('debt-to-income') || safeTitle.toLowerCase().includes('debt payment')) {
    fixChecklist = [
      `Current debt burden is ${safeMetricValue.toFixed(2)}%; aim to move below 36% first.`,
      'Restructure high-payment obligations where possible (refinance, term adjust, rate review).',
      'Redirect discretionary spend and incremental income to reduce required monthly obligations.'
    ]
  } else if (safeId.includes('emergency') || safeTitle.toLowerCase().includes('emergency fund')) {
    fixChecklist = [
      'Create an automated emergency-fund transfer on payday before discretionary spending.',
      'Build coverage in stages: 1 month, then 3 months, then 6 months of expenses.',
      'Delay non-essential large purchases until at least baseline (3 months) is funded.'
    ]
  } else if (safeId.includes('secured-ltv') || safeTitle.toLowerCase().includes('loan-to-value')) {
    fixChecklist = [
      `Current secured LTV is ${safeMetricValue.toFixed(2)}%; target below 80% for safer leverage.`,
      'Prioritize principal paydown on the highest-LTV secured debt first.',
      'Update collateral market value quarterly so risk status is based on current estimates.'
    ]
  } else if (safeId.includes('savings') || safeTitle.toLowerCase().includes('savings')) {
    fixChecklist = [
      'Set a minimum monthly savings floor and automate transfer into designated storage accounts.',
      'Use separate buckets: emergency, near-term goals, and long-term investments.',
      'If cash flow is tight, start with 5-10% and ratchet upward every month.'
    ]
  } else if (safeId.includes('liquidity') || safeTitle.toLowerCase().includes('liquidity')) {
    fixChecklist = [
      'Shift a portion of assets into high-liquidity storage (cash/HYSA equivalents).',
      'Lower short-term obligations that require high monthly payments.',
      'Set a liquidity floor policy and alert when balance drops below it.'
    ]
  } else if (safeId.includes('stale') || safeTitle.toLowerCase().includes('stale')) {
    fixChecklist = [
      'Refresh all stale records now; old values make every derived metric less reliable.',
      'Set a monthly update cadence with one owner per section (income, debt, credit, savings).',
      'Use date reminders and mark records stale after 90 days to force review.'
    ]
  }

  return {
    title: safeTitle,
    severity: safeSeverity,
    meaningText,
    impactText,
    fixChecklist
  }
}

export default function App() {
  const [defaultCollectionsState, defaultCollectionsStateError] = React.useMemo(
    () => buildDefaultBudgetCollectionsStateForLocalFirstUsage(),
    []
  )
  const [collections, setCollections] = React.useState(defaultCollectionsState)
  const [entryFormState, setEntryFormState] = React.useState(buildInitialIncomeExpenseEntryFormState)
  const [goalEntryFormState, setGoalEntryFormState] = React.useState(buildInitialGoalEntryFormState)
  const [isLoadingState, setIsLoadingState] = React.useState(true)
  const [uiMessage, setUiMessage] = React.useState('')
  const [themeName, setThemeName] = React.useState('dark')
  const [textScaleMultiplier, setTextScaleMultiplier] = React.useState(1)
  const [isAddRecordModalOpen, setIsAddRecordModalOpen] = React.useState(false)
  const [isAddGoalModalOpen, setIsAddGoalModalOpen] = React.useState(false)
  const [isAddPersonaModalOpen, setIsAddPersonaModalOpen] = React.useState(false)
  const [isAddAssetModalOpen, setIsAddAssetModalOpen] = React.useState(false)
  const [personaEntryFormState, setPersonaEntryFormState] = React.useState(buildInitialPersonaEntryFormState)
  const [assetHoldingEntryFormState, setAssetHoldingEntryFormState] = React.useState(buildInitialAssetHoldingEntryFormState)
  const [personaCrudFormState, setPersonaCrudFormState] = React.useState(buildInitialPersonaCrudFormState)
  const [personaDangerBackupState, setPersonaDangerBackupState] = React.useState(null)
  const [isProfileTransferModalOpen, setIsProfileTransferModalOpen] = React.useState(false)
  const [profileTransferFormState, setProfileTransferFormState] = React.useState(buildInitialProfileTransferFormState)
  const [profileDeleteUndoSnapshotJsonText, setProfileDeleteUndoSnapshotJsonText] = React.useState('')
  const [supabaseSyncFormState, setSupabaseSyncFormState] = React.useState(buildInitialSupabaseSyncFormState)
  const [supabaseAuthUserSummary, setSupabaseAuthUserSummary] = React.useState(null)
  const [supabaseSyncStatusState, setSupabaseSyncStatusState] = React.useState(buildInitialSupabaseSyncStatusState)
  const [isSupabaseOperationInFlight, setIsSupabaseOperationInFlight] = React.useState(false)
  const [firebaseSyncFormState, setFirebaseSyncFormState] = React.useState(buildInitialFirebaseSyncFormState)
  const [firebaseAuthUserSummary, setFirebaseAuthUserSummary] = React.useState(null)
  const [firebaseSyncStatusState, setFirebaseSyncStatusState] = React.useState(buildInitialFirebaseSyncStatusState)
  const [isFirebaseOperationInFlight, setIsFirebaseOperationInFlight] = React.useState(false)
  const [isEditRecordModalOpen, setIsEditRecordModalOpen] = React.useState(false)
  const [isRecordNotesModalOpen, setIsRecordNotesModalOpen] = React.useState(false)
  const [selectedRiskFinding, setSelectedRiskFinding] = React.useState(null)
  const [editRecordFormState, setEditRecordFormState] = React.useState(buildInitialEditRecordFormState)
  const [recordNotesFormState, setRecordNotesFormState] = React.useState(buildInitialRecordNotesFormState)
  const [riskFindings, setRiskFindings] = React.useState([])
  const [isRiskLoading, setIsRiskLoading] = React.useState(false)
  const [isRiskCardsFadingOut, setIsRiskCardsFadingOut] = React.useState(false)
  const [tableSortState, setTableSortState] = React.useState(DEFAULT_TABLE_SORT_STATE)
  const [auditTimelineEntries, setAuditTimelineEntries] = React.useState([])
  const [trendWindowMonths, setTrendWindowMonths] = React.useState(6)
  const [netWorthProjectionProfileId, setNetWorthProjectionProfileId] = React.useState('base')
  const [loanCalculatorFormState, setLoanCalculatorFormState] = React.useState(buildInitialLoanCalculatorFormState)
  const transactionUndoStackRef = React.useRef([])
  const [transactionUndoDepth, setTransactionUndoDepth] = React.useState(0)

  React.useEffect(() => {
    let isMounted = true
    async function loadCollectionsStateIntoComponent() {
      if (defaultCollectionsState && !defaultCollectionsStateError) {
        setCollections(defaultCollectionsState)
        setIsLoadingState(false)
      }
      const [cachedUiPreferences, cachedSupabaseLoadResult, cachedAuditTimeline, cachedState] = await Promise.all([
        loadUiPreferencesFromLocalStorageCache(),
        loadSupabaseWebConfigFromLocalStorageCache(),
        loadAuditTimelineFromLocalStorageCache(),
        loadBudgetCollectionsStateFromLocalStorageCache()
      ])
      if (!isMounted) return

      const [cachedUiPreferencesValue] = cachedUiPreferences
      if (cachedUiPreferencesValue) {
        setThemeName(cachedUiPreferencesValue.themeName)
        setTextScaleMultiplier(cachedUiPreferencesValue.textScaleMultiplier)
        if (cachedUiPreferencesValue.tableSortState && typeof cachedUiPreferencesValue.tableSortState === 'object' && !Array.isArray(cachedUiPreferencesValue.tableSortState)) {
          setTableSortState({
            ...DEFAULT_TABLE_SORT_STATE,
            ...cachedUiPreferencesValue.tableSortState
          })
        }
      }

      const [cachedSupabaseWebConfig, cachedSupabaseWebConfigError] = cachedSupabaseLoadResult
      if (cachedSupabaseWebConfigError) {
        console.warn('[supabase] Failed to load cached supabase config.', cachedSupabaseWebConfigError)
      } else if (cachedSupabaseWebConfig) {
        setSupabaseSyncFormState((previousFormState) => ({ ...previousFormState, ...cachedSupabaseWebConfig }))
        if (cachedSupabaseWebConfig.otpPendingEmail) {
          setSupabaseSyncStatusState({
            tone: 'neutral',
            message: 'OTP code pending verification.',
            detail: `Enter the code sent to ${cachedSupabaseWebConfig.otpPendingEmail}.`
          })
        }
      }
      if (ENABLE_FIREBASE_SYNC_UI) {
        const [cachedFirebaseWebConfig, cachedFirebaseWebConfigError] = await loadFirebaseWebConfigFromLocalStorageCache()
        if (!isMounted) return
        if (cachedFirebaseWebConfigError) {
          console.warn('[firebase] Failed to load cached firebase config.', cachedFirebaseWebConfigError)
        } else if (cachedFirebaseWebConfig) {
          const mergedFirebaseConfig = buildFirebaseSyncConfigWithRequiredDefaults(cachedFirebaseWebConfig)
          setFirebaseSyncFormState(mergedFirebaseConfig)
          const [authUserSummary, authUserSummaryError] = await readFirebaseAuthenticatedUserSummary(mergedFirebaseConfig)
          if (!isMounted) return
          if (authUserSummaryError) {
            console.warn('[firebase] Failed to read auth user summary.', authUserSummaryError)
          } else {
            setFirebaseAuthUserSummary(authUserSummary)
          }
        }
      }
      const [cachedAuditTimelineValue, cachedAuditTimelineError] = cachedAuditTimeline
      if (cachedAuditTimelineError) {
        console.warn('[audit] Failed to load cached audit timeline.', cachedAuditTimelineError)
      } else if (Array.isArray(cachedAuditTimelineValue)) {
        setAuditTimelineEntries(cachedAuditTimelineValue)
      }
      const [cachedStateValue, loadError] = cachedState
      if (loadError) {
        console.warn('[state] Failed to load cached collections state.', loadError)
        setUiMessage(loadError.message)
        setIsLoadingState(false)
        return
      }
      if (cachedStateValue) {
        // Critical path: backfill new collections for existing local-cache users.
        const migratedCachedState = Array.isArray(cachedStateValue.assetHoldings)
          ? cachedStateValue
          : {
            ...cachedStateValue,
            assetHoldings: Array.isArray(defaultCollectionsState?.assetHoldings) ? defaultCollectionsState.assetHoldings : []
          }
        setCollections(migratedCachedState)
        setIsLoadingState(false)
        return
      }
      if (defaultCollectionsStateError || !defaultCollectionsState) {
        setUiMessage('Unable to initialize default budgeting state.')
        setIsLoadingState(false)
        return
      }
      setCollections(defaultCollectionsState)
      setIsLoadingState(false)
    }
    void loadCollectionsStateIntoComponent()
    return () => { isMounted = false }
  }, [defaultCollectionsState, defaultCollectionsStateError])

  React.useEffect(() => {
    const [ok, err] = applyThemeNameToDocumentBodyDataAttribute(themeName)
    if (err || !ok) {
      console.warn('[ui] Failed to apply theme.', { themeName, err })
      setUiMessage('Unable to apply selected theme.')
    }
  }, [themeName])

  React.useEffect(() => {
    const [ok, err] = applyGlobalTextScaleMultiplierToDocumentRoot(textScaleMultiplier)
    if (err || !ok) {
      console.warn('[ui] Failed to apply text scale.', { textScaleMultiplier, err })
      setUiMessage('Unable to apply text scale.')
    }
  }, [textScaleMultiplier])

  React.useEffect(() => {
    if (!isAddRecordModalOpen && !isAddGoalModalOpen && !isAddPersonaModalOpen && !isAddAssetModalOpen && !isProfileTransferModalOpen && !isEditRecordModalOpen && !isRecordNotesModalOpen && !selectedRiskFinding) return
    function closeOnEscape(keyboardEvent) {
      if (keyboardEvent.key === 'Escape') {
        setIsAddRecordModalOpen(false)
        setIsAddGoalModalOpen(false)
        setIsAddPersonaModalOpen(false)
        setIsAddAssetModalOpen(false)
        setIsProfileTransferModalOpen(false)
        setIsEditRecordModalOpen(false)
        setIsRecordNotesModalOpen(false)
        setSelectedRiskFinding(null)
      }
    }
    globalThis.window.addEventListener('keydown', closeOnEscape)
    return () => globalThis.window.removeEventListener('keydown', closeOnEscape)
  }, [isAddRecordModalOpen, isAddGoalModalOpen, isAddPersonaModalOpen, isAddAssetModalOpen, isProfileTransferModalOpen, isEditRecordModalOpen, isRecordNotesModalOpen, selectedRiskFinding])

  const safeCollections = collections ?? {
    income: [],
    expenses: [],
    assets: [],
    assetHoldings: [],
    debts: [],
    credit: [],
    creditCards: [],
    loans: [],
    goals: [],
    personas: [],
    notes: [],
    schemaVersion: 1
  }
  const shouldSkipHeavyComputations = isLoadingState || !collections

  const dashboardComputation = React.useMemo(() => {
    if (shouldSkipHeavyComputations) {
      return {
        error: false,
        metrics: [],
        sourceBreakdown: {
          incomeRows: [],
          expenseRows: [],
          income: { currentMonth: 0, previousMonth: 0, delta: 0 },
          expenses: { currentMonth: 0, previousMonth: 0, delta: 0 },
          assets: { currentMonth: 0, previousMonth: 0, delta: 0 },
          liabilities: { currentMonth: 0, previousMonth: 0, delta: 0 },
          netWorth: { currentMonth: 0, previousMonth: 0, delta: 0 }
        },
        detailedDashboardRows: [],
        powerGoalsFormulaSummary: { completedCount: 0, inProgressCount: 0, notStartedCount: 0, completionRatePercent: 0, completedRows: [], inProgressRows: [], notStartedRows: [] },
        monthlySavingsStorageSummary: { monthlyIncome: 0, monthlySavingsAmount: 0, monthlySavingsRatePercent: 0, totalStoredSavings: 0, storageRows: [] },
        savingsRecommendation: {
          recommendationReason: '',
          totalIncomeForReference: 0,
          recommendedMonthlySavings: 0,
          recommendedSavingsRatePercent: 0,
          minimumRecommendedSavings: 0,
          stretchRecommendedSavings: 0,
          gapToRecommendedSavings: 0
        },
        emergencyFundSummary: { emergencyFundGoal: 0, liquidAmount: 0, investedAmount: 0, missingLiquidAmount: 0, investedTarget: 0, totalCoverageMonths: 0 },
        creditCardInformationCollection: [],
        creditCardSummary: { totalCurrent: 0, totalMonthly: 0, totalUtilizationPercent: 0, remainingCapacity: 0, maxCapacity: 0 },
        creditCardRecommendations: { weightedPayoffMonthsCurrent: 0, weightedPayoffMonthsRecommended: 0, rows: [] },
        planningInsights: {
          forecast: { committed: 0, planned: 0, optional: 0, projectedRiskLevel: 'low' },
          budgetVsActualRows: [],
          recurringBaselineRows: [],
          scenarioRows: [],
          amortizationRows: [],
          goalTemplateRows: [],
          riskProvenanceRows: [],
          reconcileChecklistRows: []
        }
      }
    }
    const [metrics, metricsError] = calculateTwentyDashboardHealthMetricsFromFinancialCollections(safeCollections)
    if (metricsError || !metrics) return { error: true }

    const [sourceBreakdown, sourceBreakdownError] = calculateCurrentAndPreviousMonthSourceBreakdownFromCollectionsState(safeCollections)
    if (sourceBreakdownError || !sourceBreakdown) return { error: true }

    const [detailedDashboardRows, detailedDashboardRowsError] = calculateDetailedDashboardDatapointRowsFromCurrentCollectionsState(safeCollections)
    if (detailedDashboardRowsError || !detailedDashboardRows) return { error: true }

    const [powerGoalsFormulaSummary, powerGoalsFormulaSummaryError] = calculatePowerGoalsStatusFormulaSummaryFromGoalCollection(safeCollections.goals)
    if (powerGoalsFormulaSummaryError || !powerGoalsFormulaSummary) return { error: true }
    const [monthlySavingsStorageSummary, monthlySavingsStorageSummaryError] = calculateMonthlySavingsStorageSummaryFromCollectionsState(safeCollections)
    if (monthlySavingsStorageSummaryError || !monthlySavingsStorageSummary) return { error: true }
    const [savingsRecommendation, savingsRecommendationError] = calculateRecommendedMonthlySavingsTargetFromCollectionsState(safeCollections)
    if (savingsRecommendationError || !savingsRecommendation) return { error: true }
    const [emergencyFundSummary, emergencyFundSummaryError] = calculateEmergencyFundTrackingSummaryFromCollectionsState(safeCollections)
    if (emergencyFundSummaryError || !emergencyFundSummary) return { error: true }

    const creditCardInformationCollection = Array.isArray(safeCollections.creditCards) ? safeCollections.creditCards : []
    const [creditCardSummary, creditCardSummaryError] = calculateCreditCardSummaryFormulasFromInformationCollection(creditCardInformationCollection)
    if (creditCardSummaryError || !creditCardSummary) return { error: true }
    const [creditCardRecommendations, creditCardRecommendationsError] = calculateCreditCardPaymentRecommendationsFromCollectionsState(
      safeCollections,
      creditCardInformationCollection
    )
    if (creditCardRecommendationsError || !creditCardRecommendations) return { error: true }
    const [planningInsights, planningInsightsError] = calculatePlanningCockpitInsightsFromCollectionsState(safeCollections)
    if (planningInsightsError || !planningInsights) return { error: true }

    return {
      error: false,
      metrics,
      sourceBreakdown,
      detailedDashboardRows,
      powerGoalsFormulaSummary,
      monthlySavingsStorageSummary,
      savingsRecommendation,
      emergencyFundSummary,
      creditCardInformationCollection,
      creditCardSummary,
      creditCardRecommendations,
      planningInsights
    }
  }, [safeCollections])

  if (dashboardComputation.error) {
    return <main className="mx-auto min-h-screen w-full max-w-7xl p-4 md:p-8"><section className="rounded-3xl border border-red-300 bg-white p-8 text-red-700 shadow-2xl">Unable to calculate dashboard values.</section></main>
  }
  const {
    metrics,
    sourceBreakdown,
    detailedDashboardRows,
    powerGoalsFormulaSummary,
    monthlySavingsStorageSummary,
    savingsRecommendation,
    emergencyFundSummary,
    creditCardInformationCollection,
    creditCardSummary,
    creditCardRecommendations,
    planningInsights
  } = dashboardComputation
  const loanCalculatorResult = React.useMemo(() => {
    if (shouldSkipHeavyComputations) return { error: null, comparison: null }
    const principalBalance = Number(loanCalculatorFormState.principalBalance || 0)
    const annualInterestRatePercent = Number(loanCalculatorFormState.annualInterestRatePercent || 0)
    const baseMonthlyPayment = Number(loanCalculatorFormState.baseMonthlyPayment || 0)
    const extraMonthlyPayment = Number(loanCalculatorFormState.extraMonthlyPayment || 0)
    const [comparison, comparisonError] = calculateLoanPayoffComparisonFromBaseAndExtraPayments(
      principalBalance,
      baseMonthlyPayment,
      extraMonthlyPayment,
      annualInterestRatePercent
    )
    if (comparisonError || !comparison) return { error: comparisonError }
    return { error: null, comparison }
  }, [loanCalculatorFormState, shouldSkipHeavyComputations])
  const trendSeriesRows = React.useMemo(() => {
    if (shouldSkipHeavyComputations) return []
    const sourceRows = [
      ...auditTimelineEntries.slice(0, 48).map((entryItem) => ({
        timestamp: typeof entryItem.timestamp === 'string' ? entryItem.timestamp : '',
        snapshot: entryItem.snapshot
      })),
      { timestamp: new Date().toISOString(), snapshot: safeCollections }
    ].filter((rowItem) => rowItem.snapshot && typeof rowItem.snapshot === 'object' && typeof rowItem.timestamp === 'string' && rowItem.timestamp.length > 0)

    const latestByMonth = new Map()
    for (const rowItem of sourceRows) {
      const parsedDate = new Date(rowItem.timestamp)
      if (Number.isNaN(parsedDate.getTime())) continue
      const monthKey = `${parsedDate.getUTCFullYear()}-${String(parsedDate.getUTCMonth() + 1).padStart(2, '0')}`
      const existingRow = latestByMonth.get(monthKey)
      if (!existingRow || new Date(existingRow.timestamp).getTime() < parsedDate.getTime()) {
        latestByMonth.set(monthKey, rowItem)
      }
    }
    const monthRowsSorted = [...latestByMonth.entries()]
      .map(([monthKey, rowItem]) => ({ monthKey, ...rowItem }))
      .sort((leftRow, rightRow) => leftRow.monthKey.localeCompare(rightRow.monthKey))

    return monthRowsSorted.map((rowItem) => {
      const [metrics] = calculateTwentyDashboardHealthMetricsFromFinancialCollections(/** @type {any} */ (rowItem.snapshot))
      const [monthlySummary] = calculateMonthlyIncomeExpenseSummaryFromCollectionsState(/** @type {any} */ (rowItem.snapshot))
      return {
        monthKey: rowItem.monthKey,
        netWorth: typeof metrics?.netWorth === 'number' ? metrics.netWorth : 0,
        debtToIncomePercent: typeof metrics?.debtToIncomeRatioPercent === 'number' ? metrics.debtToIncomeRatioPercent : 0,
        savingsRatePercent: typeof monthlySummary?.savingsRatePercent === 'number' ? monthlySummary.savingsRatePercent : 0,
        utilizationPercent: typeof metrics?.creditCardUtilizationPercent === 'number' ? metrics.creditCardUtilizationPercent : 0
      }
    })
  }, [auditTimelineEntries, safeCollections, shouldSkipHeavyComputations])
  const trendRowsInSelectedWindow = React.useMemo(
    () => trendSeriesRows.slice(-Math.max(1, trendWindowMonths)),
    [trendSeriesRows, trendWindowMonths]
  )
  const trendNetWorthMinMax = React.useMemo(() => {
    const netWorthValues = trendRowsInSelectedWindow.map((rowItem) => rowItem.netWorth)
    if (netWorthValues.length === 0) return { min: 0, max: 0 }
    return {
      min: Math.min(...netWorthValues),
      max: Math.max(...netWorthValues)
    }
  }, [trendRowsInSelectedWindow])

  async function fadeOutAndClearRiskCardsOverHalfSecond() {
    if (!Array.isArray(riskFindings) || riskFindings.length === 0) {
      setRiskFindings([])
      return
    }
    setIsRiskCardsFadingOut(true)
    await new Promise((resolve) => globalThis.setTimeout(resolve, 500))
    setRiskFindings([])
    setIsRiskCardsFadingOut(false)
  }

  async function recomputeRiskFindingsFromCollectionsState(nextCollectionsState) {
    if (!readHasAnyMeaningfulFinancialRowsInCollections(nextCollectionsState)) {
      setRiskFindings([])
      setIsRiskLoading(false)
      return
    }
    setIsRiskLoading(true)
    await fadeOutAndClearRiskCardsOverHalfSecond()
    const [nextRiskFindings, nextRiskFindingsError] = await computeFinancialRiskFindingsUsingBackgroundWorkerWhenAvailable(nextCollectionsState)
    if (nextRiskFindingsError || !nextRiskFindings) {
      console.warn('[risk] Failed to compute risk findings.', nextRiskFindingsError)
      setRiskFindings([])
      setIsRiskLoading(false)
      return
    }
    setRiskFindings(nextRiskFindings)
    setIsRiskLoading(false)
  }
  async function recomputeAndValidateDashboardDerivedStateAfterImport(nextCollectionsState) {
    const [metrics, metricsError] = calculateTwentyDashboardHealthMetricsFromFinancialCollections(nextCollectionsState)
    if (metricsError || !metrics) {
      console.warn('[profile] Post-import compute failed at health metrics.', metricsError)
      return
    }
    const [sourceBreakdown, sourceBreakdownError] = calculateCurrentAndPreviousMonthSourceBreakdownFromCollectionsState(nextCollectionsState)
    if (sourceBreakdownError || !sourceBreakdown) {
      console.warn('[profile] Post-import compute failed at source breakdown.', sourceBreakdownError)
      return
    }
    const [detailedRows, detailedRowsError] = calculateDetailedDashboardDatapointRowsFromCurrentCollectionsState(nextCollectionsState)
    if (detailedRowsError || !detailedRows) {
      console.warn('[profile] Post-import compute failed at detailed rows.', detailedRowsError)
      return
    }
    const [monthlySummary, monthlySummaryError] = calculateMonthlyIncomeExpenseSummaryFromCollectionsState(nextCollectionsState)
    if (monthlySummaryError || !monthlySummary) {
      console.warn('[profile] Post-import compute failed at monthly summary.', monthlySummaryError)
      return
    }
    const [monthlySavingsSummary, monthlySavingsSummaryError] = calculateMonthlySavingsStorageSummaryFromCollectionsState(nextCollectionsState)
    if (monthlySavingsSummaryError || !monthlySavingsSummary) {
      console.warn('[profile] Post-import compute failed at monthly savings summary.', monthlySavingsSummaryError)
      return
    }
    const [savingsRecommendationSummary, savingsRecommendationSummaryError] = calculateRecommendedMonthlySavingsTargetFromCollectionsState(nextCollectionsState)
    if (savingsRecommendationSummaryError || !savingsRecommendationSummary) {
      console.warn('[profile] Post-import compute failed at savings recommendation.', savingsRecommendationSummaryError)
      return
    }
    const creditCardRows = Array.isArray(nextCollectionsState.creditCards) ? nextCollectionsState.creditCards : []
    const [creditCardSummaryResult, creditCardSummaryError] = calculateCreditCardSummaryFormulasFromInformationCollection(creditCardRows)
    if (creditCardSummaryError || !creditCardSummaryResult) {
      console.warn('[profile] Post-import compute failed at credit card summary.', creditCardSummaryError)
      return
    }
    const [creditCardRecommendationRows, creditCardRecommendationRowsError] = calculateCreditCardPaymentRecommendationsFromCollectionsState(nextCollectionsState, creditCardRows)
    if (creditCardRecommendationRowsError || !creditCardRecommendationRows) {
      console.warn('[profile] Post-import compute failed at credit card recommendations.', creditCardRecommendationRowsError)
      return
    }
    const [planningInsightsSummary, planningInsightsSummaryError] = calculatePlanningCockpitInsightsFromCollectionsState(nextCollectionsState)
    if (planningInsightsSummaryError || !planningInsightsSummary) {
      console.warn('[profile] Post-import compute failed at planning insights.', planningInsightsSummaryError)
      return
    }
    const [unifiedRecords, unifiedRecordsError] = calculateUnifiedFinancialRecordsSourceOfTruthFromCollectionsState(nextCollectionsState)
    if (unifiedRecordsError || !unifiedRecords) {
      console.warn('[profile] Post-import compute failed at unified records.', unifiedRecordsError)
      return
    }
    console.info('[profile] Post-import compute checkpoint completed.', {
      metrics: metrics.length,
      detailedRows: detailedRows.length,
      records: unifiedRecords.length
    })
  }

  React.useEffect(() => {
    let isMounted = true
    if (shouldSkipHeavyComputations) {
      setRiskFindings([])
      setIsRiskLoading(false)
      return () => { isMounted = false }
    }
    if (!readHasAnyMeaningfulFinancialRowsInCollections(safeCollections)) {
      setRiskFindings([])
      setIsRiskLoading(false)
      return () => { isMounted = false }
    }
    setIsRiskLoading(true)
    void fadeOutAndClearRiskCardsOverHalfSecond()
    async function computeRiskFindings() {
      const [nextRiskFindings, nextRiskFindingsError] = await computeFinancialRiskFindingsUsingBackgroundWorkerWhenAvailable(safeCollections)
      if (!isMounted) return
      if (nextRiskFindingsError || !nextRiskFindings) {
        console.warn('[risk] Failed to compute risk findings.', nextRiskFindingsError)
        setRiskFindings([])
        setIsRiskLoading(false)
        return
      }
      setRiskFindings(nextRiskFindings)
      setIsRiskLoading(false)
    }
    void computeRiskFindings()
    return () => { isMounted = false }
  }, [safeCollections, shouldSkipHeavyComputations])

  const topMetrics = React.useMemo(() => {
    if (shouldSkipHeavyComputations) return []
    const assetsSectionTotalAtMarketValue = (Array.isArray(safeCollections.assetHoldings) ? safeCollections.assetHoldings : []).reduce((runningTotal, rowItem) => {
      const marketValue = typeof rowItem.assetMarketValue === 'number' ? rowItem.assetMarketValue : 0
      return runningTotal + marketValue
    }, 0)
    const debtAndLoanTotal = [...safeCollections.debts, ...safeCollections.loans].reduce((runningTotal, rowItem) => {
      const amount = typeof rowItem.amount === 'number' ? rowItem.amount : 0
      return runningTotal + amount
    }, 0)
    const creditAccountTotal = creditCardInformationCollection.reduce((runningTotal, rowItem) => {
      const currentBalance = typeof rowItem.currentBalance === 'number' ? rowItem.currentBalance : 0
      return runningTotal + currentBalance
    }, 0)
    const overviewNetWorthFromSectionTotals = assetsSectionTotalAtMarketValue - debtAndLoanTotal - creditAccountTotal
    const metricPriorityOrder = [
      'Net Worth',
      'Monthly Income',
      'Monthly Expenses',
      'Monthly Surplus / Deficit',
      'Savings Rate',
      'Monthly Savings',
      'Total Debts',
      'Monthly Debt Payback',
      'Debt to Income Ratio',
      'Credit Card Utilization',
      'Credit Card Debt',
      'Credit Card Capacity',
      'Emergency Funds',
      'Emergency Funds Goal',
      'Emergency Fund Gap',
      'Income After Debt Minimums',
      'Discretionary After Expenses + Debt',
      'Months Until Debt-Free',
      'Weighted Interest Rate',
      'Secured Debt Loan-To-Value',
      'Secured Equity',
      'Secured Collateral Market Value',
      'Debt Balance Without Mortgage',
      'Mortgage Share Of Liabilities',
      'Non-Mortgage Liability Share',
      'Cash Runway After Debt Service',
      'Emergency Fund Coverage (Months)',
      'Projected Net Worth (12 Months)',
      'Projected Net Worth (6 Months)',
      'Projected Net Worth (3 Months)',
      'Net Worth Change vs Last Month',
      'Income Change vs Last Month',
      'Expense Change vs Last Month',
      'Liabilities Change vs Last Month',
      'Debt Coverage By Assets',
      'Liabilities As % Of Assets',
      'Debt Minimums As % Of Expenses',
      'Debt Paydown Velocity',
      'Annual Debt Service',
      'Yearly Income',
      'Goals Completed',
      'Goals In Progress',
      'Goals Not Started',
      'Travel Goals Completed',
      'Travel Goals On Bucket List'
    ]
    const metricPriorityIndexByName = new Map(metricPriorityOrder.map((metricName, metricIndex) => [metricName, metricIndex]))
    const sortedRows = detailedDashboardRows.map((rowItem) => (
      String(rowItem.metric) === 'Net Worth'
        ? { ...rowItem, value: overviewNetWorthFromSectionTotals, description: 'Asset market value total minus debts/loans and credit account balances.' }
        : rowItem
    )).sort((leftRow, rightRow) => {
      const leftPriority = metricPriorityIndexByName.get(String(leftRow.metric))
      const rightPriority = metricPriorityIndexByName.get(String(rightRow.metric))
      const safeLeftPriority = typeof leftPriority === 'number' ? leftPriority : Number.MAX_SAFE_INTEGER
      const safeRightPriority = typeof rightPriority === 'number' ? rightPriority : Number.MAX_SAFE_INTEGER
      if (safeLeftPriority !== safeRightPriority) return safeLeftPriority - safeRightPriority
      return String(leftRow.metric).localeCompare(String(rightRow.metric))
    })
    const goalMetricNames = ['Goals Completed', 'Goals In Progress', 'Goals Not Started']
    const goalRows = goalMetricNames
      .map((metricName) => sortedRows.find((rowItem) => String(rowItem.metric) === metricName))
      .filter(Boolean)
    const nonGoalRows = sortedRows.filter((rowItem) => !goalMetricNames.includes(String(rowItem.metric)))
    const primaryRowCount = Math.max(0, 20 - goalRows.length)
    return [...nonGoalRows.slice(0, primaryRowCount), ...goalRows].slice(0, 20)
  }, [creditCardInformationCollection, detailedDashboardRows, safeCollections.assetHoldings, safeCollections.debts, safeCollections.loans, shouldSkipHeavyComputations])
  const incomeAndExpenseRows = React.useMemo(() => {
    if (shouldSkipHeavyComputations) return []
    const [recordRows, recordRowsError] = calculateUnifiedFinancialRecordsSourceOfTruthFromCollectionsState(safeCollections)
    if (recordRowsError || !recordRows) return []
    return recordRows.filter((rowItem) => String(rowItem.recordType).toLowerCase() !== 'asset')
  }, [safeCollections, shouldSkipHeavyComputations])

  const goalRowsSortedByTimeframeAndStatus = React.useMemo(
    () => buildRowsSortedByKeyAndDirection(safeCollections.goals, tableSortState.goals.key, tableSortState.goals.direction),
    [safeCollections.goals, tableSortState.goals]
  )

  const debtRows = React.useMemo(() => [...safeCollections.debts, ...safeCollections.loans], [safeCollections.debts, safeCollections.loans])
  const debtRowsWithCollectionContext = React.useMemo(() => ([
    ...safeCollections.debts.map((rowItem) => ({ ...rowItem, __collectionName: 'debts' })),
    ...safeCollections.loans.map((rowItem) => ({ ...rowItem, __collectionName: 'loans' }))
  ]), [safeCollections.debts, safeCollections.loans])
  const debtRowsSorted = React.useMemo(
    () => buildRowsSortedByKeyAndDirection(debtRowsWithCollectionContext, tableSortState.debts.key, tableSortState.debts.direction),
    [debtRowsWithCollectionContext, tableSortState.debts]
  )
  const loanCalculatorSourceRows = React.useMemo(() => {
    if (shouldSkipHeavyComputations) return []
    return debtRowsWithCollectionContext.map((rowItem, rowIndex) => {
      const collectionName = String(rowItem.__collectionName || 'debts')
      const rowId = typeof rowItem.id === 'string' ? rowItem.id : `${collectionName}-idx-${rowIndex}`
      const rowKey = `${collectionName}:${rowId}`
      const person = typeof rowItem.person === 'string' ? rowItem.person : DEFAULT_PERSONA_NAME
      const item = typeof rowItem.item === 'string'
        ? rowItem.item
        : (typeof rowItem.category === 'string' ? rowItem.category : 'Loan')
      const amount = typeof rowItem.amount === 'number' ? rowItem.amount : 0
      const minimumPayment = typeof rowItem.minimumPayment === 'number' ? rowItem.minimumPayment : 0
      const interestRatePercent = typeof rowItem.interestRatePercent === 'number' ? rowItem.interestRatePercent : 0
      return {
        key: rowKey,
        label: `${normalizePersonaNameForDisplay(person)} - ${item}`,
        amount,
        minimumPayment,
        interestRatePercent
      }
    })
  }, [debtRowsWithCollectionContext, shouldSkipHeavyComputations])
  const creditRowsSorted = React.useMemo(
    () => buildRowsSortedByKeyAndDirection(creditCardInformationCollection, tableSortState.credit.key, tableSortState.credit.direction),
    [creditCardInformationCollection, tableSortState.credit]
  )
  const detailedRowsSorted = React.useMemo(
    () => buildRowsSortedByKeyAndDirection(detailedDashboardRows, tableSortState.detailed.key, tableSortState.detailed.direction),
    [detailedDashboardRows, tableSortState.detailed]
  )
  const incomeExpenseRowsSorted = React.useMemo(
    () => buildRowsSortedByKeyAndDirection(incomeAndExpenseRows, tableSortState.records.key, tableSortState.records.direction),
    [incomeAndExpenseRows, tableSortState.records]
  )
  const recordsFlowSummary = React.useMemo(() => {
    const runningTotals = { totalIn: 0, totalOut: 0, diff: 0 }
    for (const rowItem of incomeExpenseRowsSorted) {
      const recordType = typeof rowItem.recordType === 'string' ? rowItem.recordType : ''
      const amount = typeof rowItem.amount === 'number' ? rowItem.amount : 0
      if (recordType === 'income') {
        runningTotals.totalIn += amount
        runningTotals.diff += amount
      } else {
        runningTotals.totalOut += amount
        runningTotals.diff -= amount
      }
    }
    return runningTotals
  }, [incomeExpenseRowsSorted])
  const savingsStorageRowsSorted = React.useMemo(
    () => buildRowsSortedByKeyAndDirection(monthlySavingsStorageSummary.storageRows, tableSortState.savings.key, tableSortState.savings.direction),
    [monthlySavingsStorageSummary.storageRows, tableSortState.savings]
  )
  const savingsProjectionRows = React.useMemo(() => {
    const startingSavings = typeof monthlySavingsStorageSummary.totalStoredSavings === 'number'
      ? monthlySavingsStorageSummary.totalStoredSavings
      : 0
    const monthlySavingsPace = typeof monthlySavingsStorageSummary.monthlySavingsAmount === 'number'
      ? monthlySavingsStorageSummary.monthlySavingsAmount
      : 0
    const projectionWindows = [
      { label: '6 Months', months: 6 },
      { label: '1 Year', months: 12 },
      { label: '2 Years', months: 24 },
      { label: '5 Years', months: 60 },
      { label: '10 Years', months: 120 }
    ]
    return projectionWindows.map((windowItem) => ({
      id: windowItem.label.toLowerCase().replace(/\s+/g, '-'),
      label: windowItem.label,
      projectedSavings: startingSavings + (monthlySavingsPace * windowItem.months)
    }))
  }, [monthlySavingsStorageSummary.totalStoredSavings, monthlySavingsStorageSummary.monthlySavingsAmount])
  const netWorthProjectionProfiles = React.useMemo(() => {
    if (shouldSkipHeavyComputations) return null
    const [projectionRows, projectionRowsError] = calculateNetWorthProjectionProfilesUsingThreeAggressionLayers(safeCollections)
    if (projectionRowsError || !projectionRows) return null
    return projectionRows
  }, [safeCollections, shouldSkipHeavyComputations])
  const selectedNetWorthProjectionProfile = React.useMemo(() => {
    if (!netWorthProjectionProfiles) return null
    const selectedProfile = netWorthProjectionProfiles.profiles.find((profileItem) => profileItem.id === netWorthProjectionProfileId)
    return selectedProfile ?? netWorthProjectionProfiles.profiles[0] ?? null
  }, [netWorthProjectionProfiles, netWorthProjectionProfileId])
  const netWorthProjectionBaselineVariables = netWorthProjectionProfiles?.baselineVariables ?? {
    startingAssetValueFromDataset: 0,
    startingLiabilityBalanceFromDataset: 0,
    totalMonthlyIncomeFromDataset: 0,
    totalMonthlyExpensesFromDataset: 0,
    monthlySavingsPaceBaselineFromDataset: 0,
    totalMonthlyDebtPaymentsFromDataset: 0,
    weightedAprPercentFromDataset: 0
  }
  const assetHoldingRows = React.useMemo(() => (
    (Array.isArray(safeCollections.assetHoldings) ? safeCollections.assetHoldings : []).map((rowItem) => {
      const assetValueOwed = typeof rowItem.assetValueOwed === 'number' ? rowItem.assetValueOwed : 0
      const assetMarketValue = typeof rowItem.assetMarketValue === 'number' ? rowItem.assetMarketValue : 0
      return {
        ...rowItem,
        value: assetMarketValue - assetValueOwed
      }
    })
  ), [safeCollections.assetHoldings])
  const assetHoldingRowsSorted = React.useMemo(
    () => buildRowsSortedByKeyAndDirection(assetHoldingRows, tableSortState.assets.key, tableSortState.assets.direction),
    [assetHoldingRows, tableSortState.assets]
  )
  const totalAssetHoldingsValue = React.useMemo(
    () => assetHoldingRows.reduce((runningTotal, rowItem) => runningTotal + (typeof rowItem.value === 'number' ? rowItem.value : 0), 0),
    [assetHoldingRows]
  )
  const maxProjectedSavingsValue = React.useMemo(() => (
    savingsProjectionRows.reduce((runningMax, projectionRow) => (
      Math.max(runningMax, Math.max(0, projectionRow.projectedSavings))
    ), 0)
  ), [savingsProjectionRows])
  const emergencyGoalExpenseLines = React.useMemo(() => {
    const monthlyExpenseRows = safeCollections.expenses
      .map((expenseRow, expenseIndex) => {
        const itemName = typeof expenseRow.item === 'string' ? expenseRow.item : `Expense ${expenseIndex + 1}`
        const monthlyAmount = typeof expenseRow.amount === 'number' ? expenseRow.amount : 0
        return { itemName, monthlyAmount }
      })
      .filter((rowItem) => rowItem.monthlyAmount > 0)
    const monthlyDebtRows = [...safeCollections.debts, ...safeCollections.loans, ...safeCollections.credit]
      .map((debtRow, debtIndex) => {
        const itemName = typeof debtRow.item === 'string' ? debtRow.item : `Debt ${debtIndex + 1}`
        const monthlyAmount = typeof debtRow.minimumPayment === 'number' ? debtRow.minimumPayment : 0
        return { itemName, monthlyAmount }
      })
      .filter((rowItem) => rowItem.monthlyAmount > 0)
    const monthlyExpenseTotal = monthlyExpenseRows.reduce((runningTotal, rowItem) => runningTotal + rowItem.monthlyAmount, 0)
    const monthlyDebtTotal = monthlyDebtRows.reduce((runningTotal, rowItem) => runningTotal + rowItem.monthlyAmount, 0)
    const monthlyObligationTotal = monthlyExpenseTotal + monthlyDebtTotal
    const sixMonthTotal = monthlyObligationTotal * 6
    return [
      'Emergency Goal Formula',
      `Monthly Expenses: ${formatCurrencyValueForDashboard(monthlyExpenseTotal)}`,
      `Monthly Debt Minimums: ${formatCurrencyValueForDashboard(monthlyDebtTotal)}`,
      `Monthly Obligations Total: ${formatCurrencyValueForDashboard(monthlyObligationTotal)}`,
      `6-Month Goal: ${formatCurrencyValueForDashboard(sixMonthTotal)}`,
      ...monthlyExpenseRows.map((rowItem) => `- Expense ${rowItem.itemName}: ${formatCurrencyValueForDashboard(rowItem.monthlyAmount)} / mo | ${formatCurrencyValueForDashboard(rowItem.monthlyAmount * 6)} in 6 months`),
      ...monthlyDebtRows.map((rowItem) => `- Debt ${rowItem.itemName}: ${formatCurrencyValueForDashboard(rowItem.monthlyAmount)} / mo | ${formatCurrencyValueForDashboard(rowItem.monthlyAmount * 6)} in 6 months`)
    ]
  }, [safeCollections.credit, safeCollections.debts, safeCollections.expenses, safeCollections.loans])
  const totalMonthlyDebtPayment = React.useMemo(
    () => debtRows.reduce((runningTotal, debtItem) => runningTotal + (typeof debtItem.minimumPayment === 'number' ? debtItem.minimumPayment : 0), 0),
    [debtRows]
  )
  const totalMortgageBalance = React.useMemo(
    () => safeCollections.debts.reduce((runningTotal, debtItem) => (
      runningTotal + (typeof debtItem.item === 'string' && debtItem.item.toLowerCase().includes('mortgage') && typeof debtItem.amount === 'number' ? debtItem.amount : 0)
    ), 0),
    [safeCollections.debts]
  )
  const personaOptions = React.useMemo(() => {
    if (shouldSkipHeavyComputations) return []
    const discoveredNames = [
      ...safeCollections.income,
      ...safeCollections.expenses,
      ...safeCollections.debts,
      ...safeCollections.credit,
      ...safeCollections.loans,
      ...safeCollections.creditCards
    ]
      .map((rowItem) => normalizePersonaNameForDisplay(typeof rowItem.person === 'string' ? rowItem.person : ''))
      .filter((nameValue) => nameValue.length > 0)
    const explicitlyAddedNames = Array.isArray(safeCollections.personas)
      ? safeCollections.personas
        .map((personaItem) => {
          if (!personaItem || typeof personaItem !== 'object') return ''
          return normalizePersonaNameForDisplay(typeof personaItem.name === 'string' ? personaItem.name : '')
        })
        .filter((nameValue) => nameValue.length > 0)
      : []

    const normalizedMap = new Map()
    for (const personaName of [...explicitlyAddedNames, ...discoveredNames]) {
      const normalizedName = normalizePersonaNameForDisplay(personaName)
      const key = normalizedName.toLowerCase()
      if (!normalizedMap.has(key)) normalizedMap.set(key, normalizedName)
    }
    return Array.from(normalizedMap.values())
  }, [safeCollections, shouldSkipHeavyComputations])
  const personaEmojiByName = React.useMemo(() => {
    const emojiByName = new Map([["cam", DEFAULT_PERSONA_EMOJI]])
    if (Array.isArray(safeCollections.personas)) {
      for (const personaItem of safeCollections.personas) {
        if (!personaItem || typeof personaItem !== "object") continue
        const name = normalizePersonaNameForDisplay(typeof personaItem.name === "string" ? personaItem.name : "")
        const emoji = typeof personaItem.emoji === "string" ? personaItem.emoji.trim() : ""
        if (name.length > 0 && emoji.length > 0) emojiByName.set(name.toLowerCase(), emoji)
      }
    }
    return emojiByName
  }, [safeCollections.personas])
  const personaSelectOptions = React.useMemo(() => {
    return personaOptions.map((personaName) => ({ value: personaName, label: formatPersonaLabelWithEmoji(personaName, personaEmojiByName) }))
  }, [personaOptions, personaEmojiByName])
  const selectedPersonaImpactSummary = React.useMemo(() => {
    if (shouldSkipHeavyComputations) return null
    const selectedPersonaName = normalizePersonaNameForDisplay(personaCrudFormState.personaName)
    if (!selectedPersonaName) return null
    const [summary, summaryError] = buildPersonaImpactSummaryFromCollectionsStateByPersonaName(collections, selectedPersonaName)
    if (summaryError || !summary) return null
    return summary
  }, [collections, personaCrudFormState.personaName, shouldSkipHeavyComputations])
  const reassignablePersonaOptions = React.useMemo(() => {
    const selectedPersonaName = normalizePersonaNameForDisplay(personaCrudFormState.personaName).toLowerCase()
    return personaOptions.filter((personaName) => normalizePersonaNameForDisplay(personaName).toLowerCase() !== selectedPersonaName)
  }, [personaCrudFormState.personaName, personaOptions])
  const selectedRiskTemplate = React.useMemo(() => {
    if (!selectedRiskFinding) return null
    return buildRiskDetailTemplateFromFindingAndPersonas(selectedRiskFinding, personaSelectOptions.map((optionItem) => optionItem.label))
  }, [selectedRiskFinding, personaSelectOptions])

  if (isLoadingState) {
    return <main className="mx-auto min-h-screen w-full max-w-7xl p-4 md:p-8"><section className="rounded-3xl border border-white/20 bg-white/90 p-8 text-slate-700 shadow-2xl backdrop-blur">Loading local budgeting data...</section></main>
  }
  if (!collections) {
    return <main className="mx-auto min-h-screen w-full max-w-7xl p-4 md:p-8"><section className="rounded-3xl border border-red-300 bg-white p-8 text-red-700 shadow-2xl">Unable to initialize collections state.</section></main>
  }

  function updateEntryFormFieldValue(fieldName, nextFieldValue) {
    setEntryFormState((previousFormState) => ({ ...previousFormState, [fieldName]: nextFieldValue }))
  }
  function updateGoalEntryFormFieldValue(fieldName, nextFieldValue) {
    setGoalEntryFormState((previousFormState) => ({ ...previousFormState, [fieldName]: nextFieldValue }))
  }
  function updatePersonaEntryFormFieldValue(fieldName, nextFieldValue) {
    setPersonaEntryFormState((previousFormState) => ({ ...previousFormState, [fieldName]: nextFieldValue }))
  }
  function updatePersonaCrudFormFieldValue(fieldName, nextFieldValue) {
    setPersonaCrudFormState((previousFormState) => ({ ...previousFormState, [fieldName]: nextFieldValue }))
  }
  function openManagePersonasModal() {
    setIsAddPersonaModalOpen(true)
    if (!personaCrudFormState.personaName && personaOptions.length > 0) {
      selectPersonaForCrudByName(personaOptions[0])
    }
  }
  function updateProfileTransferFormFieldValue(fieldName, nextFieldValue) {
    setProfileTransferFormState((previousFormState) => ({ ...previousFormState, [fieldName]: nextFieldValue }))
  }
  function updateSupabaseSyncFormFieldValue(fieldName, nextFieldValue) {
    setSupabaseSyncFormState((previousFormState) => ({ ...previousFormState, [fieldName]: nextFieldValue }))
  }
  function updateFirebaseSyncFormFieldValue(fieldName, nextFieldValue) {
    setFirebaseSyncFormState((previousFormState) => ({ ...previousFormState, [fieldName]: nextFieldValue }))
  }
  function updateAssetHoldingEntryFormFieldValue(fieldName, nextFieldValue) {
    setAssetHoldingEntryFormState((previousFormState) => ({ ...previousFormState, [fieldName]: nextFieldValue }))
  }
  function updateLoanCalculatorFormFieldValue(fieldName, nextFieldValue) {
    setLoanCalculatorFormState((previousFormState) => ({ ...previousFormState, [fieldName]: nextFieldValue }))
  }
  function selectLoanRecordForCalculatorByKey(selectedLoanKey) {
    const selectedLoan = loanCalculatorSourceRows.find((rowItem) => rowItem.key === selectedLoanKey)
    if (!selectedLoan) {
      setLoanCalculatorFormState((previousFormState) => ({ ...previousFormState, selectedLoanKey }))
      return
    }
    setLoanCalculatorFormState((previousFormState) => ({
      ...previousFormState,
      selectedLoanKey,
      principalBalance: String(selectedLoan.amount),
      annualInterestRatePercent: String(selectedLoan.interestRatePercent),
      baseMonthlyPayment: String(selectedLoan.minimumPayment)
    }))
  }
  function cloneCollectionsStateForUndoSnapshot(sourceCollectionsState) {
    if (typeof globalThis.structuredClone === 'function') {
      return globalThis.structuredClone(sourceCollectionsState)
    }
    return JSON.parse(JSON.stringify(sourceCollectionsState))
  }
  async function appendAuditTimelineEntryForStateChange(contextTag, nextCollectionsState) {
    const [isoTimestamp, timestampError] = readCurrentIsoTimestampForBudgetRecordUpdates()
    if (timestampError || !isoTimestamp) return
    const [monthlySummary, monthlySummaryError] = calculateMonthlyIncomeExpenseSummaryFromCollectionsState(nextCollectionsState)
    if (monthlySummaryError || !monthlySummary) return
    const [metrics, metricsError] = calculateTwentyDashboardHealthMetricsFromFinancialCollections(nextCollectionsState)
    if (metricsError || !metrics) return
    const nextEntry = {
      id: `audit-${isoTimestamp}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: isoTimestamp,
      contextTag,
      summary: {
        totalIncome: monthlySummary.totalIncome,
        totalExpenses: monthlySummary.totalExpenses,
        netWorth: metrics.netWorth
      },
      snapshot: cloneCollectionsStateForUndoSnapshot(nextCollectionsState)
    }
    const nextTimeline = [nextEntry, ...auditTimelineEntries].slice(0, 120)
    setAuditTimelineEntries(nextTimeline)
    const [, persistError] = await persistAuditTimelineIntoLocalStorageCache(nextTimeline)
    if (persistError) console.warn('[audit] Failed to persist audit timeline entry.', persistError)
  }
  async function syncCollectionsStateToSupabaseWhenConnected(nextCollectionsState, contextTag) {
    if (!supabaseSyncFormState.enabled) return
    if (!supabaseAuthUserSummary || !supabaseAuthUserSummary.id) return
    const [syncResult, syncError] = await pushCompleteFinancialProfileIntoSupabaseForAuthenticatedUser(
      supabaseSyncFormState,
      nextCollectionsState,
      { themeName, textScaleMultiplier, tableSortState },
      auditTimelineEntries
    )
    if (syncError || !syncResult) {
      console.warn('[supabase] Auto-sync failed after local change.', { contextTag, syncError })
      return
    }
    console.info('[supabase] Auto-sync completed after local change.', { contextTag, savedAtIso: syncResult.savedAtIso })
  }
  function pushCurrentCollectionsStateIntoUndoStackWithLimit() {
    // Critical path: undo must preserve a full pre-transaction snapshot.
    const snapshot = cloneCollectionsStateForUndoSnapshot(collections)
    transactionUndoStackRef.current.push(snapshot)
    if (transactionUndoStackRef.current.length > 25) {
      transactionUndoStackRef.current.shift()
    }
    setTransactionUndoDepth(transactionUndoStackRef.current.length)
  }
  async function applyNextCollectionsStateWithUndoForTransaction(nextCollectionsState, contextTag) {
    pushCurrentCollectionsStateIntoUndoStackWithLimit()
    const [persistSuccess, persistError] = await persistBudgetCollectionsStateIntoLocalStorageCache(nextCollectionsState)
    if (persistError || !persistSuccess) {
      transactionUndoStackRef.current.pop()
      setTransactionUndoDepth(transactionUndoStackRef.current.length)
      console.warn('[records] Failed to persist transaction state change.', { contextTag, persistError })
      return false
    }
    setCollections(nextCollectionsState)
    await appendAuditTimelineEntryForStateChange(contextTag, nextCollectionsState)
    await syncCollectionsStateToSupabaseWhenConnected(nextCollectionsState, contextTag)
    return true
  }
  async function undoMostRecentTransactionChangeFromUndoStack() {
    if (transactionUndoStackRef.current.length === 0) return
    const previousCollectionsState = transactionUndoStackRef.current.pop()
    const [persistSuccess, persistError] = await persistBudgetCollectionsStateIntoLocalStorageCache(previousCollectionsState)
    if (persistError || !persistSuccess) {
      transactionUndoStackRef.current.push(previousCollectionsState)
      setTransactionUndoDepth(transactionUndoStackRef.current.length)
      console.warn('[records] Failed to persist undo transaction state.', persistError)
      return
    }
    setCollections(previousCollectionsState)
    setTransactionUndoDepth(transactionUndoStackRef.current.length)
    await appendAuditTimelineEntryForStateChange('undo-transaction', previousCollectionsState)
    await syncCollectionsStateToSupabaseWhenConnected(previousCollectionsState, 'undo-transaction')
  }
  async function restoreCollectionsSnapshotFromAuditEntryById(entryId) {
    const targetEntry = auditTimelineEntries.find((entryItem) => String(entryItem.id) === String(entryId))
    if (!targetEntry || !targetEntry.snapshot || typeof targetEntry.snapshot !== 'object') return
    const shouldRestore = window.confirm('Restore this snapshot? This will replace current state.')
    if (!shouldRestore) return
    const nextCollectionsState = cloneCollectionsStateForUndoSnapshot(targetEntry.snapshot)
    const [persistSuccess, persistError] = await persistBudgetCollectionsStateIntoLocalStorageCache(nextCollectionsState)
    if (persistError || !persistSuccess) {
      console.warn('[audit] Failed to persist restored snapshot.', persistError)
      return
    }
    pushCurrentCollectionsStateIntoUndoStackWithLimit()
    setCollections(nextCollectionsState)
    await appendAuditTimelineEntryForStateChange('restore-snapshot', nextCollectionsState)
    await syncCollectionsStateToSupabaseWhenConnected(nextCollectionsState, 'restore-snapshot')
  }

  async function submitNewIncomeOrExpenseRecord(submitEvent) {
    submitEvent.preventDefault()
    const normalizedPerson = normalizePersonaNameForDisplay(entryFormState.person === '__custom__'
      ? entryFormState.customPerson
      : entryFormState.person)
    const normalizedCategory = entryFormState.category === '__custom__'
      ? entryFormState.customCategory.trim()
      : entryFormState.category
    const [isoTimestamp, timestampError] = readCurrentIsoTimestampForBudgetRecordUpdates()
    if (timestampError || !isoTimestamp) return
    let nextCollectionsState = null
    if (entryFormState.recordType === 'asset') {
      const nextAssetRecord = {
        id: `asset-holding-${isoTimestamp}-${(Array.isArray(collections.assetHoldings) ? collections.assetHoldings.length : 0) + 1}`,
        person: normalizedPerson,
        item: normalizedCategory || 'Asset',
        assetValueOwed: 0,
        assetMarketValue: Number(entryFormState.amount),
        description: entryFormState.description,
        date: entryFormState.date,
        updatedAt: isoTimestamp
      }
      nextCollectionsState = {
        ...collections,
        assetHoldings: [...(Array.isArray(collections.assetHoldings) ? collections.assetHoldings : []), nextAssetRecord]
      }
    } else if (entryFormState.recordType === 'debt' || entryFormState.recordType === 'loan') {
      const liabilityCollectionName = entryFormState.recordType === 'debt' ? 'debts' : 'loans'
      const nextLiabilityRecord = {
        id: `${entryFormState.recordType}-${isoTimestamp}-${(Array.isArray(collections[liabilityCollectionName]) ? collections[liabilityCollectionName].length : 0) + 1}`,
        person: normalizedPerson,
        item: typeof entryFormState.item === 'string' && entryFormState.item.trim() ? entryFormState.item.trim() : (normalizedCategory || 'Liability'),
        category: normalizedCategory || 'Debt Payment',
        amount: Number(entryFormState.amount || 0),
        minimumPayment: Number(entryFormState.minimumPayment || 0),
        interestRatePercent: Number(entryFormState.interestRatePercent || 0),
        remainingPayments: Number(entryFormState.remainingPayments || 0),
        loanStartDate: entryFormState.loanStartDate || entryFormState.date,
        collateralAssetName: typeof entryFormState.collateralAssetName === 'string' ? entryFormState.collateralAssetName.trim() : '',
        collateralAssetMarketValue: Number(entryFormState.collateralAssetMarketValue || 0),
        description: entryFormState.description,
        date: entryFormState.date,
        updatedAt: isoTimestamp
      }
      nextCollectionsState = {
        ...collections,
        [liabilityCollectionName]: [...(Array.isArray(collections[liabilityCollectionName]) ? collections[liabilityCollectionName] : []), nextLiabilityRecord]
      }
    } else if (entryFormState.recordType === 'credit_card') {
      const nextCreditCardRecord = {
        id: `credit-card-${isoTimestamp}-${(Array.isArray(collections.creditCards) ? collections.creditCards.length : 0) + 1}`,
        person: normalizedPerson,
        item: typeof entryFormState.item === 'string' && entryFormState.item.trim() ? entryFormState.item.trim() : 'Credit Account',
        maxCapacity: Number(entryFormState.maxCapacity || 0),
        currentBalance: Number(entryFormState.currentBalance || 0),
        minimumPayment: Number(entryFormState.minimumPayment || 0),
        monthlyPayment: Number(entryFormState.monthlyPayment || 0),
        interestRatePercent: Number(entryFormState.interestRatePercent || 0),
        description: entryFormState.description,
        date: entryFormState.date,
        updatedAt: isoTimestamp
      }
      nextCollectionsState = {
        ...collections,
        creditCards: [...(Array.isArray(collections.creditCards) ? collections.creditCards : []), nextCreditCardRecord]
      }
    } else {
      const [appendState, appendError] = appendValidatedIncomeOrExpenseRecordIntoCollectionsState(
        collections,
        entryFormState.recordType,
        { person: normalizedPerson, amount: Number(entryFormState.amount), category: normalizedCategory, date: entryFormState.date, description: entryFormState.description },
        isoTimestamp
      )
      if (appendError || !appendState) {
        console.warn('[records] Failed to append income/expense record.', appendError)
        return
      }
      nextCollectionsState = appendState
    }
    const didApply = await applyNextCollectionsStateWithUndoForTransaction(nextCollectionsState, 'add-income-expense-asset')
    if (!didApply) {
      return
    }
    setEntryFormState(buildInitialIncomeExpenseEntryFormState())
    setIsAddRecordModalOpen(false)
  }

  function openAddRecordModalWithPresetTypeAndCategory(recordType, category) {
    setEntryFormState((previousFormState) => ({
      ...previousFormState,
      recordType,
      category,
      customCategory: '',
      item: '',
      amount: '',
      minimumPayment: '',
      monthlyPayment: '',
      interestRatePercent: '',
      remainingPayments: '',
      loanStartDate: '',
      collateralAssetName: '',
      collateralAssetMarketValue: '',
      maxCapacity: '',
      currentBalance: '',
      description: ''
    }))
    setIsAddRecordModalOpen(true)
  }

  async function submitNewAssetHoldingRecord(submitEvent) {
    submitEvent.preventDefault()
    const normalizedPerson = normalizePersonaNameForDisplay(assetHoldingEntryFormState.person === '__custom__'
      ? assetHoldingEntryFormState.customPerson
      : assetHoldingEntryFormState.person)
    const normalizedItem = typeof assetHoldingEntryFormState.item === 'string' ? assetHoldingEntryFormState.item.trim() : ''
    if (!normalizedItem) {
      console.warn('[assets] Asset item is required.')
      return
    }
    const [isoTimestamp, timestampError] = readCurrentIsoTimestampForBudgetRecordUpdates()
    if (timestampError || !isoTimestamp) return
    const nextRecord = {
      id: `asset-holding-${isoTimestamp}-${(Array.isArray(collections.assetHoldings) ? collections.assetHoldings.length : 0) + 1}`,
      person: normalizedPerson,
      item: normalizedItem,
      assetValueOwed: Number(assetHoldingEntryFormState.assetValueOwed || 0),
      assetMarketValue: Number(assetHoldingEntryFormState.assetMarketValue || 0),
      description: typeof assetHoldingEntryFormState.description === 'string' ? assetHoldingEntryFormState.description : '',
      date: assetHoldingEntryFormState.date,
      updatedAt: isoTimestamp
    }
    const nextCollectionsState = {
      ...collections,
      assetHoldings: [...(Array.isArray(collections.assetHoldings) ? collections.assetHoldings : []), nextRecord]
    }
    const didApply = await applyNextCollectionsStateWithUndoForTransaction(nextCollectionsState, 'add-asset')
    if (!didApply) {
      return
    }
    setAssetHoldingEntryFormState(buildInitialAssetHoldingEntryFormState())
    setIsAddAssetModalOpen(false)
  }

  async function submitNewGoalRecord(submitEvent) {
    submitEvent.preventDefault()
    const [isoTimestamp, timestampError] = readCurrentIsoTimestampForBudgetRecordUpdates()
    if (timestampError || !isoTimestamp) return
    const [nextCollectionsState, appendError] = appendValidatedGoalRecordIntoCollectionsState(
      collections,
      { title: goalEntryFormState.title, status: goalEntryFormState.status, timeframeMonths: Number(goalEntryFormState.timeframeMonths), description: goalEntryFormState.description },
      isoTimestamp
    )
    if (appendError || !nextCollectionsState) {
      console.warn('[goals] Failed to append goal record.', appendError)
      return
    }
    const [persistSuccess, persistError] = await persistBudgetCollectionsStateIntoLocalStorageCache(nextCollectionsState)
    if (persistError || !persistSuccess) {
      console.warn('[goals] Failed to persist goal changes.', persistError)
      return
    }
    setCollections(nextCollectionsState)
    await syncCollectionsStateToSupabaseWhenConnected(nextCollectionsState, 'add-goal')
    setGoalEntryFormState(buildInitialGoalEntryFormState())
    setIsAddGoalModalOpen(false)
  }

  async function submitNewPersonaRecord(submitEvent) {
    submitEvent.preventDefault()
    const normalizedName = normalizePersonaNameForDisplay(personaEntryFormState.name)
    const normalizedNote = personaEntryFormState.note.trim()
    if (!normalizedName) {
      console.warn('[personas] Persona name is required.')
      return
    }
    const [isoTimestamp, timestampError] = readCurrentIsoTimestampForBudgetRecordUpdates()
    if (timestampError || !isoTimestamp) return

    const existingPersonas = Array.isArray(collections.personas) ? collections.personas : []
    const alreadyExists = existingPersonas.some((personaItem) => {
      if (!personaItem || typeof personaItem !== 'object') return false
      return typeof personaItem.name === 'string' && personaItem.name.trim().toLowerCase() === normalizedName.toLowerCase()
    })
    if (alreadyExists) {
      console.info('[personas] Persona already exists; skipping duplicate add.', normalizedName)
      setPersonaEntryFormState(buildInitialPersonaEntryFormState())
      selectPersonaForCrudByName(normalizedName)
      return
    }

    const nextPersonaRecord = {
      id: `persona-${isoTimestamp}-${existingPersonas.length + 1}`,
      name: normalizedName,
      note: normalizedNote,
      emoji: (personaEntryFormState.customEmoji.trim() || personaEntryFormState.emojiPreset || DEFAULT_PERSONA_EMOJI),
      updatedAt: isoTimestamp
    }
    const nextCollectionsState = {
      ...collections,
      personas: [...existingPersonas, nextPersonaRecord]
    }

    const [persistSuccess, persistError] = await persistBudgetCollectionsStateIntoLocalStorageCache(nextCollectionsState)
    if (persistError || !persistSuccess) {
      console.warn('[personas] Failed to persist new persona.', persistError)
      return
    }
    setCollections(nextCollectionsState)
    await syncCollectionsStateToSupabaseWhenConnected(nextCollectionsState, 'add-persona')
    setPersonaEntryFormState(buildInitialPersonaEntryFormState())
    setPersonaCrudFormState({
      personaName: normalizedName,
      mode: 'edit',
      nextName: normalizedName,
      nextNote: normalizedNote,
      nextEmojiPreset: (personaEntryFormState.customEmoji.trim() || personaEntryFormState.emojiPreset || DEFAULT_PERSONA_EMOJI),
      nextCustomEmoji: '',
      reassignToPersonaName: DEFAULT_PERSONA_NAME,
      deleteConfirmText: ''
    })
  }

  function selectPersonaForCrudByName(personaName) {
    const normalizedName = normalizePersonaNameForDisplay(personaName)
    const personas = Array.isArray(collections.personas) ? collections.personas : []
    const personaItem = personas.find((rowItem) => {
      if (!rowItem || typeof rowItem !== 'object') return false
      const name = typeof rowItem.name === 'string' ? normalizePersonaNameForDisplay(rowItem.name) : ''
      return name.toLowerCase() === normalizedName.toLowerCase()
    })
    const emojiValue = personaItem && typeof personaItem.emoji === 'string' ? personaItem.emoji : DEFAULT_PERSONA_EMOJI
    const noteValue = personaItem && typeof personaItem.note === 'string' ? personaItem.note : ''
    setPersonaCrudFormState({
      personaName: normalizedName,
      mode: 'edit',
      nextName: normalizedName,
      nextNote: noteValue,
      nextEmojiPreset: emojiValue,
      nextCustomEmoji: '',
      reassignToPersonaName: DEFAULT_PERSONA_NAME,
      deleteConfirmText: ''
    })
  }

  async function restorePersonaDangerBackupIntoCollections() {
    if (!personaDangerBackupState || !personaDangerBackupState.collectionsStateSnapshot) return
    const [persistSuccess, persistError] = await persistBudgetCollectionsStateIntoLocalStorageCache(personaDangerBackupState.collectionsStateSnapshot)
    if (persistError || !persistSuccess) {
      console.warn('[personas] Failed to restore persona backup snapshot.', persistError)
      return
    }
    setCollections(personaDangerBackupState.collectionsStateSnapshot)
    await syncCollectionsStateToSupabaseWhenConnected(personaDangerBackupState.collectionsStateSnapshot, 'restore-persona-backup')
    setPersonaDangerBackupState(null)
    setPersonaCrudFormState(buildInitialPersonaCrudFormState())
  }

  async function submitPersonaCrudOperation(submitEvent) {
    submitEvent.preventDefault()
    const selectedPersonaName = normalizePersonaNameForDisplay(personaCrudFormState.personaName)
    if (!selectedPersonaName) {
      console.warn('[personas] Select a persona first.')
      return
    }
    const [isoTimestamp, timestampError] = readCurrentIsoTimestampForBudgetRecordUpdates()
    if (timestampError || !isoTimestamp) return

    if (personaCrudFormState.mode === 'edit') {
      const nextPersonaName = normalizePersonaNameForDisplay(personaCrudFormState.nextName)
      if (!nextPersonaName) {
        console.warn('[personas] Edited persona name is required.')
        return
      }
      const [nextCollectionsState, renameError] = renamePersonaAcrossCollectionsStateByName(
        collections,
        selectedPersonaName,
        nextPersonaName,
        {
          note: personaCrudFormState.nextNote,
          emoji: personaCrudFormState.nextCustomEmoji.trim() || personaCrudFormState.nextEmojiPreset || DEFAULT_PERSONA_EMOJI,
          updatedAt: isoTimestamp
        }
      )
      if (renameError || !nextCollectionsState) {
        console.warn('[personas] Failed to rename persona.', renameError)
        return
      }
      const [persistSuccess, persistError] = await persistBudgetCollectionsStateIntoLocalStorageCache(nextCollectionsState)
      if (persistError || !persistSuccess) {
        console.warn('[personas] Failed to persist persona edit.', persistError)
        return
      }
      setCollections(nextCollectionsState)
      await syncCollectionsStateToSupabaseWhenConnected(nextCollectionsState, 'edit-persona')
      selectPersonaForCrudByName(nextPersonaName)
      return
    }

    const [impactSummary, impactError] = buildPersonaImpactSummaryFromCollectionsStateByPersonaName(collections, selectedPersonaName)
    if (impactError || !impactSummary) {
      console.warn('[personas] Failed to build persona impact summary.', impactError)
      return
    }
    const mustType = `DELETE ${selectedPersonaName}`
    if (personaCrudFormState.mode === 'delete_cascade' && personaCrudFormState.deleteConfirmText.trim() !== mustType) {
      console.warn('[personas] Cascade delete requires exact confirm text.', { mustType })
      return
    }
    const normalizedReassignName = normalizePersonaNameForDisplay(personaCrudFormState.reassignToPersonaName)
    if (personaCrudFormState.mode === 'delete_reassign') {
      const isSamePersonaReassign = normalizedReassignName.toLowerCase() === selectedPersonaName.toLowerCase()
      const hasNoReassignTargets = reassignablePersonaOptions.length === 0
      if (isSamePersonaReassign || hasNoReassignTargets) {
        console.warn('[personas] Delete + Reassign requires another persona target. Use Delete Cascade for default-user-only profiles.')
        return
      }
    }
    console.warn('[personas] Running destructive persona operation.', {
      mode: personaCrudFormState.mode,
      persona: selectedPersonaName,
      impactedRecords: impactSummary.total
    })

    const deleteMode = personaCrudFormState.mode === 'delete_cascade' ? 'cascade' : 'reassign'
    const [nextCollectionsState, deleteError] = deletePersonaAcrossCollectionsStateByName(
      collections,
      selectedPersonaName,
      deleteMode,
      normalizedReassignName
    )
    if (deleteError || !nextCollectionsState) {
      console.warn('[personas] Failed to delete persona.', deleteError)
      return
    }

    const [persistSuccess, persistError] = await persistBudgetCollectionsStateIntoLocalStorageCache(nextCollectionsState)
    if (persistError || !persistSuccess) {
      console.warn('[personas] Failed to persist persona delete.', persistError)
      return
    }
    setPersonaDangerBackupState({
      at: isoTimestamp,
      collectionsStateSnapshot: collections
    })
    setCollections(nextCollectionsState)
    await syncCollectionsStateToSupabaseWhenConnected(nextCollectionsState, 'delete-persona')
    setPersonaCrudFormState(buildInitialPersonaCrudFormState())
  }

  async function openProfileTransferModalForMode(mode) {
    if (mode === 'export') {
      const [jsonText, jsonTextError] = await exportCompleteFinancialProfileAsJsonTextSnapshot(
        collections,
        { themeName, textScaleMultiplier, tableSortState },
        auditTimelineEntries
      )
      if (jsonTextError || !jsonText) {
        console.warn('[profile] Failed to export financial profile JSON.', jsonTextError)
        return
      }
      setProfileTransferFormState({ mode: 'export', jsonText })
      setIsProfileTransferModalOpen(true)
      return
    }
    setProfileTransferFormState({ mode: 'import', jsonText: '' })
    setIsProfileTransferModalOpen(true)
  }

  async function applyImportedProfileIntoLocalStateWithMergeAndRecompute(importedProfile, sourceTag) {
    if (!importedProfile || !importedProfile.collections) {
      console.warn('[profile] apply skipped: imported profile is missing collections.', { sourceTag })
      return false
    }
    console.info('[profile] Import parsed successfully.', {
      sourceTag,
      hasCollections: !!importedProfile.collections,
      hasUiPreferences: !!importedProfile.uiPreferences,
      auditEntries: Array.isArray(importedProfile.auditTimelineEntries) ? importedProfile.auditTimelineEntries.length : 0
    })
    const [mergedCollectionsState, mergeCollectionsError] = mergeImportedCollectionsStateWithExistingStateUsingDedupKeys(collections, importedProfile.collections)
    if (mergeCollectionsError || !mergedCollectionsState) {
      console.warn('[profile] Failed to merge imported collections with local data.', mergeCollectionsError)
      return false
    }
    const [persistSuccess, persistError] = await persistBudgetCollectionsStateIntoLocalStorageCache(mergedCollectionsState)
    if (persistError || !persistSuccess) {
      console.warn('[profile] Failed to persist imported financial profile JSON.', persistError)
      return false
    }
    console.info('[profile] Collections persisted.')
    if (importedProfile.uiPreferences) {
      const [persistUiSuccess, persistUiError] = await persistUiPreferencesIntoLocalStorageCache(importedProfile.uiPreferences)
      if (persistUiError || !persistUiSuccess) {
        console.warn('[profile] Failed to persist imported ui preferences.', persistUiError)
      } else {
        setThemeName(importedProfile.uiPreferences.themeName)
        setTextScaleMultiplier(importedProfile.uiPreferences.textScaleMultiplier)
        if (importedProfile.uiPreferences.tableSortState) {
          setTableSortState({
            ...DEFAULT_TABLE_SORT_STATE,
            ...importedProfile.uiPreferences.tableSortState
          })
        }
        console.info('[profile] UI preferences persisted and applied.')
      }
    }
    if (Array.isArray(importedProfile.auditTimelineEntries)) {
      const [mergedAuditTimelineEntries, mergeAuditError] = mergeAuditTimelineEntriesUsingDedupKeys(auditTimelineEntries, importedProfile.auditTimelineEntries)
      if (mergeAuditError || !mergedAuditTimelineEntries) {
        console.warn('[profile] Failed to merge imported audit timeline with local data.', mergeAuditError)
      } else {
        const [persistAuditSuccess, persistAuditError] = await persistAuditTimelineIntoLocalStorageCache(mergedAuditTimelineEntries)
        if (persistAuditError || !persistAuditSuccess) {
          console.warn('[profile] Failed to persist imported audit timeline.', persistAuditError)
        } else {
          setAuditTimelineEntries(mergedAuditTimelineEntries)
          console.info('[profile] Audit timeline persisted.', { count: mergedAuditTimelineEntries.length })
        }
      }
    }
    setCollections(mergedCollectionsState)
    await recomputeAndValidateDashboardDerivedStateAfterImport(mergedCollectionsState)
    await recomputeRiskFindingsFromCollectionsState(mergedCollectionsState)
    return true
  }
  async function submitImportedProfileJson(submitEvent) {
    submitEvent.preventDefault()
    console.info('[profile] Import started.')
    const [importedProfile, importedProfileError] = await importCompleteFinancialProfileFromJsonTextSnapshot(profileTransferFormState.jsonText)
    if (importedProfileError || !importedProfile) {
      console.warn('[profile] Failed to import financial profile JSON.', importedProfileError)
      return
    }
    const didApply = await applyImportedProfileIntoLocalStateWithMergeAndRecompute(importedProfile, 'json-textarea')
    if (!didApply) return
    setIsProfileTransferModalOpen(false)
    setProfileTransferFormState(buildInitialProfileTransferFormState())
    console.info('[profile] Import completed successfully.')
  }
  async function copyProfileTransferJsonTextToClipboard() {
    const [copySuccess, copyError] = await copyTextToClipboardUsingBrowserApi(profileTransferFormState.jsonText)
    if (copyError || !copySuccess) {
      console.warn('[profile] Failed to copy profile json to clipboard.', copyError)
      return
    }
  }
  async function copySupabaseProvisioningSqlToClipboard() {
    const [copySuccess, copyError] = await copyTextToClipboardUsingBrowserApi(SUPABASE_PROVISIONING_SQL_SCRIPT)
    if (copyError || !copySuccess) {
      console.warn('[supabase] Failed to copy provisioning SQL.', copyError)
      setSupabaseSyncStatusState({ tone: 'warning', message: 'Failed to copy SQL script.', detail: '' })
      return
    }
    setSupabaseSyncStatusState({ tone: 'success', message: 'Provisioning SQL copied.', detail: 'Paste into Supabase SQL Editor and run once.' })
  }
  async function saveSupabaseWebConfigIntoCache() {
    setSupabaseSyncStatusState({ tone: 'neutral', message: 'Saving Supabase config...', detail: '' })
    const [isConfigValid, configValidationMessage] = validateSupabaseSyncConfigShapeForClientUsage(supabaseSyncFormState)
    if (!isConfigValid) {
      setSupabaseSyncStatusState({ tone: 'warning', message: configValidationMessage, detail: '' })
      return
    }
    const [persistSuccess, persistError] = await persistSupabaseWebConfigIntoLocalStorageCache(supabaseSyncFormState)
    if (persistError || !persistSuccess) {
      console.warn('[supabase] Failed to persist supabase config.', persistError)
      setSupabaseSyncStatusState(buildSupabaseUiStatusFromError(persistError))
      return
    }
    setSupabaseSyncStatusState({ tone: 'success', message: 'Supabase config saved.', detail: supabaseSyncFormState.supabaseUrl })
    console.info('[supabase] Supabase config saved.')
  }
  async function startSupabaseEmailOtpSignInFromModal() {
    setIsSupabaseOperationInFlight(true)
    setSupabaseSyncStatusState({ tone: 'neutral', message: 'Sending Supabase OTP code...', detail: 'Check your inbox for the one-time code.' })
    const [isConfigValid, configValidationMessage] = validateSupabaseSyncConfigShapeForClientUsage(supabaseSyncFormState)
    if (!isConfigValid) {
      setSupabaseSyncStatusState({ tone: 'warning', message: configValidationMessage, detail: '' })
      setIsSupabaseOperationInFlight(false)
      return
    }
    if (typeof supabaseSyncFormState.email !== 'string' || !supabaseSyncFormState.email.includes('@')) {
      setSupabaseSyncStatusState({ tone: 'warning', message: 'Enter a valid email address first.', detail: '' })
      setIsSupabaseOperationInFlight(false)
      return
    }
    const [startSuccess, startError] = await startSupabaseEmailOtpSignInWithRedirect(supabaseSyncFormState, supabaseSyncFormState.email)
    if (startError || !startSuccess) {
      console.warn('[supabase] Sign-in start failed.', startError)
      setSupabaseSyncStatusState(buildSupabaseUiStatusFromError(startError))
      setIsSupabaseOperationInFlight(false)
      return
    }
    const otpRequestedAtIso = new Date().toISOString()
    const nextFormState = {
      ...supabaseSyncFormState,
      otpPendingEmail: supabaseSyncFormState.email.trim(),
      otpRequestedAtIso
    }
    setSupabaseSyncFormState(nextFormState)
    const [persistSuccess, persistError] = await persistSupabaseWebConfigIntoLocalStorageCache(nextFormState)
    if (persistError || !persistSuccess) {
      console.warn('[supabase] Failed to persist pending otp metadata.', persistError)
    }
    console.info('[supabase] OTP code email sent.', { email: supabaseSyncFormState.email, otpRequestedAtIso })
    setSupabaseSyncStatusState({ tone: 'success', message: 'OTP code sent.', detail: `Enter the code sent to ${supabaseSyncFormState.email}.` })
    setIsSupabaseOperationInFlight(false)
  }
  async function verifySupabaseEmailOtpCodeFromModal() {
    setIsSupabaseOperationInFlight(true)
    setSupabaseSyncStatusState({ tone: 'neutral', message: 'Verifying OTP code...', detail: '' })
    const pendingEmail = typeof supabaseSyncFormState.otpPendingEmail === 'string' && supabaseSyncFormState.otpPendingEmail.trim()
      ? supabaseSyncFormState.otpPendingEmail.trim()
      : (typeof supabaseSyncFormState.email === 'string' ? supabaseSyncFormState.email.trim() : '')
    if (!pendingEmail || !pendingEmail.includes('@')) {
      setSupabaseSyncStatusState({ tone: 'warning', message: 'No pending OTP email found. Send code first.', detail: '' })
      setIsSupabaseOperationInFlight(false)
      return
    }
    if (typeof supabaseSyncFormState.otpCode !== 'string' || supabaseSyncFormState.otpCode.trim().length === 0) {
      setSupabaseSyncStatusState({ tone: 'warning', message: 'Enter the OTP code first.', detail: '' })
      setIsSupabaseOperationInFlight(false)
      return
    }
    const [verifiedUser, verifyError] = await verifySupabaseEmailOtpCodeAndCreateSession(
      supabaseSyncFormState,
      pendingEmail,
      supabaseSyncFormState.otpCode
    )
    if (verifyError || !verifiedUser) {
      console.warn('[supabase] OTP verify failed.', verifyError)
      setSupabaseSyncStatusState(buildSupabaseUiStatusFromError(verifyError))
      setIsSupabaseOperationInFlight(false)
      return
    }
    const nextFormState = {
      ...supabaseSyncFormState,
      otpCode: '',
      otpPendingEmail: '',
      otpRequestedAtIso: ''
    }
    setSupabaseSyncFormState(nextFormState)
    const [persistSuccess, persistError] = await persistSupabaseWebConfigIntoLocalStorageCache(nextFormState)
    if (persistError || !persistSuccess) {
      console.warn('[supabase] Failed to clear pending otp metadata.', persistError)
    }
    setSupabaseAuthUserSummary({ id: verifiedUser.id, email: verifiedUser.email })
    setSupabaseSyncStatusState({ tone: 'success', message: 'Supabase session active.', detail: verifiedUser.email || verifiedUser.id })
    console.info('[supabase] OTP verify success.', { id: verifiedUser.id, email: verifiedUser.email })
    setIsSupabaseOperationInFlight(false)
  }
  async function refreshSupabaseAuthUserSummaryFromSession() {
    const [userSummary, userSummaryError] = await readSupabaseAuthenticatedUserSummary(supabaseSyncFormState)
    if (userSummaryError) {
      console.warn('[supabase] Failed to read auth user summary.', userSummaryError)
      setSupabaseSyncStatusState(buildSupabaseUiStatusFromError(userSummaryError))
      return
    }
    setSupabaseAuthUserSummary(userSummary)
    if (userSummary) {
      if (supabaseSyncFormState.otpPendingEmail || supabaseSyncFormState.otpRequestedAtIso || supabaseSyncFormState.otpCode) {
        const nextFormState = { ...supabaseSyncFormState, otpCode: '', otpPendingEmail: '', otpRequestedAtIso: '' }
        setSupabaseSyncFormState(nextFormState)
        const [persistSuccess, persistError] = await persistSupabaseWebConfigIntoLocalStorageCache(nextFormState)
        if (persistError || !persistSuccess) console.warn('[supabase] Failed to clear otp state after session refresh.', persistError)
      }
      setSupabaseSyncStatusState({ tone: 'success', message: 'Supabase session active.', detail: userSummary.email || userSummary.id })
    } else {
      setSupabaseSyncStatusState({ tone: 'neutral', message: 'No active Supabase session.', detail: '' })
    }
  }
  async function signOutFromSupabaseSessionFromModal() {
    setIsSupabaseOperationInFlight(true)
    setSupabaseSyncStatusState({ tone: 'neutral', message: 'Signing out from Supabase...', detail: '' })
    const [signOutSuccess, signOutError] = await signOutFromSupabaseCurrentSession(supabaseSyncFormState)
    if (signOutError || !signOutSuccess) {
      console.warn('[supabase] Sign-out failed.', signOutError)
      setSupabaseSyncStatusState(buildSupabaseUiStatusFromError(signOutError))
      setIsSupabaseOperationInFlight(false)
      return
    }
    setSupabaseAuthUserSummary(null)
    const nextFormState = { ...supabaseSyncFormState, otpCode: '', otpPendingEmail: '', otpRequestedAtIso: '' }
    setSupabaseSyncFormState(nextFormState)
    const [persistSuccess, persistError] = await persistSupabaseWebConfigIntoLocalStorageCache(nextFormState)
    if (persistError || !persistSuccess) console.warn('[supabase] Failed to clear otp state on sign-out.', persistError)
    setSupabaseSyncStatusState({ tone: 'neutral', message: 'Signed out from Supabase.', detail: '' })
    setIsSupabaseOperationInFlight(false)
  }
  async function pushCurrentProfileSnapshotToSupabase() {
    setIsSupabaseOperationInFlight(true)
    setSupabaseSyncStatusState({ tone: 'neutral', message: 'Supabase push started...', detail: 'Writing profile to profile_current and profile_history.' })
    const [syncResult, syncError] = await pushCompleteFinancialProfileIntoSupabaseForAuthenticatedUser(
      supabaseSyncFormState,
      collections,
      { themeName, textScaleMultiplier, tableSortState },
      auditTimelineEntries
    )
    if (syncError || !syncResult) {
      console.warn('[supabase] Push failed.', syncError)
      setSupabaseSyncStatusState(buildSupabaseUiStatusFromError(syncError))
      setIsSupabaseOperationInFlight(false)
      return
    }
    setSupabaseSyncStatusState({ tone: 'success', message: 'Push to Supabase completed.', detail: syncResult.savedAtIso })
    setIsSupabaseOperationInFlight(false)
  }
  async function pullProfileSnapshotFromSupabase() {
    setIsSupabaseOperationInFlight(true)
    setSupabaseSyncStatusState({ tone: 'neutral', message: 'Supabase pull started...', detail: 'Loading latest profile from profile_current.' })
    const [importedProfile, importedProfileError] = await pullCompleteFinancialProfileFromSupabaseForAuthenticatedUser(supabaseSyncFormState)
    if (importedProfileError || !importedProfile) {
      console.warn('[supabase] Pull failed.', importedProfileError)
      setSupabaseSyncStatusState(buildSupabaseUiStatusFromError(importedProfileError))
      setIsSupabaseOperationInFlight(false)
      return
    }
    const didApply = await applyImportedProfileIntoLocalStateWithMergeAndRecompute(importedProfile, 'supabase-pull')
    if (!didApply) {
      setIsSupabaseOperationInFlight(false)
      return
    }
    setSupabaseSyncStatusState({ tone: 'success', message: 'Pull from Supabase completed.', detail: 'Local profile updated from remote snapshot.' })
    setIsSupabaseOperationInFlight(false)
  }
  async function saveFirebaseWebConfigIntoCache() {
    setFirebaseSyncStatusState({ tone: 'neutral', message: 'Saving Firebase config...', detail: '' })
    const mergedFirebaseConfig = buildFirebaseSyncConfigWithRequiredDefaults(firebaseSyncFormState)
    const [isConfigValid, configValidationMessage] = validateFirebaseSyncConfigShapeForClientUsage(mergedFirebaseConfig)
    if (!isConfigValid) {
      setFirebaseSyncStatusState({ tone: 'warning', message: configValidationMessage, detail: '' })
      return
    }
    setFirebaseSyncFormState(mergedFirebaseConfig)
    const [persistSuccess, persistError] = await persistFirebaseWebConfigIntoLocalStorageCache(mergedFirebaseConfig)
    if (persistError || !persistSuccess) {
      console.warn('[firebase] Failed to persist firebase config.', persistError)
      setFirebaseSyncStatusState(buildFirebaseUiStatusFromError(persistError))
      return
    }
    setFirebaseSyncStatusState({ tone: 'success', message: 'Firebase config saved.', detail: `${mergedFirebaseConfig.projectId} | ${mergedFirebaseConfig.authDomain}` })
    console.info('[firebase] Firebase config saved.')
  }
  async function signInWithFirebaseGooglePopupFromModal() {
    setIsFirebaseOperationInFlight(true)
    setFirebaseSyncStatusState({ tone: 'neutral', message: 'Starting Google sign-in...', detail: 'Waiting for popup completion.' })
    const mergedFirebaseConfig = buildFirebaseSyncConfigWithRequiredDefaults(firebaseSyncFormState)
    const effectiveFirebaseConfig = mergedFirebaseConfig.enabled
      ? mergedFirebaseConfig
      : { ...mergedFirebaseConfig, enabled: true }
    if (!firebaseSyncFormState.enabled) {
      setFirebaseSyncFormState(effectiveFirebaseConfig)
      const [persistSuccess, persistError] = await persistFirebaseWebConfigIntoLocalStorageCache(effectiveFirebaseConfig)
      if (persistError || !persistSuccess) {
        console.warn('[firebase] Failed to auto-enable firebase before sign-in.', persistError)
        setFirebaseSyncStatusState(buildFirebaseUiStatusFromError(persistError))
        setIsFirebaseOperationInFlight(false)
        return
      }
      console.info('[firebase] Auto-enabled firebase for sign-in flow.')
    }
    const [isConfigValid, configValidationMessage] = validateFirebaseSyncConfigShapeForClientUsage(effectiveFirebaseConfig)
    if (!isConfigValid) {
      setFirebaseSyncStatusState({ tone: 'warning', message: configValidationMessage, detail: '' })
      setIsFirebaseOperationInFlight(false)
      return
    }
    const [userSummary, userSummaryError] = await signInToFirebaseWithGooglePopup(effectiveFirebaseConfig)
    if (userSummaryError || !userSummary) {
      console.warn('[firebase] Sign-in failed.', userSummaryError)
      setFirebaseSyncStatusState(buildFirebaseUiStatusFromError(userSummaryError))
      setIsFirebaseOperationInFlight(false)
      return
    }
    setFirebaseAuthUserSummary(userSummary)
    setFirebaseSyncStatusState({ tone: 'success', message: 'Firebase sign-in successful.', detail: userSummary.email || userSummary.uid })
    setIsFirebaseOperationInFlight(false)
    console.info('[firebase] Signed in.', { uid: userSummary.uid, email: userSummary.email })
  }
  async function signOutFromFirebaseSessionFromModal() {
    setIsFirebaseOperationInFlight(true)
    setFirebaseSyncStatusState({ tone: 'neutral', message: 'Signing out from Firebase...', detail: '' })
    const [signOutSuccess, signOutError] = await signOutFromFirebaseCurrentSession(firebaseSyncFormState)
    if (signOutError || !signOutSuccess) {
      console.warn('[firebase] Sign-out failed.', signOutError)
      setFirebaseSyncStatusState(buildFirebaseUiStatusFromError(signOutError))
      setIsFirebaseOperationInFlight(false)
      return
    }
    setFirebaseAuthUserSummary(null)
    setFirebaseSyncStatusState({ tone: 'neutral', message: 'Signed out from Firebase.', detail: '' })
    setIsFirebaseOperationInFlight(false)
    console.info('[firebase] Signed out.')
  }
  async function pushCurrentProfileSnapshotToFirebase() {
    setIsFirebaseOperationInFlight(true)
    setFirebaseSyncStatusState({ tone: 'neutral', message: 'Firebase push started...', detail: 'Writing profile snapshot to cloud.' })
    const [syncResult, syncError] = await pushCompleteFinancialProfileIntoFirebaseForAuthenticatedUser(
      firebaseSyncFormState,
      collections,
      { themeName, textScaleMultiplier, tableSortState },
      auditTimelineEntries
    )
    if (syncError || !syncResult) {
      console.warn('[firebase] Push failed.', syncError)
      setFirebaseSyncStatusState(buildFirebaseUiStatusFromError(syncError))
      setIsFirebaseOperationInFlight(false)
      return
    }
    setFirebaseSyncStatusState({ tone: 'success', message: 'Push to Firebase completed.', detail: syncResult.savedAtIso })
    setIsFirebaseOperationInFlight(false)
    console.info('[firebase] Push completed.', syncResult)
  }
  async function pullProfileSnapshotFromFirebase() {
    setIsFirebaseOperationInFlight(true)
    setFirebaseSyncStatusState({ tone: 'neutral', message: 'Firebase pull started...', detail: 'Reading profile snapshot from cloud.' })
    const [importedProfile, importedProfileError] = await pullCompleteFinancialProfileFromFirebaseForAuthenticatedUser(firebaseSyncFormState)
    if (importedProfileError || !importedProfile) {
      if (importedProfileError && importedProfileError.kind === 'NOT_FOUND') {
        console.info('[firebase] No remote profile found; creating one from local state.')
        setFirebaseSyncStatusState({ tone: 'neutral', message: 'No remote profile found. Creating one now.', detail: '' })
        await pushCurrentProfileSnapshotToFirebase()
        setIsFirebaseOperationInFlight(false)
        return
      }
      console.warn('[firebase] Pull failed.', importedProfileError)
      setFirebaseSyncStatusState(buildFirebaseUiStatusFromError(importedProfileError))
      setIsFirebaseOperationInFlight(false)
      return
    }
    const didApply = await applyImportedProfileIntoLocalStateWithMergeAndRecompute(importedProfile, 'firebase-pull')
    if (!didApply) {
      setIsFirebaseOperationInFlight(false)
      return
    }
    setFirebaseSyncStatusState({ tone: 'success', message: 'Pull from Firebase completed.', detail: 'Local profile updated from remote snapshot.' })
    setIsFirebaseOperationInFlight(false)
    console.info('[firebase] Pull completed and applied.')
  }
  async function deleteAllLocalFinancialProfileDataWithUndoSnapshot() {
    const shouldDelete = window.confirm('Delete all local profile data now? You can undo once from this modal.')
    if (!shouldDelete) return

    // Critical path: capture full pre-delete state so delete can be safely undone.
    const [snapshotJsonText, snapshotJsonTextError] = await exportCompleteFinancialProfileAsJsonTextSnapshot(
      collections,
      { themeName, textScaleMultiplier, tableSortState },
      auditTimelineEntries
    )
    if (snapshotJsonTextError || !snapshotJsonText) {
      console.warn('[profile] Failed to build delete undo snapshot.', snapshotJsonTextError)
      return
    }

    const emptyCollectionsState = buildEmptyBudgetCollectionsStateForHardReset()
    const [persistCollectionsSuccess, persistCollectionsError] = await persistBudgetCollectionsStateIntoLocalStorageCache(emptyCollectionsState)
    if (persistCollectionsError || !persistCollectionsSuccess) {
      console.warn('[profile] Failed to persist cleared collections.', persistCollectionsError)
    }
    const [persistAuditSuccess, persistAuditError] = await persistAuditTimelineIntoLocalStorageCache([])
    if (persistAuditError || !persistAuditSuccess) {
      console.warn('[profile] Failed to persist cleared audit timeline.', persistAuditError)
    }
    const [persistUiSuccess, persistUiError] = await persistUiPreferencesIntoLocalStorageCache({
      themeName: 'dark',
      textScaleMultiplier: 1,
      tableSortState: DEFAULT_TABLE_SORT_STATE
    })
    if (persistUiError || !persistUiSuccess) {
      console.warn('[profile] Failed to persist cleared ui preferences.', persistUiError)
    }

    setProfileDeleteUndoSnapshotJsonText(snapshotJsonText)
    setCollections(emptyCollectionsState)
    setAuditTimelineEntries([])
    setRiskFindings([])
    setSelectedRiskFinding(null)
    transactionUndoStackRef.current = []
    setTransactionUndoDepth(0)
    setThemeName('dark')
    setTextScaleMultiplier(1)
    setTableSortState(DEFAULT_TABLE_SORT_STATE)
    await recomputeAndValidateDashboardDerivedStateAfterImport(emptyCollectionsState)
    await recomputeRiskFindingsFromCollectionsState(emptyCollectionsState)
    setProfileTransferFormState({ mode: 'export', jsonText: '' })
    console.info('[profile] Local profile data deleted. Undo snapshot saved.')
  }
  async function restoreDeletedLocalFinancialProfileDataFromUndoSnapshot() {
    if (!profileDeleteUndoSnapshotJsonText) return
    console.info('[profile] Delete undo restore started.')
    const [importedProfile, importedProfileError] = await importCompleteFinancialProfileFromJsonTextSnapshot(profileDeleteUndoSnapshotJsonText)
    if (importedProfileError || !importedProfile || !importedProfile.collections) {
      console.warn('[profile] Failed to parse delete undo snapshot.', importedProfileError)
      return
    }
    const [persistCollectionsSuccess, persistCollectionsError] = await persistBudgetCollectionsStateIntoLocalStorageCache(importedProfile.collections)
    if (persistCollectionsError || !persistCollectionsSuccess) {
      console.warn('[profile] Failed to persist restored collections from undo snapshot.', persistCollectionsError)
      return
    }
    if (Array.isArray(importedProfile.auditTimelineEntries)) {
      const [persistAuditSuccess, persistAuditError] = await persistAuditTimelineIntoLocalStorageCache(importedProfile.auditTimelineEntries)
      if (persistAuditError || !persistAuditSuccess) {
        console.warn('[profile] Failed to persist restored audit timeline from undo snapshot.', persistAuditError)
        return
      }
      setAuditTimelineEntries(importedProfile.auditTimelineEntries)
    }
    if (importedProfile.uiPreferences) {
      const [persistUiSuccess, persistUiError] = await persistUiPreferencesIntoLocalStorageCache(importedProfile.uiPreferences)
      if (persistUiError || !persistUiSuccess) {
        console.warn('[profile] Failed to persist restored ui preferences from undo snapshot.', persistUiError)
        return
      }
      setThemeName(importedProfile.uiPreferences.themeName)
      setTextScaleMultiplier(importedProfile.uiPreferences.textScaleMultiplier)
      setTableSortState({
        ...DEFAULT_TABLE_SORT_STATE,
        ...(importedProfile.uiPreferences.tableSortState ?? {})
      })
    }
    setCollections(importedProfile.collections)
    await recomputeAndValidateDashboardDerivedStateAfterImport(importedProfile.collections)
    await recomputeRiskFindingsFromCollectionsState(importedProfile.collections)
    setProfileDeleteUndoSnapshotJsonText('')
    console.info('[profile] Delete undo restore completed successfully.')
  }

  async function persistUpdatedUiPreferencesAfterControlChanges(nextThemeName, nextTextScaleMultiplier, nextTableSortState = tableSortState) {
    await persistUiPreferencesIntoLocalStorageCache({ themeName: nextThemeName, textScaleMultiplier: nextTextScaleMultiplier, tableSortState: nextTableSortState })
  }
  async function toggleThemeNameBetweenLightAndDark() {
    const nextThemeName = themeName === 'dark' ? 'light' : 'dark'
    setThemeName(nextThemeName)
    await persistUpdatedUiPreferencesAfterControlChanges(nextThemeName, textScaleMultiplier)
  }
  async function updateGlobalTextScaleByDelta(delta) {
    const nextTextScaleMultiplier = Math.max(0.9, Math.min(1.2, Number((textScaleMultiplier + delta).toFixed(2))))
    setTextScaleMultiplier(nextTextScaleMultiplier)
    await persistUpdatedUiPreferencesAfterControlChanges(themeName, nextTextScaleMultiplier)
  }
  async function resetGlobalTextScaleToDefault() {
    setTextScaleMultiplier(1)
    await persistUpdatedUiPreferencesAfterControlChanges(themeName, 1)
  }
  function scrollViewportToTopFromUtilityButton() {
    scrollViewportToTopWithSmoothBehavior()
  }
  function updateEditRecordFormFieldValue(fieldName, nextFieldValue) {
    setEditRecordFormState((previousFormState) => ({ ...previousFormState, [fieldName]: nextFieldValue }))
  }
  function openEditModalForRecord(collectionName, recordItem) {
    const recordPerson = normalizePersonaNameForDisplay(typeof recordItem.person === 'string' ? recordItem.person : '')
    const hasKnownPersona = personaOptions.includes(recordPerson)
    const recordCategory = typeof recordItem.category === 'string' ? recordItem.category : ''
    const hasKnownCategory = COMMON_BUDGET_CATEGORIES.includes(recordCategory)
    setEditRecordFormState({
      collectionName,
      recordId: typeof recordItem.id === 'string' ? recordItem.id : '',
      person: hasKnownPersona ? recordPerson : '__custom__',
      customPerson: hasKnownPersona ? '' : recordPerson,
      item: typeof recordItem.item === 'string' ? recordItem.item : '',
      category: hasKnownCategory ? recordCategory : (recordCategory ? '__custom__' : ''),
      customCategory: hasKnownCategory ? '' : recordCategory,
      amount: typeof recordItem.amount === 'number' ? String(recordItem.amount) : '',
      minimumPayment: typeof recordItem.minimumPayment === 'number' ? String(recordItem.minimumPayment) : '',
      interestRatePercent: typeof recordItem.interestRatePercent === 'number' ? String(recordItem.interestRatePercent) : '',
      remainingPayments: typeof recordItem.remainingPayments === 'number' ? String(recordItem.remainingPayments) : '',
      loanStartDate: typeof recordItem.loanStartDate === 'string' ? recordItem.loanStartDate : '',
      collateralAssetName: typeof recordItem.collateralAssetName === 'string' ? recordItem.collateralAssetName : '',
      collateralAssetMarketValue: typeof recordItem.collateralAssetMarketValue === 'number' ? String(recordItem.collateralAssetMarketValue) : '',
      creditLimit: typeof recordItem.creditLimit === 'number' ? String(recordItem.creditLimit) : '',
      maxCapacity: typeof recordItem.maxCapacity === 'number' ? String(recordItem.maxCapacity) : '',
      currentBalance: typeof recordItem.currentBalance === 'number' ? String(recordItem.currentBalance) : '',
      monthlyPayment: typeof recordItem.monthlyPayment === 'number' ? String(recordItem.monthlyPayment) : '',
      assetValueOwed: typeof recordItem.assetValueOwed === 'number' ? String(recordItem.assetValueOwed) : '',
      assetMarketValue: typeof recordItem.assetMarketValue === 'number' ? String(recordItem.assetMarketValue) : '',
      date: typeof recordItem.date === 'string' ? recordItem.date : '',
      description: typeof recordItem.description === 'string' ? recordItem.description : ''
    })
    setIsEditRecordModalOpen(true)
  }
  async function deleteRecordFromCollectionByCollectionNameAndId(collectionName, recordId) {
    if (!collectionName || !recordId) return
    const collectionItems = collections[collectionName]
    if (!Array.isArray(collectionItems)) {
      console.warn('[records] Delete skipped: unsupported collection.', { collectionName })
      return
    }
    const shouldDelete = window.confirm(`Delete this ${collectionName} record?`)
    if (!shouldDelete) return
    const nextCollectionsState = {
      ...collections,
      [collectionName]: collectionItems.filter((rowItem) => String(rowItem.id) !== String(recordId))
    }
    const didApply = await applyNextCollectionsStateWithUndoForTransaction(nextCollectionsState, `delete-${collectionName}`)
    if (!didApply) {
      return
    }
    if (isEditRecordModalOpen && editRecordFormState.collectionName === collectionName && String(editRecordFormState.recordId) === String(recordId)) {
      setIsEditRecordModalOpen(false)
      setEditRecordFormState(buildInitialEditRecordFormState())
    }
    if (isRecordNotesModalOpen && recordNotesFormState.collectionName === collectionName && String(recordNotesFormState.recordId) === String(recordId)) {
      setIsRecordNotesModalOpen(false)
      setRecordNotesFormState(buildInitialRecordNotesFormState())
    }
  }
  function openRecordNotesModalForCollectionAndRow(collectionName, recordItem) {
    const recordLabel = typeof recordItem.category === 'string' && recordItem.category.trim().length > 0
      ? recordItem.category
      : (typeof recordItem.item === 'string' && recordItem.item.trim().length > 0 ? recordItem.item : 'Record')
    const currentNotesCollection = Array.isArray(collections.notes) ? collections.notes : []
    const noteRow = currentNotesCollection.find((rowItem) => (
      rowItem &&
      typeof rowItem === 'object' &&
      String(rowItem.collectionName ?? '') === String(collectionName) &&
      String(rowItem.recordId ?? '') === String(recordItem.id ?? '')
    ))
    const notesValue = noteRow && typeof noteRow.notes === 'string' ? noteRow.notes : ''
    setRecordNotesFormState({
      collectionName,
      recordId: typeof recordItem.id === 'string' ? recordItem.id : '',
      recordLabel,
      notes: notesValue
    })
    setIsRecordNotesModalOpen(true)
  }
  async function submitRecordNotesFormChanges(submitEvent) {
    submitEvent.preventDefault()
    if (!recordNotesFormState.collectionName || !recordNotesFormState.recordId) return
    const [isoTimestamp, timestampError] = readCurrentIsoTimestampForBudgetRecordUpdates()
    if (timestampError || !isoTimestamp) return
    const currentNotesCollection = Array.isArray(collections.notes) ? collections.notes : []
    const nextNotesCollectionWithoutCurrent = currentNotesCollection.filter((rowItem) => {
      if (!rowItem || typeof rowItem !== 'object') return false
      return !(String(rowItem.collectionName ?? '') === String(recordNotesFormState.collectionName) && String(rowItem.recordId ?? '') === String(recordNotesFormState.recordId))
    })
    const trimmedNotes = typeof recordNotesFormState.notes === 'string' ? recordNotesFormState.notes.trim() : ''
    const nextNotesCollection = trimmedNotes.length > 0
      ? [
          ...nextNotesCollectionWithoutCurrent,
          {
            id: `note-${recordNotesFormState.collectionName}-${recordNotesFormState.recordId}`,
            collectionName: recordNotesFormState.collectionName,
            recordId: recordNotesFormState.recordId,
            notes: trimmedNotes,
            updatedAt: isoTimestamp
          }
        ]
      : nextNotesCollectionWithoutCurrent
    const nextCollectionsState = {
      ...collections,
      notes: nextNotesCollection
    }
    const didApply = await applyNextCollectionsStateWithUndoForTransaction(nextCollectionsState, `note-${recordNotesFormState.collectionName}`)
    if (!didApply) return
    setIsRecordNotesModalOpen(false)
    setRecordNotesFormState(buildInitialRecordNotesFormState())
  }
  function doesRecordHaveDetailedNotes(collectionName, recordItem) {
    const currentNotesCollection = Array.isArray(collections.notes) ? collections.notes : []
    return currentNotesCollection.some((rowItem) => (
      rowItem &&
      typeof rowItem === 'object' &&
      String(rowItem.collectionName ?? '') === String(collectionName) &&
      String(rowItem.recordId ?? '') === String(recordItem.id ?? '') &&
      typeof rowItem.notes === 'string' &&
      rowItem.notes.trim().length > 0
    ))
  }
  function renderRecordMoreNotesHoverAction(collectionName, recordItem) {
    const hasDetailedNotes = doesRecordHaveDetailedNotes(collectionName, recordItem)
    const buttonClassName = hasDetailedNotes
      ? 'record-action-notes-button record-action-notes-button-has-value rounded-lg border px-2 py-1 text-xs font-semibold'
      : 'record-action-notes-button rounded-lg border px-2 py-1 text-xs font-semibold'
    return (
      <div className="flex w-full items-center justify-end opacity-0 pointer-events-none transition-opacity duration-150 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto">
        <button
          aria-label="Open detailed notes"
          className={buttonClassName}
          onClick={() => openRecordNotesModalForCollectionAndRow(collectionName, recordItem)}
          title="Detailed notes"
          type="button"
        >
          <span aria-hidden="true">{renderIconGlyphForAction('notes')}</span>
        </button>
      </div>
    )
  }
  function renderRecordActionsWithIconButtons(collectionName, recordItem, options = {}) {
    return (
      <div className="flex w-full items-center justify-end gap-1 opacity-0 pointer-events-none transition-opacity duration-150 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto">
        <button
          aria-label="Edit record"
          className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700"
          onClick={() => openEditModalForRecord(collectionName, recordItem)}
          title="Edit"
          type="button"
        >
          <span aria-hidden="true">{renderIconGlyphForAction('edit')}</span>
        </button>
        <button
          aria-label="Delete record"
          className="rounded-lg border border-rose-300 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700"
          onClick={() => { void deleteRecordFromCollectionByCollectionNameAndId(collectionName, String(recordItem.id ?? '')) }}
          title="Delete"
          type="button"
        >
          <span aria-hidden="true">{renderIconGlyphForAction('delete')}</span>
        </button>
      </div>
    )
  }
  async function submitEditedRecordChanges(submitEvent) {
    submitEvent.preventDefault()
    const normalizedPerson = normalizePersonaNameForDisplay(editRecordFormState.person === '__custom__'
      ? editRecordFormState.customPerson
      : editRecordFormState.person)
    const [isoTimestamp, timestampError] = readCurrentIsoTimestampForBudgetRecordUpdates()
    if (timestampError || !isoTimestamp) return

    let recordPatch = {}
    if (editRecordFormState.collectionName === 'income' || editRecordFormState.collectionName === 'expenses' || editRecordFormState.collectionName === 'assets') {
      const normalizedCategory = editRecordFormState.category === '__custom__'
        ? editRecordFormState.customCategory.trim()
        : editRecordFormState.category.trim()
      recordPatch = {
        person: normalizedPerson,
        item: editRecordFormState.item,
        amount: Number(editRecordFormState.amount),
        category: normalizedCategory,
        date: editRecordFormState.date,
        description: editRecordFormState.description
      }
    } else if (editRecordFormState.collectionName === 'debts' || editRecordFormState.collectionName === 'credit' || editRecordFormState.collectionName === 'loans') {
      const normalizedCategory = editRecordFormState.category === '__custom__'
        ? editRecordFormState.customCategory.trim()
        : editRecordFormState.category.trim()
      recordPatch = {
        person: normalizedPerson,
        item: normalizedCategory,
        category: normalizedCategory,
        amount: Number(editRecordFormState.amount),
        minimumPayment: Number(editRecordFormState.minimumPayment),
        interestRatePercent: Number(editRecordFormState.interestRatePercent || 0),
        remainingPayments: Number(editRecordFormState.remainingPayments || 0),
        loanStartDate: editRecordFormState.loanStartDate,
        collateralAssetName: editRecordFormState.collateralAssetName,
        collateralAssetMarketValue: Number(editRecordFormState.collateralAssetMarketValue || 0),
        creditLimit: Number(editRecordFormState.creditLimit || 0),
        description: editRecordFormState.description,
        date: editRecordFormState.date
      }
    } else if (editRecordFormState.collectionName === 'creditCards') {
      recordPatch = {
        person: normalizedPerson,
        item: editRecordFormState.item,
        maxCapacity: Number(editRecordFormState.maxCapacity),
        currentBalance: Number(editRecordFormState.currentBalance),
        minimumPayment: Number(editRecordFormState.minimumPayment),
        monthlyPayment: Number(editRecordFormState.monthlyPayment),
        interestRatePercent: Number(editRecordFormState.interestRatePercent || 0),
        date: editRecordFormState.date
      }
    } else if (editRecordFormState.collectionName === 'assetHoldings') {
      recordPatch = {
        person: normalizedPerson,
        item: editRecordFormState.item,
        assetValueOwed: Number(editRecordFormState.assetValueOwed || 0),
        assetMarketValue: Number(editRecordFormState.assetMarketValue || 0),
        description: editRecordFormState.description,
        date: editRecordFormState.date
      }
    }

    const [nextCollectionsState, updateError] = updateExistingRecordInCollectionsStateByCollectionNameAndId(
      collections,
      /** @type {'income'|'expenses'|'assets'|'assetHoldings'|'debts'|'credit'|'loans'|'creditCards'} */ (editRecordFormState.collectionName),
      editRecordFormState.recordId,
      recordPatch,
      isoTimestamp
    )
    if (updateError || !nextCollectionsState) {
      console.warn('[records] Failed to update record.', updateError)
      return
    }

    const didApply = await applyNextCollectionsStateWithUndoForTransaction(nextCollectionsState, `edit-${editRecordFormState.collectionName}`)
    if (!didApply) {
      return
    }
    setIsEditRecordModalOpen(false)
    setEditRecordFormState(buildInitialEditRecordFormState())
  }
  function updateTableSortingForTableName(tableName, keyName) {
    setTableSortState((previousState) => {
      const previous = previousState[tableName]
      const nextDirection = previous.key === keyName && previous.direction === 'asc' ? 'desc' : 'asc'
      const nextSortState = {
        ...previousState,
        [tableName]: { key: keyName, direction: nextDirection }
      }
      void persistUpdatedUiPreferencesAfterControlChanges(themeName, textScaleMultiplier, nextSortState)
      return nextSortState
    })
  }
  function renderSortableHeaderCell(tableName, keyName, label, isRightAligned = false) {
    const currentSort = tableSortState?.[tableName]
    const isActiveSortColumn = Boolean(currentSort && currentSort.key === keyName)
    const isAscendingSort = currentSort?.direction === 'asc'
    const indicator = isActiveSortColumn
      ? (isAscendingSort ? '↑' : '↓')
      : '↕'
    return (
      <th
        className={`px-3 py-2 font-semibold ${isRightAligned ? 'text-right' : 'text-left'}`}
        aria-sort={isActiveSortColumn ? (isAscendingSort ? 'ascending' : 'descending') : 'none'}
      >
        <button onClick={() => updateTableSortingForTableName(tableName, keyName)} type="button">
          {label}
          <span className={`ml-1 inline-block w-3 text-center text-[11px] ${isActiveSortColumn ? 'text-teal-700 opacity-100' : 'text-slate-400 opacity-55'}`}>
            {indicator}
          </span>
        </button>
      </th>
    )
  }
  const primaryJumpLinks = [
    { href: '#overview', label: 'Overview' },
    { href: '#assets', label: 'Assets' },
    { href: '#debts', label: 'Debts' },
    { href: '#credit', label: 'Credit' },
    { href: '#savings', label: 'Savings' },
    { href: '#records', label: 'Records' },
    { href: '#details', label: 'Details' }
  ]
  const secondaryJumpLinks = [
    { href: '#loan-calculator', label: 'Loan Calculator' },
    { href: '#risks', label: 'Risk Flags' },
    { href: '#goals', label: 'Goals' },
    { href: '#net-worth-trajectory', label: 'Trajectory' },
    { href: '#emergency-fund', label: 'Emergency' }
  ]

  return (
    <main className={`app-shell theme-${themeName} mx-auto min-h-screen w-full max-w-7xl p-4 pb-16 md:p-8`}>
      <section className="sticky top-2 z-[2200] mb-4 rounded-2xl border border-white/40 bg-white/85 p-2 shadow-lg backdrop-blur">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h1 className="truncate text-sm font-bold text-slate-900 md:text-base">Financial Flight Deck</h1>
          <div className="flex items-center gap-1">
            <button className="rounded-lg border border-white/30 bg-white/85 px-2 py-1 text-[11px] font-semibold text-slate-700" onClick={toggleThemeNameBetweenLightAndDark} type="button">{themeName === 'dark' ? 'Dark' : 'Light'}</button>
            <button className="rounded-lg border border-white/30 bg-white/85 px-2 py-1 text-[11px] font-semibold text-slate-700" onClick={() => void updateGlobalTextScaleByDelta(0.05)} type="button">A+</button>
            <button className="rounded-lg border border-white/30 bg-white/85 px-2 py-1 text-[11px] font-semibold text-slate-700" onClick={() => void updateGlobalTextScaleByDelta(-0.05)} type="button">A-</button>
            <button className="rounded-lg border border-white/30 bg-white/85 px-2 py-1 text-[11px] font-semibold text-slate-700" onClick={resetGlobalTextScaleToDefault} type="button">Reset</button>
          </div>
        </div>
        <div className="no-scrollbar mb-2 flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-1">
          {primaryJumpLinks.map((linkItem, linkIndex) => (
            <a
              key={linkItem.href}
              className={linkIndex === 0
                ? 'rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white'
                : 'rounded-lg border border-slate-200/90 bg-slate-100/90 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700'}
              href={linkItem.href}
            >
              {linkItem.label}
            </a>
          ))}
          {secondaryJumpLinks.map((linkItem) => (
            <a key={linkItem.href} className="rounded-lg border border-slate-200/90 bg-white/90 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600" href={linkItem.href}>{linkItem.label}</a>
          ))}
        </div>
        <div className="no-scrollbar flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-1">
          <button className="rounded-lg border border-white/30 bg-teal-600 px-2.5 py-1.5 text-[11px] font-semibold text-white" onClick={() => setIsAddRecordModalOpen(true)} type="button">+ Record</button>
          <button className="rounded-lg border border-white/30 bg-sky-600 px-2.5 py-1.5 text-[11px] font-semibold text-white" onClick={() => setIsAddGoalModalOpen(true)} type="button">+ Goal</button>
          <button className="rounded-lg border border-white/30 bg-violet-600 px-2.5 py-1.5 text-[11px] font-semibold text-white" onClick={openManagePersonasModal} type="button">Personas</button>
          <button className="rounded-lg border border-white/30 bg-indigo-600 px-2.5 py-1.5 text-[11px] font-semibold text-white" onClick={() => void openProfileTransferModalForMode('import')} type="button">Import</button>
          <button className="rounded-lg border border-white/30 bg-indigo-700 px-2.5 py-1.5 text-[11px] font-semibold text-white" onClick={() => void openProfileTransferModalForMode('export')} type="button">Export</button>
        </div>
      </section>

      <section id="overview" className="z-layer-section mb-4 scroll-mt-40 grid grid-cols-1 gap-3 md:mb-6 md:gap-4 md:grid-cols-2 xl:grid-cols-4">
        {topMetrics.map((metricRow, metricIndex) => {
          const label = metricRow.metric
          const formattedValue = formatDashboardDatapointValueByFormat(metricRow.value, metricRow.valueFormat)
          const metadataLines = buildOverviewHoverContextLinesForMetric(metricRow, sourceBreakdown, emergencyFundSummary)
          const trendSignalValue = label === 'Net Worth'
            ? sourceBreakdown.netWorth.delta
            : metricRow.value
          const trendLabel = trendSignalValue > 0 ? 'Up' : (trendSignalValue < 0 ? 'Down' : 'Flat')
          const trendClassName = trendSignalValue > 0 ? 'bg-emerald-100 text-emerald-700' : (trendSignalValue < 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600')
          return (
            <React.Fragment key={label}>
              {renderHoverMetadataBoxForElement({
                label: `${label} Metadata`,
                lines: metadataLines,
                children: (
                  <article className="glass-panel-soft squircle-md metric-card-enter p-5" style={{ animationDelay: `${metricIndex * 70}ms` }}>
                    <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</h2>
                    <p className="mt-3 text-3xl font-bold text-slate-900">{formattedValue}</p>
                    <p className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs font-semibold ${trendClassName}`}>{trendLabel} vs recent updates</p>
                  </article>
                )
              })}
            </React.Fragment>
          )
        })}
      </section>

      <div className="flex flex-col">
      <section id="net-worth-trajectory" className="section-tight section-allows-popovers glass-panel-soft squircle-md z-layer-section mb-4 scroll-mt-40 p-4 md:mb-6 md:p-6" style={{ order: 13 }}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Net Worth Trajectory</h2>
          </div>
          <div className="flex items-center gap-2">
            {['conservative', 'base', 'accelerated'].map((profileId) => (
              <button
                key={profileId}
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${netWorthProjectionProfileId === profileId ? 'border-sky-500 bg-sky-600 text-white' : 'border-slate-300 bg-white/85 text-slate-700'}`}
                onClick={() => setNetWorthProjectionProfileId(profileId)}
                type="button"
              >
                {profileId.charAt(0).toUpperCase() + profileId.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {selectedNetWorthProjectionProfile ? (
          <React.Fragment>
            <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
              <article className="networth-clarity-card squircle-sm p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Baseline Inputs From Dataset</p>
                <dl className="mt-2 space-y-1 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-500">Savings / Month</dt>
                    <dd className="font-semibold text-slate-800">{formatCurrencyValueForDashboard(netWorthProjectionBaselineVariables.monthlySavingsPaceBaselineFromDataset)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-500">Income / Month</dt>
                    <dd className="font-semibold text-slate-800">{formatCurrencyValueForDashboard(netWorthProjectionBaselineVariables.totalMonthlyIncomeFromDataset)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-500">Expenses / Month</dt>
                    <dd className="font-semibold text-slate-800">{formatCurrencyValueForDashboard(netWorthProjectionBaselineVariables.totalMonthlyExpensesFromDataset)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-500">Debt Pmts / Month</dt>
                    <dd className="font-semibold text-slate-800">{formatCurrencyValueForDashboard(netWorthProjectionBaselineVariables.totalMonthlyDebtPaymentsFromDataset)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-500">Weighted APR</dt>
                    <dd className="font-semibold text-slate-800">{netWorthProjectionBaselineVariables.weightedAprPercentFromDataset.toFixed(2)}%</dd>
                  </div>
                </dl>
              </article>
              {renderHoverMetadataBoxForElement({
                label: 'Selected Pace Modifiers Meaning',
                boxClassName: 'meta-hover-box-wide',
                lines: [
                  'Scenario modifiers applied on top of dataset baseline values.',
                  `Savings Multiplier (x${selectedNetWorthProjectionProfile.assumptions.savingsPaceMultiplier.toFixed(2)}): scales monthly savings contribution.`,
                  `Asset Growth (${selectedNetWorthProjectionProfile.assumptions.annualAssetGrowthPercent.toFixed(1)}%/yr): expected annual growth on assets.`,
                  `Debt Payment Lift (${(selectedNetWorthProjectionProfile.assumptions.debtPaymentExtraPercent * 100).toFixed(1)}%): extra debt paydown above base monthly payment.`,
                  `APR Shift (${selectedNetWorthProjectionProfile.assumptions.aprStressAdjustmentPercent.toFixed(1)} pts): interest-rate stress adjustment for liabilities.`,
                  'Rule of thumb: higher savings/growth/lift helps net worth; higher APR hurts net worth.'
                ],
                children: (
                  <article className="networth-clarity-card squircle-sm p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Selected Pace Modifiers</p>
                    <dl className="mt-2 space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <dt className="text-slate-500">Savings Multiplier</dt>
                        <dd className="rounded-md bg-slate-100 px-2 py-1 font-semibold text-slate-800">x{selectedNetWorthProjectionProfile.assumptions.savingsPaceMultiplier.toFixed(2)}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <dt className="text-slate-500">Asset Growth (Annual)</dt>
                        <dd className="rounded-md bg-slate-100 px-2 py-1 font-semibold text-slate-800">{selectedNetWorthProjectionProfile.assumptions.annualAssetGrowthPercent.toFixed(1)}%</dd>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <dt className="text-slate-500">Debt Payment Lift</dt>
                        <dd className="rounded-md bg-slate-100 px-2 py-1 font-semibold text-slate-800">{(selectedNetWorthProjectionProfile.assumptions.debtPaymentExtraPercent * 100).toFixed(1)}%</dd>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <dt className="text-slate-500">APR Shift</dt>
                        <dd className="rounded-md bg-slate-100 px-2 py-1 font-semibold text-slate-800">{selectedNetWorthProjectionProfile.assumptions.aprStressAdjustmentPercent.toFixed(1)} pts</dd>
                      </div>
                    </dl>
                  </article>
                )
              })}
              <article className="networth-clarity-card squircle-sm p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">How To Tune</p>
                <ul className="mt-2 space-y-1 text-xs text-slate-600">
                  <li>Higher savings multiplier increases monthly contribution.</li>
                  <li>Higher growth percent compounds asset side faster.</li>
                  <li>Higher debt payment lift lowers liability principal sooner.</li>
                  <li>APR shift stress-tests borrowing conditions up/down.</li>
                </ul>
              </article>
            </div>
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {selectedNetWorthProjectionProfile.points.map((pointItem) => {
                const currentPoint = selectedNetWorthProjectionProfile.points.find((rowItem) => rowItem.horizonId === 'current')
                const currentNetWorth = typeof currentPoint?.projectedNetWorth === 'number' ? currentPoint.projectedNetWorth : 0
                const currentDebt = typeof currentPoint?.projectedDebt === 'number' ? currentPoint.projectedDebt : 0
                const deltaValue = pointItem.projectedNetWorth - currentNetWorth
                const debtDeltaValue = pointItem.projectedDebt - currentDebt
                const deltaClassName = deltaValue > 0 ? 'text-emerald-700' : (deltaValue < 0 ? 'text-rose-700' : 'text-slate-600')
                const debtDeltaClassName = debtDeltaValue < 0 ? 'text-emerald-700' : (debtDeltaValue > 0 ? 'text-rose-700' : 'text-slate-600')
                const horizonLabel = netWorthProjectionProfiles?.horizons.find((rowItem) => rowItem.id === pointItem.horizonId)?.label ?? pointItem.horizonId
                const horizonMonths = typeof pointItem.months === 'number' ? pointItem.months : 0
                const debtPaymentMultiplier = 1 + (selectedNetWorthProjectionProfile.assumptions.debtPaymentExtraPercent || 0)
                const incomePredictionLines = safeCollections.income.map((incomeRow, incomeIndex) => {
                  const itemName = typeof incomeRow.item === 'string' ? incomeRow.item : `Income ${incomeIndex + 1}`
                  const monthlyAmount = typeof incomeRow.amount === 'number' ? incomeRow.amount : 0
                  const horizonTotal = monthlyAmount * horizonMonths
                  if (monthlyAmount <= 0) return ''
                  if (horizonMonths <= 0) return `Income ${itemName}: ${formatCurrencyValueForDashboard(monthlyAmount)}/mo`
                  return `- ${itemName}: ${formatCurrencyValueForDashboard(monthlyAmount)}/mo | ${formatCurrencyValueForDashboard(horizonTotal)}`
                }).filter((lineItem) => lineItem.length > 0)
                const debtPaymentRows = [...safeCollections.debts, ...safeCollections.loans, ...safeCollections.credit]
                const debtPredictionLines = debtPaymentRows.map((debtRow, debtIndex) => {
                  const itemName = typeof debtRow.item === 'string' ? debtRow.item : `Debt ${debtIndex + 1}`
                  const baseMonthlyPayment = typeof debtRow.monthlyPayment === 'number'
                    ? debtRow.monthlyPayment
                    : (typeof debtRow.minimumPayment === 'number' ? debtRow.minimumPayment : 0)
                  const adjustedMonthlyPayment = baseMonthlyPayment * debtPaymentMultiplier
                  const horizonTotal = adjustedMonthlyPayment * horizonMonths
                  if (adjustedMonthlyPayment <= 0) return ''
                  if (horizonMonths <= 0) return `Debt ${itemName}: ${formatCurrencyValueForDashboard(adjustedMonthlyPayment)}/mo`
                  return `- ${itemName}: ${formatCurrencyValueForDashboard(adjustedMonthlyPayment)}/mo | ${formatCurrencyValueForDashboard(horizonTotal)}`
                }).filter((lineItem) => lineItem.length > 0)
                const incomeTotalMonthly = safeCollections.income.reduce((runningTotal, incomeRow) => {
                  const amount = typeof incomeRow.amount === 'number' ? incomeRow.amount : 0
                  return runningTotal + Math.max(0, amount)
                }, 0)
                const debtTotalMonthly = debtPaymentRows.reduce((runningTotal, debtRow) => {
                  const baseMonthlyPayment = typeof debtRow.monthlyPayment === 'number'
                    ? debtRow.monthlyPayment
                    : (typeof debtRow.minimumPayment === 'number' ? debtRow.minimumPayment : 0)
                  return runningTotal + Math.max(0, baseMonthlyPayment * debtPaymentMultiplier)
                }, 0)
                const incomeHorizonTotal = incomeTotalMonthly * horizonMonths
                const debtHorizonTotal = debtTotalMonthly * horizonMonths
                const hoverLines = [
                  `Profile: ${selectedNetWorthProjectionProfile.label}`,
                  `Horizon: ${horizonLabel} (${horizonMonths} months)`,
                  `Projected Net Worth: ${formatCurrencyValueForDashboard(pointItem.projectedNetWorth)}`,
                  `Projected Debt Balance: ${formatCurrencyValueForDashboard(pointItem.projectedDebt)}`,
                  'Income Summary',
                  horizonMonths <= 0
                    ? `Total Income: ${formatCurrencyValueForDashboard(incomeTotalMonthly)}/mo`
                    : `Total Income: ${formatCurrencyValueForDashboard(incomeTotalMonthly)}/mo | ${formatCurrencyValueForDashboard(incomeHorizonTotal)}`,
                  ...incomePredictionLines,
                  'Debt Summary',
                  horizonMonths <= 0
                    ? `Total Debt Payments: ${formatCurrencyValueForDashboard(debtTotalMonthly)}/mo`
                    : `Total Debt Payments: ${formatCurrencyValueForDashboard(debtTotalMonthly)}/mo | ${formatCurrencyValueForDashboard(debtHorizonTotal)}`,
                  ...debtPredictionLines
                ]
                return (
                  <React.Fragment key={pointItem.horizonId}>
                    {renderHoverMetadataBoxForElement({
                      label: `${horizonLabel} Projection Inputs`,
                      lines: hoverLines,
                      boxClassName: 'meta-hover-box-wide',
                      children: (
                        <article className="networth-outcome-card squircle-sm p-3">
                          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{horizonLabel}</p>
                          <div className="mt-2 grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-[11px] text-slate-500">Projected Net Worth</p>
                              <p className="text-lg font-bold text-slate-800">{formatCurrencyValueForDashboard(pointItem.projectedNetWorth)}</p>
                              <p className={`text-xs font-semibold ${deltaClassName}`}>{deltaValue >= 0 ? '+' : ''}{formatCurrencyValueForDashboard(deltaValue)} vs current</p>
                            </div>
                            <div>
                              <p className="text-[11px] text-slate-500">Projected Debt Balance</p>
                              <p className="text-lg font-bold text-slate-800">{formatCurrencyValueForDashboard(pointItem.projectedDebt)}</p>
                              <p className={`text-xs font-semibold ${debtDeltaClassName}`}>{debtDeltaValue <= 0 ? '' : '+'}{formatCurrencyValueForDashboard(debtDeltaValue)} vs current</p>
                            </div>
                          </div>
                        </article>
                      )
                    })}
                  </React.Fragment>
                )
              })}
            </div>
          </React.Fragment>
        ) : (
          <p className="text-sm text-slate-500">Unable to build trajectory from current data.</p>
        )}
      </section>

      <section id="emergency-fund" className="section-tight section-allows-popovers glass-panel-soft squircle-md z-layer-section mb-4 scroll-mt-40 p-4 md:mb-6 md:p-6" style={{ order: 14 }}>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-900">Emergency Fund Tracker (6 Months)</h2>
          <p className="text-xs text-slate-500">Bifurcated strategy: 1-2 months liquid cash, remaining reserve invested. Goal is based on expenses + debt minimums.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {renderHoverMetadataBoxForElement({
            label: 'Emergency Goal Expense Breakdown',
            lines: emergencyGoalExpenseLines,
            boxClassName: 'meta-hover-box-wide',
            children: (
              <article className="squircle-sm border border-slate-200/90 bg-white/90 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Goal (6 months)</p>
                <p className="text-xl font-bold text-slate-800">{formatCurrencyValueForDashboard(emergencyFundSummary.emergencyFundGoal)}</p>
              </article>
            )
          })}
          <article className="squircle-sm border border-slate-200/90 bg-white/90 p-3"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Short-Term (1-2 month tier)</p><p className="text-xl font-bold text-teal-700">{formatCurrencyValueForDashboard(emergencyFundSummary.liquidAmount)}</p><p className="text-xs text-slate-500">Shortfall: {formatCurrencyValueForDashboard(emergencyFundSummary.missingLiquidAmount)}</p></article>
          <article className="squircle-sm border border-slate-200/90 bg-white/90 p-3"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Long-Term (brokerage tier)</p><p className="text-xl font-bold text-sky-700">{formatCurrencyValueForDashboard(emergencyFundSummary.investedAmount)}</p><p className="text-xs text-slate-500">Shortfall: {formatCurrencyValueForDashboard(Math.max(0, emergencyFundSummary.investedTarget - emergencyFundSummary.investedAmount))}</p></article>
        </div>
      </section>

      <section id="risks" className="section-tight glass-panel-soft squircle-md z-layer-section mb-4 scroll-mt-40 p-4 md:mb-6 md:p-6" style={{ order: 11 }}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Financial Risk Flags</h2>
          <div className="flex items-center gap-2">
            <button
              className="rounded-xl border border-slate-300 bg-white/85 p-2 text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              type="button"
              onClick={() => { void recomputeRiskFindingsFromCollectionsState(safeCollections) }}
              disabled={isRiskLoading}
              aria-label="Reload risk checks"
              title="Reload risk checks"
            >
              <svg className={`h-4 w-4 ${isRiskLoading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M20 12a8 8 0 1 1-2.34-5.66" />
                <path d="M20 4v6h-6" />
              </svg>
            </button>
            <span className="text-xs text-slate-500">{isRiskLoading ? 'running checks...' : `${riskFindings.length} active checks`}</span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {riskFindings.map((findingItem, findingIndex) => {
            const severityName = typeof findingItem.severity === 'string' ? findingItem.severity : 'medium'
            const severityClassName = severityName === 'high'
              ? 'risk-flag-card-high'
              : (severityName === 'low' ? 'risk-flag-card-low' : 'risk-flag-card-medium')
            const severityBadgeClassName = severityName === 'high'
              ? 'risk-flag-severity-high'
              : (severityName === 'low' ? 'risk-flag-severity-low' : 'risk-flag-severity-medium')
            return (
            <button
              key={findingItem.id}
              className={`risk-flag-card risk-card-enter-smooth rounded-2xl border p-3 text-left transition duration-500 ${isRiskCardsFadingOut ? 'opacity-0' : 'opacity-100'} hover:-translate-y-[1px] hover:shadow-md ${severityClassName}`}
              style={{ animationDelay: `${Math.min(findingIndex * 60, 420)}ms` }}
              onClick={() => setSelectedRiskFinding(findingItem)}
              type="button"
            >
              <p className={`risk-flag-severity text-xs font-semibold uppercase tracking-[0.14em] ${severityBadgeClassName}`}>{findingItem.severity}</p>
              <p className="mt-1 font-semibold text-slate-900">{findingItem.title}</p>
              <p className="text-sm text-slate-600">{findingItem.detail}</p>
            </button>
            )
          })}
        </div>
      </section>

      <section id="goals" className="section-tight glass-panel-soft squircle-md z-layer-section mb-4 scroll-mt-40 p-4 md:mb-6 md:p-6" style={{ order: 12 }}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900">Power Goals</h2>
          <button className="rounded-2xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700" onClick={() => setIsAddGoalModalOpen(true)} type="button">Add Goals Here</button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <article className="squircle-sm border border-slate-200/90 bg-white/90 p-3"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Completed</p><p className="text-2xl font-bold text-emerald-700">{powerGoalsFormulaSummary.completedCount}</p><p className="text-xs text-slate-500">Formula: status equals completed</p></article>
          <article className="squircle-sm border border-slate-200/90 bg-white/90 p-3"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Not started</p><p className="text-2xl font-bold text-rose-700">{powerGoalsFormulaSummary.notStartedCount}</p><p className="text-xs text-slate-500">Formula: status equals not started</p></article>
          <article className="squircle-sm border border-slate-200/90 bg-white/90 p-3"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Completion rate</p><p className="text-2xl font-bold text-sky-700">{powerGoalsFormulaSummary.completionRatePercent.toFixed(2)}%</p><p className="text-xs text-slate-500">Formula: completed divided by total goals</p></article>
        </div>
        <div className="table-scroll-region mt-4 rounded-2xl border border-slate-200/90 bg-white/75 backdrop-blur">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                {renderSortableHeaderCell('goals', 'title', 'Item')}
                {renderSortableHeaderCell('goals', 'status', 'Status')}
                {renderSortableHeaderCell('goals', 'timeframeMonths', 'Timeframe(months)', true)}
                {renderSortableHeaderCell('goals', 'description', 'Description')}
              </tr>
            </thead>
            <tbody>
              {goalRowsSortedByTimeframeAndStatus.map((goalItem, goalIndex) => {
                const title = typeof goalItem.title === 'string' ? goalItem.title : `Goal ${goalIndex + 1}`
                const status = typeof goalItem.status === 'string' ? goalItem.status : 'not started'
                const timeframeMonths = typeof goalItem.timeframeMonths === 'number' ? goalItem.timeframeMonths : Number(goalItem.timeframeMonths ?? 0)
                const description = typeof goalItem.description === 'string' ? goalItem.description : ''
                return (
                  <tr key={`${title}-${goalIndex}`} className="border-t border-slate-200 bg-white">
                    <td className="px-3 py-2 font-semibold text-slate-800">{title}</td>
                    <td className="px-3 py-2 text-slate-700">{status}</td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-700">{Number.isFinite(timeframeMonths) ? timeframeMonths : 0}</td>
                    <td className="px-3 py-2 text-slate-500">{description}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section id="debts" className="section-tight glass-panel-soft squircle-md z-layer-section mb-4 scroll-mt-40 p-4 md:mb-6 md:p-6" style={{ order: 2 }}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-900">Debts / Loans</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Add Debts here</span>
              <button className="rounded-xl border border-white/30 bg-amber-600 px-3 py-2 text-xs font-semibold text-white" onClick={() => openAddRecordModalWithPresetTypeAndCategory('debt', 'Debt Payment')} type="button">+ Quick Add</button>
            </div>
          </div>
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <article className="squircle-sm border border-slate-200/90 bg-white/90 p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Total Debts + Loans</p>
              <p className="text-2xl font-bold text-rose-700">{formatCurrencyValueForDashboard(debtRows.reduce((runningTotal, debtItem) => runningTotal + (typeof debtItem.amount === 'number' ? debtItem.amount : 0), 0))}</p>
            </article>
            <article className="squircle-sm border border-slate-200/90 bg-white/90 p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Monthly</p>
              <p className="text-2xl font-bold text-amber-700">{formatCurrencyValueForDashboard(totalMonthlyDebtPayment)}</p>
            </article>
            <article className="squircle-sm border border-slate-200/90 bg-white/90 p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Mortgage</p>
              <p className="text-2xl font-bold text-sky-700">{formatCurrencyValueForDashboard(totalMortgageBalance)}</p>
            </article>
          </div>
          <div className="table-scroll-region mb-6 rounded-2xl border border-slate-200/90 bg-white/75 backdrop-blur">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  {renderSortableHeaderCell('debts', 'person', 'Person')}
                  {renderSortableHeaderCell('debts', 'item', 'Item')}
                  {renderSortableHeaderCell('debts', 'amount', 'Value', true)}
                  {renderSortableHeaderCell('debts', 'minimumPayment', 'Per Month', true)}
                  {renderSortableHeaderCell('debts', 'interestRatePercent', 'Rate', true)}
                  {renderSortableHeaderCell('debts', 'loanStartDate', 'Loan Start')}
                  {renderSortableHeaderCell('debts', 'remainingPayments', 'Remaining Pmts', true)}
                  <th className="px-3 py-2 text-right font-semibold">Payoff Date</th>
                  {renderSortableHeaderCell('debts', 'collateralAssetName', 'Collateral')}
                  {renderSortableHeaderCell('debts', 'collateralAssetMarketValue', 'Market Value', true)}
                  {renderSortableHeaderCell('debts', 'description', 'Description')}
                  <th className="px-3 py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {debtRowsSorted.map((debtItem, debtIndex) => {
                  const stableKey = typeof debtItem.id === 'string' ? debtItem.id : `debt-row-${debtIndex}`
                  const person = typeof debtItem.person === 'string' ? debtItem.person : DEFAULT_PERSONA_NAME
                  const item = typeof debtItem.item === 'string'
                    ? debtItem.item
                    : (typeof debtItem.category === 'string' ? debtItem.category : '')
                  const value = typeof debtItem.amount === 'number' ? debtItem.amount : 0
                  const perMonth = typeof debtItem.minimumPayment === 'number' ? debtItem.minimumPayment : 0
                  const interestRatePercent = typeof debtItem.interestRatePercent === 'number' ? debtItem.interestRatePercent : 0
                  const loanStartDate = typeof debtItem.loanStartDate === 'string' ? debtItem.loanStartDate : ''
                  const remainingPayments = typeof debtItem.remainingPayments === 'number' ? debtItem.remainingPayments : 0
                  const [calculatedPaybackMonths] = calculateEstimatedPayoffMonthsFromBalancePaymentAndInterestRate(value, perMonth, interestRatePercent)
                  const payoffMonthsForProjection = remainingPayments > 0 ? remainingPayments : Number(calculatedPaybackMonths ?? 0)
                  const projectedPayoffDate = formatProjectedPayoffDateFromMonthsOffset(payoffMonthsForProjection)
                  const collateralAssetName = typeof debtItem.collateralAssetName === 'string' ? debtItem.collateralAssetName : ''
                  const collateralAssetMarketValue = typeof debtItem.collateralAssetMarketValue === 'number' ? debtItem.collateralAssetMarketValue : 0
                  const description = typeof debtItem.description === 'string' ? debtItem.description : ''
                  return (
                    <tr key={stableKey} className="group border-t border-slate-200 bg-white">
                      <td className="px-3 py-2 text-slate-700">{formatPersonaLabelWithEmoji(person, personaEmojiByName)}</td>
                      <td className="px-3 py-2 text-slate-700">{item}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-700"><span className="inline-flex items-center">{formatCurrencyValueForDashboard(value)}{renderStaleUpdateIconIfNeeded(debtItem)}</span></td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-700">{formatCurrencyValueForDashboard(perMonth)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-700">{interestRatePercent.toFixed(2)}%</td>
                      <td className="px-3 py-2 text-slate-700">{loanStartDate}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-700">{remainingPayments}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-700">{projectedPayoffDate}</td>
                      <td className="px-3 py-2 text-slate-700">{collateralAssetName}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-700">{formatCurrencyValueForDashboard(collateralAssetMarketValue)}</td>
                      <td className="px-3 py-2 text-slate-500">{description}</td>
                      <td className="px-3 py-2 text-right">{renderRecordActionsWithIconButtons(String(debtItem.__collectionName), debtItem)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
      </section>

      <section id="credit" className="section-tight glass-panel-soft squircle-md z-layer-section mb-4 scroll-mt-40 p-4 md:mb-6 md:p-6" style={{ order: 3 }}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-900">Credit Accounts</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Utilization and payoff planning</span>
              <button className="rounded-xl border border-white/30 bg-rose-600 px-3 py-2 text-xs font-semibold text-white" onClick={() => openAddRecordModalWithPresetTypeAndCategory('credit_card', 'Credit Card')} type="button">+ Quick Add</button>
            </div>
          </div>
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <article className="squircle-sm border border-slate-200/90 bg-white/90 p-3"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Total</p><p className="text-xl font-bold text-rose-700">{formatCurrencyValueForDashboard(creditCardSummary.totalCurrent)}</p></article>
            <article className="squircle-sm border border-slate-200/90 bg-white/90 p-3"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Monthly</p><p className="text-xl font-bold text-amber-700">{formatCurrencyValueForDashboard(creditCardSummary.totalMonthly)}</p></article>
            <article className="squircle-sm border border-slate-200/90 bg-white/90 p-3"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Utilization</p><p className="text-xl font-bold text-violet-700">{creditCardSummary.totalUtilizationPercent.toFixed(2)}%</p></article>
            <article className="squircle-sm border border-slate-200/90 bg-white/90 p-3"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Remaining</p><p className="text-xl font-bold text-slate-700">{formatCurrencyValueForDashboard(creditCardSummary.remainingCapacity)}</p></article>
            <article className="squircle-sm border border-slate-200/90 bg-white/90 p-3"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Max Capacity</p><p className="text-xl font-bold text-sky-700">{formatCurrencyValueForDashboard(creditCardSummary.maxCapacity)}</p></article>
          </div>
          <div className="table-scroll-region mb-6 rounded-2xl border border-slate-200/90 bg-white/75 backdrop-blur">
            <table className="w-full min-w-[980px] border-collapse text-sm">
              <thead className="bg-slate-100 text-slate-600"><tr>{renderSortableHeaderCell('credit', 'person', 'Person')}{renderSortableHeaderCell('credit', 'item', 'Account')}{renderSortableHeaderCell('credit', 'maxCapacity', 'Max', true)}{renderSortableHeaderCell('credit', 'currentBalance', 'Current', true)}{renderSortableHeaderCell('credit', 'minimumPayment', 'Minimum', true)}{renderSortableHeaderCell('credit', 'monthlyPayment', 'Monthly', true)}{renderSortableHeaderCell('credit', 'interestRatePercent', 'Rate', true)}<th className="px-3 py-2 text-right font-semibold">Utilization</th><th className="px-3 py-2 text-right font-semibold">Remaining</th><th className="px-3 py-2 text-right font-semibold">Payback(months)</th><th className="px-3 py-2 text-right font-semibold">Payoff Date</th><th className="px-3 py-2 text-right font-semibold">Actions</th></tr></thead>
              <tbody>{creditRowsSorted.map((creditCardItem, creditIndex) => { const stableKey = typeof creditCardItem.id === 'string' ? creditCardItem.id : `credit-info-row-${creditIndex}`; const person = typeof creditCardItem.person === 'string' ? creditCardItem.person : DEFAULT_PERSONA_NAME; const item = typeof creditCardItem.item === 'string' ? creditCardItem.item : ''; const maxCapacity = typeof creditCardItem.maxCapacity === 'number' ? creditCardItem.maxCapacity : 0; const currentBalance = typeof creditCardItem.currentBalance === 'number' ? creditCardItem.currentBalance : 0; const minimumPayment = typeof creditCardItem.minimumPayment === 'number' ? creditCardItem.minimumPayment : 0; const monthlyPayment = typeof creditCardItem.monthlyPayment === 'number' ? creditCardItem.monthlyPayment : 0; const interestRatePercent = typeof creditCardItem.interestRatePercent === 'number' ? creditCardItem.interestRatePercent : 0; const utilizationPercent = maxCapacity > 0 ? (currentBalance / maxCapacity) * 100 : 0; const remainingCapacity = maxCapacity - currentBalance; const [paybackMonths] = calculateEstimatedPayoffMonthsFromBalancePaymentAndInterestRate(currentBalance, monthlyPayment, interestRatePercent); const projectedPayoffDate = formatProjectedPayoffDateFromMonthsOffset(Number(paybackMonths ?? 0)); return <tr key={stableKey} className="group border-t border-slate-200 bg-white"><td className="px-3 py-2 text-slate-700">{formatPersonaLabelWithEmoji(person, personaEmojiByName)}</td><td className="px-3 py-2 text-slate-700">{item}</td><td className="px-3 py-2 text-right font-semibold text-slate-700">{formatCurrencyValueForDashboard(maxCapacity)}</td><td className="px-3 py-2 text-right font-semibold text-slate-700"><span className="inline-flex items-center">{formatCurrencyValueForDashboard(currentBalance)}{renderStaleUpdateIconIfNeeded(creditCardItem)}</span></td><td className="px-3 py-2 text-right font-semibold text-slate-700">{formatCurrencyValueForDashboard(minimumPayment)}</td><td className="px-3 py-2 text-right font-semibold text-slate-700">{formatCurrencyValueForDashboard(monthlyPayment)}</td><td className="px-3 py-2 text-right font-semibold text-slate-700">{interestRatePercent.toFixed(2)}%</td><td className="px-3 py-2 text-right font-semibold text-slate-700">{utilizationPercent.toFixed(2)}%</td><td className="px-3 py-2 text-right font-semibold text-slate-700">{formatCurrencyValueForDashboard(remainingCapacity)}</td><td className="px-3 py-2 text-right font-semibold text-slate-700">{Number(paybackMonths ?? 0).toFixed(1)}</td><td className="px-3 py-2 text-right font-semibold text-slate-700">{projectedPayoffDate}</td><td className="px-3 py-2 text-right">{renderRecordActionsWithIconButtons('creditCards', creditCardItem)}</td></tr> })}</tbody>
            </table>
          </div>
          <div className="rounded-2xl border border-slate-200/90 bg-white/75 p-4 backdrop-blur">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-bold text-slate-900">Payment Recommendation</h3>
              <span className="text-xs text-slate-500">{creditCardRecommendations.strategy}</span>
            </div>
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <article className="squircle-sm border border-slate-200/90 bg-white/90 p-3"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Current Monthly</p><p className="text-xl font-bold text-slate-700">{formatCurrencyValueForDashboard(creditCardRecommendations.currentTotalMonthlyPayment)}</p></article>
              <article className="squircle-sm border border-slate-200/90 bg-white/90 p-3"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Recommended Monthly</p><p className="text-xl font-bold text-teal-700">{formatCurrencyValueForDashboard(creditCardRecommendations.recommendedTotalMonthlyPayment)}</p></article>
              <article className="squircle-sm border border-slate-200/90 bg-white/90 p-3"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Payoff Improvement</p><p className="text-xl font-bold text-sky-700">{Math.max(0, creditCardRecommendations.weightedPayoffMonthsCurrent - creditCardRecommendations.weightedPayoffMonthsRecommended).toFixed(1)} months faster</p></article>
            </div>
            <div className="table-scroll-region rounded-2xl border border-slate-200/90 bg-white/75 backdrop-blur">
              <table className="w-full min-w-[980px] border-collapse text-sm">
                <thead className="bg-slate-100 text-slate-600"><tr><th className="px-3 py-2 text-left font-semibold">Person</th><th className="px-3 py-2 text-left font-semibold">Card</th><th className="px-3 py-2 text-right font-semibold">APR</th><th className="px-3 py-2 text-right font-semibold">Utilization</th><th className="px-3 py-2 text-right font-semibold">Current</th><th className="px-3 py-2 text-right font-semibold">Recommended</th><th className="px-3 py-2 text-right font-semibold">Months Now</th><th className="px-3 py-2 text-right font-semibold">Months Reco</th><th className="px-3 py-2 text-left font-semibold">Reason</th></tr></thead>
                <tbody>{creditCardRecommendations.rows.map((rowItem) => <tr key={rowItem.id} className="border-t border-slate-200 bg-white"><td className="px-3 py-2 text-slate-700">{formatPersonaLabelWithEmoji(rowItem.person, personaEmojiByName)}</td><td className="px-3 py-2 text-slate-700">{rowItem.item}</td><td className="px-3 py-2 text-right font-semibold text-slate-700">{rowItem.interestRatePercent.toFixed(2)}%</td><td className="px-3 py-2 text-right font-semibold text-slate-700">{rowItem.utilizationPercent.toFixed(2)}%</td><td className="px-3 py-2 text-right font-semibold text-slate-700">{formatCurrencyValueForDashboard(rowItem.currentMonthlyPayment)}</td><td className="px-3 py-2 text-right font-semibold text-teal-700">{formatCurrencyValueForDashboard(rowItem.recommendedMonthlyPayment)}</td><td className="px-3 py-2 text-right font-semibold text-slate-700">{rowItem.estimatedMonthsCurrent.toFixed(1)}</td><td className="px-3 py-2 text-right font-semibold text-sky-700">{rowItem.estimatedMonthsRecommended.toFixed(1)}</td><td className="px-3 py-2 text-slate-500">{rowItem.recommendationReason}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
      </section>

      <section id="savings" className="section-tight glass-panel-soft squircle-md z-layer-section mb-4 scroll-mt-40 p-4 md:mb-6 md:p-6" style={{ order: 4 }}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-900">Monthly Savings Storage</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Where monthly savings are being held</span>
              <button className="rounded-xl border border-white/30 bg-emerald-600 px-3 py-2 text-xs font-semibold text-white" onClick={() => openAddRecordModalWithPresetTypeAndCategory('savings', 'Savings')} type="button">+ Quick Add</button>
            </div>
          </div>
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <article className="squircle-sm border border-slate-200/90 bg-white/90 p-3"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Monthly Savings</p><p className={`text-2xl font-bold ${monthlySavingsStorageSummary.monthlySavingsAmount >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatCurrencyValueForDashboard(monthlySavingsStorageSummary.monthlySavingsAmount)}</p></article>
            <article className="squircle-sm border border-slate-200/90 bg-white/90 p-3"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Savings Rate</p><p className={`text-2xl font-bold ${monthlySavingsStorageSummary.monthlySavingsRatePercent >= 0 ? 'text-sky-700' : 'text-rose-700'}`}>{monthlySavingsStorageSummary.monthlySavingsRatePercent.toFixed(2)}%</p></article>
            <article className="squircle-sm border border-slate-200/90 bg-white/90 p-3"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Total Stored</p><p className="text-2xl font-bold text-teal-700">{formatCurrencyValueForDashboard(monthlySavingsStorageSummary.totalStoredSavings)}</p></article>
          </div>
          <div className="mb-4 rounded-2xl border border-slate-200/90 bg-white/75 p-4 backdrop-blur">
            <h3 className="text-base font-bold text-slate-900">Recommended Savings Target</h3>
            <p className="mt-1 text-xs text-slate-500">{savingsRecommendation.recommendationReason}</p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-5">
              <article className="squircle-sm border border-slate-200/90 bg-white/90 p-3"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Total Income</p><p className="text-xl font-bold text-slate-700">{formatCurrencyValueForDashboard(savingsRecommendation.totalIncomeForReference)}</p></article>
              <article className="squircle-sm border border-slate-200/90 bg-white/90 p-3"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Recommended</p><p className="text-xl font-bold text-emerald-700">{formatCurrencyValueForDashboard(savingsRecommendation.recommendedMonthlySavings)}</p></article>
              <article className="squircle-sm border border-slate-200/90 bg-white/90 p-3"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Recommended Rate</p><p className="text-xl font-bold text-sky-700">{savingsRecommendation.recommendedSavingsRatePercent.toFixed(2)}%</p></article>
              <article className="squircle-sm border border-slate-200/90 bg-white/90 p-3"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Target Range</p><p className="text-sm font-bold text-slate-700">{formatCurrencyValueForDashboard(savingsRecommendation.minimumRecommendedSavings)} - {formatCurrencyValueForDashboard(savingsRecommendation.stretchRecommendedSavings)}</p></article>
              <article className="squircle-sm border border-slate-200/90 bg-white/90 p-3"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Gap</p><p className={`text-xl font-bold ${savingsRecommendation.gapToRecommendedSavings <= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatCurrencyValueForDashboard(savingsRecommendation.gapToRecommendedSavings)}</p></article>
            </div>
          </div>
          <div className="mb-4 rounded-2xl border border-slate-200/90 bg-white/75 p-4 backdrop-blur">
            <h3 className="text-base font-bold text-slate-900">Predicted Savings</h3>
            <p className="mt-1 text-xs text-slate-500">This chart estimates total savings at each horizon using your current monthly savings pace (no scenario multiplier applied).</p>
            <div className="predicted-savings-chart mt-3 rounded-2xl border border-slate-200/90 bg-white/90 p-2">
              <div className="mb-2 flex items-center justify-between rounded-lg border border-slate-200/80 bg-slate-50/90 px-3 py-2 text-[11px] text-slate-600">
                <span><span className="mr-2 inline-block h-2 w-2 rounded-sm bg-sky-500 align-middle" />Bars = projected total savings</span>
                <span>Y-axis: USD | X-axis: horizon</span>
              </div>
              <div className="grid grid-cols-[56px_minmax(0,1fr)] gap-2">
                <div className="flex flex-col items-end justify-between pr-2 text-[10px] font-semibold text-slate-500">
                  <span>{formatCurrencyValueForDashboard(maxProjectedSavingsValue)}</span>
                  <span>{formatCurrencyValueForDashboard(maxProjectedSavingsValue * 0.5)}</span>
                  <span>{formatCurrencyValueForDashboard(0)}</span>
                </div>
                <div>
                  <div className="predicted-savings-plot relative h-44 rounded-xl border border-slate-200/90 bg-gradient-to-b from-slate-50 to-slate-100/70 p-1.5">
                    <div className="pointer-events-none absolute inset-1.5 flex flex-col justify-between">
                      <div className="h-px w-full bg-slate-300/80" />
                      <div className="h-px w-full bg-slate-300/60" />
                      <div className="h-px w-full bg-slate-300/80" />
                    </div>
                    <div className="relative z-10 flex h-full items-end justify-around gap-2">
                      {savingsProjectionRows.map((projectionRow, projectionIndex) => {
                        const safeAmount = Math.max(0, projectionRow.projectedSavings)
                        const ratio = maxProjectedSavingsValue > 0 ? safeAmount / maxProjectedSavingsValue : 0
                        return (
                          <div key={projectionRow.id} className="flex min-w-0 flex-1 flex-col items-center justify-end">
                            <p className="mb-1 text-[10px] font-bold text-slate-700">{formatCurrencyValueForDashboard(projectionRow.projectedSavings)}</p>
                            <div
                              className="w-full max-w-[52px] rounded-t-lg border border-sky-300/70 bg-sky-500/75 transition-all duration-500"
                              style={{
                                height: `${Math.max(4, ratio * 136)}px`
                              }}
                            />
                            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">{projectionRow.label}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  <p className="mt-2 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Time Horizon</p>
                </div>
              </div>
            </div>
          </div>
          <div className="table-scroll-region rounded-2xl border border-slate-200/90 bg-white/75 backdrop-blur">
            <table className="w-full min-w-[840px] border-collapse text-sm">
              <thead className="bg-slate-100 text-slate-600"><tr>{renderSortableHeaderCell('savings', 'person', 'Person')}{renderSortableHeaderCell('savings', 'location', 'Storage')}{renderSortableHeaderCell('savings', 'balance', 'Balance', true)}{renderSortableHeaderCell('savings', 'allocationPercent', 'Allocation', true)}{renderSortableHeaderCell('savings', 'description', 'Description')}</tr></thead>
              <tbody>{savingsStorageRowsSorted.map((rowItem) => <tr key={rowItem.id} className="border-t border-slate-200 bg-white"><td className="px-3 py-2 text-slate-700">{formatPersonaLabelWithEmoji(rowItem.person, personaEmojiByName)}</td><td className="px-3 py-2 text-slate-700">{rowItem.location}</td><td className="px-3 py-2 text-right font-semibold text-slate-700">{formatCurrencyValueForDashboard(rowItem.balance)}</td><td className="px-3 py-2 text-right font-semibold text-slate-700">{rowItem.allocationPercent.toFixed(2)}%</td><td className="px-3 py-2 text-slate-500">{rowItem.description}</td></tr>)}</tbody>
            </table>
          </div>
      </section>

      <section id="assets" className="section-tight glass-panel-soft squircle-md z-layer-section mb-4 scroll-mt-40 p-4 md:mb-6 md:p-6" style={{ order: 1 }}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-slate-900">Assets</h2>
          <div className="flex items-center gap-2">
            <button className="rounded-xl border border-white/30 bg-cyan-600 px-3 py-2 text-xs font-semibold text-white" onClick={() => setIsAddAssetModalOpen(true)} type="button">+ Add Asset</button>
          </div>
        </div>
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <article className="squircle-sm border border-slate-200/90 bg-white/90 p-3"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Total</p><p className="text-2xl font-bold text-cyan-700">{formatCurrencyValueForDashboard(totalAssetHoldingsValue)}</p></article>
          <article className="squircle-sm border border-slate-200/90 bg-white/90 p-3"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Records</p><p className="text-2xl font-bold text-slate-700">{assetHoldingRows.length}</p></article>
        </div>
        <div className="table-scroll-region rounded-2xl border border-slate-200/90 bg-white/75 backdrop-blur">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead className="bg-slate-100 text-slate-600"><tr>{renderSortableHeaderCell('assets', 'person', 'Person')}{renderSortableHeaderCell('assets', 'item', 'Item')}{renderSortableHeaderCell('assets', 'assetValueOwed', 'Asset Value Owed', true)}{renderSortableHeaderCell('assets', 'assetMarketValue', 'Asset Market Value', true)}{renderSortableHeaderCell('assets', 'value', 'Value', true)}{renderSortableHeaderCell('assets', 'description', 'Description')}<th className="px-3 py-2 text-right font-semibold">Actions</th></tr></thead>
            <tbody>{assetHoldingRowsSorted.map((rowItem) => <tr key={String(rowItem.id)} className="group border-t border-slate-200 bg-white"><td className="px-3 py-2 text-slate-700">{formatPersonaLabelWithEmoji(String(rowItem.person ?? ''), personaEmojiByName)}</td><td className="px-3 py-2 text-slate-700">{String(rowItem.item ?? '')}</td><td className="px-3 py-2 text-right font-semibold text-slate-700">{formatCurrencyValueForDashboard(typeof rowItem.assetValueOwed === 'number' ? rowItem.assetValueOwed : 0)}</td><td className="px-3 py-2 text-right font-semibold text-slate-700">{formatCurrencyValueForDashboard(typeof rowItem.assetMarketValue === 'number' ? rowItem.assetMarketValue : 0)}</td><td className={`px-3 py-2 text-right font-semibold ${(typeof rowItem.value === 'number' ? rowItem.value : 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatCurrencyValueForDashboard(typeof rowItem.value === 'number' ? rowItem.value : 0)}</td><td className="px-3 py-2 text-slate-500">{String(rowItem.description ?? '')}</td><td className="px-3 py-2 text-right">{renderRecordActionsWithIconButtons('assetHoldings', rowItem)}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      {false ? (<section id="planning" className="section-tight glass-panel-soft squircle-md z-layer-section mb-4 scroll-mt-40 p-4 md:mb-6 md:p-6" style={{ order: 7 }}>
        <div className="mb-5"><h2 className="text-lg font-bold text-slate-900">Planning Engine</h2><p className="text-xs text-slate-500">Budget hygiene, forecast layers, debt execution, scenarios, and month-close readiness.</p></div>
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <article className="squircle-sm border border-slate-200/90 bg-white/90 p-3"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Forecast: Committed</p><p className="text-xl font-bold text-rose-700">{formatCurrencyValueForDashboard(planningInsights.forecast.committed)}</p></article>
          <article className="squircle-sm border border-slate-200/90 bg-white/90 p-3"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Forecast: Planned</p><p className="text-xl font-bold text-sky-700">{formatCurrencyValueForDashboard(planningInsights.forecast.planned)}</p></article>
          <article className="squircle-sm border border-slate-200/90 bg-white/90 p-3"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Forecast Risk</p><p className={`text-xl font-bold ${planningInsights.forecast.projectedRiskLevel === 'low' ? 'text-emerald-700' : (planningInsights.forecast.projectedRiskLevel === 'medium' ? 'text-amber-700' : 'text-rose-700')}`}>{planningInsights.forecast.projectedRiskLevel}</p></article>
        </div>
        <div className="mb-4 table-scroll-region rounded-2xl border border-slate-200/90 bg-white/75 backdrop-blur">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead className="bg-slate-100 text-slate-600"><tr><th className="px-3 py-2 text-left font-semibold">Category</th><th className="px-3 py-2 text-right font-semibold">Budget</th><th className="px-3 py-2 text-right font-semibold">Actual</th><th className="px-3 py-2 text-right font-semibold">Variance</th><th className="px-3 py-2 text-right font-semibold">Run-rate (EOM)</th></tr></thead>
            <tbody>{planningInsights.budgetVsActualRows.slice(0, 10).map((rowItem) => <tr key={`bva-${rowItem.category}`} className="border-t border-slate-200 bg-white"><td className="px-3 py-2 text-slate-700">{rowItem.category}</td><td className="px-3 py-2 text-right font-semibold text-slate-700">{formatCurrencyValueForDashboard(rowItem.planned)}</td><td className="px-3 py-2 text-right font-semibold text-slate-700">{formatCurrencyValueForDashboard(rowItem.actual)}</td><td className={`px-3 py-2 text-right font-semibold ${rowItem.variance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatCurrencyValueForDashboard(rowItem.variance)}</td><td className="px-3 py-2 text-right font-semibold text-slate-700">{formatCurrencyValueForDashboard(rowItem.runRateMonthEnd)}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="table-scroll-region rounded-2xl border border-slate-200/90 bg-white/75 backdrop-blur">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead className="bg-slate-100 text-slate-600"><tr><th className="px-3 py-2 text-left font-semibold">Recurring Baseline</th><th className="px-3 py-2 text-right font-semibold">Amount</th><th className="px-3 py-2 text-left font-semibold">Cadence</th></tr></thead>
              <tbody>{planningInsights.recurringBaselineRows.slice(0, 10).map((rowItem) => <tr key={rowItem.id} className="border-t border-slate-200 bg-white"><td className="px-3 py-2 text-slate-700">{rowItem.category}</td><td className="px-3 py-2 text-right font-semibold text-slate-700">{formatCurrencyValueForDashboard(rowItem.amount)}</td><td className="px-3 py-2 text-slate-500">{rowItem.cadence}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="table-scroll-region rounded-2xl border border-slate-200/90 bg-white/75 backdrop-blur">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead className="bg-slate-100 text-slate-600"><tr><th className="px-3 py-2 text-left font-semibold">Scenario</th><th className="px-3 py-2 text-right font-semibold">Monthly Delta</th><th className="px-3 py-2 text-right font-semibold">Debt-free Delta</th><th className="px-3 py-2 text-right font-semibold">Runway (months)</th></tr></thead>
              <tbody>{planningInsights.scenarioRows.map((rowItem) => <tr key={rowItem.id} className="border-t border-slate-200 bg-white"><td className="px-3 py-2 text-slate-700">{rowItem.label}</td><td className={`px-3 py-2 text-right font-semibold ${rowItem.monthlyDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatCurrencyValueForDashboard(rowItem.monthlyDelta)}</td><td className="px-3 py-2 text-right font-semibold text-slate-700">{rowItem.debtFreeMonthsDelta.toFixed(1)} mo</td><td className="px-3 py-2 text-right font-semibold text-slate-700">{rowItem.runwayMonths.toFixed(2)}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
        <div className="mb-4 table-scroll-region rounded-2xl border border-slate-200/90 bg-white/75 backdrop-blur">
          <table className="w-full min-w-[920px] border-collapse text-sm">
            <thead className="bg-slate-100 text-slate-600"><tr><th className="px-3 py-2 text-left font-semibold">Debt / Loan</th><th className="px-3 py-2 text-right font-semibold">Balance</th><th className="px-3 py-2 text-right font-semibold">Payment</th><th className="px-3 py-2 text-right font-semibold">APR</th><th className="px-3 py-2 text-right font-semibold">Remaining Pmts</th><th className="px-3 py-2 text-right font-semibold">Payoff (months)</th></tr></thead>
            <tbody>{planningInsights.amortizationRows.map((rowItem) => <tr key={rowItem.id} className="border-t border-slate-200 bg-white"><td className="px-3 py-2 text-slate-700">{rowItem.item}</td><td className="px-3 py-2 text-right font-semibold text-slate-700">{formatCurrencyValueForDashboard(rowItem.startBalance)}</td><td className="px-3 py-2 text-right font-semibold text-slate-700">{formatCurrencyValueForDashboard(rowItem.payment)}</td><td className="px-3 py-2 text-right font-semibold text-slate-700">{rowItem.interestRatePercent.toFixed(2)}%</td><td className="px-3 py-2 text-right font-semibold text-slate-700">{Math.round(rowItem.remainingPayments)}</td><td className="px-3 py-2 text-right font-semibold text-slate-700">{rowItem.projectedPayoffMonths.toFixed(1)}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="table-scroll-region rounded-2xl border border-slate-200/90 bg-white/75 backdrop-blur">
            <table className="w-full min-w-[700px] border-collapse text-sm">
              <thead className="bg-slate-100 text-slate-600"><tr><th className="px-3 py-2 text-left font-semibold">Goal Template</th><th className="px-3 py-2 text-right font-semibold">Target</th><th className="px-3 py-2 text-right font-semibold">Months</th><th className="px-3 py-2 text-right font-semibold">Req. / Month</th></tr></thead>
              <tbody>{planningInsights.goalTemplateRows.map((rowItem) => <tr key={rowItem.id} className="border-t border-slate-200 bg-white"><td className="px-3 py-2 text-slate-700">{rowItem.title}</td><td className="px-3 py-2 text-right font-semibold text-slate-700">{formatCurrencyValueForDashboard(rowItem.targetAmount)}</td><td className="px-3 py-2 text-right font-semibold text-slate-700">{Math.round(rowItem.targetMonths)}</td><td className="px-3 py-2 text-right font-semibold text-sky-700">{formatCurrencyValueForDashboard(rowItem.requiredMonthlyContribution)}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="table-scroll-region rounded-2xl border border-slate-200/90 bg-white/75 backdrop-blur">
            <table className="w-full min-w-[700px] border-collapse text-sm">
              <thead className="bg-slate-100 text-slate-600"><tr><th className="px-3 py-2 text-left font-semibold">Risk Provenance</th><th className="px-3 py-2 text-left font-semibold">Formula</th><th className="px-3 py-2 text-left font-semibold">Threshold</th><th className="px-3 py-2 text-right font-semibold">Completeness</th></tr></thead>
              <tbody>{planningInsights.riskProvenanceRows.map((rowItem) => <tr key={rowItem.id} className="border-t border-slate-200 bg-white"><td className="px-3 py-2 text-slate-700">{rowItem.title}</td><td className="px-3 py-2 text-slate-500">{rowItem.formula}</td><td className="px-3 py-2 text-slate-500">{rowItem.threshold}</td><td className="px-3 py-2 text-right font-semibold text-slate-700">{rowItem.dataCompletenessPercent}%</td></tr>)}</tbody>
            </table>
          </div>
        </div>
        <div className="table-scroll-region rounded-2xl border border-slate-200/90 bg-white/75 backdrop-blur">
          <table className="w-full min-w-[700px] border-collapse text-sm">
            <thead className="bg-slate-100 text-slate-600"><tr><th className="px-3 py-2 text-left font-semibold">Reconcile / Close Month</th><th className="px-3 py-2 text-left font-semibold">Status</th><th className="px-3 py-2 text-left font-semibold">Detail</th></tr></thead>
            <tbody>{planningInsights.reconcileChecklistRows.map((rowItem) => <tr key={rowItem.id} className="border-t border-slate-200 bg-white"><td className="px-3 py-2 text-slate-700">{rowItem.label}</td><td className={`px-3 py-2 font-semibold ${rowItem.status === 'ready' ? 'text-emerald-700' : 'text-amber-700'}`}>{rowItem.status}</td><td className="px-3 py-2 text-slate-500">{rowItem.detail}</td></tr>)}</tbody>
          </table>
        </div>
      </section>) : null}

      {false ? (<section id="trends" className="section-tight glass-panel-soft squircle-md z-layer-section mb-4 scroll-mt-40 p-4 md:mb-6 md:p-6" style={{ order: 8 }}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Historical Trends</h2>
            <p className="text-xs text-slate-500">Net worth, DTI, savings rate, and utilization over 3/6/12 month windows.</p>
          </div>
          <div className="flex items-center gap-1">
            <button className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${trendWindowMonths === 3 ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'}`} onClick={() => setTrendWindowMonths(3)} type="button">3M</button>
            <button className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${trendWindowMonths === 6 ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'}`} onClick={() => setTrendWindowMonths(6)} type="button">6M</button>
            <button className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${trendWindowMonths === 12 ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'}`} onClick={() => setTrendWindowMonths(12)} type="button">12M</button>
          </div>
        </div>
        <div className="mb-4 rounded-2xl border border-slate-200/90 bg-white/75 p-3 backdrop-blur">
          <div className="flex items-end gap-1">
            {trendRowsInSelectedWindow.map((rowItem) => {
              const range = Math.max(1, trendNetWorthMinMax.max - trendNetWorthMinMax.min)
              const normalizedHeight = ((rowItem.netWorth - trendNetWorthMinMax.min) / range) * 100
              return (
                <div key={`trend-networth-${rowItem.monthKey}`} className="flex min-w-[42px] flex-col items-center gap-1">
                  <div className="w-full rounded-t-md bg-cyan-500/80" style={{ height: `${Math.max(10, normalizedHeight)}px` }} />
                  <span className="text-[10px] font-semibold text-slate-500">{rowItem.monthKey.slice(5)}</span>
                </div>
              )
            })}
          </div>
        </div>
        <div className="table-scroll-region rounded-2xl border border-slate-200/90 bg-white/75 backdrop-blur">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead className="bg-slate-100 text-slate-600"><tr><th className="px-3 py-2 text-left font-semibold">Month</th><th className="px-3 py-2 text-right font-semibold">Net Worth</th><th className="px-3 py-2 text-right font-semibold">DTI</th><th className="px-3 py-2 text-right font-semibold">Savings Rate</th><th className="px-3 py-2 text-right font-semibold">Utilization</th></tr></thead>
            <tbody>{trendRowsInSelectedWindow.map((rowItem) => <tr key={`trend-row-${rowItem.monthKey}`} className="border-t border-slate-200 bg-white"><td className="px-3 py-2 text-slate-700">{rowItem.monthKey}</td><td className={`px-3 py-2 text-right font-semibold ${rowItem.netWorth >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatCurrencyValueForDashboard(rowItem.netWorth)}</td><td className="px-3 py-2 text-right font-semibold text-slate-700">{rowItem.debtToIncomePercent.toFixed(2)}%</td><td className={`px-3 py-2 text-right font-semibold ${rowItem.savingsRatePercent >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{rowItem.savingsRatePercent.toFixed(2)}%</td><td className="px-3 py-2 text-right font-semibold text-slate-700">{rowItem.utilizationPercent.toFixed(2)}%</td></tr>)}</tbody>
          </table>
        </div>
      </section>) : null}

      {false ? (<section id="audit" className="section-tight glass-panel-soft squircle-md z-layer-section mb-4 scroll-mt-40 p-4 md:mb-6 md:p-6" style={{ order: 9 }}>
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Audit And Restore</h2>
            <p className="text-xs text-slate-500">Persistent rollback points with summary metrics for each state change.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{auditTimelineEntries.length} snapshots</span>
        </div>
        <div className="table-scroll-region rounded-2xl border border-slate-200/90 bg-white/75 backdrop-blur">
          <table className="w-full min-w-[920px] border-collapse text-sm">
            <thead className="bg-slate-100 text-slate-600"><tr><th className="px-3 py-2 text-left font-semibold">Timestamp</th><th className="px-3 py-2 text-left font-semibold">Context</th><th className="px-3 py-2 text-right font-semibold">Income</th><th className="px-3 py-2 text-right font-semibold">Expenses</th><th className="px-3 py-2 text-right font-semibold">Net Worth</th><th className="px-3 py-2 text-right font-semibold">Actions</th></tr></thead>
            <tbody>{auditTimelineEntries.slice(0, 20).map((entryItem) => <tr key={String(entryItem.id)} className="border-t border-slate-200 bg-white"><td className="px-3 py-2 text-slate-700">{String(entryItem.timestamp ?? '')}</td><td className="px-3 py-2 text-slate-700">{String(entryItem.contextTag ?? '')}</td><td className="px-3 py-2 text-right font-semibold text-slate-700">{formatCurrencyValueForDashboard(typeof entryItem.summary?.totalIncome === 'number' ? entryItem.summary.totalIncome : 0)}</td><td className="px-3 py-2 text-right font-semibold text-slate-700">{formatCurrencyValueForDashboard(typeof entryItem.summary?.totalExpenses === 'number' ? entryItem.summary.totalExpenses : 0)}</td><td className={`px-3 py-2 text-right font-semibold ${(typeof entryItem.summary?.netWorth === 'number' ? entryItem.summary.netWorth : 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatCurrencyValueForDashboard(typeof entryItem.summary?.netWorth === 'number' ? entryItem.summary.netWorth : 0)}</td><td className="px-3 py-2 text-right"><button className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700" onClick={() => { void restoreCollectionsSnapshotFromAuditEntryById(String(entryItem.id)) }} type="button">Restore</button></td></tr>)}</tbody>
          </table>
        </div>
      </section>) : null}

      <section id="loan-calculator" className="section-tight glass-panel-soft squircle-md z-layer-section mb-4 scroll-mt-40 p-4 md:mb-6 md:p-6" style={{ order: 10 }}>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-900">Loan Payoff Calculator</h2>
          <p className="text-xs text-slate-500">Estimate payoff time for base payment versus base + extra payment, including interest savings.</p>
        </div>
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-medium text-slate-700 lg:col-span-4">Use Existing Debt / Loan<select className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white" value={loanCalculatorFormState.selectedLoanKey} onChange={(event) => selectLoanRecordForCalculatorByKey(event.target.value)}><option value="">Manual entry...</option>{loanCalculatorSourceRows.map((rowItem) => <option key={rowItem.key} value={rowItem.key}>{rowItem.label}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Loan Balance<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white" min="0" step="0.01" type="number" value={loanCalculatorFormState.principalBalance} onChange={(event) => updateLoanCalculatorFormFieldValue('principalBalance', event.target.value)} /></label>
          <label className="text-sm font-medium text-slate-700">APR %<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white" min="0" step="0.01" type="number" value={loanCalculatorFormState.annualInterestRatePercent} onChange={(event) => updateLoanCalculatorFormFieldValue('annualInterestRatePercent', event.target.value)} /></label>
          <label className="text-sm font-medium text-slate-700">Base Monthly Payment<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white" min="0" step="0.01" type="number" value={loanCalculatorFormState.baseMonthlyPayment} onChange={(event) => updateLoanCalculatorFormFieldValue('baseMonthlyPayment', event.target.value)} /></label>
          <label className="text-sm font-medium text-slate-700">Extra Monthly Payment<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white" min="0" step="0.01" type="number" value={loanCalculatorFormState.extraMonthlyPayment} onChange={(event) => updateLoanCalculatorFormFieldValue('extraMonthlyPayment', event.target.value)} /></label>
        </div>
        {loanCalculatorResult.error ? (
          <div className="rounded-2xl border border-rose-300 bg-rose-50/80 p-3 text-sm font-semibold text-rose-700">Unable to calculate payoff values. Check all fields are valid numbers.</div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <article className="squircle-sm border border-slate-200/90 bg-white/90 p-3"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Base Payoff</p><p className="text-xl font-bold text-slate-800">{loanCalculatorResult.comparison.baseMonths >= 9999 ? 'Not reachable' : `${loanCalculatorResult.comparison.baseMonths.toFixed(1)} months`}</p></article>
            <article className="squircle-sm border border-slate-200/90 bg-white/90 p-3"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Base + Extra Payoff</p><p className="text-xl font-bold text-sky-700">{loanCalculatorResult.comparison.acceleratedMonths >= 9999 ? 'Not reachable' : `${loanCalculatorResult.comparison.acceleratedMonths.toFixed(1)} months`}</p></article>
            <article className="squircle-sm border border-slate-200/90 bg-white/90 p-3"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Months Saved</p><p className="text-xl font-bold text-emerald-700">{loanCalculatorResult.comparison.monthsSaved.toFixed(1)}</p></article>
            <article className="squircle-sm border border-slate-200/90 bg-white/90 p-3"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Interest (Base)</p><p className="text-xl font-bold text-slate-800">{Number.isFinite(loanCalculatorResult.comparison.baseInterestPaid) ? formatCurrencyValueForDashboard(loanCalculatorResult.comparison.baseInterestPaid) : 'Not reachable'}</p></article>
            <article className="squircle-sm border border-slate-200/90 bg-white/90 p-3"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Interest (Base + Extra)</p><p className="text-xl font-bold text-sky-700">{Number.isFinite(loanCalculatorResult.comparison.acceleratedInterestPaid) ? formatCurrencyValueForDashboard(loanCalculatorResult.comparison.acceleratedInterestPaid) : 'Not reachable'}</p></article>
            <article className="squircle-sm border border-slate-200/90 bg-white/90 p-3"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Interest Saved</p><p className="text-xl font-bold text-emerald-700">{formatCurrencyValueForDashboard(loanCalculatorResult.comparison.interestSaved)}</p></article>
          </div>
        )}
      </section>

      <section id="details" className="section-tight glass-panel-soft squircle-md z-layer-section mb-4 scroll-mt-40 p-4 md:mb-6 md:p-6" style={{ order: 6 }}>
        <div className="mb-5"><h2 className="text-lg font-bold text-slate-900">Detailed Dashboard Metrics</h2></div>
        <div className="table-scroll-region mb-2 rounded-2xl border border-slate-200/90 bg-white/75 backdrop-blur md:mb-6">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead className="bg-slate-100 text-slate-600"><tr>{renderSortableHeaderCell('detailed', 'metric', 'Metric')}{renderSortableHeaderCell('detailed', 'value', 'Value', true)}{renderSortableHeaderCell('detailed', 'value', 'Money', true)}{renderSortableHeaderCell('detailed', 'description', 'Description')}</tr></thead>
            <tbody>{detailedRowsSorted.map((rowItem) => <tr key={rowItem.metric} className="border-t border-slate-200 bg-white"><td className="px-3 py-2 font-semibold text-slate-800">{rowItem.metric}</td><td className="px-3 py-2 text-right font-semibold text-slate-700">{rowItem.valueFormat === 'currency' ? '-' : formatPlainNumericValueForDashboard(rowItem.value, rowItem.valueFormat)}</td><td className="px-3 py-2 text-right font-semibold text-slate-700">{rowItem.valueFormat === 'currency' ? formatCurrencyValueForDashboard(rowItem.value) : '-'}</td><td className="px-3 py-2 text-slate-500">{rowItem.description}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section id="records" className="section-tight glass-panel-soft squircle-md z-layer-section mb-4 scroll-mt-40 p-4 md:mb-6 md:p-6" style={{ order: 5 }}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold text-slate-900">Recent Income, Expense, and Savings Records</h2><div className="flex flex-wrap items-center gap-2"><button className="rounded-xl border border-white/30 bg-emerald-600 px-3 py-2 text-xs font-semibold text-white" onClick={() => openAddRecordModalWithPresetTypeAndCategory('income', 'Income')} type="button">+ Income</button><button className="rounded-xl border border-white/30 bg-rose-600 px-3 py-2 text-xs font-semibold text-white" onClick={() => openAddRecordModalWithPresetTypeAndCategory('expense', 'Miscellaneous')} type="button">+ Expense</button><button className="rounded-xl border border-white/30 bg-sky-600 px-3 py-2 text-xs font-semibold text-white" onClick={() => openAddRecordModalWithPresetTypeAndCategory('savings', 'Savings')} type="button">+ Savings</button><button className="rounded-xl border border-slate-300 bg-white/85 px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40" disabled={transactionUndoDepth <= 0} onClick={() => { void undoMostRecentTransactionChangeFromUndoStack() }} type="button">Undo Transaction</button><span className="rounded-full bg-slate-100/90 px-3 py-1 text-xs font-semibold text-slate-600 backdrop-blur">{incomeAndExpenseRows.length} records</span></div></div>
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <article className="squircle-sm border border-slate-200/90 bg-white/90 p-3"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Total In</p><p className="text-xl font-bold text-emerald-700">{formatCurrencyValueForDashboard(recordsFlowSummary.totalIn)}</p></article>
          <article className="squircle-sm border border-slate-200/90 bg-white/90 p-3"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Total Out</p><p className="text-xl font-bold text-rose-700">{formatCurrencyValueForDashboard(recordsFlowSummary.totalOut)}</p></article>
          <article className="squircle-sm border border-slate-200/90 bg-white/90 p-3"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Diff</p><p className={`text-xl font-bold ${recordsFlowSummary.diff > 0 ? 'text-emerald-700' : (recordsFlowSummary.diff < 0 ? 'text-rose-700' : 'text-slate-600')}`}>{formatCurrencyValueForDashboard(recordsFlowSummary.diff)}</p></article>
        </div>
        <div className="table-scroll-region rounded-2xl border border-slate-200/90 bg-white/75 backdrop-blur">
          <table className="w-full min-w-[840px] border-collapse text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>{renderSortableHeaderCell('records', 'person', 'User')}{renderSortableHeaderCell('records', 'recordType', 'Type')}{renderSortableHeaderCell('records', 'date', 'Date')}{renderSortableHeaderCell('records', 'category', 'Category')}{renderSortableHeaderCell('records', 'description', 'Description')}{renderSortableHeaderCell('records', 'signedAmount', 'Amount', true)}<th className="px-3 py-2 text-right font-semibold">Notes</th><th className="px-3 py-2 text-right font-semibold">Actions</th></tr>
            </thead>
            <tbody>
              {incomeExpenseRowsSorted.map((recordItem, recordIndex) => {
                const recordType = String(recordItem.recordType)
                const person = typeof recordItem.person === 'string' ? recordItem.person : DEFAULT_PERSONA_NAME
                const isIncome = recordType === 'income'
                const isSavings = recordType === 'savings'
                const isAssetType = recordType === 'asset'
                const isDebtLike = recordType === 'debt' || recordType === 'loan' || recordType === 'credit' || recordType === 'credit card'
                const amountValue = typeof recordItem.amount === 'number' ? recordItem.amount : 0
                const badgeClassName = isIncome
                  ? 'record-type-badge record-type-badge-income'
                  : (isSavings ? 'record-type-badge record-type-badge-savings' : 'record-type-badge record-type-badge-expense')
                const amountClassName = amountValue === 0
                  ? 'text-slate-600'
                  : (isIncome ? 'text-emerald-700' : (isAssetType ? 'text-sky-700' : 'text-rose-700'))
                const editCollectionName = isIncome
                  ? 'income'
                  : (isSavings
                    ? 'assets'
                    : (recordType === 'asset'
                      ? 'assetHoldings'
                      : (recordType === 'debt'
                        ? 'debts'
                        : (recordType === 'loan'
                          ? 'loans'
                          : (recordType === 'credit card'
                            ? 'creditCards'
                            : (recordType === 'credit' ? 'credit' : 'expenses'))))))
                const rowStableKey = `${recordType}-${String(recordItem.id ?? 'row')}-${recordIndex}`
                return (
                  <tr key={rowStableKey} className="group border-t border-slate-200 bg-white">
                    <td className="px-3 py-2 text-slate-700">{formatPersonaLabelWithEmoji(person, personaEmojiByName)}</td>
                    <td className="px-3 py-2"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${badgeClassName}`}>{recordType}</span></td>
                    <td className="px-3 py-2 text-slate-700">{typeof recordItem.date === 'string' ? recordItem.date : ''}</td>
                    <td className="px-3 py-2 text-slate-700">{typeof recordItem.category === 'string' ? recordItem.category : (typeof recordItem.item === 'string' ? recordItem.item : '')}</td>
                    <td className="px-3 py-2 text-slate-500">{typeof recordItem.description === 'string' ? recordItem.description : (isDebtLike ? 'Liability record' : '')}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${amountClassName}`}><span className="inline-flex items-center">{formatCurrencyValueForDashboard(amountValue)}{renderStaleUpdateIconIfNeeded(recordItem)}</span></td>
                    <td className="px-3 py-2 text-right">{renderRecordMoreNotesHoverAction(editCollectionName, recordItem)}</td>
                    <td className="px-3 py-2 text-right">{renderRecordActionsWithIconButtons(editCollectionName, recordItem)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
      </div>

      <button className="fixed bottom-4 right-4 z-50 rounded-full border border-white/40 bg-teal-600 px-4 py-3 text-xs font-bold text-white shadow-xl backdrop-blur hover:bg-teal-700" onClick={scrollViewportToTopFromUtilityButton} type="button">Top</button>

      {isAddRecordModalOpen ? (
        <section className="fixed inset-0 z-[5000] flex items-center justify-center p-3 sm:p-4" role="dialog" aria-modal="true" aria-label="Add Income Or Expense Modal">
          <button className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" onClick={() => setIsAddRecordModalOpen(false)} type="button" aria-label="Close add record modal backdrop" />
          <div className="relative z-[5001] w-full max-w-2xl rounded-3xl border border-white/40 bg-white p-4 shadow-2xl sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3"><h3 className="text-lg font-bold text-slate-900">Add Income or Expense</h3><button className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700" onClick={() => setIsAddRecordModalOpen(false)} type="button">Close</button></div>
            <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={submitNewIncomeOrExpenseRecord}>
              <label className="text-sm font-medium text-slate-700">Person<select className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white" value={entryFormState.person} onChange={(event) => updateEntryFormFieldValue('person', event.target.value)}>{personaSelectOptions.map((personaOption) => <option key={personaOption.value} value={personaOption.value}>{personaOption.label}</option>)}<option value="__custom__">Custom person...</option></select></label>
              <label className="text-sm font-medium text-slate-700">Type<select className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white" value={entryFormState.recordType} onChange={(event) => updateEntryFormFieldValue('recordType', event.target.value)}><option value="expense">Expense</option><option value="income">Income</option><option value="savings">Savings</option><option value="asset">Asset</option><option value="debt">Debt</option><option value="loan">Loan</option><option value="credit_card">Credit Account</option></select></label>
              {entryFormState.person === '__custom__' ? (
                <label className="text-sm font-medium text-slate-700 sm:col-span-2">Custom Person<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white" type="text" value={entryFormState.customPerson} onChange={(event) => updateEntryFormFieldValue('customPerson', event.target.value)} /></label>
              ) : null}
              {entryFormState.recordType === 'credit_card' ? (
                <label className="text-sm font-medium text-slate-700">Account<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white" type="text" value={entryFormState.item} onChange={(event) => updateEntryFormFieldValue('item', event.target.value)} /></label>
              ) : null}
              {entryFormState.recordType === 'debt' || entryFormState.recordType === 'loan' ? (
                <label className="text-sm font-medium text-slate-700">Item<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white" type="text" value={entryFormState.item} onChange={(event) => updateEntryFormFieldValue('item', event.target.value)} /></label>
              ) : null}
              <label className="text-sm font-medium text-slate-700">{entryFormState.recordType === 'credit_card' ? 'Current Balance' : 'Amount'}<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white" type="number" step="0.01" value={entryFormState.recordType === 'credit_card' ? entryFormState.currentBalance : entryFormState.amount} onChange={(event) => updateEntryFormFieldValue(entryFormState.recordType === 'credit_card' ? 'currentBalance' : 'amount', event.target.value)} /></label>
              {entryFormState.recordType === 'credit_card' ? (
                <label className="text-sm font-medium text-slate-700">Max Capacity<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white" type="number" step="0.01" value={entryFormState.maxCapacity} onChange={(event) => updateEntryFormFieldValue('maxCapacity', event.target.value)} /></label>
              ) : (
                <label className="text-sm font-medium text-slate-700">Category<select className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white" value={entryFormState.category} onChange={(event) => updateEntryFormFieldValue('category', event.target.value)}><option value="">Select a category</option>{COMMON_BUDGET_CATEGORIES.map((categoryName) => <option key={categoryName} value={categoryName}>{categoryName}</option>)}<option value="__custom__">Custom category...</option></select></label>
              )}
              {entryFormState.category === '__custom__' ? (
                <label className="text-sm font-medium text-slate-700 sm:col-span-2">Custom Category<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white" type="text" value={entryFormState.customCategory} onChange={(event) => updateEntryFormFieldValue('customCategory', event.target.value)} /></label>
              ) : null}
              {entryFormState.recordType === 'debt' || entryFormState.recordType === 'loan' || entryFormState.recordType === 'credit_card' ? (
                <label className="text-sm font-medium text-slate-700">Minimum Payment<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white" type="number" step="0.01" value={entryFormState.minimumPayment} onChange={(event) => updateEntryFormFieldValue('minimumPayment', event.target.value)} /></label>
              ) : null}
              {entryFormState.recordType === 'credit_card' ? (
                <label className="text-sm font-medium text-slate-700">Monthly Payment<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white" type="number" step="0.01" value={entryFormState.monthlyPayment} onChange={(event) => updateEntryFormFieldValue('monthlyPayment', event.target.value)} /></label>
              ) : null}
              {entryFormState.recordType === 'debt' || entryFormState.recordType === 'loan' || entryFormState.recordType === 'credit_card' ? (
                <label className="text-sm font-medium text-slate-700">APR (%)<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white" type="number" step="0.01" value={entryFormState.interestRatePercent} onChange={(event) => updateEntryFormFieldValue('interestRatePercent', event.target.value)} /></label>
              ) : null}
              {entryFormState.recordType === 'debt' || entryFormState.recordType === 'loan' ? (
                <label className="text-sm font-medium text-slate-700">Remaining Payments<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white" type="number" step="1" min="0" value={entryFormState.remainingPayments} onChange={(event) => updateEntryFormFieldValue('remainingPayments', event.target.value)} /></label>
              ) : null}
              {entryFormState.recordType === 'debt' || entryFormState.recordType === 'loan' ? (
                <label className="text-sm font-medium text-slate-700">Loan Start Date<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white" type="date" value={entryFormState.loanStartDate} onChange={(event) => updateEntryFormFieldValue('loanStartDate', event.target.value)} /></label>
              ) : null}
              {entryFormState.recordType === 'debt' || entryFormState.recordType === 'loan' ? (
                <label className="text-sm font-medium text-slate-700">Collateral Asset<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white" type="text" value={entryFormState.collateralAssetName} onChange={(event) => updateEntryFormFieldValue('collateralAssetName', event.target.value)} /></label>
              ) : null}
              {entryFormState.recordType === 'debt' || entryFormState.recordType === 'loan' ? (
                <label className="text-sm font-medium text-slate-700">Collateral Market Value<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white" type="number" step="0.01" min="0" value={entryFormState.collateralAssetMarketValue} onChange={(event) => updateEntryFormFieldValue('collateralAssetMarketValue', event.target.value)} /></label>
              ) : null}
              <label className="text-sm font-medium text-slate-700">Date<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white" type="date" value={entryFormState.date} onChange={(event) => updateEntryFormFieldValue('date', event.target.value)} /></label>
              <label className="text-sm font-medium text-slate-700 sm:col-span-2">Description<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white" type="text" value={entryFormState.description} onChange={(event) => updateEntryFormFieldValue('description', event.target.value)} /></label>
              <div className="sm:col-span-2 flex flex-wrap justify-end gap-2"><button className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700" onClick={() => setIsAddRecordModalOpen(false)} type="button">Cancel</button><button className="rounded-2xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700" type="submit">Save Record</button></div>
            </form>
          </div>
        </section>
      ) : null}

      {isAddGoalModalOpen ? (
        <section className="fixed inset-0 z-[5000] flex items-center justify-center p-3 sm:p-4" role="dialog" aria-modal="true" aria-label="Add Goal Modal">
          <button className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" onClick={() => setIsAddGoalModalOpen(false)} type="button" aria-label="Close add goal modal backdrop" />
          <div className="relative z-[5001] w-full max-w-2xl rounded-3xl border border-white/40 bg-white p-4 shadow-2xl sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3"><h3 className="text-lg font-bold text-slate-900">Add Goal</h3><button className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700" onClick={() => setIsAddGoalModalOpen(false)} type="button">Close</button></div>
            <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={submitNewGoalRecord}>
              <label className="text-sm font-medium text-slate-700 sm:col-span-2">Item<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white" type="text" value={goalEntryFormState.title} onChange={(event) => updateGoalEntryFormFieldValue('title', event.target.value)} /></label>
              <label className="text-sm font-medium text-slate-700">Status<select className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white" value={goalEntryFormState.status} onChange={(event) => updateGoalEntryFormFieldValue('status', event.target.value)}><option value="not started">Not started</option><option value="in progress">In progress</option><option value="completed">Completed</option></select></label>
              <label className="text-sm font-medium text-slate-700">Timeframe(months)<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white" type="number" min="0" step="1" value={goalEntryFormState.timeframeMonths} onChange={(event) => updateGoalEntryFormFieldValue('timeframeMonths', event.target.value)} /></label>
              <label className="text-sm font-medium text-slate-700 sm:col-span-2">Description<textarea className="mt-1 min-h-[90px] w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 py-2 text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white" value={goalEntryFormState.description} onChange={(event) => updateGoalEntryFormFieldValue('description', event.target.value)} /></label>
              <div className="sm:col-span-2 flex flex-wrap justify-end gap-2"><button className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700" onClick={() => setIsAddGoalModalOpen(false)} type="button">Cancel</button><button className="rounded-2xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700" type="submit">Save Goal</button></div>
            </form>
          </div>
        </section>
      ) : null}

      {isAddAssetModalOpen ? (
        <section className="fixed inset-0 z-[5000] flex items-center justify-center p-3 sm:p-4" role="dialog" aria-modal="true" aria-label="Add Asset Modal">
          <button className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" onClick={() => setIsAddAssetModalOpen(false)} type="button" aria-label="Close add asset modal backdrop" />
          <div className="relative z-[5001] w-full max-w-2xl rounded-3xl border border-white/40 bg-white p-4 shadow-2xl sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3"><h3 className="text-lg font-bold text-slate-900">Add Asset</h3><button className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700" onClick={() => setIsAddAssetModalOpen(false)} type="button">Close</button></div>
            <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={submitNewAssetHoldingRecord}>
              <label className="text-sm font-medium text-slate-700">Person<select className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white" value={assetHoldingEntryFormState.person} onChange={(event) => updateAssetHoldingEntryFormFieldValue('person', event.target.value)}>{personaSelectOptions.map((personaOption) => <option key={personaOption.value} value={personaOption.value}>{personaOption.label}</option>)}<option value="__custom__">Custom person...</option></select></label>
              {assetHoldingEntryFormState.person === '__custom__' ? <label className="text-sm font-medium text-slate-700">Custom Person<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white" type="text" value={assetHoldingEntryFormState.customPerson} onChange={(event) => updateAssetHoldingEntryFormFieldValue('customPerson', event.target.value)} /></label> : null}
              <label className="text-sm font-medium text-slate-700">Item<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white" type="text" value={assetHoldingEntryFormState.item} onChange={(event) => updateAssetHoldingEntryFormFieldValue('item', event.target.value)} /></label>
              <label className="text-sm font-medium text-slate-700">Asset Value Owed<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white" type="number" min="0" step="0.01" value={assetHoldingEntryFormState.assetValueOwed} onChange={(event) => updateAssetHoldingEntryFormFieldValue('assetValueOwed', event.target.value)} /></label>
              <label className="text-sm font-medium text-slate-700">Asset Market Value<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white" type="number" min="0" step="0.01" value={assetHoldingEntryFormState.assetMarketValue} onChange={(event) => updateAssetHoldingEntryFormFieldValue('assetMarketValue', event.target.value)} /></label>
              <label className="text-sm font-medium text-slate-700">Date<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white" type="date" value={assetHoldingEntryFormState.date} onChange={(event) => updateAssetHoldingEntryFormFieldValue('date', event.target.value)} /></label>
              <label className="text-sm font-medium text-slate-700 sm:col-span-2">Description<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white" type="text" value={assetHoldingEntryFormState.description} onChange={(event) => updateAssetHoldingEntryFormFieldValue('description', event.target.value)} /></label>
              <div className="sm:col-span-2 flex flex-wrap justify-end gap-2"><button className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700" onClick={() => setIsAddAssetModalOpen(false)} type="button">Cancel</button><button className="rounded-2xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700" type="submit">Save Asset</button></div>
            </form>
          </div>
        </section>
      ) : null}

      {isAddPersonaModalOpen ? (
        <section className="manage-personas-modal fixed inset-0 z-[5000] flex items-center justify-center p-3 sm:p-4" role="dialog" aria-modal="true" aria-label="Manage Personas Modal">
          <button className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" onClick={() => setIsAddPersonaModalOpen(false)} type="button" aria-label="Close manage personas modal backdrop" />
          <div className="manage-personas-shell relative z-[5001] w-full max-w-6xl rounded-3xl border border-white/40 bg-white p-4 shadow-2xl sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3"><h3 className="text-lg font-bold text-slate-900">Manage Personas</h3><button className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700" onClick={() => setIsAddPersonaModalOpen(false)} type="button">Close</button></div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
              <aside className="manage-personas-panel rounded-2xl border border-slate-200/90 bg-slate-50/80 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Existing Personas</p>
                <ul className="mt-3 space-y-2">
                  {personaOptions.map((personaName) => {
                    const isSelected = normalizePersonaNameForDisplay(personaCrudFormState.personaName).toLowerCase() === normalizePersonaNameForDisplay(personaName).toLowerCase()
                    return (
                      <li key={personaName}>
                        <button className={`manage-persona-row w-full rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${isSelected ? 'border-violet-300 bg-violet-50 text-violet-800' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`} type="button" onClick={() => selectPersonaForCrudByName(personaName)}>{formatPersonaLabelWithEmoji(personaName, personaEmojiByName)}</button>
                      </li>
                    )
                  })}
                </ul>
                {personaDangerBackupState ? (
                  <div className="manage-personas-warning mt-3 rounded-xl border border-amber-300/80 bg-amber-50/80 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">Backup Available</p>
                    <p className="mt-1 text-xs text-amber-800">Destructive change backup from {personaDangerBackupState.at}.</p>
                    <button className="mt-2 rounded-lg border border-amber-400 bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-800" type="button" onClick={() => void restorePersonaDangerBackupIntoCollections()}>Restore Backup</button>
                  </div>
                ) : null}
              </aside>

              <div className="space-y-4">
                <form className="manage-personas-panel rounded-2xl border border-slate-200/90 bg-slate-50/70 p-4" onSubmit={submitNewPersonaRecord}>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Create Persona</p>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="text-sm font-medium text-slate-700">Name<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-white px-3 text-slate-900 outline-none transition focus:border-violet-400" type="text" value={personaEntryFormState.name} onChange={(event) => updatePersonaEntryFormFieldValue('name', event.target.value)} /></label>
                    <label className="text-sm font-medium text-slate-700">Emoji Preset<select className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-white px-3 text-xl text-slate-900 outline-none transition focus:border-violet-400" value={personaEntryFormState.emojiPreset} onChange={(event) => updatePersonaEntryFormFieldValue('emojiPreset', event.target.value)}>{PERSONA_EMOJI_OPTIONS.map((emojiOption) => <option key={emojiOption} value={emojiOption}>{emojiOption}</option>)}</select></label>
                    <label className="text-sm font-medium text-slate-700">Custom Emoji (Optional)<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-white px-3 text-2xl text-slate-900 outline-none transition focus:border-violet-400" type="text" maxLength="4" value={personaEntryFormState.customEmoji} onChange={(event) => updatePersonaEntryFormFieldValue('customEmoji', event.target.value)} /></label>
                    <label className="text-sm font-medium text-slate-700">Note (Optional)<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-white px-3 text-slate-900 outline-none transition focus:border-violet-400" type="text" value={personaEntryFormState.note} onChange={(event) => updatePersonaEntryFormFieldValue('note', event.target.value)} /></label>
                  </div>
                  <div className="mt-3 flex justify-end gap-2"><button className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700" type="button" onClick={() => setPersonaEntryFormState(buildInitialPersonaEntryFormState())}>Clear</button><button className="rounded-2xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700" type="submit">Create Persona</button></div>
                </form>

                {personaCrudFormState.personaName ? (
                  <form className="manage-personas-panel rounded-2xl border border-slate-200/90 bg-white/80 p-4" onSubmit={submitPersonaCrudOperation}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Edit / Delete Persona</p>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{formatPersonaLabelWithEmoji(personaCrudFormState.personaName, personaEmojiByName)}</span>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="text-sm font-medium text-slate-700">Mode<select className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-white px-3 text-slate-900 outline-none transition focus:border-violet-400" value={personaCrudFormState.mode} onChange={(event) => updatePersonaCrudFormFieldValue('mode', event.target.value)}><option value="edit">Edit</option><option value="delete_reassign">Delete + Reassign</option><option value="delete_cascade">Delete Cascade</option></select></label>
                      {selectedPersonaImpactSummary ? <div className="rounded-2xl border border-slate-200/90 bg-slate-50 px-3 py-2 text-xs text-slate-600"><p className="font-semibold text-slate-700">Impacted records</p><p className="mt-1">Total: {Math.round(typeof selectedPersonaImpactSummary.total === 'number' ? selectedPersonaImpactSummary.total : 0)}</p></div> : <div />}
                      {personaCrudFormState.mode === 'edit' ? <label className="text-sm font-medium text-slate-700">Name<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-white px-3 text-slate-900 outline-none transition focus:border-violet-400" type="text" value={personaCrudFormState.nextName} onChange={(event) => updatePersonaCrudFormFieldValue('nextName', event.target.value)} /></label> : null}
                      {personaCrudFormState.mode === 'edit' ? <label className="text-sm font-medium text-slate-700">Emoji Preset<select className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-white px-3 text-xl text-slate-900 outline-none transition focus:border-violet-400" value={personaCrudFormState.nextEmojiPreset} onChange={(event) => updatePersonaCrudFormFieldValue('nextEmojiPreset', event.target.value)}>{PERSONA_EMOJI_OPTIONS.map((emojiOption) => <option key={emojiOption} value={emojiOption}>{emojiOption}</option>)}</select></label> : null}
                      {personaCrudFormState.mode === 'edit' ? <label className="text-sm font-medium text-slate-700">Custom Emoji<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-white px-3 text-2xl text-slate-900 outline-none transition focus:border-violet-400" type="text" maxLength="4" value={personaCrudFormState.nextCustomEmoji} onChange={(event) => updatePersonaCrudFormFieldValue('nextCustomEmoji', event.target.value)} /></label> : null}
                      {personaCrudFormState.mode === 'edit' ? <label className="text-sm font-medium text-slate-700">Note<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-white px-3 text-slate-900 outline-none transition focus:border-violet-400" type="text" value={personaCrudFormState.nextNote} onChange={(event) => updatePersonaCrudFormFieldValue('nextNote', event.target.value)} /></label> : null}
                      {personaCrudFormState.mode === 'delete_reassign' ? <label className="text-sm font-medium text-slate-700 sm:col-span-2">Reassign all records to<select className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-white px-3 text-slate-900 outline-none transition focus:border-violet-400" value={personaCrudFormState.reassignToPersonaName} onChange={(event) => updatePersonaCrudFormFieldValue('reassignToPersonaName', event.target.value)}>{reassignablePersonaOptions.map((personaName) => <option key={personaName} value={personaName}>{formatPersonaLabelWithEmoji(personaName, personaEmojiByName)}</option>)}</select></label> : null}
                      {personaCrudFormState.mode === 'delete_reassign' && reassignablePersonaOptions.length === 0 ? <div className="sm:col-span-2 rounded-xl border border-amber-300 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">No alternate persona exists to reassign records. To delete the default user profile, switch to <span className="font-semibold">Delete Cascade</span>.<button className="ml-2 rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700" type="button" onClick={() => updatePersonaCrudFormFieldValue('mode', 'delete_cascade')}>Switch to Cascade</button></div> : null}
                      {personaCrudFormState.mode === 'delete_cascade' ? <label className="text-sm font-medium text-rose-700 sm:col-span-2">Type to confirm hard delete<input className="mt-1 h-11 w-full rounded-2xl border border-rose-300 bg-rose-50/70 px-3 text-slate-900 outline-none transition focus:border-rose-500" type="text" placeholder={`DELETE ${personaCrudFormState.personaName}`} value={personaCrudFormState.deleteConfirmText} onChange={(event) => updatePersonaCrudFormFieldValue('deleteConfirmText', event.target.value)} /></label> : null}
                    </div>
                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      <button className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700" type="button" onClick={() => setPersonaCrudFormState(buildInitialPersonaCrudFormState())}>Clear Selection</button>
                      <button className={`rounded-2xl px-4 py-2 text-sm font-semibold text-white transition ${personaCrudFormState.mode === 'edit' ? 'bg-violet-600 hover:bg-violet-700' : 'bg-rose-600 hover:bg-rose-700'}`} type="submit">{personaCrudFormState.mode === 'edit' ? 'Save Persona' : 'Apply Delete Operation'}</button>
                    </div>
                  </form>
                ) : (
                  <div className="manage-personas-panel rounded-2xl border border-slate-200/90 bg-white/80 p-4 text-sm text-slate-600">Select a persona from the left list to edit or delete with safety controls.</div>
                )}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {isProfileTransferModalOpen ? (
        <section className="profile-transfer-modal fixed inset-0 z-[5000] flex items-center justify-center p-3 sm:p-4" role="dialog" aria-modal="true" aria-label="Financial Profile Import Export Modal">
          <button className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" onClick={() => setIsProfileTransferModalOpen(false)} type="button" aria-label="Close profile transfer modal backdrop" />
          <div className="profile-transfer-shell relative z-[5001] w-full max-w-3xl rounded-3xl border border-white/40 bg-white p-4 shadow-2xl sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-slate-900">{profileTransferFormState.mode === 'import' ? 'Import Financial Profile JSON' : 'Export Financial Profile JSON'}</h3>
              <button className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700" onClick={() => setIsProfileTransferModalOpen(false)} type="button">Close</button>
            </div>
            <div className="mb-3 rounded-2xl border border-slate-200/90 bg-slate-50/80 p-3">
              <React.Fragment>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Supabase Sync</p>
                <p className="mt-2 text-xs text-slate-600">Email OTP code sign-in + JSON profile sync using Supabase tables.</p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="text-xs font-medium text-slate-700">Enabled
                    <select className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400" value={supabaseSyncFormState.enabled ? 'true' : 'false'} onChange={(event) => updateSupabaseSyncFormFieldValue('enabled', event.target.value === 'true')}>
                      <option value="false">Disabled</option>
                      <option value="true">Enabled</option>
                    </select>
                  </label>
                  <label className="text-xs font-medium text-slate-700">Supabase URL
                    <input className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400" type="text" value={supabaseSyncFormState.supabaseUrl} onChange={(event) => updateSupabaseSyncFormFieldValue('supabaseUrl', event.target.value)} />
                  </label>
                  <label className="text-xs font-medium text-slate-700 sm:col-span-2">Supabase Anon Key
                    <input className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400" type="text" value={supabaseSyncFormState.supabaseAnonKey} onChange={(event) => updateSupabaseSyncFormFieldValue('supabaseAnonKey', event.target.value)} />
                  </label>
                  <label className="text-xs font-medium text-slate-700 sm:col-span-2">Auth Email
                    <input className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400" type="email" value={supabaseSyncFormState.email || ''} onChange={(event) => updateSupabaseSyncFormFieldValue('email', event.target.value)} />
                  </label>
                  <label className="text-xs font-medium text-slate-700 sm:col-span-2">OTP Code
                    <input className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400" type="text" value={supabaseSyncFormState.otpCode || ''} onChange={(event) => updateSupabaseSyncFormFieldValue('otpCode', event.target.value)} />
                  </label>
                </div>
                <div className="mt-2 flex flex-wrap justify-end gap-2">
                  <button className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40" disabled={isSupabaseOperationInFlight} onClick={() => { void saveSupabaseWebConfigIntoCache() }} type="button">Save Supabase Config</button>
                  <button className="rounded-xl border border-violet-300 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 disabled:cursor-not-allowed disabled:opacity-40" disabled={isSupabaseOperationInFlight} onClick={() => { void startSupabaseEmailOtpSignInFromModal() }} type="button">Send Code</button>
                  <button className="rounded-xl border border-indigo-300 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 disabled:cursor-not-allowed disabled:opacity-40" disabled={isSupabaseOperationInFlight} onClick={() => { void verifySupabaseEmailOtpCodeFromModal() }} type="button">Verify Code</button>
                  <button className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40" disabled={isSupabaseOperationInFlight} onClick={() => { void refreshSupabaseAuthUserSummaryFromSession() }} type="button">Refresh Session</button>
                  <button className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-40" disabled={!supabaseAuthUserSummary || isSupabaseOperationInFlight} onClick={() => { void signOutFromSupabaseSessionFromModal() }} type="button">Sign Out</button>
                  <button className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40" disabled={!supabaseAuthUserSummary || isSupabaseOperationInFlight} onClick={() => { void pushCurrentProfileSnapshotToSupabase() }} type="button">Push Supabase</button>
                  <button className="rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 disabled:cursor-not-allowed disabled:opacity-40" disabled={!supabaseAuthUserSummary || isSupabaseOperationInFlight} onClick={() => { void pullProfileSnapshotFromSupabase() }} type="button">Pull Supabase</button>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">Auth: {supabaseAuthUserSummary ? `${supabaseAuthUserSummary.email || supabaseAuthUserSummary.id}` : 'Not signed in'}.</p>
                {supabaseSyncFormState.otpPendingEmail ? <p className="mt-1 text-[11px] text-slate-500">Pending OTP email: {supabaseSyncFormState.otpPendingEmail}{supabaseSyncFormState.otpRequestedAtIso ? ` (${new Date(supabaseSyncFormState.otpRequestedAtIso).toLocaleString()})` : ''}</p> : null}
                <p className={`mt-1 text-[11px] ${supabaseSyncStatusState.tone === 'success' ? 'text-emerald-600' : (supabaseSyncStatusState.tone === 'warning' ? 'text-amber-700' : 'text-slate-500')}`}>Status: {supabaseSyncStatusState.message}</p>
                {isSupabaseOperationInFlight ? <p className="mt-1 text-[11px] font-semibold text-indigo-600">Sync in progress...</p> : null}
                {supabaseSyncStatusState.detail ? <p className="mt-1 text-[11px] text-slate-500">{supabaseSyncStatusState.detail}</p> : null}
                <p className="mt-1 text-[11px] text-slate-500">Expected tables: <code>profile_current</code> and <code>profile_history</code> with RLS keyed by <code>user_id</code>.</p>
                <p className="mt-1 text-[11px] text-slate-500">Full guide: <code>project-docs/supabase-setup.md</code></p>
                <div className="mt-2 rounded-xl border border-slate-200/90 bg-slate-100/90 p-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">OTP vs Magic Link Note</p>
                  <p className="mt-1 text-[11px] text-slate-600">Supabase email OTP is not a separate mode from magic links. Both use <code>signInWithOtp()</code>; the email template content decides link vs 6-digit code.</p>
                  <p className="mt-1 text-[11px] text-slate-600">If template contains <code>{'{{ .ConfirmationURL }}'}</code>, email sends a magic link. If template contains <code>{'{{ .Token }}'}</code>, email sends an OTP code.</p>
                  <p className="mt-1 text-[11px] text-slate-600">Dashboard path: <code>Auth &gt; Email Templates &gt; Magic Link</code>. Use <code>{'{{ .Token }}'}</code> and do not use <code>{'{{ .ConfirmationURL }}'}</code> for code-based login.</p>
                  <pre className="mt-2 overflow-auto rounded-lg bg-slate-900/95 p-2 text-[10px] text-slate-100">{`<p>Your login code is: <strong>{{ .Token }}</strong></p>
<p>This code expires soon. If you didnt request it, ignore this email.</p>`}</pre>
                </div>
                <div className="mt-2 rounded-xl border border-slate-200/90 bg-slate-100/90 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Provisioning SQL</p>
                    <button className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700" onClick={() => { void copySupabaseProvisioningSqlToClipboard() }} type="button">Copy SQL</button>
                  </div>
                  <pre className="mt-2 max-h-32 overflow-auto rounded-lg bg-slate-900/95 p-2 text-[10px] text-slate-100">{SUPABASE_PROVISIONING_SQL_SCRIPT}</pre>
                </div>
              </React.Fragment>
            </div>
            <form className="grid grid-cols-1 gap-3" onSubmit={submitImportedProfileJson}>
              <textarea className="min-h-[280px] w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 p-3 font-mono text-xs text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white" value={profileTransferFormState.jsonText} onChange={(event) => updateProfileTransferFormFieldValue('jsonText', event.target.value)} readOnly={profileTransferFormState.mode === 'export'} />
              <div className="flex flex-wrap justify-end gap-2">
                <button className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700" onClick={() => setIsProfileTransferModalOpen(false)} type="button">Cancel</button>
                <button className="rounded-2xl border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700" onClick={() => { void copyProfileTransferJsonTextToClipboard() }} type="button">Copy JSON</button>
                {profileTransferFormState.mode === 'export' ? (
                  <button className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700" onClick={() => { void deleteAllLocalFinancialProfileDataWithUndoSnapshot() }} type="button">Delete Local Data</button>
                ) : null}
                {profileTransferFormState.mode === 'export' && profileDeleteUndoSnapshotJsonText ? (
                  <button className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700" onClick={() => { void restoreDeletedLocalFinancialProfileDataFromUndoSnapshot() }} type="button">Undo Delete</button>
                ) : null}
                {profileTransferFormState.mode === 'import' ? (
                  <button className="rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700" type="submit">Import Profile</button>
                ) : null}
              </div>
            </form>
          </div>
        </section>
      ) : null}

      {selectedRiskFinding && selectedRiskTemplate ? (
        <section className="fixed inset-0 z-[5000] flex items-center justify-center p-3 sm:p-4" role="dialog" aria-modal="true" aria-label="Risk Flag Detail Modal">
          <button className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" onClick={() => setSelectedRiskFinding(null)} type="button" aria-label="Close risk detail modal backdrop" />
          <div className="relative z-[5001] w-full max-w-2xl rounded-3xl border border-white/40 bg-white p-4 shadow-2xl sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-slate-900">Risk Flag Guidance</h3>
              <button className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700" onClick={() => setSelectedRiskFinding(null)} type="button">Close</button>
            </div>
            <div className="space-y-4">
              <article className={`risk-modal-selected rounded-2xl border p-3 ${
                selectedRiskFinding.severity === 'high'
                  ? 'border-rose-200/90 bg-rose-50/90'
                  : (selectedRiskFinding.severity === 'low' ? 'border-emerald-200/90 bg-emerald-50/90' : 'border-amber-200/90 bg-amber-50/90')
              }`}>
                <p className={`risk-flag-severity text-xs font-semibold uppercase tracking-[0.12em] ${
                  selectedRiskFinding.severity === 'high'
                    ? 'risk-flag-severity-high'
                    : (selectedRiskFinding.severity === 'low' ? 'risk-flag-severity-low' : 'risk-flag-severity-medium')
                }`}>Selected Risk</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{selectedRiskTemplate.title}</p>
              </article>
              <article className="risk-modal-panel rounded-2xl border border-slate-200/90 bg-slate-50/90 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">What it means</p>
                <p className="mt-1 text-sm text-slate-700">{selectedRiskTemplate.meaningText}</p>
              </article>
              <article className="risk-modal-panel rounded-2xl border border-slate-200/90 bg-slate-50/90 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">How it affects personas</p>
                <p className="mt-1 text-sm text-slate-700">{selectedRiskTemplate.impactText}</p>
              </article>
              <article className="risk-modal-panel rounded-2xl border border-slate-200/90 bg-slate-50/90 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">How to fix it</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {selectedRiskTemplate.fixChecklist.map((fixItem) => <li key={fixItem}>{fixItem}</li>)}
                </ul>
              </article>
            </div>
          </div>
        </section>
      ) : null}

      {isRecordNotesModalOpen ? (
        <section className="fixed inset-0 z-[5000] flex items-center justify-center p-3 sm:p-4" role="dialog" aria-modal="true" aria-label="Record Notes Modal">
          <button className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" onClick={() => setIsRecordNotesModalOpen(false)} type="button" aria-label="Close record notes modal backdrop" />
          <div className="relative z-[5001] w-full max-w-xl rounded-3xl border border-white/40 bg-white p-4 shadow-2xl sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-slate-900">Record Notes</h3>
              <button className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700" onClick={() => setIsRecordNotesModalOpen(false)} type="button">Close</button>
            </div>
            <form className="space-y-4" onSubmit={submitRecordNotesFormChanges}>
              <p className="text-sm text-slate-600">Category: <span className="font-semibold text-slate-800">{recordNotesFormState.recordLabel || 'Record'}</span></p>
              <label className="block text-sm font-medium text-slate-700">
                Notes
                <textarea
                  className="mt-1 min-h-[120px] w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 py-2 text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white"
                  value={recordNotesFormState.notes}
                  onChange={(event) => setRecordNotesFormState((previousFormState) => ({ ...previousFormState, notes: event.target.value }))}
                />
              </label>
              <div className="flex justify-end gap-2">
                <button className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700" onClick={() => setIsRecordNotesModalOpen(false)} type="button">Cancel</button>
                <button className="rounded-2xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700" type="submit">Save Notes</button>
              </div>
            </form>
          </div>
        </section>
      ) : null}

      {isEditRecordModalOpen ? (
        <section className="fixed inset-0 z-[5000] flex items-center justify-center p-3 sm:p-4" role="dialog" aria-modal="true" aria-label="Edit Record Modal">
          <button className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" onClick={() => setIsEditRecordModalOpen(false)} type="button" aria-label="Close edit record modal backdrop" />
          <div className="relative z-[5001] w-full max-w-2xl rounded-3xl border border-white/40 bg-white p-4 shadow-2xl sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3"><h3 className="text-lg font-bold text-slate-900">Edit Record</h3><button className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700" onClick={() => setIsEditRecordModalOpen(false)} type="button">Close</button></div>
            <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={submitEditedRecordChanges}>
              <label className="text-sm font-medium text-slate-700">Person<select className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white" value={editRecordFormState.person} onChange={(event) => updateEditRecordFormFieldValue('person', event.target.value)}>{personaSelectOptions.map((personaOption) => <option key={personaOption.value} value={personaOption.value}>{personaOption.label}</option>)}<option value="__custom__">Custom person...</option></select></label>
              {editRecordFormState.person === '__custom__' ? (
                <label className="text-sm font-medium text-slate-700">Custom Person<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white" type="text" value={editRecordFormState.customPerson} onChange={(event) => updateEditRecordFormFieldValue('customPerson', event.target.value)} /></label>
              ) : null}
              {editRecordFormState.collectionName === 'creditCards' || editRecordFormState.collectionName === 'assetHoldings' ? (
                <label className="text-sm font-medium text-slate-700">Item<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white" type="text" value={editRecordFormState.item} onChange={(event) => updateEditRecordFormFieldValue('item', event.target.value)} /></label>
              ) : null}
              {editRecordFormState.collectionName === 'debts' || editRecordFormState.collectionName === 'credit' || editRecordFormState.collectionName === 'loans' ? (
                <label className="text-sm font-medium text-slate-700">Category<select className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white" value={editRecordFormState.category} onChange={(event) => updateEditRecordFormFieldValue('category', event.target.value)}><option value="">Select a category</option>{COMMON_BUDGET_CATEGORIES.map((categoryName) => <option key={categoryName} value={categoryName}>{categoryName}</option>)}<option value="__custom__">Custom category...</option></select></label>
              ) : null}
              {(editRecordFormState.collectionName === 'debts' || editRecordFormState.collectionName === 'credit' || editRecordFormState.collectionName === 'loans') && editRecordFormState.category === '__custom__' ? (
                <label className="text-sm font-medium text-slate-700">Custom Category<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white" type="text" value={editRecordFormState.customCategory} onChange={(event) => updateEditRecordFormFieldValue('customCategory', event.target.value)} /></label>
              ) : null}
              {editRecordFormState.collectionName === 'income' || editRecordFormState.collectionName === 'expenses' || editRecordFormState.collectionName === 'assets' ? (
                <label className="text-sm font-medium text-slate-700">Category<select className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white" value={editRecordFormState.category} onChange={(event) => updateEditRecordFormFieldValue('category', event.target.value)}><option value="">Select a category</option>{COMMON_BUDGET_CATEGORIES.map((categoryName) => <option key={categoryName} value={categoryName}>{categoryName}</option>)}<option value="__custom__">Custom category...</option></select></label>
              ) : null}
              {(editRecordFormState.collectionName === 'income' || editRecordFormState.collectionName === 'expenses' || editRecordFormState.collectionName === 'assets') && editRecordFormState.category === '__custom__' ? (
                <label className="text-sm font-medium text-slate-700">Custom Category<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white" type="text" value={editRecordFormState.customCategory} onChange={(event) => updateEditRecordFormFieldValue('customCategory', event.target.value)} /></label>
              ) : null}
              {editRecordFormState.collectionName === 'income' || editRecordFormState.collectionName === 'expenses' || editRecordFormState.collectionName === 'assets' ? (
                <label className="text-sm font-medium text-slate-700">Item<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white" type="text" value={editRecordFormState.item} onChange={(event) => updateEditRecordFormFieldValue('item', event.target.value)} /></label>
              ) : null}
              {editRecordFormState.collectionName !== 'assetHoldings' ? (
                <label className="text-sm font-medium text-slate-700">Amount / Value<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white" type="number" step="0.01" value={editRecordFormState.amount} onChange={(event) => updateEditRecordFormFieldValue('amount', event.target.value)} /></label>
              ) : null}
              {editRecordFormState.collectionName === 'assetHoldings' ? (
                <label className="text-sm font-medium text-slate-700">Asset Value Owed<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white" type="number" min="0" step="0.01" value={editRecordFormState.assetValueOwed} onChange={(event) => updateEditRecordFormFieldValue('assetValueOwed', event.target.value)} /></label>
              ) : null}
              {editRecordFormState.collectionName === 'assetHoldings' ? (
                <label className="text-sm font-medium text-slate-700">Asset Market Value<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white" type="number" min="0" step="0.01" value={editRecordFormState.assetMarketValue} onChange={(event) => updateEditRecordFormFieldValue('assetMarketValue', event.target.value)} /></label>
              ) : null}
              {editRecordFormState.collectionName === 'debts' || editRecordFormState.collectionName === 'credit' || editRecordFormState.collectionName === 'loans' ? (
                <label className="text-sm font-medium text-slate-700">Minimum Payment<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white" type="number" step="0.01" value={editRecordFormState.minimumPayment} onChange={(event) => updateEditRecordFormFieldValue('minimumPayment', event.target.value)} /></label>
              ) : null}
              {editRecordFormState.collectionName === 'debts' || editRecordFormState.collectionName === 'credit' || editRecordFormState.collectionName === 'loans' ? (
                <label className="text-sm font-medium text-slate-700">Loan Start Date<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white" type="date" value={editRecordFormState.loanStartDate} onChange={(event) => updateEditRecordFormFieldValue('loanStartDate', event.target.value)} /></label>
              ) : null}
              {editRecordFormState.collectionName === 'debts' || editRecordFormState.collectionName === 'credit' || editRecordFormState.collectionName === 'loans' ? (
                <label className="text-sm font-medium text-slate-700">Remaining Payments<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white" type="number" min="0" step="1" value={editRecordFormState.remainingPayments} onChange={(event) => updateEditRecordFormFieldValue('remainingPayments', event.target.value)} /></label>
              ) : null}
              {editRecordFormState.collectionName === 'debts' || editRecordFormState.collectionName === 'loans' ? (
                <label className="text-sm font-medium text-slate-700">Collateral Asset<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white" type="text" value={editRecordFormState.collateralAssetName} onChange={(event) => updateEditRecordFormFieldValue('collateralAssetName', event.target.value)} /></label>
              ) : null}
              {editRecordFormState.collectionName === 'debts' || editRecordFormState.collectionName === 'loans' ? (
                <label className="text-sm font-medium text-slate-700">Collateral Market Value<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white" type="number" min="0" step="0.01" value={editRecordFormState.collateralAssetMarketValue} onChange={(event) => updateEditRecordFormFieldValue('collateralAssetMarketValue', event.target.value)} /></label>
              ) : null}
              {editRecordFormState.collectionName === 'debts' || editRecordFormState.collectionName === 'credit' || editRecordFormState.collectionName === 'loans' || editRecordFormState.collectionName === 'creditCards' ? (
                <label className="text-sm font-medium text-slate-700">Interest Rate (%)<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white" type="number" min="0" step="0.01" value={editRecordFormState.interestRatePercent} onChange={(event) => updateEditRecordFormFieldValue('interestRatePercent', event.target.value)} /></label>
              ) : null}
              {editRecordFormState.collectionName === 'credit' ? (
                <label className="text-sm font-medium text-slate-700">Credit Limit<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white" type="number" step="0.01" value={editRecordFormState.creditLimit} onChange={(event) => updateEditRecordFormFieldValue('creditLimit', event.target.value)} /></label>
              ) : null}
              {editRecordFormState.collectionName === 'creditCards' ? (
                <>
                  <label className="text-sm font-medium text-slate-700">Max Capacity<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white" type="number" step="0.01" value={editRecordFormState.maxCapacity} onChange={(event) => updateEditRecordFormFieldValue('maxCapacity', event.target.value)} /></label>
                  <label className="text-sm font-medium text-slate-700">Current Balance<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white" type="number" step="0.01" value={editRecordFormState.currentBalance} onChange={(event) => updateEditRecordFormFieldValue('currentBalance', event.target.value)} /></label>
                  <label className="text-sm font-medium text-slate-700">Minimum Payment<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white" type="number" step="0.01" value={editRecordFormState.minimumPayment} onChange={(event) => updateEditRecordFormFieldValue('minimumPayment', event.target.value)} /></label>
                  <label className="text-sm font-medium text-slate-700">Monthly Payment<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white" type="number" step="0.01" value={editRecordFormState.monthlyPayment} onChange={(event) => updateEditRecordFormFieldValue('monthlyPayment', event.target.value)} /></label>
                </>
              ) : null}
              <label className="text-sm font-medium text-slate-700">Date<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white" type="date" value={editRecordFormState.date} onChange={(event) => updateEditRecordFormFieldValue('date', event.target.value)} /></label>
              <label className="text-sm font-medium text-slate-700 sm:col-span-2">Description<input className="mt-1 h-11 w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white" type="text" value={editRecordFormState.description} onChange={(event) => updateEditRecordFormFieldValue('description', event.target.value)} /></label>
              <div className="sm:col-span-2 flex flex-wrap justify-end gap-2"><button className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700" onClick={() => setIsEditRecordModalOpen(false)} type="button">Cancel</button>{editRecordFormState.collectionName === 'assetHoldings' ? <button className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700" onClick={() => { void deleteRecordFromCollectionByCollectionNameAndId('assetHoldings', editRecordFormState.recordId); setIsEditRecordModalOpen(false) }} type="button"><span aria-hidden="true" className="mr-1">{renderIconGlyphForAction('delete')}</span>Delete Asset</button> : null}<button className="rounded-2xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700" type="submit">Save Changes</button></div>
            </form>
          </div>
        </section>
      ) : null}
    </main>
  )
}







