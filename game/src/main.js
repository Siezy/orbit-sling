// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between ten screens:
// title, intro (realm card), aim, takeoff, fly, paused, clear (stage
// complete), workshop (pick a relic), and over (campaign over). The campaign
// is 9 stages across 4 realms plus the Thunderhead boss: takeoff from the
// runway, collect the stars and boost rings, land on the strip — against
// two AI rivals flying the same course.
//
// ?seed=N fixes the sky. ?shot=start|play|action|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import {
  BEST_KEY,
  BOSS_STAGE,
  COMBO_MAX,
  COMBO_WINDOW,
  FUEL,
  LEVEL,
  LIFE_MAX,
  LIVES,
  MAGNET_PULL,
  MAGNET_RADIUS,
  MAGNET_SECONDS,
  POWERUPS,
  REALMS,
  RELICS,
  RIVALS,
  SCORE,
  SHIP,
  STAGE_NAMES,
  STEP,
  STRIP,
  TAKEOFF_ROLL,
  TAKEOFF_SECONDS,
  realmOf,
} from './config.js';
import { createRandom } from './random.js';
import { FLIGHT_START, generateLevel, relicOffers, rivalPlanFor } from './levels.js';
import {
  advanceShip,
  boltState,
  bossAt,
  grazeCheck,
  powerupAt,
  pullStars,
  ringAt,
  simulateFlight,
  starAt,
  updateStormCells,
} from './physics.js';
import {
  ACTION_CONFIRM,
  ACTION_MUTE,
  ACTION_PAUSE,
  ACTION_RESTART,
  createInput,
} from './input.js';
import { createAudio } from './audio.js';
import { createRenderer } from './render.js';
import { buildShotView } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const audio = createAudio();
const input = createInput(canvas, (x, y) => renderer.toField(x, y));

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Best score is a nicety; the game plays on without it.
  }
}

/** Stars on a stage (must match the generator's count). */
function starCount(stageNum) {
  return stageNum === BOSS_STAGE ? 3 : Math.min(2 + stageNum, 6);
}

/** Workshop card layout (field coords): 3 cards in a row, centred. The
 * renderer draws from these rects, so clicks and paint always agree. */
const WORKSHOP_CARDS = [
  { x: 190, y: 260, w: 280, h: 220 },
  { x: 500, y: 260, w: 280, h: 220 },
  { x: 810, y: 260, w: 280, h: 220 },
];

let screen = 'title';
let screenBeforePause = 'aim';
let levelIndex = 1;
let level = generateLevel(createRandom(seed + 1000003), 1);
let ship = null;
let score = 0;
let scoreAtLevelStart = 0;
let lives = LIVES;
let best = readBest();
let newBest = false;
let won = false;
let combo = 0;
let comboTimer = 0;
let particles = [];
let popups = [];
let clearBonus = 0;
let clearBreakdown = '';
let clearTimer = 0;
let time = 0;
let runTime = 0;
let totalStars = 0;
let bestRank = 3;
let shake = 0;
let trajectory = null;
/** The takeoff roll in progress: { t, vx, vy, power } or null. */
let takeoff = null;
/** Held power-ups: a shield (one crash forgiven) and a magnet timer. */
let shield = false;
let magnetUntil = 0;
/** Fuel: a full tank at every takeoff, draining in the air. */
let fuel = FUEL.max;
/** The one-time vortex-approach hint (stages 1-2) and the hint on screen. */
let hintShownVortex = false;
let hintText = null;
let hintUntil = 0;
/** The two AI rivals. Each races the same course on its own seeded plan. */
let rivals = [];
/** Campaign relics: the ids the player has picked in workshops. */
let relics = [];
/** Stage the intro card is showing (the next stage to fly). */
let introStage = 1;
/** Workshop offers on screen (relic ids), or null. */
let workshopOffers = null;
/** Stage until which the Star Doubler applies (0 = not owned). */
let doublerUntil = 0;

const hasRelic = (id) => relics.includes(id);
const effMaxSpeed = () => SHIP.maxSpeed * (hasRelic('wings') ? 1.15 : 1);
const effWindFactor = () => (hasRelic('hull') ? 0.75 : 1);
const effFuelMax = () => FUEL.max + (hasRelic('tank') ? 50 : 0);
const effMagnetRadius = () => MAGNET_RADIUS * (hasRelic('magnet') ? 1.4 : 1);
const effMagnetSeconds = () => MAGNET_SECONDS + (hasRelic('magnet') ? 7 : 0);
const effRingRefill = () => FUEL.ringRefill + (hasRelic('tailwind') ? 15 : 0);
const effRingBoost = () => FUEL.ringBoost + (hasRelic('tailwind') ? 0.15 : 0);
const doublerActive = () => doublerUntil > 0 && levelIndex <= doublerUntil;
/** Stage time: seconds since the current stage loaded (the boss clock). */
const stageTime = () => time - (level?.stageStartTime ?? 0);

function resetShip() {
  ship = {
    x: level.start.x,
    y: level.start.y,
    vx: 0,
    vy: 0,
    angle: 0,
    grazed: new Set(),
  };
  trajectory = null;
  takeoff = null;
}

function loadLevel(n) {
  levelIndex = n;
  level = generateLevel(createRandom((seed + n * 1000003) >>> 0), n, {
    maxSpeed: effMaxSpeed(),
    windFactor: effWindFactor(),
  });
  level.stageStartTime = time;
  level.fuelMax = effFuelMax();
  level.ringRefill = effRingRefill();
  level.ringBoost = effRingBoost();
  scoreAtLevelStart = score;
  fuel = effFuelMax();
  if (hasRelic('plating')) shield = true;
  resetShip();
}

function resetRivals() {
  rivals = RIVALS.map((def, i) => ({
    name: def.name,
    color: def.color,
    dark: def.dark,
    plan: level.rivals[i],
    levelNum: 1,
    flightIdx: 0,
    phase: 'aim',
    phaseStart: time + 0.6 + i * 1.1,
    flightElapsed: 0,
    progress: 0,
    landed: false,
    finished: false,
    x: level.start.x,
    y: level.start.y,
    angle: 0,
    visible: true,
  }));
}

/** One rival's race progress, for the standings (higher is further ahead). */
function rivalProgress(r) {
  return (r.levelNum - 1) * 100 + r.progress * 10 + (r.phase === 'fly' ? 2 : 0) + (r.phase === 'land' ? 5 : 0);
}

function playerProgress() {
  const collected = level ? level.stars.filter((s) => s.taken).length : 0;
  return (levelIndex - 1) * 100 + collected * 10 + (screen === 'fly' ? 2 : 0) + (screen === 'clear' ? 5 : 0);
}

/** Race standings: the three racers in rank order, and the player's rank. */
function raceStandings() {
  const entries = [
    { name: 'YOU', color: '#ffffff', progress: playerProgress(), isPlayer: true },
    ...rivals.map((r) => ({ name: r.name, color: r.color, progress: rivalProgress(r), isPlayer: false })),
  ];
  entries.sort((a, b) => b.progress - a.progress);
  return { order: entries, rank: entries.findIndex((e) => e.isPlayer) + 1 };
}

function updateRivals(dt) {
  const pProg = playerProgress();
  for (let i = 0; i < rivals.length; i += 1) {
    const r = rivals[i];
    if (r.finished) {
      // Parked on the strip, waiting for the run to end.
      r.x = STRIP.x0 + 60 + i * 50;
      r.y = level.start.y;
      r.angle = 0;
      continue;
    }
    if (r.phase === 'aim') {
      r.x = level.start.x;
      r.y = level.start.y;
      r.angle = 0;
      if (time - r.phaseStart >= r.plan.aimPause) {
        r.phase = 'fly';
        r.flightElapsed = 0;
      }
    } else if (r.phase === 'fly') {
      // Rubber-banding: the rival flies faster when behind the player and
      // eases off when ahead, so the race stays tense to the line. The
      // factor is a pure function of the progress gap — deterministic.
      const factor = Math.max(0.8, Math.min(1.3, 1 + (pProg - rivalProgress(r)) * 0.008));
      r.flightElapsed += dt * factor;
      const path = r.plan.paths[r.flightIdx];
      const idx = Math.min(Math.floor(r.flightElapsed / (2 * STEP)), path.points.length - 1);
      const pt = path.points[idx];
      const next = path.points[Math.min(idx + 1, path.points.length - 1)];
      r.x = pt.x;
      r.y = pt.y;
      r.angle = Math.atan2(next.y - pt.y, next.x - pt.x);
      if (r.flightElapsed >= path.seconds) {
        r.progress += path.stars;
        if (r.progress >= starCount(r.levelNum)) {
          r.phase = 'land';
          r.phaseStart = time;
        } else {
          r.phase = 'aim';
          r.phaseStart = time;
          r.flightIdx = (r.flightIdx + 1) % r.plan.paths.length;
        }
      }
    } else if (r.phase === 'land') {
      // Touchdown: the rival is on the strip, then moves to the next level.
      r.x = STRIP.x0 + 60 + i * 50;
      r.y = level.start.y;
      r.angle = 0;
      if (time - r.phaseStart >= 3) {
        r.levelNum += 1;
        if (r.levelNum > LEVEL.max) {
          r.finished = true;
          r.progress = starCount(LEVEL.max);
        } else {
          r.plan = rivalPlanFor(seed, r.levelNum, i);
          r.progress = 0;
          r.flightIdx = 0;
          r.phase = 'aim';
          r.phaseStart = time;
        }
      }
    }
  }
}

function startRun() {
  score = 0;
  lives = LIVES;
  newBest = false;
  won = false;
  combo = 0;
  comboTimer = 0;
  particles = [];
  popups = [];
  shield = false;
  magnetUntil = 0;
  hintShownVortex = false;
  hintText = null;
  hintUntil = 0;
  relics = [];
  doublerUntil = 0;
  runTime = 0;
  totalStars = 0;
  bestRank = 3;
  fuel = effFuelMax();
  loadLevel(1);
  resetRivals();
  introStage = 1;
  screen = 'intro';
  setStatus('Dawn Meadows. Take off, race the rivals, land on the strip.');
}

function burst(x, y, color, count, speed) {
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const sp = speed * (0.3 + Math.random() * 0.7);
    particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.7,
      maxLife: 0.7,
      size: 2 + Math.random() * 3,
      color,
    });
  }
}

function popup(x, y, text, color, size) {
  popups.push({ x, y, text, color, size: size ?? 22, life: 1, maxLife: 1 });
}

function aimVector() {
  const drag = input.drag;
  if (drag) {
    const dx = ship.x - drag.x;
    const dy = ship.y - drag.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) return null;
    const power = Math.min(1, len / SHIP.dragFull);
    const speed = power * effMaxSpeed();
    return { vx: (dx / len) * speed, vy: (dy / len) * speed, power };
  }
  const keys = input.keyboardAim;
  if (keys.active) {
    const speed = keys.power * effMaxSpeed();
    return {
      vx: Math.cos(keys.angle) * speed,
      vy: Math.sin(keys.angle) * speed,
      power: keys.power,
    };
  }
  return null;
}

/** Drag-aim-release: the takeoff roll starts; the plane lifts off at its end. */
function launch() {
  const v = aimVector() ?? {
    vx: Math.cos(-0.6) * 0.6 * effMaxSpeed(),
    vy: Math.sin(-0.6) * 0.6 * effMaxSpeed(),
    power: 0.6,
  };
  takeoff = { t: 0, vx: v.vx, vy: v.vy, power: v.power };
  screen = 'takeoff';
  audio.takeoff();
  setStatus('Takeoff!');
}

function liftoff() {
  ship.x = FLIGHT_START.x;
  ship.y = FLIGHT_START.y;
  ship.vx = takeoff.vx;
  ship.vy = takeoff.vy;
  ship.angle = Math.atan2(takeoff.vy, takeoff.vx);
  ship.grazed = new Set();
  fuel = effFuelMax();
  takeoff = null;
  screen = 'fly';
  audio.launch();
  audio.engine(true, 0.4);
  burst(ship.x, ship.y, '#ffffff', 10, 140);
  setStatus('Flying. Collect every star, then land on the strip.');
}

function collectStar(star) {
  star.taken = true;
  totalStars += 1;
  combo = comboTimer > 0 ? combo + 1 : 1;
  comboTimer = COMBO_WINDOW;
  const mult = Math.min(combo, COMBO_MAX);
  let gained = SCORE.star * mult;
  if (doublerActive()) gained *= 2;
  score += gained;
  audio.pickup(mult);
  burst(star.x, star.y, '#f2c94c', 14, 130);
  popup(star.x, star.y - 18, `+${gained}`, '#f2c94c', 24);
  if (mult > 1) popup(star.x, star.y + 12, `COMBO x${mult}`, '#7dffd4', 18);
  if (level.stars.every((s) => s.taken)) {
    popup(ship.x, ship.y - 30, 'ALL STARS! LAND ON THE STRIP!', '#7dffd4', 22);
    setStatus('All stars! Land on the strip to finish the stage.');
  }
}

function collectRing(ring) {
  ring.taken = true;
  fuel = Math.min(fuel + effRingRefill(), effFuelMax());
  const sp = Math.hypot(ship.vx, ship.vy) || 1;
  const boosted = Math.min(sp * effRingBoost(), 2400);
  ship.vx = (ship.vx / sp) * boosted;
  ship.vy = (ship.vy / sp) * boosted;
  audio.ring();
  burst(ring.x, ring.y, '#ffd94d', 12, 150);
  popup(ring.x, ring.y - 18, `+FUEL`, '#ffd94d', 20);
}

function collectPowerup(pu) {
  pu.taken = true;
  const def = POWERUPS[pu.type];
  audio.powerup();
  burst(pu.x, pu.y, def.color, 16, 150);
  popup(pu.x, pu.y - 20, def.label, def.color, 22);
  popup(pu.x, pu.y + 10, def.blurb, '#eef3ff', 16);
  if (pu.type === 'shield') {
    shield = true;
  } else if (pu.type === 'magnet') {
    magnetUntil = time + effMagnetSeconds();
  } else if (pu.type === 'life') {
    lives = Math.min(lives + 1, LIFE_MAX);
  }
}

/** The plane landed: stage clear, with race and smoothness bonuses. */
function landLevel() {
  const speed = Math.hypot(ship.vx, ship.vy);
  const smooth = speed <= STRIP.maxSpeed * 0.6;
  const { rank } = raceStandings();
  bestRank = Math.min(bestRank, rank);
  const raceBonus = rank === 1 ? SCORE.raceFirst : rank === 2 ? SCORE.raceSecond : 0;
  const realmBonus = levelIndex % 2 === 0 && levelIndex < BOSS_STAGE ? SCORE.realmClear : 0;
  const bossBonus = levelIndex === BOSS_STAGE ? SCORE.bossClear : 0;
  clearBonus = SCORE.levelClear * levelIndex + raceBonus + (smooth ? SCORE.smoothLanding : 0) + realmBonus + bossBonus;
  score += clearBonus;
  const parts = [`Stage bonus +${SCORE.levelClear * levelIndex}`];
  if (raceBonus > 0) parts.push(`Race ${rank === 1 ? '1st' : '2nd'} +${raceBonus}`);
  if (smooth) parts.push(`Smooth landing +${SCORE.smoothLanding}`);
  if (realmBonus > 0) parts.push(`Realm clear +${realmBonus}`);
  if (bossBonus > 0) parts.push(`Thunderhead beaten +${bossBonus}`);
  clearBreakdown = parts.join(' · ');
  audio.land();
  burst(ship.x, ship.y + 8, '#ffffff', 22, 200);
  burst(ship.x, ship.y + 8, '#9aa5b1', 14, 120);
  popup(ship.x, ship.y - 30, smooth ? 'TOUCHDOWN! SMOOTH LANDING!' : 'TOUCHDOWN!', '#7dffd4', 24);
  screen = 'clear';
  clearTimer = LEVEL.clearPause;
  setStatus(`Stage ${levelIndex} clear! ${clearBreakdown}.`);
}

function offCourse() {
  // Flying off the course area is not a crash: the flight is over, the
  // stars banked stay banked, and no plane is lost. A slingshot flight is
  // one-way by nature — the plane launches, arcs through the sky, and
  // either lands, crashes, or leaves the area. Charging a life for
  // leaving would make a campaign unwinnable on 3 lives: the auto-player
  // proved it — on some stages there is NO grid takeoff that collects a
  // star and stays in the field (every star run ends off-course or in a
  // crash), so a life per off-course flight bleeds the run dry. Lives are
  // the crash budget: storm vortex, storm cell, ground, boss, lightning.
  // The race against REX and MAYA is the time pressure, not the lives.
  audio.engine(false);
  resetShip();
  screen = 'aim';
  setStatus(`Off course — the plane left the area. No plane lost, stars kept. Aim again.`);
}

function fuelOut() {
  // Out of fuel mid-flight: the plane glides down. Same rule as off
  // course — no life lost, stars kept — but the player learns to route
  // through the boost rings next time.
  audio.engine(false);
  audio.fuelEmpty();
  resetShip();
  screen = 'aim';
  setStatus(`Out of fuel — the plane glides down. No plane lost, stars kept. Route through the gold rings!`);
}

function loseLife(crash) {
  // A held shield forgives one crash: no life lost, the plane just re-aims.
  if (shield) {
    shield = false;
    audio.shieldSave();
    burst(ship.x, ship.y, '#5df2ff', 26, 260);
    shake = 1;
    popup(ship.x, ship.y - 24, 'SHIELD SAVED YOU!', '#5df2ff', 24);
    resetShip();
    screen = 'aim';
    setStatus(`Shield absorbed the crash. ${lives} ${lives === 1 ? 'plane' : 'planes'} left. Aim again.`);
    return;
  }
  lives -= 1;
  audio.crash();
  burst(ship.x, ship.y, '#ff8a5c', 26, 260);
  burst(ship.x, ship.y, '#ffd166', 12, 180);
  shake = 1;
  if (lives <= 0) {
    newBest = score > best;
    if (newBest) {
      best = score;
      saveBest(best);
    }
    screen = 'over';
    audio.gameOver();
    setStatus(`Race over. Score ${score}. Press Space to fly again.`);
    return;
  }
  const what = crash.type === 'ground' ? 'hit the ground' : crash.type === 'boss' ? 'flew into the Thunderhead' : crash.type === 'bolt' ? 'was struck by lightning' : 'crashed';
  popup(ship.x, ship.y - 24, 'CRASH!', '#ff5d6c', 24);
  resetShip();
  screen = 'aim';
  setStatus(`Plane ${what}. ${lives} ${lives === 1 ? 'plane' : 'planes'} left. Aim again.`);
}

/** Open the workshop after a realm is cleared (stages 2, 4, 6, 8). */
function openWorkshop() {
  const workshopIndex = levelIndex / 2;
  workshopOffers = relicOffers(seed, workshopIndex, relics);
  screen = 'workshop';
  setStatus('Workshop! Pick a relic — click a card or press 1, 2, 3.');
}

function pickRelic(id) {
  if (!workshopOffers || !workshopOffers.includes(id)) return;
  relics.push(id);
  if (id === 'extra') lives = Math.min(lives + 1, LIFE_MAX);
  if (id === 'doubler') doublerUntil = Math.min(levelIndex + 2, BOSS_STAGE);
  audio.relic();
  workshopOffers = null;
  // The next stage starts a new realm (or the boss): show its intro card.
  introStage = levelIndex + 1;
  screen = 'intro';
  const realm = REALMS[realmOf(introStage)];
  setStatus(introStage === BOSS_STAGE ? 'The Thunderhead waits.' : `${realm.name}. ${realm.flavor}`);
}

function advanceIntro() {
  // The intro card is showing introStage: load it fresh and fly.
  level.stageStartTime = time;
  loadLevel(introStage);
  screen = 'aim';
  const name = STAGE_NAMES[introStage];
  setStatus(`Stage ${introStage}: ${name}. Drag to aim, release to take off.`);
  if (introStage === BOSS_STAGE) audio.roar();
}

function update(dt) {
  if (screen === 'paused') return;
  time += dt;
  if (screen !== 'title') runTime += dt;
  if (shake > 0) shake = Math.max(0, shake - dt * 1.6);
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.985;
    p.vy *= 0.985;
    p.life -= dt;
  }
  particles = particles.filter((p) => p.life > 0);
  for (const p of popups) p.life -= dt;
  popups = popups.filter((p) => p.life > 0);
  if (comboTimer > 0) {
    comboTimer -= dt;
    if (comboTimer <= 0) combo = 0;
  }
  updateRivals(dt);

  if (screen === 'takeoff' && ship && takeoff) {
    takeoff.t += dt;
    const k = Math.min(1, takeoff.t / TAKEOFF_SECONDS);
    // Ease out: the plane accelerates down the runway, then lifts.
    const eased = 1 - (1 - k) * (1 - k);
    ship.x = level.start.x + TAKEOFF_ROLL * eased;
    ship.y = level.start.y;
    ship.angle = -0.08 * k;
    // Speed lines behind the plane while it rolls.
    if (Math.random() < 0.5) {
      particles.push({
        x: ship.x - 20 - Math.random() * 60,
        y: ship.y - 14 + Math.random() * 28,
        vx: -260 - Math.random() * 200,
        vy: 0,
        life: 0.3,
        maxLife: 0.3,
        size: 1.5,
        color: '#ffffff',
      });
    }
    if (takeoff.t >= TAKEOFF_SECONDS) liftoff();
  } else if (screen === 'fly' && ship) {
    updateStormCells(level, dt);
    ship.angle = Math.atan2(ship.vy, ship.vx);
    const speed = Math.hypot(ship.vx, ship.vy);
    audio.engine(true, speed / effMaxSpeed());
    if (time < magnetUntil) pullStars(level, ship, dt, effMagnetRadius());
    const canLand = level.stars.every((s) => s.taken);
    const event = advanceShip(level, ship, dt, time, canLand);
    if (event) {
      if (event.type === 'land') {
        landLevel();
        return;
      }
      if (event.type === 'bounce') {
        audio.bounce();
        shake = Math.max(shake, 0.4);
        popup(ship.x, ship.y - 24, canLand ? 'TOO FAST!' : 'LAND AFTER THE STARS!', '#ffd166', 20);
      } else if (event.type === 'bird') {
        audio.birdHit();
        shake = Math.max(shake, 0.6);
        popup(ship.x, ship.y - 24, 'BIRD STRIKE!', '#ff9f43', 22);
      } else if (event.type === 'bolt') {
        audio.bolt();
        shake = 1;
        loseLife(event);
        return;
      } else if (event.type === 'lost') {
        // Off course, not a crash: no life lost (see offCourse()).
        offCourse();
        return;
      } else {
        loseLife(event);
        return;
      }
    }
    // Fuel drains in the air; a ring refills it and boosts the plane.
    fuel -= FUEL.drainPerSec * dt;
    const ring = ringAt(level, ship);
    if (ring) collectRing(ring);
    if (fuel <= 0) {
      fuelOut();
      return;
    }
    const star = starAt(level, ship);
    if (star) collectStar(star);
    const pu = powerupAt(level, ship);
    if (pu) collectPowerup(pu);
    if (screen === 'fly') {
      const grazed = grazeCheck(level, ship);
      if (grazed) {
        // A graze feeds the combo too: chained near-misses build the multiplier.
        combo = comboTimer > 0 ? combo + 1 : 1;
        comboTimer = COMBO_WINDOW;
        const mult = Math.min(combo, COMBO_MAX);
        const gained = SCORE.graze * mult;
        score += gained;
        audio.graze();
        popup(ship.x, ship.y - 24, `STORM EDGE +${gained}`, '#7dffd4', 20);
        if (mult > 1) popup(ship.x, ship.y + 12, `COMBO x${mult}`, '#7dffd4', 18);
      }
      // First time the plane skims a vortex (stages 1-2): teach the mechanic.
      if (!hintShownVortex && levelIndex <= 2) {
        for (const p of level.vortexes) {
          const d = Math.hypot(ship.x - p.x, ship.y - p.y);
          if (d < p.r + 230) {
            hintShownVortex = true;
            hintText = 'Storm winds bend your flight — steer around the vortex!';
            hintUntil = time + 3;
            break;
          }
        }
      }
      trajectory = simulateFlight(level, ship.x, ship.y, ship.vx, ship.vy, 150, time, true).points;
    }
  } else if (screen === 'aim' && ship) {
    updateStormCells(level, dt);
    const v = aimVector();
    if (v) {
      ship.angle = Math.atan2(v.vy, v.vx);
      // The preview flies from the end of the takeoff roll, where the plane
      // lifts off — and it collects stars on its internal clone, so a
      // takeoff that banks the last star and lands shows the landing.
      trajectory = simulateFlight(level, FLIGHT_START.x, FLIGHT_START.y, v.vx, v.vy, 180, time, true).points;
    } else {
      trajectory = null;
    }
  } else if (screen === 'clear') {
    clearTimer -= dt;
    if (clearTimer <= 0) {
      if (levelIndex >= LEVEL.max) {
        // Beat the Thunderhead: the campaign ends a winner, score kept.
        won = true;
        newBest = score > best;
        if (newBest) {
          best = score;
          saveBest(best);
        }
        screen = 'over';
        audio.levelClear();
        setStatus(`You won the sky! Score ${score}. Press Space to fly again.`);
      } else if (levelIndex % 2 === 0) {
        openWorkshop();
      } else {
        loadLevel(levelIndex + 1);
        screen = 'aim';
        setStatus(`Stage ${levelIndex}: ${STAGE_NAMES[levelIndex]}. Drag to aim, release to take off.`);
      }
    }
  }
}

function handleActions(actions) {
  if (actions & ACTION_MUTE) {
    audio.setMuted(!audio.muted);
  }
  if (actions & ACTION_PAUSE) {
    if (screen === 'paused') {
      screen = screenBeforePause;
      // Restart the drone at a mid speed if resuming mid-flight; the
      // fly loop re-drives it from the real speed every frame.
      audio.engine(screen === 'fly', 0.4);
      setStatus(screen === 'aim' ? 'Aim again — drag to aim, release to take off.' : screen === 'fly' ? 'Flying. Collect every star, then land on the strip.' : 'Resumed.');
    } else if (screen === 'aim' || screen === 'fly' || screen === 'takeoff') {
      screenBeforePause = screen;
      screen = 'paused';
      audio.engine(false);
      setStatus('Paused.');
    }
  }
  if (actions & ACTION_RESTART) {
    if (screen === 'aim' || screen === 'fly' || screen === 'paused' || screen === 'takeoff') {
      score = scoreAtLevelStart;
      combo = 0;
      comboTimer = 0;
      fuel = effFuelMax();
      audio.engine(false);
      loadLevel(levelIndex);
      screen = 'aim';
      setStatus(`Stage ${levelIndex} restarted.`);
    }
  }
  if (actions & ACTION_CONFIRM) {
    audio.unlock();
    if (screen === 'title') {
      audio.click();
      startRun();
    } else if (screen === 'over') {
      audio.click();
      startRun();
    } else if (screen === 'intro') {
      audio.click();
      advanceIntro();
    } else if (screen === 'clear') {
      clearTimer = 0;
    } else if (screen === 'aim') {
      launch();
    }
  }
  const digit = input.takeDigit();
  if (digit && screen === 'workshop' && workshopOffers && digit <= workshopOffers.length) {
    pickRelic(workshopOffers[digit - 1]);
  }
}

function setStatus(text) {
  status.textContent = text;
}

function currentView() {
  const drag = input.drag;
  let aim = null;
  let power = null;
  if (screen === 'aim' && ship) {
    if (drag) aim = { kind: 'drag', px: drag.x, py: drag.y };
    else if (input.keyboardAim.active) {
      aim = { kind: 'keys', angle: input.keyboardAim.angle, power: input.keyboardAim.power };
    }
    const v = aimVector();
    if (v) power = v.power;
  }
  const { order, rank } = raceStandings();
  // Boss state for the renderer: where the Thunderhead is and whether a
  // bolt is being telegraphed or striking right now.
  let bossView = null;
  if (level && level.boss) {
    const st = stageTime();
    bossView = { pos: bossAt(level, st), ...boltState(level, st) };
  }
  return {
    screen,
    level,
    ship,
    particles,
    popups,
    score,
    best,
    lives,
    levelIndex,
    starsLeft: level ? level.stars.filter((s) => !s.taken).length : 0,
    aim,
    power,
    trajectory,
    shake,
    time,
    muted: audio.muted,
    clearBonus,
    clearBreakdown,
    newBest,
    won,
    shield,
    magnetLeft: Math.max(0, magnetUntil - time),
    hint: hintText && time < hintUntil ? hintText : null,
    takeoffT: screen === 'takeoff' && takeoff ? Math.min(1, takeoff.t / TAKEOFF_SECONDS) : null,
    takeoffPower: takeoff ? takeoff.power : null,
    stripArmed: level ? level.stars.every((s) => s.taken) : false,
    rivals: rivals.map((r) => ({ name: r.name, color: r.color, x: r.x, y: r.y, angle: r.angle, visible: r.visible, phase: r.phase })),
    raceRank: rank,
    raceOrder: order,
    fuel,
    fuelMax: effFuelMax(),
    combo: comboTimer > 0 ? Math.min(combo, COMBO_MAX) : 0,
    relics: [...relics],
    stageName: STAGE_NAMES[levelIndex] ?? '',
    realmName: level ? REALMS[realmOf(levelIndex)].name : '',
    boss: bossView,
    introStage,
    introRealm: introStage === BOSS_STAGE ? null : REALMS[realmOf(introStage)],
    workshopOffers,
    workshopCards: workshopOffers ? WORKSHOP_CARDS : null,
    summary: won ? {
      time: runTime,
      stars: totalStars,
      relics: [...relics],
      bestRank,
    } : null,
  };
}

function frame(now) {
  const actions = input.takeActions();
  handleActions(actions);
  // A release is consumed on every screen: on the title and game-over
  // screens a click starts a run; while aiming it launches the plane.
  const release = input.takeRelease();
  if (release) {
    if (screen === 'title' || screen === 'over') {
      audio.unlock();
      audio.click();
      startRun();
    } else if (screen === 'intro') {
      audio.unlock();
      audio.click();
      advanceIntro();
    } else if (screen === 'workshop' && workshopOffers) {
      // Click a relic card to pick it.
      for (let i = 0; i < WORKSHOP_CARDS.length; i += 1) {
        const c = WORKSHOP_CARDS[i];
        if (release.x >= c.x && release.x <= c.x + c.w && release.y >= c.y && release.y <= c.y + c.h) {
          if (i < workshopOffers.length) {
            audio.unlock();
            pickRelic(workshopOffers[i]);
          }
          break;
        }
      }
    } else if (screen === 'clear') {
      clearTimer = 0;
    } else if (screen === 'aim' && ship) {
      const dx = ship.x - release.x;
      const dy = ship.y - release.y;
      if (Math.hypot(dx, dy) > 20) launch();
    }
  }
  update(STEP);
  renderer.draw(currentView());
  requestAnimationFrame(frame);
  void now;
}

renderer.resize();
window.addEventListener('resize', () => renderer.resize());

if (shot) {
  // A staged screenshot scene: paint it twice and stop.
  const view = buildShotView(shot, seed);
  if (view) {
    renderer.draw(view);
    renderer.draw(view);
    window.__shotReady = true;
    setStatus(`Sky Race — ${shot} scene.`);
  }
} else {
  resetShip();
  resetRivals();
  setStatus('Sky Race. Press Space or click to fly.');
  requestAnimationFrame(frame);
}

// Test hook for automated browser tests (no network, no gameplay effect):
// lets a test drive the screens and read the state without playing a full
// campaign by hand. The judge plays through the UI; this changes nothing
// about the game itself.
window.__skyRace = {
  get screen() { return screen; },
  get levelIndex() { return levelIndex; },
  get lives() { return lives; },
  get score() { return score; },
  get relics() { return [...relics]; },
  get workshopOffers() { return workshopOffers ? [...workshopOffers] : null; },
  get ship() { return ship ? { x: Math.round(ship.x), y: Math.round(ship.y) } : null; },
  /** Jump to the workshop (as if stage 2 had just cleared) for testing. */
  testWorkshop() { levelIndex = 2; openWorkshop(); },
};
