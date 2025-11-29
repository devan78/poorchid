/**
 * 01 - ORCHID EP
 * Classic 80s Electric Piano - Rhodes-style
 * 
 * The signature Orchid sound. Warm, bell-like attack with
 * smooth sustain. Velocity-sensitive brightness.
 */

import { SynthEngines } from '../synth-engine.js';

export const OrchidEP = {
  id: 'orchid-ep',
  name: 'Orchid EP',
  category: 'keys',
  engine: 'EP',
  
  params: {
    tineLevel: 0.6,
    barkLevel: 0.25,
    hardness: 0.5
  },
  
  createVoice(ctx, freq, velocity = 0.8) {
    return SynthEngines.EP(ctx, freq, {
      ...this.params,
      velocity
    });
  }
};
