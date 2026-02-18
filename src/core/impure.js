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
import { extractFinancialRiskFindingsFromCurrentCollectionsState } from './pure.js'

/**
 * Creates a normalized application error object for tuple-based error flow.
 * @param {string} errorKind
 * @param {string} errorMessage
 * @param {boolean} isRecoverable
 * @param {unknown} [errorDetails]
 * @returns {Result<AppError>}
 */
export function createImpureLayerApplicationErrorWithContext(errorKind, errorMessage, isRecoverable, errorDetails) {
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
 * Safely parses JSON text without exposing throw behavior to callers.
 * Returns an error tuple when parsing fails.
 * @param {string} jsonTextToParse
 * @returns {Promise<Result<Record<string, unknown>|Array<unknown>>>}
 */
export function safelyParseJsonTextIntoObjectUsingPromiseBoundary(jsonTextToParse) {
  return Promise.resolve()
    .then(() => JSON.parse(jsonTextToParse))
    .then((parsedObject) => /** @type {Result<Record<string, unknown>|Array<unknown>>} */ ([parsedObject, null]))
    .catch((parseFailure) => {
      const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
        'JSON_PARSE',
        'failed to parse json text',
        true,
        { parseFailure }
      )
      if (createErrorFailure) return /** @type {Result<Record<string, unknown>|Array<unknown>>} */ ([null, createErrorFailure])
      return /** @type {Result<Record<string, unknown>|Array<unknown>>} */ ([null, errorValue])
    })
}

/**
 * Safely stringifies an object into JSON text without throw exposure.
 * Returns an error tuple when serialization fails.
 * @param {unknown} objectToSerialize
 * @returns {Promise<Result<string>>}
 */
export function safelyStringifyObjectIntoJsonTextUsingPromiseBoundary(objectToSerialize) {
  return Promise.resolve()
    .then(() => JSON.stringify(objectToSerialize))
    .then((jsonTextValue) => /** @type {Result<string>} */ ([jsonTextValue, null]))
    .catch((stringifyFailure) => {
      const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
        'JSON_STRINGIFY',
        'failed to stringify object into json text',
        true,
        { stringifyFailure }
      )
      if (createErrorFailure) return /** @type {Result<string>} */ ([null, createErrorFailure])
      return /** @type {Result<string>} */ ([null, errorValue])
    })
}

/**
 * Safely writes a JSON-serializable object to browser local storage by key.
 * Returns an error tuple when local storage is unavailable or write fails.
 * @param {string} localStorageKey
 * @param {unknown} snapshotValue
 * @returns {Promise<Result<true>>}
 */
export async function safelyWriteJsonSnapshotToBrowserLocalStorageByKey(localStorageKey, snapshotValue) {
  // Critical path: never touch storage APIs unless runtime support is confirmed.
  if (typeof globalThis.localStorage === 'undefined') {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'LOCAL_STORAGE',
      'localStorage is not available in this runtime',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const [snapshotText, stringifyError] = await safelyStringifyObjectIntoJsonTextUsingPromiseBoundary(snapshotValue)
  if (stringifyError) return [null, stringifyError]
  // Critical path: stringify wrappers must still be null-checked before IO writes.
  if (snapshotText === null) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'JSON_STRINGIFY',
      'json stringify produced null snapshot text unexpectedly',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  return Promise.resolve()
    .then(() => globalThis.localStorage.setItem(localStorageKey, snapshotText))
    .then(() => /** @type {Result<true>} */ ([true, null]))
    .catch((writeFailure) => {
      const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
        'LOCAL_STORAGE',
        'failed to write json snapshot to localStorage',
        true,
        { writeFailure, localStorageKey }
      )
      if (createErrorFailure) return /** @type {Result<true>} */ ([null, createErrorFailure])
      return /** @type {Result<true>} */ ([null, errorValue])
    })
}

/**
 * Safely reads a JSON object from browser local storage by key.
 * Returns an error tuple when local storage is unavailable or data is invalid.
 * @param {string} localStorageKey
 * @returns {Promise<Result<Record<string, unknown>|Array<unknown>|null>>}
 */
export async function safelyReadJsonSnapshotFromBrowserLocalStorageByKey(localStorageKey) {
  // Critical path: fail fast in non-browser contexts so callers can choose fallback state.
  if (typeof globalThis.localStorage === 'undefined') {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'LOCAL_STORAGE',
      'localStorage is not available in this runtime',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const [storedText, readError] = await Promise.resolve()
    .then(() => globalThis.localStorage.getItem(localStorageKey))
    .then((localStorageValue) => /** @type {Result<string|null>} */ ([localStorageValue, null]))
    .catch((readFailure) => {
      const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
        'LOCAL_STORAGE',
        'failed to read json snapshot from localStorage',
        true,
        { readFailure, localStorageKey }
      )
      if (createErrorFailure) return /** @type {Result<string|null>} */ ([null, createErrorFailure])
      return /** @type {Result<string|null>} */ ([null, errorValue])
    })
  if (readError) return [null, readError]

  // Critical path: null means cache miss, not error.
  if (storedText === null) return [null, null]

  const [parsedSnapshot, parseError] = await safelyParseJsonTextIntoObjectUsingPromiseBoundary(storedText)
  if (parseError) return [null, parseError]

  return [parsedSnapshot, null]
}

/**
 * Safely fetches JSON payload from a URL and parses it with tuple-style error handling.
 * Returns an error tuple when network request or parsing fails.
 * @param {string} requestUrl
 * @returns {Promise<Result<Record<string, unknown>|Array<unknown>>>}
 */
export async function safelyFetchJsonFromUrlUsingTupleErrorHandling(requestUrl) {
  // Critical path: network failure is common, so we normalize transport errors here.
  const [responseObject, responseError] = await Promise.resolve()
    .then(() => fetch(requestUrl))
    .then((fetchResponse) => /** @type {Result<Response>} */ ([fetchResponse, null]))
    .catch((fetchFailure) => {
      const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
        'NETWORK',
        'failed to fetch remote json payload',
        true,
        { fetchFailure, requestUrl }
      )
      if (createErrorFailure) return /** @type {Result<Response>} */ ([null, createErrorFailure])
      return /** @type {Result<Response>} */ ([null, errorValue])
    })
  if (responseError) return [null, responseError]
  if (responseObject === null) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'NETWORK',
      'network fetch returned null response object unexpectedly',
      true,
      { requestUrl }
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const [responseText, responseTextError] = await Promise.resolve()
    .then(() => responseObject.text())
    .then((textValue) => /** @type {Result<string>} */ ([textValue, null]))
    .catch((textFailure) => {
      const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
        'NETWORK',
        'failed to read response body text',
        true,
        { textFailure, requestUrl }
      )
      if (createErrorFailure) return /** @type {Result<string>} */ ([null, createErrorFailure])
      return /** @type {Result<string>} */ ([null, errorValue])
    })
  if (responseTextError) return [null, responseTextError]
  if (responseText === null) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'NETWORK',
      'response body text resolved to null unexpectedly',
      true,
      { requestUrl }
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const [parsedResponse, parseError] = await safelyParseJsonTextIntoObjectUsingPromiseBoundary(responseText)
  if (parseError) return [null, parseError]

  return [parsedResponse, null]
}

/**
 * Placeholder wrapper for Google sign-in initialization until SDK wiring is added.
 * Returns a not-implemented error for now.
 * @returns {Promise<Result<null>>}
 */
export async function initializeGoogleSignInSessionWithTupleResultPlaceholder() {
  const [notImplementedError, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
    'NOT_IMPLEMENTED',
    'google sign-in integration is not implemented yet',
    true
  )
  if (createErrorFailure) return [null, createErrorFailure]
  return [null, notImplementedError]
}

/**
 * Placeholder wrapper for Google Sheets read operation until API wiring is added.
 * Returns a not-implemented error for now.
 * @returns {Promise<Result<null>>}
 */
export async function readGoogleSheetsRowsUsingTupleResultPlaceholder() {
  // Critical path: this placeholder prevents accidental direct SDK calls outside wrappers.
  const [notImplementedError, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
    'NOT_IMPLEMENTED',
    'google sheets read integration is not implemented yet',
    true
  )
  if (createErrorFailure) return [null, createErrorFailure]
  return [null, notImplementedError]
}

/**
 * Loads Google Sheets sync settings from localStorage cache.
 * Returns defaults when cache is missing.
 * @returns {Promise<Result<{enabled: boolean, webAppUrl: string, apiKey: string, datasetKey: string, oauthClientId: string, oauthRedirectUri: string, oauthAccessToken: string}>>}
 */
export async function loadGoogleSheetsSyncSettingsFromLocalStorageCache() {
  const [cachedValue, cachedValueError] = await safelyReadJsonSnapshotFromBrowserLocalStorageByKey(LOCAL_GOOGLE_SHEETS_SETTINGS_STORAGE_KEY)
  if (cachedValueError) return [null, cachedValueError]
  if (cachedValue === null) {
    return [{
      enabled: false,
      webAppUrl: '',
      apiKey: '',
      datasetKey: 'default',
      oauthClientId: '',
      oauthRedirectUri: '',
      oauthAccessToken: ''
    }, null]
  }
  if (Array.isArray(cachedValue) || typeof cachedValue !== 'object') {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'VALIDATION',
      'cached google sheets settings payload must be an object',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  return [{
    enabled: cachedValue.enabled === true,
    webAppUrl: typeof cachedValue.webAppUrl === 'string' ? cachedValue.webAppUrl : '',
    apiKey: typeof cachedValue.apiKey === 'string' ? cachedValue.apiKey : '',
    datasetKey: typeof cachedValue.datasetKey === 'string' && cachedValue.datasetKey.trim().length > 0 ? cachedValue.datasetKey.trim() : 'default',
    oauthClientId: typeof cachedValue.oauthClientId === 'string' ? cachedValue.oauthClientId : '',
    oauthRedirectUri: typeof cachedValue.oauthRedirectUri === 'string' ? cachedValue.oauthRedirectUri : '',
    oauthAccessToken: typeof cachedValue.oauthAccessToken === 'string' ? cachedValue.oauthAccessToken : ''
  }, null]
}

/**
 * Persists Google Sheets sync settings into localStorage cache.
 * Returns validation error when required fields are malformed.
 * @param {{enabled: boolean, webAppUrl: string, apiKey: string, datasetKey: string, oauthClientId: string, oauthRedirectUri: string, oauthAccessToken: string}} settingsValue
 * @returns {Promise<Result<true>>}
 */
export async function persistGoogleSheetsSyncSettingsIntoLocalStorageCache(settingsValue) {
  if (!settingsValue || typeof settingsValue !== 'object' || Array.isArray(settingsValue)) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'VALIDATION',
      'google sheets settings must be an object',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  if (typeof settingsValue.enabled !== 'boolean') {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'VALIDATION',
      'google sheets settings enabled must be boolean',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  if (
    typeof settingsValue.webAppUrl !== 'string' ||
    typeof settingsValue.apiKey !== 'string' ||
    typeof settingsValue.datasetKey !== 'string' ||
    typeof settingsValue.oauthClientId !== 'string' ||
    typeof settingsValue.oauthRedirectUri !== 'string' ||
    typeof settingsValue.oauthAccessToken !== 'string'
  ) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'VALIDATION',
      'google sheets settings fields must be strings',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const payload = {
    enabled: settingsValue.enabled,
    webAppUrl: settingsValue.webAppUrl.trim(),
    apiKey: settingsValue.apiKey.trim(),
    datasetKey: settingsValue.datasetKey.trim() || 'default',
    oauthClientId: settingsValue.oauthClientId.trim(),
    oauthRedirectUri: settingsValue.oauthRedirectUri.trim(),
    oauthAccessToken: settingsValue.oauthAccessToken.trim()
  }
  const [persistSuccess, persistError] = await safelyWriteJsonSnapshotToBrowserLocalStorageByKey(LOCAL_GOOGLE_SHEETS_SETTINGS_STORAGE_KEY, payload)
  if (persistError) return [null, persistError]
  if (!persistSuccess) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'LOCAL_STORAGE',
      'fallback localStorage write for google sheets settings did not return success flag',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  return [true, null]
}

/**
 * Opens Google OAuth consent in a popup for Sheets scope using implicit grant.
 * Returns tuple error when configuration is missing or popup fails.
 * @param {{oauthClientId: string, oauthRedirectUri: string}} oauthSettings
 * @returns {Result<true>}
 */
export function openGoogleSheetsOAuthPopupUsingImplicitFlow(oauthSettings) {
  if (!oauthSettings || typeof oauthSettings !== 'object' || Array.isArray(oauthSettings)) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('VALIDATION', 'oauth settings must be an object', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const oauthClientId = typeof oauthSettings.oauthClientId === 'string' ? oauthSettings.oauthClientId.trim() : ''
  const oauthRedirectUri = typeof oauthSettings.oauthRedirectUri === 'string' ? oauthSettings.oauthRedirectUri.trim() : ''
  if (oauthClientId.length === 0 || oauthRedirectUri.length === 0) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('VALIDATION', 'oauth client id and redirect uri are required', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const query = new URLSearchParams({
    client_id: oauthClientId,
    redirect_uri: oauthRedirectUri,
    response_type: 'token',
    include_granted_scopes: 'true',
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    prompt: 'consent'
  }).toString()
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${query}`
  if (typeof globalThis.window === 'undefined' || typeof globalThis.window.open !== 'function') {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('BROWSER_API', 'window.open is not available in this runtime', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const popupWindow = globalThis.window.open(authUrl, 'google-sheets-oauth', 'popup,width=520,height=720')
  if (!popupWindow) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('BROWSER_API', 'failed to open oauth popup window', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  return [true, null]
}

/**
 * Reads oauth access token from current URL hash fragment and optionally clears hash.
 * Supports `#access_token=...` oauth callback payload.
 * @param {boolean} [shouldClearHash=true]
 * @returns {Result<string|null>}
 */
export function readGoogleOAuthAccessTokenFromCurrentUrlHash(shouldClearHash = true) {
  if (typeof globalThis.window === 'undefined' || typeof globalThis.window.location === 'undefined') {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('BROWSER_API', 'window.location is not available in this runtime', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const hashValue = typeof globalThis.window.location.hash === 'string' ? globalThis.window.location.hash : ''
  if (!hashValue || !hashValue.includes('access_token=')) return [null, null]
  const hashQuery = hashValue.startsWith('#') ? hashValue.slice(1) : hashValue
  const params = new URLSearchParams(hashQuery)
  const accessToken = params.get('access_token')
  if (shouldClearHash) globalThis.window.location.hash = ''
  return [accessToken, null]
}

/**
 * Exports full financial profile payload to Google Sheets using optional web-app endpoint.
 * Supports historical snapshots through the `historicalSnapshot` payload field.
 * @param {{enabled: boolean, webAppUrl: string, apiKey: string, datasetKey: string, oauthAccessToken?: string}} googleSheetsSettings
 * @param {Record<string, unknown>} budgetCollectionsState
 * @param {{themeName: 'light'|'dark', textScaleMultiplier: number, tableSortState?: Record<string, {key: string, direction: 'asc'|'desc'}>}} uiPreferences
 * @param {Array<Record<string, unknown>>} auditTimelineEntries
 * @returns {Promise<Result<{syncedAt: string, historyCount: number|null}>>}
 */
export async function exportFinancialProfileToGoogleSheetsUsingTupleResultPlaceholder(
  googleSheetsSettings,
  budgetCollectionsState,
  uiPreferences,
  auditTimelineEntries
) {
  if (!googleSheetsSettings || typeof googleSheetsSettings !== 'object' || Array.isArray(googleSheetsSettings)) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'VALIDATION',
      'googleSheetsSettings must be an object',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  if (googleSheetsSettings.enabled !== true) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'VALIDATION',
      'google sheets sync is disabled',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const webAppUrl = typeof googleSheetsSettings.webAppUrl === 'string' ? googleSheetsSettings.webAppUrl.trim() : ''
  if (webAppUrl.length === 0) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'VALIDATION',
      'google sheets web app url is required',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const [profileJsonText, profileJsonTextError] = await exportCompleteFinancialProfileAsJsonTextSnapshot(
    budgetCollectionsState,
    uiPreferences,
    auditTimelineEntries
  )
  if (profileJsonTextError) return [null, profileJsonTextError]
  if (!profileJsonText) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'VALIDATION',
      'profile json text is unexpectedly empty before google sheets export',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const [profilePayload, profilePayloadError] = await safelyParseJsonTextIntoObjectUsingPromiseBoundary(profileJsonText)
  if (profilePayloadError) return [null, profilePayloadError]
  if (!profilePayload || Array.isArray(profilePayload) || typeof profilePayload !== 'object') {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'VALIDATION',
      'profile payload is malformed before google sheets export',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const requestBody = {
    action: 'export_profile',
    datasetKey: typeof googleSheetsSettings.datasetKey === 'string' && googleSheetsSettings.datasetKey.trim().length > 0
      ? googleSheetsSettings.datasetKey.trim()
      : 'default',
    payload: profilePayload,
    historicalSnapshot: {
      capturedAt: new Date().toISOString(),
      profile: profilePayload.profile
    }
  }

  const requestHeaders = {
    'Content-Type': 'application/json'
  }
  if (typeof googleSheetsSettings.apiKey === 'string' && googleSheetsSettings.apiKey.trim().length > 0) {
    requestHeaders['X-Api-Key'] = googleSheetsSettings.apiKey.trim()
  }
  if (typeof googleSheetsSettings.oauthAccessToken === 'string' && googleSheetsSettings.oauthAccessToken.trim().length > 0) {
    requestHeaders.Authorization = `Bearer ${googleSheetsSettings.oauthAccessToken.trim()}`
  }
  const [responseText, responseTextError] = await Promise.resolve()
    .then(() => fetch(webAppUrl, { method: 'POST', headers: requestHeaders, body: JSON.stringify(requestBody) }))
    .then((responseObject) => responseObject.text())
    .then((textValue) => /** @type {Result<string>} */ ([textValue, null]))
    .catch((fetchFailure) => {
      const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
        'NETWORK',
        'failed to export profile to google sheets endpoint',
        true,
        { fetchFailure }
      )
      if (createErrorFailure) return /** @type {Result<string>} */ ([null, createErrorFailure])
      return /** @type {Result<string>} */ ([null, errorValue])
    })
  if (responseTextError) return [null, responseTextError]
  if (responseText === null) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'NETWORK',
      'google sheets export endpoint returned null response body',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const [responsePayload, responsePayloadError] = await safelyParseJsonTextIntoObjectUsingPromiseBoundary(responseText)
  if (responsePayloadError) return [null, responsePayloadError]
  if (!responsePayload || Array.isArray(responsePayload) || typeof responsePayload !== 'object') {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'VALIDATION',
      'google sheets export endpoint payload is malformed',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  if (responsePayload.ok === false) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'NETWORK',
      'google sheets export endpoint returned not-ok status',
      true,
      { responsePayload }
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  return [{
    syncedAt: new Date().toISOString(),
    historyCount: typeof responsePayload.historyCount === 'number' ? responsePayload.historyCount : null
  }, null]
}

/**
 * Imports full financial profile payload from Google Sheets using optional web-app endpoint.
 * Supports historical point-in-time reads through `asOfTimestampIso`.
 * @param {{enabled: boolean, webAppUrl: string, apiKey: string, datasetKey: string, oauthAccessToken?: string}} googleSheetsSettings
 * @param {{asOfTimestampIso?: string}} [importOptions]
 * @returns {Promise<Result<{collections: Record<string, unknown>, uiPreferences: {themeName: 'light'|'dark', textScaleMultiplier: number, tableSortState?: Record<string, {key: string, direction: 'asc'|'desc'}>}|null, auditTimelineEntries: Array<Record<string, unknown>>}>>}
 */
export async function importFinancialProfileFromGoogleSheetsUsingTupleResultPlaceholder(googleSheetsSettings, importOptions = {}) {
  if (!googleSheetsSettings || typeof googleSheetsSettings !== 'object' || Array.isArray(googleSheetsSettings)) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'VALIDATION',
      'googleSheetsSettings must be an object',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  if (googleSheetsSettings.enabled !== true) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'VALIDATION',
      'google sheets sync is disabled',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const webAppUrl = typeof googleSheetsSettings.webAppUrl === 'string' ? googleSheetsSettings.webAppUrl.trim() : ''
  if (webAppUrl.length === 0) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'VALIDATION',
      'google sheets web app url is required',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const requestBody = {
    action: 'import_profile',
    datasetKey: typeof googleSheetsSettings.datasetKey === 'string' && googleSheetsSettings.datasetKey.trim().length > 0
      ? googleSheetsSettings.datasetKey.trim()
      : 'default',
    asOfTimestampIso: typeof importOptions.asOfTimestampIso === 'string' ? importOptions.asOfTimestampIso : ''
  }
  const requestHeaders = {
    'Content-Type': 'application/json'
  }
  if (typeof googleSheetsSettings.apiKey === 'string' && googleSheetsSettings.apiKey.trim().length > 0) {
    requestHeaders['X-Api-Key'] = googleSheetsSettings.apiKey.trim()
  }
  if (typeof googleSheetsSettings.oauthAccessToken === 'string' && googleSheetsSettings.oauthAccessToken.trim().length > 0) {
    requestHeaders.Authorization = `Bearer ${googleSheetsSettings.oauthAccessToken.trim()}`
  }
  const [responseText, responseTextError] = await Promise.resolve()
    .then(() => fetch(webAppUrl, { method: 'POST', headers: requestHeaders, body: JSON.stringify(requestBody) }))
    .then((responseObject) => responseObject.text())
    .then((textValue) => /** @type {Result<string>} */ ([textValue, null]))
    .catch((fetchFailure) => {
      const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
        'NETWORK',
        'failed to import profile from google sheets endpoint',
        true,
        { fetchFailure }
      )
      if (createErrorFailure) return /** @type {Result<string>} */ ([null, createErrorFailure])
      return /** @type {Result<string>} */ ([null, errorValue])
    })
  if (responseTextError) return [null, responseTextError]
  if (responseText === null) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'NETWORK',
      'google sheets import endpoint returned null response body',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const [responsePayload, responsePayloadError] = await safelyParseJsonTextIntoObjectUsingPromiseBoundary(responseText)
  if (responsePayloadError) return [null, responsePayloadError]
  if (!responsePayload || Array.isArray(responsePayload) || typeof responsePayload !== 'object') {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'VALIDATION',
      'google sheets import endpoint payload is malformed',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  if (responsePayload.ok === false) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'NETWORK',
      'google sheets import endpoint returned not-ok status',
      true,
      { responsePayload }
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const profilePayloadCandidate = responsePayload.profilePayload ?? responsePayload.payload ?? responsePayload
  const [profileJsonText, profileJsonTextError] = await safelyStringifyObjectIntoJsonTextUsingPromiseBoundary(profilePayloadCandidate)
  if (profileJsonTextError) return [null, profileJsonTextError]
  if (!profileJsonText) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'VALIDATION',
      'google sheets import payload is unexpectedly empty',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  return importCompleteFinancialProfileFromJsonTextSnapshot(profileJsonText)
}

/**
 * Exports full budgeting collections state to JSON text.
 * Returns an error when payload is malformed or serialization fails.
 * @param {Record<string, unknown>} budgetCollectionsState
 * @returns {Promise<Result<string>>}
 */
export async function exportBudgetCollectionsStateAsJsonTextSnapshot(budgetCollectionsState) {
  if (!budgetCollectionsState || typeof budgetCollectionsState !== 'object') {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'VALIDATION',
      'budgetCollectionsState must be an object',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  if (!Array.isArray(budgetCollectionsState.income) || !Array.isArray(budgetCollectionsState.expenses)) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'VALIDATION',
      'budgetCollectionsState must include income and expenses arrays',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const [jsonText, jsonTextError] = await safelyStringifyObjectIntoJsonTextUsingPromiseBoundary(budgetCollectionsState)
  if (jsonTextError) return [null, jsonTextError]
  if (jsonText === null) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'JSON_STRINGIFY',
      'json text is unexpectedly null',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  return [jsonText, null]
}

/**
 * Imports full budgeting collections state from JSON text.
 * Returns an error when payload is malformed or required arrays are missing.
 * @param {string} budgetCollectionsJsonText
 * @returns {Promise<Result<Record<string, unknown>>>}
 */
export async function importBudgetCollectionsStateFromJsonTextSnapshot(budgetCollectionsJsonText) {
  if (typeof budgetCollectionsJsonText !== 'string' || budgetCollectionsJsonText.trim().length === 0) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'VALIDATION',
      'budgetCollectionsJsonText must be a non-empty string',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const [parsedValue, parsedValueError] = await safelyParseJsonTextIntoObjectUsingPromiseBoundary(budgetCollectionsJsonText)
  if (parsedValueError) return [null, parsedValueError]
  if (!parsedValue || Array.isArray(parsedValue) || typeof parsedValue !== 'object') {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'VALIDATION',
      'imported profile must be a JSON object',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  if (!Array.isArray(parsedValue.income) || !Array.isArray(parsedValue.expenses)) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'VALIDATION',
      'imported profile is missing income or expenses arrays',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  return [parsedValue, null]
}

/**
 * Exports a complete financial profile payload as JSON text.
 * Includes collections, UI preferences, and audit timeline for full portability.
 * @param {Record<string, unknown>} budgetCollectionsState
 * @param {{themeName: 'light'|'dark', textScaleMultiplier: number, tableSortState?: Record<string, {key: string, direction: 'asc'|'desc'}>}} uiPreferences
 * @param {Array<Record<string, unknown>>} auditTimelineEntries
 * @returns {Promise<Result<string>>}
 */
export async function exportCompleteFinancialProfileAsJsonTextSnapshot(budgetCollectionsState, uiPreferences, auditTimelineEntries) {
  const [collectionsJsonText, collectionsJsonTextError] = await exportBudgetCollectionsStateAsJsonTextSnapshot(budgetCollectionsState)
  if (collectionsJsonTextError) return [null, collectionsJsonTextError]
  if (!collectionsJsonText) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'JSON_STRINGIFY',
      'collections json text is unexpectedly empty during complete export',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const [collectionsPayload, collectionsPayloadError] = await safelyParseJsonTextIntoObjectUsingPromiseBoundary(collectionsJsonText)
  if (collectionsPayloadError) return [null, collectionsPayloadError]
  if (!collectionsPayload || Array.isArray(collectionsPayload) || typeof collectionsPayload !== 'object') {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'VALIDATION',
      'collections payload is malformed during complete export',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const completePayload = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    profile: {
      collections: collectionsPayload,
      uiPreferences,
      auditTimelineEntries
    }
  }
  const [jsonText, jsonTextError] = await safelyStringifyObjectIntoJsonTextUsingPromiseBoundary(completePayload)
  if (jsonTextError) return [null, jsonTextError]
  if (jsonText === null) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'JSON_STRINGIFY',
      'complete profile json text is unexpectedly null',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  return [jsonText, null]
}

/**
 * Imports complete financial profile payload from JSON text.
 * Backward-compatible: accepts legacy collections-only payloads.
 * @param {string} profileJsonText
 * @returns {Promise<Result<{collections: Record<string, unknown>, uiPreferences: {themeName: 'light'|'dark', textScaleMultiplier: number, tableSortState?: Record<string, {key: string, direction: 'asc'|'desc'}>}|null, auditTimelineEntries: Array<Record<string, unknown>>}>>}
 */
export async function importCompleteFinancialProfileFromJsonTextSnapshot(profileJsonText) {
  const [parsedValue, parsedValueError] = await safelyParseJsonTextIntoObjectUsingPromiseBoundary(profileJsonText)
  if (parsedValueError) return [null, parsedValueError]
  if (!parsedValue || Array.isArray(parsedValue) || typeof parsedValue !== 'object') {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'VALIDATION',
      'imported profile must be a JSON object',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  // Backward compatibility: treat direct collections payload as legacy export.
  if (Array.isArray(parsedValue.income) && Array.isArray(parsedValue.expenses)) {
    return [{
      collections: parsedValue,
      uiPreferences: null,
      auditTimelineEntries: []
    }, null]
  }

  const profile = parsedValue.profile
  if (!profile || Array.isArray(profile) || typeof profile !== 'object') {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'VALIDATION',
      'imported profile is missing profile object',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const collections = profile.collections
  if (!collections || Array.isArray(collections) || typeof collections !== 'object') {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'VALIDATION',
      'imported profile is missing collections object',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  if (!Array.isArray(collections.income) || !Array.isArray(collections.expenses)) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'VALIDATION',
      'imported profile collections are missing income or expenses arrays',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const uiPreferencesCandidate = profile.uiPreferences
  let normalizedUiPreferences = null
  if (uiPreferencesCandidate && !Array.isArray(uiPreferencesCandidate) && typeof uiPreferencesCandidate === 'object') {
    const themeName = uiPreferencesCandidate.themeName
    const textScaleMultiplier = uiPreferencesCandidate.textScaleMultiplier
    const tableSortState = uiPreferencesCandidate.tableSortState
    const isValidTheme = themeName === 'light' || themeName === 'dark'
    const isValidScale = typeof textScaleMultiplier === 'number' && Number.isFinite(textScaleMultiplier)
    const isValidSortState = tableSortState === undefined || (!!tableSortState && !Array.isArray(tableSortState) && typeof tableSortState === 'object')
    if (isValidTheme && isValidScale && isValidSortState) {
      normalizedUiPreferences = /** @type {{themeName: 'light'|'dark', textScaleMultiplier: number, tableSortState?: Record<string, {key: string, direction: 'asc'|'desc'}>}} */ ({ themeName, textScaleMultiplier, tableSortState })
    }
  }

  const auditTimelineEntries = Array.isArray(profile.auditTimelineEntries)
    ? profile.auditTimelineEntries.filter((rowItem) => !!rowItem && typeof rowItem === 'object')
    : []

  return [{
    collections,
    uiPreferences: normalizedUiPreferences,
    auditTimelineEntries
  }, null]
}

/**
 * Loads Firebase web config from localStorage cache.
 * Returns defaults when cache is missing.
 * @returns {Promise<Result<{enabled: boolean, apiKey: string, authDomain: string, projectId: string, storageBucket: string, messagingSenderId: string, appId: string}>>}
 */
export async function loadFirebaseWebConfigFromLocalStorageCache() {
  const [cachedValue, cachedValueError] = await safelyReadJsonSnapshotFromBrowserLocalStorageByKey(LOCAL_FIREBASE_WEB_CONFIG_STORAGE_KEY)
  if (cachedValueError) return [null, cachedValueError]
  if (cachedValue === null) {
    return [{
      enabled: false,
      apiKey: '',
      authDomain: '',
      projectId: '',
      storageBucket: '',
      messagingSenderId: '',
      appId: ''
    }, null]
  }
  if (Array.isArray(cachedValue) || typeof cachedValue !== 'object') {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('VALIDATION', 'cached firebase config must be an object', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  return [{
    enabled: cachedValue.enabled === true,
    apiKey: typeof cachedValue.apiKey === 'string' ? cachedValue.apiKey : '',
    authDomain: typeof cachedValue.authDomain === 'string' ? cachedValue.authDomain : '',
    projectId: typeof cachedValue.projectId === 'string' ? cachedValue.projectId : '',
    storageBucket: typeof cachedValue.storageBucket === 'string' ? cachedValue.storageBucket : '',
    messagingSenderId: typeof cachedValue.messagingSenderId === 'string' ? cachedValue.messagingSenderId : '',
    appId: typeof cachedValue.appId === 'string' ? cachedValue.appId : ''
  }, null]
}

/**
 * Persists Firebase web config into localStorage cache.
 * @param {{enabled: boolean, apiKey: string, authDomain: string, projectId: string, storageBucket: string, messagingSenderId: string, appId: string}} firebaseWebConfig
 * @returns {Promise<Result<true>>}
 */
export async function persistFirebaseWebConfigIntoLocalStorageCache(firebaseWebConfig) {
  if (!firebaseWebConfig || typeof firebaseWebConfig !== 'object' || Array.isArray(firebaseWebConfig)) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('VALIDATION', 'firebase web config must be an object', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const requiredStringFieldNames = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId']
  if (typeof firebaseWebConfig.enabled !== 'boolean') {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('VALIDATION', 'firebase enabled must be boolean', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  for (const fieldName of requiredStringFieldNames) {
    if (typeof firebaseWebConfig[fieldName] !== 'string') {
      const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('VALIDATION', `firebase ${fieldName} must be a string`, true)
      if (createErrorFailure) return [null, createErrorFailure]
      return [null, errorValue]
    }
  }
  const payload = {
    enabled: firebaseWebConfig.enabled,
    apiKey: firebaseWebConfig.apiKey.trim(),
    authDomain: firebaseWebConfig.authDomain.trim(),
    projectId: firebaseWebConfig.projectId.trim(),
    storageBucket: firebaseWebConfig.storageBucket.trim(),
    messagingSenderId: firebaseWebConfig.messagingSenderId.trim(),
    appId: firebaseWebConfig.appId.trim()
  }
  const [persistSuccess, persistError] = await safelyWriteJsonSnapshotToBrowserLocalStorageByKey(LOCAL_FIREBASE_WEB_CONFIG_STORAGE_KEY, payload)
  if (persistError) return [null, persistError]
  if (!persistSuccess) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('LOCAL_STORAGE', 'fallback localStorage write for firebase config did not return success flag', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  return [true, null]
}

let cachedFirebaseClientBundle = null

/**
 * Initializes Firebase app/auth/firestore from web config.
 * @param {{enabled: boolean, apiKey: string, authDomain: string, projectId: string, storageBucket: string, messagingSenderId: string, appId: string}} firebaseWebConfig
 * @returns {Promise<Result<{auth: import('firebase/auth').Auth, db: import('firebase/firestore').Firestore}>>}
 */
export async function initializeFirebaseClientsFromWebConfig(firebaseWebConfig) {
  if (!firebaseWebConfig || typeof firebaseWebConfig !== 'object' || Array.isArray(firebaseWebConfig)) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('VALIDATION', 'firebaseWebConfig must be an object', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  if (firebaseWebConfig.enabled !== true) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('VALIDATION', 'firebase sync is disabled', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  if (!firebaseWebConfig.apiKey || !firebaseWebConfig.authDomain || !firebaseWebConfig.projectId || !firebaseWebConfig.appId) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('VALIDATION', 'firebase config is missing required fields', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  if (cachedFirebaseClientBundle) return [cachedFirebaseClientBundle, null]

  const [firebaseModules, firebaseModulesError] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
    import('firebase/firestore')
  ])
    .then((moduleValues) => /** @type {Result<[any, any, any]>} */ ([/** @type {any} */ (moduleValues), null]))
    .catch((loadFailure) => {
      const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('NETWORK', 'failed to load firebase sdk modules', true, { loadFailure })
      if (createErrorFailure) return /** @type {Result<[any, any, any]>} */ ([null, createErrorFailure])
      return /** @type {Result<[any, any, any]>} */ ([null, errorValue])
    })
  if (firebaseModulesError) return [null, firebaseModulesError]
  if (!firebaseModules) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('VALIDATION', 'firebase module bundle is unexpectedly empty', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const [firebaseAppModule, firebaseAuthModule, firebaseFirestoreModule] = firebaseModules
  const appConfig = {
    apiKey: firebaseWebConfig.apiKey,
    authDomain: firebaseWebConfig.authDomain,
    projectId: firebaseWebConfig.projectId,
    storageBucket: firebaseWebConfig.storageBucket,
    messagingSenderId: firebaseWebConfig.messagingSenderId,
    appId: firebaseWebConfig.appId
  }
  const appInstance = firebaseAppModule.getApps().length > 0
    ? firebaseAppModule.getApp()
    : firebaseAppModule.initializeApp(appConfig)
  const auth = firebaseAuthModule.getAuth(appInstance)
  const db = firebaseFirestoreModule.getFirestore(appInstance)
  cachedFirebaseClientBundle = { auth, db }
  return [cachedFirebaseClientBundle, null]
}

/**
 * Starts Google sign-in popup for Firebase auth.
 * @param {{enabled: boolean, apiKey: string, authDomain: string, projectId: string, storageBucket: string, messagingSenderId: string, appId: string}} firebaseWebConfig
 * @returns {Promise<Result<{uid: string, email: string, displayName: string}>>}
 */
export async function signInToFirebaseWithGooglePopup(firebaseWebConfig) {
  const [clientBundle, clientBundleError] = await initializeFirebaseClientsFromWebConfig(firebaseWebConfig)
  if (clientBundleError) return [null, clientBundleError]
  if (!clientBundle) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('VALIDATION', 'firebase client bundle is unexpectedly empty', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const [firebaseAuthModule, firebaseAuthModuleError] = await import('firebase/auth')
    .then((moduleValue) => /** @type {Result<any>} */ ([moduleValue, null]))
    .catch((loadFailure) => {
      const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('NETWORK', 'failed to load firebase auth module for sign-in', true, { loadFailure })
      if (createErrorFailure) return /** @type {Result<any>} */ ([null, createErrorFailure])
      return /** @type {Result<any>} */ ([null, errorValue])
    })
  if (firebaseAuthModuleError) return [null, firebaseAuthModuleError]
  const provider = new firebaseAuthModule.GoogleAuthProvider()
  const [userCredential, signInError] = await firebaseAuthModule.signInWithPopup(clientBundle.auth, provider)
    .then((resultValue) => /** @type {Result<any>} */ ([resultValue, null]))
    .catch((popupFailure) => {
      const popupFailureCode = popupFailure && typeof popupFailure.code === 'string' ? popupFailure.code : ''
      const popupFailureMessage = popupFailure && typeof popupFailure.message === 'string' ? popupFailure.message : ''
      const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('AUTH', 'firebase google popup sign-in failed', true, { popupFailure, popupFailureCode, popupFailureMessage })
      if (createErrorFailure) return /** @type {Result<any>} */ ([null, createErrorFailure])
      return /** @type {Result<any>} */ ([null, errorValue])
    })
  if (signInError) return [null, signInError]
  const user = userCredential?.user
  if (!user) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('AUTH', 'firebase sign-in returned empty user', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  return [{
    uid: typeof user.uid === 'string' ? user.uid : '',
    email: typeof user.email === 'string' ? user.email : '',
    displayName: typeof user.displayName === 'string' ? user.displayName : ''
  }, null]
}

/**
 * Signs out Firebase authenticated session.
 * @param {{enabled: boolean, apiKey: string, authDomain: string, projectId: string, storageBucket: string, messagingSenderId: string, appId: string}} firebaseWebConfig
 * @returns {Promise<Result<true>>}
 */
export async function signOutFromFirebaseCurrentSession(firebaseWebConfig) {
  const [clientBundle, clientBundleError] = await initializeFirebaseClientsFromWebConfig(firebaseWebConfig)
  if (clientBundleError) return [null, clientBundleError]
  if (!clientBundle) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('VALIDATION', 'firebase client bundle is unexpectedly empty', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const [signOutSuccess, signOutError] = await Promise.resolve()
    .then(() => clientBundle.auth.signOut())
    .then(() => /** @type {Result<true>} */ ([true, null]))
    .catch((signOutFailure) => {
      const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('AUTH', 'firebase sign-out failed', true, { signOutFailure })
      if (createErrorFailure) return /** @type {Result<true>} */ ([null, createErrorFailure])
      return /** @type {Result<true>} */ ([null, errorValue])
    })
  if (signOutError) return [null, signOutError]
  return [signOutSuccess, null]
}

/**
 * Reads current Firebase auth user summary from client session.
 * @param {{enabled: boolean, apiKey: string, authDomain: string, projectId: string, storageBucket: string, messagingSenderId: string, appId: string}} firebaseWebConfig
 * @returns {Promise<Result<{uid: string, email: string, displayName: string}|null>>}
 */
export async function readFirebaseAuthenticatedUserSummary(firebaseWebConfig) {
  const [clientBundle, clientBundleError] = await initializeFirebaseClientsFromWebConfig(firebaseWebConfig)
  if (clientBundleError) return [null, clientBundleError]
  if (!clientBundle) return [null, null]
  const user = clientBundle.auth.currentUser
  if (!user) return [null, null]
  return [{
    uid: typeof user.uid === 'string' ? user.uid : '',
    email: typeof user.email === 'string' ? user.email : '',
    displayName: typeof user.displayName === 'string' ? user.displayName : ''
  }, null]
}

/**
 * Pushes complete financial profile into Firestore current + history nodes for authenticated user.
 * @param {{enabled: boolean, apiKey: string, authDomain: string, projectId: string, storageBucket: string, messagingSenderId: string, appId: string}} firebaseWebConfig
 * @param {Record<string, unknown>} budgetCollectionsState
 * @param {{themeName: 'light'|'dark', textScaleMultiplier: number, tableSortState?: Record<string, {key: string, direction: 'asc'|'desc'}>}} uiPreferences
 * @param {Array<Record<string, unknown>>} auditTimelineEntries
 * @returns {Promise<Result<{uid: string, savedAtIso: string}>>}
 */
export async function pushCompleteFinancialProfileIntoFirebaseForAuthenticatedUser(firebaseWebConfig, budgetCollectionsState, uiPreferences, auditTimelineEntries) {
  const [clientBundle, clientBundleError] = await initializeFirebaseClientsFromWebConfig(firebaseWebConfig)
  if (clientBundleError) return [null, clientBundleError]
  if (!clientBundle) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('VALIDATION', 'firebase client bundle is unexpectedly empty', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const authUser = clientBundle.auth.currentUser
  if (!authUser || typeof authUser.uid !== 'string' || authUser.uid.length === 0) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('AUTH', 'firebase user must be signed in before sync', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const [profileJsonText, profileJsonTextError] = await exportCompleteFinancialProfileAsJsonTextSnapshot(budgetCollectionsState, uiPreferences, auditTimelineEntries)
  if (profileJsonTextError) return [null, profileJsonTextError]
  if (!profileJsonText) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('VALIDATION', 'profile json text is unexpectedly empty before firebase push', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const [profilePayload, profilePayloadError] = await safelyParseJsonTextIntoObjectUsingPromiseBoundary(profileJsonText)
  if (profilePayloadError) return [null, profilePayloadError]
  if (!profilePayload || Array.isArray(profilePayload) || typeof profilePayload !== 'object') {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('VALIDATION', 'profile payload is malformed before firebase push', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const [firebaseFirestoreModule, firebaseFirestoreModuleError] = await import('firebase/firestore')
    .then((moduleValue) => /** @type {Result<any>} */ ([moduleValue, null]))
    .catch((loadFailure) => {
      const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('NETWORK', 'failed to load firestore module for push', true, { loadFailure })
      if (createErrorFailure) return /** @type {Result<any>} */ ([null, createErrorFailure])
      return /** @type {Result<any>} */ ([null, errorValue])
    })
  if (firebaseFirestoreModuleError) return [null, firebaseFirestoreModuleError]
  const savedAtIso = new Date().toISOString()
  const currentRef = firebaseFirestoreModule.doc(clientBundle.db, 'users', authUser.uid, 'profile', 'current')
  const historyCollectionRef = firebaseFirestoreModule.collection(clientBundle.db, 'users', authUser.uid, 'profile_history')
  const [writeSuccess, writeError] = await Promise.resolve()
    .then(() => firebaseFirestoreModule.setDoc(currentRef, { profilePayload, savedAtIso }, { merge: true }))
    .then(() => firebaseFirestoreModule.addDoc(historyCollectionRef, { profilePayload, savedAtIso }))
    .then(() => /** @type {Result<true>} */ ([true, null]))
    .catch((writeFailure) => {
      const writeFailureCode = writeFailure && typeof writeFailure.code === 'string' ? writeFailure.code : ''
      const writeFailureMessage = writeFailure && typeof writeFailure.message === 'string' ? writeFailure.message : ''
      const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('NETWORK', 'failed to write profile into firebase firestore', true, { writeFailure, writeFailureCode, writeFailureMessage })
      if (createErrorFailure) return /** @type {Result<true>} */ ([null, createErrorFailure])
      return /** @type {Result<true>} */ ([null, errorValue])
    })
  if (writeError) return [null, writeError]
  if (!writeSuccess) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('NETWORK', 'firebase firestore write returned empty success flag', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  return [{ uid: authUser.uid, savedAtIso }, null]
}

/**
 * Pulls complete financial profile from Firestore for authenticated user.
 * @param {{enabled: boolean, apiKey: string, authDomain: string, projectId: string, storageBucket: string, messagingSenderId: string, appId: string}} firebaseWebConfig
 * @returns {Promise<Result<{collections: Record<string, unknown>, uiPreferences: {themeName: 'light'|'dark', textScaleMultiplier: number, tableSortState?: Record<string, {key: string, direction: 'asc'|'desc'}>}|null, auditTimelineEntries: Array<Record<string, unknown>>}>>}
 */
export async function pullCompleteFinancialProfileFromFirebaseForAuthenticatedUser(firebaseWebConfig) {
  const [clientBundle, clientBundleError] = await initializeFirebaseClientsFromWebConfig(firebaseWebConfig)
  if (clientBundleError) return [null, clientBundleError]
  if (!clientBundle) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('VALIDATION', 'firebase client bundle is unexpectedly empty', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const authUser = clientBundle.auth.currentUser
  if (!authUser || typeof authUser.uid !== 'string' || authUser.uid.length === 0) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('AUTH', 'firebase user must be signed in before pull', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const [firebaseFirestoreModule, firebaseFirestoreModuleError] = await import('firebase/firestore')
    .then((moduleValue) => /** @type {Result<any>} */ ([moduleValue, null]))
    .catch((loadFailure) => {
      const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('NETWORK', 'failed to load firestore module for pull', true, { loadFailure })
      if (createErrorFailure) return /** @type {Result<any>} */ ([null, createErrorFailure])
      return /** @type {Result<any>} */ ([null, errorValue])
    })
  if (firebaseFirestoreModuleError) return [null, firebaseFirestoreModuleError]
  const currentRef = firebaseFirestoreModule.doc(clientBundle.db, 'users', authUser.uid, 'profile', 'current')
  const [docSnapshot, docSnapshotError] = await firebaseFirestoreModule.getDoc(currentRef)
    .then((snapshotValue) => /** @type {Result<any>} */ ([snapshotValue, null]))
    .catch((readFailure) => {
      const readFailureCode = readFailure && typeof readFailure.code === 'string' ? readFailure.code : ''
      const readFailureMessage = readFailure && typeof readFailure.message === 'string' ? readFailure.message : ''
      const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('NETWORK', 'failed to read profile from firebase firestore', true, { readFailure, readFailureCode, readFailureMessage })
      if (createErrorFailure) return /** @type {Result<any>} */ ([null, createErrorFailure])
      return /** @type {Result<any>} */ ([null, errorValue])
    })
  if (docSnapshotError) return [null, docSnapshotError]
  if (!docSnapshot || !docSnapshot.exists()) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('NOT_FOUND', 'no firebase profile snapshot exists for this user', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const docData = docSnapshot.data()
  const profilePayload = docData?.profilePayload
  if (!profilePayload || typeof profilePayload !== 'object' || Array.isArray(profilePayload)) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('VALIDATION', 'firebase profile payload is malformed', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const [profileJsonText, profileJsonTextError] = await safelyStringifyObjectIntoJsonTextUsingPromiseBoundary(profilePayload)
  if (profileJsonTextError) return [null, profileJsonTextError]
  if (!profileJsonText) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('VALIDATION', 'firebase profile json is unexpectedly empty', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  return importCompleteFinancialProfileFromJsonTextSnapshot(profileJsonText)
}

/**
 * Loads Supabase web config from localStorage cache.
 * Returns defaults when cache is missing.
 * @returns {Promise<Result<{enabled: boolean, supabaseUrl: string, supabaseAnonKey: string, email: string, otpPendingEmail: string, otpRequestedAtIso: string}>>}
 */
export async function loadSupabaseWebConfigFromLocalStorageCache() {
  const [cachedValue, cachedValueError] = await safelyReadJsonSnapshotFromBrowserLocalStorageByKey(LOCAL_SUPABASE_WEB_CONFIG_STORAGE_KEY)
  if (cachedValueError) return [null, cachedValueError]
  if (cachedValue === null) {
    return [{ enabled: false, supabaseUrl: '', supabaseAnonKey: '', email: '', otpPendingEmail: '', otpRequestedAtIso: '' }, null]
  }
  if (Array.isArray(cachedValue) || typeof cachedValue !== 'object') {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('VALIDATION', 'cached supabase config must be an object', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  return [{
    enabled: cachedValue.enabled === true,
    supabaseUrl: typeof cachedValue.supabaseUrl === 'string' ? cachedValue.supabaseUrl : '',
    supabaseAnonKey: typeof cachedValue.supabaseAnonKey === 'string' ? cachedValue.supabaseAnonKey : '',
    email: typeof cachedValue.email === 'string' ? cachedValue.email : '',
    otpPendingEmail: typeof cachedValue.otpPendingEmail === 'string' ? cachedValue.otpPendingEmail : '',
    otpRequestedAtIso: typeof cachedValue.otpRequestedAtIso === 'string' ? cachedValue.otpRequestedAtIso : ''
  }, null]
}

/**
 * Persists Supabase web config into localStorage cache.
 * @param {{enabled: boolean, supabaseUrl: string, supabaseAnonKey: string, email?: string, otpPendingEmail?: string, otpRequestedAtIso?: string}} supabaseWebConfig
 * @returns {Promise<Result<true>>}
 */
export async function persistSupabaseWebConfigIntoLocalStorageCache(supabaseWebConfig) {
  if (!supabaseWebConfig || typeof supabaseWebConfig !== 'object' || Array.isArray(supabaseWebConfig)) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('VALIDATION', 'supabase web config must be an object', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  if (typeof supabaseWebConfig.enabled !== 'boolean') {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('VALIDATION', 'supabase enabled must be boolean', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  if (typeof supabaseWebConfig.supabaseUrl !== 'string' || typeof supabaseWebConfig.supabaseAnonKey !== 'string') {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('VALIDATION', 'supabase url and anon key must be strings', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const payload = {
    enabled: supabaseWebConfig.enabled,
    supabaseUrl: supabaseWebConfig.supabaseUrl.trim(),
    supabaseAnonKey: supabaseWebConfig.supabaseAnonKey.trim(),
    email: typeof supabaseWebConfig.email === 'string' ? supabaseWebConfig.email.trim() : '',
    otpPendingEmail: typeof supabaseWebConfig.otpPendingEmail === 'string' ? supabaseWebConfig.otpPendingEmail.trim() : '',
    otpRequestedAtIso: typeof supabaseWebConfig.otpRequestedAtIso === 'string' ? supabaseWebConfig.otpRequestedAtIso.trim() : ''
  }
  const [persistSuccess, persistError] = await safelyWriteJsonSnapshotToBrowserLocalStorageByKey(LOCAL_SUPABASE_WEB_CONFIG_STORAGE_KEY, payload)
  if (persistError) return [null, persistError]
  if (!persistSuccess) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('LOCAL_STORAGE', 'fallback localStorage write for supabase config did not return success flag', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  return [true, null]
}

let cachedSupabaseClientBundle = null

/**
 * Initializes Supabase client from web config.
 * @param {{enabled: boolean, supabaseUrl: string, supabaseAnonKey: string}} supabaseWebConfig
 * @returns {Promise<Result<{client: import('@supabase/supabase-js').SupabaseClient}>>}
 */
export async function initializeSupabaseClientFromWebConfig(supabaseWebConfig) {
  if (!supabaseWebConfig || typeof supabaseWebConfig !== 'object' || Array.isArray(supabaseWebConfig)) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('VALIDATION', 'supabaseWebConfig must be an object', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  if (supabaseWebConfig.enabled !== true) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('VALIDATION', 'supabase sync is disabled', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  if (!supabaseWebConfig.supabaseUrl || !supabaseWebConfig.supabaseAnonKey) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('VALIDATION', 'supabase config is missing required fields', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  if (cachedSupabaseClientBundle) return [cachedSupabaseClientBundle, null]
  const [supabaseModule, supabaseModuleError] = await import('@supabase/supabase-js')
    .then((moduleValue) => /** @type {Result<any>} */ ([moduleValue, null]))
    .catch((loadFailure) => {
      const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('NETWORK', 'failed to load supabase sdk module', true, { loadFailure })
      if (createErrorFailure) return /** @type {Result<any>} */ ([null, createErrorFailure])
      return /** @type {Result<any>} */ ([null, errorValue])
    })
  if (supabaseModuleError) return [null, supabaseModuleError]
  if (!supabaseModule || typeof supabaseModule.createClient !== 'function') {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('VALIDATION', 'supabase module is unexpectedly empty', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const client = supabaseModule.createClient(supabaseWebConfig.supabaseUrl, supabaseWebConfig.supabaseAnonKey)
  cachedSupabaseClientBundle = { client }
  return [cachedSupabaseClientBundle, null]
}

/**
 * Starts Supabase email OTP sign-in by requesting an email code.
 * @param {{enabled: boolean, supabaseUrl: string, supabaseAnonKey: string}} supabaseWebConfig
 * @param {string} emailAddress
 * @returns {Promise<Result<true>>}
 */
export async function startSupabaseEmailOtpSignInWithRedirect(supabaseWebConfig, emailAddress) {
  const [clientBundle, clientBundleError] = await initializeSupabaseClientFromWebConfig(supabaseWebConfig)
  if (clientBundleError) return [null, clientBundleError]
  if (!clientBundle) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('VALIDATION', 'supabase client bundle is unexpectedly empty', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const normalizedEmailAddress = typeof emailAddress === 'string' ? emailAddress.trim() : ''
  if (!normalizedEmailAddress || !normalizedEmailAddress.includes('@')) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('VALIDATION', 'email is required for supabase magic link sign-in', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const [signInData, signInError] = await clientBundle.client.auth.signInWithOtp({
    email: normalizedEmailAddress
  }).then((value) => /** @type {Result<any>} */ ([value, null]))
    .catch((otpFailure) => {
      const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('AUTH', 'supabase email otp sign-in start failed', true, { otpFailure })
      if (createErrorFailure) return /** @type {Result<any>} */ ([null, createErrorFailure])
      return /** @type {Result<any>} */ ([null, errorValue])
    })
  if (signInError) return [null, signInError]
  if (signInData && signInData.error) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('AUTH', 'supabase email otp sign-in returned error', true, { otpError: signInData.error })
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  return [true, null]
}

/**
 * Verifies Supabase email OTP code to create session.
 * @param {{enabled: boolean, supabaseUrl: string, supabaseAnonKey: string}} supabaseWebConfig
 * @param {string} emailAddress
 * @param {string} oneTimeCode
 * @returns {Promise<Result<{id: string, email: string}>>}
 */
export async function verifySupabaseEmailOtpCodeAndCreateSession(supabaseWebConfig, emailAddress, oneTimeCode) {
  const [clientBundle, clientBundleError] = await initializeSupabaseClientFromWebConfig(supabaseWebConfig)
  if (clientBundleError) return [null, clientBundleError]
  if (!clientBundle) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('VALIDATION', 'supabase client bundle is unexpectedly empty', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const normalizedEmailAddress = typeof emailAddress === 'string' ? emailAddress.trim() : ''
  const normalizedOneTimeCode = typeof oneTimeCode === 'string' ? oneTimeCode.trim() : ''
  if (!normalizedEmailAddress || !normalizedEmailAddress.includes('@')) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('VALIDATION', 'email is required to verify supabase otp', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  if (!normalizedOneTimeCode) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('VALIDATION', 'otp code is required', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const [verifyResult, verifyError] = await clientBundle.client.auth.verifyOtp({
    email: normalizedEmailAddress,
    token: normalizedOneTimeCode,
    type: 'email'
  }).then((value) => /** @type {Result<any>} */ ([value, null]))
    .catch((otpVerificationFailure) => {
      const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('AUTH', 'supabase otp verification failed', true, { otpVerificationFailure })
      if (createErrorFailure) return /** @type {Result<any>} */ ([null, createErrorFailure])
      return /** @type {Result<any>} */ ([null, errorValue])
    })
  if (verifyError) return [null, verifyError]
  if (verifyResult && verifyResult.error) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('AUTH', 'supabase otp verification returned error', true, { otpVerificationError: verifyResult.error })
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const user = verifyResult?.data?.user
  if (!user || typeof user.id !== 'string') {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('AUTH', 'supabase otp verification completed without a user session', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  return [{ id: user.id, email: typeof user.email === 'string' ? user.email : '' }, null]
}

/**
 * Reads current Supabase auth user summary from client session.
 * @param {{enabled: boolean, supabaseUrl: string, supabaseAnonKey: string}} supabaseWebConfig
 * @returns {Promise<Result<{id: string, email: string}|null>>}
 */
export async function readSupabaseAuthenticatedUserSummary(supabaseWebConfig) {
  const [clientBundle, clientBundleError] = await initializeSupabaseClientFromWebConfig(supabaseWebConfig)
  if (clientBundleError) return [null, clientBundleError]
  if (!clientBundle) return [null, null]
  const [userResult, userError] = await clientBundle.client.auth.getUser()
    .then((value) => /** @type {Result<any>} */ ([value, null]))
    .catch((readFailure) => {
      const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('AUTH', 'failed to read supabase authenticated user', true, { readFailure })
      if (createErrorFailure) return /** @type {Result<any>} */ ([null, createErrorFailure])
      return /** @type {Result<any>} */ ([null, errorValue])
    })
  if (userError) return [null, userError]
  const user = userResult?.data?.user
  if (!user) return [null, null]
  return [{
    id: typeof user.id === 'string' ? user.id : '',
    email: typeof user.email === 'string' ? user.email : ''
  }, null]
}

/**
 * Signs out current Supabase session.
 * @param {{enabled: boolean, supabaseUrl: string, supabaseAnonKey: string}} supabaseWebConfig
 * @returns {Promise<Result<true>>}
 */
export async function signOutFromSupabaseCurrentSession(supabaseWebConfig) {
  const [clientBundle, clientBundleError] = await initializeSupabaseClientFromWebConfig(supabaseWebConfig)
  if (clientBundleError) return [null, clientBundleError]
  if (!clientBundle) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('VALIDATION', 'supabase client bundle is unexpectedly empty', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const [signOutResult, signOutError] = await clientBundle.client.auth.signOut()
    .then((value) => /** @type {Result<any>} */ ([value, null]))
    .catch((signOutFailure) => {
      const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('AUTH', 'supabase sign-out failed', true, { signOutFailure })
      if (createErrorFailure) return /** @type {Result<any>} */ ([null, createErrorFailure])
      return /** @type {Result<any>} */ ([null, errorValue])
    })
  if (signOutError) return [null, signOutError]
  if (signOutResult && signOutResult.error) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('AUTH', 'supabase sign-out returned error', true, { signOutError: signOutResult.error })
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  return [true, null]
}

/**
 * Pushes complete financial profile into Supabase current + history tables for authenticated user.
 * @param {{enabled: boolean, supabaseUrl: string, supabaseAnonKey: string}} supabaseWebConfig
 * @param {Record<string, unknown>} budgetCollectionsState
 * @param {{themeName: 'light'|'dark', textScaleMultiplier: number, tableSortState?: Record<string, {key: string, direction: 'asc'|'desc'}>}} uiPreferences
 * @param {Array<Record<string, unknown>>} auditTimelineEntries
 * @returns {Promise<Result<{userId: string, savedAtIso: string}>>}
 */
export async function pushCompleteFinancialProfileIntoSupabaseForAuthenticatedUser(supabaseWebConfig, budgetCollectionsState, uiPreferences, auditTimelineEntries) {
  const [clientBundle, clientBundleError] = await initializeSupabaseClientFromWebConfig(supabaseWebConfig)
  if (clientBundleError) return [null, clientBundleError]
  if (!clientBundle) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('VALIDATION', 'supabase client bundle is unexpectedly empty', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const [userSummary, userSummaryError] = await readSupabaseAuthenticatedUserSummary(supabaseWebConfig)
  if (userSummaryError) return [null, userSummaryError]
  if (!userSummary || !userSummary.id) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('AUTH', 'supabase user must be signed in before sync', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const [profileJsonText, profileJsonTextError] = await exportCompleteFinancialProfileAsJsonTextSnapshot(budgetCollectionsState, uiPreferences, auditTimelineEntries)
  if (profileJsonTextError) return [null, profileJsonTextError]
  if (!profileJsonText) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('VALIDATION', 'profile json text is unexpectedly empty before supabase push', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const [profilePayload, profilePayloadError] = await safelyParseJsonTextIntoObjectUsingPromiseBoundary(profileJsonText)
  if (profilePayloadError) return [null, profilePayloadError]
  if (!profilePayload || Array.isArray(profilePayload) || typeof profilePayload !== 'object') {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('VALIDATION', 'profile payload is malformed before supabase push', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const savedAtIso = new Date().toISOString()
  const [currentUpsertResult, currentUpsertError] = await clientBundle.client
    .from('profile_current')
    .upsert({ user_id: userSummary.id, profile_payload: profilePayload, saved_at_iso: savedAtIso }, { onConflict: 'user_id' })
    .select('user_id')
    .single()
    .then((value) => /** @type {Result<any>} */ ([value, null]))
    .catch((writeFailure) => {
      const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('NETWORK', 'failed to write profile_current in supabase', true, { writeFailure })
      if (createErrorFailure) return /** @type {Result<any>} */ ([null, createErrorFailure])
      return /** @type {Result<any>} */ ([null, errorValue])
    })
  if (currentUpsertError) return [null, currentUpsertError]
  if (currentUpsertResult && currentUpsertResult.error) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('NETWORK', 'supabase profile_current upsert returned error', true, { upsertError: currentUpsertResult.error })
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const [historyInsertResult, historyInsertError] = await clientBundle.client
    .from('profile_history')
    .insert({ user_id: userSummary.id, profile_payload: profilePayload, saved_at_iso: savedAtIso })
    .then((value) => /** @type {Result<any>} */ ([value, null]))
    .catch((insertFailure) => {
      const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('NETWORK', 'failed to write profile_history in supabase', true, { insertFailure })
      if (createErrorFailure) return /** @type {Result<any>} */ ([null, createErrorFailure])
      return /** @type {Result<any>} */ ([null, errorValue])
    })
  if (historyInsertError) return [null, historyInsertError]
  if (historyInsertResult && historyInsertResult.error) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('NETWORK', 'supabase profile_history insert returned error', true, { insertError: historyInsertResult.error })
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  return [{ userId: userSummary.id, savedAtIso }, null]
}

/**
 * Pulls complete financial profile from Supabase current table for authenticated user.
 * @param {{enabled: boolean, supabaseUrl: string, supabaseAnonKey: string}} supabaseWebConfig
 * @returns {Promise<Result<{collections: Record<string, unknown>, uiPreferences: {themeName: 'light'|'dark', textScaleMultiplier: number, tableSortState?: Record<string, {key: string, direction: 'asc'|'desc'}>}|null, auditTimelineEntries: Array<Record<string, unknown>>}>>}
 */
export async function pullCompleteFinancialProfileFromSupabaseForAuthenticatedUser(supabaseWebConfig) {
  const [clientBundle, clientBundleError] = await initializeSupabaseClientFromWebConfig(supabaseWebConfig)
  if (clientBundleError) return [null, clientBundleError]
  if (!clientBundle) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('VALIDATION', 'supabase client bundle is unexpectedly empty', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const [userSummary, userSummaryError] = await readSupabaseAuthenticatedUserSummary(supabaseWebConfig)
  if (userSummaryError) return [null, userSummaryError]
  if (!userSummary || !userSummary.id) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('AUTH', 'supabase user must be signed in before pull', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const [pullResult, pullError] = await clientBundle.client
    .from('profile_current')
    .select('profile_payload')
    .eq('user_id', userSummary.id)
    .single()
    .then((value) => /** @type {Result<any>} */ ([value, null]))
    .catch((readFailure) => {
      const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('NETWORK', 'failed to read profile_current from supabase', true, { readFailure })
      if (createErrorFailure) return /** @type {Result<any>} */ ([null, createErrorFailure])
      return /** @type {Result<any>} */ ([null, errorValue])
    })
  if (pullError) return [null, pullError]
  if (!pullResult || pullResult.error) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('NETWORK', 'supabase profile pull returned error', true, { pullError: pullResult?.error })
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const profilePayload = pullResult.data && typeof pullResult.data.profile_payload === 'object'
    ? pullResult.data.profile_payload
    : null
  if (!profilePayload) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('NOT_FOUND', 'no supabase profile snapshot exists for this user', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const [profileJsonText, profileJsonTextError] = await safelyStringifyObjectIntoJsonTextUsingPromiseBoundary(profilePayload)
  if (profileJsonTextError) return [null, profileJsonTextError]
  if (!profileJsonText) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext('VALIDATION', 'supabase profile json is unexpectedly empty', true)
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  return importCompleteFinancialProfileFromJsonTextSnapshot(profileJsonText)
}

const LOCAL_BUDGET_STATE_CACHE_STORAGE_KEY = 'budgeting-tool-local-state-v1'
const LOCAL_UI_PREFERENCES_CACHE_STORAGE_KEY = 'budgeting-tool-ui-preferences-v1'
const LOCAL_AUDIT_TIMELINE_CACHE_STORAGE_KEY = 'budgeting-tool-audit-timeline-v1'
const LOCAL_GOOGLE_SHEETS_SETTINGS_STORAGE_KEY = 'budgeting-tool-google-sheets-settings-v1'
const LOCAL_FIREBASE_WEB_CONFIG_STORAGE_KEY = 'budgeting-tool-firebase-web-config-v1'
const LOCAL_SUPABASE_WEB_CONFIG_STORAGE_KEY = 'budgeting-tool-supabase-web-config-v1'
const INDEXED_DB_DATABASE_NAME = 'budgeting-tool-indexeddb-v1'
const INDEXED_DB_OBJECT_STORE_NAME = 'app-cache'

/**
 * Opens the app IndexedDB database and ensures required object store exists.
 * Returns an error tuple when IndexedDB is unavailable or open request fails.
 * @returns {Promise<Result<IDBDatabase>>}
 */
export function openBudgetingIndexedDbDatabaseConnection() {
  if (typeof globalThis.indexedDB === 'undefined') {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'INDEXED_DB',
      'indexedDB is not available in this runtime',
      true
    )
    if (createErrorFailure) return Promise.resolve([null, createErrorFailure])
    return Promise.resolve([null, errorValue])
  }

  return new Promise((resolve) => {
    const openRequest = globalThis.indexedDB.open(INDEXED_DB_DATABASE_NAME, 1)
    openRequest.onupgradeneeded = () => {
      const database = openRequest.result
      if (!database.objectStoreNames.contains(INDEXED_DB_OBJECT_STORE_NAME)) {
        database.createObjectStore(INDEXED_DB_OBJECT_STORE_NAME)
      }
    }
    openRequest.onsuccess = () => resolve([openRequest.result, null])
    openRequest.onerror = () => {
      const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
        'INDEXED_DB',
        'failed to open indexedDB database',
        true,
        { error: openRequest.error }
      )
      if (createErrorFailure) {
        resolve([null, createErrorFailure])
        return
      }
      resolve([null, errorValue])
    }
  })
}

/**
 * Writes a value into IndexedDB object store by key.
 * Returns an error tuple when write fails.
 * @param {string} cacheKey
 * @param {unknown} cacheValue
 * @returns {Promise<Result<true>>}
 */
export async function safelyWriteValueIntoIndexedDbObjectStoreByKey(cacheKey, cacheValue) {
  const [databaseConnection, databaseConnectionError] = await openBudgetingIndexedDbDatabaseConnection()
  if (databaseConnectionError) return [null, databaseConnectionError]
  if (!databaseConnection) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'INDEXED_DB',
      'indexedDB connection is unexpectedly empty',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  return new Promise((resolve) => {
    const transaction = databaseConnection.transaction(INDEXED_DB_OBJECT_STORE_NAME, 'readwrite')
    const objectStore = transaction.objectStore(INDEXED_DB_OBJECT_STORE_NAME)
    const writeRequest = objectStore.put(cacheValue, cacheKey)
    writeRequest.onsuccess = () => {
      databaseConnection.close()
      resolve([true, null])
    }
    writeRequest.onerror = () => {
      databaseConnection.close()
      const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
        'INDEXED_DB',
        'failed to write value into indexedDB object store',
        true,
        { cacheKey, error: writeRequest.error }
      )
      if (createErrorFailure) {
        resolve([null, createErrorFailure])
        return
      }
      resolve([null, errorValue])
    }
  })
}

/**
 * Reads a value from IndexedDB object store by key.
 * Returns null when no value exists for the key.
 * @param {string} cacheKey
 * @returns {Promise<Result<unknown|null>>}
 */
export async function safelyReadValueFromIndexedDbObjectStoreByKey(cacheKey) {
  const [databaseConnection, databaseConnectionError] = await openBudgetingIndexedDbDatabaseConnection()
  if (databaseConnectionError) return [null, databaseConnectionError]
  if (!databaseConnection) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'INDEXED_DB',
      'indexedDB connection is unexpectedly empty',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  return new Promise((resolve) => {
    const transaction = databaseConnection.transaction(INDEXED_DB_OBJECT_STORE_NAME, 'readonly')
    const objectStore = transaction.objectStore(INDEXED_DB_OBJECT_STORE_NAME)
    const readRequest = objectStore.get(cacheKey)
    readRequest.onsuccess = () => {
      databaseConnection.close()
      resolve([readRequest.result ?? null, null])
    }
    readRequest.onerror = () => {
      databaseConnection.close()
      const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
        'INDEXED_DB',
        'failed to read value from indexedDB object store',
        true,
        { cacheKey, error: readRequest.error }
      )
      if (createErrorFailure) {
        resolve([null, createErrorFailure])
        return
      }
      resolve([null, errorValue])
    }
  })
}

/**
 * Persists full budgeting collections state into localStorage cache using tuple boundaries.
 * Returns an error when state shape is invalid or localStorage write fails.
 * @param {Record<string, unknown>} budgetCollectionsState
 * @returns {Promise<Result<true>>}
 */
export async function persistBudgetCollectionsStateIntoLocalStorageCache(budgetCollectionsState) {
  if (!budgetCollectionsState || typeof budgetCollectionsState !== 'object') {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'VALIDATION',
      'budgetCollectionsState must be an object',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  if (!Array.isArray(budgetCollectionsState.income) || !Array.isArray(budgetCollectionsState.expenses)) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'VALIDATION',
      'budgetCollectionsState must include income and expenses arrays',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const [indexedDbWriteSuccessValue, indexedDbWriteError] = await safelyWriteValueIntoIndexedDbObjectStoreByKey(
    LOCAL_BUDGET_STATE_CACHE_STORAGE_KEY,
    budgetCollectionsState
  )
  if (!indexedDbWriteError && indexedDbWriteSuccessValue === true) return [true, null]

  // Critical path: fallback keeps app writable in runtimes without IndexedDB.
  const [writeSuccessValue, writeError] = await safelyWriteJsonSnapshotToBrowserLocalStorageByKey(
    LOCAL_BUDGET_STATE_CACHE_STORAGE_KEY,
    budgetCollectionsState
  )
  if (writeError) return [null, indexedDbWriteError ?? writeError]
  if (writeSuccessValue !== true) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'LOCAL_STORAGE',
      'fallback localStorage write did not return success flag',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  return [true, null]
}

/**
 * Loads budgeting collections state from localStorage cache using tuple boundaries.
 * Returns an error when cache shape is invalid or localStorage read/parsing fails.
 * @returns {Promise<Result<Record<string, unknown>|null>>}
 */
export async function loadBudgetCollectionsStateFromLocalStorageCache() {
  const [cachedSnapshotValueFromIndexedDb, indexedDbReadError] = await safelyReadValueFromIndexedDbObjectStoreByKey(
    LOCAL_BUDGET_STATE_CACHE_STORAGE_KEY
  )
  let cachedSnapshotValue = cachedSnapshotValueFromIndexedDb
  if (indexedDbReadError) {
    const [cachedSnapshotValueFromLocalStorage, readError] = await safelyReadJsonSnapshotFromBrowserLocalStorageByKey(
      LOCAL_BUDGET_STATE_CACHE_STORAGE_KEY
    )
    if (readError) return [null, indexedDbReadError]
    cachedSnapshotValue = cachedSnapshotValueFromLocalStorage
  }

  if (cachedSnapshotValue === null) return [null, null]

  // Critical path: malformed cached payload should hard-fail instead of silently mutating shape assumptions.
  if (Array.isArray(cachedSnapshotValue) || typeof cachedSnapshotValue !== 'object') {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'VALIDATION',
      'cached budgeting state must be an object',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  if (!Array.isArray(cachedSnapshotValue.income) || !Array.isArray(cachedSnapshotValue.expenses)) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'VALIDATION',
      'cached budgeting state is missing income or expenses arrays',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  return [cachedSnapshotValue, null]
}

/**
 * Reads the current timestamp in ISO-8601 format for persistence metadata.
 * Returns an error when runtime does not produce a valid date string.
 * @returns {Result<string>}
 */
export function readCurrentIsoTimestampForBudgetRecordUpdates() {
  const isoTimestamp = new Date().toISOString()
  if (typeof isoTimestamp !== 'string' || isoTimestamp.length === 0) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'TIME',
      'failed to produce ISO timestamp string',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  return [isoTimestamp, null]
}

/**
 * Persists UI preferences into localStorage for theme and text-size continuity.
 * Returns an error when preference shape is invalid or persistence fails.
 * @param {{themeName: 'light'|'dark', textScaleMultiplier: number, tableSortState?: Record<string, {key: string, direction: 'asc'|'desc'}>}} uiPreferences
 * @returns {Promise<Result<true>>}
 */
export async function persistUiPreferencesIntoLocalStorageCache(uiPreferences) {
  if (!uiPreferences || typeof uiPreferences !== 'object') {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'VALIDATION',
      'uiPreferences must be an object',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  if (uiPreferences.themeName !== 'light' && uiPreferences.themeName !== 'dark') {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'VALIDATION',
      'uiPreferences.themeName must be light or dark',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  if (typeof uiPreferences.textScaleMultiplier !== 'number' || !Number.isFinite(uiPreferences.textScaleMultiplier)) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'VALIDATION',
      'uiPreferences.textScaleMultiplier must be a finite number',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  if (uiPreferences.tableSortState !== undefined) {
    if (!uiPreferences.tableSortState || Array.isArray(uiPreferences.tableSortState) || typeof uiPreferences.tableSortState !== 'object') {
      const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
        'VALIDATION',
        'uiPreferences.tableSortState must be an object when provided',
        true
      )
      if (createErrorFailure) return [null, createErrorFailure]
      return [null, errorValue]
    }
  }

  const [indexedDbWriteSuccessValue, indexedDbWriteError] = await safelyWriteValueIntoIndexedDbObjectStoreByKey(
    LOCAL_UI_PREFERENCES_CACHE_STORAGE_KEY,
    uiPreferences
  )
  if (!indexedDbWriteError && indexedDbWriteSuccessValue === true) return [true, null]

  const [writeSuccessValue, writeError] = await safelyWriteJsonSnapshotToBrowserLocalStorageByKey(
    LOCAL_UI_PREFERENCES_CACHE_STORAGE_KEY,
    uiPreferences
  )
  if (writeError) return [null, indexedDbWriteError ?? writeError]
  if (writeSuccessValue !== true) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'LOCAL_STORAGE',
      'fallback localStorage write for ui preferences did not return success flag',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  return [true, null]
}

/**
 * Loads persisted UI preferences from localStorage and validates expected shape.
 * Returns null preference value when no cached settings exist.
 * @returns {Promise<Result<{themeName: 'light'|'dark', textScaleMultiplier: number, tableSortState?: Record<string, {key: string, direction: 'asc'|'desc'}>}|null>>}
 */
export async function loadUiPreferencesFromLocalStorageCache() {
  const [cachedPreferencesValueFromIndexedDb, indexedDbReadError] = await safelyReadValueFromIndexedDbObjectStoreByKey(
    LOCAL_UI_PREFERENCES_CACHE_STORAGE_KEY
  )
  let cachedPreferencesValue = cachedPreferencesValueFromIndexedDb
  if (indexedDbReadError) {
    const [cachedPreferencesValueFromLocalStorage, readError] = await safelyReadJsonSnapshotFromBrowserLocalStorageByKey(
      LOCAL_UI_PREFERENCES_CACHE_STORAGE_KEY
    )
    if (readError) return [null, indexedDbReadError]
    cachedPreferencesValue = cachedPreferencesValueFromLocalStorage
  }
  if (cachedPreferencesValue === null) return [null, null]

  // Critical path: preferences cache must retain strict shape before touching UI state.
  if (Array.isArray(cachedPreferencesValue) || typeof cachedPreferencesValue !== 'object') {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'VALIDATION',
      'cached ui preferences must be an object',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const themeName = cachedPreferencesValue.themeName
  const textScaleMultiplier = cachedPreferencesValue.textScaleMultiplier
  if ((themeName !== 'light' && themeName !== 'dark') || typeof textScaleMultiplier !== 'number') {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'VALIDATION',
      'cached ui preferences are malformed',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  const tableSortState = cachedPreferencesValue.tableSortState
  const hasValidTableSortState = tableSortState === undefined || (!!tableSortState && !Array.isArray(tableSortState) && typeof tableSortState === 'object')
  if (!hasValidTableSortState) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'VALIDATION',
      'cached ui preferences tableSortState is malformed',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  return [/** @type {{themeName: 'light'|'dark', textScaleMultiplier: number, tableSortState?: Record<string, {key: string, direction: 'asc'|'desc'}>}} */ ({ themeName, textScaleMultiplier, tableSortState }), null]
}

/**
 * Persists audit timeline entries for rollback history and trend baselines.
 * @param {Array<Record<string, unknown>>} auditTimelineEntries
 * @returns {Promise<Result<true>>}
 */
export async function persistAuditTimelineIntoLocalStorageCache(auditTimelineEntries) {
  if (!Array.isArray(auditTimelineEntries)) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'VALIDATION',
      'auditTimelineEntries must be an array',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const [indexedDbWriteSuccessValue, indexedDbWriteError] = await safelyWriteValueIntoIndexedDbObjectStoreByKey(
    LOCAL_AUDIT_TIMELINE_CACHE_STORAGE_KEY,
    auditTimelineEntries
  )
  if (!indexedDbWriteError && indexedDbWriteSuccessValue === true) return [true, null]

  const [writeSuccessValue, writeError] = await safelyWriteJsonSnapshotToBrowserLocalStorageByKey(
    LOCAL_AUDIT_TIMELINE_CACHE_STORAGE_KEY,
    auditTimelineEntries
  )
  if (writeError) return [null, indexedDbWriteError ?? writeError]
  if (writeSuccessValue !== true) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'LOCAL_STORAGE',
      'fallback localStorage write for audit timeline did not return success flag',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  return [true, null]
}

/**
 * Loads persisted audit timeline entries.
 * @returns {Promise<Result<Array<Record<string, unknown>>|null>>}
 */
export async function loadAuditTimelineFromLocalStorageCache() {
  const [cachedAuditValueFromIndexedDb, indexedDbReadError] = await safelyReadValueFromIndexedDbObjectStoreByKey(
    LOCAL_AUDIT_TIMELINE_CACHE_STORAGE_KEY
  )
  let cachedAuditValue = cachedAuditValueFromIndexedDb
  if (indexedDbReadError) {
    const [cachedAuditValueFromLocalStorage, readError] = await safelyReadJsonSnapshotFromBrowserLocalStorageByKey(
      LOCAL_AUDIT_TIMELINE_CACHE_STORAGE_KEY
    )
    if (readError) return [null, indexedDbReadError]
    cachedAuditValue = cachedAuditValueFromLocalStorage
  }
  if (cachedAuditValue === null) return [null, null]
  if (!Array.isArray(cachedAuditValue)) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'VALIDATION',
      'cached audit timeline must be an array',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  return [cachedAuditValue, null]
}

/**
 * Applies a theme name to the document body data attribute.
 * Returns an error when document body is unavailable.
 * @param {'light'|'dark'} themeName
 * @returns {Result<true>}
 */
export function applyThemeNameToDocumentBodyDataAttribute(themeName) {
  if (themeName !== 'light' && themeName !== 'dark') {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'VALIDATION',
      'themeName must be light or dark',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  // Critical path: document access must be guarded to keep SSR/tests safe.
  if (!globalThis.document || !globalThis.document.body) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'BROWSER_API',
      'document body is unavailable',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  globalThis.document.body.setAttribute('data-theme', themeName)
  return [true, null]
}

/**
 * Smoothly scrolls the viewport to the top.
 * Returns an error when window API is unavailable.
 * @returns {Result<true>}
 */
export function scrollViewportToTopWithSmoothBehavior() {
  // Critical path: keep this wrapper safe in test and server runtimes.
  if (!globalThis.window || typeof globalThis.window.scrollTo !== 'function') {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'BROWSER_API',
      'window scroll API is unavailable',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  globalThis.window.scrollTo({ top: 0, behavior: 'smooth' })
  return [true, null]
}

/**
 * Copies text into system clipboard using browser Clipboard API.
 * Returns an error when clipboard API is unavailable or write fails.
 * @param {string} textToCopy
 * @returns {Promise<Result<true>>}
 */
export async function copyTextToClipboardUsingBrowserApi(textToCopy) {
  if (typeof textToCopy !== 'string') {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'VALIDATION',
      'textToCopy must be a string',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  if (!globalThis.navigator || !globalThis.navigator.clipboard || typeof globalThis.navigator.clipboard.writeText !== 'function') {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'BROWSER_API',
      'clipboard write API is unavailable',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }
  const [writeSuccess, writeError] = await Promise.resolve()
    .then(() => globalThis.navigator.clipboard.writeText(textToCopy))
    .then(() => /** @type {Result<true>} */ ([true, null]))
    .catch((clipboardWriteFailure) => {
      const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
        'BROWSER_API',
        'failed to write clipboard text',
        true,
        { clipboardWriteFailure }
      )
      if (createErrorFailure) return /** @type {Result<true>} */ ([null, createErrorFailure])
      return /** @type {Result<true>} */ ([null, errorValue])
    })
  if (writeError || writeSuccess !== true) return [null, writeError]
  return [true, null]
}

/**
 * Applies global text scale to document root font-size so rem-based utility classes resize.
 * Returns an error when root element is unavailable or scale is invalid.
 * @param {number} textScaleMultiplier
 * @returns {Result<true>}
 */
export function applyGlobalTextScaleMultiplierToDocumentRoot(textScaleMultiplier) {
  if (typeof textScaleMultiplier !== 'number' || !Number.isFinite(textScaleMultiplier)) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'VALIDATION',
      'textScaleMultiplier must be a finite number',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  if (!globalThis.document || !globalThis.document.documentElement) {
    const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
      'BROWSER_API',
      'document root element is unavailable',
      true
    )
    if (createErrorFailure) return [null, createErrorFailure]
    return [null, errorValue]
  }

  globalThis.document.documentElement.style.fontSize = `${textScaleMultiplier * 100}%`
  return [true, null]
}

/**
 * Computes risk findings in a background worker when supported, with tuple-safe fallback.
 * Returns main-thread pure computation result when workers are unavailable.
 * @param {Record<string, unknown>} currentCollectionsState
 * @returns {Promise<Result<Array<{id: string, severity: 'high'|'medium'|'low', title: string, detail: string, metricValue: number}>>>}
 */
export async function computeFinancialRiskFindingsUsingBackgroundWorkerWhenAvailable(currentCollectionsState) {
  if (typeof globalThis.Worker === 'undefined') {
    console.info('[risk] Worker unavailable; running risk checks on main thread.')
    return extractFinancialRiskFindingsFromCurrentCollectionsState(/** @type {any} */ (currentCollectionsState))
  }

  return new Promise((resolve) => {
    let workerHandle
    try {
      workerHandle = new Worker(new URL('../workers/risk-worker.js', import.meta.url), { type: 'module' })
    } catch (workerConstructionFailure) {
      console.warn('[risk] Worker construction failed; falling back to main-thread risk checks.', workerConstructionFailure)
      const [fallbackValue, fallbackError] = extractFinancialRiskFindingsFromCurrentCollectionsState(/** @type {any} */ (currentCollectionsState))
      if (fallbackError) {
        resolve([null, fallbackError])
        return
      }
      if (!fallbackValue) {
        const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
          'WORKER',
          'worker fallback produced empty findings unexpectedly',
          true,
          { workerConstructionFailure }
        )
        if (createErrorFailure) {
          resolve([null, createErrorFailure])
          return
        }
        resolve([null, errorValue])
        return
      }
      resolve([fallbackValue, null])
      return
    }

    const cleanupAndResolve = (value, err) => {
      if (workerHandle) workerHandle.terminate()
      resolve([value, err])
    }

    workerHandle.onmessage = (messageEvent) => {
      const payload = messageEvent.data
      if (!payload || typeof payload !== 'object') {
        const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
          'WORKER',
          'worker returned malformed risk payload',
          true
        )
        if (createErrorFailure) {
          cleanupAndResolve(null, createErrorFailure)
          return
        }
        cleanupAndResolve(null, errorValue)
        return
      }

      if (payload.error) {
        const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
          'WORKER',
          'worker risk computation returned error',
          true,
          payload.error
        )
        if (createErrorFailure) {
          cleanupAndResolve(null, createErrorFailure)
          return
        }
        cleanupAndResolve(null, errorValue)
        return
      }

      cleanupAndResolve(Array.isArray(payload.findings) ? payload.findings : [], null)
    }

    workerHandle.onerror = (workerFailureEvent) => {
      // Critical path: worker failure must degrade to deterministic in-process pure computation.
      console.warn('[risk] Worker runtime error; falling back to main-thread risk checks.', workerFailureEvent)
      const [fallbackValue, fallbackError] = extractFinancialRiskFindingsFromCurrentCollectionsState(/** @type {any} */ (currentCollectionsState))
      if (fallbackError) {
        cleanupAndResolve(null, fallbackError)
        return
      }
      if (!fallbackValue) {
        const [errorValue, createErrorFailure] = createImpureLayerApplicationErrorWithContext(
          'WORKER',
          'worker failure fallback produced empty findings unexpectedly',
          true,
          { workerFailureEvent }
        )
        if (createErrorFailure) {
          cleanupAndResolve(null, createErrorFailure)
          return
        }
        cleanupAndResolve(null, errorValue)
        return
      }
      cleanupAndResolve(fallbackValue, null)
    }

    workerHandle.postMessage({ currentCollectionsState })
  })
}
