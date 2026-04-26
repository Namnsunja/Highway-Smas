// Tiny synthesized sound engine — no external assets, pure WebAudio.
// All sounds are procedurally generated for zero file size & instant load.

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private muted = false;
  private started = false;

  // Background music
  private musicGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private musicLevel = 1;
  private musicBeat = 0;

  constructor(muted = false) {
    this.muted = muted;
  }

  private ensure() {
    if (!this.started) return;
    if (this.ctx) return;
    try {
      const Ctx =
        (window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) ||
        null;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  /** Must be called from a user gesture (click/touch). */
  start() {
    this.started = true;
    this.ensure();
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => undefined);
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.55;
  }

  /** Continuous engine drone whose pitch tracks speed. */
  startEngine() {
    this.ensure();
    if (!this.ctx || !this.master || this.engineOsc) return;
    const osc = this.ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 70;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 480;
    filter.Q.value = 6;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.0;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start();
    this.engineOsc = osc;
    this.engineGain = gain;
    this.engineFilter = filter;
  }

  stopEngine() {
    if (this.engineOsc) {
      try {
        this.engineOsc.stop();
      } catch {
        /* ignore */
      }
      this.engineOsc.disconnect();
      this.engineOsc = null;
    }
    if (this.engineGain) {
      this.engineGain.disconnect();
      this.engineGain = null;
    }
    if (this.engineFilter) {
      this.engineFilter.disconnect();
      this.engineFilter = null;
    }
  }

  /** speed01 = 0..1, boost = 0/1 */
  setEngineParams(speed01: number, boost: number) {
    if (!this.engineOsc || !this.engineGain || !this.engineFilter || !this.ctx) return;
    const t = this.ctx.currentTime;
    const targetFreq = 60 + speed01 * 220 + boost * 90;
    const targetCutoff = 380 + speed01 * 1400 + boost * 800;
    const targetGain = 0.05 + speed01 * 0.16 + boost * 0.12;
    this.engineOsc.frequency.linearRampToValueAtTime(targetFreq, t + 0.08);
    this.engineFilter.frequency.linearRampToValueAtTime(targetCutoff, t + 0.08);
    this.engineGain.gain.linearRampToValueAtTime(targetGain, t + 0.08);
  }

  /** Crash thump + metallic noise. magnitude 0..1 */
  crash(magnitude = 0.6) {
    this.ensure();
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;

    // Low thump
    const thumpOsc = this.ctx.createOscillator();
    thumpOsc.type = "sine";
    thumpOsc.frequency.setValueAtTime(160, t);
    thumpOsc.frequency.exponentialRampToValueAtTime(40, t + 0.18);
    const thumpGain = this.ctx.createGain();
    thumpGain.gain.setValueAtTime(0.0001, t);
    thumpGain.gain.exponentialRampToValueAtTime(0.6 * magnitude, t + 0.01);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    thumpOsc.connect(thumpGain);
    thumpGain.connect(this.master);
    thumpOsc.start(t);
    thumpOsc.stop(t + 0.45);

    // Metallic noise burst
    const dur = 0.25;
    const buffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * dur), this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 1800 + magnitude * 1200;
    noiseFilter.Q.value = 1.2;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.value = 0.45 * magnitude;
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.master);
    noise.start(t);
  }

  /** Big boom for chain reactions / nitro detonations. */
  explosion(power = 1) {
    this.ensure();
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;

    // Sub bass
    const sub = this.ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.setValueAtTime(110, t);
    sub.frequency.exponentialRampToValueAtTime(28, t + 0.55);
    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(0.0001, t);
    subGain.gain.exponentialRampToValueAtTime(0.85 * power, t + 0.02);
    subGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    sub.connect(subGain);
    subGain.connect(this.master);
    sub.start(t);
    sub.stop(t + 0.75);

    // Noise blast
    const dur = 0.6;
    const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * dur), this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const env = Math.pow(1 - i / data.length, 1.6);
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;
    const flt = this.ctx.createBiquadFilter();
    flt.type = "lowpass";
    flt.frequency.setValueAtTime(2200, t);
    flt.frequency.exponentialRampToValueAtTime(220, t + 0.55);
    const ng = this.ctx.createGain();
    ng.gain.value = 0.55 * power;
    noise.connect(flt);
    flt.connect(ng);
    ng.connect(this.master);
    noise.start(t);
  }

  /** Quick coin/scrap pickup blip */
  pickup(pitch = 1) {
    this.ensure();
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(880 * pitch, t);
    o.frequency.exponentialRampToValueAtTime(1400 * pitch, t + 0.08);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + 0.2);
  }

  /** Powerup grab swoosh */
  powerup() {
    this.ensure();
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(1200, t + 0.32);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    const flt = this.ctx.createBiquadFilter();
    flt.type = "bandpass";
    flt.frequency.value = 900;
    flt.Q.value = 4;
    o.connect(flt);
    flt.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + 0.45);
  }

  /** Nitro woosh */
  nitro() {
    this.ensure();
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const dur = 0.55;
    const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * dur), this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;
    const flt = this.ctx.createBiquadFilter();
    flt.type = "highpass";
    flt.frequency.setValueAtTime(400, t);
    flt.frequency.exponentialRampToValueAtTime(2400, t + 0.45);
    const g = this.ctx.createGain();
    g.gain.value = 0.3;
    noise.connect(flt);
    flt.connect(g);
    g.connect(this.master);
    noise.start(t);
  }

  /** Start the looping synthwave background music. Loops until stopMusic(). */
  startMusic(level = 1) {
    this.ensure();
    if (!this.ctx || !this.master) return;
    this.musicLevel = level;
    if (this.musicGain || this.musicTimer !== null) return; // already playing
    const gain = this.ctx.createGain();
    gain.gain.value = 0.18;
    gain.connect(this.master);
    this.musicGain = gain;
    this.musicBeat = 0;

    const bpm = 110;
    const beatDur = 60 / bpm;

    // Schedule the next bar a bit ahead so timing is rock-solid
    const tick = () => {
      if (!this.ctx || !this.musicGain) return;
      const t = this.ctx.currentTime + 0.04;
      const lvl = Math.max(0, Math.min(4, this.musicLevel - 1));
      // Root note Hz per level (different musical key for each theme)
      const roots = [82.4, 110, 87.3, 98, 65.4]; // E, A, F, G, C
      const root = roots[lvl]!;
      const arp = [0, 12, 7, 12, 0, 15, 7, 10]; // 8-step bass arp pattern
      const beat = this.musicBeat;
      const semi = arp[beat % arp.length]!;
      const f = root * Math.pow(2, semi / 12);

      // ---- Bass note ----
      const bo = this.ctx.createOscillator();
      bo.type = "sawtooth";
      bo.frequency.value = f;
      const bg = this.ctx.createGain();
      bg.gain.setValueAtTime(0.0001, t);
      bg.gain.exponentialRampToValueAtTime(0.42, t + 0.01);
      bg.gain.exponentialRampToValueAtTime(0.0001, t + beatDur * 0.7);
      const bf = this.ctx.createBiquadFilter();
      bf.type = "lowpass";
      bf.frequency.value = 520 + lvl * 140;
      bf.Q.value = 4;
      bo.connect(bf);
      bf.connect(bg);
      bg.connect(this.musicGain);
      bo.start(t);
      bo.stop(t + beatDur * 0.85);

      // ---- Kick drum on beats 0, 2, 4, 6 (every other) ----
      if (beat % 2 === 0) {
        const ko = this.ctx.createOscillator();
        ko.type = "sine";
        ko.frequency.setValueAtTime(130, t);
        ko.frequency.exponentialRampToValueAtTime(42, t + 0.16);
        const kg = this.ctx.createGain();
        kg.gain.setValueAtTime(0.0001, t);
        kg.gain.exponentialRampToValueAtTime(0.7, t + 0.005);
        kg.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
        ko.connect(kg);
        kg.connect(this.musicGain);
        ko.start(t);
        ko.stop(t + 0.32);
      }

      // ---- Snare-ish noise on beats 1, 3, 5, 7 ----
      if (beat % 4 === 2) {
        const dur = 0.18;
        const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * dur), this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 1.5);
        }
        const n = this.ctx.createBufferSource();
        n.buffer = buf;
        const sf = this.ctx.createBiquadFilter();
        sf.type = "bandpass";
        sf.frequency.value = 1800;
        sf.Q.value = 1.4;
        const sg = this.ctx.createGain();
        sg.gain.value = 0.32;
        n.connect(sf);
        sf.connect(sg);
        sg.connect(this.musicGain);
        n.start(t);
      }

      // ---- Hi-hat tick every beat ----
      {
        const dur = 0.05;
        const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * dur), this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
        }
        const n = this.ctx.createBufferSource();
        n.buffer = buf;
        const hf = this.ctx.createBiquadFilter();
        hf.type = "highpass";
        hf.frequency.value = 7000;
        const hg = this.ctx.createGain();
        hg.gain.value = beat % 2 === 1 ? 0.18 : 0.10;
        n.connect(hf);
        hf.connect(hg);
        hg.connect(this.musicGain);
        n.start(t);
      }

      // ---- Pad chord on beat 0 of each 8-beat bar ----
      if (beat % 8 === 0) {
        // minor 7 chord: 0, 3, 7, 10 semitones above root*2
        const padBase = root * 2;
        const intervals = [0, 3, 7, 10];
        for (const semitone of intervals) {
          const pf = padBase * Math.pow(2, semitone / 12);
          const po = this.ctx.createOscillator();
          po.type = "triangle";
          po.frequency.value = pf;
          const pg = this.ctx.createGain();
          pg.gain.setValueAtTime(0.0001, t);
          pg.gain.linearRampToValueAtTime(0.06, t + 0.5);
          pg.gain.exponentialRampToValueAtTime(0.0001, t + beatDur * 8 * 0.92);
          po.connect(pg);
          pg.connect(this.musicGain);
          po.start(t);
          po.stop(t + beatDur * 8);
        }
      }

      // ---- Lead arpeggio on higher levels ----
      if (lvl >= 2) {
        const lo = this.ctx.createOscillator();
        lo.type = "square";
        lo.frequency.value = root * 4 * Math.pow(2, semi / 12);
        const lg = this.ctx.createGain();
        lg.gain.setValueAtTime(0.0001, t);
        lg.gain.exponentialRampToValueAtTime(0.05 + lvl * 0.012, t + 0.005);
        lg.gain.exponentialRampToValueAtTime(0.0001, t + beatDur * 0.45);
        const lf = this.ctx.createBiquadFilter();
        lf.type = "lowpass";
        lf.frequency.value = 2200 + lvl * 600;
        lo.connect(lf);
        lf.connect(lg);
        lg.connect(this.musicGain);
        lo.start(t);
        lo.stop(t + beatDur * 0.5);
      }

      this.musicBeat = (this.musicBeat + 1) % 64;
    };

    tick();
    this.musicTimer = window.setInterval(tick, beatDur * 1000);
  }

  /** Stop the background music. */
  stopMusic() {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (this.musicGain && this.ctx) {
      const g = this.musicGain;
      const t = this.ctx.currentTime;
      try {
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(g.gain.value, t);
        g.gain.linearRampToValueAtTime(0, t + 0.25);
        setTimeout(() => {
          try { g.disconnect(); } catch { /* ignore */ }
        }, 350);
      } catch {
        try { g.disconnect(); } catch { /* ignore */ }
      }
      this.musicGain = null;
    }
    this.musicBeat = 0;
  }

  /** Update the music's musical key/intensity to match the level. */
  setMusicLevel(level: number) {
    this.musicLevel = level;
  }

  /** UI click */
  uiClick() {
    this.ensure();
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = "square";
    o.frequency.value = 720;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + 0.07);
  }
}
