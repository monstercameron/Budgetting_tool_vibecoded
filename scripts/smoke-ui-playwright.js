import { chromium } from 'playwright'

const TARGET_URL = process.env.PROFILE_URL || 'http://127.0.0.1:4000'

async function runUiSmokeTest() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.setDefaultTimeout(12000)

  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('main')

  await page.getByRole('button', { name: '+ Record' }).click({ force: true, noWaitAfter: true })
  await page.getByRole('dialog', { name: 'Add Income Or Expense Modal' }).waitFor({ state: 'visible' })
  const modalCoversNav = await page.evaluate(() => {
    const modal = document.querySelector('[aria-label="Add Income Or Expense Modal"]')
    const nav = document.querySelector('main section.sticky')
    if (!modal || !nav) return false
    const modalZ = Number(globalThis.getComputedStyle(modal).zIndex || 0)
    const navZ = Number(globalThis.getComputedStyle(nav).zIndex || 0)
    return modalZ > navZ
  })
  if (!modalCoversNav) throw new Error('Modal z-index does not cover sticky navigation')
  await page.getByRole('button', { name: 'Close add record modal backdrop' }).click({ force: true, noWaitAfter: true, position: { x: 8, y: 8 } })
  await page.getByRole('dialog', { name: 'Add Income Or Expense Modal' }).waitFor({ state: 'hidden' })

  await page.getByRole('button', { name: '+ Goal' }).first().click({ force: true, noWaitAfter: true })
  await page.getByRole('dialog', { name: 'Add Goal Modal' }).waitFor({ state: 'visible' })
  await page.getByRole('button', { name: 'Close add goal modal backdrop' }).click({ force: true, noWaitAfter: true, position: { x: 8, y: 8 } })
  await page.getByRole('dialog', { name: 'Add Goal Modal' }).waitFor({ state: 'hidden' })

  const rootFontBeforeIncrease = await page.evaluate(() => globalThis.getComputedStyle(document.documentElement).fontSize)
  await page.getByRole('button', { name: 'A+' }).click({ force: true, noWaitAfter: true })
  await page.waitForTimeout(200)
  const rootFontAfterIncrease = await page.evaluate(() => globalThis.getComputedStyle(document.documentElement).fontSize)
  if (!(parseFloat(rootFontAfterIncrease) > parseFloat(rootFontBeforeIncrease))) {
    throw new Error(`Text size increase failed: before=${rootFontBeforeIncrease}, after=${rootFontAfterIncrease}`)
  }
  await page.getByRole('button', { name: 'Top' }).click({ force: true, noWaitAfter: true })

  await browser.close()
  console.log('UI_SMOKE_PASS')
}

runUiSmokeTest().catch((error) => {
  console.error('UI_SMOKE_FAIL')
  console.error(error)
  process.exit(1)
})
