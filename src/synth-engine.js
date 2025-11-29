/**
 * Orchid-Style Synth Engine
 * 
 * Matches the physical Orchid's architecture:
 * - 4 Oscillators per voice
 * - 4 LFOs for modulation
 * - 4 Envelope Generators
 * - Adjustable Filter
 * 
 * Supports 3 synthesis modes:
 * - Virtual Analog (VA) - Classic subtractive
 * - FM - Frequency modulation
 * - Electric Piano (EP) - Sample-inspired with mechanical character
 */

// Envelope generator with 4-stage ADSR
function createEnvelope(ctx, { attack = 0.01, decay = 0.1, sustain = 0.7, release = 0.3 } = {}) {
  const gain = ctx.createGain();
  gain.gain.value = 0;
  
  return {
    node: gain,
    trigger(time = ctx.currentTime, velocity = 1) {
      const now = time;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(velocity, now + attack);
      gain.gain.linearRampToValueAtTime(sustain * velocity, now + attack + decay);
    },
    release(time = ctx.currentTime) {
      const now = time;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + release);
      return release;
    }
  };
}

// LFO with multiple waveforms
function createLFO(ctx, { type = 'sine', rate = 1, depth = 1 } = {}) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.type = type;
  osc.frequency.value = rate;
  gain.gain.value = depth;
  
  osc.connect(gain);
  osc.start();
  
  return {
    output: gain,
    setRate(r) { osc.frequency.value = r; },
    setDepth(d) { gain.gain.value = d; },
    connect(target) { gain.connect(target); },
    stop() { osc.stop(); }
  };
}

// Filter with envelope modulation
function createFilter(ctx, { type = 'lowpass', frequency = 2000, Q = 1, envAmount = 0 } = {}) {
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  filter.Q.value = Q;
  
  return {
    node: filter,
    baseFreq: frequency,
    envAmount,
    modulateWithEnvelope(envValue, time) {
      const freq = this.baseFreq + (envValue * this.envAmount);
      filter.frequency.setTargetAtTime(Math.max(20, Math.min(20000, freq)), time, 0.01);
    },
    setFrequency(f) {
      this.baseFreq = f;
      filter.frequency.value = f;
    }
  };
}

/**
 * Virtual Analog Voice - Classic subtractive synthesis
 */
export function createVAVoice(ctx, freq, params = {}) {
  const {
    oscTypes = ['sawtooth', 'sawtooth', 'square', 'triangle'],
    oscDetune = [0, 7, -5, 12], // cents
    oscMix = [0.4, 0.3, 0.2, 0.1],
    filterFreq = 2000,
    filterQ = 2,
    filterEnvAmount = 3000,
    ampEnv = { attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.4 },
    filterEnv = { attack: 0.01, decay: 0.3, sustain: 0.3, release: 0.3 },
    lfoRate = 0.5,
    lfoDepth = 10, // cents
    velocity = 0.8
  } = params;

  const now = ctx.currentTime;
  
  // Create oscillators
  const oscillators = oscTypes.map((type, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = oscDetune[i] || 0;
    gain.gain.value = oscMix[i] || 0.25;
    osc.connect(gain);
    osc.start(now);
    return { osc, gain };
  });
  
  // Mixer
  const mixer = ctx.createGain();
  oscillators.forEach(o => o.gain.connect(mixer));
  
  // Filter
  const filter = createFilter(ctx, { 
    frequency: filterFreq, 
    Q: filterQ, 
    envAmount: filterEnvAmount 
  });
  mixer.connect(filter.node);
  
  // Amp envelope
  const ampEnvNode = createEnvelope(ctx, ampEnv);
  filter.node.connect(ampEnvNode.node);
  
  // LFO -> Pitch
  const lfo = createLFO(ctx, { rate: lfoRate, depth: lfoDepth });
  oscillators.forEach(o => lfo.connect(o.osc.detune));
  
  // Filter envelope (simulated with scheduled values)
  const filterEnvGain = ctx.createGain();
  filterEnvGain.gain.setValueAtTime(0, now);
  filterEnvGain.gain.linearRampToValueAtTime(1, now + filterEnv.attack);
  filterEnvGain.gain.linearRampToValueAtTime(filterEnv.sustain, now + filterEnv.attack + filterEnv.decay);
  
  // Trigger amp envelope
  ampEnvNode.trigger(now, velocity * 0.5);
  
  // Output
  const output = ctx.createGain();
  output.gain.value = 0.7;
  ampEnvNode.node.connect(output);
  
  return {
    output,
    release(time = 0) {
      const releaseTime = ctx.currentTime + time;
      const relDuration = ampEnvNode.release(releaseTime);
      
      setTimeout(() => {
        oscillators.forEach(o => {
          o.osc.stop();
          o.osc.disconnect();
          o.gain.disconnect();
        });
        lfo.stop();
        mixer.disconnect();
        filter.node.disconnect();
        ampEnvNode.node.disconnect();
        output.disconnect();
      }, (relDuration + 0.1) * 1000);
      
      return relDuration;
    }
  };
}

/**
 * FM Voice - 4-operator FM synthesis
 */
export function createFMVoice(ctx, freq, params = {}) {
  const {
    algorithm = 1, // 1-4 supported
    operators = [
      { ratio: 1, level: 1, env: { attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.3 } },
      { ratio: 2, level: 0.5, env: { attack: 0.01, decay: 0.4, sustain: 0.2, release: 0.2 } },
      { ratio: 3, level: 0.3, env: { attack: 0.01, decay: 0.3, sustain: 0.1, release: 0.2 } },
      { ratio: 4, level: 0.2, env: { attack: 0.01, decay: 0.2, sustain: 0.05, release: 0.1 } }
    ],
    velocity = 0.8
  } = params;
  
  const now = ctx.currentTime;
  const velGain = 0.3 + (velocity * 0.4);
  
  // Create 4 operators (oscillator + envelope)
  const ops = operators.map((op, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const env = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.value = freq * op.ratio;
    gain.gain.value = op.level * freq; // FM index scales with frequency
    
    // Envelope
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(1, now + op.env.attack);
    env.gain.linearRampToValueAtTime(op.env.sustain, now + op.env.attack + op.env.decay);
    
    osc.connect(gain);
    gain.connect(env);
    osc.start(now);
    
    return { osc, gain, env, params: op };
  });
  
  // Algorithm routing
  // Algorithm 1: [4->3->2->1] (serial)
  // Algorithm 2: [4->3] + [2] -> 1 
  // Algorithm 3: [4] + [3] + [2] -> 1
  // Algorithm 4: [4->3] [2->1] (parallel pairs)
  
  const carrier = ctx.createGain();
  carrier.gain.value = velGain;
  
  switch (algorithm) {
    case 1: // Serial: 4->3->2->1
      ops[3].env.connect(ops[2].osc.frequency);
      ops[2].env.connect(ops[1].osc.frequency);
      ops[1].env.connect(ops[0].osc.frequency);
      ops[0].env.connect(carrier);
      break;
    case 2: // 4->3, 2 all to 1
      ops[3].env.connect(ops[2].osc.frequency);
      ops[2].env.connect(ops[0].osc.frequency);
      ops[1].env.connect(ops[0].osc.frequency);
      ops[0].env.connect(carrier);
      break;
    case 3: // 4, 3, 2 all to 1
      ops[3].env.connect(ops[0].osc.frequency);
      ops[2].env.connect(ops[0].osc.frequency);
      ops[1].env.connect(ops[0].osc.frequency);
      ops[0].env.connect(carrier);
      break;
    case 4: // Parallel: 4->3, 2->1 both output
    default:
      ops[3].env.connect(ops[2].osc.frequency);
      ops[2].env.connect(carrier);
      ops[1].env.connect(ops[0].osc.frequency);
      ops[0].env.connect(carrier);
      break;
  }
  
  // Output
  const output = ctx.createGain();
  output.gain.value = 0.7;
  carrier.connect(output);
  
  return {
    output,
    release(time = 0) {
      const releaseTime = ctx.currentTime + time;
      const relDuration = 0.3;
      
      ops.forEach(op => {
        op.env.gain.cancelScheduledValues(releaseTime);
        op.env.gain.setValueAtTime(op.env.gain.value, releaseTime);
        op.env.gain.exponentialRampToValueAtTime(0.001, releaseTime + relDuration);
        op.osc.stop(releaseTime + relDuration);
      });
      
      setTimeout(() => {
        ops.forEach(op => {
          op.osc.disconnect();
          op.gain.disconnect();
          op.env.disconnect();
        });
        carrier.disconnect();
        output.disconnect();
      }, (relDuration + 0.1) * 1000);
      
      return relDuration;
    }
  };
}

/**
 * Electric Piano Voice - FM-based with mechanical characteristics
 */
export function createEPVoice(ctx, freq, params = {}) {
  const {
    tineLevel = 0.6,      // Bell/tine brightness
    barkLevel = 0.3,      // Bark/growl
    velocity = 0.8,
    hardness = 0.5        // Key hardness (affects FM index)
  } = params;
  
  const now = ctx.currentTime;
  const velGain = 0.3 + (velocity * 0.4);
  const fmIndex = (0.5 + hardness) * velocity;
  
  // Carrier (fundamental)
  const carrier = ctx.createOscillator();
  carrier.type = 'sine';
  carrier.frequency.value = freq;
  
  // Modulator 1: Tine (bell-like, ratio 1:1 with decay)
  const tineOsc = ctx.createOscillator();
  const tineGain = ctx.createGain();
  tineOsc.type = 'sine';
  tineOsc.frequency.value = freq;
  tineGain.gain.setValueAtTime(freq * fmIndex * tineLevel, now);
  tineGain.gain.exponentialRampToValueAtTime(freq * 0.1 * tineLevel, now + 0.5);
  tineOsc.connect(tineGain);
  tineGain.connect(carrier.frequency);
  
  // Modulator 2: Bark (low ratio for growl)
  const barkOsc = ctx.createOscillator();
  const barkGain = ctx.createGain();
  barkOsc.type = 'sine';
  barkOsc.frequency.value = freq * 7; // Inharmonic for bark
  barkGain.gain.setValueAtTime(freq * 0.3 * barkLevel * velocity, now);
  barkGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  barkOsc.connect(barkGain);
  barkGain.connect(carrier.frequency);
  
  // Second harmonic for warmth
  const harmonic = ctx.createOscillator();
  const harmonicGain = ctx.createGain();
  harmonic.type = 'sine';
  harmonic.frequency.value = freq * 2;
  harmonicGain.gain.value = 0.15;
  harmonic.connect(harmonicGain);
  
  // Amp envelope (piano-like)
  const ampEnv = ctx.createGain();
  ampEnv.gain.setValueAtTime(0, now);
  ampEnv.gain.linearRampToValueAtTime(velGain, now + 0.005);
  ampEnv.gain.exponentialRampToValueAtTime(velGain * 0.6, now + 0.1);
  ampEnv.gain.setTargetAtTime(velGain * 0.4, now + 0.1, 1.5);
  
  // Mix
  carrier.connect(ampEnv);
  harmonicGain.connect(ampEnv);
  
  // Output - normalized level
  const output = ctx.createGain();
  output.gain.value = 0.5;
  ampEnv.connect(output);
  
  // Start
  carrier.start(now);
  tineOsc.start(now);
  barkOsc.start(now);
  harmonic.start(now);
  
  return {
    output,
    release(time = 0) {
      const releaseTime = ctx.currentTime + time;
      const relDuration = 0.4;
      
      ampEnv.gain.cancelScheduledValues(releaseTime);
      ampEnv.gain.setValueAtTime(ampEnv.gain.value, releaseTime);
      ampEnv.gain.exponentialRampToValueAtTime(0.001, releaseTime + relDuration);
      
      carrier.stop(releaseTime + relDuration);
      tineOsc.stop(releaseTime + relDuration);
      barkOsc.stop(releaseTime + relDuration);
      harmonic.stop(releaseTime + relDuration);
      
      setTimeout(() => {
        carrier.disconnect();
        tineOsc.disconnect();
        barkOsc.disconnect();
        harmonic.disconnect();
        tineGain.disconnect();
        barkGain.disconnect();
        harmonicGain.disconnect();
        ampEnv.disconnect();
        output.disconnect();
      }, (relDuration + 0.1) * 1000);
      
      return relDuration;
    }
  };
}

export const SynthEngines = {
  VA: createVAVoice,
  FM: createFMVoice,
  EP: createEPVoice
};
