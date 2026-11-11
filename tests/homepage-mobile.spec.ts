import { test, expect, type Page } from '@playwright/test'

// Homepage mobile-layout gates — the durable form of the phone
// research spec (homepage-mobile-layout report, §8 + §8.7), run at
// the two design widths: 360px (primary, budget Android) and 390px
// (the roomier check). Layout is asserted with reduced motion on:
// the entrance reveal does not exist under reduce, so every box
// measured here is the settled composition — which is also the
// composition reduced-motion visitors get.
//
// For /, /product and /security: no horizontal overflow at either
// width. For the homepage additionally: the first-viewport order
// (pill nav → H1 → primary CTA → the loan card peeking in), exactly
// one /login link, hero tap targets ≥44px, the mobile menu sheet
// (rows ≥52px, no login link inside, closes on selection and on
// Escape), and the enquiry form's phone sizing (52px fields, 16px
// input text, 52px submit).

const VIEWPORTS = [
  { label: '360x740', width: 360, height: 740 },
  { label: '390x844', width: 390, height: 844 },
] as const

async function openSettled(page: Page, path: string) {
  const res = await page.goto(path, { waitUntil: 'load' })
  expect(res?.ok(), `GET ${path} should succeed`).toBe(true)
  await page.evaluate(() => document.fonts.ready)
}

async function expectNoHorizontalOverflow(page: Page, path: string) {
  const m = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    inner: window.innerWidth,
  }))
  expect(m.doc, `${path}: document scrollWidth ${m.doc} > innerWidth ${m.inner}`).toBeLessThanOrEqual(m.inner)
  expect(m.body, `${path}: body scrollWidth ${m.body} > innerWidth ${m.inner}`).toBeLessThanOrEqual(m.inner)
}

for (const vp of VIEWPORTS) {
  test.describe(`mobile layout @ ${vp.label}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, reducedMotion: 'reduce' })

    test('no horizontal overflow on /, /product, /security', async ({ page }) => {
      for (const path of ['/', '/product', '/security']) {
        await openSettled(page, path)
        await expectNoHorizontalOverflow(page, path)
        // Also at the bottom of the page — late sections (lifecycle
        // rail, form, footer) are overflow suspects too.
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
        await expectNoHorizontalOverflow(page, `${path} (scrolled to bottom)`)
        await page.evaluate(() => window.scrollTo(0, 0))
      }
    })

    test('homepage first viewport: nav → H1 → CTA → card peek, one login link', async ({ page }) => {
      await openSettled(page, '/')

      await expect(page.locator('a[href="/login"]')).toHaveCount(1)

      const nav = await page.locator('header').first().boundingBox()
      const h1 = await page.locator('h1').boundingBox()
      const cta = await page.locator('a[href="#enquire"]:visible').first().boundingBox()
      const card = await page.locator('[data-tilt-card]').boundingBox()
      expect(nav, 'nav pill box').not.toBeNull()
      expect(h1, 'H1 box').not.toBeNull()
      expect(cta, 'primary CTA box').not.toBeNull()
      expect(card, 'loan card box').not.toBeNull()

      expect(h1!.y, 'H1 starts below the nav').toBeGreaterThan(nav!.y)
      expect(cta!.y, 'primary CTA starts below the H1').toBeGreaterThan(h1!.y)
      expect(card!.y, 'card starts below the CTA').toBeGreaterThan(cta!.y)
      // The peek: the card begins inside the first viewport with at
      // least 48px of it visible.
      expect(card!.y, 'card top is inside the first viewport').toBeLessThan(vp.height)
      expect(vp.height - card!.y, 'at least 48px of the card peeks into viewport 1').toBeGreaterThanOrEqual(48)

      // The H1 fits its phone budget: 34px at line-height 1.1, at
      // most three display lines.
      expect(h1!.height, `H1 height ${h1!.height} exceeds three 34px lines`).toBeLessThanOrEqual(113)
      // The EMI figure stays on ONE line inside the card.
      const emi = await page.locator('[data-tilt-card] p', { hasText: '₹7,437.50' }).boundingBox()
      expect(emi, 'EMI figure box').not.toBeNull()
      expect(emi!.height, `EMI height ${emi!.height} suggests it wrapped`).toBeLessThanOrEqual(36)
      // The chips sit in their 2-up row at the spec's height band.
      for (const chip of await page.locator('[data-tilt-chip]').all()) {
        const chipBox = await chip.boundingBox()
        expect(chipBox!.height, `chip height ${chipBox!.height} outside the 60–80px band`).toBeGreaterThanOrEqual(60)
        expect(chipBox!.height, `chip height ${chipBox!.height} outside the 60–80px band`).toBeLessThanOrEqual(80)
      }
    })

    test('homepage hero tap targets are at least 44px tall', async ({ page }) => {
      await openSettled(page, '/')
      const targets: Array<[string, ReturnType<Page['locator']>]> = [
        ['wordmark', page.locator('header a[href="#top"]')],
        ['Log in', page.locator('a[href="/login"]')],
        ['menu button', page.locator('button[aria-label="Open menu"]')],
        ['primary CTA', page.locator('a[href="#enquire"]:visible').first()],
        ['secondary link', page.locator('a[href="#lifecycle"]:visible').first()],
      ]
      for (const [label, loc] of targets) {
        const box = await loc.boundingBox()
        expect(box, `${label} should be visible`).not.toBeNull()
        expect(box!.height, `${label} height ${box!.height} < 44`).toBeGreaterThanOrEqual(43.5)
      }
      const menuBox = await page.locator('button[aria-label="Open menu"]').boundingBox()
      expect(menuBox!.width, 'menu button width < 44').toBeGreaterThanOrEqual(43.5)
    })

    test('mobile menu: sheet rows ≥52px, no login link inside, closes on selection and Escape', async ({ page }) => {
      await openSettled(page, '/')
      await page.locator('button[aria-label="Open menu"]').click()
      const sheet = page.getByRole('dialog', { name: 'Menu' })
      await expect(sheet).toBeVisible()
      await expect(sheet.locator('a[href="/login"]')).toHaveCount(0)
      for (const row of await sheet.locator('nav a').all()) {
        const box = await row.boundingBox()
        expect(box!.height, 'menu row height < 52').toBeGreaterThanOrEqual(51.5)
      }
      const demoBox = await sheet.locator('a[href="#enquire"]').boundingBox()
      expect(demoBox!.height, 'drawer Book a demo height < 52').toBeGreaterThanOrEqual(51.5)

      await page.keyboard.press('Escape')
      await expect(sheet).toHaveCount(0)

      await page.locator('button[aria-label="Open menu"]').click()
      await expect(sheet).toBeVisible()
      await sheet.locator('a[href="#modules"]').click()
      await expect(sheet).toHaveCount(0)
    })

    test('enquiry form phone sizing: 52px fields, 16px input text, 52px submit', async ({ page }) => {
      await openSettled(page, '/')
      const field = page.locator('#enquiry-mobile')
      await field.scrollIntoViewIfNeeded()
      const fieldBox = await field.boundingBox()
      expect(fieldBox!.height, 'mobile field height < 52').toBeGreaterThanOrEqual(51.5)
      const fontSize = await field.evaluate((el) => getComputedStyle(el).fontSize)
      expect(fontSize, 'input text below 16px triggers iOS auto-zoom').toBe('16px')
      const submitBox = await page.locator('#enquire button[type="submit"]').boundingBox()
      expect(submitBox!.height, 'submit height < 52').toBeGreaterThanOrEqual(51.5)
    })
  })
}
