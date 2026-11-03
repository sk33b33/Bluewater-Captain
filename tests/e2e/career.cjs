// Headless end-to-end test of Stage 8: ranks, featured contracts, heavy-weather jobs, hull wear and repairs,
// upgrades, first-time hints and the accessibility settings.
// Run: npm run build && node tests/e2e/career.cjs [outDir]
const { chromium } = require('playwright');
const path = require('path');
const { startServer } = require('./serve.cjs');
const out = process.argv[2] || '.';
const fails = [];
const check = (cond, msg) => { if (!cond) { fails.push(msg); console.log('FAIL', msg); } else console.log('ok  ', msg); };
const licensed = () => ({ held: true, heldAt: 1, grandfathered: false, written: { attempts: 1, bestScore: 5, passed: true }, practical: { attempts: 1, bestScore: 90, passed: true } });

async function open(browser, url, profile, viewport = { width: 1280, height: 800 }) {
  const ctx = await browser.newContext({ viewport });
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
  const prof = (extra = {}) => ({ version: 4, credits: 1500, reputation: 20, xp: 0, completed: {}, vessel: 'small-motorboat', licenses: { 'small-craft-permit': licensed(), 'coastal-skipper': licensed() }, hull: {}, upgrades: {}, jobs: 0, hintsSeen: [], ...extra });

  // ---- board: rank, featured badge, heavy-weather jobs
  {
    const { ctx, page, errors } = await open(browser, server.url, prof());
    check(/Skipper/.test(await page.textContent('#p-rank')), 'the board shows a rank for reputation 20: ' + (await page.textContent('#p-rank')));
    const nFeat = await page.locator('.mcard .badge.featured').count();
    check(nFeat >= 1 && nFeat <= 2, `${nFeat} featured contracts on the board`);
    check((await page.locator('.mcard.locked .badge.featured').count()) === 0, 'locked jobs are never featured');
    check((await page.locator('.mcard[data-id="storm-haul"]').count()) === 1, 'the storm haul is on the board');
    check(/Heavy weather/.test(await page.textContent('.mcard[data-id="storm-haul"] .t')), 'storm jobs are labelled');
    await page.screenshot({ path: path.join(out, 'c-board.png') });
    check(errors.length === 0, 'no errors on the board ' + JSON.stringify(errors));
    await ctx.close();
  }

  // ---- fleet: hull, repairs, upgrades
  {
    const { ctx, page, errors } = await open(browser, server.url, prof({ hull: { 'small-motorboat': 40 } }));
    await page.click('#board-fleet');
    check(/40%/.test(await page.textContent('#hull-small-motorboat')), 'the fleet shows the skiff at 40 percent');
    const c0 = await page.evaluate(() => window.__bwc.profile.credits);
    await page.click('#repair-small-motorboat');
    const after = await page.evaluate(() => ({ c: window.__bwc.profile.credits, h: window.__bwc.profile.hull['small-motorboat'] }));
    check(after.h === 100, 'Repair restores the hull to 100 (' + after.h + ')');
    check(c0 - after.c === 240, 'a 60 percent repair costs 240 credits (' + (c0 - after.c) + ')');
    check((await page.locator('#repair-small-motorboat').count()) === 0, 'no repair button on a whole hull');
    check(/Repaired/.test(await page.textContent('#fleet-credits')), 'the screen says what happened');
    await page.click('#buy-small-motorboat-hull-plating');
    check((await page.evaluate(() => window.__bwc.profile.upgrades['small-motorboat'])).includes('hull-plating'), 'buying hull plating fits it');
    check((await page.locator('.vcard[data-id="small-motorboat"] .fitted').count()) === 1, 'the fleet shows it as fitted');
    check((await page.isDisabled('#buy-small-motorboat-engine-tune')) === false, 'other upgrades can still be bought');
    await page.screenshot({ path: path.join(out, 'c-fleet.png'), fullPage: false });
    // survives a reload
    await page.reload();
    await page.waitForTimeout(500);
    await page.click('#start-btn');
    check((await page.evaluate(() => window.__bwc.profile.upgrades['small-motorboat'] || [])).includes('hull-plating'), 'upgrades persist after a reload');
    check(errors.length === 0, 'no errors in the fleet ' + JSON.stringify(errors));
    await ctx.close();
  }

  // ---- broke and wrecked: free patch
  {
    const { ctx, page } = await open(browser, server.url, prof({ credits: 0, hull: { 'small-motorboat': 20 } }));
    await page.click('#board-fleet');
    check((await page.locator('#patch-small-motorboat').count()) === 1, 'a broke player with a wreck is offered a free patch');
    await page.click('#patch-small-motorboat');
    check((await page.evaluate(() => window.__bwc.profile.hull['small-motorboat'])) === 50, 'the patch brings the hull to 50');
    check((await page.locator('#patch-small-motorboat').count()) === 0, 'the patch is not offered again');
    await ctx.close();
  }

  // ---- play: worn hull carries into a run, hints, abort keeps the damage
  {
    const { ctx, page, errors } = await open(browser, server.url, prof({ hull: { 'small-motorboat': 40 } }));
    await page.locator('.mcard[data-id="dock-drill"]').click();
    check(/40% hull/.test(await page.textContent('#br-sea')), 'the briefing warns about a worn hull');
    await page.click('#br-depart');
    await waitMode(page, 'play');
    check((await page.evaluate(() => window.__bwc.run.hull0)) === 40, 'the run starts from the 40 percent hull');
    await page.waitForFunction(() => /^40%/.test(document.getElementById('hud-hull').textContent), null, { timeout: 30000 });
    check(true, 'the HUD shows the real hull condition (40%)');
    await page.waitForFunction(() => /Push W/.test(document.getElementById('hud-warning').textContent), null, { timeout: 40000 });
    check(true, 'the first-time throttle hint appears when you have not moved');
    check((await page.evaluate(() => window.__bwc.profile.hintsSeen)).includes('throttle'), 'the hint is remembered');
    await page.keyboard.press('Escape');
    await waitMode(page, 'paused');
    await page.click('#pause-abort');
    await waitMode(page, 'result');
    check((await page.evaluate(() => window.__bwc.profile.hull['small-motorboat'])) === 40, 'aborting keeps the hull as it was');
    await page.click('#res-board');
    check(errors.length === 0, 'no errors in play ' + JSON.stringify(errors));
    await ctx.close();
  }

  // ---- finishing a featured job pays the bonus and the result mentions career info
  {
    const { ctx, page } = await open(browser, server.url, prof());
    const id = await page.locator('.mcard:has(.badge.featured)').first().getAttribute('data-id');
    await page.locator(`.mcard[data-id="${id}"]`).click();
    const text = await page.textContent('#br-reward');
    const shown = parseInt(text, 10);
    const base = await page.evaluate(() => window.__bwc.selected.baseReward);
    check(shown === Math.round(base * 1.35), `the featured reward is base ${base} plus 35 percent (shows ${shown})`);
    await page.click('#br-depart');
    await waitMode(page, 'play');
    await page.keyboard.press('Escape');
    await waitMode(page, 'paused');
    await page.click('#pause-restart');
    await waitMode(page, 'play');
    check((await page.evaluate(() => window.__bwc.mission.reward)) === shown, 'restarting does not stack the bonus');
    await ctx.close();
  }

  // ---- accessibility settings
  {
    const { ctx, page, errors } = await open(browser, server.url, prof());
    await page.click('#board-settings');
    await page.selectOption('#set-uiscale', '1.3');
    check(await page.evaluate(() => document.body.classList.contains('ui-xlarge')), 'Extra large text applies');
    await page.check('#set-contrast');
    check(await page.evaluate(() => document.body.classList.contains('hc')), 'High contrast applies');
    await page.screenshot({ path: path.join(out, 'c-access.png') });
    await page.reload();
    await page.waitForTimeout(500);
    check(await page.evaluate(() => document.body.classList.contains('ui-xlarge') && document.body.classList.contains('hc')), 'both settings are remembered');
    check(errors.length === 0, 'no errors in settings ' + JSON.stringify(errors));
    await ctx.close();
  }

  await browser.close();
  server.close();
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASSED');
  process.exit(fails.length ? 1 : 0);
})();
