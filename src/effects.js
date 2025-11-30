/**
 * Effects Module - Individual effect processors for the FX chain
 * Each effect has wet/dry control (0-99 maps to mix amount)
 */

/**
 * Reverb - Convolution-style reverb using feedback delay network
 */
export class Reverb {
  constructor(ctx) {
    this.ctx = ctx;
    
    // Input/output
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.wetGain = ctx.createGain();
    this.dryGain = ctx.createGain();
    
    // Simple algorithmic reverb using parallel delays with feedback
    this.preDelay = ctx.createDelay(0.1);
    this.preDelay.delayTime.value = 0.02;
    
    // Create 4 parallel delay lines with prime-number-ish delays
    this.delays = [];
    this.feedbacks = [];
    const delayTimes = [0.037, 0.041, 0.053, 0.067];
    
    for (let i = 0; i < 4; i++) {
      const delay = ctx.createDelay(0.1);
      delay.delayTime.value = delayTimes[i];
      
      const feedback = ctx.createGain();
      feedback.gain.value = 0.7;
      
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 4000 - (i * 500);
      
      this.preDelay.connect(delay);
      delay.connect(filter);
      filter.connect(feedback);
      feedback.connect(delay);
      filter.connect(this.wetGain);
      
      this.delays.push(delay);
      this.feedbacks.push(feedback);
    }
    
    // Wire up
    this.input.connect(this.preDelay);
    this.input.connect(this.dryGain);
    this.wetGain.connect(this.output);
    this.dryGain.connect(this.output);
    
    this.setLevel(0);
  }
  
  setLevel(level) {
    const mix = level / 99;
    this.wetGain.gain.value = mix * 0.7;
    this.dryGain.gain.value = 1 - (mix * 0.4);
    // Soften feedback as mix goes down to avoid mud
    const fb = 0.25 + mix * 0.4;
    this.feedbacks.forEach(fbNode => {
      fbNode.gain.value = fb;
    });
  }
  
  connect(destination) {
    this.output.connect(destination);
  }
  
  disconnect() {
    this.output.disconnect();
  }
}

/**
 * Delay - BPM-synced stereo delay
 */
export class Delay {
  constructor(ctx) {
    this.ctx = ctx;
    this.bpm = 120;
    
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.wetGain = ctx.createGain();
    this.dryGain = ctx.createGain();
    
    // Stereo delay with slightly different times
    this.delayL = ctx.createDelay(2);
    this.delayR = ctx.createDelay(2);
    this.feedbackL = ctx.createGain();
    this.feedbackR = ctx.createGain();
    
    // Filters on feedback path
    this.filterL = ctx.createBiquadFilter();
    this.filterL.type = 'lowpass';
    this.filterL.frequency.value = 3000;
    
    this.filterR = ctx.createBiquadFilter();
    this.filterR.type = 'lowpass';
    this.filterR.frequency.value = 3000;
    
    // Stereo panner
    this.panL = ctx.createStereoPanner();
    this.panL.pan.value = -0.5;
    this.panR = ctx.createStereoPanner();
    this.panR.pan.value = 0.5;
    
    // Wire up left channel
    this.input.connect(this.delayL);
    this.delayL.connect(this.filterL);
    this.filterL.connect(this.feedbackL);
    this.feedbackL.connect(this.delayL);
    this.filterL.connect(this.panL);
    this.panL.connect(this.wetGain);
    
    // Wire up right channel (slightly offset timing)
    this.input.connect(this.delayR);
    this.delayR.connect(this.filterR);
    this.filterR.connect(this.feedbackR);
    this.feedbackR.connect(this.delayR);
    this.filterR.connect(this.panR);
    this.panR.connect(this.wetGain);
    
    // Dry path
    this.input.connect(this.dryGain);
    this.wetGain.connect(this.output);
    this.dryGain.connect(this.output);
    
    this.feedbackL.gain.value = 0.4;
    this.feedbackR.gain.value = 0.4;
    
    this.updateDelayTime();
    this.setLevel(0);
  }
  
  setBpm(bpm) {
    this.bpm = bpm;
    this.updateDelayTime();
  }
  
  updateDelayTime() {
    // 1/8 note delay
    const beatTime = 60 / this.bpm;
    const delayTime = beatTime / 2;
    this.delayL.delayTime.value = delayTime;
    this.delayR.delayTime.value = delayTime * 1.03; // Slight offset for stereo width
  }
  
  setLevel(level) {
    const mix = level / 99;
    this.wetGain.gain.value = mix;
    this.dryGain.gain.value = 1 - (mix * 0.2);
    const fb = mix === 0 ? 0 : (0.15 + (mix * 0.35));
    this.feedbackL.gain.value = fb;
    this.feedbackR.gain.value = fb;
    // Tighten highs a bit for clarity
    const hf = 2200 + (mix * 1200);
    this.filterL.frequency.value = hf;
    this.filterR.frequency.value = hf;
  }
  
  connect(destination) {
    this.output.connect(destination);
  }
  
  disconnect() {
    this.output.disconnect();
  }
}

/**
 * Chorus - Modulated delay for width/shimmer
 */
export class Chorus {
  constructor(ctx) {
    this.ctx = ctx;
    
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.wetGain = ctx.createGain();
    this.dryGain = ctx.createGain();
    
    // Two modulated delays for stereo
    this.delayL = ctx.createDelay(0.05);
    this.delayL.delayTime.value = 0.012;
    this.delayR = ctx.createDelay(0.05);
    this.delayR.delayTime.value = 0.015;
    
    // LFOs
    this.lfoL = ctx.createOscillator();
    this.lfoL.type = 'sine';
    this.lfoL.frequency.value = 0.8;
    this.lfoR = ctx.createOscillator();
    this.lfoR.type = 'sine';
    this.lfoR.frequency.value = 0.9;
    
    this.depthL = ctx.createGain();
    this.depthL.gain.value = 0.003;
    this.depthR = ctx.createGain();
    this.depthR.gain.value = 0.003;
    
    this.lfoL.connect(this.depthL);
    this.depthL.connect(this.delayL.delayTime);
    this.lfoR.connect(this.depthR);
    this.depthR.connect(this.delayR.delayTime);
    
    this.lfoL.start();
    this.lfoR.start();
    
    // Stereo panning
    this.panL = ctx.createStereoPanner();
    this.panL.pan.value = -0.3;
    this.panR = ctx.createStereoPanner();
    this.panR.pan.value = 0.3;
    
    // Wire up
    this.input.connect(this.delayL);
    this.input.connect(this.delayR);
    this.input.connect(this.dryGain);
    
    this.delayL.connect(this.panL);
    this.delayR.connect(this.panR);
    this.panL.connect(this.wetGain);
    this.panR.connect(this.wetGain);
    
    this.wetGain.connect(this.output);
    this.dryGain.connect(this.output);
    
    this.setLevel(0);
  }
  
  setLevel(level) {
    const mix = level / 99;
    this.wetGain.gain.value = mix * 0.5;
    this.dryGain.gain.value = 1 - (mix * 0.2);
    this.depthL.gain.value = 0.0005 + (mix * 0.0035);
    this.depthR.gain.value = 0.0005 + (mix * 0.0035);
  }
  
  connect(destination) {
    this.output.connect(destination);
  }
  
  disconnect() {
    this.output.disconnect();
  }
}

/**
 * Phaser - 4-stage allpass filter sweep
 */
export class Phaser {
  constructor(ctx) {
    this.ctx = ctx;
    
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.wetGain = ctx.createGain();
    this.dryGain = ctx.createGain();
    
    // LFO for sweep
    this.lfo = ctx.createOscillator();
    this.lfo.type = 'sine';
    this.lfo.frequency.value = 0.3;
    this.depth = ctx.createGain();
    this.depth.gain.value = 800;
    this.lfo.connect(this.depth);
    this.lfo.start();
    
    // 4-stage allpass chain
    this.filters = [];
    let lastNode = this.input;
    
    for (let i = 0; i < 4; i++) {
      const allpass = ctx.createBiquadFilter();
      allpass.type = 'allpass';
      allpass.frequency.value = 1000;
      allpass.Q.value = 0.5;
      this.depth.connect(allpass.frequency);
      lastNode.connect(allpass);
      lastNode = allpass;
      this.filters.push(allpass);
    }
    
    // Feedback
    this.feedback = ctx.createGain();
    this.feedback.gain.value = 0.4;
    lastNode.connect(this.feedback);
    this.feedback.connect(this.filters[0]);
    
    // Mix
    lastNode.connect(this.wetGain);
    this.input.connect(this.dryGain);
    this.wetGain.connect(this.output);
    this.dryGain.connect(this.output);
    
    this.setLevel(0);
  }
  
  setLevel(level) {
    const mix = level / 99;
    this.wetGain.gain.value = mix * 0.6;
    this.dryGain.gain.value = 1 - (mix * 0.3);
    this.depth.gain.value = 200 + (mix * 600);
    this.feedback.gain.value = 0.1 + (mix * 0.35);
  }
  
  connect(destination) {
    this.output.connect(destination);
  }
  
  disconnect() {
    this.output.disconnect();
  }
}

/**
 * Flanger - Short modulated delay with feedback for metallic sweep
 */
export class Flanger {
  constructor(ctx) {
    this.ctx = ctx;
    
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.wetGain = ctx.createGain();
    this.dryGain = ctx.createGain();
    
    // Very short delay
    this.delay = ctx.createDelay(0.02);
    this.delay.delayTime.value = 0.003;
    
    // LFO
    this.lfo = ctx.createOscillator();
    this.lfo.type = 'sine';
    this.lfo.frequency.value = 0.2;
    this.depth = ctx.createGain();
    this.depth.gain.value = 0.002;
    this.lfo.connect(this.depth);
    this.depth.connect(this.delay.delayTime);
    this.lfo.start();
    
    // Feedback
    this.feedback = ctx.createGain();
    this.feedback.gain.value = 0.6;
    
    // Wire up
    this.input.connect(this.delay);
    this.delay.connect(this.feedback);
    this.feedback.connect(this.delay);
    this.delay.connect(this.wetGain);
    
    this.input.connect(this.dryGain);
    this.wetGain.connect(this.output);
    this.dryGain.connect(this.output);
    
    this.setLevel(0);
  }
  
  setLevel(level) {
    const mix = level / 99;
    this.wetGain.gain.value = mix * 0.7;
    this.dryGain.gain.value = 1 - (mix * 0.3);
    this.depth.gain.value = 0.0005 + (mix * 0.0025);
    this.feedback.gain.value = 0.2 + (mix * 0.4);
  }
  
  connect(destination) {
    this.output.connect(destination);
  }
  
  disconnect() {
    this.output.disconnect();
  }
}

/**
 * Drive - Soft saturation/distortion
 */
export class Drive {
  constructor(ctx) {
    this.ctx = ctx;
    
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    
    // Pre-gain (drives into saturation)
    this.preGain = ctx.createGain();
    this.preGain.gain.value = 1;
    
    // Waveshaper for saturation
    this.waveshaper = ctx.createWaveShaper();
    this.waveshaper.curve = this.createSaturationCurve(0.4);
    this.waveshaper.oversample = '2x';
    
    // Post-gain (compensate for volume increase)
    this.postGain = ctx.createGain();
    this.postGain.gain.value = 0.8;
    
    // Tone filter (tame highs)
    this.toneFilter = ctx.createBiquadFilter();
    this.toneFilter.type = 'lowpass';
    this.toneFilter.frequency.value = 8000;
    this.toneFilter.Q.value = 0.5;
    
    // Wire up
    this.input.connect(this.preGain);
    this.preGain.connect(this.waveshaper);
    this.waveshaper.connect(this.toneFilter);
    this.toneFilter.connect(this.postGain);
    this.postGain.connect(this.output);
    
    this.setLevel(0);
  }
  
  createSaturationCurve(amount) {
    const samples = 256;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = (Math.PI + amount) * x / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }
  
  setLevel(level) {
    const mix = level / 99;
    const driveAmount = 0.2 + (mix * 1.2);
    this.waveshaper.curve = this.createSaturationCurve(driveAmount);
    this.preGain.gain.value = 1 + (mix * 1.5);
    this.postGain.gain.value = 0.85 / (1 + mix * 0.8);
    this.toneFilter.frequency.value = 10000 - (mix * 5000);
  }
  
  connect(destination) {
    this.output.connect(destination);
  }
  
  disconnect() {
    this.output.disconnect();
  }
}

/**
 * Tremolo - Volume modulation
 */
export class Tremolo {
  constructor(ctx) {
    this.ctx = ctx;
    
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.modulatedGain = ctx.createGain();
    
    // LFO
    this.lfo = ctx.createOscillator();
    this.lfo.type = 'sine';
    this.lfo.frequency.value = 5;
    
    this.depth = ctx.createGain();
    this.depth.gain.value = 0;
    
    // DC offset to keep signal positive
    this.offset = ctx.createConstantSource();
    this.offset.offset.value = 1;
    
    this.lfo.connect(this.depth);
    this.depth.connect(this.modulatedGain.gain);
    this.offset.connect(this.modulatedGain.gain);
    
    this.lfo.start();
    this.offset.start();
    
    // Wire up
    this.input.connect(this.modulatedGain);
    this.modulatedGain.connect(this.output);
    
    this.setLevel(0);
  }
  
  setLevel(level) {
    const mix = level / 99;
    this.depth.gain.value = mix * 0.6;
    this.offset.offset.value = 1 - (mix * 0.3);
    this.lfo.frequency.value = 2 + (mix * 10);
  }
  
  connect(destination) {
    this.output.connect(destination);
  }
  
  disconnect() {
    this.output.disconnect();
  }
}

/**
 * Ensemble - Rich multi-voice chorus (Solina-style)
 */
export class Ensemble {
  constructor(ctx) {
    this.ctx = ctx;
    
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.wetGain = ctx.createGain();
    this.dryGain = ctx.createGain();
    
    // 6 detuned delay lines with different LFO rates
    this.delays = [];
    this.lfos = [];
    this.depths = [];
    
    const rates = [0.3, 0.5, 0.7, 0.9, 1.1, 1.3];
    const baseTimes = [0.015, 0.018, 0.021, 0.024, 0.027, 0.030];
    const pans = [-0.8, -0.4, -0.1, 0.1, 0.4, 0.8];
    
    for (let i = 0; i < 6; i++) {
      const delay = ctx.createDelay(0.05);
      delay.delayTime.value = baseTimes[i];
      
      const lfo = ctx.createOscillator();
      lfo.type = 'triangle';
      lfo.frequency.value = rates[i];
      
      const depth = ctx.createGain();
      depth.gain.value = 0.002;
      
      lfo.connect(depth);
      depth.connect(delay.delayTime);
      lfo.start();
      
      const pan = ctx.createStereoPanner();
      pan.pan.value = pans[i];
      
      this.input.connect(delay);
      delay.connect(pan);
      pan.connect(this.wetGain);
      
      this.delays.push(delay);
      this.lfos.push(lfo);
      this.depths.push(depth);
    }
    
    // Mix
    this.input.connect(this.dryGain);
    this.wetGain.connect(this.output);
    this.dryGain.connect(this.output);
    
    this.setLevel(0);
  }
  
  setLevel(level) {
    const mix = level / 99;
    this.wetGain.gain.value = mix * 0.5;
    this.dryGain.gain.value = 1 - (mix * 0.25);
    
    for (let i = 0; i < this.depths.length; i++) {
      this.depths[i].gain.value = 0.0008 + (mix * 0.0025);
    }
  }
  
  connect(destination) {
    this.output.connect(destination);
  }
  
  disconnect() {
    this.output.disconnect();
  }
}

/**
 * FX Chain - Manages all effects and routing
 */
export class FXChain {
  constructor(ctx) {
    this.ctx = ctx;
    
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.chainGain = ctx.createGain();
    this.bypassGain = ctx.createGain();
    this.chainGain.gain.value = 1;
    this.bypassGain.gain.value = 0;
    // Bypass path (input direct to output)
    this.input.connect(this.bypassGain);
    this.bypassGain.connect(this.output);
    
    // Create all effects
    this.effects = {
      reverb: new Reverb(ctx),
      delay: new Delay(ctx),
      chorus: new Chorus(ctx),
      phaser: new Phaser(ctx),
      flanger: new Flanger(ctx),
      drive: new Drive(ctx),
      tremolo: new Tremolo(ctx),
      ensemble: new Ensemble(ctx)
    };
    
    // Chain order: Drive -> Phaser -> Flanger -> Chorus -> Ensemble -> Tremolo -> Delay -> Reverb
    // This matches typical guitar pedal ordering
    const chainOrder = ['drive', 'phaser', 'flanger', 'chorus', 'ensemble', 'tremolo', 'delay', 'reverb'];
    
    let lastNode = this.input;
    for (const effectName of chainOrder) {
      const effect = this.effects[effectName];
      lastNode.connect(effect.input);
      lastNode = effect.output;
    }
    lastNode.connect(this.chainGain);
    this.chainGain.connect(this.output);
  }
  
  setLevel(effectName, level) {
    if (this.effects[effectName]) {
      this.effects[effectName].setLevel(level);
    }
  }
  
  setLevels(levels) {
    for (const [effectName, level] of Object.entries(levels)) {
      this.setLevel(effectName, level);
    }
  }
  
  setBpm(bpm) {
    this.effects.delay.setBpm(bpm);
  }

  setBypass(bypass) {
    this.chainGain.gain.value = bypass ? 0 : 1;
    this.bypassGain.gain.value = bypass ? 1 : 0;
  }
  
  connect(destination) {
    this.output.connect(destination);
  }
  
  disconnect() {
    this.output.disconnect();
  }
}
