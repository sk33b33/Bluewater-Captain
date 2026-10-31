// Headless end-to-end test of Stage 7: the fleet scale chart, ships, deep-water terminals, shoals,
// draft-aware route planning, cargo strain and the Large Vessel Endorsement path.
// Run: npm run build && node tests/e2e/ships.cjs [outDir]
const { chromium } = require('playwright');
const path = require('path');
const { startServer } = require('./serve.cjs');
const out = process.argv[2] || '.';
const fails = [];
const check = (cond, msg) => { if (!cond) { fails.push(msg); console.log('FAIL', msg); } else console.log('ok  ', msg); };
const held = () => ({ held: true, heldAt: 1, grandfathered: false, written: { attempts: 1, bestScore: 5, passed: true }, practical: { attempts: 1, bestScore: 90, passed: true } });
const captain = { version: 3, credits: 9000, reputation: 80, xp: 0, completed: {}, vessel: 'small-motorboat', licenses: { 'small-craft-permit': held(), 'coastal-skipper': held(), 'large-vessel': held() } };
const skipper = { version: 3, credits: 2000, reputation: 30, xp: 0, completed: {}, vessel: 'small-motorboat', licenses: { 'small-craft-permit': held(), 'coastal-skipper': held() } };

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
  const waitMode = (page, m, t = 60000) => page.waitForFunction((x) => window.__bwc.mode === x, m, { timeout: t });
  const visit = async (page, wps) => {
    for (let i = 0; i < wps.length; i++) {
      await page.evaluate((w) => { const v = window.__bwc.vessel; v.x = w.x; v.z = w.z; v.u = 0; v.v = 0; v.r = 0; }, wps[i]);
      await page.waitForFunction((n) => { const r = window.__bwc.run; return !r || r.route.next > n || r.phase !== 'underway'; }, i, { timeout: 40000 });
    }
  };

  // ---- a licensed captain with the biggest ships
  {
    const { ctx, page, errors } = await open(browser, server.url, captain);
    check((await page.locator('.mcard').count()) === 22, 'board lists 22 missions');
    check((await page.locator('.mcard.locked[data-id="coaster-cargo"]').count()) === 0 && (await page.locator('.mcard.locked[data-id="container-feeder"]').count()) === 0, 'deep-water contracts are open with the endorsement and reputation 80');
    check(/Route 3\.\d km/.test(await page.textContent('.mcard[data-id="container-feeder"]')), 'ship jobs show their route length');

    // fleet
    await page.click('#board-fleet');
    check((await page.locator('.vcard').count()) === 5, 'fleet shows 5 vessels');
    const ink = await page.evaluate(() => { const c = document.getElementById('fleet-scale'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; const colours = new Set(); for (let i = 0; i < d.length; i += 4 * 53) colours.add(`${d[i]},${d[i + 1]},${d[i + 2]}`); return colours.size; });
    check(ink > 5, `the size comparison is drawn (${ink} colours)`);
    check(/Coastal Freighter/.test(await page.textContent('#fleet-list')) && /Feeder Carrier/.test(await page.textContent('#fleet-list')), 'the freighter and the feeder are in the fleet');
    check(/140 m long, 22 m wide, draft 8 m/.test(await page.textContent('.vcard[data-id="container-carrier"]')), 'ship dimensions are shown');
    await page.screenshot({ path: path.join(out, 'sh-fleet.png') });
    await page.click('#use-container-carrier');
    check((await page.evaluate(() => window.__bwc.vesselId)) === 'container-carrier', 'the Feeder Carrier can be chosen as the active vessel');
    await page.click('#fleet-back');

    // harbors refuse ships
    await page.locator('.mcard[data-id="supply-run"]').click();
    check((await page.locator('#br-vessel-select option').count()) === 3, 'the harbor supply run offers only the small craft (ships do not fit)');
    await page.click('#br-back');

    // the container job: briefing, chart, route
    await page.locator('.mcard[data-id="container-feeder"]').click();
    check(await page.isHidden('#br-vessel-select') && /Feeder Carrier/.test(await page.textContent('#br-vessel')), 'the container job assigns the Feeder Carrier');
    const tip = await page.textContent('#br-dock-tip');
    check(/Cargo: hard turns at speed shift it/.test(tip) && /draws 8 m/.test(tip) && /dredged channel/.test(tip), 'the briefing warns about cargo, draft and the channel');
    check(/Shortest route: 3\.\d km/.test(await page.textContent('#br-routetext')), 'a default route is planned');
    await page.click('#br-plan');
    check((await page.locator('#chart-routes button').count()) >= 2, 'the chart offers a second route for the ship');
    await page.click('#chart-reset');
    while ((await page.evaluate(() => window.__bwc.plan.path.length)) > 1) await page.click('#chart-undo');
    const options = await page.$$eval('#chart-next option', (o) => o.map((x) => x.textContent));
    check(options.length === 1 && /Channel west/.test(options[0]), 'from the terminal approach a ship can only go on down the channel: ' + options.join(' | '));
    await page.screenshot({ path: path.join(out, 'sh-chart.png') });
    await page.click('#route-1');
    check((await page.evaluate(() => window.__bwc.plan.path.join('>'))) === 'CT>CW>DT>TE>D', 'the alternative takes the Tern route');
    await page.click('#chart-confirm');
    check(/Alternative 1: 3\.\d km/.test(await page.textContent('#br-routetext')), 'the chosen route comes back to the briefing');
    await page.click('#br-plan');
    await page.click('#route-0');
    await page.click('#chart-confirm');

    // sail it
    await page.click('#br-depart');
    await waitMode(page, 'play');
    const m = await page.evaluate(() => ({ dock: window.__bwc.run.mission.dock, start: window.__bwc.run.mission.start, len: window.__bwc.run.vesselLength, limit: window.__bwc.run.cargoLimit, dl: window.__bwc.run.deadline, wps: window.__bwc.run.mission.waypoints }));
    check(m.dock === 'driftwood' && m.start.x === 2570 && m.start.z === 488, 'the ship starts at the deep-water terminal and heads for the Driftwood berth');
    check(m.len === 140 && m.limit > 0, 'the run knows the ship is 140 m long and carries strain-sensitive cargo');
    await page.waitForFunction(() => /Cargo 100%/.test(document.getElementById('hud-cargo').textContent), null, { timeout: 30000 });
    check(true, 'the HUD shows the cargo condition');
    await page.waitForFunction(() => /Cape Quay slow zone: limit 10 kn/.test(document.getElementById('hud-zone').textContent), null, { timeout: 30000 });
    check(true, 'the deep terminal has its own 10 kn slow zone');
    await page.screenshot({ path: path.join(out, 'sh-start.png') });

    // cargo strain: hard turn at speed
    await page.evaluate(() => { const v = window.__bwc.vessel; v.u = 8; v.r = 0.1; });
    await page.waitForFunction(() => window.__bwc.run.roughTime > 0.05, null, { timeout: 30000 });
    await page.waitForFunction(() => /shifting/.test(document.getElementById('hud-cargo').textContent) || window.__bwc.run.roughTime > 0.3, null, { timeout: 30000 });
    check(/Easy on the helm|cargo/i.test(await page.textContent('#hud-cargo')), 'turning hard at speed strains the cargo and the HUD says so');
    await page.evaluate(() => { const v = window.__bwc.vessel; v.u = 0; v.r = 0; });

    // run aground on a shoal
    await page.evaluate(() => { const v = window.__bwc.vessel; v.x = 2200; v.z = 200; v.u = 4; });
    await page.waitForFunction(() => window.__bwc.run.collisions > 0 || window.__bwc.run.integrity < 100, null, { timeout: 30000 });
    check(true, 'a ship that drifts onto a shoal runs aground and damages the hull');
    await page.screenshot({ path: path.join(out, 'sh-aground.png') });

    // finish
    await visit(page, m.wps);
    check((await page.evaluate(() => window.__bwc.run.phase)) === 'docking', 'all markers passed: docking at Driftwood Terminal');
    const b = await page.evaluate(() => window.__bwc.BERTHS.driftwood);
    await page.evaluate((b) => { const v = window.__bwc.vessel; v.x = b.cx; v.z = b.cz; v.heading = b.heading; v.u = 0; v.v = 0; }, b);
    await waitMode(page, 'result');
    check(/Mission complete/.test(await page.textContent('#res-title')), 'docked at Driftwood Terminal: mission complete');
    check(/Cargo/.test(await page.textContent('#res-rows')) && (await page.locator('#res-rows tr').count()) === 5, 'results include a Cargo line (5 categories)');
    check((await page.evaluate(() => window.__bwc.profile.credits)) > 9000 + 3000, 'a big contract pays big credits');
    await page.screenshot({ path: path.join(out, 'sh-result.png') });
    await page.click('#res-board');

    // small craft still use the small Cape berth
    await page.locator('.mcard[data-id="cape-parcels"]').click();
    await page.selectOption('#br-vessel-select', 'small-motorboat');
    await page.click('#br-depart');
    await waitMode(page, 'play');
    check((await page.evaluate(() => window.__bwc.run.mission.dock)) === 'cape' && (await page.evaluate(() => window.__bwc.vesselId)) === 'small-motorboat', 'a skiff on a Cape job still docks at the small pier');
    await page.keyboard.press('Escape');
    await waitMode(page, 'paused');
    await page.click('#pause-abort');
    await waitMode(page, 'result');
    await page.click('#res-board');

    // the chart view lists the new port and shows shoals
    await page.click('#board-chart');
    check((await page.locator('#chart-ports li').count()) === 5 && /Driftwood Terminal/.test(await page.textContent('#chart-ports')) && /Deep-water terminal/.test(await page.textContent('#chart-ports')), 'the chart lists Driftwood Terminal and the deep-water terminal at Cape Quay');
    await page.screenshot({ path: path.join(out, 'sh-chartview.png') });
    check(errors.length === 0, 'no errors (captain) ' + JSON.stringify(errors));
    await ctx.close();
  }

  // ---- earning the endorsement
  {
    const { ctx, page, errors } = await open(browser, server.url, skipper);
    check((await page.locator('.mcard.locked[data-id="coaster-cargo"]').count()) === 1, 'deep-water contracts are locked without the endorsement');
    check(/Large Vessel Endorsement/.test(await page.textContent('.mcard[data-id="coaster-cargo"] .lock-note')), 'the lock says which license is needed');
    check((await page.locator('.mcard.locked[data-id="cargo-trials"]').count()) === 0, 'the freighter trials open once you meet the prerequisites (Skipper, reputation 30)');
    await page.click('#board-licenses');
    check(/Large Vessel Endorsement/.test(await page.textContent('#lic-list')) && /Available/.test(await page.textContent('.lcard[data-id="large-vessel"] h3')), 'the Licenses screen shows the endorsement as available');
    check(/Freighter Sea Trials|Feeder Carrier Sea Trials/.test(await page.textContent('.lcard[data-id="large-vessel"]')), 'its training tasks are listed');
    check(!(await page.isDisabled('#written-large-vessel')), 'the written test is available');
    check(await page.isDisabled('#exam-large-vessel'), 'the exam is locked until training and the test are done');
    await page.click('#lic-back');
    await page.locator('.mcard[data-id="cargo-trials"]').click();
    check(/Coastal Freighter/.test(await page.textContent('#br-vessel')) && !(await page.isDisabled('#br-depart')), 'the trials use the freighter under instruction');
    await page.click('#br-depart');
    await waitMode(page, 'play');
    check((await page.evaluate(() => window.__bwc.vesselId)) === 'cargo-ship' && (await page.evaluate(() => window.__bwc.run.mission.dock)) === 'capeDeep', 'the trials start at the deep-water berth with the freighter');
    await page.screenshot({ path: path.join(out, 'sh-trials.png') });
    check(errors.length === 0, 'no errors (skipper) ' + JSON.stringify(errors));
    await ctx.close();
  }

  await browser.close();
  server.close();
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASSED');
  process.exit(fails.length ? 1 : 0);
})();
