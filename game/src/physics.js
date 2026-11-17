// Gravity, flight and collisions. Everything here is pure arithmetic on
// plain objects, so the trajectory preview, the level generator and the live
// game all fly the same physics — what the preview shows is what happens.

import { FIELD, GRAZE_BAND, GRAVITY_G, LOST_MARGIN, SOFT2, STEP } from './config.js';

function dist(x1, y1, x2, y2) {
  return Math.hypot(x1 - x2, y1 - y2);
}

/** Acceleration at (x, y) from every planet's gravity. */
export function gravityAt(planets, x, y) {
  let ax = 0;
  let ay = 0;
  for (const p of planets) {
    const dx = p.x - x;
    const dy = p.y - y;
    const d2 = dx * dx + dy * dy + SOFT2;
    const a = (GRAVITY_G * p.mass) / d2;
    const d = Math.sqrt(d2);
    ax += (a * dx) / d;
    ay += (a * dy) / d;
  }
  return { ax, ay };
}

function hitsPlanet(planets, x, y) {
  for (const p of planets) {
    if (dist(x, y, p.x, p.y) < p.r + 6) return p;
  }
  return null;
}

function outOfWorld(x, y) {
  return (
    x < -LOST_MARGIN ||
    x > FIELD.width + LOST_MARGIN ||
    y < -LOST_MARGIN ||
    y > FIELD.height + LOST_MARGIN
  );
}

/**
 * Fly a point forward under gravity and return its path, one point per fixed
 * step. Stops early on a planet hit or when it leaves the world. The caller
 * samples the points it draws.
 */
export function simulatePath(planets, x, y, vx, vy, steps) {
  const points = [{ x, y }];
  let px = x;
  let py = y;
  let pvx = vx;
  let pvy = vy;
  for (let i = 0; i < steps; i += 1) {
    const { ax, ay } = gravityAt(planets, px, py);
    pvx += ax * STEP;
    pvy += ay * STEP;
    const sp = Math.hypot(pvx, pvy);
    if (sp > 2400) {
      pvx *= 2400 / sp;
      pvy *= 2400 / sp;
    }
    px += pvx * STEP;
    py += pvy * STEP;
    points.push({ x: px, y: py });
    if (hitsPlanet(planets, px, py) || outOfWorld(px, py)) break;
  }
  return points;
}

/**
 * Fly a point forward under gravity, with the asteroids moving alongside it,
 * and return its path, one point per fixed step. This is the trajectory
 * preview: it is the same physics the live game runs (asteroids first, then
 * the ship, one fixed step at a time), so what the preview shows is what
 * happens. The last point carries `hit` ('planet', 'asteroid' or 'lost')
 * when the flight ends that way, and null otherwise.
 */
export function simulateFlight(level, x, y, vx, vy, steps) {
  const points = [{ x, y, hit: null }];
  // Clone the rocks so the real ones are untouched.
  const rocks = level.asteroids.map((a) => ({ ...a }));
  let px = x;
  let py = y;
  let pvx = vx;
  let pvy = vy;
  for (let i = 0; i < steps; i += 1) {
    for (const r of rocks) {
      r.angle += r.speed * STEP;
      r.x = r.anchor.x + Math.cos(r.angle) * r.orbitR;
      r.y = r.anchor.y + Math.sin(r.angle) * r.orbitR;
    }
    const { ax, ay } = gravityAt(level.planets, px, py);
    pvx += ax * STEP;
    pvy += ay * STEP;
    const sp = Math.hypot(pvx, pvy);
    if (sp > 2400) {
      pvx *= 2400 / sp;
      pvy *= 2400 / sp;
    }
    px += pvx * STEP;
    py += pvy * STEP;
    let hit = null;
    if (hitsPlanet(level.planets, px, py)) hit = 'planet';
    else {
      for (const r of rocks) {
        if (dist(px, py, r.x, r.y) < r.r + 7) {
          hit = 'asteroid';
          break;
        }
      }
    }
    if (!hit && outOfWorld(px, py)) hit = 'lost';
    points.push({ x: px, y: py, hit });
    if (hit) break;
  }
  return points;
}

/** Move the asteroids along their orbits (deterministic, no collisions between them). */
export function updateAsteroids(level, dt) {
  for (const a of level.asteroids) {
    a.angle += a.speed * dt;
    a.rot += a.rotSpeed * dt;
    a.x = a.anchor.x + Math.cos(a.angle) * a.orbitR;
    a.y = a.anchor.y + Math.sin(a.angle) * a.orbitR;
  }
}

/**
 * Advance the ship one fixed step. Returns null while it flies, or the crash
 * that ended the flight: { type: 'planet' | 'asteroid' | 'lost', ... }.
 */
export function advanceShip(level, ship, dt) {
  const { ax, ay } = gravityAt(level.planets, ship.x, ship.y);
  ship.vx += ax * dt;
  ship.vy += ay * dt;
  const sp = Math.hypot(ship.vx, ship.vy);
  if (sp > 2400) {
    ship.vx *= 2400 / sp;
    ship.vy *= 2400 / sp;
  }
  ship.x += ship.vx * dt;
  ship.y += ship.vy * dt;
  const planet = hitsPlanet(level.planets, ship.x, ship.y);
  if (planet) return { type: 'planet', planet };
  for (const a of level.asteroids) {
    if (dist(ship.x, ship.y, a.x, a.y) < a.r + 7) return { type: 'asteroid', asteroid: a };
  }
  if (outOfWorld(ship.x, ship.y)) return { type: 'lost' };
  return null;
}

/** The first uncollected star within pickup range of the ship, if any. */
export function starAt(level, ship) {
  for (const s of level.stars) {
    if (!s.taken && dist(ship.x, ship.y, s.x, s.y) < 26) return s;
  }
  return null;
}

/**
 * A planet the ship is skimming (inside the graze band, outside its surface)
 * that this flight has not been credited for yet. One graze per planet per
 * flight: the ship's `grazed` set remembers them.
 */
export function grazeCheck(level, ship) {
  for (let i = 0; i < level.planets.length; i += 1) {
    const p = level.planets[i];
    const d = dist(ship.x, ship.y, p.x, p.y);
    if (d < p.r + GRAZE_BAND && d > p.r + 6 && !ship.grazed.has(i)) {
      ship.grazed.add(i);
      return p;
    }
  }
  return null;
}
