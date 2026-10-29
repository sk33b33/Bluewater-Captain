const $ = (id) => document.getElementById(id);

export function createHud() {
  const els = {
    speed: $('hud-speed'), heading: $('hud-heading'), throttle: $('hud-throttle-fill'),
    objective: $('hud-objective'), timer: $('hud-timer'), limit: $('hud-limit'), wind: $('hud-wind'), warning: $('hud-warning'),
    arrow: $('hud-arrow'), hull: $('hud-hull'), hullBox: $('hud-hull-box'),
    dock: $('hud-dock'), dockTitle: $('dock-title'), dockHint: $('dock-hint'), dockFill: $('dock-fill'),
    dkPos: $('dk-pos'), dkSpd: $('dk-spd'), dkAng: $('dk-ang'),
  };
  let warnTimeout = 0;
  const chip = (el, label, ok) => {
    el.textContent = `${label} ${ok ? '✓' : '✗'}`;
    el.classList.toggle('good', ok);
    el.classList.toggle('bad', !ok);
  };
  return {
    update(d) {
      els.speed.textContent = d.knots.toFixed(1);
      els.heading.textContent = String(Math.round(d.heading) % 360).padStart(3, '0');
      els.throttle.style.width = `${Math.abs(d.throttle) * 100}%`;
      els.throttle.className = d.throttle < -0.02 ? 'reverse' : '';
      els.objective.textContent = d.objective;
      els.timer.textContent = d.timer;
      els.timer.classList.toggle('late', d.late);
      els.limit.textContent = d.limit;
      els.wind.textContent = d.wind;
      els.arrow.style.transform = `rotate(${d.bearingRel}deg)`;
      els.hull.textContent = `${Math.round(d.hull)}%`;
      els.hullBox.classList.toggle('low', d.hull < 40);
      if (d.dock) {
        els.dock.classList.remove('hidden');
        els.dockTitle.textContent = d.dock.name;
        chip(els.dkPos, 'Position', d.dock.inside);
        chip(els.dkSpd, 'Speed', d.dock.speedOk);
        chip(els.dkAng, 'Angle', d.dock.angleOk);
        els.dockHint.textContent = d.dock.hint;
        els.dockFill.style.width = `${Math.round(d.dock.hold * 100)}%`;
      } else {
        els.dock.classList.add('hidden');
      }
    },
    warn(text, ms = 2500) {
      els.warning.textContent = text;
      els.warning.classList.add('show');
      clearTimeout(warnTimeout);
      warnTimeout = setTimeout(() => els.warning.classList.remove('show'), ms);
    },
    show(v) { $('hud').classList.toggle('hidden', !v); },
  };
}
