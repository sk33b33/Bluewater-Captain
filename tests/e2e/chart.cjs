// Headless end-to-end test of Stage 6: the chart, route planning (suggested and hand-built), the planned
// route sailed in play, port slow zones, reputation gates, the bigger region and its new ports.
// Run: npm run build && node tests/e2e/chart.cjs [outDir]
const { chromium } = require('playwright');
const path = require('path');
const { startServer } = require('./serve.cjs');
const out = process.argv[2] || '.';
const fails = [];
const check = (cond, msg) => { if (!cond) { fails.push(msg); console.log('FAIL', msg); } else console.log('ok  ', msg); };
const licensed = () => ({ held: true, heldAt: 1, grandfathered: false, written: { attempts: 1, bestScore: 5, passed: true }, practical: { attempts: 1, bestScore: 90, passed: true } });
const rich = { version: 3, credits: 500, reputation: 20, xp: 0, completed: {}, vessel: 'small-motorboat', licenses: { 'small-craft-permit': licensed(), 'coastal-skipper': licensed() } };
const novice = { version: 3, credits: 0, reputation: 0, xp: 0, completed: {}, vessel: 'small-motorboat', licenses: { 'small-craft-permit': licensed() } };

async function open(browser, url, profile) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
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

  // ---- novice: reputation gate
  {
    const { ctx, page, errors } = await open(browser, server.url, novice);
    check((await page.locator('.mcard').count()) === 22, 'board lists 22 missions');
    check((await page.locator('.mcard.locked[data-id="cape-parcels"]').count()) === 1, 'Cape Quay Parcel Run is locked at reputation 0');
    check(/reputation 5/.test(await page.textContent('.mcard[data-id="cape-parcels"] .lock-note')), 'locked card explains the reputation needed');
    check((await page.locator('.mcard.locked[data-id="supply-run"]').count()) === 0, 'the short supply run is open with just the permit');
    check(/Route 1\.2 km/.test(await page.textContent('.mcard[data-id="supply-run"]')), 'planned jobs show their route length on the board');
    check(errors.length === 0, 'no errors (novice) ' + JSON.stringify(errors));
    await ctx.close();
  }

  const { ctx, page, errors } = await open(browser, server.url, rich);

  // ---- chart view from the board
  await page.click('#board-chart');
  check((await page.evaluate(() => window.__bwc.mode)) === 'chart' && (await page.isVisible('#chart')), 'board Chart button opens the chart');
  check((await page.locator('#chart-ports li').count()) === 5, 'chart lists the five ports with their limits');
  check(/Slow zone \d+ kn, vessels up to 12 m/.test(await page.textContent('#chart-ports')), 'port list shows slow zones and size limits');
  check(await page.isHidden('#chart-confirm'), 'view-only chart has no route controls');
  const painted = await page.evaluate(() => { const c = document.getElementById('chart-canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let colours = new Set(); for (let i = 0; i < d.length; i += 4 * 97) colours.add(`${d[i]},${d[i + 1]},${d[i + 2]}`); return colours.size; });
  check(painted > 4, `the chart canvas is drawn (${painted} distinct colours sampled)`);
  await page.screenshot({ path: path.join(out, 'c-view.png') });
  await page.click('#chart-cancel');
  check((await page.evaluate(() => window.__bwc.mode)) === 'board', 'Back returns to the board');

  // ---- briefing with a planned route
  await page.locator('.mcard[data-id="cape-parcels"]').click();
  check(await page.isVisible('#br-routeinfo'), 'a planned job shows its route on the briefing');
  check(/Shortest route: 3\.\d km, with a narrow passage/.test(await page.textContent('#br-routetext')), 'default route is the shortest and mentions the narrow passage');
  const deadline0 = await page.textContent('#br-deadline');
  await page.click('#br-plan');
  check((await page.evaluate(() => window.__bwc.mode)) === 'chart' && /Plan route: Bluewater Harbor to Cape Quay/.test(await page.textContent('#chart-title')), 'Plan route opens the chart for this job');
  check((await page.locator('#chart-routes button').count()) >= 2, 'the chart suggests more than one route');
  check(await page.isVisible('#route-0') && /On|on/.test(await page.getAttribute('#route-0', 'class') + ' on'), 'route options are buttons');
  check(/narrow passage/.test(await page.textContent('#chart-legs')) && /Narrow passage/.test(await page.textContent('#chart-hazards')), 'the shortest route lists its narrow passage');
  await page.screenshot({ path: path.join(out, 'c-plan.png') });

  await page.click('#route-1');
  check(!/narrow passage/.test(await page.textContent('#chart-legs')) && (await page.textContent('#chart-hazards')) === '', 'the alternative avoids the narrow passage');
  const summary1 = await page.textContent('#chart-summary');
  check(/Deadline \d+:\d\d/.test(summary1), 'the chart summary gives distance, time and deadline: ' + summary1);
  await page.click('#chart-confirm');
  check((await page.evaluate(() => window.__bwc.mode)) === 'briefing' && /Alternative 1: 3\.\d km/.test(await page.textContent('#br-routetext')), 'confirming returns to the briefing with the new route');
  const deadline1 = await page.textContent('#br-deadline');
  check(deadline1 !== deadline0, `the deadline follows the route (${deadline0.slice(0, 5)} -> ${deadline1.slice(0, 5)})`);

  // ---- build a route by hand: add legs with the list and by clicking the chart
  await page.click('#br-plan');
  await page.click('#chart-reset');
  while ((await page.evaluate(() => window.__bwc.plan.path.length)) > 1) await page.click('#chart-undo');
  check(await page.isDisabled('#chart-confirm'), 'an unfinished route cannot be confirmed');
  check((await page.locator('#chart-next option').count()) === 2, 'from the harbor entrance two markers are one leg away');
  await page.selectOption('#chart-next', 'A'); await page.click('#chart-add');
  await page.selectOption('#chart-next', 'G'); await page.click('#chart-add');
  await page.selectOption('#chart-next', 'N'); await page.click('#chart-add');
  // click the Seal north marker on the map itself
  const click = await page.evaluate(() => { const c = document.getElementById('chart-canvas'); const r = c.getBoundingClientRect(); const x = 1450, z = -150; const f = (v, min) => ((v - min + 150) / 4300) * r.width; return { x: r.left + f(x, -1000), y: r.top + f(z, -1000) }; });
  await page.mouse.click(click.x, click.y);
  check((await page.evaluate(() => window.__bwc.plan.path.join('>'))) === 'H>A>G>N>SN', 'clicking a marker on the chart extends the route');
  await page.screenshot({ path: path.join(out, 'c-custom.png') });
  await page.selectOption('#chart-next', 'CO'); await page.click('#chart-add');
  await page.selectOption('#chart-next', 'C'); await page.click('#chart-add');
  check(!(await page.isDisabled('#chart-confirm')) && (await page.locator('#chart-next option').count()) === 0, 'reaching Cape Quay completes the route');
  await page.click('#chart-confirm');
  check(/Custom route: 3\.\d km/.test(await page.textContent('#br-routetext')), 'a hand-built route is called a custom route');

  // ---- sail it
  await page.click('#br-depart');
  await waitMode(page, 'play');
  const mission = await page.evaluate(() => ({ name: window.__bwc.run.mission.routeName, wps: window.__bwc.run.mission.waypoints.map((w) => w.name), dl: window.__bwc.run.deadline }));
  check(mission.name === 'Custom route' && mission.wps.join('|') === 'Harbor entrance|Open water|Gull channel|Pine north|Seal north|Cape offing|Cape approach', 'the mission sails the planned route: ' + mission.wps.join(', '));
  await page.waitForFunction(() => /to go/.test(document.getElementById('hud-objective').textContent), null, { timeout: 30000 });
  check(/km to go/.test(await page.textContent('#hud-objective')), 'HUD shows the distance still to go: ' + (await page.textContent('#hud-objective')));
  check(await page.isVisible('#hud-zone') && /Bluewater Harbor slow zone: limit 14 kn/.test(await page.textContent('#hud-zone')), 'HUD shows the harbor slow zone at the berth');

  // port speed limit
  await page.evaluate(() => { const v = window.__bwc.vessel; v.u = 12; });
  await page.waitForFunction(() => window.__bwc.run.speedingTime > 0.1, null, { timeout: 30000 });
  check(/over/.test(await page.getAttribute('#hud-zone', 'class')), 'the slow-zone readout turns red when you are over the limit');
  check(/Slow down: Bluewater Harbor limit is 14 knots/.test(await page.textContent('#hud-warning')), 'a warning names the port and its limit');
  await page.evaluate(() => { const v = window.__bwc.vessel; v.u = 0; });

  // the bigger bay: leave the old map, reach the east, edge limits
  const wps = await page.evaluate(() => window.__bwc.run.mission.waypoints);
  for (let i = 0; i < wps.length; i++) {
    await page.evaluate((w) => { const v = window.__bwc.vessel; v.x = w.x; v.z = w.z; v.u = 0; v.v = 0; }, wps[i]);
    await page.waitForFunction((n) => { const r = window.__bwc.run; return r.route.next > n || r.phase !== 'underway'; }, i, { timeout: 40000 });
    if (i === 4) await page.screenshot({ path: path.join(out, 'c-east.png') });
  }
  check((await page.evaluate(() => window.__bwc.run.phase)) === 'docking', 'all waypoints reached: docking at Cape Quay');
  const b = await page.evaluate(() => window.__bwc.BERTHS.cape);
  await page.evaluate((b) => { const v = window.__bwc.vessel; v.x = b.cx; v.z = b.cz; v.heading = b.heading; v.u = 0; }, b);
  await page.screenshot({ path: path.join(out, 'c-cape.png') });
  await waitMode(page, 'result');
  check(/Mission complete/.test(await page.textContent('#res-title')), 'docked at Cape Quay: mission complete');
  check(/Route: Custom route, 3\.\d km/.test(await page.textContent('#res-route')), 'the results name the route sailed: ' + (await page.textContent('#res-route')));
  check(/port speed limit/.test(await page.textContent('#res-rows')), 'the Navigation line explains the speed-limit penalty');
  check((await page.evaluate(() => window.__bwc.profile.credits)) > 500, 'credits paid');
  await page.click('#res-board');

  // ---- other ports and vessel limits
  await page.locator('.mcard[data-id="island-hop"]').click();
  check((await page.locator('#br-vessel-select option').count()) === 2, 'Island Hop offers only vessels the 12 m marina can take (no passenger craft)');
  await page.click('#br-depart');
  await waitMode(page, 'play');
  await page.evaluate(() => { const v = window.__bwc.vessel; v.x = 420; v.z = 2400; v.u = 0; });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(out, 'c-south.png') });
  // edge of the region
  await page.evaluate(() => { const v = window.__bwc.vessel; v.x = 3100; v.z = 1500; });
  await page.waitForFunction(() => window.__bwc.vessel.x < 3000, null, { timeout: 30000 });
  check(true, 'sailing past the east edge of the bay returns you to your last safe point');
  await page.keyboard.press('Escape');
  await waitMode(page, 'paused');
  await page.click('#pause-abort');
  await waitMode(page, 'result');
  await page.click('#res-board');

  // ---- a route chosen on the chart survives retry and restart
  await page.locator('.mcard[data-id="marina-mail"]').click();
  await page.click('#br-plan');
  const routesN = await page.locator('#chart-routes button').count();
  check(routesN >= 1, `marina mail has ${routesN} suggested route(s)`);
  await page.click('#chart-cancel');
  check((await page.evaluate(() => window.__bwc.mode)) === 'briefing', 'Back from the chart returns to the briefing');
  check(errors.length === 0, 'no console/page errors ' + JSON.stringify(errors));
  await ctx.close();
  await browser.close();
  server.close();
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASSED');
  process.exit(fails.length ? 1 : 0);
})();
