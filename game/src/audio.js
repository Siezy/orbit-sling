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
    launch() {
      noise(0.5, 0.35, 2400, 300);
      tone(220, 0.4, 'sine', 0.25, 880);
    },
    pickup(combo) {
      const step = Math.min(combo, 8);
      tone(660 * Math.pow(1.059463, step), 0.12, 'sine', 0.3);
      setTimeout(() => tone(990 * Math.pow(1.059463, step), 0.16, 'sine', 0.25), 70);
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
    crash() {
      noise(0.5, 0.5, 900, 120);
      tone(90, 0.5, 'sine', 0.4, 40);
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
    },
  };
}
