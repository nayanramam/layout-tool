import type { LayerId, Point, Shape } from '../../types';
import { createId } from '../geometry';
import { createContactArray } from './mos';

const VIA_SIZE = 0.17;

export function createVia(origin: Point, activeLayer: LayerId): Shape[] {
  if (activeLayer === 'm1' || activeLayer === 'mcon') {
    return [
      {
        id: createId('shape'),
        layer: 'mcon',
        kind: 'rect',
        rect: { x: origin.x, y: origin.y, width: VIA_SIZE, height: VIA_SIZE },
      },
    ];
  }
  return createContactArray(origin, 1, 1);
}
