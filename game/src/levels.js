// Level generation: a seeded sky of storm vortexes, stars, boost rings,
// storm cells, turbulence zones, birds, rival flight plans — and, on the
// last stage, the Thunderhead boss.
//
// Every star is placed ON a real flight path, so every level is beatable by
// construction: pick a random takeoff (angle, power), fly it forward under
// the vortexes' wind, and put the star on that path. The player can find
// the same takeoff again with the trajectory preview the game draws while
// aiming. Stars chain along shared flight corridors (v2's balance fix): one
// good takeoff can bank several stars, which is what makes a campaign
// possible on 3 lives. Rings sit on the same corridors, early in the
// flight, so a ring never costs a detour.

import {
  BOSS,
  BOSS_STAGE,
  FIELD,
  FUEL,
  POWERUP_CYCLE,
  REALMS,
  RELIC_IDS,
  SHIP,
  STRIP,
  TAKEOFF_ROLL,
  VORTEX_STYLES,
  realmOf,
} from './config.js';
import { simulateFlight } from './physics.js';
import { createRandom } from './random.js';

const START = { x: 110, y: 640 };

/** Where every flight physically starts: the end of the fixed takeoff roll. */
export const FLIGHT_START = { x: START.x + TAKEOFF_ROLL, y: START.y };

function dist(x1, y1, x2, y2) {
  return Math.hypot(x1 - x2, y1 - y2);
}

/** Distance from a point to the landing-strip zone (0 when inside it). */
function distToStrip(x, y) {
  const dx = Math.max(STRIP.x0 - x, 0, x - STRIP.x1);
  const dy = Math.max(STRIP.y0 - y, 0, y - STRIP.y1);
  return Math.hypot(dx, dy);
}

// Snap a launch parameter to the 0.05 grid the trajectory preview and the
// auto-player search on. Star and power-up placement uses snapped launches
// only, so every placed star sits on a path the grid search can reproduce
// exactly — reachable by construction, not by luck.
const snapLaunch = (v, base) => base + Math.round((v - base) / 0.05) * 0.05;

/** Obstacle counts per stage (1-based). The boss stage is gentler on
 * vortexes — the Thunderhead itself is the threat. */
function stageCounts(stage) {
  if (stage === BOSS_STAGE) {
    return { vortexes: 3, storms: 1, turbulence: 1, birds: 2, stars: 3, rings: 2 };
  }
  const realm = realmOf(stage);
  return {
    vortexes: Math.min(2 + realm + (stage % 2 === 0 ? 1 : 0), 5),
    storms: Math.min(Math.max(stage - 2, 0), 4),
    turbulence: realm === 0 ? 0 : realm === 1 ? 1 : 2,
    birds: Math.min(Math.max(stage - 1, 0), 4),
    stars: Math.min(2 + stage, 6),
    rings: stage === 1 ? 1 : 2,
  };
}

function makeVortexes(rng, stage, count) {
  const vortexes = [];
  let tries = 0;
  while (vortexes.length < count && tries < 400) {
    tries += 1;
    const r = rng.range(42, 86);
    // Sky only: never over the runway, never in the landing approach
    // corridor (x > 980 and low), never over the ground — and never close
    // enough to the landing strip to bend a final approach away from it
    // (a vortex near the strip pulls harder than the landing beacon).
    const x = rng.range(450, 980);
    const y = rng.range(90, 500);
    if (dist(x, y, FLIGHT_START.x, FLIGHT_START.y) < 300) continue;
    if (distToStrip(x, y) < 260) continue;
    if (vortexes.some((p) => dist(x, y, p.x, p.y) < p.r + r + 180)) continue;
    vortexes.push({
      x,
      y,
      r,
      mass: r * 40,
      style: rng.pick(VORTEX_STYLES),
      // Swirl knots, fixed for this vortex.
      swirls: Array.from({ length: rng.int(2, 4) }, () => ({
        dx: rng.range(-0.5, 0.5) * r,
        dy: rng.range(-0.5, 0.5) * r,
        r: rng.range(0.12, 0.26) * r,
      })),
    });
  }
  return vortexes;
}

function makeStars(rng, stage, count, simLevel, speed) {
  const stars = [];
  let tries = 0;
  while (stars.length < count && tries < 300) {
    tries += 1;
    // A random takeoff from the end of the runway, flown forward: the star
    // goes on its path. The flight is simulated with the FULL physics
    // (storm cells, birds, turbulence, boss included), so a star never lands
    // on a path a storm or a bird actually blocks. The launch is snapped to
    // the 0.05 grid the preview searches, so the path is reproducible.
    const angle = snapLaunch(rng.range(-1.15, 0.25), -1.15);
    const power = snapLaunch(rng.range(0.45, 1), 0.45);
    const vx = Math.cos(angle) * power * speed;
    const vy = Math.sin(angle) * power * speed;
    const { points: path } = simulateFlight(simLevel, FLIGHT_START.x, FLIGHT_START.y, vx, vy, 150, 0, false);
    if (path.length < 30) continue;
    // From the second star on, prefer a path that ALSO passes near the
    // star placed just before it: stars then form a chain along one flight
    // corridor, so a single good takeoff can bank several stars in sequence
    // instead of one. (A single star per flight cannot pay for a campaign
    // on 3 run-wide lives — that was the v1 wall.) The band is 70px, not the
    // 26px pickup range: a tighter band was tried and made things worse —
    // it forced stars onto one narrow path and left some unreachable.
    if (stars.length > 0) {
      const prev = stars[stars.length - 1];
      const nearPrev = path.some((pt) => dist(pt.x, pt.y, prev.x, prev.y) < 70);
      if (!nearPrev) continue;
    }
    const at = path[Math.floor(rng.range(0.25, 0.85) * path.length)];
    const x = at.x;
    const y = at.y;
    if (x < 60 || x > FIELD.width - 60 || y < 60 || y > 600) continue;
    if (simLevel.vortexes.some((p) => dist(x, y, p.x, p.y) < p.r + 95)) continue;
    if (stars.some((s) => dist(x, y, s.x, s.y) < 100)) continue;
    if (dist(x, y, FLIGHT_START.x, FLIGHT_START.y) < 200) continue;
    stars.push({ x, y, taken: false, phase: rng.range(0, Math.PI * 2) });
  }
  // Fallback: if the chain rule failed for a star, take a point on a
  // snapped grid launch's path (no chain rule). Still on a real,
  // reproducible flight — never open sky, which could be unreachable.
  let fbTries = 0;
  while (stars.length < count && fbTries < 500) {
    fbTries += 1;
    const angle = snapLaunch(rng.range(-1.15, 0.25), -1.15);
    const power = snapLaunch(rng.range(0.45, 1), 0.45);
    const vx = Math.cos(angle) * power * speed;
    const vy = Math.sin(angle) * power * speed;
    const { points: path } = simulateFlight(simLevel, FLIGHT_START.x, FLIGHT_START.y, vx, vy, 150, 0, false);
    if (path.length < 30) continue;
    const at = path[Math.floor(rng.range(0.25, 0.85) * path.length)];
    const x = at.x;
    const y = at.y;
    if (x < 60 || x > FIELD.width - 60 || y < 60 || y > 600) continue;
    if (simLevel.vortexes.some((p) => dist(x, y, p.x, p.y) < p.r + 95)) continue;
    if (stars.some((s) => dist(x, y, s.x, s.y) < 100)) continue;
    if (dist(x, y, FLIGHT_START.x, FLIGHT_START.y) < 200) continue;
    stars.push({ x, y, taken: false, phase: rng.range(0, Math.PI * 2) });
  }
  // Last resort (should never run): the midpoint of the longest grid
  // launch's path — on a real flight by construction.
  while (stars.length < count) {
    let longest = null;
    for (let a = -1.15; a <= 1.151; a += 0.05) {
      for (let p = 0.45; p <= 1.001; p += 0.05) {
        const vx = Math.cos(a) * p * speed;
        const vy = Math.sin(a) * p * speed;
        const { points: path } = simulateFlight(simLevel, FLIGHT_START.x, FLIGHT_START.y, vx, vy, 150, 0, false);
        if (!longest || path.length > longest.length) longest = path;
      }
    }
    if (!longest || longest.length < 10) break;
    const at = longest[Math.floor(longest.length / 2)];
    stars.push({ x: at.x, y: at.y, taken: false, phase: rng.range(0, Math.PI * 2) });
  }
  return stars;
}

function makeStormCells(rng, stage, count, vortexes) {
  const storms = [];
  let tries = 0;
  while (storms.length < count && tries < 200) {
    tries += 1;
    const anchor = rng.pick(vortexes);
    const orbitR = anchor.r + rng.range(95, 210);
    const angle = rng.range(0, Math.PI * 2);
    const speed = rng.range(0.2, 0.55) * (rng.next() < 0.5 ? -1 : 1);
    // The orbit must never sweep near the runway: the first seconds of
    // every flight are a safe corridor, so a takeoff is never doomed at once.
    const closest = dist(anchor.x, anchor.y, FLIGHT_START.x, FLIGHT_START.y) - orbitR;
    if (closest < 260) continue;
    // ...and never near the landing strip: a storm cell sweeping through
    // the final approach would make landing a lottery (that is what killed
    // landing on one level: a cell orbited straight through the strip).
    if (distToStrip(anchor.x, anchor.y) - orbitR < 70) continue;
    // Vertices of the cell, fixed for this storm.
    const verts = Array.from({ length: 9 }, (_, i) => {
      const a = (i / 9) * Math.PI * 2;
      return { a, k: rng.range(0.72, 1.15) };
    });
    storms.push({
      anchor,
      orbitR,
      angle,
      speed,
      r: rng.range(10, 17),
      verts,
      rot: rng.range(0, Math.PI * 2),
      rotSpeed: rng.range(-0.6, 0.6),
      x: anchor.x + Math.cos(angle) * orbitR,
      y: anchor.y + Math.sin(angle) * orbitR,
    });
  }
  return storms;
}

function makeTurbulence(rng, stage, count, vortexes) {
  const zones = [];
  let tries = 0;
  while (zones.length < count && tries < 100) {
    tries += 1;
    const cx = rng.range(350, 1000);
    const cy = rng.range(120, 520);
    const rx = rng.range(70, 110);
    const ry = rng.range(40, 60);
    if (dist(cx, cy, FLIGHT_START.x, FLIGHT_START.y) < 260) continue;
    // Keep the landing approach corridor clear.
    if (cx > 980 && cy > 500) continue;
    if (vortexes.some((p) => dist(cx, cy, p.x, p.y) < p.r + rx + 40)) continue;
    zones.push({ x: cx, y: cy, rx, ry, seed: rng.range(0, Math.PI * 2) });
  }
  return zones;
}

function makeBirds(rng, count) {
  const birds = [];
  for (let i = 0; i < count; i += 1) {
    birds.push({
      baseY: rng.range(120, 560),
      speed: rng.range(60, 110),
      dir: rng.next() < 0.5 ? 1 : -1,
      phase: rng.range(0, Math.PI * 2),
      amp: rng.range(15, 40),
      freq: rng.range(1.5, 3),
      startX: rng.range(0, FIELD.width),
      coolUntil: 0,
    });
  }
  return birds;
}

/** The Thunderhead: drift phases and the lightning columns. The boss
 * drifts on two slow sines (a pure function of stage time) and throws a
 * bolt every BOSS.boltPeriod seconds from BOSS.boltFirst, each into one of
 * four seeded columns that never cover the runway or the strip. */
function makeBoss(rng) {
  const columns = [];
  let tries = 0;
  while (columns.length < 4 && tries < 200) {
    tries += 1;
    const x = rng.range(320, 940);
    if (columns.some((c) => Math.abs(c - x) < 150)) continue;
    columns.push(x);
  }
  columns.sort((a, b) => a - b);
  return {
    phaseX: rng.range(0, Math.PI * 2),
    phaseY: rng.range(0, Math.PI * 2),
    columns: columns.length === 4 ? columns : [350, 520, 690, 860],
  };
}

/**
 * Boost rings: golden rings on star-collecting flight paths, early in the
 * flight (steps 15-40). A ring never costs a detour — it rides along on a
 * star run — and a ring grabbed early still has most of the flight left to
 * spend its fuel on. Same placement rule as the power-ups.
 */
function makeRings(rng, stage, count, simLevel, stars, storms, speed) {
  const rings = [];
  // First pass: flight paths that collect at least one star (full physics,
  // so a ring never sits on a path a storm actually blocks).
  const starPaths = [];
  for (let a = -1.15; a <= 1.151; a += 0.1) {
    for (let p = 0.45; p <= 1.001; p += 0.1) {
      const vx = Math.cos(a) * p * speed;
      const vy = Math.sin(a) * p * speed;
      const { points: path } = simulateFlight(simLevel, FLIGHT_START.x, FLIGHT_START.y, vx, vy, 150, 0, false);
      let hits = 0;
      for (const pt of path) {
        for (const s of stars) {
          if (dist(pt.x, pt.y, s.x, s.y) < 30) hits += 1;
        }
      }
      if (hits >= 1) starPaths.push(path);
    }
  }
  let tries = 0;
  while (rings.length < count && tries < 300) {
    tries += 1;
    let path;
    let step;
    if (starPaths.length > 0) {
      path = starPaths[Math.floor(rng.next() * starPaths.length)];
      step = 15 + Math.floor(rng.next() * 26);
    } else {
      const angle = snapLaunch(rng.range(-1.15, 0.25), -1.15);
      const power = snapLaunch(rng.range(0.45, 1), 0.45);
      const vx = Math.cos(angle) * power * speed;
      const vy = Math.sin(angle) * power * speed;
      const r = simulateFlight(simLevel, FLIGHT_START.x, FLIGHT_START.y, vx, vy, 150, 0, false);
      path = r.points;
      if (path.length < 30) continue;
      step = Math.floor(rng.range(0.25, 0.85) * path.length);
    }
    if (step >= path.length) continue;
    const at = path[step];
    const x = at.x;
    const y = at.y;
    if (x < 60 || x > FIELD.width - 60 || y < 60 || y > 600) continue;
    if (simLevel.vortexes.some((p) => dist(x, y, p.x, p.y) < p.r + 95)) continue;
    if (stars.some((s) => dist(x, y, s.x, s.y) < 40)) continue;
    if (rings.some((g) => dist(x, y, g.x, g.y) < 120)) continue;
    if (storms.some((a) => dist(x, y, a.x, a.y) < a.r + 60)) continue;
    if (dist(x, y, FLIGHT_START.x, FLIGHT_START.y) < 120) continue;
    rings.push({ x, y, taken: false, phase: rng.range(0, Math.PI * 2) });
  }
  return rings;
}

/** One power-up per level. The orb sits ON a flight path that also collects
 * a star, early in the flight (steps 15-40): grabbing it costs the player
 * nothing extra — it rides along on a star run — and a magnet grabbed early
 * still has most of the flight left to pull stars. An orb off to the side,
 * or late in the flight, would be a dedicated detour that costs a life,
 * which is worse than no orb at all. Type cycles shield → magnet → life. */
function makePowerups(rng, stage, simLevel, stars, storms, speed) {
  const type = POWERUP_CYCLE[(stage - 1) % POWERUP_CYCLE.length];
  // First pass: flight paths that collect at least one star (full physics,
  // so the orb never sits on a path a storm actually blocks).
  const starPaths = [];
  for (let a = -1.15; a <= 1.151; a += 0.1) {
    for (let p = 0.45; p <= 1.001; p += 0.1) {
      const vx = Math.cos(a) * p * speed;
      const vy = Math.sin(a) * p * speed;
      const { points: path } = simulateFlight(simLevel, FLIGHT_START.x, FLIGHT_START.y, vx, vy, 150, 0, false);
      let hits = 0;
      for (const pt of path) {
        for (const s of stars) {
          if (dist(pt.x, pt.y, s.x, s.y) < 30) hits += 1;
        }
      }
      if (hits >= 1) starPaths.push(path);
    }
  }
  let tries = 0;
  while (tries < 300) {
    tries += 1;
    let path;
    let step;
    if (starPaths.length > 0) {
      path = starPaths[Math.floor(rng.next() * starPaths.length)];
      step = 15 + Math.floor(rng.next() * 26);
    } else {
      const angle = snapLaunch(rng.range(-1.15, 0.25), -1.15);
      const power = snapLaunch(rng.range(0.45, 1), 0.45);
      const vx = Math.cos(angle) * power * speed;
      const vy = Math.sin(angle) * power * speed;
      const r = simulateFlight(simLevel, FLIGHT_START.x, FLIGHT_START.y, vx, vy, 150, 0, false);
      path = r.points;
      if (path.length < 30) continue;
      step = Math.floor(rng.range(0.25, 0.85) * path.length);
    }
    if (step >= path.length) continue;
    const at = path[step];
    const x = at.x;
    const y = at.y;
    if (x < 60 || x > FIELD.width - 60 || y < 60 || y > 600) continue;
    if (simLevel.vortexes.some((p) => dist(x, y, p.x, p.y) < p.r + 95)) continue;
    // 40px from a star is enough to tell the ring apart from the star;
    // the old 100px rule rejected most points on a star path, because the
    // star sits just ahead on the same flight.
    if (stars.some((s) => dist(x, y, s.x, s.y) < 40)) continue;
    if (storms.some((a) => dist(x, y, a.x, a.y) < a.r + 60)) continue;
    // 120px from the runway end (the old 200px rule would reject most early-path
    // points, since the plane is only ~90-200px out at steps 15-25).
    if (dist(x, y, FLIGHT_START.x, FLIGHT_START.y) < 120) continue;
    return [{ x, y, type, taken: false, phase: rng.range(0, Math.PI * 2) }];
  }
  // Fallback: open sky, clear of vortexes and stars.
  for (let i = 0; i < 200; i += 1) {
    const x = rng.range(300, FIELD.width - 80);
    const y = rng.range(80, 580);
    if (simLevel.vortexes.some((p) => dist(x, y, p.x, p.y) < p.r + 120)) continue;
    if (stars.some((s) => dist(x, y, s.x, s.y) < 110)) continue;
    return [{ x, y, type, taken: false, phase: rng.range(0, Math.PI * 2) }];
  }
  return [];
}

/**
 * One rival's flight plan for a level: a few precomputed takeoff paths,
 * each a real simulated flight (same physics as the player's), with the
 * stars that flight passes counted. The rival plays the paths back in
 * order, pausing to "aim" between them; its progress is the stars it
 * banks. Paths are sampled every 2 steps to keep them small. Rivals fly
 * the base speed (they hold no relics).
 */
function makeRivalPlan(rng, level) {
  const paths = [];
  let tries = 0;
  while (paths.length < 4 && tries < 120) {
    tries += 1;
    const angle = rng.range(-1.15, 0.25);
    const power = rng.range(0.5, 1);
    const vx = Math.cos(angle) * power * SHIP.maxSpeed;
    const vy = Math.sin(angle) * power * SHIP.maxSpeed;
    const { points: path } = simulateFlight(level, FLIGHT_START.x, FLIGHT_START.y, vx, vy, 200, 0);
    if (path.length < 25) continue;
    // Stars this flight passes (before any crash point).
    let stars = 0;
    for (const s of level.stars) {
      for (const pt of path) {
        if (pt.hit) break;
        if (dist(pt.x, pt.y, s.x, s.y) < 26) {
          stars += 1;
          break;
        }
      }
    }
    const points = [];
    for (let i = 0; i < path.length; i += 2) points.push({ x: path[i].x, y: path[i].y });
    paths.push({ points, stars, seconds: path.length / 60 });
  }
  // Fallback: a flat flight straight down the runway line always exists.
  if (paths.length === 0) {
    const path = simulateFlight(level, FLIGHT_START.x, FLIGHT_START.y, 546, 0, 200, 0);
    const points = [];
    for (let i = 0; i < path.length; i += 2) points.push({ x: path[i].x, y: path[i].y });
    paths.push({ points, stars: 0, seconds: path.length / 60 });
  }
  return { paths, aimPause: rng.range(1.8, 3.2) };
}

/**
 * Build stage `stage` (1-based) from a seeded generator.
 * opts: { maxSpeed (relic-adjusted launch speed), windFactor (Storm Hull) }.
 */
export function generateLevel(rng, stage, opts = {}) {
  const speed = opts.maxSpeed ?? SHIP.maxSpeed;
  const windFactor = opts.windFactor ?? 1;
  const counts = stageCounts(stage);
  const realm = REALMS[realmOf(stage)];
  const vortexes = makeVortexes(rng, stage, counts.vortexes);
  // Storm cells, turbulence and birds come before the stars: star and
  // power-up placement simulates the full physics (storms, birds and the
  // wobble included), so nothing is placed on a path a bird or a storm
  // actually blocks.
  const storms = makeStormCells(rng, stage, counts.storms, vortexes);
  const turbulence = makeTurbulence(rng, stage, counts.turbulence, vortexes);
  const birds = makeBirds(rng, counts.birds);
  // The boss comes before the stars too: star placement simulates the boss
  // drifting and its bolts, so no star sits on a path the Thunderhead
  // actually blocks.
  const boss = stage === BOSS_STAGE ? makeBoss(rng) : null;
  const simLevel = { vortexes, storms, turbulence, birds, boss, windFactor, fuelMax: FUEL.max, stageStartTime: 0 };
  const stars = makeStars(rng, stage, counts.stars, simLevel, speed);
  const rings = makeRings(rng, stage, counts.rings, simLevel, stars, storms, speed);
  const powerups = makePowerups(rng, stage, simLevel, stars, storms, speed);
  const built = {
    stage,
    level: stage,
    realm: realmOf(stage),
    palette: realm,
    vortexes,
    stars,
    rings,
    storms,
    turbulence,
    birds,
    boss,
    powerups,
    windFactor,
    fuelMax: FUEL.max,
    stageStartTime: 0,
    start: { ...START },
  };
  // Rival plans are drawn from the same rng stream, after the level itself.
  built.rivals = [makeRivalPlan(rng, built), makeRivalPlan(rng, built)];
  return built;
}

/**
 * The rival plan for one rival on one level, generated on demand from the
 * run seed — rivals advance levels independently of the player, so the
 * plan for their next level is built when they get there. Deterministic:
 * the same (seed, level, rival) always yields the same plan.
 */
export function rivalPlanFor(seed, stageNum, rivalIdx) {
  const level = generateLevel(createRandom((seed + stageNum * 1000003) >>> 0), stageNum);
  return level.rivals[rivalIdx];
}

/**
 * Workshop offers: 3 distinct relics the player does not own yet, from a
 * seeded shuffle. Deterministic: the same (seed, workshopIndex, owned)
 * always yields the same offers.
 */
export function relicOffers(seed, workshopIndex, owned) {
  const rng = createRandom((seed + 777000 + workshopIndex * 7919) >>> 0);
  const pool = RELIC_IDS.filter((id) => !owned.includes(id));
  // Fisher-Yates on the seeded stream.
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng.next() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}

export const LAUNCH_PAD = START;
export { STRIP };
