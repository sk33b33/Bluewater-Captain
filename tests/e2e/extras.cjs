// Headless end-to-end test of the gap-closing work: gamepad (simulated pad), mid-mission save and resume,
// and the progress backup file. Run: npm run build && node tests/e2e/extras.cjs [outDir]
const { chromium } = require('playwright');
const path = require('path');
const { startServer } = require('./serve.cjs');
const out = process.argv[2] || '.';
const fails = [];
const check = (cond, msg) => { if (!cond) { fails.push(msg); console.log('FAIL', msg); } else console.log('ok  ', msg); };
const held = () => ({ held: true, heldAt: 1, grandfathered: false, written: { attempts: 1, bestScore: 5, passed: true }, practical: { attempts: 1, bestScore: 90, passed: true } });
const profile = { version: 3, credits: 500, reputation: 20, xp: 0, completed: {}, vessel: 'small-motorboat', licenses: { 'small-craft-permit': held(), 'coastal-skipper': held() } };

(async () => {
  const server = await startServer();
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
  await ctx.addInitScript((p) => {
    if (!localStorage.getItem('bwc-profile')) localStorage.setItem('bwc-profile', JSON.stringify(p));
    // A simulated gamepad the test can drive: window.__pad.axes / buttons
    window.__pad = { id: 'Simulated Pad', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
    navigator.getGamepads = () => [window.__pad, null, null, null];
  }, profile);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const waitMode = (m, t = 60000) => page.waitForFunction((x) => window.__bwc.mode === x, m, { timeout: t });
  // Buttons are sampled once per frame and software rendering is only a few frames a second, so hold them long enough.
  const press = async (i, ms = 900) => { await page.evaluate((i) => { window.__pad.buttons[i] = { pressed: true, touched: true, value: 1 }; }, i); await page.waitForTimeout(ms); await page.evaluate((i) => { window.__pad.buttons[i] = { pressed: false, touched: false, value: 0 }; }, i); await page.waitForTimeout(150); };

  await page.goto(server.url);
  await page.waitForTimeout(500);

  // ---- gamepad
  await press(0); // A on the title card = Enter
  check((await page.evaluate(() => window.__bwc.mode)) === 'board', 'gamepad A confirms on the title card');
  await page.locator('.mcard[data-id="dock-drill"]').click();
  check((await page.evaluate(() => window.__bwc.mode)) === 'briefing', 'drill briefing opens');
  await press(0); // A = depart
  await waitMode('play');
  check(true, 'gamepad A departs from the briefing');
  const h0 = await page.evaluate(() => window.__bwc.vessel.heading);
  await page.evaluate(() => { window.__pad.buttons[7] = { pressed: true, touched: true, value: 1 }; window.__pad.axes[0] = 1; });
  await page.waitForFunction(() => window.__bwc.vessel.u > 1, null, { timeout: 40000 });
  const hd = (h0) => page.evaluate((h0) => Math.abs(Math.atan2(Math.sin(window.__bwc.vessel.heading - h0), Math.cos(window.__bwc.vessel.heading - h0))), h0);
  await page.waitForFunction((h0) => Math.abs(Math.atan2(Math.sin(window.__bwc.vessel.heading - h0), Math.cos(window.__bwc.vessel.heading - h0))) > 0.05, h0, { timeout: 40000 });
  const moved = await page.evaluate(() => ({ u: window.__bwc.vessel.u, h: window.__bwc.vessel.heading, thr: window.__bwc.vessel.throttle }));
  check(moved.u > 1 && moved.thr > 0.2, 'the right trigger gives throttle');
  const diff = Math.atan2(Math.sin(moved.h - h0), Math.cos(moved.h - h0));
  check(diff > 0.02, 'the left stick steers (right = clockwise)');
  await page.evaluate(() => { window.__pad.buttons[7] = { pressed: false, touched: false, value: 0 }; window.__pad.axes[0] = 0; });
  // Y held for a long time must respawn once, not every frame
  const r0 = await page.evaluate(() => window.__bwc.run.respawns);
  await page.evaluate(() => { window.__pad.buttons[3] = { pressed: true, touched: true, value: 1 }; });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { window.__pad.buttons[3] = { pressed: false, touched: false, value: 0 }; });
  const r1 = await page.evaluate(() => window.__bwc.run.respawns);
  check(r1 - r0 === 1, `holding Y respawns once, not every frame (${r1 - r0} respawn)`);
  await press(9); // Start = pause
  check((await page.evaluate(() => window.__bwc.mode)) === 'paused', 'gamepad Start pauses');
  await press(1); // B = back / resume
  check((await page.evaluate(() => window.__bwc.mode)) === 'play', 'gamepad B resumes');

  // ---- autosave and resume across a reload
  await page.evaluate(() => { const v = window.__bwc.vessel; v.x = -500; v.z = 90; v.heading = 1.2; v.u = 3; });
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__bwc.saveNow());
  const snap = await page.evaluate(() => window.__bwc.readSaveRaw());
  check(snap && snap.missionId === 'dock-drill' && snap.vesselId === 'small-motorboat', 'a mission in progress is saved');
  check(Math.abs(snap.vessel.x + 500) < 40, 'the save holds the boat position');
  const autosaved = await page.evaluate(() => { localStorage.removeItem('bwc-save'); return null; });
  await page.waitForFunction(() => !!localStorage.getItem('bwc-save'), null, { timeout: 60000 });
  check(true, 'the game autosaves on its own while you sail (no manual save needed)');

  await page.reload();
  await page.waitForTimeout(600);
  await press(0);
  check(await page.isVisible('#resume-card') && /Harbor Docking Drill in the Harbor Skiff/.test(await page.textContent('#resume-text')), 'after a reload the board offers to resume: ' + (await page.textContent('#resume-text')));
  await page.screenshot({ path: path.join(out, 'x-resume.png') });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('bwc-save')));
  await page.click('#resume-btn');
  check((await page.evaluate(() => window.__bwc.mode)) === 'paused', 'resuming starts paused');
  const back = await page.evaluate(() => ({ x: window.__bwc.vessel.x, z: window.__bwc.vessel.z, t: window.__bwc.run.time, id: window.__bwc.run.mission.id }));
  console.log('DEBUG', JSON.stringify({ back, savedX: saved.vessel.x, savedZ: saved.vessel.z, savedT: saved.run.time }));
  check(Math.abs(back.x - saved.vessel.x) < 1e-6 && Math.abs(back.z - saved.vessel.z) < 1e-6 && Math.abs(back.t - saved.run.time) < 1e-6 && back.id === 'dock-drill', 'the boat and the clock are exactly where the save left them');
  await page.keyboard.press('Escape');
  await waitMode('play');
  await page.waitForTimeout(400);
  check((await page.evaluate(() => window.__bwc.run.time)) >= saved.run.time, 'the mission carries on from the saved time');

  // finishing clears the save
  const wps = await page.evaluate(() => window.__bwc.run.mission.waypoints);
  for (let i = 0; i < wps.length; i++) {
    await page.evaluate((w) => { const v = window.__bwc.vessel; v.x = w.x; v.z = w.z; v.u = 0; v.v = 0; }, wps[i]);
    await page.waitForFunction((n) => { const r = window.__bwc.run; return r.route.next > n || r.phase !== 'underway'; }, i, { timeout: 40000 });
  }
  const b = await page.evaluate(() => window.__bwc.BERTHS.harborN);
  await page.evaluate((b) => { const v = window.__bwc.vessel; v.x = b.cx; v.z = b.cz; v.heading = b.heading; v.u = 0; v.v = 0; }, b);
  await waitMode('result');
  check((await page.evaluate(() => localStorage.getItem('bwc-save'))) === null, 'finishing the mission clears the save');
  await press(0); // A = back to the board
  check((await page.evaluate(() => window.__bwc.mode)) === 'board' && await page.isHidden('#resume-card'), 'no resume offer after finishing');

  // aborting clears it, discarding clears it, a corrupt save is ignored
  await page.locator('.mcard[data-id="dock-drill"]').click();
  await page.click('#br-depart');
  await waitMode('play');
  await page.evaluate(() => window.__bwc.saveNow());
  check((await page.evaluate(() => localStorage.getItem('bwc-save'))) !== null, 'saved again');
  await page.keyboard.press('Escape'); await waitMode('paused');
  await page.click('#pause-abort'); await waitMode('result');
  check((await page.evaluate(() => localStorage.getItem('bwc-save'))) === null, 'aborting clears the save');
  await page.click('#res-board');
  await page.evaluate(() => localStorage.setItem('bwc-save', '{"version":1,"missionId":"nope"}'));
  await page.reload(); await page.waitForTimeout(500); await press(0);
  check(await page.isHidden('#resume-card'), 'a corrupt save is ignored');
  await page.locator('.mcard[data-id="dock-drill"]').click();
  await page.click('#br-depart'); await waitMode('play');
  await page.evaluate(() => window.__bwc.saveNow());
  await page.keyboard.press('Escape'); await waitMode('paused');
  await page.reload(); await page.waitForTimeout(500); await press(0);
  await page.click('#resume-discard');
  check(await page.isHidden('#resume-card') && (await page.evaluate(() => localStorage.getItem('bwc-save'))) === null, 'Discard removes the saved mission');

  // ---- sound: the synthesized audio graph runs and follows the boat (nothing can be heard in a headless test,
  // so this checks the live gain and pitch values, mute and volume)
  check(['running', 'suspended'].includes(await page.evaluate(() => window.__bwc.audioState)), 'the audio context is created on the first gesture: ' + (await page.evaluate(() => window.__bwc.audioState)));
  await page.locator('.mcard[data-id="dock-drill"]').click();
  await page.click('#br-depart'); await waitMode('play');
  await page.waitForTimeout(800);
  const idle = await page.evaluate(() => window.__bwc.audio);
  await page.evaluate(() => { const v = window.__bwc.vessel; v.u = 8; v.throttle = 1; });
  await page.waitForTimeout(1200);
  const fast = await page.evaluate(() => window.__bwc.audio);
  check(idle && fast && fast.engine > idle.engine && fast.freq > idle.freq && fast.water > idle.water, `engine and water get louder and the pitch rises with speed (engine ${idle.engine.toFixed(3)} -> ${fast.engine.toFixed(3)}, ${idle.freq.toFixed(0)} -> ${fast.freq.toFixed(0)} Hz)`);
  await page.keyboard.press('Escape'); await waitMode('paused');
  await page.waitForTimeout(1500);
  const paused = await page.evaluate(() => window.__bwc.audio);
  check(paused.engine < 0.01 && paused.water < 0.01, 'the engine and water go quiet when paused');
  await page.click('#pause-abort'); await waitMode('result'); await page.click('#res-board');
  await page.click('#board-settings');
  await page.check('#set-mute');
  await page.waitForTimeout(700);
  check((await page.evaluate(() => window.__bwc.audio.master)) < 0.01, 'Mute silences the master level');
  await page.uncheck('#set-mute');
  await page.fill('#set-volume', '0.2');
  await page.waitForTimeout(700);
  const quiet = await page.evaluate(() => window.__bwc.audio.master);
  check(Math.abs(quiet - 0.04) < 0.02, `the volume slider sets the level (0.2 -> ${quiet.toFixed(3)}, a squared curve)`);
  check(JSON.parse(await page.evaluate(() => localStorage.getItem('bwc-settings'))).volume === 0.2, 'the volume setting is remembered');
  await page.fill('#set-volume', '0.6');
  await page.click('#pause-close');

  // ---- backup file
  const credits0 = await page.evaluate(() => window.__bwc.profile.credits);
  await page.click('#board-settings');
  check(await page.isVisible('#backup-block'), 'the backup controls are in Settings on the board');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#backup-save')]);
  const file = await dl.path();
  const text = require('fs').readFileSync(file, 'utf8');
  const parsed = JSON.parse(text);
  check(/^bluewater-captain-backup-\d{4}-\d\d-\d\d\.json$/.test(dl.suggestedFilename()) && parsed.app === 'bluewater-captain' && parsed.profile.credits === credits0, 'Save backup downloads a dated JSON file with your progress: ' + dl.suggestedFilename());
  check(new RegExp(`Backup saved: ${credits0} credits`).test(await page.textContent('#backup-msg')), 'the game confirms what was saved');

  const other = JSON.stringify({ app: 'bluewater-captain', exportVersion: 1, exportedAt: 1, profile: { version: 3, credits: 777, reputation: 42, xp: 1, completed: {}, licenses: { 'small-craft-permit': held() }, vessel: 'small-motorboat' } });
  await page.setInputFiles('#backup-file', { name: 'other.json', mimeType: 'application/json', buffer: Buffer.from(other) });
  await page.waitForFunction(() => /777 credits/.test(document.getElementById('backup-msg').textContent), null, { timeout: 10000 });
  check(await page.isVisible('#backup-confirm') && /replaces your current progress/.test(await page.textContent('#backup-msg')), 'loading a file asks you to confirm before replacing your progress');
  check((await page.evaluate(() => window.__bwc.profile.credits)) === credits0, 'nothing changed until you confirm');
  await page.click('#backup-confirm');
  check((await page.evaluate(() => window.__bwc.profile.credits)) === 777 && JSON.parse(await page.evaluate(() => localStorage.getItem('bwc-profile'))).credits === 777, 'confirming loads and saves the backup');
  await page.setInputFiles('#backup-file', { name: 'junk.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
  await page.waitForFunction(() => /not a Bluewater Captain backup/.test(document.getElementById('backup-msg').textContent), null, { timeout: 10000 });
  check(await page.isHidden('#backup-confirm') && (await page.evaluate(() => window.__bwc.profile.credits)) === 777, 'a wrong file is refused with a reason and changes nothing');
  await page.click('#pause-close');
  check((await page.textContent('#p-credits')) === '777', 'the board shows the loaded progress');

  check(errors.length === 0, 'no console/page errors ' + JSON.stringify(errors));
  await browser.close();
  server.close();
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASSED');
  process.exit(fails.length ? 1 : 0);
})();
