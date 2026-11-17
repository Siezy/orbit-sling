// All canvas drawing: the realm skies, runway and landing strip, the
// airplane, storm vortexes, boost rings, the Thunderhead boss, the
// trajectory preview, particles, the HUD and the screens. The playfield is
// a fixed 1280x720 logical area; the view scales it to the window with
// letterboxing, so the game looks the same on every screen and in every
// screenshot.

import { BOSS, FIELD, FONT, GROUND_LINE, GROUND_TOP, PALETTE, POWERUPS, RELICS, STRIP, TAKEOFF_ROLL } from './config.js';
import { createRandom } from './random.js';
import { FLIGHT_START } from './levels.js';

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

  // Drifting clouds: fixed seeds, so the sky is the same every run.
  const cloudRng = createRandom(4242);
  const clouds = Array.from({ length: 9 }, () => ({
    x: cloudRng.range(0, FIELD.width),
    y: cloudRng.range(50, 520),
    s: cloudRng.range(0.7, 1.6),
    speed: cloudRng.range(4, 10),
    alpha: cloudRng.range(0.55, 0.9),
  }));
  // Fixed stars for the night realm.
  const starRng = createRandom(777);
  const nightStars = Array.from({ length: 42 }, () => ({
    x: starRng.range(0, FIELD.width),
    y: starRng.range(0, 560),
    r: starRng.range(0.8, 2.2),
    tw: starRng.range(0, Math.PI * 2),
  }));

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

  /** The realm's palette for this view (the v3 bright sky by default). */
  function realmPal(view) {
    return view.level?.palette ?? PALETTE;
  }

  function drawBackground(view, time) {
    const pal = realmPal(view);
    const bg = ctx.createLinearGradient(0, 0, 0, GROUND_TOP);
    bg.addColorStop(0, pal.skyTop);
    bg.addColorStop(0.55, pal.skyMid);
    bg.addColorStop(1, pal.skyHorizon);
    ctx.fillStyle = bg;
    ctx.fillRect(-40, -40, FIELD.width + 80, GROUND_TOP + 40);
    // Night realm: fixed stars twinkling in the sky.
    if (pal.night) {
      for (const s of nightStars) {
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 1.5 + s.tw);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // Sun by day, moon by night, top-right.
    const sunX = 1150;
    const sunY = 88;
    if (pal.night) {
      const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 90);
      glow.addColorStop(0, 'rgba(220, 230, 255, 0.5)');
      glow.addColorStop(1, 'rgba(220, 230, 255, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(sunX - 90, sunY - 90, 180, 180);
      ctx.fillStyle = '#dfe6f5';
      ctx.beginPath();
      ctx.arc(sunX, sunY, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(160, 175, 205, 0.8)';
      ctx.beginPath();
      ctx.arc(sunX - 8, sunY - 6, 6, 0, Math.PI * 2);
      ctx.arc(sunX + 9, sunY + 8, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 110);
      glow.addColorStop(0, 'rgba(255, 217, 77, 0.85)');
      glow.addColorStop(1, 'rgba(255, 217, 77, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(sunX - 110, sunY - 110, 220, 220);
      ctx.fillStyle = PALETTE.sun;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 34, 0, Math.PI * 2);
      ctx.fill();
    }
    // Drifting clouds.
    for (const c of clouds) {
      const span = FIELD.width + 360;
      const x = (((c.x + time * c.speed + 180) % span) + span) % span - 180;
      ctx.globalAlpha = c.alpha * (pal.night ? 0.35 : 1);
      ctx.fillStyle = PALETTE.cloud;
      const s = c.s;
      ctx.beginPath();
      ctx.ellipse(x, c.y, 52 * s, 18 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(x - 30 * s, c.y + 6 * s, 30 * s, 13 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 32 * s, c.y + 5 * s, 32 * s, 14 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawGround(view) {
    const pal = realmPal(view);
    // Grass band.
    ctx.fillStyle = pal.ground;
    ctx.fillRect(-40, GROUND_TOP, FIELD.width + 80, FIELD.height - GROUND_TOP + 40);
    ctx.fillStyle = pal.groundDark;
    ctx.fillRect(-40, GROUND_TOP, FIELD.width + 80, 6);
    // Mowing stripes.
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let x = 0; x < FIELD.width; x += 160) {
      ctx.fillRect(x, GROUND_TOP + 6, 80, FIELD.height - GROUND_TOP);
    }
    // Runway (takeoff) and landing strip: grey bands with white dashes.
    drawRunway(40, 240, false);
    drawRunway(STRIP.x0, STRIP.x1, view.stripArmed);
    // Windsock beside the runway, waving with time.
    const wx = 268;
    const wy = GROUND_TOP - 46;
    ctx.strokeStyle = '#5b6b7f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(wx, GROUND_TOP);
    ctx.lineTo(wx, wy);
    ctx.stroke();
    const wave = Math.sin(view.time * 2.2) * 0.12;
    ctx.save();
    ctx.translate(wx, wy);
    ctx.rotate(0.12 + wave);
    ctx.fillStyle = '#ff7a3c';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(34, -3);
    ctx.lineTo(34, 3);
    ctx.lineTo(0, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(10, -6, 7, 12);
    ctx.restore();
  }

  function drawRunway(x0, x1, armed) {
    const y = GROUND_LINE - 20;
    ctx.fillStyle = armed ? PALETTE.strip : PALETTE.runway;
    roundRect(ctx, x0, y, x1 - x0, 20, 4);
    ctx.fill();
    // Centre dashes.
    ctx.fillStyle = PALETTE.runwayLine;
    for (let x = x0 + 12; x < x1 - 12; x += 34) {
      ctx.fillRect(x, y + 8, 18, 4);
    }
    // Edge lights: white on the runway, green on the armed strip.
    ctx.fillStyle = armed ? PALETTE.stripEdge : 'rgba(255,255,255,0.85)';
    for (let x = x0 + 8; x <= x1 - 8; x += 26) {
      ctx.beginPath();
      ctx.arc(x, y - 3, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (armed) {
      ctx.fillStyle = PALETTE.stripEdge;
      ctx.font = `900 15px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('LAND HERE', (x0 + x1) / 2, y + 15);
      ctx.textAlign = 'left';
    }
  }

  // Hex colour + alpha → rgba() string (for fading cloud edges).
  function hexAlpha(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }

  function drawVortex(p, time) {
    const r = p.r;
    // Wind radius, faint so the player can read the danger zone.
    ctx.strokeStyle = 'rgba(30, 58, 95, 0.16)';
    ctx.setLineDash([4, 9]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 2.1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // Feathered halo: a soft glow that fades into the sky, so the cloud
    // never has a hard dark edge.
    const halo = ctx.createRadialGradient(p.x, p.y, r * 0.4, p.x, p.y, r * 1.25);
    halo.addColorStop(0, hexAlpha(p.style.glow, 0.30));
    halo.addColorStop(1, hexAlpha(p.style.glow, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 1.25, 0, Math.PI * 2);
    ctx.fill();
    // Storm cloud body: overlapping seeded puffs, never one solid disc.
    // Puff centres reuse the vortex's own seeded swirl knots plus a core
    // puff and two fixed filler puffs, so the shape is fixed per vortex
    // and identical every run. Each puff fades to transparent at its edge,
    // so the puffs melt into one soft cloud instead of a hard circle.
    const puffs = [{ dx: 0, dy: 0, rr: 0.55 }];
    for (const c of p.swirls) {
      puffs.push({ dx: c.dx, dy: c.dy, rr: (c.r / r) * 1.7 });
    }
    puffs.push({ dx: -0.42 * r, dy: 0.30 * r, rr: 0.42 });
    puffs.push({ dx: 0.40 * r, dy: -0.34 * r, rr: 0.40 });
    for (const q of puffs) {
      const px = p.x + q.dx;
      const py = p.y + q.dy;
      const pr = q.rr * r;
      const g = ctx.createRadialGradient(
        px - pr * 0.25, py - pr * 0.3, pr * 0.1,
        px, py, pr,
      );
      g.addColorStop(0, p.style.base);
      g.addColorStop(0.7, p.style.base);
      g.addColorStop(1, hexAlpha(p.style.base, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }
    // Soft knot shading: pale highlights on the seeded knots, never black.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    for (const c of p.swirls) {
      ctx.beginPath();
      ctx.arc(p.x + c.dx - c.r * 0.2, p.y + c.dy - c.r * 0.25, c.r * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    // Swirl arms, slowly rotating — two counter-rotating rings.
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(time * 0.25);
    ctx.strokeStyle = p.style.rim;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 5;
    for (let i = 0; i < 3; i += 1) {
      const a0 = (i / 3) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.62, a0, a0 + 1.5);
      ctx.stroke();
    }
    ctx.rotate(-time * 0.6);
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 4;
    for (let i = 0; i < 2; i += 1) {
      const a0 = (i / 2) * Math.PI * 2 + 0.6;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.38, a0, a0 + 1.8);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    // Vortex eye: a small calm pale centre.
    ctx.fillStyle = 'rgba(232, 238, 246, 0.9)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 0.13, 0, Math.PI * 2);
    ctx.fill();
    // Lightning zigzag in the cloud's heart, scaled to the cloud's radius.
    const s = r / 60;
    ctx.strokeStyle = 'rgba(255, 240, 140, 0.9)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(p.x - 6 * s, p.y - 12 * s);
    ctx.lineTo(p.x + 2 * s, p.y - 2 * s);
    ctx.lineTo(p.x - 4 * s, p.y + 2 * s);
    ctx.lineTo(p.x + 6 * s, p.y + 14 * s);
    ctx.stroke();
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
    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = 1.5;
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
    ctx.stroke();
    ctx.restore();
  }

  // A boost ring: a golden ring with a lightning bolt inside. Flying
  // through it refills fuel and kicks the plane faster.
  function drawRing(r, time) {
    const pulse = 1 + 0.1 * Math.sin(time * 3.2 + r.phase);
    const rad = 20 * pulse;
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.shadowColor = '#ffd94d';
    ctx.shadowBlur = 18;
    ctx.strokeStyle = '#ffd94d';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, rad, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, rad - 4, 0, Math.PI * 2);
    ctx.stroke();
    // Bolt inside the ring.
    ctx.strokeStyle = '#fff3b0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(2, -11);
    ctx.lineTo(-4, 1);
    ctx.lineTo(1, 1);
    ctx.lineTo(-2, 11);
    ctx.stroke();
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
    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
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

  function drawStormCell(a) {
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.rot);
    ctx.fillStyle = PALETTE.storm;
    ctx.strokeStyle = PALETTE.stormRim;
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
    // A small lightning zigzag on the cell.
    ctx.strokeStyle = 'rgba(255, 240, 140, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-3, -6);
    ctx.lineTo(1, -1);
    ctx.lineTo(-2, 1);
    ctx.lineTo(3, 6);
    ctx.stroke();
    ctx.restore();
  }

  function drawTurbulence(z, time) {
    ctx.save();
    ctx.translate(z.x, z.y);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.strokeStyle = PALETTE.turbulence;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, z.rx, z.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Wavy air lines, drifting with time.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 2;
    for (let row = -1; row <= 1; row += 1) {
      ctx.beginPath();
      for (let x = -z.rx + 12; x <= z.rx - 12; x += 8) {
        const y = row * z.ry * 0.45 + Math.sin(x * 0.09 + time * 5 + z.seed) * 5;
        if (x === -z.rx + 12) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBird(b, time) {
    const pos = birdPosOf(b, time);
    const flap = Math.sin(time * 10 + b.phase) * 0.5;
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.scale(b.dir, 1);
    ctx.strokeStyle = '#2b3442';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-9, 0);
    ctx.quadraticCurveTo(-4, -4 - flap * 6, 0, 0);
    ctx.quadraticCurveTo(4, -4 - flap * 6, 9, 0);
    ctx.stroke();
    ctx.restore();
  }

  function birdPosOf(b, time) {
    const span = FIELD.width + 80;
    let x = b.startX + b.dir * b.speed * time;
    x = (((x + 40) % span) + span) % span - 40;
    const y = b.baseY + Math.sin(time * b.freq + b.phase) * b.amp;
    return { x, y };
  }

  /**
   * The Thunderhead boss: a giant storm cloud drifting across the field,
   * with a telegraphed lightning column (flashing warning) or a striking
   * bolt (a jagged line to the ground). view.boss carries { pos,
   * telegraph, striking }.
   */
  function drawBoss(view) {
    const b = view.boss;
    if (!b) return;
    const { pos } = b;
    const r = BOSS.radius;
    // Telegraph: a flashing warning column where the bolt will land.
    if (b.telegraph != null) {
      const blink = 0.35 + 0.3 * Math.sin(view.time * 14);
      ctx.fillStyle = `rgba(255, 93, 108, ${blink})`;
      ctx.fillRect(b.telegraph - BOSS.boltWidth / 2, 0, BOSS.boltWidth, GROUND_LINE);
      ctx.strokeStyle = `rgba(255, 93, 108, ${Math.min(1, blink + 0.3)})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(b.telegraph - BOSS.boltWidth / 2, 0, BOSS.boltWidth, GROUND_LINE);
      ctx.setLineDash([]);
      ctx.fillStyle = '#ff5d6c';
      ctx.font = `900 18px ${FONT}`;
      ctx.textAlign = 'center';
      // Mid-column, below the HUD: at the top it collides with the stage
      // title when the column is near the centre of the field.
      ctx.fillText('⚡ LIGHTNING!', b.telegraph, 150);
      ctx.textAlign = 'left';
    }
    // Striking bolt: a jagged line from the cloud to the ground, plus a flash.
    if (b.striking != null) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.fillRect(-40, -40, FIELD.width + 80, FIELD.height + 80);
      ctx.strokeStyle = '#fff3b0';
      ctx.lineWidth = 5;
      ctx.beginPath();
      let bx = b.striking;
      let by = pos.y + r * 0.4;
      ctx.moveTo(bx, by);
      while (by < GROUND_LINE) {
        bx += (Math.sin(by * 0.35) * 14);
        by += 42;
        ctx.lineTo(bx, Math.min(by, GROUND_LINE));
      }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 240, 140, 0.6)';
      ctx.lineWidth = 11;
      ctx.stroke();
    }
    // The cloud itself: a huge dark mass with swirling arms and lightning.
    ctx.save();
    ctx.shadowColor = 'rgba(20, 16, 40, 0.7)';
    ctx.shadowBlur = 34;
    const g = ctx.createRadialGradient(
      pos.x - r * 0.3, pos.y - r * 0.35, r * 0.1,
      pos.x, pos.y, r,
    );
    g.addColorStop(0, '#4a4468');
    g.addColorStop(0.6, '#2b2140');
    g.addColorStop(1, '#171226');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Swirl arms, rotating.
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(view.time * 0.4);
    ctx.strokeStyle = 'rgba(179, 157, 219, 0.7)';
    ctx.lineWidth = 7;
    for (let i = 0; i < 3; i += 1) {
      const a0 = (i / 3) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.6, a0, a0 + 1.7);
      ctx.stroke();
    }
    ctx.restore();
    // The boss's danger ring, so the player reads the crash radius.
    ctx.strokeStyle = 'rgba(255, 93, 108, 0.35)';
    ctx.setLineDash([6, 10]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // Lightning zigzags in the cloud's heart.
    ctx.strokeStyle = 'rgba(255, 240, 140, 0.95)';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(pos.x - 14, pos.y - 26);
    ctx.lineTo(pos.x + 4, pos.y - 6);
    ctx.lineTo(pos.x - 8, pos.y + 2);
    ctx.lineTo(pos.x + 14, pos.y + 28);
    ctx.stroke();
    // Name tag.
    ctx.font = `900 20px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff8a9a';
    ctx.fillText('THUNDERHEAD', pos.x, pos.y - r - 14);
    ctx.textAlign = 'left';
  }

  /**
   * The airplane: fuselage, swept wing, tail fin, cockpit, spinning
   * propeller. `gear` draws the wheels (on the ground only). `bank` leans
   * the plane into a turn. Rival planes reuse this at a smaller scale.
   */
  function drawPlaneAt(x, y, angle, body, stripe, propAngle, scale, gear, shield) {
    ctx.save();
    ctx.translate(x, y);
    if (shield) {
      ctx.strokeStyle = '#5df2ff';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#5df2ff';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    ctx.shadowColor = 'rgba(20, 40, 70, 0.35)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    // Main wing (near wing, swept back, below the fuselage).
    ctx.fillStyle = '#dfe7ef';
    ctx.beginPath();
    ctx.moveTo(-2, 2);
    ctx.lineTo(10, 15);
    ctx.lineTo(15, 15);
    ctx.lineTo(6, 2);
    ctx.closePath();
    ctx.fill();
    // Tail fin (up) and stabiliser (down).
    ctx.fillStyle = stripe;
    ctx.beginPath();
    ctx.moveTo(-11, -2);
    ctx.lineTo(-17, -13);
    ctx.lineTo(-10, -13);
    ctx.lineTo(-5, -2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#dfe7ef';
    ctx.beginPath();
    ctx.moveTo(-11, 1);
    ctx.lineTo(-16, 8);
    ctx.lineTo(-10, 8);
    ctx.lineTo(-5, 1);
    ctx.closePath();
    ctx.fill();
    // Fuselage.
    const g = ctx.createLinearGradient(0, -7, 0, 7);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.55, body);
    g.addColorStop(1, '#c8d3de');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-15, 0);
    ctx.quadraticCurveTo(-12, -7, 0, -7);
    ctx.quadraticCurveTo(12, -7, 17, -1);
    ctx.quadraticCurveTo(18, 0, 17, 1);
    ctx.quadraticCurveTo(12, 7, 0, 7);
    ctx.quadraticCurveTo(-12, 7, -15, 0);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    // Stripe along the fuselage.
    ctx.fillStyle = stripe;
    ctx.fillRect(-12, 1.5, 26, 2.5);
    // Cockpit window.
    ctx.fillStyle = '#7cc7ee';
    ctx.beginPath();
    ctx.ellipse(8, -3, 4.5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // Propeller: a blurred disc plus two spinning blades at the nose.
    ctx.save();
    ctx.translate(18, 0);
    ctx.fillStyle = 'rgba(90, 100, 115, 0.22)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 3, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(propAngle);
    ctx.strokeStyle = '#3a4356';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(0, 12);
    ctx.stroke();
    ctx.rotate(Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(0, 12);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#3a4356';
    ctx.beginPath();
    ctx.arc(18, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();
    // Wheels, on the ground only.
    if (gear) {
      ctx.fillStyle = '#2b3442';
      ctx.beginPath();
      ctx.arc(-6, 9, 3, 0, Math.PI * 2);
      ctx.arc(9, 9, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPlane(ship, view) {
    const onGround = view.screen === 'aim' || view.screen === 'takeoff' || view.screen === 'title';
    const propAngle = view.time * 38;
    drawPlaneAt(ship.x, ship.y, ship.angle, '#ffffff', PALETTE.planeStripe, propAngle, 1, onGround, view.shield);
  }

  function drawRivals(view) {
    for (const r of view.rivals ?? []) {
      if (!r.visible) continue;
      drawPlaneAt(r.x, r.y, r.angle, '#ffffff', r.color, view.time * 38, 0.82, r.phase === 'aim' || r.phase === 'land', false);
      // Name tag.
      ctx.font = `800 12px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = r.color;
      ctx.fillText(r.name, r.x, r.y - 26);
      ctx.textAlign = 'left';
    }
  }

  function drawTrajectory(points) {
    if (!points || points.length < 2) return;
    for (let i = 0; i < points.length; i += 3) {
      const p = points[i];
      const fade = 1 - i / points.length;
      ctx.globalAlpha = 0.25 + 0.55 * fade;
      ctx.fillStyle = '#2563eb';
      ctx.beginPath();
      ctx.arc(p.x, p.y, i === 0 ? 2 : 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // The flight's end: a red mark when it ends badly, a green flag when
    // the takeoff lands — so the player sees the outcome before launching.
    const last = points[points.length - 1];
    if (last.hit === 'land') {
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = '#1d7a4d';
      ctx.font = `900 26px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('⚑', last.x, last.y - 8);
      ctx.textAlign = 'left';
    } else if (last.hit === 'vortex' || last.hit === 'storm' || last.hit === 'ground' || last.hit === 'boss' || last.hit === 'bolt') {
      ctx.globalAlpha = 0.95;
      ctx.strokeStyle = '#ff5d6c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(last.x - 8, last.y - 8);
      ctx.lineTo(last.x + 8, last.y + 8);
      ctx.moveTo(last.x + 8, last.y - 8);
      ctx.lineTo(last.x - 8, last.y + 8);
      ctx.stroke();
    } else if (last.hit === 'fuel') {
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = '#f2a007';
      ctx.font = `900 20px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('OUT OF FUEL', last.x, last.y - 8);
      ctx.textAlign = 'left';
    }
    ctx.globalAlpha = 1;
  }

  function drawAim(view) {
    const { ship, aim } = view;
    if (!aim) return;
    // Slingshot band: from the plane to the pull point.
    const px = aim.kind === 'drag' ? aim.px : ship.x - Math.cos(aim.angle) * aim.power * 260;
    const py = aim.kind === 'drag' ? aim.py : ship.y - Math.sin(aim.angle) * aim.power * 260;
    ctx.strokeStyle = 'rgba(29, 122, 77, 0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ship.x, ship.y);
    ctx.lineTo(px, py);
    ctx.stroke();
    // Power ring around the plane.
    const power = aim.kind === 'drag'
      ? Math.min(1, Math.hypot(ship.x - px, ship.y - py) / 260)
      : aim.power;
    ctx.strokeStyle = 'rgba(29, 122, 77, 0.95)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(ship.x, ship.y, 26, -Math.PI / 2, -Math.PI / 2 + power * Math.PI * 2);
    ctx.stroke();
    // The takeoff roll the plane is about to make: a dashed line from the
    // runway to the liftoff point, so the preview's start reads clearly.
    ctx.strokeStyle = 'rgba(29, 122, 77, 0.45)';
    ctx.setLineDash([5, 6]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ship.x, ship.y);
    ctx.lineTo(FLIGHT_START.x, FLIGHT_START.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawPowerMeter(view) {
    const power = view.screen === 'aim' ? view.power : view.takeoffPower;
    if (power == null) return;
    const w = 300;
    const h = 16;
    const x = (FIELD.width - w) / 2;
    const y = FIELD.height - 52;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    roundRect(ctx, x, y, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = '#5b6b7f';
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, w, h, 8);
    ctx.stroke();
    const fill = power > 0.85 ? '#e63946' : power > 0.5 ? '#2f9e44' : '#f2a007';
    ctx.fillStyle = fill;
    if (power > 0.02) {
      roundRect(ctx, x + 2, y + 2, (w - 4) * power, h - 4, 6);
      ctx.fill();
    }
    ctx.fillStyle = '#12233a';
    ctx.font = `800 14px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(`POWER ${Math.round(power * 100)}%`, FIELD.width / 2, y + 13);
    ctx.textAlign = 'left';
  }

  /** Fuel gauge, bottom-left: the tank drains in the air, rings refill it. */
  function drawFuel(view) {
    if (view.screen !== 'fly' && view.screen !== 'aim' && view.screen !== 'takeoff') return;
    const fuel = view.fuel ?? 0;
    const max = view.fuelMax ?? 100;
    const frac = Math.max(0, Math.min(1, fuel / max));
    const w = 220;
    const h = 16;
    const x = 24;
    const y = FIELD.height - 52;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    roundRect(ctx, x, y, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = '#5b6b7f';
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, w, h, 8);
    ctx.stroke();
    const fill = frac < 0.25 ? '#e63946' : frac < 0.5 ? '#f2a007' : '#2f9e44';
    ctx.fillStyle = fill;
    if (frac > 0.02) {
      roundRect(ctx, x + 2, y + 2, (w - 4) * frac, h - 4, 6);
      ctx.fill();
    }
    const pal = realmPal(view);
    ctx.fillStyle = pal.text;
    ctx.font = `800 14px ${FONT}`;
    ctx.textAlign = 'left';
    // The label sits right of the bar: above it is the runway, and text
    // there sits on the asphalt and reads as clipped.
    ctx.fillText(`FUEL ${Math.round(fuel)}`, x + w + 10, y + 13);
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
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 3;
      // Never run off the top of the frame: a popup near the top edge drops
      // below its point instead.
      const y = Math.max(30, p.y - (1 - a) * 30);
      ctx.strokeText(p.text, p.x, y);
      ctx.fillText(p.text, p.x, y);
    }
    ctx.globalAlpha = 1;
  }

  function drawHud(view) {
    const { score, best, lives, levelIndex, starsLeft } = view;
    const pal = realmPal(view);
    const text = pal.text;
    const muted = pal.muted;
    ctx.textAlign = 'left';
    ctx.font = `800 30px ${FONT}`;
    ctx.fillStyle = text;
    ctx.fillText(`SCORE ${score}`, 24, 44);
    ctx.font = `600 16px ${FONT}`;
    ctx.fillStyle = muted;
    ctx.fillText(`BEST ${Math.max(best, score)}`, 24, 68);
    // Held power-ups, as pills under the score so the player always sees them.
    let badgeY = 96;
    if (view.shield) {
      drawBadge('SHIELD', '#0e7490', 24, badgeY);
      badgeY += 30;
    }
    if (view.magnetLeft > 0) {
      drawBadge(`MAGNET ${Math.ceil(view.magnetLeft)}s`, '#be185d', 24, badgeY);
      badgeY += 30;
    }
    // Combo, when it is live.
    if (view.combo > 1) {
      drawBadge(`COMBO x${view.combo}`, '#0e7490', 24, badgeY);
      badgeY += 30;
    }
    // Relics, as small letter chips in a row.
    if (view.relics && view.relics.length > 0) {
      let rx = 24;
      for (const id of view.relics) {
        const def = RELICS[id];
        if (!def) continue;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.beginPath();
        ctx.arc(rx + 11, badgeY, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = def.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(rx + 11, badgeY, 11, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = def.color;
        ctx.font = `900 ${def.letter.length > 1 ? 10 : 13}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(def.letter, rx + 11, badgeY + 1);
        ctx.textBaseline = 'alphabetic';
        rx += 28;
      }
      badgeY += 30;
    }
    ctx.textAlign = 'center';
    ctx.font = `800 22px ${FONT}`;
    ctx.fillStyle = text;
    const stageLabel = view.stageName ? `STAGE ${levelIndex} · ${view.stageName.toUpperCase()}` : `STAGE ${levelIndex}`;
    ctx.fillText(stageLabel, FIELD.width / 2, 42);
    if (view.realmName) {
      ctx.font = `600 14px ${FONT}`;
      ctx.fillStyle = muted;
      ctx.fillText(view.realmName, FIELD.width / 2, 64);
    }
    // Stars left, as little icons.
    for (let i = 0; i < starsLeft; i += 1) {
      const x = FIELD.width / 2 - ((starsLeft - 1) * 16) + i * 32;
      ctx.fillStyle = PALETTE.star;
      ctx.strokeStyle = '#b8860b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, 84, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    // Race position, under the stage: the three racers in rank order.
    const order = view.raceOrder ?? [];
    if (order.length === 3) {
      ctx.font = `800 16px ${FONT}`;
      const labels = order.map((e, i) => `${i + 1}. ${e.name}`);
      const text2 = `RACE  ${labels.join('   ')}`;
      const w = ctx.measureText(text2).width;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
      roundRect(ctx, FIELD.width / 2 - w / 2 - 12, 96, w + 24, 26, 13);
      ctx.fill();
      let cx = FIELD.width / 2 - w / 2;
      ctx.textAlign = 'left';
      ctx.fillStyle = muted;
      ctx.fillText('RACE', cx, 114);
      cx += ctx.measureText('RACE  ').width;
      order.forEach((e, i) => {
        const label = `${i + 1}. ${e.name}`;
        ctx.fillStyle = e.isPlayer ? '#0e7490' : e.color;
        ctx.fillText(label, cx, 114);
        cx += ctx.measureText(`${label}   `).width;
      });
      ctx.textAlign = 'center';
    }
    ctx.textAlign = 'right';
    ctx.font = `600 16px ${FONT}`;
    ctx.fillStyle = muted;
    // Kept well inside the frame: the text used to sit close enough to the
    // right edge that it read as clipped in screenshots.
    ctx.fillText(view.muted ? 'MUTED (M)' : 'SOUND ON (M)', FIELD.width - 56, 42);
    // Lives, as little planes.
    for (let i = 0; i < lives; i += 1) {
      const x = FIELD.width - 66 - i * 30;
      ctx.save();
      ctx.translate(x, 64);
      ctx.rotate(0);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#5b6b7f';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(9, 0);
      ctx.lineTo(-6, -5);
      ctx.lineTo(-3, 0);
      ctx.lineTo(-6, 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.textAlign = 'left';
  }

  function drawBadge(text, color, x, y) {
    ctx.font = `800 14px ${FONT}`;
    const w = ctx.measureText(text).width + 20;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
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
    const pad = 16;
    ctx.font = `${strong ? 800 : 600} ${strong ? 20 : 17}px ${FONT}`;
    const w = ctx.measureText(text).width + pad * 2;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
    roundRect(ctx, FIELD.width / 2 - w / 2, FIELD.height - 52, w, 30, 15);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = strong ? '#0e7490' : PALETTE.text;
    ctx.fillText(text, FIELD.width / 2, FIELD.height - 31);
    ctx.textAlign = 'left';
  }

  function drawPanel(x, y, w, h) {
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, x, y, w, h, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(30, 58, 95, 0.2)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, w, h, 18);
    ctx.stroke();
  }

  function drawTitle(view) {
    ctx.textAlign = 'center';
    const cx = FIELD.width / 2;
    drawPanel(cx - 330, 150, 660, 340);
    const grad = ctx.createLinearGradient(cx - 300, 0, cx + 300, 0);
    grad.addColorStop(0, '#0284c7');
    grad.addColorStop(0.5, '#7c3aed');
    grad.addColorStop(1, '#ea580c');
    ctx.fillStyle = grad;
    ctx.font = `900 88px ${FONT}`;
    ctx.fillText('SKY RACE', cx, 250);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `600 22px ${FONT}`;
    ctx.fillText('Take off. Race the rivals. Land on the strip.', cx, 300);
    ctx.fillText('Grab every star — mind the storms and the birds.', cx, 330);
    ctx.fillStyle = '#0e7490';
    ctx.font = `800 24px ${FONT}`;
    const blink = 0.6 + 0.4 * Math.sin(view.time * 3);
    ctx.globalAlpha = blink;
    ctx.fillText('CLICK OR PRESS SPACE TO FLY', cx, 400);
    ctx.globalAlpha = 1;
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 16px ${FONT}`;
    ctx.fillText('9 stages · 4 realms · the Thunderhead waits at the summit', cx, 448);
    if (view.best > 0) {
      ctx.fillStyle = '#b8860b';
      ctx.font = `700 18px ${FONT}`;
      ctx.fillText(`BEST ${view.best}`, cx, 478);
    }
    ctx.textAlign = 'left';
  }

  /** Realm intro card (or the boss intro): name, flavor, stages, fly. */
  function drawIntro(view) {
    ctx.textAlign = 'center';
    const cx = FIELD.width / 2;
    const isBoss = view.introStage === 9;
    drawPanel(cx - 330, 170, 660, 320);
    if (isBoss) {
      ctx.fillStyle = '#dc2626';
      ctx.font = `900 64px ${FONT}`;
      ctx.fillText('THUNDERHEAD', cx, 258);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `600 22px ${FONT}`;
      ctx.fillText('The storm that hunts. Collect its stars.', cx, 306);
      ctx.fillText('Dodge the lightning. Land. Survive.', cx, 336);
      ctx.fillStyle = '#dc2626';
      ctx.font = `800 20px ${FONT}`;
      ctx.fillText('STAGE 9 · FINAL STAGE', cx, 384);
    } else {
      const realm = view.introRealm;
      ctx.fillStyle = '#0284c7';
      ctx.font = `900 56px ${FONT}`;
      ctx.fillText(realm.name, cx, 258);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `600 22px ${FONT}`;
      ctx.fillText(realm.flavor, cx, 306);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `600 18px ${FONT}`;
      const s1 = view.introStage;
      ctx.fillText(`Stage ${s1} · ${stageNameOf(s1)}  —  Stage ${s1 + 1} · ${stageNameOf(s1 + 1)}`, cx, 344);
      ctx.fillStyle = '#0e7490';
      ctx.font = `800 20px ${FONT}`;
      ctx.fillText(`REALM ${Math.floor((s1 - 1) / 2) + 1} OF 4`, cx, 384);
    }
    ctx.fillStyle = '#0e7490';
    ctx.font = `800 24px ${FONT}`;
    const blink = 0.6 + 0.4 * Math.sin(view.time * 3);
    ctx.globalAlpha = blink;
    ctx.fillText('CLICK OR PRESS SPACE TO FLY', cx, 448);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  function stageNameOf(stage) {
    const names = { 1: 'Meadow Run', 2: 'First Storm', 3: 'Peak Crossing', 4: 'Gale Pass', 5: 'Dusk Run', 6: 'Ember Coast', 7: 'Starlight Climb', 8: 'Summit Approach', 9: 'Thunderhead' };
    return names[stage] ?? '';
  }

  /** Workshop: pick 1 of 3 relics. Cards come from the view (rects + ids). */
  function drawWorkshop(view) {
    ctx.textAlign = 'center';
    const cx = FIELD.width / 2;
    ctx.fillStyle = 'rgba(4, 8, 26, 0.55)';
    ctx.fillRect(-40, -40, FIELD.width + 80, FIELD.height + 80);
    ctx.fillStyle = PALETTE.textLight;
    ctx.font = `900 52px ${FONT}`;
    ctx.fillText('WORKSHOP', cx, 130);
    ctx.fillStyle = 'rgba(238, 243, 255, 0.85)';
    ctx.font = `600 20px ${FONT}`;
    ctx.fillText('The realm is clear. Pick a relic — it stays with you to the summit.', cx, 168);
    ctx.fillText('Click a card, or press 1, 2, 3.', cx, 196);
    const offers = view.workshopOffers ?? [];
    const cards = view.workshopCards ?? [];
    offers.forEach((id, i) => {
      const def = RELICS[id];
      const c = cards[i];
      if (!def || !c) return;
      ctx.fillStyle = PALETTE.panel;
      roundRect(ctx, c.x, c.y, c.w, c.h, 16);
      ctx.fill();
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 3;
      roundRect(ctx, c.x, c.y, c.w, c.h, 16);
      ctx.stroke();
      // Letter icon in a coloured ring.
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath();
      ctx.arc(c.x + c.w / 2, c.y + 62, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(c.x + c.w / 2, c.y + 62, 34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = def.color;
      ctx.font = `900 ${def.letter.length > 1 ? 24 : 34}px ${FONT}`;
      ctx.fillText(def.letter, c.x + c.w / 2, c.y + 74);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `800 20px ${FONT}`;
      ctx.fillText(def.name, c.x + c.w / 2, c.y + 132);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `600 16px ${FONT}`;
      ctx.fillText(def.blurb, c.x + c.w / 2, c.y + 162);
      ctx.fillStyle = '#0e7490';
      ctx.font = `800 16px ${FONT}`;
      ctx.fillText(`PRESS ${i + 1}`, c.x + c.w / 2, c.y + 196);
    });
    ctx.textAlign = 'left';
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(4, 8, 26, 0.6)';
    ctx.fillRect(-40, -40, FIELD.width + 80, FIELD.height + 80);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.textLight;
    ctx.font = `900 64px ${FONT}`;
    ctx.fillText('PAUSED', FIELD.width / 2, 340);
    ctx.fillStyle = 'rgba(238, 243, 255, 0.8)';
    ctx.font = `600 18px ${FONT}`;
    ctx.fillText('P resume · R restart stage · M mute', FIELD.width / 2, 384);
    ctx.textAlign = 'left';
  }

  function drawClear(view) {
    const cx = FIELD.width / 2;
    drawPanel(cx - 300, 200, 600, 240);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0e7490';
    ctx.font = `900 52px ${FONT}`;
    ctx.fillText('STAGE CLEAR!', cx, 284);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 22px ${FONT}`;
    ctx.fillText(`Bonus +${view.clearBonus} · Score ${view.score}`, cx, 330);
    if (view.clearBreakdown) {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `600 16px ${FONT}`;
      ctx.fillText(view.clearBreakdown, cx, 362);
    }
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 16px ${FONT}`;
    const next = view.levelIndex % 2 === 0 && view.levelIndex < 9
      ? 'Workshop next — pick a relic!'
      : view.levelIndex >= 9
        ? 'The summit is yours…'
        : 'Next stage incoming…';
    ctx.fillText(`Race: ${view.raceRank === 1 ? '1st' : view.raceRank === 2 ? '2nd' : '3rd'} — ${next}`, cx, 394);
    ctx.textAlign = 'left';
  }

  function drawOver(view) {
    const cx = FIELD.width / 2;
    drawPanel(cx - 300, 150, 600, 330);
    ctx.textAlign = 'center';
    if (view.won) {
      ctx.fillStyle = '#0e7490';
      ctx.font = `900 56px ${FONT}`;
      ctx.fillText('SKY CHAMPION!', cx, 238);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `700 22px ${FONT}`;
      ctx.fillText('The Thunderhead is beaten.', cx, 278);
      ctx.fillText('The campaign is yours.', cx, 304);
      // Campaign summary: time, stars, relics, best race position.
      const s = view.summary;
      if (s) {
        const mins = Math.floor(s.time / 60);
        const secs = Math.floor(s.time % 60).toString().padStart(2, '0');
        ctx.fillStyle = PALETTE.muted;
        ctx.font = `600 20px ${FONT}`;
        ctx.fillText(`TIME ${mins}:${secs}  ·  STARS ${s.stars}  ·  BEST RACE ${s.bestRank === 1 ? '1st' : s.bestRank === 2 ? '2nd' : '3rd'}`, cx, 332);
        if (s.relics.length > 0) {
          const letters = s.relics.map((id) => RELICS[id]?.letter ?? '?').join('  ');
          ctx.fillText(`RELICS  ${letters}`, cx, 358);
        } else {
          ctx.fillText('RELICS  none — a bare-winged win!', cx, 358);
        }
      }
    } else {
      ctx.fillStyle = PALETTE.danger;
      ctx.font = `900 60px ${FONT}`;
      ctx.fillText('RACE OVER', cx, 238);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `700 24px ${FONT}`;
      ctx.fillText(`Stage ${view.levelIndex} · ${view.stageName}`, cx, 282);
    }
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 28px ${FONT}`;
    ctx.fillText(`SCORE ${view.score}`, cx, 396);
    if (view.newBest && view.score > 0) {
      ctx.fillStyle = '#b8860b';
      ctx.font = `800 22px ${FONT}`;
      ctx.fillText('★ NEW BEST ★', cx, 432);
    } else {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `600 18px ${FONT}`;
      ctx.fillText(`BEST ${view.best}`, cx, 432);
    }
    ctx.fillStyle = '#0e7490';
    ctx.font = `800 22px ${FONT}`;
    const blink = 0.6 + 0.4 * Math.sin(view.time * 3);
    ctx.globalAlpha = blink;
    ctx.fillText('PRESS SPACE TO FLY AGAIN', cx, 466);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  function draw(view) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#9fd8f8';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const shx = view.shake ? (Math.random() - 0.5) * view.shake * 16 : 0;
    const shy = view.shake ? (Math.random() - 0.5) * view.shake * 16 : 0;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (offX + shx * scale), dpr * (offY + shy * scale));
    drawBackground(view, view.time);
    drawGround(view);
    if (view.level) {
      for (const p of view.level.vortexes) drawVortex(p, view.time);
      for (const s of view.level.stars) if (!s.taken) drawStarPickup(s, view.time);
      for (const r of view.level.rings ?? []) if (!r.taken) drawRing(r, view.time);
      for (const p of view.level.powerups ?? []) if (!p.taken) drawPowerup(p, view.time);
      for (const a of view.level.storms) drawStormCell(a);
      for (const z of view.level.turbulence ?? []) drawTurbulence(z, view.time);
      for (const b of view.level.birds ?? []) drawBird(b, view.time);
    }
    drawBoss(view);
    drawRivals(view);
    if (view.screen === 'aim' || view.screen === 'fly' || view.screen === 'takeoff') {
      drawTrajectory(view.trajectory);
      drawAim(view);
    }
    if (view.ship && view.screen !== 'over') drawPlane(view.ship, view);
    // Takeoff speed lines: horizontal streaks rushing past the plane.
    if (view.takeoffT != null && view.ship) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i += 1) {
        const yy = view.ship.y - 40 + i * 16 + ((view.time * 300 + i * 47) % 16);
        const xx = view.ship.x - 30 - ((view.time * 700 + i * 83) % 160);
        ctx.beginPath();
        ctx.moveTo(xx, yy);
        ctx.lineTo(xx + 40 + view.takeoffT * 40, yy);
        ctx.stroke();
      }
    }
    drawParticles(view.particles);
    drawPopups(view.popups);
    drawPowerMeter(view);
    drawFuel(view);
    if (view.screen !== 'title' && view.screen !== 'intro' && view.screen !== 'workshop') drawHud(view);
    if (view.screen === 'title') drawTitle(view);
    else if (view.screen === 'intro') drawIntro(view);
    else if (view.screen === 'workshop') drawWorkshop(view);
    else if (view.hint) drawHint(view.hint, true);
    else if (view.screen === 'aim') {
      if (view.levelIndex === 1) drawHint('Drag to aim — the dotted line is your takeoff. Release to fly!');
      else if (view.levelIndex === 2) drawHint('Storm winds bend your flight — use them to reach the stars');
      else if (view.stripArmed) drawHint('All stars! Land on the green strip!');
      else drawHint('Drag to aim · release to take off — the dotted line is your flight path');
    } else if (view.screen === 'takeoff') drawHint('TAKEOFF!');
    else if (view.screen === 'fly') {
      if (view.stripArmed) drawHint('LAND ON THE GREEN STRIP!', true);
      else drawHint('R restart stage · P pause · M mute');
    } else if (view.screen === 'paused') drawPaused();
    else if (view.screen === 'clear') drawClear(view);
    else if (view.screen === 'over') drawOver(view);
  }

  return { resize, draw, toField };
}
