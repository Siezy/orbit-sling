// Every tuning number and colour in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule
// below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Universal gravitation constant for the planets (px^3 / s^2, scaled). */
export const GRAVITY_G = 8000;
/** Softening added to the squared distance, so a ship skimming a planet does not slingshot to infinity. */
export const SOFT2 = 900;

export const SHIP = {
  radius: 10,
  /** Fastest launch speed, px/s. */
  maxSpeed: 780,
  /** Dragging the pointer this far from the ship is a full-power launch. */
  dragFull: 260,
};

export const LIVES = 3;
/** The most ships a run can hold (an extra-life power-up stops here). */
export const LIFE_MAX = 5;

/** Power-ups, one per level. Type cycles shield → magnet → life. */
export const POWERUPS = {
  shield: { letter: 'S', color: '#5df2ff', label: 'SHIELD', blurb: 'Shield! One crash forgiven.' },
  magnet: { letter: 'M', color: '#ff7fb0', label: 'MAGNET', blurb: 'Magnet! Stars drift to you.' },
  life: { letter: '+', color: '#7dffd4', label: 'EXTRA SHIP', blurb: 'Extra ship! +1 life.' },
};
/** The type on each level (1-based): shield, magnet, life, then repeat. */
export const POWERUP_CYCLE = ['shield', 'magnet', 'life'];
/** Magnet reach (px) and pull speed (px/s) while it is active. */
export const MAGNET_RADIUS = 300;
export const MAGNET_PULL = 220;
/** Magnet lasts this many seconds of game time. 15s, not 10s: a magnet
 * grabbed on one flight must still be alive after the player spends a few
 * seconds aiming the next one — at 10s it expired mid-aim, so the next
 * flight never got to use it. */
export const MAGNET_SECONDS = 15;

/** Seconds between star pickups for the combo to keep building. */
export const COMBO_WINDOW = 4;
/** Combo multiplier caps here. */
export const COMBO_MAX = 5;

export const SCORE = {
  star: 100,
  graze: 25,
  levelClear: 250,
};

/** How far outside the field a ship may drift before it is lost in space.
 * Small on purpose: a flight that leaves the visible field ends quickly
 * instead of sailing off-screen for seconds, which keeps the pace tight. */
export const LOST_MARGIN = 150;
/** Distance that counts as a near miss past a planet (past its surface). */
export const GRAZE_BAND = 42;

export const LEVEL = {
  /** Last level: planet and asteroid counts stop growing there. */
  max: 8,
  /** Seconds of the level-clear fanfare before the next level starts. */
  clearPause: 1.6,
};

export const PALETTE = {
  backdropTop: '#04081a',
  backdropBottom: '#0b1030',
  nebulaA: '#3b1d6e',
  nebulaB: '#0d4f5c',
  star: '#f2c94c',
  ship: '#5df2ff',
  shipGlow: '#2fb9ff',
  aim: '#7dffd4',
  text: '#eef3ff',
  muted: '#93a0c2',
  panel: 'rgba(10, 16, 40, 0.72)',
  danger: '#ff5d6c',
  asteroid: '#8d7d6b',
};

/** Planet looks: hue, whether it wears a ring, crater shade. */
export const PLANET_STYLES = [
  { base: '#7a5cff', dark: '#3d2b8f', glow: '#8f7bff', ring: false },
  { base: '#ff7a59', dark: '#8f2f1d', glow: '#ff9a7a', ring: false },
  { base: '#37c978', dark: '#145c33', glow: '#5ce39a', ring: true },
  { base: '#ff9f43', dark: '#8f5514', glow: '#ffbe78', ring: true },
  { base: '#4fc3f7', dark: '#145a80', glow: '#7fd4ff', ring: false },
  { base: '#e5538f', dark: '#7a2447', glow: '#ff7fb0', ring: false },
];

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'orbit-sling.best';
