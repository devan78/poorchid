/**
 * 07 - CATHEDRAL ORGAN
 * Realistic pipe organ simulation
 * 
 * Uses additive synthesis with proper organ harmonic series.
 * Multiple drawbar-style ranks: 16', 8', 4', 2-2/3', 2', 1-3/5'
 * Includes key click, wind noise, and subtle pipe resonance.
 * Inspired by Hammond B3 meets church pipe organ.
 */

export const CathedralOrgan = {
  id: 'cathedral-organ',
  name: 'Cathedral Organ',
  category: 'keys',
  
  // Drawbar levels (0-1) - classic organ registration
  drawbars: {
    '16':     0.8,   // Sub-fundamental (one octave below)
    '8':      1.0,   // Fundamental
    '4':      0.7,   // 2nd harmonic (octave)
    '2-2/3':  0.5,   // 3rd harmonic (fifth above octave)
    '2':      0.6,   // 4th harmonic (two octaves)
    '1-3/5':  0.3,   // 5th harmonic (major third above 2')
    '1-1/3':  0.25,  // 6th harmonic
    '1':      0.15,  // 8th harmonic
  },
  
  createVoice(ctx, freq, velocity = 0.8) {
    const now = ctx.currentTime;
    const velGain = 0.25 + (velocity * 0.25);
    
    // Harmonic ratios for each drawbar (based on pipe lengths)
    const harmonics = [
      { ratio: 0.5, level: this.drawbars['16'] },     // 16' - sub octave
      { ratio: 1, level: this.drawbars['8'] },        // 8' - fundamental
      { ratio: 2, level: this.drawbars['4'] },        // 4' - octave
      { ratio: 3, level: this.drawbars['2-2/3'] },    // 2-2/3' - fifth
      { ratio: 4, level: this.drawbars['2'] },        // 2' - two octaves
      { ratio: 5, level: this.drawbars['1-3/5'] },    // 1-3/5' - major third
      { ratio: 6, level: this.drawbars['1-1/3'] },    // 1-1/3' - fifth
      { ratio: 8, level: this.drawbars['1'] },        // 1' - three octaves
    ];
    
    const mixer = ctx.createGain();
    mixer.gain.value = 0.15;
    
    const oscillators = [];
    
    // Create additive harmonics
    harmonics.forEach(({ ratio, level }) => {
      if (level <= 0) return;
      
      const osc = ctx.createOscillator();
      // Sine waves for pure organ tone
      osc.type = 'sine';
      osc.frequency.value = freq * ratio;
      
      // Slight random detune for realism (pipe imperfection)
      osc.detune.value = (Math.random() - 0.5) * 4;
      
      const gain = ctx.createGain();
      // Higher harmonics are naturally quieter
      const harmonicFalloff = 1 / Math.sqrt(ratio);
      gain.gain.value = level * harmonicFalloff * 0.3;
      
      osc.connect(gain);
      gain.connect(mixer);
      osc.start(now);
      
      oscillators.push({ osc, gain });
    });
    
    // Key click - characteristic organ attack
    const clickOsc = ctx.createOscillator();
    clickOsc.type = 'square';
    clickOsc.frequency.value = freq * 8; // High frequency click
    
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.15, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.008);
    
    const clickFilter = ctx.createBiquadFilter();
    clickFilter.type = 'bandpass';
    clickFilter.frequency.value = 2000;
    clickFilter.Q.value = 2;
    
    clickOsc.connect(clickFilter);
    clickFilter.connect(clickGain);
    clickGain.connect(mixer);
    clickOsc.start(now);
    clickOsc.stop(now + 0.02);
    
    // Wind/breath noise (very subtle)
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * 0.02;
    }
    
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;
    
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 400;
    noiseFilter.Q.value = 0.5;
    
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.03;
    
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(mixer);
    noiseSource.start(now);
    
    // Subtle tremolo (Leslie-style, slow)
    const tremoloLFO = ctx.createOscillator();
    tremoloLFO.type = 'sine';
    tremoloLFO.frequency.value = 5.5; // Slow Leslie speed
    
    const tremoloGain = ctx.createGain();
    tremoloGain.gain.value = 0.08; // Subtle
    
    const tremoloMixer = ctx.createGain();
    tremoloMixer.gain.value = 1;
    
    tremoloLFO.connect(tremoloGain);
    tremoloGain.connect(tremoloMixer.gain);
    tremoloLFO.start(now);
    
    mixer.connect(tremoloMixer);
    
    // Gentle lowpass - organs aren't harsh
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 4000;
    filter.Q.value = 0.5;
    
    tremoloMixer.connect(filter);
    
    // Amp envelope - organ has instant attack, no decay
    const ampEnv = ctx.createGain();
    ampEnv.gain.setValueAtTime(0, now);
    ampEnv.gain.linearRampToValueAtTime(velGain, now + 0.01); // Near-instant
    
    filter.connect(ampEnv);
    
    // Output
    const output = ctx.createGain();
    output.gain.value = 0.9;
    ampEnv.connect(output);
    
    return {
      output,
      release(time = 0) {
        const releaseTime = ctx.currentTime + time;
        const relDuration = 0.08; // Organ releases quickly
        
        ampEnv.gain.cancelScheduledValues(releaseTime);
        ampEnv.gain.setValueAtTime(ampEnv.gain.value, releaseTime);
        ampEnv.gain.exponentialRampToValueAtTime(0.001, releaseTime + relDuration);
        
        // Stop everything after release
        const stopTime = releaseTime + relDuration + 0.1;
        oscillators.forEach(({ osc }) => {
          try { osc.stop(stopTime); } catch (e) {}
        });
        try { 
          noiseSource.stop(stopTime);
          tremoloLFO.stop(stopTime);
        } catch (e) {}
        
        setTimeout(() => {
          try {
            oscillators.forEach(({ osc, gain }) => {
              osc.disconnect();
              gain.disconnect();
            });
            noiseSource.disconnect();
            noiseFilter.disconnect();
            noiseGain.disconnect();
            tremoloLFO.disconnect();
            tremoloGain.disconnect();
            tremoloMixer.disconnect();
            mixer.disconnect();
            filter.disconnect();
            ampEnv.disconnect();
            output.disconnect();
          } catch (e) {}
        }, (relDuration + 0.2) * 1000);
        
        return relDuration;
      }
    };
  }
};
