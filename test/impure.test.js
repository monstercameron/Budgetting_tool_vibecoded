import test from 'node:test'
import assert from 'node:assert/strict'

import {
  safelyParseJsonTextIntoObjectUsingPromiseBoundary,
  safelyStringifyObjectIntoJsonTextUsingPromiseBoundary,
  safelyWriteJsonSnapshotToBrowserLocalStorageByKey,
  safelyReadJsonSnapshotFromBrowserLocalStorageByKey,
  persistBudgetCollectionsStateIntoLocalStorageCache,
  loadBudgetCollectionsStateFromLocalStorageCache,
  readCurrentIsoTimestampForBudgetRecordUpdates,
  persistUiPreferencesIntoLocalStorageCache,
  loadUiPreferencesFromLocalStorageCache,
  persistAuditTimelineIntoLocalStorageCache,
  loadAuditTimelineFromLocalStorageCache,
  applyThemeNameToDocumentBodyDataAttribute,
  scrollViewportToTopWithSmoothBehavior,
  copyTextToClipboardUsingBrowserApi,
  computeFinancialRiskFindingsUsingBackgroundWorkerWhenAvailable,
  exportBudgetCollectionsStateAsJsonTextSnapshot,
  importBudgetCollectionsStateFromJsonTextSnapshot,
  exportCompleteFinancialProfileAsJsonTextSnapshot,
  importCompleteFinancialProfileFromJsonTextSnapshot,
  loadGoogleSheetsSyncSettingsFromLocalStorageCache,
  persistGoogleSheetsSyncSettingsIntoLocalStorageCache,
  openGoogleSheetsOAuthPopupUsingImplicitFlow,
  readGoogleOAuthAccessTokenFromCurrentUrlHash,
  importFinancialProfileFromGoogleSheetsUsingTupleResultPlaceholder,
  exportFinancialProfileToGoogleSheetsUsingTupleResultPlaceholder,
  loadFirebaseWebConfigFromLocalStorageCache,
  persistFirebaseWebConfigIntoLocalStorageCache,
  initializeFirebaseClientsFromWebConfig
} from '../src/core/impure.js'

/**
 * Creates an in-memory localStorage mock for impure wrapper testing.
 * @returns {[Storage, null] | [null, Error]}
 */
function createInMemoryLocalStorageMockForTupleBasedTestHarness() {
  const internalMap = new Map()
  const storageMock = {
    /** @param {string} key */
    getItem(key) {
      if (!internalMap.has(key)) return null
      return internalMap.get(key)
    },
    /** @param {string} key @param {string} value */
    setItem(key, value) {
      internalMap.set(key, String(value))
    },
    /** @param {string} key */
    removeItem(key) {
      internalMap.delete(key)
    },
    clear() {
      internalMap.clear()
    },
    /** @param {number} index */
    key(index) {
      return Array.from(internalMap.keys())[index] ?? null
    },
    get length() {
      return internalMap.size
    }
  }
  return [/** @type {Storage} */ (storageMock), null]
}

test('safelyParseJsonTextIntoObjectUsingPromiseBoundary parses valid json', async () => {
  const [parsedValue, parseError] = await safelyParseJsonTextIntoObjectUsingPromiseBoundary('{"amount":100}')
  assert.equal(parseError, null)
  if (!parsedValue || Array.isArray(parsedValue)) assert.fail('expected object json payload')
  assert.equal(parsedValue.amount, 100)
})

test('safelyParseJsonTextIntoObjectUsingPromiseBoundary returns tuple error for invalid json', async () => {
  const [parsedValue, parseError] = await safelyParseJsonTextIntoObjectUsingPromiseBoundary('{bad json}')
  assert.equal(parsedValue, null)
  assert.ok(parseError)
  assert.equal(parseError.kind, 'JSON_PARSE')
})

test('safelyStringifyObjectIntoJsonTextUsingPromiseBoundary returns tuple error for circular object', async () => {
  const circularObject = /** @type {Record<string, unknown>} */ ({ name: 'circular' })
  circularObject.self = circularObject

  const [jsonTextValue, stringifyError] = await safelyStringifyObjectIntoJsonTextUsingPromiseBoundary(circularObject)
  assert.equal(jsonTextValue, null)
  assert.ok(stringifyError)
  assert.equal(stringifyError.kind, 'JSON_STRINGIFY')
})

test('local storage wrappers write and read values with tuple checks', async () => {
  const [localStorageMock, localStorageMockError] = createInMemoryLocalStorageMockForTupleBasedTestHarness()
  assert.equal(localStorageMockError, null)

  const previousLocalStorageValue = globalThis.localStorage
  globalThis.localStorage = localStorageMock

  const [writeResult, writeError] = await safelyWriteJsonSnapshotToBrowserLocalStorageByKey('snapshot', {
    amount: 450,
    tags: ['needs']
  })
  assert.equal(writeError, null)
  assert.equal(writeResult, true)

  const [snapshotValue, readError] = await safelyReadJsonSnapshotFromBrowserLocalStorageByKey('snapshot')
  assert.equal(readError, null)
  if (!snapshotValue || Array.isArray(snapshotValue)) assert.fail('expected snapshotValue object')
  assert.equal(snapshotValue.amount, 450)

  globalThis.localStorage = previousLocalStorageValue
})

test('persistBudgetCollectionsStateIntoLocalStorageCache and loadBudgetCollectionsStateFromLocalStorageCache roundtrip', async () => {
  const [localStorageMock, localStorageMockError] = createInMemoryLocalStorageMockForTupleBasedTestHarness()
  assert.equal(localStorageMockError, null)

  const previousLocalStorageValue = globalThis.localStorage
  globalThis.localStorage = localStorageMock

  const [persistSuccess, persistError] = await persistBudgetCollectionsStateIntoLocalStorageCache({
    income: [{ amount: 2000, category: 'Salary', date: '2026-02-10' }],
    expenses: [{ amount: 500, category: 'Food', date: '2026-02-11' }],
    assets: [],
    debts: [],
    credit: [],
    loans: [],
    goals: [],
    notes: [],
    schemaVersion: 1
  })

  assert.equal(persistError, null)
  assert.equal(persistSuccess, true)

  const [loadedState, loadError] = await loadBudgetCollectionsStateFromLocalStorageCache()
  assert.equal(loadError, null)
  if (!loadedState) assert.fail('expected loadedState to be present')
  assert.ok(Array.isArray(loadedState.income))
  assert.ok(Array.isArray(loadedState.expenses))

  globalThis.localStorage = previousLocalStorageValue
})

test('persistBudgetCollectionsStateIntoLocalStorageCache returns validation error for malformed state', async () => {
  const [persistSuccess, persistError] = await persistBudgetCollectionsStateIntoLocalStorageCache(
    /** @type {Record<string, unknown>} */ ({ invalid: true })
  )
  assert.equal(persistSuccess, null)
  assert.ok(persistError)
  assert.equal(persistError.kind, 'VALIDATION')
})

test('readCurrentIsoTimestampForBudgetRecordUpdates returns iso string', () => {
  const [isoTimestamp, timestampError] = readCurrentIsoTimestampForBudgetRecordUpdates()
  assert.equal(timestampError, null)
  assert.ok(isoTimestamp)
  if (!isoTimestamp) assert.fail('expected isoTimestamp to be present')
  assert.ok(isoTimestamp.includes('T'))
})

test('persistUiPreferencesIntoLocalStorageCache and loadUiPreferencesFromLocalStorageCache roundtrip', async () => {
  const [localStorageMock, localStorageMockError] = createInMemoryLocalStorageMockForTupleBasedTestHarness()
  assert.equal(localStorageMockError, null)

  const previousLocalStorageValue = globalThis.localStorage
  globalThis.localStorage = localStorageMock

  const [persistSuccess, persistError] = await persistUiPreferencesIntoLocalStorageCache({
    themeName: 'light',
    textScaleMultiplier: 1.1,
    tableSortState: {
      goals: { key: 'status', direction: 'desc' }
    }
  })
  assert.equal(persistError, null)
  assert.equal(persistSuccess, true)

  const [loadedPreferences, loadError] = await loadUiPreferencesFromLocalStorageCache()
  assert.equal(loadError, null)
  if (!loadedPreferences) assert.fail('expected loadedPreferences to be present')
  assert.equal(loadedPreferences.themeName, 'light')
  assert.equal(loadedPreferences.textScaleMultiplier, 1.1)
  assert.ok(loadedPreferences.tableSortState)
  assert.equal(loadedPreferences.tableSortState.goals.key, 'status')
  assert.equal(loadedPreferences.tableSortState.goals.direction, 'desc')

  globalThis.localStorage = previousLocalStorageValue
})

test('persistAuditTimelineIntoLocalStorageCache and loadAuditTimelineFromLocalStorageCache roundtrip', async () => {
  const [localStorageMock, localStorageMockError] = createInMemoryLocalStorageMockForTupleBasedTestHarness()
  assert.equal(localStorageMockError, null)
  const previousLocalStorageValue = globalThis.localStorage
  globalThis.localStorage = localStorageMock

  const sourceTimeline = [
    { id: 'a1', timestamp: '2026-02-01T00:00:00.000Z', contextTag: 'add-record', snapshot: { income: [], expenses: [] } }
  ]
  const [persistSuccess, persistError] = await persistAuditTimelineIntoLocalStorageCache(sourceTimeline)
  assert.equal(persistError, null)
  assert.equal(persistSuccess, true)

  const [loadedTimeline, loadError] = await loadAuditTimelineFromLocalStorageCache()
  assert.equal(loadError, null)
  if (!loadedTimeline) assert.fail('expected loadedTimeline to be present')
  assert.ok(Array.isArray(loadedTimeline))
  assert.equal(loadedTimeline[0].id, 'a1')

  globalThis.localStorage = previousLocalStorageValue
})

test('applyThemeNameToDocumentBodyDataAttribute applies theme attribute', () => {
  const previousDocumentValue = globalThis.document
  globalThis.document = /** @type {any} */ ({ body: { setAttribute(name, value) { this[name] = value } } })

  const [applySuccess, applyError] = applyThemeNameToDocumentBodyDataAttribute('dark')
  assert.equal(applyError, null)
  assert.equal(applySuccess, true)

  globalThis.document = previousDocumentValue
})

test('scrollViewportToTopWithSmoothBehavior calls window scrollTo', () => {
  let calledWithTop = -1
  const previousWindowValue = globalThis.window
  globalThis.window = /** @type {any} */ ({ scrollTo(options) { calledWithTop = options.top } })

  const [scrollSuccess, scrollError] = scrollViewportToTopWithSmoothBehavior()
  assert.equal(scrollError, null)
  assert.equal(scrollSuccess, true)
  assert.equal(calledWithTop, 0)

  globalThis.window = previousWindowValue
})

test('copyTextToClipboardUsingBrowserApi writes text when clipboard API is available', async () => {
  let copiedText = ''
  const previousNavigatorValue = globalThis.navigator
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: /** @type {any} */ ({
      clipboard: {
        async writeText(text) {
          copiedText = text
        }
      }
    })
  })
  const [copySuccess, copyError] = await copyTextToClipboardUsingBrowserApi('hello world')
  assert.equal(copyError, null)
  assert.equal(copySuccess, true)
  assert.equal(copiedText, 'hello world')
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: previousNavigatorValue })
})

test('computeFinancialRiskFindingsUsingBackgroundWorkerWhenAvailable falls back without Worker support', async () => {
  const previousWorkerValue = globalThis.Worker
  globalThis.Worker = undefined

  const [findings, findingsError] = await computeFinancialRiskFindingsUsingBackgroundWorkerWhenAvailable({
    income: [{ amount: 1000 }],
    expenses: [{ amount: 2000 }],
    assets: [{ amount: 100 }],
    debts: [{ amount: 5000, minimumPayment: 600 }],
    credit: [{ amount: 900, creditLimit: 1000, minimumPayment: 200 }],
    loans: [{ amount: 1000, minimumPayment: 100 }],
    goals: []
  })

  assert.equal(findingsError, null)
  assert.ok(Array.isArray(findings))
  globalThis.Worker = previousWorkerValue
})

test('exportBudgetCollectionsStateAsJsonTextSnapshot and importBudgetCollectionsStateFromJsonTextSnapshot roundtrip', async () => {
  const sourceState = {
    income: [{ amount: 1000, category: 'Salary', date: '2026-01-01' }],
    expenses: [{ amount: 500, category: 'Food', date: '2026-01-01' }],
    assets: [],
    debts: [],
    credit: [],
    loans: [],
    goals: []
  }
  const [jsonText, jsonTextError] = await exportBudgetCollectionsStateAsJsonTextSnapshot(sourceState)
  assert.equal(jsonTextError, null)
  if (!jsonText) assert.fail('expected jsonText to be present')

  const [importedState, importedStateError] = await importBudgetCollectionsStateFromJsonTextSnapshot(jsonText)
  assert.equal(importedStateError, null)
  if (!importedState) assert.fail('expected importedState to be present')
  assert.ok(Array.isArray(importedState.income))
  assert.ok(Array.isArray(importedState.expenses))
})

test('exportCompleteFinancialProfileAsJsonTextSnapshot and importCompleteFinancialProfileFromJsonTextSnapshot roundtrip', async () => {
  const sourceCollections = {
    income: [{ amount: 1000, category: 'Salary', date: '2026-01-01' }],
    expenses: [{ amount: 500, category: 'Food', date: '2026-01-01' }],
    assets: [],
    debts: [],
    credit: [],
    loans: [],
    goals: []
  }
  const sourceUiPreferences = {
    themeName: 'dark',
    textScaleMultiplier: 1.05,
    tableSortState: { records: { key: 'date', direction: 'desc' } }
  }
  const sourceAuditTimeline = [{ id: 'audit-1', timestamp: '2026-02-01T00:00:00.000Z', contextTag: 'test', snapshot: sourceCollections }]
  const [jsonText, jsonTextError] = await exportCompleteFinancialProfileAsJsonTextSnapshot(sourceCollections, sourceUiPreferences, sourceAuditTimeline)
  assert.equal(jsonTextError, null)
  if (!jsonText) assert.fail('expected complete profile json text')

  const [importedProfile, importedProfileError] = await importCompleteFinancialProfileFromJsonTextSnapshot(jsonText)
  assert.equal(importedProfileError, null)
  if (!importedProfile) assert.fail('expected imported complete profile')
  assert.ok(Array.isArray(importedProfile.collections.income))
  assert.equal(importedProfile.uiPreferences?.themeName, 'dark')
  assert.ok(Array.isArray(importedProfile.auditTimelineEntries))
  assert.equal(importedProfile.auditTimelineEntries.length, 1)
})

test('importCompleteFinancialProfileFromJsonTextSnapshot supports legacy collections-only payload', async () => {
  const [legacyJsonText, legacyJsonTextError] = await exportBudgetCollectionsStateAsJsonTextSnapshot({
    income: [{ amount: 1 }],
    expenses: [{ amount: 1 }],
    assets: [],
    debts: [],
    credit: [],
    loans: [],
    goals: []
  })
  assert.equal(legacyJsonTextError, null)
  if (!legacyJsonText) assert.fail('expected legacy json text')

  const [importedProfile, importedProfileError] = await importCompleteFinancialProfileFromJsonTextSnapshot(legacyJsonText)
  assert.equal(importedProfileError, null)
  if (!importedProfile) assert.fail('expected imported profile')
  assert.ok(Array.isArray(importedProfile.collections.income))
  assert.equal(importedProfile.uiPreferences, null)
  assert.ok(Array.isArray(importedProfile.auditTimelineEntries))
  assert.equal(importedProfile.auditTimelineEntries.length, 0)
})

test('google sheets sync settings persist and load roundtrip', async () => {
  const [localStorageMock, localStorageMockError] = createInMemoryLocalStorageMockForTupleBasedTestHarness()
  assert.equal(localStorageMockError, null)
  const previousLocalStorageValue = globalThis.localStorage
  globalThis.localStorage = localStorageMock

  const [persistSuccess, persistError] = await persistGoogleSheetsSyncSettingsIntoLocalStorageCache({
    enabled: true,
    webAppUrl: 'https://example.com/exec',
    apiKey: 'k1',
    datasetKey: 'household-main',
    oauthClientId: 'client-1',
    oauthRedirectUri: 'http://127.0.0.1:4000/',
    oauthAccessToken: 'token-1'
  })
  assert.equal(persistError, null)
  assert.equal(persistSuccess, true)

  const [loadedSettings, loadedSettingsError] = await loadGoogleSheetsSyncSettingsFromLocalStorageCache()
  assert.equal(loadedSettingsError, null)
  if (!loadedSettings) assert.fail('expected loaded settings')
  assert.equal(loadedSettings.enabled, true)
  assert.equal(loadedSettings.webAppUrl, 'https://example.com/exec')
  assert.equal(loadedSettings.apiKey, 'k1')
  assert.equal(loadedSettings.datasetKey, 'household-main')
  assert.equal(loadedSettings.oauthClientId, 'client-1')
  assert.equal(loadedSettings.oauthRedirectUri, 'http://127.0.0.1:4000/')
  assert.equal(loadedSettings.oauthAccessToken, 'token-1')

  globalThis.localStorage = previousLocalStorageValue
})

test('google sheets export posts profile payload with historical snapshot', async () => {
  const previousFetchValue = globalThis.fetch
  globalThis.fetch = /** @type {any} */ (async (_url, requestOptions) => {
    const requestBody = JSON.parse(String(requestOptions?.body ?? '{}'))
    assert.equal(requestBody.action, 'export_profile')
    assert.equal(requestBody.datasetKey, 'default')
    assert.ok(requestBody.payload)
    assert.ok(requestBody.historicalSnapshot)
    return {
      async text() {
        return JSON.stringify({ ok: true, historyCount: 12 })
      }
    }
  })

  const [exportValue, exportError] = await exportFinancialProfileToGoogleSheetsUsingTupleResultPlaceholder(
    { enabled: true, webAppUrl: 'https://example.com/exec', apiKey: '', datasetKey: 'default' },
    { income: [{ amount: 1 }], expenses: [{ amount: 1 }], assets: [], debts: [], credit: [], loans: [], goals: [] },
    { themeName: 'dark', textScaleMultiplier: 1, tableSortState: {} },
    []
  )
  assert.equal(exportError, null)
  if (!exportValue) assert.fail('expected export value')
  assert.equal(exportValue.historyCount, 12)

  globalThis.fetch = previousFetchValue
})

test('google sheets import returns profile and supports historical timestamp option', async () => {
  const previousFetchValue = globalThis.fetch
  globalThis.fetch = /** @type {any} */ (async (_url, requestOptions) => {
    const requestBody = JSON.parse(String(requestOptions?.body ?? '{}'))
    assert.equal(requestBody.action, 'import_profile')
    assert.equal(requestBody.asOfTimestampIso, '2026-02-01T00:00')
    return {
      async text() {
        return JSON.stringify({
          ok: true,
          profilePayload: {
            schemaVersion: 1,
            exportedAt: '2026-02-01T00:00:00.000Z',
            profile: {
              collections: { income: [{ amount: 1 }], expenses: [{ amount: 1 }], assets: [], debts: [], credit: [], loans: [], goals: [] },
              uiPreferences: { themeName: 'light', textScaleMultiplier: 1, tableSortState: {} },
              auditTimelineEntries: []
            }
          }
        })
      }
    }
  })

  const [importValue, importError] = await importFinancialProfileFromGoogleSheetsUsingTupleResultPlaceholder(
    { enabled: true, webAppUrl: 'https://example.com/exec', apiKey: '', datasetKey: 'default' },
    { asOfTimestampIso: '2026-02-01T00:00' }
  )
  assert.equal(importError, null)
  if (!importValue) assert.fail('expected import value')
  assert.ok(Array.isArray(importValue.collections.income))

  globalThis.fetch = previousFetchValue
})

test('google oauth popup opens with implicit flow URL when config is valid', () => {
  const previousWindowValue = globalThis.window
  let openedUrl = ''
  globalThis.window = /** @type {any} */ ({
    open(url) {
      openedUrl = String(url)
      return {}
    }
  })
  const [opened, openedError] = openGoogleSheetsOAuthPopupUsingImplicitFlow({
    oauthClientId: 'client-id-123',
    oauthRedirectUri: 'http://127.0.0.1:4000/'
  })
  assert.equal(openedError, null)
  assert.equal(opened, true)
  assert.ok(openedUrl.includes('accounts.google.com/o/oauth2/v2/auth'))
  assert.ok(openedUrl.includes('response_type=token'))
  globalThis.window = previousWindowValue
})

test('google oauth hash parser returns access token and clears hash', () => {
  const previousWindowValue = globalThis.window
  globalThis.window = /** @type {any} */ ({
    location: { hash: '#access_token=abc123&token_type=Bearer' }
  })
  const [accessToken, accessTokenError] = readGoogleOAuthAccessTokenFromCurrentUrlHash(true)
  assert.equal(accessTokenError, null)
  assert.equal(accessToken, 'abc123')
  assert.equal(globalThis.window.location.hash, '')
  globalThis.window = previousWindowValue
})

test('firebase web config persist and load roundtrip', async () => {
  const [localStorageMock, localStorageMockError] = createInMemoryLocalStorageMockForTupleBasedTestHarness()
  assert.equal(localStorageMockError, null)
  const previousLocalStorageValue = globalThis.localStorage
  globalThis.localStorage = localStorageMock

  const [persistSuccess, persistError] = await persistFirebaseWebConfigIntoLocalStorageCache({
    enabled: true,
    apiKey: 'api-key',
    authDomain: 'example.firebaseapp.com',
    projectId: 'example-project',
    storageBucket: 'example.appspot.com',
    messagingSenderId: '12345',
    appId: '1:12345:web:abcdef'
  })
  assert.equal(persistError, null)
  assert.equal(persistSuccess, true)

  const [loadedConfig, loadedConfigError] = await loadFirebaseWebConfigFromLocalStorageCache()
  assert.equal(loadedConfigError, null)
  if (!loadedConfig) assert.fail('expected loaded firebase config')
  assert.equal(loadedConfig.enabled, true)
  assert.equal(loadedConfig.projectId, 'example-project')

  globalThis.localStorage = previousLocalStorageValue
})

test('firebase init returns validation error when disabled', async () => {
  const [clientBundle, clientBundleError] = await initializeFirebaseClientsFromWebConfig({
    enabled: false,
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: ''
  })
  assert.equal(clientBundle, null)
  assert.ok(clientBundleError)
  assert.equal(clientBundleError.kind, 'VALIDATION')
})
