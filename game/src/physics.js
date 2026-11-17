// Flight physics. Everything here is pure arithmetic on plain objects, so
// the trajectory preview, the level generator, the rival plans and the live
// game all fly the same physics — what the preview shows is what happens.
//
// The wind: storm vortexes pull the plane (gravity), storm cells orbit them,
// turbulence zones wobble the plane, birds slow it, the ground ends a
// flight — except the landing strip, which ends it in glory. Fuel drains in
// the air; boost rings refill it and kick the plane faster. On the boss
// stage the Thunderhead drifts across the field and throws lightning on a
// fixed schedule.

import {
  BIRD_COOLDOWN,
  BIRD_SLOW,
  BOSS,
  FIELD,
  FUEL,
  GRAZE_BAND,
  GRAVITY_G,
  GROUND_LINE,
  LOST_MARGIN,
  MAGNET_PULL,
  MAGNET_RADIUS,
  SOFT2,
  STEP,
  STRIP,
} from './config.js';

function dist(x1, y1, x2, y2) {
  return Math.hypot(x1 - x2, y1 - y2);
}

/** Acceleration at (x, y) from every storm vortex's wind. `windFactor`
 * scales the wind (the Storm Hull relic weakens it). */
export function gravityAt(vortexes, x, y, windFactor = 1) {
  let ax = 0;
  let ay = 0;
  for (const p of vortexes) {
    const dx = p.x - x;
    const dy = p.y - y;
    const d2 = dx * dx + dy * dy + SOFT2;
    const a = (GRAVITY_G * p.mass) / d2;
    const d = Math.sqrt(d2);
    ax += (a * dx) / d;
    ay += (a * dy) / d;
  }
  return { ax: ax * windFactor, ay: ay * windFactor };
}

function hitsVortex(vortexes, x, y) {
  for (const p of vortexes) {
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

/** A bird's position at game time `t` (deterministic: same t, same bird). */
export function birdPos(bird, t) {
  const span = FIELD.width + 80;
  let x = bird.startX + bird.dir * bird.speed * t;
  x = ((x + 40) % span + span) % span - 40;
  const y = bird.baseY + Math.sin(t * bird.freq + bird.phase) * bird.amp;
  return { x, y };
}

function inStrip(x, y) {
  return x >= STRIP.x0 && x <= STRIP.x1 && y >= STRIP.y0 && y <= STRIP.y1;
}

/**
 * The Thunderhead's position at stage time `t` (seconds since the boss
 * stage started): a slow drift on two sines. A pure function, so the
 * preview, the generator and the live game all agree where it is.
 */
export function bossAt(level, stageTime) {
  const b = level.boss;
  return {
    x: 640 + Math.sin((stageTime * Math.PI * 2) / BOSS.driftPeriodX + b.phaseX) * BOSS.driftX,
    y: 300 + Math.sin((stageTime * Math.PI * 2) / BOSS.driftPeriodY + b.phaseY) * BOSS.driftY,
  };
}

/**
 * The lightning state at stage time `t`: which column (if any) is being
 * telegraphed, and which column (if any) is striking right now. Bolts
 * strike every BOSS.boltPeriod seconds from BOSS.boltFirst, cycling the
 * seeded columns. A pure function of stage time.
 */
export function boltState(level, stageTime) {
  // The first telegraph starts 1.2 s before the first bolt, so the early
  // return allows that window in.
  if (!level.boss || stageTime < BOSS.boltFirst - BOSS.boltTelegraph) return { telegraph: null, striking: null };
  const k = Math.floor((stageTime - BOSS.boltFirst) / BOSS.boltPeriod);
  const strikeT = BOSS.boltFirst + k * BOSS.boltPeriod;
  const col = level.boss.columns[k % level.boss.columns.length];
  if (stageTime >= strikeT && stageTime < strikeT + BOSS.boltFlash) {
    return { telegraph: null, striking: col };
  }
  // The telegraph warns of the NEXT strike (1.2 s ahead), so the player can
  // move out of the column. Checking the last strike's window was wrong:
  // after the first bolt that window is always in the past, so the
  // telegraph never showed again and the lightning was not dodgeable.
  const nextT = strikeT + BOSS.boltPeriod;
  const nextCol = level.boss.columns[(k + 1) % level.boss.columns.length];
  if (stageTime >= nextT - BOSS.boltTelegraph && stageTime < nextT) {
    return { telegraph: nextCol, striking: null };
  }
  return { telegraph: null, striking: null };
}

/**
 * Fly a point forward under vortex wind and return its path, one point per
 * fixed step. Stops early on a vortex hit, a ground hit, or when it leaves
 * the world. The caller samples the points it draws.
 */
export function simulatePath(vortexes, x, y, vx, vy, steps) {
  const points = [{ x, y }];
  let px = x;
  let py = y;
  let pvx = vx;
  let pvy = vy;
  for (let i = 0; i < steps; i += 1) {
    const { ax, ay } = gravityAt(vortexes, px, py);
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
    if (hitsVortex(vortexes, px, py) || py > GROUND_LINE || outOfWorld(px, py)) break;
  }
  return points;
}

/** Move the storm cells along their orbits (deterministic, no collisions between them). */
export function updateStormCells(level, dt) {
  for (const a of level.storms) {
    a.angle += a.speed * dt;
    a.rot += a.rotSpeed * dt;
    a.x = a.anchor.x + Math.cos(a.angle) * a.orbitR;
    a.y = a.anchor.y + Math.sin(a.angle) * a.orbitR;
  }
}

/**
 * Fly a point forward with the storm cells moving alongside it, and return
 * the flight: its points, how many stars (and rings) the path collects, and
 * whether it lands. This is the trajectory preview: it is the same physics
 * the live game runs (storms first, then the plane, one fixed step at a
 * time), so what the preview shows is what happens. When `collect` is true
 * the stars and rings are collected on an internal clone, so a launch that
 * banks the last star and lands shows the landing — the preview then tells
 * the player "this takeoff wins the level". Fuel drains in the air and a
 * ring refills it and boosts the plane, exactly as in the live game. The
 * last point carries `hit` ('vortex', 'storm', 'ground', 'lost', 'fuel',
 * 'boss', 'bolt' or 'land') when the flight ends that way, and null
 * otherwise.
 */
export function simulateFlight(level, x, y, vx, vy, steps, time0 = 0, collect = false, fuel0 = null) {
  const points = [{ x, y, hit: null }];
  // Clone the moving hazards so the real ones are untouched.
  const storms = level.storms.map((a) => ({ ...a }));
  const birds = level.birds.map((b) => ({ ...b }));
  const stars = collect ? level.stars.map((s) => ({ ...s })) : null;
  const rings = collect ? (level.rings ?? []).map((r) => ({ ...r })) : null;
  const simLevel = {
    vortexes: level.vortexes,
    storms,
    turbulence: level.turbulence,
    birds,
    boss: level.boss,
    windFactor: level.windFactor ?? 1,
    stageStartTime: level.stageStartTime ?? 0,
  };
  const maxFuel = level.fuelMax ?? FUEL.max;
  const ringRefill = level.ringRefill ?? FUEL.ringRefill;
  const ringBoost = level.ringBoost ?? FUEL.ringBoost;
  let fuel = fuel0 ?? maxFuel;
  let px = x;
  let py = y;
  let pvx = vx;
  let pvy = vy;
  let time = time0;
  let landed = false;
  let fuelOut = false;
  for (let i = 0; i < steps; i += 1) {
    time += STEP;
    updateStormCells(simLevel, STEP);
    const ship = { x: px, y: py, vx: pvx, vy: pvy, grazed: new Set() };
    const canLand = collect && stars.every((s) => s.taken);
    const ev = advanceShip(simLevel, ship, STEP, time, canLand);
    px = ship.x;
    py = ship.y;
    pvx = ship.vx;
    pvy = ship.vy;
    // Fuel drains in the air; a ring refills it and boosts the plane.
    fuel -= FUEL.drainPerSec * STEP;
    if (collect) {
      for (const r of rings) {
        if (!r.taken && dist(px, py, r.x, r.y) < FUEL.ringRadius) {
          r.taken = true;
          fuel = Math.min(fuel + ringRefill, maxFuel);
          const sp = Math.hypot(pvx, pvy) || 1;
          const boosted = Math.min(sp * ringBoost, 2400);
          pvx = (pvx / sp) * boosted;
          pvy = (pvy / sp) * boosted;
        }
      }
      for (const s of stars) {
        // 30px pickup: generous enough that a turbulence wobble or a bird
        // nudge does not make a star on a flown corridor unreachable.
        if (!s.taken && dist(px, py, s.x, s.y) < 30) s.taken = true;
      }
    }
    let hit = null;
    if (ev) {
      if (ev.type === 'land') {
        hit = 'land';
        landed = true;
      } else if (ev.type === 'bird' || ev.type === 'bounce') {
        hit = null; // a scare, not the end of the flight
      } else {
        hit = ev.type; // vortex, storm, ground, lost, boss, bolt
      }
    } else if (fuel <= 0) {
      hit = 'fuel';
      fuelOut = true;
    }
    points.push({ x: px, y: py, hit });
    if (hit) break;
  }
  return {
    points,
    stars: collect ? stars.filter((s) => s.taken).length : 0,
    rings: collect ? rings.filter((r) => r.taken).length : 0,
    land: landed,
    fuelOut,
    fuelLeft: fuel,
  };
}

/**
 * Advance the plane one fixed step. Returns null while it flies, or the
 * event that ended (or shook) the flight:
 * - { type: 'vortex' | 'storm' | 'ground' | 'lost' | 'boss' | 'bolt' } — the flight is over.
 * - { type: 'land' } — the plane landed on the strip (only when `canLand`).
 * - { type: 'bounce' } — the plane touched the strip too fast or too early
 *   and bounced back up; the flight continues.
 * - { type: 'bird' } — a bird strike: the plane lost speed (already
 *   applied here); the flight continues.
 */
export function advanceShip(level, ship, dt, time, canLand = false) {
  let { ax, ay } = gravityAt(level.vortexes, ship.x, ship.y, level.windFactor ?? 1);
  // The landing beacon (ILS): once every star is collected, a gentle pull
  // toward the strip centre guides the final approach home. It only bends
  // the flight — the player still has to fly a takeoff that gets near the
  // strip, and the speed cap still decides whether the landing counts.
  if (canLand && ship.x > STRIP.beaconX) {
    const bx = (STRIP.x0 + STRIP.x1) / 2;
    const by = (STRIP.y0 + STRIP.y1) / 2;
    const dx = bx - ship.x;
    const dy = by - ship.y;
    const d = Math.hypot(dx, dy) || 1;
    ax += (dx / d) * STRIP.beaconPull;
    ay += (dy / d) * STRIP.beaconPull;
  }
  // Turbulence zones wobble the plane and drag it a little. The wobble is
  // a function of game time and the zone's seed, so the preview, the rival
  // plans and the live game all agree about it. It is deliberately soft:
  // a hard wobble would throw a flight off its star corridor (the wobble
  // phase shifts with launch time, so a strong one makes stars unreachable).
  let inTurb = false;
  for (const z of level.turbulence ?? []) {
    const ex = (ship.x - z.x) / z.rx;
    const ey = (ship.y - z.y) / z.ry;
    if (ex * ex + ey * ey < 1) {
      inTurb = true;
      ax += Math.sin(time * 11 + z.seed) * 70;
      ay += Math.cos(time * 9 + z.seed * 1.7) * 70;
    }
  }
  ship.vx += ax * dt;
  ship.vy += ay * dt;
  if (inTurb) {
    ship.vx *= 1 - 0.05 * dt;
    ship.vy *= 1 - 0.05 * dt;
  }
  let sp = Math.hypot(ship.vx, ship.vy);
  if (sp > 2400) {
    ship.vx *= 2400 / sp;
    ship.vy *= 2400 / sp;
  }
  ship.x += ship.vx * dt;
  ship.y += ship.vy * dt;
  sp = Math.hypot(ship.vx, ship.vy);
  // Landing: inside the strip zone, slow enough, stars all collected.
  if (canLand && inStrip(ship.x, ship.y) && sp <= STRIP.maxSpeed) return { type: 'land' };
  // Touching the strip surface without landing (too fast, or stars remain):
  // the plane bounces back up instead of crashing.
  if (inStrip(ship.x, ship.y) && ship.y > GROUND_LINE) {
    ship.vy = -Math.abs(ship.vy) * 0.45;
    ship.vx *= 0.8;
    ship.y = GROUND_LINE;
    return { type: 'bounce' };
  }
  const vortex = hitsVortex(level.vortexes, ship.x, ship.y);
  if (vortex) return { type: 'vortex', vortex };
  for (const a of level.storms) {
    if (dist(ship.x, ship.y, a.x, a.y) < a.r + 7) return { type: 'storm', storm: a };
  }
  // The Thunderhead: touching the boss cloud, or standing in a lightning
  // column when a bolt strikes, ends the flight.
  if (level.boss) {
    const stageTime = time - (level.stageStartTime ?? 0);
    const bp = bossAt(level, stageTime);
    if (dist(ship.x, ship.y, bp.x, bp.y) < BOSS.radius + 6) return { type: 'boss' };
    const { striking } = boltState(level, stageTime);
    if (striking != null && Math.abs(ship.x - striking) < BOSS.boltWidth / 2 && ship.y < GROUND_LINE - 10) {
      return { type: 'bolt' };
    }
  }
  if (ship.y > GROUND_LINE) return { type: 'ground' };
  if (outOfWorld(ship.x, ship.y)) return { type: 'lost' };
  for (const b of level.birds ?? []) {
    if (time < b.coolUntil) continue;
    const bp = birdPos(b, time);
    if (dist(ship.x, ship.y, bp.x, bp.y) < 19) {
      b.coolUntil = time + BIRD_COOLDOWN;
      ship.vx *= 1 - BIRD_SLOW;
      ship.vy *= 1 - BIRD_SLOW;
      return { type: 'bird', bird: b };
    }
  }
  return null;
}

/** The first uncollected star within pickup range of the plane, if any. */
export function starAt(level, ship) {
  for (const s of level.stars) {
    // 30px pickup: generous enough that a turbulence wobble or a bird
    // nudge does not make a star on a flown corridor unreachable.
    if (!s.taken && dist(ship.x, ship.y, s.x, s.y) < 30) return s;
  }
  return null;
}

/** The first uncollected boost ring within pickup range, if any. */
export function ringAt(level, ship) {
  for (const r of level.rings ?? []) {
    if (!r.taken && dist(ship.x, ship.y, r.x, r.y) < FUEL.ringRadius) return r;
  }
  return null;
}

/** The first uncollected power-up within pickup range of the plane, if any. */
export function powerupAt(level, ship) {
  for (const p of level.powerups ?? []) {
    if (!p.taken && dist(ship.x, ship.y, p.x, p.y) < 26) return p;
  }
  return null;
}

/**
 * While the magnet is active, every uncollected star near the plane drifts
 * toward it — the magnet widens the corridor a flight can sweep, so one
 * good takeoff can bank several stars instead of one.
 */
export function pullStars(level, ship, dt, radius = MAGNET_RADIUS) {
  for (const s of level.stars) {
    if (s.taken) continue;
    const dx = ship.x - s.x;
    const dy = ship.y - s.y;
    const d = Math.hypot(dx, dy);
    if (d < radius && d > 20) {
      const step = Math.min(MAGNET_PULL * dt, d - 20);
      s.x += (dx / d) * step;
      s.y += (dy / d) * step;
    }
  }
}

/**
 * A vortex the plane is skimming (inside the graze band, outside its edge)
 * that this flight has not been credited for yet. One graze per vortex per
 * flight: the plane's `grazed` set remembers them.
 */
export function grazeCheck(level, ship) {
  for (let i = 0; i < level.vortexes.length; i += 1) {
    const p = level.vortexes[i];
    const d = dist(ship.x, ship.y, p.x, p.y);
    if (d < p.r + GRAZE_BAND && d > p.r + 6 && !ship.grazed.has(i)) {
      ship.grazed.add(i);
      return p;
    }
  }
  return null;
}
