import { chromium } from 'playwright'

const TARGET_URL = process.env.PROFILE_URL || 'http://127.0.0.1:4000'

async function runNetWorthPopoverCheck() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.setDefaultTimeout(12000)

  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#net-worth-trajectory')

  const result = await page.evaluate(() => {
    const section = document.querySelector('#net-worth-trajectory')
    if (!section) return { ok: false, reason: 'Net Worth Trajectory section not found.' }

    const sectionStyle = globalThis.getComputedStyle(section)
    const sectionVisibilityAllowsPopover = sectionStyle.contentVisibility === 'visible' && sectionStyle.overflow === 'visible'
    if (!sectionVisibilityAllowsPopover) {
      return {
        ok: false,
        reason: `Section clipping styles invalid (contentVisibility=${sectionStyle.contentVisibility}, overflow=${sectionStyle.overflow}).`
      }
    }

    const trigger = section.querySelector('.meta-hover')
    if (!trigger) return { ok: false, reason: 'No popover trigger found in Net Worth Trajectory.' }
    const popover = trigger.querySelector('.meta-hover-box')
    if (!popover) return { ok: false, reason: 'No popover box found in Net Worth Trajectory.' }
    const popoverStyle = globalThis.getComputedStyle(popover)
    const triggerStyle = globalThis.getComputedStyle(trigger)
    const popoverIsLayered = popoverStyle.position === 'absolute' && Number(popoverStyle.zIndex || 0) >= 3000
    const triggerAllowsOverflow = triggerStyle.overflow === 'visible'
    if (!popoverIsLayered) return { ok: false, reason: `Popover layering invalid (position=${popoverStyle.position}, zIndex=${popoverStyle.zIndex}).` }
    if (!triggerAllowsOverflow) return { ok: false, reason: `Trigger overflow invalid (overflow=${triggerStyle.overflow}).` }

    return {
      ok: true,
      sectionContentVisibility: sectionStyle.contentVisibility,
      sectionOverflow: sectionStyle.overflow,
      popoverZIndex: popoverStyle.zIndex
    }
  })

  await browser.close()

  if (!result.ok) {
    throw new Error(`NETWORTH_POPOVER_FAIL: ${result.reason}`)
  }

  console.log(`NETWORTH_POPOVER_PASS contentVisibility=${result.sectionContentVisibility} overflow=${result.sectionOverflow} popoverZ=${result.popoverZIndex}`)
}

runNetWorthPopoverCheck().catch((error) => {
  console.error(error)
  process.exit(1)
})
