/**
 * 02 - ANALOG FLOWER
 * Warm, dreamy analog string pad
 * 
 * Think Solina String Ensemble meets lush 70s pads.
 * Slow attack, gentle chorus-like detuning, very warm.
 */

export const AnalogFlower = {
  id: 'analog-flower',
  name: 'Analog Flower',
  category: 'pad',
  
  createVoice(ctx, freq, velocity = 0.8) {
    const now = ctx.currentTime;
    const velGain = 0.25 + (velocity * 0.35); // More forward dynamics
  
    // 4 detuned sawtooth oscillators for classic string ensemble
    const oscs = [];
    const detunes = [-12, -5, 5, 12]; // Subtle spread in cents
    
    const mixer = ctx.createGain();
    mixer.gain.value = 0.4;
    
    detunes.forEach((detune) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      osc.detune.value = detune;
      
      const oscGain = ctx.createGain();
      oscGain.gain.value = 0.28;
      
      osc.connect(oscGain);
      oscGain.connect(mixer);
      osc.start(now);
      oscs.push({ osc, gain: oscGain });
    });
    
    // Warm lowpass filter - very important for 70s sound
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600; // Start dark
    filter.Q.value = 0.7; // Gentle, no resonance
    
    // Slow filter envelope opening up
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.linearRampToValueAtTime(1200, now + 0.8);
    filter.frequency.setTargetAtTime(900, now + 0.8, 1.0);
    
    mixer.connect(filter);
    
    // Slow amp envelope - string-like
    const ampEnv = ctx.createGain();
    ampEnv.gain.setValueAtTime(0, now);
    ampEnv.gain.linearRampToValueAtTime(velGain, now + 0.4); // Slow attack
    ampEnv.gain.setTargetAtTime(velGain * 0.8, now + 0.5, 0.5); // Gentle sustain
    
    filter.connect(ampEnv);
    
    // Subtle LFO for warmth/movement
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'triangle';
    lfo.frequency.value = 0.4; // Very slow
    lfoGain.gain.value = 3; // Subtle pitch wobble
    lfo.connect(lfoGain);
    oscs.forEach(o => lfoGain.connect(o.osc.detune));
    lfo.start(now);
    
    // Output - normalized level
    const output = ctx.createGain();
    output.gain.value = 0.8;
    ampEnv.connect(output);
    
    return {
      output,
      release(time = 0) {
        const releaseTime = ctx.currentTime + time;
        const relDuration = 1.2; // Long, dreamy release
        
        ampEnv.gain.cancelScheduledValues(releaseTime);
        ampEnv.gain.setValueAtTime(ampEnv.gain.value, releaseTime);
        ampEnv.gain.exponentialRampToValueAtTime(0.001, releaseTime + relDuration);
        
        filter.frequency.setTargetAtTime(200, releaseTime, 0.3);
        
        oscs.forEach(o => o.osc.stop(releaseTime + relDuration));
        lfo.stop(releaseTime + relDuration);
        
        setTimeout(() => {
          oscs.forEach(o => {
            o.osc.disconnect();
            o.gain.disconnect();
          });
          lfo.disconnect();
          lfoGain.disconnect();
          mixer.disconnect();
          filter.disconnect();
          ampEnv.disconnect();
          output.disconnect();
        }, (relDuration + 0.1) * 1000);
        
        return relDuration;
      }
    };
  }
};
