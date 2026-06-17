export class AudioEngine {
  private ctx: AudioContext | null = null;

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  unlock(): void {
    this.ensureContext();
  }

  playVacuum(): void {
    const ctx = this.ensureContext();
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.35);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, t);
    filter.frequency.exponentialRampToValueAtTime(300, t + 0.35);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  playMorph(index: number, total: number): void {
    const ctx = this.ensureContext();
    const t = ctx.currentTime;
    const spread = total > 1 ? index / (total - 1) : 0.5;
    const baseFreq = 520 + spread * 280;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(baseFreq, t);
    osc1.frequency.exponentialRampToValueAtTime(baseFreq * 1.6, t + 0.18);
    osc2.frequency.setValueAtTime(baseFreq * 1.5, t);
    osc2.frequency.exponentialRampToValueAtTime(baseFreq * 2.2, t + 0.22);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.09, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.36);
    osc2.stop(t + 0.36);

    // Sparkle noise burst
    const bufferSize = Math.floor(ctx.sampleRate * 0.08);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 4000;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.04, t + 0.05);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(t + 0.05);
    noise.stop(t + 0.15);
  }

  playCompletion(): void {
    const ctx = this.ensureContext();
    const t = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = t + i * 0.09;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.1, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.55);
    });
  }

  playTap(): void {
    const ctx = this.ensureContext();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(380, t);
    osc.frequency.exponentialRampToValueAtTime(280, t + 0.08);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.06, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.12);
  }
}
