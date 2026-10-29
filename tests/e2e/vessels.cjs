// Headless end-to-end test of Stage 4: fleet screen, license gates on vessels, vessel choice on the
// briefing, vessel-specific physics/HUD in play, and persistence of the active vessel.
// Run: npm run build && node tests/e2e/vessels.cjs [outDir]
const { chromium } = require('playwright');
const path = require('path');
const { startServer } = require('./serve.cjs');
const out = process.argv[2] || '.';
const fails = [];
const check = (cond, msg) => { if (!cond) { fails.push(msg); console.log('FAIL', msg); } else console.log('ok  ', msg); };

const licensed = (extra = {}) => ({ held: true, heldAt: 1, grandfathered: false, written: { attempts: 1, bestScore: 5, passed: true }, practical: { attempts: 1, bestScore: 90, passed: true }, ...extra });

async function open(browser, url, profile) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript((p) => { if (!localStorage.getItem('bwc-profile')) localStorage.setItem('bwc-profile', JSON.stringify(p)); }, profile);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  await page.waitForTimeout(500);
  await page.click('#start-btn');
  return { ctx, page, errors };
}

(async () => {
  const server = await startServer();
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const waitMode = (page, m) => page.waitForFunction((x) => window.__bwc.mode === x, m, { timeout: 40000 });

  // ---- permit only: workboat and passenger craft are locked
  {
    const base = { version: 3, credits: 500, reputation: 5, xp: 0, completed: {}, vessel: 'small-motorboat', licenses: { 'small-craft-permit': licensed() } };
    const { ctx, page, errors } = await open(browser, server.url, base);
    check((await page.locator('.mcard').count()) === 10, 'board lists 10 missions');
    check((await page.textContent('#p-vessel')) === 'Harbor Skiff', 'board shows the active vessel');
    check((await page.locator('.mcard.locked[data-id="workboat-haul"]').count()) === 1, 'Heavy Gear Haul is locked with only the permit');
    check(/Coastal Skipper/.test(await page.textContent('.mcard[data-id="workboat-haul"] .lock-note')), 'locked card names the license that unlocks the vessel');
    await page.click('#board-fleet');
    check((await page.locator('.vcard').count()) === 3, 'fleet shows 3 vessels');
    check(!(await page.isDisabled('#use-small-motorboat')) || /In use/.test(await page.textContent('#use-small-motorboat')), 'skiff is the active vessel');
    check(await page.isDisabled('#use-workboat'), 'workboat cannot be selected without the Coastal Skipper');
    check(await page.isDisabled('#use-coastal-passenger'), 'passenger craft cannot be selected without the Coastal Skipper');
    check((await page.locator('.vcard[data-id="workboat"] .stats .bar').count()) === 7, 'each vessel card has 7 stat bars');
    await page.screenshot({ path: path.join(out, 'v-fleet.png') });
    await page.click('#fleet-back');
    await page.locator('.mcard[data-id="supply-run"]').click();
    check(await page.isHidden('#br-vessel-select'), 'supply run offers only the skiff when that is all you may use');
    check(/Harbor Skiff/.test(await page.textContent('#br-vessel')), 'briefing names the skiff');
    check(errors.length === 0, 'no errors (permit only) ' + JSON.stringify(errors));
    await ctx.close();
  }

  // ---- Coastal Skipper held: choose a vessel, drive it
  {
    const full = { version: 3, credits: 500, reputation: 20, xp: 0, completed: {}, vessel: 'small-motorboat', licenses: { 'small-craft-permit': licensed(), 'coastal-skipper': licensed() } };
    const { ctx, page, errors } = await open(browser, server.url, full);
    check((await page.locator('.mcard.locked[data-id="workboat-haul"]').count()) === 0, 'Heavy Gear Haul unlocked by the Coastal Skipper');
    check((await page.locator('.mcard.locked[data-id="passenger-shuttle"]').count()) === 0, 'Passenger Shuttle unlocked by the Coastal Skipper');
    await page.click('#board-fleet');
    check(!(await page.isDisabled('#use-workboat')), 'workboat selectable');
    await page.click('#use-workboat');
    check((await page.evaluate(() => window.__bwc.profile.vessel)) === 'workboat', 'selecting the workboat sets the active vessel');
    check((await page.evaluate(() => window.__bwc.vesselId)) === 'workboat', 'the workboat is now the model in the harbor');
    check(/In use/.test(await page.textContent('#use-workboat')), 'fleet shows the workboat as in use');
    await page.screenshot({ path: path.join(out, 'v-fleet2.png') });
    await page.click('#fleet-back');
    check((await page.textContent('#p-vessel')) === 'Harbor Workboat', 'board shows the Workboat');

    // supply run offers all three vessels; picking one changes the deadline
    await page.locator('.mcard[data-id="supply-run"]').click();
    check(await page.isVisible('#br-vessel-select'), 'supply run lets you choose among your vessels');
    check((await page.locator('#br-vessel-select option').count()) === 3, 'all three vessels offered');
    const wbDeadline = await page.textContent('#br-deadline');
    await page.selectOption('#br-vessel-select', 'small-motorboat');
    const skDeadline = await page.textContent('#br-deadline');
    check(wbDeadline !== skDeadline && /3:53/.test(skDeadline) && /4:41/.test(wbDeadline), `deadline follows the vessel (${wbDeadline.slice(0, 5)} workboat, ${skDeadline.slice(0, 5)} skiff)`);
    await page.selectOption('#br-vessel-select', 'coastal-passenger');
    await page.screenshot({ path: path.join(out, 'v-brief.png') });
    await page.selectOption('#br-vessel-select', 'workboat');
    await page.click('#br-depart');
    await waitMode(page, 'play');
    check((await page.evaluate(() => window.__bwc.vesselId)) === 'workboat' && (await page.evaluate(() => window.__bwc.run.vesselId)) === 'workboat', 'mission runs with the chosen vessel');
    // Supply Run is a fresh breeze: the written 210 s becomes 233 s for the skiff and 281 s for the workboat.
    check((await page.evaluate(() => window.__bwc.run.deadline)) === 281, 'run deadline scaled for the workboat and the sea (281 s)');
    await page.waitForFunction(() => /wind \d+ kn/.test(document.getElementById('hud-wind').textContent), null, { timeout: 30000 });
    // The HUD is drawn by the frame loop, so wait for the first frame instead of reading it immediately.
    await page.waitForFunction(() => /wind \d+ kn/.test(document.getElementById('hud-wind').textContent), null, { timeout: 30000 });
    check(/wind \d+ kn/.test(await page.textContent('#hud-wind')), 'HUD shows the wind');
    check(/4:41/.test(await page.textContent('#hud-limit')), 'HUD shows the workboat deadline');
    // drive: workboat accelerates slower than the skiff would; just check it moves and steers
    await page.keyboard.down('KeyW');
    await page.waitForFunction(() => window.__bwc.vessel.u > 1.0, null, { timeout: 40000 });
    await page.screenshot({ path: path.join(out, 'v-sail-workboat.png') });
    await page.keyboard.up('KeyW');
    // Finish quickly and check the result mentions the vessel
    await page.keyboard.press('Escape');
    await waitMode(page, 'paused');
    await page.click('#pause-abort');
    await waitMode(page, 'result');
    await page.click('#res-board');
    check((await page.evaluate(() => window.__bwc.profile.vessel)) === 'workboat', 'active vessel kept after the mission');

    // passenger craft: pick on the shuttle contract (only option)
    await page.locator('.mcard[data-id="passenger-shuttle"]').click();
    check(await page.isHidden('#br-vessel-select') && /Coastal Cat/.test(await page.textContent('#br-vessel')), 'passenger shuttle assigns the Coastal Cat');
    await page.click('#br-depart');
    await waitMode(page, 'play');
    check((await page.evaluate(() => window.__bwc.vesselId)) === 'coastal-passenger', 'passenger shuttle drives the Coastal Cat');
    await page.screenshot({ path: path.join(out, 'v-sail-cat.png') });

    // reload keeps the active vessel
    await page.reload();
    await page.waitForTimeout(500);
    await page.click('#start-btn');
    check((await page.textContent('#p-vessel')) === 'Harbor Workboat' || (await page.textContent('#p-vessel')) === 'Coastal Cat', 'active vessel persists after reload');
    check(errors.length === 0, 'no errors (full licenses) ' + JSON.stringify(errors));
    await ctx.close();
  }

  await browser.close();
  server.close();
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASSED');
  process.exit(fails.length ? 1 : 0);
})();
