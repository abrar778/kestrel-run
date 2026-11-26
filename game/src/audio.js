// Kestrel Run — the sound. Everything is generated with WebAudio: the
// engine hum follows the throttle, the wind follows the speed, and the
// chimes, thuds and booms are short synth bursts. No audio files.
// One job: what the Kestrel sounds like.

export class FlightAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.engineOsc = null;
    this.engineOsc2 = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.windSource = null;
    this.windGain = null;
    this.windFilter = null;
    this.muted = false;
    this.started = false;
  }

  // Browsers only let audio start after a gesture; call this from one.
  ensure() {
    if (this.started) {
      if (this.context && this.context.state === 'suspended') this.context.resume();
      return;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      this.context = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(ctx.destination);

      // Engine: two detuned saws through a lowpass, pitch follows throttle.
      this.engineFilter = ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 420;
      this.engineFilter.connect(this.master);
      this.engineGain = ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineGain.connect(this.engineFilter);
      this.engineOsc = ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineOsc.connect(this.engineGain);
      this.engineOsc2 = ctx.createOscillator();
      this.engineOsc2.type = 'sawtooth';
      this.engineOsc2.frequency.value = 55 * 1.5;
      this.engineOsc2.connect(this.engineGain);
      this.engineOsc.start();
      this.engineOsc2.start();

      // Wind: looped noise through a bandpass, loudness follows airspeed.
      const noiseLength = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, noiseLength, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < noiseLength; i += 1) data[i] = Math.random() * 2 - 1;
      this.windSource = ctx.createBufferSource();
      this.windSource.buffer = noiseBuffer;
      this.windSource.loop = true;
      this.windFilter = ctx.createBiquadFilter();
      this.windFilter.type = 'bandpass';
      this.windFilter.frequency.value = 900;
      this.windFilter.Q.value = 0.6;
      this.windGain = ctx.createGain();
      this.windGain.gain.value = 0;
      this.windSource.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.master);
      this.windSource.start();
      this.started = true;
    } catch (e) {
      this.context = null;
    }
  }

  // Called every frame with the plane's state.
  update(plane) {
    if (!this.started || !this.context) return;
    const t = this.context.currentTime;
    const throttle = plane.throttle;
    const engineLevel = plane.state === 'crashed' ? 0 : 0.05 + throttle * 0.16;
    this.engineGain.gain.setTargetAtTime(engineLevel, t, 0.1);
    const freq = 42 + throttle * 95 + plane.speed * 0.35;
    this.engineOsc.frequency.setTargetAtTime(freq, t, 0.08);
    this.engineOsc2.frequency.setTargetAtTime(freq * 1.5, t, 0.08);
    this.engineFilter.frequency.setTargetAtTime(320 + throttle * 900, t, 0.1);
    const windLevel = plane.state === 'crashed' ? 0 : Math.min(0.22, plane.speed * 0.0032);
    this.windGain.gain.setTargetAtTime(windLevel, t, 0.15);
    this.windFilter.frequency.setTargetAtTime(500 + plane.speed * 14, t, 0.15);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, this.context.currentTime, 0.05);
    }
    return this.muted;
  }

  // Short synth bursts for game events.
  blip(freq, duration, type, volume) {
    if (!this.started || !this.context) return;
    const ctx = this.context;
    const osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume || 0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
  }

  noiseBurst(duration, volume, filterFreq) {
    if (!this.started || !this.context) return;
    const ctx = this.context;
    const length = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 800;
    const gain = ctx.createGain();
    gain.gain.value = volume || 0.4;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();
  }

  ringChime() {
    this.blip(659, 0.16, 'sine', 0.3);
    setTimeout(() => this.blip(880, 0.28, 'sine', 0.3), 90);
  }

  click() {
    this.blip(1200, 0.05, 'square', 0.12);
  }

  touchdown() {
    this.noiseBurst(0.25, 0.5, 500);
    this.blip(90, 0.3, 'sine', 0.4);
  }

  hardLanding() {
    this.noiseBurst(0.4, 0.6, 350);
    this.blip(70, 0.4, 'sine', 0.5);
  }

  crash() {
    this.noiseBurst(0.9, 0.8, 300);
    this.blip(48, 0.9, 'sine', 0.6);
    setTimeout(() => this.noiseBurst(0.7, 0.5, 200), 150);
  }

  fanfare() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => this.blip(freq, 0.3, 'sine', 0.3), i * 130);
    });
  }
}
