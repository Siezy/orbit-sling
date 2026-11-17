// Every tuning number and colour in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule
// below depends on the screen size.
//
// SKY RACE (v4): a 9-stage campaign across 4 named realms plus a boss
// stage. The slingshot is a takeoff: the plane sits on a runway at the
// bottom-left, drag-aim-release launches it (the takeoff roll), it flies
// the course collecting stars and boost rings, and it must LAND on the strip
// at the bottom-right once every star is collected. Between realms the
// player picks 1 of 3 relics in the workshop; the rivals rubber-band.

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
  /** Bonus for clearing the second stage of a realm. */
  realmClear: 400,
  /** Bonus for beating the Thunderhead. */
  bossClear: 1000,
};

/** How far outside the field a plane may drift before it is lost in the sky.
 * Small on purpose: a flight that leaves the visible field ends quickly
 * instead of sailing off-screen for seconds, which keeps the pace tight. */
export const LOST_MARGIN = 150;
/** Distance that counts as a near miss past a vortex (past its surface). */
export const GRAZE_BAND = 42;

/** A bird strike costs this fraction of the plane's speed (not a life). */
export const BIRD_SLOW = 0.35;
/** Seconds a bird stays harmless after hitting the plane (so one bird cannot hit twice in a row). */
export const BIRD_COOLDOWN = 2;

/** Fuel: the second verb. A flight starts with a full tank; it drains in
 * the air. Boost rings refill it and kick the plane faster. Running dry
 * ends the flight (no life lost — same off-course rule as v3 — but the
 * stars banked stay banked). The drain is tuned so a direct star run
 * (2-3 s) is free, a looping slingshot (5-7 s) needs a ring. */
export const FUEL = {
  max: 100,
  drainPerSec: 14,
  ringRefill: 35,
  ringBoost: 1.3,
  /** Pickup radius of a boost ring. */
  ringRadius: 26,
};

/** The campaign: 4 realms of 2 stages, then the boss stage. */
export const STAGES = 9;
export const BOSS_STAGE = 9;
export const BOSS_NAME = 'THUNDERHEAD';

/** Stage names, 1-based. */
export const STAGE_NAMES = {
  1: 'Meadow Run',
  2: 'First Storm',
  3: 'Peak Crossing',
  4: 'Gale Pass',
  5: 'Dusk Run',
  6: 'Ember Coast',
  7: 'Starlight Climb',
  8: 'Summit Approach',
  9: 'Thunderhead',
};

/** Realms: stages 1-2, 3-4, 5-6, 7-8. Each has its own sky, ground, and
 * obstacle mix. The boss stage flies the Night Summit sky, darker. */
export const REALMS = [
  {
    name: 'DAWN MEADOWS',
    flavor: 'First light over the meadows. Learn the sky.',
    skyTop: '#5fb4f0', skyMid: '#9fd8f8', skyHorizon: '#dff4fd',
    ground: '#5da24a', groundDark: '#4a8539',
    text: '#12233a', muted: '#5b6b7f', night: false,
  },
  {
    name: 'STORM PEAKS',
    flavor: 'The peaks breed storms. Ride the wind, don’t fight it.',
    skyTop: '#6f87b8', skyMid: '#9fb2d4', skyHorizon: '#dde6f2',
    ground: '#5f7050', groundDark: '#4a5a3e',
    text: '#12233a', muted: '#5b6b7f', night: false,
  },
  {
    name: 'TWILIGHT COAST',
    flavor: 'Dusk over the water. The wind turns strange here.',
    skyTop: '#e08a5a', skyMid: '#f0b27e', skyHorizon: '#ffe9d2',
    ground: '#3f7a68', groundDark: '#2f5f52',
    text: '#2a1a12', muted: '#6b5a4a', night: false,
  },
  {
    name: 'NIGHT SUMMIT',
    flavor: 'Cold stars, darker storms. Only the best land here.',
    skyTop: '#141d38', skyMid: '#2a3558', skyHorizon: '#5d6f92',
    ground: '#2c4636', groundDark: '#223829',
    text: '#eef3ff', muted: '#9fb0cc', night: true,
  },
];

/** Which realm a stage belongs to (0-based). Stage 9 is the boss. */
export function realmOf(stage) {
  return Math.min(Math.floor((stage - 1) / 2), REALMS.length - 1);
}

/** The Thunderhead boss: a giant storm entity that drifts across the
 * field and throws lightning. Bolts strike fixed columns on a fixed
 * schedule (a pure function of stage time), telegraphed 1.2 s ahead, so a
 * launch can be proven safe before it is flown. */
export const BOSS = {
  radius: 105,
  driftX: 190,
  driftY: 65,
  /** Seconds per drift cycle (x and y use different periods so the path never repeats exactly). */
  driftPeriodX: 18,
  driftPeriodY: 23,
  /** First bolt at stage time 3 s, then one every 5 s. */
  boltFirst: 3,
  boltPeriod: 5,
  boltTelegraph: 1.2,
  /** The bolt's strike column is this wide (px). */
  boltWidth: 70,
  /** How long a strike flash lasts (s). */
  boltFlash: 0.18,
};

/** Workshop relics: pick 1 of 3 after each realm. Each is a real effect;
 * the letter is the icon drawn on its card and in the HUD. */
export const RELICS = {
  tank: { letter: 'F', color: '#f2a007', name: 'BIG TANK', blurb: '+50 max fuel' },
  magnet: { letter: 'M', color: '#ff7fb0', name: 'MAGNET COIL', blurb: 'Magnet +40% reach, +7s' },
  plating: { letter: 'S', color: '#5df2ff', name: 'SHIELD PLATING', blurb: 'Start every level shielded' },
  wings: { letter: 'W', color: '#7dffd4', name: 'SWIFT WINGS', blurb: '+15% top speed' },
  hull: { letter: 'H', color: '#b39ddb', name: 'STORM HULL', blurb: 'Storm winds 25% weaker' },
  tailwind: { letter: '»', color: '#ffd94d', name: 'TAILWIND', blurb: 'Rings: +50% boost, +15 fuel' },
  extra: { letter: '+', color: '#7dffd4', name: 'EXTRA PLANE', blurb: '+1 plane, max 5' },
  doubler: { letter: '×2', color: '#f2c94c', name: 'STAR DOUBLER', blurb: 'Stars worth 2× this realm' },
};
export const RELIC_IDS = Object.keys(RELICS);

export const LEVEL = {
  /** Last stage: the boss. */
  max: 9,
  /** Seconds of the level-clear fanfare before the next level starts. */
  clearPause: 1.6,
};

/** The two AI rivals: names and colours. They race the same course on
 * seeded, deterministic flight plans — no network, no other humans. In v4
 * they rubber-band: faster when behind, easing off when ahead. */
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
