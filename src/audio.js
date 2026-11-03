// Synthesized sound: no audio files. Engine, water, wind, horn, thump and chimes are built from oscillators and
// filtered noise. The context is created on the first player gesture (browsers refuse to play before that).
import { engineParams, waterParams, windParams, impactParams, hornPitch, masterLevel } from './sim/audiomap.js';

export function createAudio({ volume = 0.6, muted = false } = {}) {
  let ctx = null;
  let nodes = null;
  let level = { volume, muted };
  const api = {
    get state() { return ctx ? ctx.state : 'none'; },
    get ready() { return !!nodes; },
    // Debug/test view of the live levels (not used by the game).
    snapshot() { return nodes ? { master: nodes.master.gain.value, engine: nodes.engineGain.gain.value, water: nodes.waterGain.gain.value, wind: nodes.windGain.gain.value, freq: nodes.osc1.frequency.value } : null; },

    // Call from a user gesture. Safe to call again.
    unlock() {
      if (nodes) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return true; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      try { ctx = new AC(); } catch { return false; }
      const master = ctx.createGain();
      master.gain.value = masterLevel(level.volume, level.muted);
      master.connect(ctx.destination);

      // engine: two oscillators through a low-pass, with a slow tremolo for the throb
      const engineGain = ctx.createGain(); engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter(); engineFilter.type = 'lowpass'; engineFilter.frequency.value = 400;
      const osc1 = ctx.createOscillator(); osc1.type = 'sawtooth'; osc1.frequency.value = 60;
      const osc2 = ctx.createOscillator(); osc2.type = 'square'; osc2.frequency.value = 30;
      const o2g = ctx.createGain(); o2g.gain.value = 0.5;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 7;
      const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.18;
      const tremolo = ctx.createGain(); tremolo.gain.value = 0.82;
      lfo.connect(lfoGain); lfoGain.connect(tremolo.gain);
      osc1.connect(engineFilter); osc2.connect(o2g); o2g.connect(engineFilter);
      engineFilter.connect(tremolo); tremolo.connect(engineGain); engineGain.connect(master);
      osc1.start(); osc2.start(); lfo.start();

      // water and wind: looping filtered noise
      const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const noise = (type, freq) => {
        const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
        const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
        const g = ctx.createGain(); g.gain.value = 0;
        src.connect(f); f.connect(g); g.connect(master); src.start();
        return { f, g };
      };
      const water = noise('lowpass', 800);
      const wind = noise('bandpass', 700);
      nodes = { master, engineGain, engineFilter, osc1, osc2, waterGain: water.g, waterFilter: water.f, windGain: wind.g, windFilter: wind.f, buf };
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    },

    setLevel(next) {
      level = { ...level, ...next };
      if (nodes) nodes.master.gain.setTargetAtTime(masterLevel(level.volume, level.muted), ctx.currentTime, 0.05);
    },

    // Per-frame: state = { playing, vessel, throttle, speed, waveHs, windSpeed }
    update(state) {
      if (!nodes) return;
      const t = ctx.currentTime;
      if (!state.playing) {
        for (const g of [nodes.engineGain, nodes.waterGain, nodes.windGain]) g.gain.setTargetAtTime(0, t, 0.15);
        return;
      }
      const e = engineParams(state.vessel, state.throttle, state.speed);
      nodes.osc1.frequency.setTargetAtTime(e.freq, t, 0.12);
      nodes.osc2.frequency.setTargetAtTime(e.freq * 0.5, t, 0.12);
      nodes.engineFilter.frequency.setTargetAtTime(e.cutoff, t, 0.12);
      nodes.engineGain.gain.setTargetAtTime(e.gain, t, 0.1);
      const w = waterParams(state.vessel, state.speed, state.waveHs);
      nodes.waterGain.gain.setTargetAtTime(w.gain, t, 0.2);
      nodes.waterFilter.frequency.setTargetAtTime(w.cutoff, t, 0.2);
      const wi = windParams(state.windSpeed);
      nodes.windGain.gain.setTargetAtTime(wi.gain, t, 0.5);
      nodes.windFilter.frequency.setTargetAtTime(wi.cutoff, t, 0.5);
    },

    // One-shot sounds. kind: horn | thump | chime | fail | ping | beep | creak
    play(kind, arg) {
      if (!nodes || ctx.state !== 'running') return;
      const t = ctx.currentTime;
      const tone = (type, freq, start, dur, gain, endFreq) => {
        const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t + start);
        if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + start + dur);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t + start);
        g.gain.exponentialRampToValueAtTime(gain, t + start + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t + start + dur);
        o.connect(g); g.connect(nodes.master); o.start(t + start); o.stop(t + start + dur + 0.05);
      };
      if (kind === 'horn') {
        const f = hornPitch(arg);
        tone('sawtooth', f, 0, 0.9, 0.14); tone('sawtooth', f * 1.25, 0, 0.9, 0.1);
      } else if (kind === 'thump') {
        const p = impactParams(arg || 2);
        tone('sine', 120, 0, p.seconds, p.gain, 35);
        const src = ctx.createBufferSource(); src.buffer = nodes.buf;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600;
        const g = ctx.createGain(); g.gain.setValueAtTime(p.gain * 0.8, t); g.gain.exponentialRampToValueAtTime(0.0001, t + p.seconds);
        src.connect(f); f.connect(g); g.connect(nodes.master); src.start(t, Math.random()); src.stop(t + p.seconds + 0.05);
      } else if (kind === 'chime') {
        tone('sine', 660, 0, 0.5, 0.16); tone('sine', 880, 0.18, 0.5, 0.16); tone('sine', 1320, 0.36, 0.8, 0.14);
      } else if (kind === 'fail') {
        tone('sine', 330, 0, 0.5, 0.16); tone('sine', 247, 0.3, 0.9, 0.16);
      } else if (kind === 'ping') {
        tone('sine', 988, 0, 0.25, 0.08);
      } else if (kind === 'beep') {
        tone('square', 880, 0, 0.12, 0.05); tone('square', 880, 0.2, 0.12, 0.05);
      } else if (kind === 'creak') {
        tone('sawtooth', 140, 0, 0.5, 0.05, 90);
      }
    },

    suspend() { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); },
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
  };
  return api;
}
