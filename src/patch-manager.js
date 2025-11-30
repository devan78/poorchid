/**
 * Patch Manager - Handles sound presets for Poorchid
 * 
 * Factory sounds - warm, 70s-inspired
 */

import { OrchidEP } from './patches/01-orchid-ep.js';
import { AnalogFlower } from './patches/02-analog-flower.js';
import { MellowBells } from './patches/03-mellow-bells.js';
import { WarmLead } from './patches/04-warm-lead.js';
import { TapeStrings } from './patches/05-tape-strings.js';
import { FMHarp } from './patches/06-fm-harp.js';
import { CathedralOrgan } from './patches/07-cathedral-organ.js';

// Registry of all available patches (ordered)
export const PATCHES = {
  'orchid-ep': OrchidEP,
  'analog-flower': AnalogFlower,
  'mellow-bells': MellowBells,
  'warm-lead': WarmLead,
  'tape-strings': TapeStrings,
  'fm-harp': FMHarp,
  'cathedral-organ': CathedralOrgan
};

// Ordered list for browsing
export const PATCH_ORDER = [
  'orchid-ep',
  'analog-flower',
  'mellow-bells',
  'warm-lead',
  'tape-strings',
  'fm-harp',
  'cathedral-organ'
];

// Default patch
export const DEFAULT_PATCH = 'orchid-ep';

// Get patch names for UI
export function getPatchList() {
  return PATCH_ORDER.map(id => ({
    id,
    name: PATCHES[id].name,
    category: PATCHES[id].category
  }));
}

// Get next/previous patch
export function getAdjacentPatch(currentId, direction = 1) {
  const idx = PATCH_ORDER.indexOf(currentId);
  const newIdx = (idx + direction + PATCH_ORDER.length) % PATCH_ORDER.length;
  return PATCH_ORDER[newIdx];
}

// Get patch by ID
export function getPatch(id) {
  return PATCHES[id] || PATCHES[DEFAULT_PATCH];
}
