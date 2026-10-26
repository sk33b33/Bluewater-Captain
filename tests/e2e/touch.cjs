// Headless phone-emulation test: touch drags on the on-screen throttle/steer controls.
// Run: npm run build && node tests/e2e/touch.cjs [outDir]
const { chromium } = require('playwright');
const path = require('path');
const out = process.argv[2] || '.';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../../dist/index.html'));
  await page.waitForTimeout(800);
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, id, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id }] });
  await page.tap('#start-btn');
  const box = async (sel) => page.locator(sel).boundingBox();
  const th = await box('#t-throttle');
  // Drag from lever centre to the top (full ahead), then release: lever should stay.
  await touch('touchStart', 1, th.x + th.width / 2, th.y + th.height / 2);
  await touch('touchMove', 1, th.x + th.width / 2, th.y + 8);
  await touch('touchEnd', 1);
  const thr = await page.evaluate(() => document.getElementById('t-throttle-thumb').style.top);
  await page.waitForTimeout(4000);
  const st = await box('#t-steer');
  await touch('touchStart', 2, st.x + st.width / 2, st.y + st.height / 2);
  await touch('touchMove', 2, st.x + st.width - 8, st.y + st.height / 2);
  await page.waitForTimeout(2500);
  const mid = await page.evaluate(() => ({ u: window.__bwc.vessel.u, h: window.__bwc.vessel.heading }));
  await page.screenshot({ path: path.join(out, 'shot-touch.png') });
  await touch('touchEnd', 2);
  const steerThumb = await page.evaluate(() => document.getElementById('t-steer-thumb').style.left);
  const centred = steerThumb.startsWith('calc(50%');
  const h0 = 1.5707963;
  console.log(JSON.stringify({ thr, mid, steerThumbAfterRelease: steerThumb, turnedRight: mid.h > h0 + 0.02, errors }));
  await browser.close();
  if (errors.length || !(mid.u > 0.5) || !(mid.h > h0 + 0.02) || !centred) process.exit(1);
})();
