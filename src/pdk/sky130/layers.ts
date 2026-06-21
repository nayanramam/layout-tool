import type { Layer, LayerId } from '../../types';

export const SKY130_LAYERS: Record<LayerId, Omit<Layer, 'visible'>> = {
  nwell: {
    id: 'nwell',
    name: 'N-well',
    gdsNumber: 64,
    datatype: 20,
    color: '#c8e6c9',
    fillAlpha: 0.35,
  },
  diff: {
    id: 'diff',
    name: 'Diffusion',
    gdsNumber: 65,
    datatype: 20,
    color: '#4caf50',
    fillAlpha: 0.55,
  },
  poly: {
    id: 'poly',
    name: 'Poly',
    gdsNumber: 66,
    datatype: 20,
    color: '#f44336',
    fillAlpha: 0.65,
  },
  licon: {
    id: 'licon',
    name: 'Li Contact',
    gdsNumber: 66,
    datatype: 44,
    color: '#2196f3',
    fillAlpha: 0.8,
  },
  li: {
    id: 'li',
    name: 'Local Interconnect',
    gdsNumber: 67,
    datatype: 20,
    color: '#00bcd4',
    fillAlpha: 0.7,
  },
  mcon: {
    id: 'mcon',
    name: 'Mcon',
    gdsNumber: 67,
    datatype: 44,
    color: '#ff9800',
    fillAlpha: 0.85,
  },
  m1: {
    id: 'm1',
    name: 'Metal 1',
    gdsNumber: 68,
    datatype: 20,
    color: '#3f51b5',
    fillAlpha: 0.75,
  },
  nsdm: {
    id: 'nsdm',
    name: 'N+ S/D Implant',
    gdsNumber: 93,
    datatype: 44,
    color: '#9c27b0',
    fillAlpha: 0.3,
  },
  psdm: {
    id: 'psdm',
    name: 'P+ S/D Implant',
    gdsNumber: 94,
    datatype: 20,
    color: '#e91e63',
    fillAlpha: 0.3,
  },
};

export const LAYER_ORDER: LayerId[] = [
  'nwell',
  'diff',
  'nsdm',
  'psdm',
  'poly',
  'licon',
  'li',
  'mcon',
  'm1',
];

export function defaultLayerVisibility(): Record<LayerId, boolean> {
  return Object.fromEntries(LAYER_ORDER.map((id) => [id, true])) as Record<LayerId, boolean>;
}

export function getLayerGdsKey(layerId: LayerId): string {
  const layer = SKY130_LAYERS[layerId];
  return `${layer.gdsNumber}/${layer.datatype}`;
}
