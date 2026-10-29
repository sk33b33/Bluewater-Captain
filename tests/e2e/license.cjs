// Headless end-to-end test of Stage 3: fresh profile -> locked contracts -> training -> written test
// -> exam (fail, then pass) -> license unlocks contracts, survives reload.
// Boat positions are set through the debug hook; real physics is covered by unit tests.
// Run: npm run build && node tests/e2e/license.cjs [outDir]
const { chromium } = require('playwright');
const path = require('path');
const { startServer } = require('./serve.cjs');
const out = process.argv[2] || '.';
const fails = [];
const check = (cond, msg) => { if (!cond) { fails.push(msg); console.log('FAIL', msg); } else console.log('ok  ', msg); };

(async () => {
  const server = await startServer();
  const url = server.url;
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const mode = () => page.evaluate(() => window.__bwc.mode);
  const waitMode = (m) => page.waitForFunction((x) => window.__bwc.mode === x, m, { timeout: 40000 });
  const prof = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__bwc.profile)));
  const tele = (x, z, h) => page.evaluate(([x, z, h]) => { const v = window.__bwc.vessel; v.x = x; v.z = z; if (h !== undefined) v.heading = h; v.u = 0; v.v = 0; v.r = 0; }, [x, z, h]);
  const txt = (sel) => page.textContent(sel);

  // Teleport to each waypoint and wait until the game has actually registered it (frames can be slow
  // under software rendering, so a fixed delay would sometimes skip a waypoint).
  const visit = async (wps) => {
    for (let i = 0; i < wps.length; i++) {
      await tele(wps[i].x, wps[i].z);
      await page.waitForFunction((n) => { const r = window.__bwc.run; return !r || r.route.next > n || r.phase !== 'underway'; }, i, { timeout: 30000 });
    }
  };

  // sail a mission by teleporting through its waypoints and parking in the berth
  async function sail() {
    const wps = await page.evaluate(() => window.__bwc.run.mission.waypoints);
    await visit(wps);
    const dock = await page.evaluate(() => window.__bwc.run.mission.dock);
    if (dock) {
      const b = await page.evaluate((d) => window.__bwc.BERTHS[d], dock);
      await tele(b.cx, b.cz, b.heading);
    }
    await waitMode('result');
  }
  async function playFromBoard(id) {
    await page.locator(`.mcard[data-id="${id}"]`).click();
    await page.click('#br-depart');
    await waitMode('play');
    await sail();
  }

  await page.goto(url);
  await page.waitForTimeout(600);
  await page.click('#start-btn');
  check((await page.locator('.mcard').count()) === 15, 'board lists 15 missions');
  check((await page.locator('.mcard.locked').count()) === 13, 'fresh profile: only the 2 permit training missions are open');
  await page.screenshot({ path: path.join(out, 'l-board.png') });

  // locked contract: briefing explains, depart disabled
  await page.locator('.mcard[data-id="supply-run"]').click();
  check(await page.isDisabled('#br-depart'), 'locked contract: Depart is disabled');
  check(/Small Craft Permit/.test(await txt('#br-lock')), 'locked contract: briefing names the missing license');
  await page.click('#br-licenses');
  check((await mode()) === 'licenses', 'Open licenses goes to the licenses screen');
  check(/Available/.test(await txt('.lcard[data-id="small-craft-permit"] h3')), 'Small Craft Permit shows Available');
  check(/Locked/.test(await txt('.lcard[data-id="coastal-skipper"] h3')), 'Coastal Skipper (next tier) shows Locked');
  check(await page.isDisabled('#exam-small-craft-permit'), 'practical exam is disabled before training and written test');
  await page.screenshot({ path: path.join(out, 'l-licenses.png') });

  // written test: fail on purpose, then pass on retake
  await page.click('#written-small-craft-permit');
  check((await mode()) === 'quiz' && (await page.locator('fieldset.q').count()) === 5, 'written test shows 5 questions');
  let qs = await page.evaluate(() => window.__bwc.quiz);
  for (let i = 0; i < 5; i++) {
    const pick = i < 2 ? (qs[i].answer + 1) % qs[i].options.length : qs[i].answer; // first two wrong => 3/5
    await page.check(`#q${i}-o${pick}`);
  }
  await page.click('#quiz-submit');
  check(/Not yet: 3 of 5/.test(await txt('#quiz-result')), 'written test: 3 of 5 is not a pass');
  check(await page.isVisible('#quiz-retake'), 'written test: retake offered');
  await page.screenshot({ path: path.join(out, 'l-quiz-fail.png') });
  await page.click('#quiz-retake');
  qs = await page.evaluate(() => window.__bwc.quiz);
  for (let i = 0; i < 5; i++) await page.check(`#q${i}-o${qs[i].answer}`);
  await page.click('#quiz-submit');
  check(/Passed: 5 of 5/.test(await txt('#quiz-result')), 'written test: retake passes');
  let p = await prof();
  check(p.licenses['small-craft-permit'].written.passed && p.licenses['small-craft-permit'].written.attempts === 2, 'profile records 2 written attempts, passed');
  await page.click('#quiz-back');
  check(await page.isDisabled('#exam-small-craft-permit'), 'exam still locked: training not done');

  // training runs
  await page.click('#lic-back');
  await playFromBoard('training-loop');
  check(/complete/i.test(await txt('#res-title')), 'training loop completed');
  await page.click('#res-board');
  await playFromBoard('dock-drill');
  check(/complete/i.test(await txt('#res-title')), 'dock drill completed');
  await page.click('#res-board');
  p = await prof();
  check(p.credits >= 100, `training paid enough for the exam fee (${p.credits})`);
  await page.click('#board-licenses');
  check(!(await page.isDisabled('#exam-small-craft-permit')), 'exam unlocked after training + written test + fee');

  // exam attempt 1: abort -> fail, fee lost
  const credits0 = p.credits;
  await page.click('#exam-small-craft-permit');
  check((await mode()) === 'briefing' && /Fee 100/.test(await txt('#br-exam')), 'exam briefing shows fee and rules');
  await page.screenshot({ path: path.join(out, 'l-exam-brief.png') });
  await page.click('#br-depart');
  await waitMode('play');
  p = await prof();
  check(p.credits === credits0 - 100, 'fee charged on departure');
  await page.click('#menu-btn');
  check(await page.isHidden('#pause-restart'), 'exam cannot be restarted from the pause menu');
  await page.click('#pause-abort');
  await waitMode('result');
  check(/Exam failed/.test(await txt('#res-title')), 'aborted exam shows Exam failed');
  p = await prof();
  check(!p.licenses['small-craft-permit'].held && p.licenses['small-craft-permit'].practical.attempts === 1, 'no license after a failed attempt; attempt counted');
  check(p.credits === credits0 - 100, 'fee not refunded');
  await page.click('#res-board');
  check((await page.locator('.mcard.locked[data-id="supply-run"]').count()) === 1, 'contracts still locked after failing');

  // exam attempt 2: pass
  await page.click('#board-licenses');
  const need = 100 - (await prof()).credits;
  if (need > 0) check(await page.isDisabled('#exam-small-craft-permit'), 'exam disabled when credits are short of the fee');
  await page.click('#lic-back');
  while ((await prof()).credits < 100) { await playFromBoard('training-loop'); await page.click('#res-board'); }
  await page.click('#board-licenses');
  await page.click('#exam-small-craft-permit');
  await page.click('#br-depart');
  await waitMode('play');
  await sail();
  check(/Exam passed/.test(await txt('#res-title')), 'perfect exam run: Exam passed');
  check(/Passed/.test(await txt('#exam-banner')) && (await page.locator('#exam-checks li').count()) === 2, 'exam result lists the pass checks');
  await page.screenshot({ path: path.join(out, 'l-exam-pass.png') });
  p = await prof();
  check(p.licenses['small-craft-permit'].held === true, 'license awarded');
  check(p.reputation >= 5, `bonus reputation granted (${p.reputation})`);
  await page.click('#res-board');
  check((await page.locator('.mcard.locked[data-id="supply-run"]').count()) === 0, 'supply run unlocked by the permit');
  check((await page.locator('.mcard.locked[data-id="workboat-haul"]').count()) === 1, 'workboat contract still locked: needs the Coastal Skipper');

  // persistence + permissions after reload
  await page.reload();
  await page.waitForTimeout(500);
  await page.click('#start-btn');
  check(/Small Craft Permit/.test(await txt('#p-licenses')), 'license still held after reload');
  await page.locator('.mcard[data-id="supply-run"]').click();
  check(!(await page.isDisabled('#br-depart')), 'contract can be started with the permit');
  await page.click('#br-depart');
  check((await mode()) === 'play', 'contract starts after reload');

  check(errors.length === 0, 'no console/page errors ' + JSON.stringify(errors));
  await browser.close();
  server.close();
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASSED');
  process.exit(fails.length ? 1 : 0);
})();
