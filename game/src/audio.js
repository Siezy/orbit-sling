// Sound, synthesized with WebAudio — no audio files, nothing loaded over
// the network. Every sound is a few oscillators or a burst of filtered noise.
// The context is created lazily on the first user gesture (browsers block
// audio before that) and everything is wrapped so a missing AudioContext
// (headless screenshots, old browsers) just means silence, never a crash.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let pad = null;
  let engineOsc = null;
  let engineGain = null;
  let engineNoise = null;
  let engineNoiseGain = null;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function noiseBuffer(seconds) {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure()) return;
    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch {
      // Silence on any audio failure.
    }
  }

  function noise(dur, vol, filterFreq, slideTo) {
    if (!ensure()) return;
    try {
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(dur);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(filterFreq, t);
      if (slideTo) filter.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start(t);
      src.stop(t + dur + 0.02);
    } catch {
      // Silence on any audio failure.
    }
  }

  return {
    get muted() {
      return muted;
    },
    /** Call on the first gesture: unlocks audio and starts the quiet pad. */
    unlock() {
      if (!ensure()) return;
      try {
        if (ctx.state === 'suspended') void ctx.resume();
        if (!pad) {
          pad = ctx.createGain();
          pad.gain.value = 0.03;
          pad.connect(master);
          for (const freq of [110, 164.8, 220]) {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;
            osc.connect(pad);
            osc.start();
          }
        }
      } catch {
        // Silence on any audio failure.
      }
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = value ? 0 : 0.5;
    },
    click() {
      tone(660, 0.07, 'square', 0.12);
    },
    /** Engine roar for the takeoff roll: rising noise + a climbing tone. */
    takeoff() {
      noise(0.7, 0.4, 900, 3200);
      tone(140, 0.6, 'sawtooth', 0.16, 420);
      this.engine(true, 0.4);
    },
    launch() {
      noise(0.5, 0.35, 2400, 300);
      tone(220, 0.4, 'sine', 0.25, 880);
    },
    /** The engine drone: a low sawtooth + wind noise whose pitch and level
     * follow the plane's speed (0..1). Call with (false) to stop it. */
    engine(on, speed01) {
      if (!ensure()) return;
      try {
        if (!on) {
          if (engineGain) engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
          if (engineNoiseGain) engineNoiseGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
          return;
        }
        if (!engineOsc) {
          engineOsc = ctx.createOscillator();
          engineOsc.type = 'sawtooth';
          engineOsc.frequency.value = 70;
          engineGain = ctx.createGain();
          engineGain.gain.value = 0;
          engineOsc.connect(engineGain);
          engineGain.connect(master);
          engineOsc.start();
          engineNoise = ctx.createBufferSource();
          engineNoise.buffer = noiseBuffer(1.5);
          engineNoise.loop = true;
          const filter = ctx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.value = 700;
          filter.Q.value = 0.6;
          engineNoiseGain = ctx.createGain();
          engineNoiseGain.gain.value = 0;
          engineNoise.connect(filter);
          filter.connect(engineNoiseGain);
          engineNoiseGain.connect(master);
          engineNoise.start();
        }
        const s = Math.max(0, Math.min(1, speed01));
        engineOsc.frequency.setTargetAtTime(55 + s * 75, ctx.currentTime, 0.1);
        engineGain.gain.setTargetAtTime(muted ? 0 : 0.045 + s * 0.05, ctx.currentTime, 0.1);
        engineNoiseGain.gain.setTargetAtTime(muted ? 0 : s * 0.05, ctx.currentTime, 0.1);
      } catch {
        // Silence on any audio failure.
      }
    },
    /** Touchdown: a soft thud plus a bright landing chime. */
    land() {
      noise(0.25, 0.4, 500, 120);
      tone(160, 0.2, 'sine', 0.35, 70);
      [784, 1047, 1319].forEach((freq, i) => {
        setTimeout(() => tone(freq, 0.22, 'triangle', 0.22), 90 + i * 100);
      });
      this.engine(false);
    },
    pickup(combo) {
      const step = Math.min(combo, 8);
      tone(660 * Math.pow(1.059463, step), 0.12, 'sine', 0.3);
      setTimeout(() => tone(990 * Math.pow(1.059463, step), 0.16, 'sine', 0.25), 70);
    },
    /** A boost ring: a bright two-note chime, higher than a star. */
    ring() {
      tone(1175, 0.1, 'sine', 0.3);
      setTimeout(() => tone(1568, 0.18, 'sine', 0.28), 60);
    },
    /** A relic picked in the workshop: a little fanfare. */
    relic() {
      [523, 659, 784, 1047, 1319].forEach((freq, i) => {
        setTimeout(() => tone(freq, 0.18, 'triangle', 0.25), i * 80);
      });
    },
    /** The Thunderhead's roar: low noise with a deep falling tone. */
    roar() {
      noise(1.2, 0.5, 400, 90);
      tone(70, 1.1, 'sawtooth', 0.3, 45);
    },
    /** A lightning strike: a sharp crack over a deep boom. */
    bolt() {
      noise(0.12, 0.6, 4000, 800);
      tone(55, 0.7, 'sine', 0.5, 35);
    },
    /** The tank running dry: two low descending notes. */
    fuelEmpty() {
      tone(330, 0.2, 'square', 0.15, 220);
      setTimeout(() => tone(220, 0.3, 'square', 0.15, 150), 120);
    },
    powerup() {
      [523, 659, 784].forEach((freq, i) => {
        setTimeout(() => tone(freq, 0.14, 'triangle', 0.25), i * 70);
      });
    },
    shieldSave() {
      tone(180, 0.25, 'sine', 0.4, 90);
      setTimeout(() => tone(880, 0.18, 'triangle', 0.25), 90);
    },
    graze() {
      tone(1240, 0.09, 'triangle', 0.2, 1560);
    },
    /** A soft thud for bouncing off the strip (too fast, or stars remain). */
    bounce() {
      tone(120, 0.15, 'sine', 0.3, 60);
      noise(0.12, 0.2, 600, 200);
    },
    /** A bird strike: a squawk-ish chirp over a thud. */
    birdHit() {
      tone(900, 0.08, 'square', 0.14, 500);
      tone(500, 0.1, 'square', 0.12, 300);
      noise(0.15, 0.25, 700, 200);
    },
    crash() {
      noise(0.5, 0.5, 900, 120);
      tone(90, 0.5, 'sine', 0.4, 40);
      this.engine(false);
    },
    levelClear() {
      [523, 659, 784, 1047].forEach((freq, i) => {
        setTimeout(() => tone(freq, 0.22, 'triangle', 0.25), i * 110);
      });
    },
    gameOver() {
      [392, 330, 262, 196].forEach((freq, i) => {
        setTimeout(() => tone(freq, 0.3, 'triangle', 0.22), i * 160);
      });
      this.engine(false);
    },
  };
}
