// Overlay screens: title, mission board, briefing, results, pause/settings. Presentation only.
import { formatTime } from '../sim/route.js';
import { DOCK } from '../sim/mission.js';

const $ = (id) => document.getElementById(id);
const SCREENS = ['start', 'board', 'briefing', 'result', 'pause'];

const FAIL_TEXT = {
  hull: 'Hull breached: the vessel took too much damage.',
  timeout: 'Out of time: the mission ran past twice its deadline.',
  aborted: 'Mission aborted.',
};

export function createMenus(h) {
  let resetArmed = false;
  const hideAll = () => SCREENS.forEach((id) => $(id).classList.add('hidden'));
  const show = (id) => { hideAll(); $(id).classList.remove('hidden'); };

  $('start-btn').addEventListener('click', () => h.onStart());
  $('br-depart').addEventListener('click', () => h.onDepart());
  $('br-back').addEventListener('click', () => h.onBoard());
  $('res-board').addEventListener('click', () => h.onBoard());
  $('res-retry').addEventListener('click', () => h.onRetry());
  $('pause-resume').addEventListener('click', () => h.onResume());
  $('pause-close').addEventListener('click', () => h.onResume());
  $('pause-restart').addEventListener('click', () => h.onRestart());
  $('pause-abort').addEventListener('click', () => h.onAbort());
  $('menu-btn').addEventListener('click', () => h.onMenu());
  $('board-settings').addEventListener('click', () => h.onSettings());
  $('reset-btn').addEventListener('click', () => {
    if (!resetArmed) { resetArmed = true; $('reset-note').classList.remove('hidden'); return; }
    resetArmed = false;
    $('reset-note').classList.add('hidden');
    h.onReset();
  });

  return {
    hideAll,
    showStart() { show('start'); },
    showBoard(profile, missions) {
      resetArmed = false;
      $('reset-note').classList.add('hidden');
      $('p-credits').textContent = String(profile.credits);
      $('p-rep').textContent = String(profile.reputation);
      $('p-xp').textContent = String(profile.xp);
      const list = $('board-list');
      list.textContent = '';
      for (const m of missions) {
        const done = profile.completed[m.id];
        const b = document.createElement('button');
        b.className = 'mcard';
        b.type = 'button';
        const t = document.createElement('div');
        t.className = 't';
        t.textContent = m.title;
        const badge = document.createElement('span');
        badge.className = done ? 'badge grade' : 'badge';
        badge.textContent = done ? `Best ${done.bestGrade}` : 'New';
        badge.style.marginLeft = '8px';
        t.appendChild(badge);
        const meta = document.createElement('div');
        meta.className = 'm';
        for (const text of [`${m.from} → ${m.to}`, m.cargo, `Deadline ${formatTime(m.deadline)}`, `Reward ${m.reward}`, `Risk ${m.risk}`]) {
          const sp = document.createElement('span');
          sp.textContent = text;
          meta.appendChild(sp);
        }
        b.append(t, meta);
        b.addEventListener('click', () => h.onSelect(m.id));
        list.appendChild(b);
      }
      show('board');
    },
    showBriefing(m, dockName) {
      $('br-title').textContent = m.title;
      $('br-summary').textContent = m.summary;
      $('br-route').textContent = `${m.from} → ${m.to}`;
      $('br-cargo').textContent = m.cargo;
      $('br-deadline').textContent = `${formatTime(m.deadline)} from departure (late arrivals lose points)`;
      $('br-risk').textContent = m.risk;
      $('br-reward').textContent = `${m.reward} credits at best (scaled by your score)`;
      $('br-vessel').textContent = m.requires.vessel;
      $('br-license').textContent = m.requires.license;
      $('br-weather').textContent = m.weather;
      $('br-dock-tip').textContent = dockName
        ? `Docking: stop inside the green berth at ${dockName}. Be slower than ${(DOCK.maxSpeed * 1.944).toFixed(0)} knots, within ${DOCK.maxAngleDeg}° of the pier line, and hold still for ${DOCK.holdSeconds} seconds. Reverse (S) to brake. Hard hits damage the hull.`
        : 'Follow the yellow beams through each buoy gate. Hard hits damage the hull.';
      show('briefing');
    },
    showResult(m, r, info) {
      $('res-title').textContent = 'Mission complete';
      $('res-ok').classList.remove('hidden');
      $('res-fail').classList.add('hidden');
      $('res-grade').textContent = r.grade;
      $('res-total').textContent = `${r.total} / 100 · ${formatTime(r.time)} on the clock`;
      const rows = $('res-rows');
      rows.textContent = '';
      for (const c of r.categories) {
        const tr = document.createElement('tr');
        for (const [cls, text] of [['', c.name], ['pts', `${c.points}/${c.max}`], ['note', c.note]]) {
          const td = document.createElement('td');
          if (cls) td.className = cls;
          td.textContent = text;
          tr.appendChild(td);
        }
        rows.appendChild(tr);
      }
      $('res-reward').textContent = String(r.reward);
      $('res-rep').textContent = String(r.reputation);
      $('res-xp').textContent = String(r.xp);
      $('res-best').textContent = `${info.newBest ? 'New best score! ' : ''}Best ${info.bestGrade} (${info.bestScore}) · fastest ${formatTime(info.bestTime)} · played ${info.plays}× · balance ${info.credits} credits`;
      show('result');
    },
    showFail(m, reason) {
      $('res-title').textContent = 'Mission failed';
      $('res-ok').classList.add('hidden');
      $('res-fail').classList.remove('hidden');
      $('res-reason').textContent = FAIL_TEXT[reason] || 'Mission failed.';
      show('result');
    },
    showPause(inGame) {
      $('pause-title').textContent = inGame ? 'Paused' : 'Settings';
      $('pause-actions').classList.toggle('hidden', !inGame);
      $('pause-close').classList.toggle('hidden', inGame);
      show('pause');
    },
  };
}
