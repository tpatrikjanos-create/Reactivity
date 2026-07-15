/* ===== ACTIVITY HANGRENDSZER ===== */

const SoundEngine = (() => {
  let ctx = null;
  let masterVolume = parseFloat(localStorage.getItem('act_volume') ?? '0.7');
  let enabled = localStorage.getItem('act_sound') !== 'false';

  function getCtx() {
    try {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch(e) { return null; }
  }

  function osc(freq, type, start, dur, gainVal) {
    try {
      const c = getCtx();
      if (!c) return;
      const o = c.createOscillator();
      const g = c.createGain();
      g.gain.value = masterVolume * gainVal;
      g.gain.setTargetAtTime(0, start + dur * 0.6, dur * 0.15);
      g.connect(c.destination);
      o.type = type;
      o.frequency.setValueAtTime(freq, start);
      o.connect(g);
      o.start(start);
      o.stop(start + dur);
    } catch(e) {}
  }

  function noiseBurst(start, dur, gainVal, filterFreq) {
    try {
      const c = getCtx();
      if (!c) return;
      const bufLen = Math.floor(c.sampleRate * dur);
      const buf = c.createBuffer(1, bufLen, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource();
      src.buffer = buf;
      const filter = c.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = filterFreq || 1500;
      filter.Q.value = 0.7;
      const g = c.createGain();
      g.gain.value = masterVolume * gainVal;
      g.gain.setTargetAtTime(0, start + dur * 0.5, dur * 0.25);
      g.connect(c.destination);
      src.connect(filter);
      filter.connect(g);
      src.start(start);
      src.stop(start + dur);
    } catch(e) {}
  }

  const SYNTH = {
    'card-draw'() {
      const c = getCtx(); if (!c) return;
      const t = c.currentTime;
      noiseBurst(t, 0.12, 0.25, 1200);
      osc(300, 'sine', t + 0.05, 0.15, 0.2);
      try {
        const o = c.createOscillator();
        const g = c.createGain();
        g.gain.value = masterVolume * 0.18;
        g.gain.setTargetAtTime(0, t + 0.1, 0.05);
        g.connect(c.destination);
        o.type = 'sine';
        o.frequency.setValueAtTime(300, t + 0.05);
        o.frequency.linearRampToValueAtTime(600, t + 0.18);
        o.connect(g); o.start(t + 0.05); o.stop(t + 0.25);
      } catch(e) {}
    },
    'timer-start'() {
      const c = getCtx(); if (!c) return;
      const t = c.currentTime;
      [[440,0],[550,0.1],[660,0.2],[880,0.32]].forEach(([freq, delay]) => {
        osc(freq, 'square', t + delay, 0.18, 0.15);
      });
      osc(880, 'sine', t + 0.32, 0.35, 0.22);
    },
    'tick'() {
      const c = getCtx(); if (!c) return;
      osc(1200, 'square', c.currentTime, 0.04, 0.1);
    },
    'tick-fast'() {
      const c = getCtx(); if (!c) return;
      const t = c.currentTime;
      osc(1400, 'square', t, 0.04, 0.18);
      osc(700, 'sine', t, 0.03, 0.08);
    },
    'beep'() {
      const c = getCtx(); if (!c) return;
      osc(880, 'sine', c.currentTime, 0.15, 0.3);
    },
    'buzzer'() {
      const c = getCtx(); if (!c) return;
      try {
        const t = c.currentTime;
        const o1 = c.createOscillator();
        const o2 = c.createOscillator();
        const g = c.createGain();
        g.gain.value = masterVolume * 0.35;
        g.gain.setTargetAtTime(0, t + 0.7, 0.2);
        g.connect(c.destination);
        o1.type = 'sawtooth'; o1.frequency.value = 120;
        o2.type = 'square';   o2.frequency.value = 118;
        o1.connect(g); o2.connect(g);
        o1.start(t); o1.stop(t + 1.2);
        o2.start(t); o2.stop(t + 1.2);
        setTimeout(() => {
          try {
            const c2 = getCtx(); if (!c2) return;
            const o3 = c2.createOscillator();
            const g2 = c2.createGain();
            g2.gain.value = masterVolume * 0.25;
            g2.gain.setTargetAtTime(0, c2.currentTime + 0.5, 0.15);
            g2.connect(c2.destination);
            o3.type = 'sawtooth'; o3.frequency.value = 100;
            o3.connect(g2); o3.start(); o3.stop(c2.currentTime + 0.8);
          } catch(e) {}
        }, 400);
      } catch(e) {}
    },
    'btn-click'() {
      const c = getCtx(); if (!c) return;
      osc(800, 'sine', c.currentTime, 0.05, 0.12);
    },
    'cat-select'() {
      const c = getCtx(); if (!c) return;
      const t = c.currentTime;
      osc(660, 'sine', t, 0.07, 0.15);
      osc(880, 'sine', t + 0.06, 0.07, 0.12);
    },
    'menu-open'() {
      const c = getCtx(); if (!c) return;
      const t = c.currentTime;
      osc(440, 'sine', t, 0.08, 0.1);
      osc(550, 'sine', t + 0.07, 0.08, 0.08);
    },
    // ÚJ: Ünneplő hang - sikeres megoldás (fanfár + taps-szerű zaj)
    'cheer'() {
      const c = getCtx(); if (!c) return;
      const t = c.currentTime;

      // Felfelé szökő győzelmi fanfár
      [[523,0],[659,0.09],[784,0.18],[1046,0.27]].forEach(([freq, delay]) => {
        osc(freq, 'triangle', t + delay, 0.22, 0.22);
      });
      osc(1046, 'sine', t + 0.27, 0.5, 0.28);
      osc(1318, 'sine', t + 0.35, 0.45, 0.18);

      // "Taps" szimuláció - sorozat random zaj-impulzusokból
      for (let i = 0; i < 14; i++) {
        const delay = 0.05 + Math.random() * 0.9;
        const dur = 0.04 + Math.random() * 0.03;
        noiseBurst(t + delay, dur, 0.16, 2500 + Math.random() * 2000);
      }
      // Második hullám taps, kicsit később, sűrűbben
      for (let i = 0; i < 10; i++) {
        const delay = 0.6 + Math.random() * 0.5;
        const dur = 0.03 + Math.random() * 0.02;
        noiseBurst(t + delay, dur, 0.14, 3000 + Math.random() * 1500);
      }
    }
  };

  function play(key) {
    if (!enabled) return;
    try { if (SYNTH[key]) SYNTH[key](); } catch(e) {}
  }

  function setVolume(v) {
    masterVolume = Math.max(0, Math.min(1, v));
    localStorage.setItem('act_volume', masterVolume);
  }
  function setEnabled(v) {
    enabled = v;
    localStorage.setItem('act_sound', v ? 'true' : 'false');
  }
  function getVolume() { return masterVolume; }
  function isEnabled() { return enabled; }

  return { play, setVolume, setEnabled, getVolume, isEnabled };
})();
