// Keyboard + gamepad -> { throttle, steer }, plus one-shot actions.
// Gamepad (standard mapping): left stick steers, triggers (or left stick up/down) set throttle,
// A = Enter (confirm / next), B = Escape (back / pause), Start = Escape, Y = respawn.
// Buttons act once per press, not every frame while held.
export function createInput(target = window) {
  const keys = new Set();
  const pressed = new Set();
  target.addEventListener('keydown', (e) => {
    // Only steal arrow/space keys while sailing; menus (quiz radios, sliders, buttons) need them.
    const menuOpen = !!document.querySelector('.overlay:not(.hidden)');
    if (!menuOpen && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!keys.has(e.code)) pressed.add(e.code);
    keys.add(e.code);
  });
  target.addEventListener('keyup', (e) => keys.delete(e.code));
  target.addEventListener('blur', () => keys.clear());

  const touch = { throttle: 0, steer: 0 };
  const padHeld = new Set();
  const PAD_ACTIONS = { 0: 'Enter', 1: 'Escape', 3: 'KeyR', 9: 'Escape' };
  const dead = (v) => (Math.abs(v) < 0.15 ? 0 : v);

  return {
    read() {
      let throttle = 0;
      let steer = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) throttle += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) throttle -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) steer += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) steer -= 1;
      throttle += touch.throttle;
      steer += touch.steer;
      const pad = (navigator.getGamepads && navigator.getGamepads()[0]) || null;
      if (pad) {
        steer += dead(pad.axes[0] || 0);
        throttle += (pad.buttons[7]?.value || 0) - (pad.buttons[6]?.value || 0);
        throttle += -dead(pad.axes[1] || 0);
      }
      return {
        throttle: Math.max(-1, Math.min(1, throttle)),
        steer: Math.max(-1, Math.min(1, steer)),
      };
    },
    // Call once per frame: turns gamepad button presses into the same one-shot actions as the keyboard.
    pollPad() {
      const pad = (navigator.getGamepads && navigator.getGamepads()[0]) || null;
      if (!pad) { padHeld.clear(); return; }
      for (const [i, code] of Object.entries(PAD_ACTIONS)) {
        const down = !!(pad.buttons[i] && pad.buttons[i].pressed);
        if (down && !padHeld.has(i)) pressed.add(code);
        if (down) padHeld.add(i); else padHeld.delete(i);
      }
    },
    wasPressed(code) {
      return pressed.delete(code);
    },
    touch,
    press(code) { pressed.add(code); },
    resetTouch() { touch.throttle = 0; touch.steer = 0; },
    clearPressed() { pressed.clear(); },
    isDown(code) { return keys.has(code); },
  };
}
