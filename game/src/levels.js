// Level generation: a seeded universe of planets, stars and asteroids.
//
// Every star is placed ON a real flight path, so every level is beatable by
// construction: pick a random launch (angle, power), fly it forward under the
// level's gravity, and put the star on that path. The player can find the
// same launch again with the trajectory preview the game draws while aiming.

import { FIELD, PLANET_STYLES, POWERUP_CYCLE } from './config.js';
import { simulatePath } from './physics.js';

const START = { x: 110, y: 360 };

function dist(x1, y1, x2, y2) {
  return Math.hypot(x1 - x2, y1 - y2);
}

function makePlanets(rng, level) {
  const count = Math.min(2 + (level - 1), 5);
  const planets = [];
  let tries = 0;
  while (planets.length < count && tries < 400) {
    tries += 1;
    const r = rng.range(42, 86);
    const x = rng.range(400, FIELD.width - 110);
    const y = rng.range(100, FIELD.height - 100);
    if (dist(x, y, START.x, START.y) < 300) continue;
    if (planets.some((p) => dist(x, y, p.x, p.y) < p.r + r + 180)) continue;
    planets.push({
      x,
      y,
      r,
      mass: r * 40,
      style: rng.pick(PLANET_STYLES),
      // A few craters, fixed for this planet.
      craters: Array.from({ length: rng.int(2, 4) }, () => ({
        dx: rng.range(-0.5, 0.5) * r,
        dy: rng.range(-0.5, 0.5) * r,
        r: rng.range(0.1, 0.22) * r,
      })),
    });
  }
  return planets;
}

function makeStars(rng, level, planets) {
  const count = Math.min(2 + level, 6);
  const stars = [];
  let tries = 0;
  while (stars.length < count && tries < 300) {
    tries += 1;
    // A random launch from the pad, flown forward: the star goes on its path.
    const angle = rng.range(-1.15, 1.15);
    const power = rng.range(0.45, 1);
    const vx = Math.cos(angle) * power * 780;
    const vy = Math.sin(angle) * power * 780;
    const path = simulatePath(planets, START.x, START.y, vx, vy, 150);
    if (path.length < 30) continue;
    // From the second star on, prefer a path that ALSO passes near the
    // star placed just before it: stars then form a chain along one flight
    // corridor, so a single good launch can bank several stars in sequence
    // instead of one. (A single star per flight cannot pay for 8 levels on
    // 3 run-wide lives — that was the v1 wall.) The band is 70px, not the
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
    if (x < 60 || x > FIELD.width - 60 || y < 60 || y > FIELD.height - 60) continue;
    if (planets.some((p) => dist(x, y, p.x, p.y) < p.r + 95)) continue;
    if (stars.some((s) => dist(x, y, s.x, s.y) < 100)) continue;
    if (dist(x, y, START.x, START.y) < 200) continue;
    stars.push({ x, y, taken: false, phase: rng.range(0, Math.PI * 2) });
  }
  // Fallback: if the path trick failed for a star, put it in open space.
  while (stars.length < count) {
    const x = rng.range(300, FIELD.width - 80);
    const y = rng.range(80, FIELD.height - 80);
    if (planets.some((p) => dist(x, y, p.x, p.y) < p.r + 120)) continue;
    if (stars.some((s) => dist(x, y, s.x, s.y) < 110)) continue;
    stars.push({ x, y, taken: false, phase: rng.range(0, Math.PI * 2) });
  }
  return stars;
}

function makeAsteroids(rng, level, planets) {
  const count = Math.min(Math.max(level - 1, 0), 4);
  const asteroids = [];
  let tries = 0;
  while (asteroids.length < count && tries < 200) {
    tries += 1;
    const anchor = rng.pick(planets);
    const orbitR = anchor.r + rng.range(95, 210);
    const angle = rng.range(0, Math.PI * 2);
    const speed = rng.range(0.2, 0.55) * (rng.next() < 0.5 ? -1 : 1);
    // The orbit must never sweep near the launch pad: the first seconds of
    // every flight are a safe corridor, so a launch is never doomed at once.
    const closest = dist(anchor.x, anchor.y, START.x, START.y) - orbitR;
    if (closest < 260) continue;
    // Vertices of the rock, fixed for this asteroid.
    const verts = Array.from({ length: 9 }, (_, i) => {
      const a = (i / 9) * Math.PI * 2;
      return { a, k: rng.range(0.72, 1.15) };
    });
    asteroids.push({
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
  return asteroids;
}

/** One power-up per level. The orb sits ON a flight path that also collects
 * a star, early in the flight (steps 15-40): grabbing it costs the player
 * nothing extra — it rides along on a star run — and a magnet grabbed early
 * still has most of the flight left to pull stars. An orb off to the side,
 * or late in the flight, would be a dedicated detour that costs a life,
 * which is worse than no orb at all. Type cycles shield → magnet → life. */
function makePowerups(rng, level, planets, stars, asteroids) {
  const type = POWERUP_CYCLE[(level - 1) % POWERUP_CYCLE.length];
  // First pass: flight paths that collect at least one star.
  const starPaths = [];
  for (let a = -1.15; a <= 1.151; a += 0.1) {
    for (let p = 0.45; p <= 1.001; p += 0.1) {
      const vx = Math.cos(a) * p * 780;
      const vy = Math.sin(a) * p * 780;
      const path = simulatePath(planets, START.x, START.y, vx, vy, 150);
      let hits = 0;
      for (const pt of path) {
        for (const s of stars) {
          if (dist(pt.x, pt.y, s.x, s.y) < 26) hits += 1;
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
      const angle = rng.range(-1.15, 1.15);
      const power = rng.range(0.45, 1);
      const vx = Math.cos(angle) * power * 780;
      const vy = Math.sin(angle) * power * 780;
      path = simulatePath(planets, START.x, START.y, vx, vy, 150);
      if (path.length < 30) continue;
      step = Math.floor(rng.range(0.25, 0.85) * path.length);
    }
    if (step >= path.length) continue;
    const at = path[step];
    const x = at.x;
    const y = at.y;
    if (x < 60 || x > FIELD.width - 60 || y < 60 || y > FIELD.height - 60) continue;
    if (planets.some((p) => dist(x, y, p.x, p.y) < p.r + 95)) continue;
    // 40px from a star is enough to tell the ring apart from the star;
    // the old 100px rule rejected most points on a star path, because the
    // star sits just ahead on the same flight.
    if (stars.some((s) => dist(x, y, s.x, s.y) < 40)) continue;
    if (asteroids.some((a) => dist(x, y, a.x, a.y) < a.r + 60)) continue;
    // 120px from the pad (the old 200px rule would reject most early-path
    // points, since the ship is only ~90-200px out at steps 15-25).
    if (dist(x, y, START.x, START.y) < 120) continue;
    return [{ x, y, type, taken: false, phase: rng.range(0, Math.PI * 2) }];
  }
  // Fallback: open space, clear of planets and stars.
  for (let i = 0; i < 200; i += 1) {
    const x = rng.range(300, FIELD.width - 80);
    const y = rng.range(80, FIELD.height - 80);
    if (planets.some((p) => dist(x, y, p.x, p.y) < p.r + 120)) continue;
    if (stars.some((s) => dist(x, y, s.x, s.y) < 110)) continue;
    return [{ x, y, type, taken: false, phase: rng.range(0, Math.PI * 2) }];
  }
  return [];
}

/** Build level `level` (1-based) from a seeded generator. */
export function generateLevel(rng, level) {
  const planets = makePlanets(rng, level);
  const stars = makeStars(rng, level, planets);
  const asteroids = makeAsteroids(rng, level, planets);
  const powerups = makePowerups(rng, level, planets, stars, asteroids);
  return { level, planets, stars, asteroids, powerups, start: { ...START } };
}

export const LAUNCH_PAD = START;
