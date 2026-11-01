import { test, expect, type Page } from '@playwright/test'

// Regression coverage for the owner-portal sidebar:
//  - desktop/laptop: the fixed sidebar must show every nav item (the last
//    groups used to look "cut off" on laptop-height viewports because the
//    nav scrolled with a hidden scrollbar) and the pinned user card.
//  - mobile: the hamburger drawer must open as a proper wide drawer
//    (min(88vw, 320px)) anchored to the left edge, with all items
//    reachable, and must close on navigation.

const BASE_URL = 'http://localhost:3000'

function requiredEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} must be set to run E2E tests (see README > Testing)`)
  return v
}

const OWNER_EMAIL = 'owner@loanops.in'
const OWNER_PASSWORD = requiredEnv('SEED_OWNER_PASSWORD')

async function loginAsOwner(page: Page, ip: string) {
  const res = await page.request.post(`${BASE_URL}/api/auth/login`, {
    headers: { Origin: BASE_URL, 'x-forwarded-for': ip },
    data: { email: OWNER_EMAIL, password: OWNER_PASSWORD },
  })
  expect(res.ok(), `owner API login failed: ${await res.text()}`).toBe(true)
}

test.describe('Owner sidebar — desktop / laptop', () => {
  test('fixed sidebar is full width and every nav item is reachable', async ({ page }) => {
    await loginAsOwner(page, '10.10.0.11')
    await page.goto('/admin')

    const aside = page.locator('aside')
    await expect(aside).toBeVisible()
    const box = await aside.boundingBox()
    expect(box, 'sidebar must have a bounding box').not.toBeNull()
    // w-64 = 256px at the default 1280px-wide Desktop Chrome viewport.
    expect(box!.width).toBeGreaterThanOrEqual(250)

    const nav = aside.getByRole('navigation', { name: 'Sidebar navigation' })
    for (const label of ['Dashboard', 'Create Loan', 'Payments', 'Reconciliation', 'Reports', 'Agents', 'Agreements', 'Support']) {
      const link = nav.getByRole('link', { name: label, exact: true })
      await link.scrollIntoViewIfNeeded()
      await expect(link, `nav item "${label}" must be reachable in the sidebar`).toBeVisible()
    }

    // Pinned user card with sign-out stays visible at the sidebar bottom.
    await expect(aside.getByRole('button', { name: 'Sign out' })).toBeVisible()
  })
})

test.describe('Owner sidebar — wheel scrolling', () => {
  test('mouse wheel over the sidebar nav scrolls the nav itself (no scrollbar dragging)', async ({ page }) => {
    await loginAsOwner(page, '10.10.0.13')
    // Short viewport: the 16-item owner nav genuinely overflows the sidebar.
    await page.setViewportSize({ width: 1280, height: 600 })
    await page.goto('/admin')

    const nav = page.locator('aside').getByRole('navigation', { name: 'Sidebar navigation' })
    await expect(nav).toBeVisible()

    // Premise: content is taller than the visible nav box, so scrolling is required.
    const { scrollHeight, clientHeight } = await nav.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }))
    expect(scrollHeight, 'owner nav must overflow at a 600px-tall viewport').toBeGreaterThan(clientHeight)

    const box = await nav.boundingBox()
    expect(box, 'sidebar nav must have a bounding box').not.toBeNull()
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)

    // Regression guard: Lenis (desktop smooth scrolling) used to swallow
    // wheel events over the nav and scroll the page instead, so the only
    // way down was dragging the 6px scrollbar thumb. The wheel must move
    // the nav's own scrollTop.
    await page.mouse.wheel(0, 600)
    await expect
      .poll(async () => nav.evaluate((el) => el.scrollTop), { timeout: 5000 })
      .toBeGreaterThan(0)

    // The last nav group must be reachable by wheel alone.
    const support = nav.getByRole('link', { name: 'Support', exact: true })
    await expect
      .poll(
        async () =>
          nav.evaluate((el, link) => {
            const navRect = el.getBoundingClientRect()
            const linkRect = (link as HTMLElement).getBoundingClientRect()
            return linkRect.bottom <= navRect.bottom + 1
          }, await support.elementHandle()),
        { timeout: 5000 }
      )
      .toBe(true)
  })
})

test.describe('Owner sidebar — mobile drawer', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('hamburger opens a full drawer and navigation closes it', async ({ page }) => {
    await loginAsOwner(page, '10.10.0.12')
    await page.goto('/admin')

    // Desktop sidebar is not rendered at this width.
    await expect(page.locator('aside')).toBeHidden()

    await page.getByRole('button', { name: 'Open menu' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    // The drawer slides in over 500ms; wait for the animation to settle
    // at x=0 before measuring its final geometry.
    await expect
      .poll(async () => (await dialog.boundingBox())?.x, { timeout: 5000 })
      .toBe(0)
    const box = await dialog.boundingBox()
    expect(box, 'drawer must have a bounding box').not.toBeNull()
    // min(88vw, 320px) at 390px viewport = 320px — a proper drawer,
    // not the old narrow 288px strip.
    expect(box!.width).toBeGreaterThanOrEqual(300)

    const nav = dialog.getByRole('navigation', { name: 'Sidebar navigation' })
    const support = nav.getByRole('link', { name: 'Support', exact: true })
    await support.scrollIntoViewIfNeeded()
    await expect(support).toBeVisible()

    // Navigating from the drawer closes it and lands on the target page.
    // Locate by href, not by accessible name: the Loans item carries a
    // live count badge, so its accessible name is "Loans 1", not "Loans"
    // (an exact-name lookup can never resolve — that was a spec bug, the
    // drawer itself renders and navigates correctly).
    await nav.locator('a[href="/admin/loans"]').click()
    await expect(page).toHaveURL(/\/admin\/loans/)
    await expect(dialog).toBeHidden()
  })
})
