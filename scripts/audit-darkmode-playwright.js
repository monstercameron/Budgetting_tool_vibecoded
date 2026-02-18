import { chromium } from 'playwright'

const TARGET_URL = process.env.PROFILE_URL || 'http://127.0.0.1:4000'

function parseRgbStringToChannels(rgbString) {
  const match = rgbString.match(/rgba?\(([^)]+)\)/)
  if (!match) return null
  const parts = match[1].split(',').map((part) => Number(part.trim()))
  if (parts.length < 3) return null
  return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 }
}

function calculateRelativeLuminance(rgb) {
  const toLinear = (channel) => {
    const normalized = channel / 255
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b)
}

async function runDarkModeAudit() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('main')

  const themeToggle = page.getByRole('button', { name: /Theme:/ })
  const toggleText = await themeToggle.textContent()
  if (toggleText && toggleText.includes('Light')) {
    await themeToggle.click({ force: true })
    await page.waitForTimeout(200)
  }

  const offenders = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('section, article, table, thead, tbody, tr, td, th, button, span, div'))
    const visibleElements = elements.filter((el) => {
      const rect = el.getBoundingClientRect()
      return rect.width > 60 && rect.height > 22
    })

    return visibleElements.map((element) => {
      const style = globalThis.getComputedStyle(element)
      const bg = style.backgroundColor
      const fg = style.color
      return {
        tag: element.tagName.toLowerCase(),
        className: element.className || '',
        text: (element.textContent || '').trim().slice(0, 80),
        backgroundColor: bg,
        color: fg
      }
    })
  })

  const flagged = offenders.filter((item) => {
    const bg = parseRgbStringToChannels(item.backgroundColor)
    if (!bg) return false
    const bgLuminance = calculateRelativeLuminance(bg)
    return bg.a > 0.7 && bgLuminance > 0.55
  }).slice(0, 60)

  const spotlight = await page.evaluate(() => {
    const selectors = ['[class*="bg-rose-50"]', '[class*="bg-slate-200"]', '[class*="bg-white"]']
    return selectors.map((selector) => {
      const element = document.querySelector(selector)
      if (!element) return { selector, found: false }
      const style = getComputedStyle(element)
      return {
        selector,
        found: true,
        className: element.className,
        text: (element.textContent || '').trim().slice(0, 80),
        backgroundColor: style.backgroundColor,
        color: style.color
      }
    })
  })

  console.log(JSON.stringify({
    targetUrl: TARGET_URL,
    activeTheme: await page.evaluate(() => document.body.getAttribute('data-theme')),
    totalAudited: offenders.length,
    flaggedCount: flagged.length,
    flagged,
    spotlight
  }, null, 2))

  await browser.close()
}

runDarkModeAudit().catch((error) => {
  console.error('DARKMODE_AUDIT_FAILED')
  console.error(error)
  process.exit(1)
})
