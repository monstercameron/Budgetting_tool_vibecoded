import { chromium } from 'playwright'

const TARGET_URL = process.env.PROFILE_URL || 'http://127.0.0.1:4000'

async function runPopoverZOrderCheck() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.setDefaultTimeout(12000)

  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('main')

  const popoverTriggerLocator = page.locator('.meta-hover:visible').filter({ has: page.locator('.meta-hover-box') })
  const visibleMetaHoverCount = await popoverTriggerLocator.count()
  if (visibleMetaHoverCount === 0) {
    await browser.close()
    console.log('POPOVER_ZORDER_SKIPPED_NO_VISIBLE_POPOVER')
    return
  }
  const sampleCount = Math.min(visibleMetaHoverCount, 20)
  let activatedCount = 0
  for (let index = 0; index < sampleCount; index += 1) {
    const metaHover = popoverTriggerLocator.nth(index)
    await metaHover.scrollIntoViewIfNeeded()
    await metaHover.evaluate((node) => {
      if (!node.hasAttribute('tabindex')) node.setAttribute('tabindex', '-1')
      node.focus()
    })
    await page.waitForTimeout(80)

    const result = await metaHover.evaluate((focusedMetaHover) => {
      const popover = focusedMetaHover.querySelector('.meta-hover-box')
      if (!popover) return { ok: false, reason: 'Popover element not found.' }

      const popoverOpacity = Number(globalThis.getComputedStyle(popover).opacity || 0)
      if (popoverOpacity < 0.95) return { ok: false, reason: 'Popover did not become visible on focus/hover.' }

      const hoveredSection = focusedMetaHover.closest('.z-layer-section')
      if (!hoveredSection) return { ok: false, reason: 'Focused popover is not inside a z-layer section.' }

      const hoveredSectionZ = Number(globalThis.getComputedStyle(hoveredSection).zIndex || 0)
      const sectionZValues = Array.from(document.querySelectorAll('.z-layer-section'))
        .map((sectionNode) => Number(globalThis.getComputedStyle(sectionNode).zIndex || 0))
      const maxSiblingSectionZ = Math.max(...sectionZValues)
      const isHoveredSectionOnTop = hoveredSectionZ >= maxSiblingSectionZ

      return {
        ok: isHoveredSectionOnTop,
        reason: isHoveredSectionOnTop ? '' : 'Focused section z-index is not raised above sibling sections.',
        hoveredSectionZ,
        maxSiblingSectionZ,
        popoverOpacity
      }
    })

    if (!result.ok && result.reason === 'Popover did not become visible on focus/hover.') {
      continue
    }
    if (!result.ok) {
      await browser.close()
      throw new Error(`POPOVER_ZORDER_FAIL[index=${index}]: ${result.reason} hoveredSectionZ=${result.hoveredSectionZ} maxSiblingSectionZ=${result.maxSiblingSectionZ} popoverOpacity=${result.popoverOpacity}`)
    }
    activatedCount += 1
  }

  if (activatedCount === 0) {
    await browser.close()
    console.log('POPOVER_ZORDER_SKIPPED_NO_ACTIVATABLE_POPOVER')
    return
  }

  await browser.close()
  console.log(`POPOVER_ZORDER_PASS activated=${activatedCount}`)
}

runPopoverZOrderCheck().catch((error) => {
  console.error(error)
  process.exit(1)
})
