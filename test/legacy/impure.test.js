import test from 'node:test'
import assert from 'node:assert/strict'

import {
  safelyParseJsonTextIntoObjectUsingPromiseBoundary,
  safelyStringifyObjectIntoJsonTextUsingPromiseBoundary,
  safelyWriteJsonSnapshotToBrowserLocalStorageByKey,
  safelyReadJsonSnapshotFromBrowserLocalStorageByKey,
  persistBudgetCollectionsStateIntoLocalStorageCache,
  loadBudgetCollectionsStateFromLocalStorageCache,
  readCurrentIsoTimestampForBudgetRecordUpdates
} from './impure.js'

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
