// Headless end-to-end test of the Stage 2 loop. Boat positions are set through the debug hook so the
// test is fast and deterministic; the real sailing/docking physics is covered by unit tests.
// Run: npm run build && node tests/e2e/mission.cjs [outDir]
const { chromium } = require('playwright');
const path = require('path');
const out = process.argv[2] || '.';
const url = 'file://' + path.resolve(__dirname, '../../dist/index.html');
const fails = [];
const check = (cond, msg) => { if (!cond) { fails.push(msg); console.log('FAIL', msg); } else console.log('ok  ', msg); };

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const vis = (id) => page.evaluate((i) => !document.getElementById(i).classList.contains('hidden'), id);
  const mode = () => page.evaluate(() => window.__bwc.mode);
  const waitMode = (m) => page.waitForFunction((x) => window.__bwc.mode === x, m, { timeout: 30000 });
  const tele = (x, z, h) => page.evaluate(([x, z, h]) => { const v = window.__bwc.vessel; v.x = x; v.z = z; if (h !== undefined) v.heading = h; v.u = 0; v.v = 0; v.r = 0; }, [x, z, h]);

  await page.goto(url);
  await page.waitForTimeout(800);
  check(await vis('start'), 'title card shows');
  await page.click('#start-btn');
  check((await mode()) === 'board' && (await vis('board')), 'mission board opens');
  check((await page.locator('.mcard').count()) === 3, 'board lists 3 missions');
  await page.screenshot({ path: path.join(out, 'm-board.png') });

  await page.locator('.mcard').first().click();
  check((await mode()) === 'briefing', 'briefing opens');
  check((await page.textContent('#br-title')) === 'Pine Isle Supply Run', 'briefing shows mission title');
  await page.screenshot({ path: path.join(out, 'm-briefing.png') });
  await page.click('#br-depart');
  check((await mode()) === 'play', 'departing starts the mission');

  // sail through every waypoint (teleport), expect docking phase
  const wps = await page.evaluate(() => window.__bwc.run.mission.waypoints);
  for (const wp of wps) { await tele(wp.x, wp.z); await page.waitForTimeout(250); }
  check((await page.evaluate(() => window.__bwc.run.phase)) === 'docking', 'all waypoints -> docking phase');
  const b = await page.evaluate(() => window.__bwc.BERTHS.pine);
  // too fast first: hold must not complete
  await page.evaluate((b) => { const v = window.__bwc.vessel; v.x = b.cx; v.z = b.cz; v.heading = b.heading; v.u = 0; }, b);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(out, 'm-docking.png') });
  const hold = await page.evaluate(() => window.__bwc.run.dockHold);
  check(hold > 0, `docking hold accumulates when parked in berth (${hold.toFixed(2)}s)`);
  await waitMode('result');
  check(await vis('result'), 'result screen shows after docking');
  check(/Mission complete/.test(await page.textContent('#res-title')), 'result says complete');
  const credits1 = await page.evaluate(() => window.__bwc.profile.credits);
  check(credits1 > 0, `credits awarded (${credits1})`);
  check((await page.locator('#res-rows tr').count()) === 4, 'score breakdown has 4 categories');
  await page.screenshot({ path: path.join(out, 'm-result.png') });

  // persistence across reload
  await page.reload();
  await page.waitForTimeout(500);
  await page.click('#start-btn');
  check((await page.textContent('#p-credits')) === String(credits1), 'credits persist after page reload');
  check(/Best/.test(await page.locator('.mcard .badge').first().textContent()), 'board shows best grade on completed mission');

  // repeat the mission: fresh state
  await page.locator('.mcard').first().click();
  await page.click('#br-depart');
  check((await page.evaluate(() => window.__bwc.run.integrity)) === 100 && (await page.evaluate(() => window.__bwc.run.time)) === 0, 'second attempt starts with fresh state');

  // pause -> restart -> abort -> fail screen -> retry
  await page.keyboard.press('Escape');
  await waitMode('paused');
  check((await mode()) === 'paused' && (await vis('pause')), 'Esc pauses');
  await page.keyboard.press('Escape');
  await waitMode('play');
  check((await mode()) === 'play' && !(await vis('pause')), 'Esc resumes');
  await tele(wps[0].x, wps[0].z); await page.waitForTimeout(300);
  await page.click('#menu-btn');
  await page.click('#pause-restart');
  check((await page.evaluate(() => window.__bwc.run.route.next)) === 0, 'restart resets waypoint progress');
  await page.click('#menu-btn');
  await page.click('#pause-abort');
  await waitMode('result');
  check(/failed/.test(await page.textContent('#res-title')) && (await page.textContent('#res-reason')).includes('aborted'), 'abort shows failed screen');
  check((await page.evaluate(() => window.__bwc.profile.credits)) === credits1, 'failed/aborted mission pays nothing');
  await page.click('#res-retry');
  check((await mode()) === 'play', 'retry restarts the mission after a failure');

  // training mission completes at last waypoint (no docking)
  await page.click('#menu-btn'); await page.click('#pause-abort'); await waitMode('result');
  await page.click('#res-board');
  await page.locator('.mcard').nth(2).click();
  await page.click('#br-depart');
  const twps = await page.evaluate(() => window.__bwc.run.mission.waypoints);
  for (const wp of twps) { await tele(wp.x, wp.z); await page.waitForTimeout(250); }
  await waitMode('result');
  check(/complete/.test(await page.textContent('#res-title')), 'training loop completes without docking');

  check(errors.length === 0, 'no console/page errors ' + JSON.stringify(errors));
  await browser.close();
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASSED');
  process.exit(fails.length ? 1 : 0);
})();
