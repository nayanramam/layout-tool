import type { RuleDeck } from '../../types';

/** Essential sky130 periphery rules for live DRC (values in microns). */
export const SKY130_RULES: RuleDeck = {
  minWidth: {
    nwell: 0.84,
    diff: 0.15,
    poly: 0.15,
    licon: 0.17,
    li: 0.17,
    mcon: 0.17,
    m1: 0.14,
    nsdm: 0.38,
    psdm: 0.38,
  },
  minSpacing: [
    { layerA: 'nwell', layerB: 'nwell', minSpacing: 1.27 },
    { layerA: 'diff', layerB: 'diff', minSpacing: 0.27 },
    { layerA: 'poly', layerB: 'poly', minSpacing: 0.21 },
    { layerA: 'licon', layerB: 'licon', minSpacing: 0.17 },
    { layerA: 'li', layerB: 'li', minSpacing: 0.17 },
    { layerA: 'mcon', layerB: 'mcon', minSpacing: 0.17 },
    { layerA: 'm1', layerB: 'm1', minSpacing: 0.14 },
    { layerA: 'poly', layerB: 'diff', minSpacing: 0.155 },
    { layerA: 'li', layerB: 'licon', minSpacing: 0.08 },
    { layerA: 'm1', layerB: 'mcon', minSpacing: 0.08 },
  ],
  enclosure: [
    { enclosing: 'nwell', enclosed: 'diff', minEnclosure: 0.18 },
    { enclosing: 'nsdm', enclosed: 'diff', minEnclosure: 0.125 },
    { enclosing: 'psdm', enclosed: 'diff', minEnclosure: 0.125 },
    { enclosing: 'diff', enclosed: 'licon', minEnclosure: 0.04 },
    { enclosing: 'poly', enclosed: 'licon', minEnclosure: 0.04 },
    { enclosing: 'li', enclosed: 'licon', minEnclosure: 0.08 },
    { enclosing: 'm1', enclosed: 'mcon', minEnclosure: 0.03 },
  ],
  minArea: {
    nwell: 0.7056,
    diff: 0.0225,
    poly: 0.0225,
  },
};
