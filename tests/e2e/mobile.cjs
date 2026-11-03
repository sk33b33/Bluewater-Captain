// Phone layout audit: visits every screen at three phone sizes and checks for horizontal overflow, controls
// pushed off-screen, clipped text, overlapping in-game controls and small touch targets.
// Run: npm run build && node tests/e2e/mobile.cjs [outDir]
const { chromium } = require('playwright');
const path = require('path');
const { startServer } = require('./serve.cjs');
const out = process.argv[2] || '.';
const fails = [];
const warns = [];
const held = () => ({ held: true, heldAt: 1, grandfathered: false, written: { attempts: 1, bestScore: 5, passed: true }, practical: { attempts: 1, bestScore: 90, passed: true } });
const profile = { version: 3, credits: 9000, reputation: 80, xp: 0, completed: {}, vessel: 'small-motorboat', licenses: { 'small-craft-permit': held(), 'coastal-skipper': held(), 'large-vessel': held() } };
const SIZES = [{ name: 'portrait-390x844', w: 390, h: 844 }, { name: 'small-360x640', w: 360, h: 640 }, { name: 'landscape-844x390', w: 844, h: 390 }];

// Everything the audit checks on the current screen.
function audit() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const res = { overflowX: document.documentElement.scrollWidth > vw + 1, offscreen: [], clipped: [], small: [], overlaps: [] };
  const visible = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const name = (el) => el.id ? `#${el.id}` : (el.textContent || el.tagName).trim().slice(0, 28);
  const overlays = [...document.querySelectorAll('.overlay:not(.hidden)')];
  const scope = overlays.length ? overlays : [document.body];
  for (const root of scope) {
    for (const el of root.querySelectorAll('button, input, select, label, .badge, th, td, h1, h2, h3, p, li, dt, dd, span')) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      // inside a scrollable card, only horizontal position matters
      if (r.left < -1 || r.right > vw + 1) res.offscreen.push(`${name(el)} x=${Math.round(r.left)}..${Math.round(r.right)}`);
      if ((el.tagName === 'BUTTON') && Math.min(r.width, r.height) < 32) res.small.push(`${name(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
      if (['P', 'LI', 'DD', 'H1', 'H2', 'H3', 'TD'].includes(el.tagName) && el.scrollWidth > el.clientWidth + 3 && getComputedStyle(el).overflowX !== 'visible') res.clipped.push(name(el));
    }
  }
  // in-game: HUD panels and touch controls must not overlap each other
  if (document.body.classList.contains('playing')) {
    const ids = ['hud-top', 'hud-bottom', 'hud-dock', 'hud-warning', 't-throttle', 't-steer', 't-stop', 't-respawn', 'menu-btn'];
    const boxes = ids.map((id) => { const el = document.getElementById(id); if (!el || !visible(el) || (id === 'hud-warning' && !el.classList.contains('show'))) return null; const r = el.getBoundingClientRect(); return { id, l: r.left, r: r.right, t: r.top, b: r.bottom }; }).filter(Boolean);
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      const ox = Math.min(a.r, b.r) - Math.max(a.l, b.l), oy = Math.min(a.b, b.b) - Math.max(a.t, b.t);
      if (ox > 4 && oy > 4) res.overlaps.push(`${a.id} / ${b.id} (${Math.round(ox)}x${Math.round(oy)})`);
    }
    for (const b of boxes) if (b.l < -1 || b.r > vw + 1 || b.b > vh + 1) res.offscreen.push(`${b.id} out of the viewport`);
  }
  return res;
}

(async () => {
  const server = await startServer();
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const size of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: size.w, height: size.h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await ctx.addInitScript((p) => { localStorage.setItem('bwc-profile', JSON.stringify(p)); localStorage.setItem('bwc-settings', JSON.stringify({ quality: 'low' })); }, profile);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    const record = async (label) => {
      await page.waitForTimeout(350);
      const r = await page.evaluate(audit);
      const tag = `${size.name} / ${label}`;
      const bad = [];
      if (r.overflowX) bad.push('page scrolls sideways');
      if (r.offscreen.length) bad.push('off-screen: ' + [...new Set(r.offscreen)].slice(0, 4).join('; '));
      if (r.clipped.length) bad.push('clipped text: ' + [...new Set(r.clipped)].slice(0, 4).join('; '));
      if (r.overlaps.length) bad.push('overlap: ' + r.overlaps.slice(0, 4).join('; '));
      if (bad.length) { fails.push(`${tag}: ${bad.join(' | ')}`); console.log('FAIL', tag, '->', bad.join(' | ')); } else console.log('ok  ', tag);
      if (r.small.length) warns.push(`${tag}: small buttons ${[...new Set(r.small)].slice(0, 4).join(', ')}`);
      await page.screenshot({ path: path.join(out, `m-${size.name}-${label.replace(/[^a-z0-9]+/gi, '-')}.png`) });
    };
    const waitMode = (m) => page.waitForFunction((x) => window.__bwc.mode === x, m, { timeout: 60000 });
    await page.goto(server.url);
    await page.waitForTimeout(600);
    await record('title');
    await page.tap('#start-btn');
    await record('board');
    await page.tap('#board-fleet'); await record('fleet'); await page.tap('#fleet-back');
    await page.tap('#board-licenses'); await record('licenses');
    await page.tap('#written-small-craft-permit').catch(() => {});
    if (await page.isVisible('#quiz')) { await record('quiz'); await page.tap('#quiz-back'); }
    await page.tap('#lic-back');
    await page.tap('#board-chart'); await record('chart-view'); await page.tap('#chart-cancel');
    await page.tap('#board-settings'); await record('settings'); await page.tap('#pause-close');
    await page.locator('.mcard[data-id="cape-parcels"]').tap(); await record('briefing');
    await page.tap('#br-plan'); await record('chart-plan'); await page.tap('#chart-cancel');
    await page.tap('#br-back');
    await page.locator('.mcard[data-id="container-feeder"]').tap();
    await page.evaluate(() => { document.getElementById('br-depart').scrollIntoView(); });
    await record('briefing-ship');
    await page.tap('#br-depart');
    await waitMode('play');
    await page.waitForTimeout(800);
    await record('play-ship');
    await page.tap('#menu-btn'); await record('pause'); await page.tap('#pause-resume');
    // docking panel
    await page.evaluate(() => { const w = window.__bwc.run.mission.waypoints; for (let i = 0; i < w.length; i++) { /* nothing: teleport below */ } });
    await page.keyboard.press('Escape').catch(() => {});
    await page.tap('#menu-btn').catch(() => {});
    await page.tap('#pause-abort').catch(() => {});
    await waitMode('result');
    await record('result-fail');
    await page.tap('#res-board');
    // a harbor job: docking panel in the HUD, then the result screen
    await page.locator('.mcard[data-id="dock-drill"]').tap();
    await page.tap('#br-depart');
    await waitMode('play');
    const wps = await page.evaluate(() => window.__bwc.run.mission.waypoints);
    for (let i = 0; i < wps.length; i++) {
      await page.evaluate((w) => { const v = window.__bwc.vessel; v.x = w.x; v.z = w.z; v.u = 0; v.v = 0; }, wps[i]);
      await page.waitForFunction((n) => { const r = window.__bwc.run; return r.route.next > n || r.phase !== 'underway'; }, i, { timeout: 40000 });
    }
    await page.waitForTimeout(600);
    await record('play-docking');
    const b = await page.evaluate(() => window.__bwc.BERTHS.harborN);
    await page.evaluate((b) => { const v = window.__bwc.vessel; v.x = b.cx; v.z = b.cz; v.heading = b.heading; v.u = 0; v.v = 0; }, b);
    await waitMode('result');
    await record('result');
    if (errors.length) { fails.push(`${size.name}: console errors ${JSON.stringify(errors)}`); console.log('FAIL errors', errors); }
    await ctx.close();
  }
  await browser.close();
  server.close();
  console.log('\nTouch-target warnings (informational):');
  for (const w of [...new Set(warns)]) console.log('  warn', w);
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASSED');
  process.exit(fails.length ? 1 : 0);
})();
