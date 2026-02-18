import { extractFinancialRiskFindingsFromCurrentCollectionsState } from '../core/pure.js'

globalThis.onmessage = (messageEvent) => {
  const payload = messageEvent.data
  if (!payload || typeof payload !== 'object') {
    globalThis.postMessage({ findings: [], error: { kind: 'VALIDATION', message: 'worker payload must be an object' } })
    return
  }

  const [findings, findingsError] = extractFinancialRiskFindingsFromCurrentCollectionsState(payload.currentCollectionsState)
  if (findingsError) {
    globalThis.postMessage({ findings: [], error: findingsError })
    return
  }

  globalThis.postMessage({ findings: findings ?? [], error: null })
}
