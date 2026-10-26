import { formatTime } from '../sim/route.js';

const $ = (id) => document.getElementById(id);

export function createHud() {
  const els = {
    speed: $('hud-speed'), heading: $('hud-heading'), throttle: $('hud-throttle-fill'),
    objective: $('hud-objective'), timer: $('hud-timer'), warning: $('hud-warning'),
    result: $('result'), resultTime: $('result-time'), resultHits: $('result-hits'),
    start: $('start'), arrow: $('hud-arrow'),
  };
  let warnTimeout = 0;
  return {
    update(d) {
      els.speed.textContent = d.knots.toFixed(1);
      els.heading.textContent = String(Math.round(d.heading) % 360).padStart(3, '0');
      els.throttle.style.width = `${Math.abs(d.throttle) * 100}%`;
      els.throttle.className = d.throttle < -0.02 ? 'reverse' : '';
      els.objective.textContent = d.objective;
      els.timer.textContent = d.timer;
      els.arrow.style.transform = `rotate(${d.bearingRel}deg)`;
    },
    warn(text, ms = 2500) {
      els.warning.textContent = text;
      els.warning.classList.add('show');
      clearTimeout(warnTimeout);
      warnTimeout = setTimeout(() => els.warning.classList.remove('show'), ms);
    },
    showStart(v) { els.start.classList.toggle('hidden', !v); },
    showResult(time, hits) {
      els.resultTime.textContent = formatTime(time);
      els.resultHits.textContent = String(hits);
      els.result.classList.remove('hidden');
    },
    hideResult() { els.result.classList.add('hidden'); },
  };
}
