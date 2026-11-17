// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between six screens:
// title, aim, fly, paused, clear (level complete) and over (game over).
//
// ?seed=N fixes the universe. ?shot=start|play|action|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import {
  BEST_KEY,
  COMBO_MAX,
  COMBO_WINDOW,
  LEVEL,
  LIVES,
  SCORE,
  SHIP,
  STEP,
} from './config.js';
import { createRandom } from './random.js';
import { generateLevel } from './levels.js';
import {
  advanceShip,
  grazeCheck,
  simulateFlight,
  starAt,
  updateAsteroids,
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
let combo = 0;
let comboTimer = 0;
let particles = [];
let popups = [];
let clearBonus = 0;
let clearTimer = 0;
let time = 0;
let shake = 0;
let trajectory = null;

function resetShip() {
  ship = {
    x: level.start.x,
    y: level.start.y,
    vx: 0,
    vy: 0,
    angle: -0.6,
    grazed: new Set(),
  };
  trajectory = null;
}

function loadLevel(n) {
  levelIndex = n;
  level = generateLevel(createRandom((seed + n * 1000003) >>> 0), n);
  scoreAtLevelStart = score;
  resetShip();
}

function startRun() {
  score = 0;
  lives = LIVES;
  newBest = false;
  combo = 0;
  comboTimer = 0;
  particles = [];
  popups = [];
  loadLevel(1);
  screen = 'aim';
  setStatus('Level 1. Drag to aim, release to launch.');
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
    const speed = power * SHIP.maxSpeed;
    return { vx: (dx / len) * speed, vy: (dy / len) * speed, power };
  }
  const keys = input.keyboardAim;
  if (keys.active) {
    const speed = keys.power * SHIP.maxSpeed;
    return {
      vx: Math.cos(keys.angle) * speed,
      vy: Math.sin(keys.angle) * speed,
      power: keys.power,
    };
  }
  return null;
}

function launch() {
  const v = aimVector() ?? {
    vx: Math.cos(-0.6) * 0.6 * SHIP.maxSpeed,
    vy: Math.sin(-0.6) * 0.6 * SHIP.maxSpeed,
    power: 0.6,
  };
  ship.vx = v.vx;
  ship.vy = v.vy;
  ship.angle = Math.atan2(v.vy, v.vx);
  ship.grazed = new Set();
  screen = 'fly';
  audio.launch();
  burst(ship.x, ship.y, '#5df2ff', 12, 160);
  setStatus('Flying. Collect every star, mind the planets.');
}

function collectStar(star) {
  star.taken = true;
  combo = comboTimer > 0 ? combo + 1 : 1;
  comboTimer = COMBO_WINDOW;
  const mult = Math.min(combo, COMBO_MAX);
  const gained = SCORE.star * mult;
  score += gained;
  audio.pickup(mult);
  burst(star.x, star.y, '#f2c94c', 14, 130);
  popup(star.x, star.y - 18, `+${gained}`, '#f2c94c', 24);
  if (mult > 1) popup(star.x, star.y + 12, `COMBO x${mult}`, '#7dffd4', 18);
  if (level.stars.every((s) => s.taken)) {
    clearBonus = SCORE.levelClear * levelIndex;
    score += clearBonus;
    audio.levelClear();
    screen = 'clear';
    clearTimer = LEVEL.clearPause;
    setStatus(`Level ${levelIndex} clear! Bonus ${clearBonus}.`);
  }
}

function loseLife(crash) {
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
    setStatus(`Mission over. Score ${score}. Press Space to fly again.`);
    return;
  }
  const what = crash.type === 'lost' ? 'lost in space' : 'crashed';
  popup(ship.x, ship.y - 24, what === 'lost in space' ? 'LOST IN SPACE' : 'CRASH!', '#ff5d6c', 24);
  resetShip();
  screen = 'aim';
  setStatus(`Ship lost. ${lives} ${lives === 1 ? 'ship' : 'ships'} left. Aim again.`);
}

function update(dt) {
  time += dt;
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

  if (screen === 'fly' && ship) {
    updateAsteroids(level, dt);
    ship.angle = Math.atan2(ship.vy, ship.vx);
    const crash = advanceShip(level, ship, dt);
    if (crash) {
      loseLife(crash);
      return;
    }
    const star = starAt(level, ship);
    if (star) collectStar(star);
    if (screen === 'fly') {
      const grazed = grazeCheck(level, ship);
      if (grazed) {
        score += SCORE.graze;
        audio.graze();
        popup(ship.x, ship.y - 24, `GRAZE +${SCORE.graze}`, '#7dffd4', 20);
      }
      trajectory = simulateFlight(level, ship.x, ship.y, ship.vx, ship.vy, 150);
    }
  } else if (screen === 'aim' && ship) {
    updateAsteroids(level, dt);
    const v = aimVector();
    if (v) {
      ship.angle = Math.atan2(v.vy, v.vx);
      trajectory = simulateFlight(level, ship.x, ship.y, v.vx, v.vy, 180);
    } else {
      trajectory = null;
    }
  } else if (screen === 'clear') {
    clearTimer -= dt;
    if (clearTimer <= 0) {
      if (levelIndex >= LEVEL.max) {
        // Beat the last level: the run ends a winner, score kept.
        newBest = score > best;
        if (newBest) {
          best = score;
          saveBest(best);
        }
        screen = 'over';
        setStatus(`You cleared every level! Score ${score}. Press Space to fly again.`);
      } else {
        loadLevel(levelIndex + 1);
        screen = 'aim';
        setStatus(`Level ${levelIndex}. Drag to aim, release to launch.`);
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
    } else if (screen === 'aim' || screen === 'fly') {
      screenBeforePause = screen;
      screen = 'paused';
      setStatus('Paused.');
    }
  }
  if (actions & ACTION_RESTART) {
    if (screen === 'aim' || screen === 'fly' || screen === 'paused') {
      score = scoreAtLevelStart;
      combo = 0;
      comboTimer = 0;
      loadLevel(levelIndex);
      screen = 'aim';
      setStatus(`Level ${levelIndex} restarted.`);
    }
  }
  if (actions & ACTION_CONFIRM) {
    audio.unlock();
    if (screen === 'title' || screen === 'over') {
      audio.click();
      startRun();
    } else if (screen === 'clear') {
      clearTimer = 0;
    } else if (screen === 'aim') {
      launch();
    }
  }
}

function setStatus(text) {
  status.textContent = text;
}

function currentView() {
  const drag = input.drag;
  let aim = null;
  if (screen === 'aim' && ship) {
    if (drag) aim = { kind: 'drag', px: drag.x, py: drag.y };
    else if (input.keyboardAim.active) {
      aim = { kind: 'keys', angle: input.keyboardAim.angle, power: input.keyboardAim.power };
    }
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
    trajectory,
    shake,
    time,
    muted: audio.muted,
    clearBonus,
    newBest,
  };
}

function frame(now) {
  const actions = input.takeActions();
  handleActions(actions);
  // A release is consumed on every screen: on the title and game-over
  // screens a click starts a run; while aiming it launches the ship.
  const release = input.takeRelease();
  if (release) {
    if (screen === 'title' || screen === 'over') {
      audio.unlock();
      audio.click();
      startRun();
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
    setStatus(`Orbit Sling — ${shot} scene.`);
  }
} else {
  resetShip();
  setStatus('Orbit Sling. Press Space or click to fly.');
  requestAnimationFrame(frame);
}
