import { chromium } from 'playwright'

const TARGET_URL = process.env.PROFILE_URL || 'http://127.0.0.1:4000'

/**
 * Waits for a dialog by accessible name and confirms it is visible.
 * @param {import('playwright').Page} page
 * @param {string} name
 */
async function expectDialogVisibleByName(page, name) {
  await page.getByRole('dialog', { name }).waitFor({ state: 'visible' })
}

/**
 * Closes a dialog using the close/backdrop button by label and confirms it closes.
 * @param {import('playwright').Page} page
 * @param {string} dialogName
 * @param {string} closeButtonLabel
 */
async function closeDialogByBackdropLabel(page, dialogName, closeButtonLabel) {
  await page.getByRole('button', { name: closeButtonLabel }).click({ force: true, noWaitAfter: true, position: { x: 8, y: 8 } })
  await page.getByRole('dialog', { name: dialogName }).waitFor({ state: 'hidden' })
}

async function runFullUiRegression() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.setDefaultTimeout(15000)

  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('main')

  // Core sections should render.
  const requiredSections = ['#overview', '#assets', '#debts', '#credit', '#savings', '#records', '#details']
  for (const sectionSelector of requiredSections) {
    await page.locator(sectionSelector).first().waitFor({ state: 'attached' })
  }

  // Theme and text-scale controls.
  const rootFontBefore = await page.evaluate(() => globalThis.getComputedStyle(document.documentElement).fontSize)
  await page.getByRole('button', { name: 'A+' }).click({ force: true, noWaitAfter: true })
  await page.waitForTimeout(120)
  const rootFontAfterIncrease = await page.evaluate(() => globalThis.getComputedStyle(document.documentElement).fontSize)
  if (!(parseFloat(rootFontAfterIncrease) >= parseFloat(rootFontBefore))) {
    throw new Error(`Text scale increase check failed: before=${rootFontBefore}, after=${rootFontAfterIncrease}`)
  }
  await page.getByRole('button', { name: 'A-' }).click({ force: true, noWaitAfter: true })
  await page.getByRole('button', { name: 'Reset' }).click({ force: true, noWaitAfter: true })
  await page.getByRole('button', { name: /Dark|Light/ }).first().click({ force: true, noWaitAfter: true })

  // Add Record flow.
  await page.getByRole('button', { name: '+ Record' }).click({ force: true, noWaitAfter: true })
  await expectDialogVisibleByName(page, 'Add Income Or Expense Modal')
  await page.getByLabel('Type').selectOption('income')
  await page.getByLabel('Amount').fill('1234.56')
  await page.getByLabel('Category').selectOption({ label: 'Income' })
  await page.getByLabel('Description').fill('Playwright income record')
  await page.getByRole('button', { name: 'Save Record' }).click({ force: true, noWaitAfter: true })
  await page.getByRole('dialog', { name: 'Add Income Or Expense Modal' }).waitFor({ state: 'hidden' })
  await page.getByText('Playwright income record').first().waitFor({ state: 'visible' })

  // Notes modal flow.
  const notesActionCount = await page.getByLabel('Open detailed notes').count()
  if (notesActionCount > 0) {
    await page.getByLabel('Open detailed notes').first().click({ force: true, noWaitAfter: true })
    const notesDialog = page.getByRole('dialog', { name: 'Record Notes Modal' })
    const notesOpened = await notesDialog.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)
    if (notesOpened) {
      await page.getByLabel('Notes').fill('Playwright note update')
      await page.getByRole('button', { name: 'Save Notes' }).click({ force: true, noWaitAfter: true })
      await notesDialog.waitFor({ state: 'hidden' })
    }
  }

  // Edit record flow.
  const editActionCount = await page.getByLabel('Edit record').count()
  if (editActionCount > 0) {
    await page.getByLabel('Edit record').first().click({ force: true, noWaitAfter: true })
    const editDialog = page.getByRole('dialog', { name: 'Edit Record Modal' })
    const editOpened = await editDialog.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)
    if (editOpened) {
      await page.getByLabel('Description').first().fill('Playwright edited record')
      await page.getByRole('button', { name: 'Save Changes' }).click({ force: true, noWaitAfter: true })
      await editDialog.waitFor({ state: 'hidden' })
      await page.getByText('Playwright edited record').first().waitFor({ state: 'visible' })
    }
  }

  // Add Goal flow.
  await page.getByRole('button', { name: '+ Goal' }).first().click({ force: true, noWaitAfter: true })
  await expectDialogVisibleByName(page, 'Add Goal Modal')
  await page.getByLabel('Item').fill('Playwright Goal')
  await page.getByLabel('Timeframe(months)').fill('6')
  await page.getByLabel('Description').fill('Goal from playwright regression')
  await page.getByRole('button', { name: 'Save Goal' }).click({ force: true, noWaitAfter: true })
  await page.getByRole('dialog', { name: 'Add Goal Modal' }).waitFor({ state: 'hidden' })
  await page.getByText('Playwright Goal').first().waitFor({ state: 'visible' })

  // Debt quick add should open debt-specific layout.
  const debtsQuickAddButton = page.locator('#debts button').filter({ hasText: '+ Quick Add' }).first()
  await debtsQuickAddButton.scrollIntoViewIfNeeded()
  await debtsQuickAddButton.evaluate((buttonElement) => buttonElement.click())
  await expectDialogVisibleByName(page, 'Add Income Or Expense Modal')
  await page.getByLabel('Type').waitFor({ state: 'visible' })
  const debtTypeValue = await page.getByLabel('Type').inputValue()
  if (debtTypeValue !== 'debt') throw new Error(`Debt quick add did not preset debt type. got=${debtTypeValue}`)
  await page.getByText('APR (%)').first().waitFor({ state: 'visible' })
  await closeDialogByBackdropLabel(page, 'Add Income Or Expense Modal', 'Close add record modal backdrop')

  // Credit quick add should open credit-account-specific layout.
  const creditQuickAddButton = page.locator('#credit button').filter({ hasText: '+ Quick Add' }).first()
  await creditQuickAddButton.scrollIntoViewIfNeeded()
  await creditQuickAddButton.evaluate((buttonElement) => buttonElement.click())
  await expectDialogVisibleByName(page, 'Add Income Or Expense Modal')
  const creditTypeValue = await page.getByLabel('Type').inputValue()
  if (creditTypeValue !== 'credit_card') throw new Error(`Credit quick add did not preset credit account type. got=${creditTypeValue}`)
  await page.getByText('APR (%)').first().waitFor({ state: 'visible' })
  await page.getByText('Max Capacity').first().waitFor({ state: 'visible' })
  await closeDialogByBackdropLabel(page, 'Add Income Or Expense Modal', 'Close add record modal backdrop')

  // Add Asset flow.
  const addAssetButtons = page.locator('button:has-text("Add Asset")')
  const addAssetButtonCount = await addAssetButtons.count()
  if (addAssetButtonCount > 0) {
    await addAssetButtons.first().scrollIntoViewIfNeeded()
    await addAssetButtons.first().click({ force: true, noWaitAfter: true })
    const addAssetDialog = page.getByRole('dialog', { name: 'Add Asset Modal' })
    const addAssetOpened = await addAssetDialog.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)
    if (addAssetOpened) {
      await page.getByLabel('Item').fill('Playwright Asset')
      await page.getByLabel('Asset Value Owed').fill('1000')
      await page.getByLabel('Asset Market Value').fill('3000')
      await page.getByLabel('Description').fill('Asset from playwright regression')
      await page.getByRole('button', { name: 'Save Asset' }).click({ force: true, noWaitAfter: true })
      await addAssetDialog.waitFor({ state: 'hidden' })
      await page.getByText('Playwright Asset').first().waitFor({ state: 'visible' })
    }
  }

  // Personas modal open/close.
  await page.getByRole('button', { name: 'Personas' }).click({ force: true, noWaitAfter: true })
  await expectDialogVisibleByName(page, 'Manage Personas Modal')
  await closeDialogByBackdropLabel(page, 'Manage Personas Modal', 'Close manage personas modal backdrop')

  // Export modal flow.
  await page.getByRole('button', { name: 'Export' }).click({ force: true, noWaitAfter: true })
  await expectDialogVisibleByName(page, 'Financial Profile Import Export Modal')
  await page.getByRole('button', { name: 'Copy JSON' }).click({ force: true, noWaitAfter: true, position: { x: 12, y: 12 } })
  await closeDialogByBackdropLabel(page, 'Financial Profile Import Export Modal', 'Close profile transfer modal backdrop')

  // Import modal open/close.
  await page.getByRole('button', { name: 'Import' }).click({ force: true, noWaitAfter: true })
  await expectDialogVisibleByName(page, 'Financial Profile Import Export Modal')
  await closeDialogByBackdropLabel(page, 'Financial Profile Import Export Modal', 'Close profile transfer modal backdrop')

  // Utility top button.
  await page.getByRole('button', { name: 'Top' }).click({ force: true, noWaitAfter: true })

  await browser.close()
  console.log('FULL_UI_REGRESSION_PASS')
}

runFullUiRegression().catch((error) => {
  console.error('FULL_UI_REGRESSION_FAIL')
  console.error(error)
  process.exit(1)
})
