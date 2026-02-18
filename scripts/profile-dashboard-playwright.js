import { chromium } from 'playwright'

const TARGET_URL = process.env.PROFILE_URL || 'http://127.0.0.1:4000'

/**
 * @param {import('playwright').Page} page
 * @returns {Promise<Record<string, number|null>>}
 */
async function readNavigationAndPaintMetrics(page) {
  return page.evaluate(() => {
    const navigationEntry = performance.getEntriesByType('navigation')[0]
    const paintEntries = performance.getEntriesByType('paint')
    const firstContentfulPaint = paintEntries.find((entry) => entry.name === 'first-contentful-paint')
    return {
      domContentLoadedMs: navigationEntry ? navigationEntry.domContentLoadedEventEnd : null,
      loadEventMs: navigationEntry ? navigationEntry.loadEventEnd : null,
      firstContentfulPaintMs: firstContentfulPaint ? firstContentfulPaint.startTime : null
    }
  })
}

/**
 * @param {import('playwright').Page} page
 * @returns {Promise<Record<string, number>>}
 */
async function measureUiInteractionTimings(page) {
  const interactionTimes = {}
  const addRecordDialog = page.getByRole('dialog', { name: 'Add Income Or Expense Modal' })
  const addGoalDialog = page.getByRole('dialog', { name: 'Add Goal Modal' })

  const openRecordStart = Date.now()
  await page.getByRole('button', { name: '+ Record' }).click()
  await addRecordDialog.waitFor({ state: 'visible' })
  interactionTimes.openAddRecordModalMs = Date.now() - openRecordStart

  const closeRecordStart = Date.now()
  await addRecordDialog.getByRole('button', { name: /^Close$/ }).click()
  await addRecordDialog.waitFor({ state: 'hidden' })
  interactionTimes.closeAddRecordModalMs = Date.now() - closeRecordStart

  const openGoalStart = Date.now()
  await page.getByRole('button', { name: '+ Goal' }).first().click()
  await addGoalDialog.waitFor({ state: 'visible' })
  interactionTimes.openAddGoalModalMs = Date.now() - openGoalStart

  const closeGoalStart = Date.now()
  await addGoalDialog.getByRole('button', { name: /^Close$/ }).click()
  await addGoalDialog.waitFor({ state: 'hidden' })
  interactionTimes.closeAddGoalModalMs = Date.now() - closeGoalStart

  return interactionTimes
}

async function runProfile() {
  console.log('PROFILE_STEP:launch-browser')
  const browser = await chromium.launch({ headless: true })
  console.log('PROFILE_STEP:create-context')
  const context = await browser.newContext()
  console.log('PROFILE_STEP:create-page')
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  const cdpSession = await context.newCDPSession(page)
  const browserErrors = []

  page.on('pageerror', (error) => {
    browserErrors.push(`PAGE_ERROR: ${error.message}`)
  })
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`CONSOLE_ERROR: ${message.text()}`)
  })

  console.log('PROFILE_STEP:enable-performance')
  await cdpSession.send('Performance.enable')
  await context.tracing.start({ screenshots: true, snapshots: true })

  console.log('PROFILE_STEP:navigate')
  const navigationStart = Date.now()
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' })
  const pageReadyMs = Date.now() - navigationStart

  console.log('PROFILE_STEP:wait-root')
  await page.waitForSelector('#root')
  await page.waitForTimeout(1000)

  const hasMain = await page.locator('main').count()
  if (!hasMain) {
    await context.tracing.stop({ path: 'playwright-profile-trace.zip' })
    await browser.close()
    console.log(JSON.stringify({
      targetUrl: TARGET_URL,
      pageReadyMs,
      browserErrors,
      tracePath: 'playwright-profile-trace.zip',
      note: 'App did not render <main>; inspect browserErrors and trace.'
    }, null, 2))
    process.exit(1)
  }

  console.log('PROFILE_STEP:collect-metrics')
  const navAndPaintMetrics = await readNavigationAndPaintMetrics(page)
  console.log('PROFILE_STEP:interactions')
  const interactionTimes = await measureUiInteractionTimings(page)
  const cdpMetricsRaw = await cdpSession.send('Performance.getMetrics')

  await context.tracing.stop({ path: 'playwright-profile-trace.zip' })
  await browser.close()

  const cdpMetrics = {}
  for (const metricItem of cdpMetricsRaw.metrics) {
    if (metricItem.name === 'TaskDuration' || metricItem.name === 'ScriptDuration' || metricItem.name === 'JSHeapUsedSize') {
      cdpMetrics[metricItem.name] = metricItem.value
    }
  }

  console.log(JSON.stringify({
    targetUrl: TARGET_URL,
    pageReadyMs,
    navAndPaintMetrics,
    interactionTimes,
    cdpMetrics,
    browserErrors,
    tracePath: 'playwright-profile-trace.zip'
  }, null, 2))
}

const profileTimeoutPromise = new Promise((_, reject) => {
  setTimeout(() => reject(new Error('PROFILE_TIMEOUT_AFTER_90_SECONDS')), 90000)
})

Promise.race([runProfile(), profileTimeoutPromise]).catch((error) => {
  console.error('PROFILE_RUN_FAILED')
  console.error(error)
  process.exit(1)
})
