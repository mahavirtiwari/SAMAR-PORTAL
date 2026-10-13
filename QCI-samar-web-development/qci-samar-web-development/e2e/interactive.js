const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const COMMANDS_FILE = path.join(__dirname, 'commands.txt');

async function run() {
  // Launch browser
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Browser launched!');
  console.log('Navigating to login page...');

  // Go to app
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');

  // Login
  console.log('Logging in...');
  await page.fill('input[name="email"], input[type="email"], input[placeholder*="Email"], input[placeholder*="SAMAR"]', 'ram.webority@gmail.com');
  await page.fill('input[name="password"], input[type="password"]', 'C59KFaUIQpYG63!');

  // Remove overlay and click login
  await page.evaluate(() => {
    const overlay = document.getElementById('webpack-dev-server-client-overlay');
    if (overlay) {
      overlay.remove();
    }
  });
  await page.click('button[type="submit"], button:has-text("Login")', { force: true });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  console.log('Logged in! Current URL:', page.url());
  console.log('\n=== READY FOR COMMANDS ===');
  console.log('Watching for commands in:', COMMANDS_FILE);

  // Create empty commands file
  fs.writeFileSync(COMMANDS_FILE, '');

  let lastCommand = '';

  // Watch for commands
  while (true) {
    try {
      if (fs.existsSync(COMMANDS_FILE)) {
        const command = fs.readFileSync(COMMANDS_FILE, 'utf-8').trim();

        if (command && command !== lastCommand) {
          lastCommand = command;
          console.log('\n>>> Executing:', command);

          try {
            // Execute the command
            const result = await eval(`(async () => { ${command} })()`);
            if (result !== undefined) {
              console.log('Result:', result);
            }
            console.log('✓ Done');
            console.log('Current URL:', page.url());
          } catch (err) {
            console.error('✗ Error:', err.message);
          }
        }
      }
    } catch (e) {
      // Ignore file read errors
    }

    await new Promise(r => setTimeout(r, 500)); // Check every 500ms
  }
}

run().catch(console.error);
