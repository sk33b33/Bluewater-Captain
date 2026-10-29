// Headless end-to-end test of Stage 5: weather in briefings, sea effect and deadline, wake, quality presets,
// performance overlay, automatic quality, benchmark. Software rendering cannot judge GPU speed, so it checks
// that the machinery runs and the numbers are well formed.
// Run: npm run build && node tests/e2e/weather.cjs [outDir]
const { chromium } = require('playwright');
const path = require('path');
const { startServer } = require('./serve.cjs');
const out = process.argv[2] || '.';
const fails = [];
const check = (cond, msg) => { if (!cond) { fails.push(msg); console.log('FAIL', msg); } else console.log('ok  ', msg); };

const licensed = () => ({ held: true, heldAt: 1, grandfathered: false, written: { attempts: 1, bestScore: 5, passed: true }, practical: { attempts: 1, bestScore: 90, passed: true } });
const profile = { version: 3, credits: 500, reputation: 20, xp: 0, completed: {}, vessel: 'small-motorboat', licenses: { 'small-craft-permit': licensed(), 'coastal-skipper': licensed() } };

(async () => {
  const server = await startServer();
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript((p) => { if (!localStorage.getItem('bwc-profile')) localStorage.setItem('bwc-profile', JSON.stringify(p)); }, profile);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const waitMode = (m, t = 60000) => page.waitForFunction((x) => window.__bwc.mode === x, m, { timeout: t });
  const bwc = (fn) => page.evaluate(fn);

  await page.goto(server.url);
  await page.waitForTimeout(500);
  await page.click('#start-btn');

  // ---- settings: quality, overlay, benchmark button only outside a mission
  await page.click('#board-settings');
  check(await page.isVisible('#set-quality') && await page.isVisible('#set-fps'), 'settings has graphics quality and performance overlay');
  check(await page.isVisible('#bench-btn'), 'benchmark button is offered from the board settings');
  check((await page.inputValue('#set-quality')) === 'auto', 'default graphics quality is Auto');
  await page.selectOption('#set-quality', 'high');
  check((await bwc(() => window.__bwc.quality)) === 'high', 'choosing High applies High');
  await page.selectOption('#set-quality', 'low');
  check((await bwc(() => window.__bwc.quality)) === 'low', 'choosing Low applies Low');
  check((await bwc(() => window.__bwc.seaWaves.length)) === 3, 'Low uses 3 wave components');
  await page.selectOption('#set-quality', 'medium');
  check((await bwc(() => window.__bwc.seaWaves.length)) === 4, 'Medium uses 4 wave components');
  await page.check('#set-fps');
  await page.waitForFunction(() => /fps/.test(document.getElementById('perf').textContent), null, { timeout: 30000 });
  check(/Medium/.test(await page.textContent('#perf')), 'performance overlay shows fps and the quality preset');
  await page.click('#pause-close');

  // ---- briefing shows the forecast, sea effect and a deadline that follows vessel and sea
  await page.locator('.mcard[data-id="workboat-haul"]').click();
  check(/Moderate sea/.test(await page.textContent('#br-weather')), 'briefing forecast names the sea state');
  check(/Harbor Workboat: top speed -\d+%, steering -\d+%/.test(await page.textContent('#br-sea')), 'briefing explains the sea effect on the workboat');
  check(/waves slow small boats/i.test(await page.textContent('#br-sea')), 'briefing gives the weather tip');
  await page.click('#br-back');
  await page.locator('.mcard[data-id="supply-run"]').click();
  await page.selectOption('#br-vessel-select', 'small-motorboat');
  const skiffText = await page.textContent('#br-sea');
  await page.selectOption('#br-vessel-select', 'workboat');
  const boatText = await page.textContent('#br-sea');
  check(skiffText !== boatText && /Skiff/.test(skiffText) && /Workboat/.test(boatText), 'sea effect text follows the chosen vessel');
  await page.selectOption('#br-vessel-select', 'small-motorboat');
  const dlSkiff = await page.textContent('#br-deadline');
  await page.selectOption('#br-vessel-select', 'workboat');
  const dlBoat = await page.textContent('#br-deadline');
  check(dlSkiff !== dlBoat, `deadline follows vessel and sea (skiff ${dlSkiff.slice(0, 5)}, workboat ${dlBoat.slice(0, 5)})`);
  await page.click('#br-back');

  // ---- weather in play: waves, HUD, fog
  await page.locator('.mcard[data-id="workboat-haul"]').click();
  await page.click('#br-depart');
  await waitMode('play');
  check((await bwc(() => window.__bwc.weatherId)) === 'choppy', 'mission sets its weather');
  await page.waitForFunction(() => /wind \d+ kn .* sea 1\.4 m/.test(document.getElementById('hud-wind').textContent), null, { timeout: 30000 });
  check(true, 'HUD shows wind and sea height');
  const sea = await bwc(() => window.__bwc.sea);
  check(sea.speedFactor < 1 && sea.speedFactor > 0.6 && sea.steerFactor < 1, `sea slows and blunts the workboat (speed x${sea.speedFactor.toFixed(2)}, steering x${sea.steerFactor.toFixed(2)})`);
  const amp = await bwc(() => Math.max(...window.__bwc.seaWaves.map((w) => w.amp)));
  check(amp > 0.3, `waves are big in a moderate sea (largest component ${amp.toFixed(2)} m)`);
  await page.keyboard.down('KeyW');
  await page.waitForFunction(() => window.__bwc.vessel.u > 1.5, null, { timeout: 60000 });
  await page.waitForFunction(() => window.__bwc.wakeAlive > 0, null, { timeout: 30000 });
  check(true, 'a moving boat leaves a wake on Medium');
  await page.screenshot({ path: path.join(out, 'w-choppy.png') });
  await page.keyboard.up('KeyW');
  await page.selectOption('#set-quality', 'low').catch(() => {});
  await bwc(() => window.__bwc.applyQuality('low'));
  await page.waitForTimeout(500);
  check((await bwc(() => window.__bwc.wakeAlive)) === 0, 'Low turns the wake off');
  await bwc(() => window.__bwc.applyQuality('high'));
  await bwc(() => window.__bwc.setWeather('rough'));
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(out, 'w-rough.png') });
  await bwc(() => window.__bwc.setWeather('calm'));
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(out, 'w-calm.png') });
  await bwc(() => window.__bwc.setWeather('foggy'));
  await page.waitForTimeout(800);
  check((await bwc(() => window.__bwc.fogFar)) === 450, 'fog bank sets visibility 450 m');
  await page.screenshot({ path: path.join(out, 'w-fog.png') });
  await bwc(() => window.__bwc.applyQuality('medium'));
  await page.keyboard.press('Escape');
  await waitMode('paused');
  await page.click('#pause-abort');
  await waitMode('result');
  await page.click('#res-board');

  // ---- fog mission
  await page.locator('.mcard[data-id="return-run"]').click();
  await page.click('#br-depart');
  await waitMode('play');
  check((await bwc(() => window.__bwc.fogFar)) === 450 && (await bwc(() => window.__bwc.weatherId)) === 'foggy', 'Island Produce Return runs in fog');
  await page.waitForFunction(() => /vis 450 m/.test(document.getElementById('hud-wind').textContent), null, { timeout: 30000 });
  check(true, 'HUD shows reduced visibility');
  await page.keyboard.press('Escape');
  await waitMode('paused');
  await page.click('#pause-abort');
  await waitMode('result');
  await page.click('#res-board');
  check((await bwc(() => window.__bwc.weatherId)) === 'calm', 'back at the board the weather is calm again');

  // ---- benchmark
  await page.click('#board-settings');
  await page.click('#bench-btn');
  await waitMode('bench', 20000);
  check(/Testing Low/.test(await page.textContent('#bench-status')), 'benchmark starts with Low');
  await page.waitForFunction(() => document.getElementById('bench-table') && !document.getElementById('bench-table').classList.contains('hidden'), null, { timeout: 120000 });
  check((await page.locator('#bench-rows tr').count()) === 3, 'benchmark reports Low, Medium and High');
  const rows = await page.$$eval('#bench-rows tr', (trs) => trs.map((t) => t.textContent));
  check(rows.every((r) => /\d+ fps/.test(r)), 'each row has measured frame rates: ' + rows.join(' | '));
  check(/Recommended: (Low|Medium|High)/.test(await page.textContent('#bench-rec')), 'benchmark recommends a preset');
  await page.screenshot({ path: path.join(out, 'w-bench.png') });
  const settingBefore = await bwc(() => window.__bwc.quality);
  if (await page.isVisible('#bench-apply')) {
    await page.click('#bench-apply');
    check((await bwc(() => window.__bwc.mode)) === 'board', 'applying the recommendation returns to the board');
  } else {
    await page.click('#bench-close');
  }
  check(['low', 'medium', 'high'].includes(await bwc(() => window.__bwc.quality)), `quality is valid after the benchmark (was ${settingBefore})`);

  // ---- settings persist
  await page.reload();
  await page.waitForTimeout(500);
  await page.click('#start-btn');
  await page.click('#board-settings');
  check(await page.isChecked('#set-fps'), 'performance overlay setting persists');
  check(['auto', 'low', 'medium', 'high'].includes(await page.inputValue('#set-quality')), 'quality setting persists');

  check(errors.length === 0, 'no console/page errors ' + JSON.stringify(errors));
  await browser.close();
  server.close();
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASSED');
  process.exit(fails.length ? 1 : 0);
})();
