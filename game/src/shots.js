// Deterministic screenshot scenes (?shot=start|play|action|end&seed=N).
// Each builds a fixed view of the game — same seed, same pixels — paints it
// twice and sets window.__shotReady, so a screenshot tool knows the frame
// is settled. The scenes are real states of the game's own code: the title
// screen over the first realm, a plane mid-flight racing a rival through
// the Storm Peaks, the final approach under the Thunderhead, and the
// campaign-end screen.

import { SHIP } from './config.js';
import { createRandom } from './random.js';
import { FLIGHT_START, generateLevel } from './levels.js';
import { boltState, bossAt, simulateFlight } from './physics.js';

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
    levelIndex: level.stage,
    starsLeft: level.stars.length,
    aim: null,
    power: null,
    trajectory: null,
    shake: 0,
    time: TIME,
    muted: false,
    clearBonus: 0,
    clearBreakdown: '',
    newBest: false,
    won: false,
    shield: false,
    magnetLeft: 0,
    hint: null,
    takeoffT: null,
    takeoffPower: null,
    stripArmed: false,
    rivals: [],
    raceRank: 2,
    raceOrder: [
      { name: 'REX', color: '#ff7a3c', progress: 30, isPlayer: false },
      { name: 'YOU', color: '#ffffff', progress: 20, isPlayer: true },
      { name: 'MAYA', color: '#b678ff', progress: 10, isPlayer: false },
    ],
    fuel: 100,
    fuelMax: 100,
    combo: 0,
    relics: [],
    stageName: '',
    realmName: '',
    boss: null,
    introStage: 1,
    introRealm: null,
    workshopOffers: null,
    workshopCards: null,
    summary: null,
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

/** Rival markers for a scene: REX partway along its first planned flight,
 * MAYA still on the runway (or parked, when told). */
function sceneRivals(level, rexAt, mayaAt) {
  const rivals = [];
  const plan0 = level.rivals[0];
  if (rexAt != null && plan0.paths.length > 0) {
    const path = plan0.paths[0];
    const idx = Math.min(Math.floor(path.points.length * rexAt), path.points.length - 1);
    const pt = path.points[idx];
    const next = path.points[Math.min(idx + 1, path.points.length - 1)];
    rivals.push({
      name: 'REX', color: '#ff7a3c', x: pt.x, y: pt.y,
      angle: Math.atan2(next.y - pt.y, next.x - pt.x), visible: true, phase: 'fly',
    });
  } else {
    rivals.push({ name: 'REX', color: '#ff7a3c', x: level.start.x + 46, y: level.start.y, angle: 0, visible: true, phase: 'aim' });
  }
  if (mayaAt != null) {
    rivals.push({ name: 'MAYA', color: '#b678ff', x: mayaAt.x, y: mayaAt.y, angle: mayaAt.angle ?? 0, visible: true, phase: mayaAt.phase ?? 'aim' });
  } else {
    rivals.push({ name: 'MAYA', color: '#b678ff', x: level.start.x + 86, y: level.start.y, angle: 0, visible: true, phase: 'aim' });
  }
  return rivals;
}

function shotStart(seed) {
  const rng = createRandom(seed);
  const level = generateLevel(rng, 1);
  const view = baseView(level, seed);
  view.screen = 'title';
  view.best = 1250;
  view.ship = { x: level.start.x, y: level.start.y, vx: 0, vy: 0, angle: 0 };
  view.rivals = sceneRivals(level, null, null);
  return view;
}

function shotPlay(seed) {
  const rng = createRandom(seed);
  const level = generateLevel(rng, 3);
  const view = baseView(level, seed);
  view.screen = 'fly';
  view.score = 350;
  view.best = 1250;
  view.lives = 2;
  view.shield = true;
  view.combo = 2;
  view.fuel = 62;
  view.relics = ['tank'];
  view.stageName = 'Peak Crossing';
  view.realmName = 'STORM PEAKS';
  view.raceRank = 2;
  // A fixed takeoff, flown forward: search for the most dramatic racing
  // moment — the plane CLOSE to a vortex, the arc bending hard around it, a
  // star and a boost ring sitting on the arc ahead, the plane near the
  // middle of the frame. A thumbnail must read at a glance: plane + bent
  // arc + star, not a long thin line across an empty field.
  const candidates = [];
  for (const angle of [-0.5, -0.3, -0.1, 0.15]) {
    for (const power of [0.6, 0.75, 0.9]) {
      const vx = Math.cos(angle) * power * SHIP.maxSpeed;
      const vy = Math.sin(angle) * power * SHIP.maxSpeed;
      const { points: path } = simulateFlight(level, FLIGHT_START.x, FLIGHT_START.y, vx, vy, 150, 0, true);
      for (let i = 25; i < Math.min(110, path.length - 45); i += 1) {
        let ahead = 0;
        for (let j = i; j < path.length; j += 1) {
          if (path[j].x < 0 || path[j].x > 1280 || path[j].y < 0 || path[j].y > 720) break;
          ahead += 1;
        }
        // How close is the plane to a vortex here (slingshot moment)?
        let nearVortex = 1e9;
        for (const p of level.vortexes) {
          nearVortex = Math.min(nearVortex, Math.hypot(path[i].x - p.x, path[i].y - p.y) - p.r);
        }
        // How hard does the arc bend ahead? (direction change over 40 steps)
        const v1x = path[i + 1].x - path[i].x;
        const v1y = path[i + 1].y - path[i].y;
        const v2x = path[Math.min(i + 40, path.length - 1)].x - path[i + 20].x;
        const v2y = path[Math.min(i + 40, path.length - 1)].y - path[i + 20].y;
        const dot = (v1x * v2x + v1y * v2y) / (Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y) + 1e-9);
        const bend = Math.acos(Math.max(-1, Math.min(1, dot)));
        // Is a star or a ring on the arc ahead (the shot's goal)?
        let starNear = 0;
        let ringNear = 0;
        for (const s of level.stars) {
          for (let j = i; j < Math.min(i + 60, path.length); j += 1) {
            if (Math.hypot(path[j].x - s.x, path[j].y - s.y) < 130) { starNear = 1; break; }
          }
          if (starNear) break;
        }
        for (const r of level.rings ?? []) {
          for (let j = i; j < Math.min(i + 60, path.length); j += 1) {
            if (Math.hypot(path[j].x - r.x, path[j].y - r.y) < 130) { ringNear = 1; break; }
          }
          if (ringNear) break;
        }
        const d = Math.hypot(path[i].x - 640, path[i].y - 360);
        const closeBonus = nearVortex > 15 && nearVortex < 120 ? 200 : -Math.abs(nearVortex - 60);
        const score = bend * 300 + closeBonus + starNear * 150 + ringNear * 120 + ahead * 1.5 - d / 25;
        candidates.push({ path, i, score });
      }
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  // Take the best candidate whose forward trajectory does NOT end in a
  // crash: the shot's trajectory preview draws a red X for a crash ending,
  // and the dossier's play shot should read as a race, not a doom marker.
  // Fall back to the top candidate if every one ends in a crash.
  let chosen = candidates[0];
  for (const cand of candidates.slice(0, 25)) {
    const at = cand.path[cand.i];
    const prev = cand.path[Math.max(0, cand.i - 1)];
    const fvx = (at.x - prev.x) / (1 / 60);
    const fvy = (at.y - prev.y) / (1 / 60);
    const fwd = simulateFlight(level, at.x, at.y, fvx, fvy, 150, 0, true);
    const fwdHit = fwd.points[fwd.points.length - 1].hit;
    if (fwdHit !== 'vortex' && fwdHit !== 'storm' && fwdHit !== 'boss' && fwdHit !== 'bolt' && fwdHit !== 'ground') {
      chosen = cand;
      break;
    }
  }
  const { path, i: pick } = chosen;
  const at = path[pick];
  const prev = path[Math.max(0, pick - 1)];
  const flightVx = (at.x - prev.x) / (1 / 60);
  const flightVy = (at.y - prev.y) / (1 / 60);
  view.ship = { x: at.x, y: at.y, vx: flightVx, vy: flightVy, angle: Math.atan2(flightVy, flightVx) };
  view.trajectory = simulateFlight(level, at.x, at.y, flightVx, flightVy, 150, 0, true).points;
  // One star already collected, its sparkles frozen mid-burst.
  const taken = level.stars[0];
  taken.taken = true;
  view.starsLeft = level.stars.filter((s) => !s.taken).length;
  view.particles = sparkles(rng, taken.x, taken.y, '#f2c94c', 10);
  view.popups = [{ x: taken.x, y: taken.y - 20, text: '+100', color: '#f2c94c', size: 22, life: 0.7, maxLife: 1 }];
  view.rivals = sceneRivals(level, 0.45, null);
  return view;
}

function shotAction(seed) {
  const rng = createRandom(seed);
  const level = generateLevel(rng, 9);
  const view = baseView(level, seed);
  view.screen = 'fly';
  view.score = 3420;
  view.best = 3420;
  view.lives = 2;
  view.raceRank = 1;
  view.stageName = 'Thunderhead';
  view.realmName = 'NIGHT SUMMIT';
  view.relics = ['tank', 'magnet', 'plating'];
  view.fuel = 71;
  view.raceOrder = [
    { name: 'YOU', color: '#ffffff', progress: 40, isPlayer: true },
    { name: 'REX', color: '#ff7a3c', progress: 30, isPlayer: false },
    { name: 'MAYA', color: '#b678ff', progress: 20, isPlayer: false },
  ];
  // All stars collected: the strip is armed. (The stars MUST be marked
  // taken before the search: simulateFlight only arms the landing when
  // every star is taken, so without this no takeoff can land at all.)
  for (const s of level.stars) s.taken = true;
  view.starsLeft = 0;
  view.stripArmed = true;
  let best = null;
  const search = (aStep, pStep) => {
    for (let a = -0.6; a <= 0.601; a += aStep) {
      for (let p = 0.4; p <= 1.001; p += pStep) {
        const vx = Math.cos(a) * p * SHIP.maxSpeed;
        const vy = Math.sin(a) * p * SHIP.maxSpeed;
        const { points: path, land } = simulateFlight(level, FLIGHT_START.x, FLIGHT_START.y, vx, vy, 300, 0, true);
        if (!land) continue;
        // The approach point closest to the strip (largest x in the box).
        for (let i = 0; i < path.length - 5; i += 1) {
          if (path[i].x > 780 && path[i].x < 1080 && path[i].y > 380 && path[i].y < 600) {
            if (!best || path[i].x > best.x) best = { path, i, x: path[i].x };
          }
        }
        // No approach point on this path: keep the landing path itself as
        // a fallback (its midpoint is still a real final approach).
        if (!best) best = { path, i: Math.floor(path.length * 0.6), x: -1 };
      }
    }
  };
  search(0.05, 0.05);
  if (!best) search(0.01, 0.02);
  if (!best) {
    // No landing takeoff on this layout: fall back to the play-style arc.
    return shotPlay(seed);
  }
  const { path, i } = best;
  const at = path[i];
  const prev = path[Math.max(0, i - 1)];
  const flightVx = (at.x - prev.x) / (1 / 60);
  const flightVy = (at.y - prev.y) / (1 / 60);
  view.ship = { x: at.x, y: at.y, vx: flightVx, vy: flightVy, angle: Math.atan2(flightVy, flightVx) };
  view.trajectory = simulateFlight(level, at.x, at.y, flightVx, flightVy, 150, 0, true).points;
  // The Thunderhead at stage time 7.2 s: mid-drift, and a bolt is being
  // telegraphed (the 8 s strike warns from 6.8 s). If the plane would sit
  // inside the boss or the warning column, pick the next approach point.
  const bossTime = 7.2;
  let bossView = { pos: bossAt(level, bossTime), ...boltState(level, bossTime) };
  if (Math.hypot(at.x - bossView.pos.x, at.y - bossView.pos.y) < 160
    || (bossView.telegraph != null && Math.abs(at.x - bossView.telegraph) < 60)) {
    bossView = { pos: bossAt(level, 2.0), ...boltState(level, 2.0) };
  }
  view.boss = bossView;
  view.time = bossTime;
  view.particles = sparkles(rng, at.x, at.y, '#7dffd4', 8);
  view.popups = [{ x: at.x, y: at.y - 30, text: 'FINAL APPROACH!', color: '#0e7490', size: 22, life: 0.7, maxLife: 1 }];
  view.rivals = sceneRivals(level, 0.7, { x: 1120, y: 640, angle: 0, phase: 'land' });
  return view;
}

function shotEnd(seed) {
  const rng = createRandom(seed);
  const level = generateLevel(rng, 9);
  const view = baseView(level, seed);
  view.screen = 'over';
  view.score = 4850;
  view.best = 4850;
  view.newBest = true;
  view.won = true;
  view.lives = 0;
  view.starsLeft = 0;
  for (const s of level.stars) s.taken = true;
  view.stageName = 'Thunderhead';
  view.realmName = 'NIGHT SUMMIT';
  view.summary = { time: 272, stars: 41, relics: ['tank', 'magnet', 'plating', 'wings'], bestRank: 1 };
  view.rivals = sceneRivals(level, null, { x: 1120, y: 640, angle: 0, phase: 'land' });
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
