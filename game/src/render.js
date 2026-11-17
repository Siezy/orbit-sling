// All canvas drawing: neon space, planets, the ship, the trajectory preview,
// particles, the HUD and the screens. The playfield is a fixed 1280x720
// logical area; the view scales it to the window with letterboxing, so the
// game looks the same on every screen and in every screenshot.

import { FIELD, FONT, PALETTE, POWERUPS } from './config.js';
import { createRandom } from './random.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let scale = 1;
  let offX = 0;
  let offY = 0;
  let dpr = 1;

  // The far starfield and nebulae never move: one fixed sky for every level.
  const sky = createRandom(1337);
  const skyStars = Array.from({ length: 170 }, () => ({
    x: sky.range(0, FIELD.width),
    y: sky.range(0, FIELD.height),
    r: sky.range(0.6, 2.1),
    tw: sky.range(0, Math.PI * 2),
    layer: sky.next() < 0.5 ? 0.02 : 0.05,
  }));
  const nebulae = [
    { x: 980, y: 130, r: 260, color: PALETTE.nebulaA },
    { x: 260, y: 580, r: 300, color: PALETTE.nebulaB },
    { x: 620, y: 90, r: 200, color: '#1d2a5e' },
  ];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth || FIELD.width;
    const h = canvas.clientHeight || FIELD.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    scale = Math.min(w / FIELD.width, h / FIELD.height);
    offX = (w - FIELD.width * scale) / 2;
    offY = (h - FIELD.height * scale) / 2;
  }

  function toField(cx, cy) {
    return { x: (cx - offX) / scale, y: (cy - offY) / scale };
  }

  function drawBackground(ship, time) {
    const bg = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    bg.addColorStop(0, PALETTE.backdropTop);
    bg.addColorStop(1, PALETTE.backdropBottom);
    ctx.fillStyle = bg;
    ctx.fillRect(-40, -40, FIELD.width + 80, FIELD.height + 80);
    const px = ship ? ship.x * 0.02 : 0;
    const py = ship ? ship.y * 0.02 : 0;
    for (const n of nebulae) {
      const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
      g.addColorStop(0, n.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = g;
      ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
    }
    ctx.globalAlpha = 1;
    for (const s of skyStars) {
      const a = 0.35 + 0.45 * Math.abs(Math.sin(time * 0.7 + s.tw));
      ctx.globalAlpha = a;
      ctx.fillStyle = '#cfe0ff';
      ctx.beginPath();
      ctx.arc(s.x - px * s.layer * 20, s.y - py * s.layer * 20, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawPlanet(p, time) {
    // Gravity well, faint so the player can read the danger zone.
    ctx.strokeStyle = 'rgba(160, 190, 255, 0.10)';
    ctx.setLineDash([4, 9]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * 2.1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // Atmosphere glow.
    ctx.save();
    ctx.shadowColor = p.style.glow;
    ctx.shadowBlur = 34;
    const g = ctx.createRadialGradient(
      p.x - p.r * 0.35, p.y - p.r * 0.4, p.r * 0.1,
      p.x, p.y, p.r,
    );
    g.addColorStop(0, p.style.base);
    g.addColorStop(1, p.style.dark);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Craters.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    for (const c of p.craters) {
      ctx.beginPath();
      ctx.arc(p.x + c.dx, p.y + c.dy, c.r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Ring, if this planet wears one.
    if (p.style.ring) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(-0.35);
      ctx.strokeStyle = 'rgba(220, 225, 255, 0.45)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.r * 1.7, p.r * 0.42, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    void time;
  }

  function drawStarPickup(s, time) {
    const pulse = 1 + 0.18 * Math.sin(time * 3 + s.phase);
    const r = 13 * pulse;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(Math.sin(time * 1.2 + s.phase) * 0.25);
    ctx.shadowColor = PALETTE.star;
    ctx.shadowBlur = 18;
    ctx.fillStyle = PALETTE.star;
    ctx.beginPath();
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      const rr = i % 2 === 0 ? r : r * 0.42;
      const x = Math.cos(a) * rr;
      const y = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // A power-up orb: a glowing ring in the type's colour with its letter
  // inside, so the player reads what it does at a glance.
  function drawPowerup(p, time) {
    const def = POWERUPS[p.type];
    const pulse = 1 + 0.12 * Math.sin(time * 2.4 + p.phase);
    const r = 15 * pulse;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.shadowColor = def.color;
    ctx.shadowBlur = 20;
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(4, 8, 26, 0.55)';
    ctx.beginPath();
    ctx.arc(0, 0, r - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = def.color;
    ctx.font = `900 ${p.type === 'life' ? 20 : 17}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.letter, 0, 1);
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  function drawAsteroid(a) {
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.rot);
    ctx.fillStyle = '#6e6258';
    ctx.strokeStyle = '#a08b74';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < a.verts.length; i += 1) {
      const v = a.verts[i];
      const x = Math.cos(v.a) * a.r * v.k;
      const y = Math.sin(v.a) * a.r * v.k;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawShip(ship, view) {
    ctx.save();
    ctx.translate(ship.x, ship.y);
    // A held shield shows as a bright ring around the ship.
    if (view.shield) {
      ctx.strokeStyle = '#5df2ff';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#5df2ff';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.rotate(ship.angle);
    ctx.shadowColor = PALETTE.shipGlow;
    ctx.shadowBlur = 16;
    const g = ctx.createLinearGradient(-12, 0, 14, 0);
    g.addColorStop(0, '#1b6f8f');
    g.addColorStop(0.6, PALETTE.ship);
    g.addColorStop(1, '#eafcff');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-10, -8);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-10, 8);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(4, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawTrajectory(points) {
    if (!points || points.length < 2) return;
    for (let i = 0; i < points.length; i += 3) {
      const p = points[i];
      const fade = 1 - i / points.length;
      ctx.globalAlpha = 0.25 + 0.55 * fade;
      ctx.fillStyle = '#8ef6ff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, i === 0 ? 2 : 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // The flight's end, when it ends badly: a red mark so the player sees
    // the danger before launching, not after.
    const last = points[points.length - 1];
    if (last.hit === 'planet' || last.hit === 'asteroid') {
      ctx.globalAlpha = 0.95;
      ctx.strokeStyle = '#ff5d6c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(last.x - 8, last.y - 8);
      ctx.lineTo(last.x + 8, last.y + 8);
      ctx.moveTo(last.x + 8, last.y - 8);
      ctx.lineTo(last.x - 8, last.y + 8);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawAim(view) {
    const { ship, aim } = view;
    if (!aim) return;
    // Slingshot band: from the pad to the pull point.
    const px = aim.kind === 'drag' ? aim.px : ship.x - Math.cos(aim.angle) * aim.power * 260;
    const py = aim.kind === 'drag' ? aim.py : ship.y - Math.sin(aim.angle) * aim.power * 260;
    ctx.strokeStyle = 'rgba(125, 255, 212, 0.75)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ship.x, ship.y);
    ctx.lineTo(px, py);
    ctx.stroke();
    // Power ring around the ship.
    const power = aim.kind === 'drag'
      ? Math.min(1, Math.hypot(ship.x - px, ship.y - py) / 260)
      : aim.power;
    ctx.strokeStyle = 'rgba(125, 255, 212, 0.9)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(ship.x, ship.y, 26, -Math.PI / 2, -Math.PI / 2 + power * Math.PI * 2);
    ctx.stroke();
  }

  function drawParticles(particles) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of particles) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a + 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawPopups(popups) {
    ctx.textAlign = 'center';
    for (const p of popups) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.font = `700 ${p.size}px ${FONT}`;
      ctx.fillStyle = p.color;
      // Never run off the top of the frame: a popup near the top edge drops
      // below its point instead.
      const y = Math.max(30, p.y - (1 - a) * 30);
      ctx.fillText(p.text, p.x, y);
    }
    ctx.globalAlpha = 1;
  }

  function drawHud(view) {
    const { score, best, lives, levelIndex, starsLeft } = view;
    ctx.textAlign = 'left';
    ctx.font = `800 30px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`SCORE ${score}`, 24, 44);
    ctx.font = `600 16px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`BEST ${Math.max(best, score)}`, 24, 68);
    // Held power-ups, as pills under the score so the player always sees them.
    let badgeY = 96;
    if (view.shield) {
      drawBadge('SHIELD', '#5df2ff', 24, badgeY);
      badgeY += 30;
    }
    if (view.magnetLeft > 0) {
      drawBadge(`MAGNET ${Math.ceil(view.magnetLeft)}s`, '#ff7fb0', 24, badgeY);
      badgeY += 30;
    }
    ctx.textAlign = 'center';
    ctx.font = `800 22px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`LEVEL ${levelIndex}`, FIELD.width / 2, 42);
    // Stars left, as little icons.
    for (let i = 0; i < starsLeft; i += 1) {
      const x = FIELD.width / 2 - ((starsLeft - 1) * 16) + i * 32;
      ctx.fillStyle = PALETTE.star;
      ctx.beginPath();
      ctx.arc(x, 62, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.textAlign = 'right';
    ctx.font = `600 16px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    // Kept well inside the frame: the text used to sit close enough to the
    // right edge that it read as clipped in screenshots.
    ctx.fillText(view.muted ? 'MUTED (M)' : 'SOUND ON (M)', FIELD.width - 56, 42);
    // Lives, as little ships.
    for (let i = 0; i < lives; i += 1) {
      const x = FIELD.width - 66 - i * 30;
      ctx.save();
      ctx.translate(x, 64);
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = PALETTE.ship;
      ctx.beginPath();
      ctx.moveTo(9, 0);
      ctx.lineTo(-6, -5);
      ctx.lineTo(-3, 0);
      ctx.lineTo(-6, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.textAlign = 'left';
  }

  function drawBadge(text, color, x, y) {
    ctx.font = `800 14px ${FONT}`;
    const w = ctx.measureText(text).width + 20;
    ctx.fillStyle = 'rgba(10, 16, 40, 0.72)';
    roundRect(ctx, x, y - 15, w, 22, 11);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y - 15, w, 22, 11);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.fillText(text, x + 10, y + 1);
  }

  function drawHint(text, strong) {
    ctx.textAlign = 'center';
    ctx.font = `${strong ? 800 : 600} ${strong ? 20 : 17}px ${FONT}`;
    ctx.fillStyle = strong ? '#7dffd4' : 'rgba(238, 243, 255, 0.75)';
    ctx.fillText(text, FIELD.width / 2, FIELD.height - 26);
    ctx.textAlign = 'left';
  }

  function drawPanel(x, y, w, h) {
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, x, y, w, h, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(140, 170, 255, 0.25)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, w, h, 18);
    ctx.stroke();
  }

  function drawTitle(view) {
    ctx.textAlign = 'center';
    const cx = FIELD.width / 2;
    drawPanel(cx - 330, 150, 660, 340);
    const grad = ctx.createLinearGradient(cx - 300, 0, cx + 300, 0);
    grad.addColorStop(0, '#5df2ff');
    grad.addColorStop(0.5, '#b78cff');
    grad.addColorStop(1, '#ffd166');
    ctx.fillStyle = grad;
    ctx.font = `900 84px ${FONT}`;
    ctx.shadowColor = '#5df2ff';
    ctx.shadowBlur = 28;
    ctx.fillText('ORBIT SLING', cx, 250);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.text;
    ctx.font = `600 22px ${FONT}`;
    ctx.fillText('Slingshot around planets. Grab every star.', cx, 300);
    ctx.fillText('Do not kiss the rocks.', cx, 330);
    ctx.fillStyle = PALETTE.aim;
    ctx.font = `800 24px ${FONT}`;
    const blink = 0.6 + 0.4 * Math.sin(view.time * 3);
    ctx.globalAlpha = blink;
    ctx.fillText('CLICK OR PRESS SPACE TO FLY', cx, 400);
    ctx.globalAlpha = 1;
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 16px ${FONT}`;
    ctx.fillText('Drag to aim · release to launch · Arrows aim too · R restart · P pause · M mute', cx, 448);
    if (view.best > 0) {
      ctx.fillStyle = PALETTE.star;
      ctx.font = `700 18px ${FONT}`;
      ctx.fillText(`BEST ${view.best}`, cx, 478);
    }
    ctx.textAlign = 'left';
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(4, 8, 26, 0.6)';
    ctx.fillRect(-40, -40, FIELD.width + 80, FIELD.height + 80);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `900 64px ${FONT}`;
    ctx.fillText('PAUSED', FIELD.width / 2, 340);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 18px ${FONT}`;
    ctx.fillText('P resume · R restart level · M mute', FIELD.width / 2, 384);
    ctx.textAlign = 'left';
  }

  function drawClear(view) {
    const cx = FIELD.width / 2;
    drawPanel(cx - 280, 210, 560, 220);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.aim;
    ctx.font = `900 56px ${FONT}`;
    ctx.fillText('LEVEL CLEAR!', cx, 300);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `600 22px ${FONT}`;
    ctx.fillText(`Bonus +${view.clearBonus} · Score ${view.score}`, cx, 348);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 16px ${FONT}`;
    ctx.fillText('Next level incoming…', cx, 392);
    ctx.textAlign = 'left';
  }

  function drawOver(view) {
    const cx = FIELD.width / 2;
    drawPanel(cx - 300, 180, 600, 300);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.danger;
    ctx.font = `900 60px ${FONT}`;
    ctx.fillText('MISSION OVER', cx, 268);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 28px ${FONT}`;
    ctx.fillText(`SCORE ${view.score}`, cx, 322);
    if (view.newBest && view.score > 0) {
      ctx.fillStyle = PALETTE.star;
      ctx.font = `800 22px ${FONT}`;
      ctx.fillText('★ NEW BEST ★', cx, 360);
    } else {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `600 18px ${FONT}`;
      ctx.fillText(`BEST ${view.best}`, cx, 360);
    }
    ctx.fillStyle = PALETTE.aim;
    ctx.font = `800 22px ${FONT}`;
    const blink = 0.6 + 0.4 * Math.sin(view.time * 3);
    ctx.globalAlpha = blink;
    ctx.fillText('PRESS SPACE TO FLY AGAIN', cx, 420);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  function draw(view) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#04081a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const shx = view.shake ? (Math.random() - 0.5) * view.shake * 16 : 0;
    const shy = view.shake ? (Math.random() - 0.5) * view.shake * 16 : 0;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (offX + shx * scale), dpr * (offY + shy * scale));
    drawBackground(view.ship, view.time);
    if (view.level) {
      for (const p of view.level.planets) drawPlanet(p, view.time);
      for (const s of view.level.stars) if (!s.taken) drawStarPickup(s, view.time);
      for (const p of view.level.powerups ?? []) if (!p.taken) drawPowerup(p, view.time);
      for (const a of view.level.asteroids) drawAsteroid(a);
    }
    if (view.screen === 'aim' || view.screen === 'fly') {
      drawTrajectory(view.trajectory);
      drawAim(view);
    }
    if (view.ship && view.screen !== 'title' && view.screen !== 'over') drawShip(view.ship, view);
    drawParticles(view.particles);
    drawPopups(view.popups);
    if (view.screen !== 'title') drawHud(view);
    if (view.screen === 'title') drawTitle(view);
    else if (view.hint) drawHint(view.hint, true);
    else if (view.screen === 'aim') {
      if (view.levelIndex === 1) drawHint('Drag to aim — planets bend your path. Release to launch!');
      else if (view.levelIndex === 2) drawHint('Planets bend your flight — use gravity to reach the stars');
      else drawHint('Drag to aim · release to launch — the dotted line is your flight path');
    } else if (view.screen === 'fly') drawHint('R restart level · P pause · M mute');
    else if (view.screen === 'paused') drawPaused();
    else if (view.screen === 'clear') drawClear(view);
    else if (view.screen === 'over') drawOver(view);
  }

  return { resize, draw, toField };
}
