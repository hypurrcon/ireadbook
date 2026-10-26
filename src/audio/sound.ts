/**
 * All sounds are synthesised with the Web Audio API: no audio files, works offline.
 * Categories have separate volumes: ui, book, ambience, reward.
 */
export type Sfx = 'tap' | 'open' | 'close' | 'bookOut' | 'bookIn' | 'pageFlip' | 'reward' | 'tick' | 'start' | 'stop' | 'error';
export type Layer = 'rain' | 'hum' | 'wind' | 'crackle' | 'chimes' | 'birds' | 'clock' | 'ocean' | 'train' | 'cafe' | 'synth' | 'bubbles';
export interface AmbienceRecipe { layers: Layer[] }
export interface Volumes { ui: number; book: number; ambience: number; reward: number }

const CATEGORY: Record<Sfx, keyof Volumes> = {
  tap: 'ui', open: 'ui', close: 'ui', tick: 'ui', error: 'ui',
  bookOut: 'book', bookIn: 'book', pageFlip: 'book', start: 'book', stop: 'book',
  reward: 'reward',
};

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let vols: Volumes = { ui: 0.6, book: 0.8, ambience: 0.5, reward: 0.8 };
let muted = false;
let noiseBuf: AudioBuffer | null = null;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const C = window.AudioContext || (window as any).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

/** Call from the first user gesture (iOS needs it). */
export function unlockAudio() { ac(); }

export function setVolumes(v: Volumes) {
  vols = v;
  if (amb.gain && ctx) amb.gain.gain.setTargetAtTime(v.ambience * 0.5, ctx.currentTime, 0.3);
}
export function setMuted(m: boolean) { muted = m; }

function noise(c: AudioContext): AudioBuffer {
  if (noiseBuf) return noiseBuf;
  const len = c.sampleRate * 2;
  noiseBuf = c.createBuffer(1, len, c.sampleRate);
  const d = noiseBuf.getChannelData(0);
  // pink-ish noise (Paul Kellet)
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  return noiseBuf;
}

function env(c: AudioContext, out: AudioNode, t: number, peak: number, attack: number, decay: number) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  g.connect(out);
  return g;
}

function tone(c: AudioContext, out: AudioNode, t: number, freq: number, type: OscillatorType, peak: number, attack: number, decay: number, glideTo?: number) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + attack + decay);
  o.connect(env(c, out, t, peak, attack, decay));
  o.start(t);
  o.stop(t + attack + decay + 0.05);
}

function burst(c: AudioContext, out: AudioNode, t: number, dur: number, peak: number, filter: BiquadFilterType, freq: number, q = 1, freqTo?: number) {
  const s = c.createBufferSource();
  s.buffer = noise(c);
  s.loop = true;
  const f = c.createBiquadFilter();
  f.type = filter; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, t + dur);
  s.connect(f);
  f.connect(env(c, out, t, peak, Math.min(0.02, dur / 3), dur));
  s.start(t, Math.random());
  s.stop(t + dur + 0.1);
}

export function sfx(name: Sfx) {
  if (muted) return;
  const v = vols[CATEGORY[name]];
  if (v <= 0) return;
  const c = ac();
  if (!c || !master) return;
  const out = c.createGain();
  out.gain.value = v;
  out.connect(master);
  const t = c.currentTime + 0.005;
  switch (name) {
    case 'tap': tone(c, out, t, 1650, 'sine', 0.06, 0.002, 0.045); break;
    case 'tick': tone(c, out, t, 2400, 'square', 0.015, 0.001, 0.02); break;
    case 'open': burst(c, out, t, 0.18, 0.12, 'bandpass', 700, 0.8, 2200); break;
    case 'close': burst(c, out, t, 0.16, 0.1, 'bandpass', 2000, 0.8, 600); break;
    case 'error': tone(c, out, t, 220, 'triangle', 0.12, 0.005, 0.18, 180); break;
    case 'bookOut':
      burst(c, out, t, 0.28, 0.22, 'bandpass', 900, 1.2, 1600);
      tone(c, out, t + 0.22, 140, 'sine', 0.18, 0.004, 0.12, 90);
      break;
    case 'bookIn':
      burst(c, out, t, 0.22, 0.2, 'bandpass', 1500, 1.2, 800);
      tone(c, out, t + 0.2, 110, 'sine', 0.25, 0.003, 0.14, 70);
      break;
    case 'pageFlip':
      for (let i = 0; i < 5; i++) burst(c, out, t + i * 0.035 + Math.random() * 0.01, 0.05, 0.16 - i * 0.02, 'highpass', 1800 + i * 300, 0.7);
      burst(c, out, t + 0.16, 0.12, 0.08, 'bandpass', 3500, 0.6, 1500);
      break;
    case 'start':
      tone(c, out, t, 392, 'sine', 0.16, 0.01, 0.9);
      tone(c, out, t, 784, 'sine', 0.05, 0.01, 0.6);
      break;
    case 'stop':
      tone(c, out, t, 523.25, 'sine', 0.14, 0.01, 0.4);
      tone(c, out, t + 0.16, 392, 'sine', 0.14, 0.01, 0.7);
      break;
    case 'reward':
      [1046.5, 1318.5, 1568, 2093].forEach((f, i) => {
        tone(c, out, t + i * 0.09, f, 'triangle', 0.12, 0.004, 0.7);
        tone(c, out, t + i * 0.09, f * 2.01, 'sine', 0.03, 0.004, 0.4);
      });
      break;
  }
}

export function haptic(ms: number | number[] = 8) {
  try { navigator.vibrate?.(ms); } catch { /* not supported */ }
}

// ---------- ambience ----------
const amb: { gain: GainNode | null; nodes: AudioNode[]; timers: number[]; key: string } = { gain: null, nodes: [], timers: [], key: '' };

function loopNoise(c: AudioContext, out: AudioNode, type: BiquadFilterType, freq: number, q: number, level: number) {
  const s = c.createBufferSource();
  s.buffer = noise(c); s.loop = true;
  const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain(); g.gain.value = level;
  s.connect(f); f.connect(g); g.connect(out);
  s.start(0, Math.random() * 1.5);
  amb.nodes.push(s, f, g);
  return { src: s, filter: f, gain: g };
}

function lfo(c: AudioContext, param: AudioParam, rate: number, depth: number) {
  const o = c.createOscillator(); o.frequency.value = rate;
  const g = c.createGain(); g.gain.value = depth;
  o.connect(g); g.connect(param); o.start();
  amb.nodes.push(o, g);
}

function every(minMs: number, maxMs: number, fn: () => void) {
  const run = () => {
    fn();
    amb.timers.push(window.setTimeout(run, minMs + Math.random() * (maxMs - minMs)));
  };
  amb.timers.push(window.setTimeout(run, Math.random() * maxMs));
}

const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66];

function buildLayer(c: AudioContext, out: GainNode, layer: Layer) {
  switch (layer) {
    case 'rain': {
      loopNoise(c, out, 'lowpass', 2400, 0.5, 0.55);
      loopNoise(c, out, 'highpass', 5000, 0.4, 0.08);
      every(40, 160, () => burst(c, out, c.currentTime, 0.02, 0.05 * Math.random(), 'bandpass', 2500 + Math.random() * 3000, 4));
      break;
    }
    case 'hum': {
      for (const [f, l] of [[55, 0.06], [110, 0.025], [165.4, 0.01]] as const) {
        const o = c.createOscillator(); o.frequency.value = f;
        const g = c.createGain(); g.gain.value = l;
        o.connect(g); g.connect(out); o.start(); amb.nodes.push(o, g);
      }
      loopNoise(c, out, 'lowpass', 300, 0.7, 0.15);
      break;
    }
    case 'wind': {
      const n = loopNoise(c, out, 'bandpass', 500, 1.5, 0.5);
      lfo(c, n.filter.frequency, 0.07, 260);
      lfo(c, n.gain.gain, 0.11, 0.25);
      break;
    }
    case 'crackle':
      every(60, 420, () => burst(c, out, c.currentTime, 0.008 + Math.random() * 0.02, 0.05 + Math.random() * 0.12, 'highpass', 1800, 0.5));
      loopNoise(c, out, 'lowpass', 400, 0.7, 0.05);
      break;
    case 'chimes':
      every(2500, 7000, () => {
        const t = c.currentTime;
        const n = 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) tone(c, out, t + i * 0.18 + Math.random() * 0.1, PENTA[Math.floor(Math.random() * PENTA.length)] * 2, 'sine', 0.035, 0.003, 2.5);
      });
      break;
    case 'birds':
      every(1800, 6000, () => {
        const t = c.currentTime;
        const base = 2500 + Math.random() * 1500;
        const n = 2 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) tone(c, out, t + i * 0.11, base, 'sine', 0.03, 0.01, 0.07, base * (1.2 + Math.random() * 0.4));
      });
      loopNoise(c, out, 'bandpass', 900, 0.6, 0.12);
      break;
    case 'clock':
      every(1000, 1000, () => tone(c, out, c.currentTime, 3200, 'square', 0.006, 0.001, 0.015));
      break;
    case 'ocean': {
      const n = loopNoise(c, out, 'lowpass', 420, 0.8, 0.5);
      lfo(c, n.gain.gain, 0.08, 0.3);
      lfo(c, n.filter.frequency, 0.05, 160);
      break;
    }
    case 'bubbles':
      every(500, 2600, () => {
        const t = c.currentTime;
        const f = 500 + Math.random() * 700;
        tone(c, out, t, f, 'sine', 0.03, 0.005, 0.06, f * 1.8);
      });
      break;
    case 'train': {
      loopNoise(c, out, 'lowpass', 180, 0.8, 0.6);
      let k = 0;
      every(430, 430, () => {
        k++;
        if (k % 4 < 2) burst(c, out, c.currentTime, 0.06, 0.14, 'lowpass', 600, 1);
      });
      break;
    }
    case 'cafe': {
      const n = loopNoise(c, out, 'bandpass', 520, 1.1, 0.35);
      lfo(c, n.gain.gain, 0.6, 0.12);
      every(3000, 9000, () => tone(c, out, c.currentTime, 2800 + Math.random() * 900, 'sine', 0.02, 0.002, 0.35));
      break;
    }
    case 'synth': {
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; f.Q.value = 3;
      const g = c.createGain(); g.gain.value = 0.035;
      f.connect(g); g.connect(out);
      for (const fr of [110, 164.81, 220.6, 261.63]) {
        const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.detune.value = Math.random() * 12 - 6;
        o.connect(f); o.start(); amb.nodes.push(o);
      }
      lfo(c, f.frequency, 0.05, 350);
      amb.nodes.push(f, g);
      break;
    }
  }
}

export function playAmbience(recipe: AmbienceRecipe) {
  const key = recipe.layers.join(',');
  if (amb.key === key && amb.gain) return;
  stopAmbience();
  const c = ac();
  if (!c || !master || !recipe.layers.length) return;
  const g = c.createGain();
  g.gain.value = 0.0001;
  g.connect(master);
  amb.gain = g;
  amb.key = key;
  for (const l of recipe.layers) buildLayer(c, g, l);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, vols.ambience * 0.5), c.currentTime + 1.5);
}

export function stopAmbience() {
  const c = ctx;
  amb.timers.forEach((t) => clearTimeout(t));
  amb.timers = [];
  const nodes = amb.nodes, g = amb.gain;
  amb.nodes = []; amb.gain = null; amb.key = '';
  if (c && g) {
    g.gain.setTargetAtTime(0.0001, c.currentTime, 0.25);
    setTimeout(() => {
      for (const n of nodes) { try { (n as any).stop?.(); } catch { /* already stopped */ } n.disconnect(); }
      g.disconnect();
    }, 1200);
  }
}
