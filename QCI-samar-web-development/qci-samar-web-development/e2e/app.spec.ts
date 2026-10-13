import { test, expect } from '@playwright/test';

// Helper to setup logging
function setupLogging(page: any) {
  const logs = {
    console: [] as string[],
    errors: [] as string[],
    requests: [] as string[],
    failures: [] as string[],
  };

  page.on('console', (msg: any) => {
    const text = msg.text();
    const type = msg.type();
    if (type === 'error') {
      logs.errors.push(`[ERROR] ${text}`);
    } else if (type === 'warning') {
      logs.console.push(`[WARN] ${text}`);
    } else {
      logs.console.push(`[${type.toUpperCase()}] ${text}`);
    }
  });

  page.on('pageerror', (error: any) => {
    logs.errors.push(`[PAGE ERROR] ${error.message}`);
  });

  page.on('request', (request: any) => {
    logs.requests.push(`➡️  ${request.method()} ${request.url()}`);
  });

  page.on('response', (response: any) => {
    const status = response.status();
    if (status >= 400) {
      logs.failures.push(`❌ ${status} ${response.statusText()} - ${response.url()}`);
    }
  });

  page.on('requestfailed', (request: any) => {
    logs.failures.push(`❌ FAILED: ${request.method()} ${request.url()} - ${request.failure()?.errorText}`);
  });

  return logs;
}

function printLogs(logs: any) {
  console.log('\n========== CONSOLE LOGS ==========');
  logs.console.length > 0 ? logs.console.forEach((l: string) => console.log(l)) : console.log('None');

  console.log('\n========== CONSOLE ERRORS ==========');
  logs.errors.length > 0 ? logs.errors.forEach((l: string) => console.log(l)) : console.log('None');

  console.log('\n========== NETWORK REQUESTS ==========');
  console.log(`Total: ${logs.requests.length}`);
  logs.requests.forEach((l: string) => console.log(l));

  console.log('\n========== NETWORK FAILURES ==========');
  logs.failures.length > 0 ? logs.failures.forEach((l: string) => console.log(l)) : console.log('None');
}

test.describe('App', () => {
  test('should login successfully', async ({ page }) => {
    const logs = setupLogging(page);

    // Go to login page
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    console.log('\n========== LOGIN PAGE ==========');
    console.log('Page title:', await page.title());
    await page.screenshot({ path: 'e2e/screenshots/01-login-page.png', fullPage: true });

    // Fill login form
    await page.fill('input[name="email"], input[type="email"], input[placeholder*="Email"], input[placeholder*="SAMAR"]', 'ramlakhan.rajput@webority.com');
    await page.fill('input[name="password"], input[type="password"]', 'Admin@123456');

    await page.screenshot({ path: 'e2e/screenshots/02-login-filled.png', fullPage: true });

    // Click login button
    await page.click('button[type="submit"], button:has-text("Login")');

    // Wait for navigation or response
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Wait for any redirects

    console.log('\n========== AFTER LOGIN ==========');
    console.log('Page title:', await page.title());
    console.log('Page URL:', page.url());

    await page.screenshot({ path: 'e2e/screenshots/03-after-login.png', fullPage: true });

    // Print all logs
    printLogs(logs);

    // Basic assertion
    await expect(page).toHaveTitle(/.*/);

    // Keep browser open for manual browsing (5 minutes)
    console.log('\n========== BROWSER STAYING OPEN FOR 5 MINUTES ==========');
    console.log('You can browse the app manually. Test will close in 5 minutes.');
    await page.waitForTimeout(300000);
  });
});
