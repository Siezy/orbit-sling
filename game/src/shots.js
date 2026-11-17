// Deterministic screenshot scenes (?shot=start|play|action|end&seed=N).
// Each builds a fixed view of the game — same seed, same pixels — paints it
// twice and sets window.__shotReady, so a screenshot tool knows the frame
// is settled. The scenes are real states of the game's own code: the title
// screen, a ship mid-flight, a planet graze, and the game-over screen.

import { SHIP } from './config.js';
import { createRandom } from './random.js';
import { generateLevel } from './levels.js';
import { simulateFlight } from './physics.js';

const TIME = 0.52;

function baseView(level, seed) {
  return {
    screen: 'title',
    level,
    ship: null,
    particles: [],
    popups: [],
    score: 0,
    best: 0,
    lives: 3,
    levelIndex: level.level,
    starsLeft: level.stars.length,
    aim: null,
    trajectory: null,
    shake: 0,
    time: TIME,
    muted: false,
    clearBonus: 0,
    newBest: false,
  };
}

function sparkles(rng, x, y, color, count) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const a = rng.range(0, Math.PI * 2);
    const sp = rng.range(20, 90);
    out.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.6,
      maxLife: 1,
      size: rng.range(2, 4.5),
      color,
    });
  }
  return out;
}

function shotStart(seed) {
  const rng = createRandom(seed);
  const level = generateLevel(rng, 1);
  const view = baseView(level, seed);
  view.screen = 'title';
  view.best = 1250;
  view.ship = { x: level.start.x, y: level.start.y, vx: 0, vy: 0, angle: -0.5 };
  return view;
}

function shotPlay(seed) {
  const rng = createRandom(seed);
  const level = generateLevel(rng, 2);
  const view = baseView(level, seed);
  view.screen = 'fly';
  view.score = 350;
  view.best = 1250;
  view.lives = 2;
  // A fixed launch, flown forward: search for the most dramatic slingshot
  // moment — the ship CLOSE to a planet, the arc bending hard around it, a
  // star sitting on the arc ahead, the ship near the middle of the frame.
  // A thumbnail must read at a glance: planet + bent arc + star, not a long
  // thin line across an empty field.
  const candidates = [];
  for (const angle of [-0.5, -0.3, -0.1, 0.15]) {
    for (const power of [0.6, 0.75, 0.9]) {
      const vx = Math.cos(angle) * power * SHIP.maxSpeed;
      const vy = Math.sin(angle) * power * SHIP.maxSpeed;
      const path = simulateFlight(level, level.start.x, level.start.y, vx, vy, 150);
      for (let i = 25; i < Math.min(110, path.length - 45); i += 1) {
        let ahead = 0;
        for (let j = i; j < path.length; j += 1) {
          if (path[j].x < 0 || path[j].x > 1280 || path[j].y < 0 || path[j].y > 720) break;
          ahead += 1;
        }
        // How close is the ship to a planet here (slingshot moment)?
        let nearPlanet = 1e9;
        for (const p of level.planets) {
          nearPlanet = Math.min(nearPlanet, Math.hypot(path[i].x - p.x, path[i].y - p.y) - p.r);
        }
        // How hard does the arc bend ahead? (direction change over 40 steps)
        const v1x = path[i + 1].x - path[i].x;
        const v1y = path[i + 1].y - path[i].y;
        const v2x = path[Math.min(i + 40, path.length - 1)].x - path[i + 20].x;
        const v2y = path[Math.min(i + 40, path.length - 1)].y - path[i + 20].y;
        const dot = (v1x * v2x + v1y * v2y) / (Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y) + 1e-9);
        const bend = Math.acos(Math.max(-1, Math.min(1, dot)));
        // Is a star on the arc ahead (the shot's goal)?
        let starNear = 0;
        for (const s of level.stars) {
          for (let j = i; j < Math.min(i + 60, path.length); j += 1) {
            if (Math.hypot(path[j].x - s.x, path[j].y - s.y) < 130) { starNear = 1; break; }
          }
          if (starNear) break;
        }
        const d = Math.hypot(path[i].x - 640, path[i].y - 360);
        const closeBonus = nearPlanet > 15 && nearPlanet < 120 ? 200 : -Math.abs(nearPlanet - 60);
        const score = bend * 300 + closeBonus + starNear * 150 + ahead * 1.5 - d / 25;
        candidates.push({ path, i, score });
      }
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const { path, i: pick } = candidates[0];
  const at = path[pick];
  const prev = path[Math.max(0, pick - 1)];
  const flightVx = (at.x - prev.x) / (1 / 60);
  const flightVy = (at.y - prev.y) / (1 / 60);
  view.ship = { x: at.x, y: at.y, vx: flightVx, vy: flightVy, angle: Math.atan2(flightVy, flightVx) };
  view.trajectory = simulateFlight(level, at.x, at.y, flightVx, flightVy, 150);
  // One star already collected, its sparkles frozen mid-burst.
  const taken = level.stars[0];
  taken.taken = true;
  view.starsLeft = level.stars.filter((s) => !s.taken).length;
  view.particles = sparkles(rng, taken.x, taken.y, '#f2c94c', 10);
  view.popups = [{ x: taken.x, y: taken.y - 20, text: '+100', color: '#f2c94c', size: 22, life: 0.7, maxLife: 1 }];
  return view;
}

function shotAction(seed) {
  const rng = createRandom(seed);
  const level = generateLevel(rng, 3);
  const view = baseView(level, seed);
  view.screen = 'fly';
  view.score = 720;
  view.best = 1250;
  view.lives = 2;
  // Search launches for one that grazes a planet: close, but not a crash.
  let found = null;
  outer: for (let a = -1.0; a <= 0.6; a += 0.1) {
    for (let p = 0.6; p <= 1.0; p += 0.1) {
      const vx = Math.cos(a) * p * SHIP.maxSpeed;
      const vy = Math.sin(a) * p * SHIP.maxSpeed;
      const path = simulateFlight(level, level.start.x, level.start.y, vx, vy, 170);
      for (let i = 20; i < path.length; i += 1) {
        for (const planet of level.planets) {
          const d = Math.hypot(path[i].x - planet.x, path[i].y - planet.y);
          if (d > planet.r + 8 && d < planet.r + 40) {
            found = { path, i, planet };
            break outer;
          }
        }
      }
    }
  }
  if (!found) {
    // No graze found on this layout: fall back to the play-style arc.
    return shotPlay(seed);
  }
  const { path, i } = found;
  const at = path[i];
  const prev = path[Math.max(0, i - 1)];
  const flightVx = (at.x - prev.x) / (1 / 60);
  const flightVy = (at.y - prev.y) / (1 / 60);
  view.ship = { x: at.x, y: at.y, vx: flightVx, vy: flightVy, angle: Math.atan2(flightVy, flightVx) };
  view.trajectory = simulateFlight(level, at.x, at.y, flightVx, flightVy, 150);
  view.particles = sparkles(rng, at.x, at.y, '#5df2ff', 8);
  view.popups = [{ x: at.x, y: at.y - 26, text: 'GRAZE +25', color: '#7dffd4', size: 22, life: 0.7, maxLife: 1 }];
  return view;
}

function shotEnd(seed) {
  const rng = createRandom(seed);
  const level = generateLevel(rng, 3);
  const view = baseView(level, seed);
  view.screen = 'over';
  view.score = 1250;
  view.best = 1250;
  view.newBest = true;
  view.lives = 0;
  view.starsLeft = 2;
  return view;
}

/** Build the view for a ?shot= scene (null when the name is unknown). */
export function buildShotView(shot, seed) {
  if (shot === 'start') return shotStart(seed);
  if (shot === 'play') return shotPlay(seed);
  if (shot === 'action') return shotAction(seed);
  if (shot === 'end') return shotEnd(seed);
  return null;
}
