import { chromium } from 'playwright'

const TARGET_URL = process.env.PROFILE_URL || 'http://127.0.0.1:4000'

/**
 * @param {import('playwright').Page} page
 * @param {string} dialogName
 * @param {string} closeBackdropLabel
 */
async function closeDialog(page, dialogName, closeBackdropLabel) {
  await page.getByRole('button', { name: closeBackdropLabel }).first().click({ force: true, noWaitAfter: true, position: { x: 8, y: 8 } })
  await page.getByRole('dialog', { name: dialogName }).waitFor({ state: 'hidden' })
}

async function runManualExplicitUiAudit() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.setDefaultTimeout(12000)

  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('main')

  // Header/shell buttons.
  await page.getByRole('button', { name: /Dark|Light/ }).click({ force: true, noWaitAfter: true })
  await page.getByRole('button', { name: 'A+' }).click({ force: true, noWaitAfter: true })
  await page.getByRole('button', { name: 'A-' }).click({ force: true, noWaitAfter: true })
  await page.getByRole('button', { name: 'Reset' }).click({ force: true, noWaitAfter: true })
  await page.getByRole('button', { name: 'Top' }).click({ force: true, noWaitAfter: true })

  // Add Record modal + form.
  await page.getByRole('button', { name: '+ Record' }).first().evaluate((node) => node.click())
  await page.getByRole('dialog', { name: 'Add Income Or Expense Modal' }).waitFor({ state: 'visible' })
  await page.getByLabel('Type').selectOption('income')
  await page.getByLabel('Amount').fill('1000')
  await page.getByLabel('Category').selectOption({ label: 'Income' }).catch(async () => page.getByLabel('Category').selectOption({ index: 1 }))
  await page.getByLabel('Description').fill('Explicit audit record')
  await page.getByRole('button', { name: 'Save Record' }).click({ force: true, noWaitAfter: true })
  await page.getByRole('dialog', { name: 'Add Income Or Expense Modal' }).waitFor({ state: 'hidden' })

  // Debt quick add modal + debt fields.
  await page.locator('#debts button').filter({ hasText: '+ Quick Add' }).first().evaluate((node) => node.click())
  await page.getByRole('dialog', { name: 'Add Income Or Expense Modal' }).waitFor({ state: 'visible' })
  if ((await page.getByLabel('Type').inputValue()) !== 'debt') throw new Error('Debt quick add type mismatch')
  await page.getByText('APR (%)').first().waitFor({ state: 'visible' })
  await page.getByRole('button', { name: 'Cancel' }).click({ force: true, noWaitAfter: true })
  await page.getByRole('dialog', { name: 'Add Income Or Expense Modal' }).waitFor({ state: 'hidden' })

  // Credit quick add modal + credit fields.
  await page.locator('#credit button').filter({ hasText: '+ Quick Add' }).first().evaluate((node) => node.click())
  await page.getByRole('dialog', { name: 'Add Income Or Expense Modal' }).waitFor({ state: 'visible' })
  if ((await page.getByLabel('Type').inputValue()) !== 'credit_card') throw new Error('Credit quick add type mismatch')
  await page.getByText('Max Capacity').first().waitFor({ state: 'visible' })
  await page.getByText('APR (%)').first().waitFor({ state: 'visible' })
  await closeDialog(page, 'Add Income Or Expense Modal', 'Close add record modal backdrop')

  // Add Goal modal + form.
  await page.getByRole('button', { name: '+ Goal' }).first().evaluate((node) => node.click())
  await page.getByRole('dialog', { name: 'Add Goal Modal' }).waitFor({ state: 'visible' })
  await page.getByLabel('Item').fill('Explicit audit goal')
  await page.getByLabel('Timeframe(months)').fill('6')
  await page.getByLabel('Description').fill('Goal form explicit audit')
  await page.getByRole('button', { name: 'Save Goal' }).click({ force: true, noWaitAfter: true })
  await page.getByRole('dialog', { name: 'Add Goal Modal' }).waitFor({ state: 'hidden' })

  // Add Asset modal + form.
  await page.locator('#assets button').filter({ hasText: 'Add Asset' }).first().evaluate((node) => node.click())
  await page.getByRole('dialog', { name: 'Add Asset Modal' }).waitFor({ state: 'visible' })
  await page.getByLabel('Item').fill('Explicit audit asset')
  await page.getByLabel('Asset Value Owed').fill('1000')
  await page.getByLabel('Asset Market Value').fill('3000')
  await page.getByLabel('Description').fill('Asset form explicit audit')
  await page.getByRole('button', { name: 'Save Asset' }).click({ force: true, noWaitAfter: true })
  await page.getByRole('dialog', { name: 'Add Asset Modal' }).waitFor({ state: 'hidden' })

  // Personas modal buttons/forms.
  await page.getByRole('button', { name: 'Personas' }).evaluate((node) => node.click())
  await page.getByRole('dialog', { name: 'Manage Personas Modal' }).waitFor({ state: 'visible' })
  await page.getByRole('button', { name: 'Create Persona' }).click({ trial: true })
  await closeDialog(page, 'Manage Personas Modal', 'Close manage personas modal backdrop')

  // Import/export modal buttons/forms.
  await page.getByRole('button', { name: 'Export' }).evaluate((node) => node.click())
  await page.getByRole('dialog', { name: 'Financial Profile Import Export Modal' }).waitFor({ state: 'visible' })
  await page.getByRole('button', { name: 'Copy JSON' }).click({ force: true, noWaitAfter: true, position: { x: 12, y: 12 } })
  const deleteLocalDataButtonVisible = await page.getByRole('button', { name: 'Delete Local Data' }).isVisible()
  if (!deleteLocalDataButtonVisible) throw new Error('Delete Local Data button is not visible in export mode.')
  await closeDialog(page, 'Financial Profile Import Export Modal', 'Close profile transfer modal backdrop')

  await page.getByRole('button', { name: 'Import' }).evaluate((node) => node.click())
  await page.getByRole('dialog', { name: 'Financial Profile Import Export Modal' }).waitFor({ state: 'visible' })
  const importProfileButtonVisible = await page.getByRole('button', { name: 'Import Profile' }).isVisible()
  if (!importProfileButtonVisible) throw new Error('Import Profile button is not visible in import mode.')
  await closeDialog(page, 'Financial Profile Import Export Modal', 'Close profile transfer modal backdrop')

  // Optional action buttons (record rows).
  const notesCount = await page.getByLabel('Open detailed notes').count()
  if (notesCount > 0) {
    await page.getByLabel('Open detailed notes').first().evaluate((node) => node.click())
    const notesDialog = page.getByRole('dialog', { name: 'Record Notes Modal' })
    const opened = await notesDialog.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)
    if (opened) {
      await page.getByRole('textbox', { name: 'Notes' }).fill('Explicit notes audit')
      await page.getByRole('button', { name: 'Save Notes' }).click({ force: true, noWaitAfter: true })
      await notesDialog.waitFor({ state: 'hidden' })
    }
  }

  const editCount = await page.getByLabel('Edit record').count()
  if (editCount > 0) {
    await page.getByLabel('Edit record').first().evaluate((node) => node.click())
    const editDialog = page.getByRole('dialog', { name: 'Edit Record Modal' })
    const opened = await editDialog.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)
    if (opened) {
      await page.getByRole('button', { name: 'Save Changes' }).click({ trial: true })
      await closeDialog(page, 'Edit Record Modal', 'Close edit record modal backdrop')
    }
  }

  await browser.close()
  console.log('MANUAL_EXPLICIT_UI_AUDIT_PASS')
}

runManualExplicitUiAudit().catch((error) => {
  console.error('MANUAL_EXPLICIT_UI_AUDIT_FAIL')
  console.error(error)
  process.exit(1)
})
