// Keyboard and pointer input for the slingshot.
//
// The ship is launched by dragging: pull back from the pad like a slingshot
// and release — the ship flies the opposite way. Arrow keys aim instead
// (left/right turn, up/down power) and Space launches. One-shot presses
// (confirm, pause, restart, mute) are queued as bit flags and taken once by
// the loop, so a press between two frames is never lost or counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_MUTE = 8;

const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const RESTART = new Set(['KeyR']);
const MUTE = new Set(['KeyM']);
const DIGITS = new Set(['Digit1', 'Digit2', 'Digit3']);
const AIM_LEFT = new Set(['ArrowLeft', 'KeyA']);
const AIM_RIGHT = new Set(['ArrowRight', 'KeyD']);
const AIM_UP = new Set(['ArrowUp', 'KeyW']);
const AIM_DOWN = new Set(['ArrowDown', 'KeyS']);

export function createInput(canvas, toField) {
  let actions = 0;
  // Pointer drag, in field coordinates (null when no drag is happening).
  let drag = null;
  let released = null;
  // Workshop pick: 1, 2 or 3 pressed since the last takeDigit() call.
  let digit = null;
  // Keyboard aim: angle in radians (0 = right, negative = up) and power 0..1.
  // It wakes the first time an arrow key is pressed.
  const keyboardAim = { active: false, angle: -0.6, power: 0.6 };

  function fieldPos(event) {
    const rect = canvas.getBoundingClientRect();
    return toField(event.clientX - rect.left, event.clientY - rect.top);
  }

  canvas.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    // A new press supersedes any release nobody consumed (a stale release
    // must never leak into the next screen and launch the ship by itself).
    released = null;
    const p = fieldPos(event);
    drag = { x: p.x, y: p.y };
    keyboardAim.active = false;
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // Not all browsers grant capture; the drag still works without it.
    }
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const p = fieldPos(event);
    drag.x = p.x;
    drag.y = p.y;
  });
  function endDrag(event) {
    if (!drag) return;
    // The release point in field coordinates; the loop measures the pull
    // from the ship and decides whether it is a real launch.
    const p = event ? fieldPos(event) : { x: drag.x, y: drag.y };
    released = { x: p.x, y: p.y };
    drag = null;
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', () => {
    drag = null;
  });

  window.addEventListener('keydown', (event) => {
    if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (RESTART.has(event.code)) {
      if (!event.repeat) actions |= ACTION_RESTART;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (DIGITS.has(event.code)) {
      if (!event.repeat) digit = Number(event.code.slice(-1));
    } else if (AIM_LEFT.has(event.code)) {
      keyboardAim.active = true;
      keyboardAim.angle -= 0.06;
    } else if (AIM_RIGHT.has(event.code)) {
      keyboardAim.active = true;
      keyboardAim.angle += 0.06;
    } else if (AIM_UP.has(event.code)) {
      keyboardAim.active = true;
      keyboardAim.power = Math.min(1, keyboardAim.power + 0.05);
    } else if (AIM_DOWN.has(event.code)) {
      keyboardAim.active = true;
      keyboardAim.power = Math.max(0.15, keyboardAim.power - 0.05);
    } else {
      return;
    }
    event.preventDefault();
  });
  window.addEventListener('blur', () => {
    drag = null;
  });

  return {
    /** The live drag, or null. Its x/y are field coordinates of the pointer. */
    get drag() {
      return drag;
    },
    /** Keyboard aim state (angle radians, power 0..1, active once arrows are used). */
    keyboardAim,
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The pointer release since the last call, or null. */
    takeRelease() {
      const taken = released;
      released = null;
      return taken;
    },
    /** A workshop digit (1, 2 or 3) pressed since the last call, or null. */
    takeDigit() {
      const taken = digit;
      digit = null;
      return taken;
    },
  };
}
