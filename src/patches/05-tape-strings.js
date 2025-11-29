/**
 * 05 - TAPE STRINGS
 * Mellotron-inspired tape string sound
 * 
 * That wobbly, warm, slightly lo-fi string sound.
 * Think King Crimson or early Genesis. 
 * Filtered, with tape-like pitch drift.
 */

export const TapeStrings = {
  id: 'tape-strings',
  name: 'Tape Strings',
  category: 'pad',
  
  createVoice(ctx, freq, velocity = 0.8) {
    const now = ctx.currentTime;
    const velGain = 0.15 + (velocity * 0.2);
    
    // Three oscillators for thickness (like tape heads)
    const oscs = [];
    const types = ['sawtooth', 'sawtooth', 'triangle'];
    const detunes = [-8, 8, 0];
    const levels = [0.3, 0.3, 0.4];
    
    const mixer = ctx.createGain();
    mixer.gain.value = 0.3;
    
    types.forEach((type, i) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      osc.detune.value = detunes[i];
      
      const gain = ctx.createGain();
      gain.gain.value = levels[i];
      
      osc.connect(gain);
      gain.connect(mixer);
      osc.start(now);
      oscs.push({ osc, gain });
    });
    
    // Heavy lowpass - mellotron strings are very filtered
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1800;
    filter.Q.value = 0.5;
    
    // Subtle filter movement
    filter.frequency.setValueAtTime(1200, now);
    filter.frequency.linearRampToValueAtTime(2000, now + 0.3);
    filter.frequency.setTargetAtTime(1600, now + 0.4, 0.8);
    
    mixer.connect(filter);
    
    // Tape-like "wow" - slow pitch drift
    const wow = ctx.createOscillator();
    const wowGain = ctx.createGain();
    wow.type = 'sine';
    wow.frequency.value = 0.3 + (Math.random() * 0.2); // Slightly random
    wowGain.gain.value = 4; // Subtle pitch wobble
    wow.connect(wowGain);
    oscs.forEach(o => wowGain.connect(o.osc.detune));
    wow.start(now);
    
    // Tape-like "flutter" - faster, subtler
    const flutter = ctx.createOscillator();
    const flutterGain = ctx.createGain();
    flutter.type = 'sine';
    flutter.frequency.value = 6;
    flutterGain.gain.value = 1.5;
    flutter.connect(flutterGain);
    oscs.forEach(o => flutterGain.connect(o.osc.detune));
    flutter.start(now);
    
    // Amp envelope - tape-like attack (not instant)
    const ampEnv = ctx.createGain();
    ampEnv.gain.setValueAtTime(0, now);
    ampEnv.gain.linearRampToValueAtTime(velGain * 0.7, now + 0.08);
    ampEnv.gain.linearRampToValueAtTime(velGain, now + 0.2);
    
    filter.connect(ampEnv);
    
    // Output - normalized level
    const output = ctx.createGain();
    output.gain.value = 0.5;
    ampEnv.connect(output);
    
    return {
      output,
      release(time = 0) {
        const releaseTime = ctx.currentTime + time;
        const relDuration = 0.6;
        
        ampEnv.gain.cancelScheduledValues(releaseTime);
        ampEnv.gain.setValueAtTime(ampEnv.gain.value, releaseTime);
        ampEnv.gain.exponentialRampToValueAtTime(0.001, releaseTime + relDuration);
        
        filter.frequency.setTargetAtTime(400, releaseTime, 0.2);
        
        oscs.forEach(o => o.osc.stop(releaseTime + relDuration));
        wow.stop(releaseTime + relDuration);
        flutter.stop(releaseTime + relDuration);
        
        setTimeout(() => {
          oscs.forEach(o => {
            o.osc.disconnect();
            o.gain.disconnect();
          });
          wow.disconnect();
          wowGain.disconnect();
          flutter.disconnect();
          flutterGain.disconnect();
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
