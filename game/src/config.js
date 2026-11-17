// Every tuning number and colour in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule
// below depends on the screen size.
//
// SKY RACE (v3): the slingshot is a takeoff. The plane sits on a runway at
// the bottom-left, drag-aim-release launches it (the takeoff roll), it flies
// the course collecting stars, and it must LAND on the strip at the
// bottom-right once every star is collected.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Universal gravitation constant for the storm vortexes (px^3 / s^2, scaled). */
export const GRAVITY_G = 8000;
/** Softening added to the squared distance, so a plane skimming a vortex does not slingshot to infinity. */
export const SOFT2 = 900;

export const SHIP = {
  radius: 10,
  /** Fastest launch speed, px/s. */
  maxSpeed: 780,
  /** Dragging the pointer this far from the plane is a full-power launch. */
  dragFull: 260,
};

/** The ground band: the top of the grass (y) and the runway surface line. */
export const GROUND_TOP = 660;
/** The runway surface line: touching below this outside the strip is a ground crash. */
export const GROUND_LINE = 668;

/** Takeoff roll: the plane always rolls exactly this far along the runway
 * before lifting off, whatever the launch power — so the flight always
 * starts from the same point and the generator, the preview and the
 * auto-player all simulate from there. */
export const TAKEOFF_ROLL = 90;
/** Seconds the takeoff roll lasts (the plane's speed ramps over it). */
export const TAKEOFF_SECONDS = 0.35;

/** The landing strip: x range of the strip, and the generous landing zone
 * (the plane lands by flying INTO the zone, not by touching a line). */
export const STRIP = {
  x0: 1000,
  x1: 1270,
  y0: 560,
  y1: GROUND_LINE,
  /** Fastest arrival speed that still counts as a landing. */
  maxSpeed: 800,
  /** The landing beacon (ILS): once every star is collected, a gentle pull
   * toward the strip centre guides the final approach home. It only bends
   * the flight, it never lands the plane by itself. */
  beaconX: 700,
  beaconPull: 320,
};

export const LIVES = 3;
/** The most planes a run can hold (an extra-life power-up stops here). */
export const LIFE_MAX = 5;

/** Power-ups, one per level. Type cycles shield → magnet → life. */
export const POWERUPS = {
  shield: { letter: 'S', color: '#5df2ff', label: 'SHIELD', blurb: 'Shield! One crash forgiven.' },
  magnet: { letter: 'M', color: '#ff7fb0', label: 'MAGNET', blurb: 'Magnet! Stars drift to you.' },
  life: { letter: '+', color: '#7dffd4', label: 'EXTRA PLANE', blurb: 'Extra plane! +1 life.' },
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
  /** Bonus for finishing a level ahead of both rivals / one rival / none. */
  raceFirst: 150,
  raceSecond: 50,
  /** Bonus for a gentle landing (arrival speed under this fraction of the cap). */
  smoothLanding: 100,
};

/** How far outside the field a plane may drift before it is lost in the sky.
 * Small on purpose: a flight that leaves the visible field ends quickly
 * instead of sailing off-screen for seconds, which keeps the pace tight. */
export const LOST_MARGIN = 150;
/** Distance that counts as a near miss past a vortex (past its edge). */
export const GRAZE_BAND = 42;

/** A bird strike costs this fraction of the plane's speed (not a life). */
export const BIRD_SLOW = 0.35;
/** Seconds a bird stays harmless after hitting the plane (so one bird cannot hit twice in a row). */
export const BIRD_COOLDOWN = 2;

export const LEVEL = {
  /** Last level: vortex and storm-cell counts stop growing there. */
  max: 8,
  /** Seconds of the level-clear fanfare before the next level starts. */
  clearPause: 1.6,
};

/** The two AI rivals: names and colours. They race the same course on
 * seeded, deterministic flight plans — no network, no other humans. */
export const RIVALS = [
  { name: 'REX', color: '#ff7a3c', dark: '#a03d12' },
  { name: 'MAYA', color: '#b678ff', dark: '#5e2fa0' },
];

export const PALETTE = {
  skyTop: '#5fb4f0',
  skyMid: '#9fd8f8',
  skyHorizon: '#dff4fd',
  sun: '#ffd94d',
  cloud: '#ffffff',
  ground: '#5da24a',
  groundDark: '#4a8539',
  runway: '#5a5f6b',
  runwayLine: '#f5f7fa',
  strip: '#6b7280',
  stripEdge: '#7dffd4',
  star: '#f2c94c',
  plane: '#ffffff',
  planeStripe: '#e63946',
  planeGlow: '#8fd8ff',
  aim: '#1d7a4d',
  text: '#12233a',
  textLight: '#eef3ff',
  muted: '#5b6b7f',
  panel: 'rgba(255, 255, 255, 0.86)',
  panelDark: 'rgba(10, 16, 40, 0.72)',
  danger: '#ff5d6c',
  storm: '#3a4356',
  stormDark: '#232838',
  stormRim: '#8d9bb5',
  turbulence: 'rgba(255, 255, 255, 0.5)',
};

/** Storm vortex looks: base, dark core, rim shade. */
export const VORTEX_STYLES = [
  { base: '#4a5468', dark: '#232838', glow: '#7d8aa5', rim: '#aab6cc' },
  { base: '#54466e', dark: '#2b2140', glow: '#8a76b8', rim: '#b39ddb' },
  { base: '#3d5a6e', dark: '#1d3242', glow: '#6d93ad', rim: '#9dbfd4' },
  { base: '#5e4a5e', dark: '#332433', glow: '#967a96', rim: '#c2a6c2' },
];

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'sky-race.best';
