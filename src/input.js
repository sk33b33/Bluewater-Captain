// Keyboard + gamepad -> { throttle, steer }, plus one-shot actions.
export function createInput(target = window) {
  const keys = new Set();
  const pressed = new Set();
  target.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!keys.has(e.code)) pressed.add(e.code);
    keys.add(e.code);
  });
  target.addEventListener('keyup', (e) => keys.delete(e.code));
  target.addEventListener('blur', () => keys.clear());

  const dead = (v) => (Math.abs(v) < 0.15 ? 0 : v);

  return {
    read() {
      let throttle = 0;
      let steer = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) throttle += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) throttle -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) steer += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) steer -= 1;
      const pad = (navigator.getGamepads && navigator.getGamepads()[0]) || null;
      if (pad) {
        steer += dead(pad.axes[0] || 0);
        throttle += (pad.buttons[7]?.value || 0) - (pad.buttons[6]?.value || 0);
        throttle += -dead(pad.axes[1] || 0);
      }
      return {
        throttle: Math.max(-1, Math.min(1, throttle)),
        steer: Math.max(-1, Math.min(1, steer)),
        padRespawn: !!pad?.buttons[3]?.pressed,
        padConfirm: !!pad?.buttons[0]?.pressed,
      };
    },
    wasPressed(code) {
      return pressed.delete(code);
    },
    clearPressed() { pressed.clear(); },
    isDown(code) { return keys.has(code); },
  };
}
