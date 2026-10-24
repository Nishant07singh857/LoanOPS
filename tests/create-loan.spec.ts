import { test, expect } from '@playwright/test';

// Credentials come from the environment (the same SEED_* variables used to
// seed the test database). There are NO hardcoded default passwords — set
// SEED_OWNER_PASSWORD before running E2E tests.
function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} must be set to run E2E tests (see README > Testing)`);
  return v;
}
const OWNER_EMAIL = 'owner@loanops.in';
const OWNER_PASSWORD = requiredEnv('SEED_OWNER_PASSWORD');

test.describe('Create Loan Application', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email or Mobile Number').fill(OWNER_EMAIL);
    await page.getByLabel('Password').fill(OWNER_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    
    // Wait for redirect to admin
    await page.waitForURL('**/admin');
  });

  test('admin can generate a QR link for a new candidate', async ({ page }) => {
    // Navigate to the create loan page
    await page.goto('/admin/create-loan');
    await expect(page.getByRole('heading', { name: 'Create Loan Application' })).toBeVisible();

    // Select "New Candidate"
    await page.getByText('New Candidate').click();

    // Fill in candidate details
    const uniqueMobile = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
    await page.getByLabel('Full Name').fill('Test Candidate');
    await page.getByLabel('Mobile Number').fill(uniqueMobile);

    // Fill in loan details
    await page.getByLabel('Principal Amount (₹)').fill('50000');
    await page.getByLabel('Purpose').fill('Business Expansion Test');
    
    // Choose Interest Type
    await page.getByText('Percentage', { exact: true }).click();
    await page.getByLabel('Interest Rate (% per period)').fill('2');
    
    // Repayment Frequency
    await page.getByText('Monthly', { exact: true }).click();
    await page.getByLabel('Tenure in Months').fill('12');

    // Submit
    const generateResponse = page.waitForResponse(
      (r) => r.url().includes('/api/owner/qr-links') && r.status() === 201
    );
    await page.getByRole('button', { name: 'Generate QR Link' }).click();
    await generateResponse;

    // Verify success banner and QR link are visible
    await expect(page.getByText('Success! Link Generated')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy' })).toBeVisible();
  });
});
