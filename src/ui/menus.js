// Overlay screens: title, mission board, briefing, results, licenses, written test, pause/settings.
// Presentation only: all rules live in src/sim and src/data.
import { formatTime } from '../sim/route.js';
import { DOCK } from '../sim/mission.js';
import { KIND_LABEL } from '../data/missions.js';
import { VESSEL_CLASSES } from '../data/licenses.js';

const $ = (id) => document.getElementById(id);
const SCREENS = ['start', 'board', 'briefing', 'result', 'pause', 'licenses', 'quiz'];

const FAIL_TEXT = {
  hull: 'Hull breached: the vessel took too much damage.',
  timeout: 'Out of time: the mission ran past twice its deadline.',
  aborted: 'Mission aborted.',
};

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
function fill(list, items) {
  list.textContent = '';
  for (const t of items) list.appendChild(el('li', '', t));
}

export function createMenus(h) {
  let resetArmed = false;
  const hideAll = () => SCREENS.forEach((id) => $(id).classList.add('hidden'));
  const show = (id) => { hideAll(); $(id).classList.remove('hidden'); };

  $('start-btn').addEventListener('click', () => h.onStart());
  $('br-depart').addEventListener('click', () => h.onDepart());
  $('br-back').addEventListener('click', () => h.onBoard());
  $('br-licenses').addEventListener('click', () => h.onLicenses());
  $('res-board').addEventListener('click', () => h.onBoard());
  $('res-retry').addEventListener('click', () => h.onRetry());
  $('pause-resume').addEventListener('click', () => h.onResume());
  $('pause-close').addEventListener('click', () => h.onResume());
  $('pause-restart').addEventListener('click', () => h.onRestart());
  $('pause-abort').addEventListener('click', () => h.onAbort());
  $('menu-btn').addEventListener('click', () => h.onMenu());
  $('board-settings').addEventListener('click', () => h.onSettings());
  $('board-licenses').addEventListener('click', () => h.onLicenses());
  $('lic-back').addEventListener('click', () => h.onBoard());
  $('quiz-back').addEventListener('click', () => h.onLicenses());
  $('quiz-retake').addEventListener('click', () => h.onQuizRetake());
  $('quiz-form').addEventListener('submit', (e) => e.preventDefault());
  $('quiz-submit').addEventListener('click', () => {
    const answers = [];
    const form = $('quiz-form');
    for (let i = 0; form.elements[`q${i}`]; i++) {
      const picked = form.querySelector(`input[name="q${i}"]:checked`);
      answers.push(picked ? Number(picked.value) : null);
    }
    h.onQuizSubmit(answers);
  });
  $('reset-btn').addEventListener('click', () => {
    if (!resetArmed) { resetArmed = true; $('reset-note').classList.remove('hidden'); return; }
    resetArmed = false;
    $('reset-note').classList.add('hidden');
    h.onReset();
  });

  return {
    hideAll,
    showStart() { show('start'); },

    // entries: [{ mission, access: {ok, reason} }] in board order
    showBoard(profile, entries, heldNames) {
      resetArmed = false;
      $('reset-note').classList.add('hidden');
      $('p-credits').textContent = String(profile.credits);
      $('p-rep').textContent = String(profile.reputation);
      $('p-xp').textContent = String(profile.xp);
      $('p-licenses').textContent = heldNames.length ? heldNames.join(', ') : 'none yet';
      const list = $('board-list');
      list.textContent = '';
      let lastKind = null;
      for (const { mission: m, access } of entries) {
        if (m.kind !== lastKind) {
          lastKind = m.kind;
          list.appendChild(el('div', 'group-h', KIND_LABEL[m.kind] + (m.kind === 'training' ? ' (open to everyone)' : m.kind === 'contract' ? ' (needs a license)' : '')));
        }
        const done = profile.completed[m.id];
        const b = el('button', 'mcard' + (access.ok ? '' : ' locked'));
        b.type = 'button';
        b.dataset.id = m.id;
        const t = el('div', 't', m.title);
        const badge = el('span', done ? 'badge grade' : 'badge', done ? `Best ${done.bestGrade}` : 'New');
        badge.style.marginLeft = '8px';
        t.appendChild(badge);
        if (!access.ok) {
          const lock = el('span', 'badge lock', 'Locked');
          lock.style.marginLeft = '6px';
          t.appendChild(lock);
        }
        const meta = el('div', 'm');
        const bits = [`${m.from} → ${m.to}`, m.cargo, `Deadline ${formatTime(m.deadline)}`];
        bits.push(m.kind === 'exam' ? 'Pays nothing: earns a license' : `Reward ${m.reward}`);
        for (const text of bits) meta.appendChild(el('span', '', text));
        b.append(t, meta);
        if (!access.ok) b.appendChild(el('div', 'lock-note', access.reason));
        b.addEventListener('click', () => h.onSelect(m.id));
        list.appendChild(b);
      }
      show('board');
    },

    // ctx: { dockName, access, exam: {fee, minScore, maxCollisions} | null, licenseName }
    showBriefing(m, ctx) {
      $('br-title').textContent = m.title;
      $('br-summary').textContent = m.summary;
      $('br-route').textContent = `${m.from} → ${m.to}`;
      $('br-cargo').textContent = m.cargo;
      $('br-deadline').textContent = `${formatTime(m.deadline)} from departure (late arrivals lose points)`;
      $('br-risk').textContent = m.risk;
      $('br-reward').textContent = m.kind === 'exam' ? 'No payment. Passing earns the license and a reputation bonus.' : `${m.reward} credits at best (scaled by your score)`;
      $('br-vessel').textContent = `${VESSEL_CLASSES[m.vesselClass]} (Harbor Skiff)`;
      $('br-license').textContent = m.kind === 'training' ? 'None: sailing under instruction' : m.kind === 'exam' ? `Exam for the ${ctx.licenseName}` : ctx.licenseName;
      $('br-weather').textContent = m.weather;
      const showExam = !!ctx.exam;
      $('br-exam-dt').classList.toggle('hidden', !showExam);
      $('br-exam').classList.toggle('hidden', !showExam);
      if (showExam) $('br-exam').textContent = `Fee ${ctx.exam.fee} credits, charged when you depart and not refunded. Pass mark ${ctx.exam.minScore} points, at most ${ctx.exam.maxCollisions} damaging collisions. Aborting counts as a failed attempt.`;
      $('br-dock-tip').textContent = ctx.dockName
        ? `Docking: stop inside the green berth at ${ctx.dockName}. Be slower than ${(DOCK.maxSpeed * 1.944).toFixed(0)} knots, within ${DOCK.maxAngleDeg}° of the pier line, and hold still for ${DOCK.holdSeconds} seconds. Reverse (S) to brake. Hard hits damage the hull.`
        : 'Follow the yellow beams through each buoy gate. Hard hits damage the hull.';
      $('br-lock').classList.toggle('hidden', ctx.access.ok);
      $('br-lock').textContent = ctx.access.ok ? '' : `Locked: ${ctx.access.reason}`;
      $('br-depart').disabled = !ctx.access.ok;
      $('br-licenses').classList.toggle('hidden', ctx.access.ok);
      show('briefing');
    },

    // info: { newBest, bestGrade, bestScore, bestTime, plays, credits, tips, exam: {judged, awarded, licenseName, unlocks} | null }
    showResult(m, r, info) {
      $('res-title').textContent = info.exam ? (info.exam.judged.passed ? 'Exam passed' : 'Exam not passed') : 'Mission complete';
      $('res-ok').classList.remove('hidden');
      $('res-fail').classList.add('hidden');
      $('res-grade').textContent = r.grade;
      $('res-total').textContent = `${r.total} / 100 · ${formatTime(r.time)} on the clock`;
      const rows = $('res-rows');
      rows.textContent = '';
      for (const c of r.categories) {
        const tr = el('tr');
        tr.append(el('td', '', c.name), el('td', 'pts', `${c.points}/${c.max}`), el('td', 'note', c.note));
        rows.appendChild(tr);
      }
      const ex = info.exam;
      $('res-exam').classList.toggle('hidden', !ex);
      if (ex) {
        const b = $('exam-banner');
        b.className = 'banner ' + (ex.judged.passed ? 'pass' : 'fail');
        b.textContent = ex.judged.passed ? `Passed: ${ex.licenseName} earned` : `Not passed: ${ex.licenseName} not awarded`;
        fill($('exam-checks'), ex.judged.checks.map((c) => `${c.ok ? '✓' : '✗'} ${c.label}`));
        $('exam-award').textContent = ex.awarded
          ? `Unlocked: ${ex.unlocks.join('; ')}. Bonus: +${ex.bonus.reputation} reputation, +${ex.bonus.xp} XP.`
          : 'You can retake the exam after training. Each attempt costs the fee again, so earn credits with training runs first if you are short.';
      }
      $('res-tips-wrap').classList.toggle('hidden', info.tips.length === 0);
      fill($('res-tips'), info.tips);
      $('res-reward-line').classList.toggle('hidden', !!ex);
      $('res-reward').textContent = String(r.reward);
      $('res-rep').textContent = String(r.reputation);
      $('res-xp').textContent = String(r.xp);
      $('res-best').textContent = `${info.newBest ? 'New best score! ' : ''}Best ${info.bestGrade} (${info.bestScore}) · fastest ${formatTime(info.bestTime)} · played ${info.plays}× · balance ${info.credits} credits`;
      $('res-retry').textContent = m.kind === 'exam' ? 'Exam briefing' : 'Retry mission';
      $('res-retry').classList.toggle('hidden', !!(ex && ex.awarded));
      show('result');
    },

    showFail(m, reason) {
      $('res-title').textContent = m.kind === 'exam' ? 'Exam failed' : 'Mission failed';
      $('res-ok').classList.add('hidden');
      $('res-fail').classList.remove('hidden');
      $('res-reason').textContent = FAIL_TEXT[reason] || 'Mission failed.';
      $('res-fail-note').textContent = m.kind === 'exam'
        ? 'The exam fee is not refunded. Retake it after more training: it costs the fee again.'
        : 'No payment for a failed mission. Nothing is lost: retry or pick another contract.';
      $('res-retry').textContent = m.kind === 'exam' ? 'Exam briefing' : 'Retry mission';
      $('res-retry').classList.remove('hidden');
      show('result');
    },

    // evals: [{ lic, ev }]
    showLicenses(profile, evals) {
      $('l-credits').textContent = String(profile.credits);
      $('l-rep').textContent = String(profile.reputation);
      $('l-xp').textContent = String(profile.xp);
      const list = $('lic-list');
      list.textContent = '';
      for (const { lic, ev } of evals) {
        const card = el('div', 'lcard');
        card.dataset.id = lic.id;
        const head = el('h3', '', `${lic.name}  `);
        const label = ev.status === 'held' ? 'Held ✓' : ev.status === 'available' ? 'Available' : 'Locked';
        head.appendChild(el('span', 'badge ' + (ev.status === 'held' ? 'ok' : ev.status === 'locked' ? 'lock' : ''), label));
        const tier = el('span', 'badge', `Tier ${lic.tier}`);
        tier.style.marginLeft = '6px';
        head.appendChild(tier);
        card.appendChild(head);
        card.appendChild(el('p', 'note', lic.summary));
        const ul = el('ul', 'reqs');
        for (const r of ev.requirements) ul.appendChild(el('li', r.met ? 'met' : 'unmet', `${r.met ? '✓' : '✗'} ${r.label}`));
        card.appendChild(ul);
        card.appendChild(el('p', 'note', `Permits: ${lic.permits.map((c) => VESSEL_CLASSES[c]).join(', ')}`));
        card.appendChild(el('p', 'note', `Unlocks: ${lic.unlocks.join('; ')}`));
        if (ev.status === 'held') {
          const st = ev.state;
          card.appendChild(el('p', '', st.grandfathered ? 'Granted for completing contract runs before licenses existed.' : `Earned ${st.heldAt ? new Date(st.heldAt).toLocaleDateString() : ''} with ${st.practical.attempts} exam attempt${st.practical.attempts === 1 ? '' : 's'}.`));
        } else if (ev.comingSoon) {
          card.appendChild(el('p', 'lock-note', ev.comingSoon));
        } else {
          const row = el('div', 'row');
          row.style.marginTop = '8px';
          if (lic.written) {
            const w = el('button', 'ghost', ev.state.written.passed ? 'Retake written test' : 'Take written test');
            w.type = 'button';
            w.id = `written-${lic.id}`;
            w.disabled = !ev.canWritten;
            w.addEventListener('click', () => h.onWritten(lic.id));
            row.appendChild(w);
          }
          if (lic.exam) {
            const e = el('button', '', `Practical exam (fee ${lic.exam.fee})`);
            e.type = 'button';
            e.id = `exam-${lic.id}`;
            e.disabled = !ev.canPractical;
            e.addEventListener('click', () => h.onExam(lic.id));
            row.appendChild(e);
          }
          card.appendChild(row);
          if (!ev.canPractical && lic.exam) card.appendChild(el('p', 'lock-note', `Exam locked: ${ev.practicalBlockers.join('; ')}.`));
          const w = ev.state.written;
          if (w.attempts > 0) card.appendChild(el('p', 'note', `Written test: ${w.attempts} attempt${w.attempts === 1 ? '' : 's'}, best ${w.bestScore} correct.`));
          const px = ev.state.practical;
          if (px.attempts > 0) card.appendChild(el('p', 'note', `Practical exam: ${px.attempts} attempt${px.attempts === 1 ? '' : 's'}, best score ${px.bestScore}.`));
        }
        list.appendChild(card);
      }
      show('licenses');
    },

    showQuiz(lic, questions) {
      $('quiz-title').textContent = `${lic.name}: written test`;
      $('quiz-intro').textContent = `Answer all ${questions.length} questions. You need ${lic.written.passMark} correct. Free to retake with new questions.`;
      const body = $('quiz-body');
      body.textContent = '';
      questions.forEach((q, i) => {
        const fs = el('fieldset', 'q');
        fs.appendChild(el('legend', '', `${i + 1}. ${q.text}`));
        q.options.forEach((opt, j) => {
          const label = el('label', 'opt');
          const input = document.createElement('input');
          input.type = 'radio';
          input.name = `q${i}`;
          input.id = `q${i}-o${j}`;
          input.value = String(j);
          label.append(input, el('span', '', opt));
          fs.appendChild(label);
        });
        body.appendChild(fs);
      });
      $('quiz-form').classList.remove('hidden');
      $('quiz-result').classList.add('hidden');
      $('quiz-submit').classList.remove('hidden');
      $('quiz-retake').classList.add('hidden');
      show('quiz');
    },

    showQuizResult(lic, questions, answers, outcome) {
      $('quiz-form').classList.add('hidden');
      $('quiz-submit').classList.add('hidden');
      const box = $('quiz-result');
      box.textContent = '';
      const b = el('div', 'banner ' + (outcome.passed ? 'pass' : 'fail'), outcome.passed ? `Passed: ${outcome.correct} of ${outcome.total} correct` : `Not yet: ${outcome.correct} of ${outcome.total} correct (need ${lic.written.passMark})`);
      box.appendChild(b);
      if (outcome.wrong.length) {
        box.appendChild(el('div', 'group-h', 'What to review'));
        const ul = el('ul', 'plain');
        for (const i of outcome.wrong) {
          const q = questions[i];
          const given = answers[i] === null || answers[i] === undefined ? 'no answer' : `you chose "${q.options[answers[i]]}"`;
          ul.appendChild(el('li', '', `${q.text} Correct: "${q.options[q.answer]}" (${given}). ${q.explain}`));
        }
        box.appendChild(ul);
      }
      box.classList.remove('hidden');
      $('quiz-retake').classList.toggle('hidden', outcome.passed);
      show('quiz');
    },

    showPause(inGame, opts = {}) {
      $('pause-title').textContent = inGame ? 'Paused' : 'Settings';
      $('pause-actions').classList.toggle('hidden', !inGame);
      $('pause-restart').classList.toggle('hidden', opts.canRestart === false);
      $('pause-abort').textContent = opts.abortLabel || 'Abort mission';
      $('pause-close').classList.toggle('hidden', inGame);
      show('pause');
    },
  };
}
