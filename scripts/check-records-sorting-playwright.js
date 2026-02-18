import { chromium } from 'playwright'

const url = 'http://127.0.0.1:4000'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
await page.goto(url, { waitUntil: 'domcontentloaded' })
await page.locator('#records').scrollIntoViewIfNeeded()

const amountHeader = page.locator('#records thead button', { hasText: 'Amount' })
await amountHeader.click()
await page.waitForTimeout(200)
const ascRows = await page.$$eval('#records tbody tr', (rows) => rows.slice(0, 12).map((row) => {
  const tds = [...row.querySelectorAll('td')]
  return { type: tds[0]?.textContent?.trim() || '', amount: tds[4]?.textContent?.trim() || '' }
}))

await amountHeader.click()
await page.waitForTimeout(200)
const descRows = await page.$$eval('#records tbody tr', (rows) => rows.slice(0, 12).map((row) => {
  const tds = [...row.querySelectorAll('td')]
  return { type: tds[0]?.textContent?.trim() || '', amount: tds[4]?.textContent?.trim() || '' }
}))

await browser.close()
console.log(JSON.stringify({ ascRows, descRows }, null, 2))
