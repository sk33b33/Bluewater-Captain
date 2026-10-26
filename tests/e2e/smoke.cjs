// Headless smoke test: loads dist/index.html in Chromium (software GL), sails, screenshots.
// Run: npm run build && node tests/e2e/smoke.cjs [outDir]   (needs Playwright + Chromium installed)
const { chromium } = require('playwright');
const path = require('path');
const out = process.argv[2] || '.';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('file://' + path.resolve(__dirname, '../../dist/index.html'));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(out, 'shot-menu.png') });
  await page.click('#start-btn');
  const mode1 = await page.evaluate(() => window.__bwc.mode);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(6000);
  const s = await page.evaluate(() => ({ u: window.__bwc.vessel.u, x: window.__bwc.vessel.x, z: window.__bwc.vessel.z, next: window.__bwc.route.next }));
  await page.screenshot({ path: path.join(out, 'shot-sailing.png') });
  await page.keyboard.up('KeyW');
  console.log(JSON.stringify({ mode1, s, errors }));
  await browser.close();
  if (errors.length || mode1 !== 'play' || !(s.u > 1)) process.exit(1);
})();
