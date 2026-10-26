// On-screen controls for phones/tablets: sticky throttle lever, spring-back steering slider, respawn.
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function isTouchDevice() {
  try {
    return window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  } catch {
    return false;
  }
}

export function setupTouchControls(input) {
  const root = document.getElementById('touch');
  if (!isTouchDevice()) return false;
  document.body.classList.add('is-touch');
  root.classList.remove('hidden');

  const thr = document.getElementById('t-throttle');
  const thrThumb = document.getElementById('t-throttle-thumb');
  const str = document.getElementById('t-steer');
  const strThumb = document.getElementById('t-steer-thumb');

  const showThrottle = () => { thrThumb.style.top = `calc(30px + ${(1 - input.touch.throttle) / 2} * (100% - 60px))`; };
  const showSteer = () => { strThumb.style.left = `calc(30px + ${(input.touch.steer + 1) / 2} * (100% - 60px))`; };

  function bind(track, onMove, onEnd) {
    let active = null;
    const handle = (e) => {
      const r = track.getBoundingClientRect();
      onMove((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    };
    track.addEventListener('pointerdown', (e) => {
      active = e.pointerId;
      track.setPointerCapture(e.pointerId);
      handle(e);
      e.preventDefault();
    });
    track.addEventListener('pointermove', (e) => { if (e.pointerId === active) handle(e); });
    const end = (e) => { if (e.pointerId === active) { active = null; onEnd(); } };
    track.addEventListener('pointerup', end);
    track.addEventListener('pointercancel', end);
  }

  // Throttle stays where you leave it (centre = neutral, up = ahead, down = astern).
  bind(thr, (_x, y) => {
    let v = clamp(1 - 2 * y, -1, 1);
    if (Math.abs(v) < 0.1) v = 0;
    input.touch.throttle = v;
    showThrottle();
  }, () => {});
  // Steering springs back to centre on release.
  bind(str, (x) => {
    let v = clamp(2 * x - 1, -1, 1);
    if (Math.abs(v) < 0.08) v = 0;
    input.touch.steer = v;
    showSteer();
  }, () => { input.touch.steer = 0; showSteer(); });

  const stop = document.getElementById('t-stop');
  stop.addEventListener('pointerdown', (e) => { e.preventDefault(); input.touch.throttle = 0; showThrottle(); });
  document.getElementById('t-respawn').addEventListener('pointerdown', (e) => { e.preventDefault(); input.press('KeyR'); });

  showThrottle();
  showSteer();
  return { reset() { input.resetTouch(); showThrottle(); showSteer(); } };
}
