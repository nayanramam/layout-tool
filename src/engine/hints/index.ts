import type { Hint, Layout } from '../../types';
import { createId, wireLength } from '../geometry';

const LONG_POLY_THRESHOLD = 2.0;
const SHORT_W_THRESHOLD = 0.5;
const LONG_L_THRESHOLD = 0.5;

export function runHints(layout: Layout): Hint[] {
  const hints: Hint[] = [];

  for (const device of layout.devices) {
    if (device.W < SHORT_W_THRESHOLD) {
      hints.push({
        id: createId('hint'),
        category: 'resistance',
        message: `${device.name}: narrow width (W=${device.W}um) increases series resistance`,
        explanation:
          'MOSFET on-resistance scales roughly as L/(W). A smaller W means fewer parallel current paths, so Ron rises. For analog switches and current mirrors, keep W large enough for your target resistance.',
        shapeIds: [],
        deviceIds: [device.id],
      });
    }

    if (device.L > LONG_L_THRESHOLD) {
      hints.push({
        id: createId('hint'),
        category: 'resistance',
        message: `${device.name}: long channel (L=${device.L}um) increases on-resistance`,
        explanation:
          'Channel length adds directly to the resistive path from drain to source. Longer L helps matching and reduces leakage, but increases Ron and can slow switching.',
        shapeIds: [],
        deviceIds: [device.id],
      });
    }
  }

  for (const shape of layout.shapes) {
    if (shape.layer !== 'poly' || !shape.rect) continue;
    const length = Math.max(shape.rect.width, shape.rect.height);
    if (length > LONG_POLY_THRESHOLD) {
      hints.push({
        id: createId('hint'),
        category: 'routing',
        message: `Long poly trace (${length.toFixed(2)}um) on ${shape.id.slice(-6)}`,
        explanation:
          'Poly is relatively resistive compared to metal. Long poly gates or interconnects add unwanted series resistance and RC delay. Use local interconnect (li) or M1 for longer routes when possible.',
        shapeIds: [shape.id],
        deviceIds: shape.deviceId ? [shape.deviceId] : [],
      });
    }
  }

  for (const wire of layout.wires) {
    if (wire.layer === 'poly') {
      const len = wireLength(wire.points);
      if (len > LONG_POLY_THRESHOLD) {
        hints.push({
          id: createId('hint'),
          category: 'practice',
          message: `Poly wire spans ${len.toFixed(2)}um`,
          explanation:
            'Prefer metal layers for signal routing. Poly is best kept short for gates and local device connections.',
          shapeIds: [],
          deviceIds: [],
        });
      }
    }
  }

  const pmosWithoutNwell = layout.devices
    .filter((device) => device.type === 'pmos')
    .filter((device) => !layout.shapes.some((shape) => shape.layer === 'nwell' && shape.deviceId === device.id));

  for (const device of pmosWithoutNwell) {
    hints.push({
      id: createId('hint'),
      category: 'practice',
      message: `${device.name}: PMOS should sit in an N-well region`,
      explanation:
        'PMOS devices require an N-well body tie. Missing or mis-sized N-well leads to body-effect issues and DRC/LVS failures.',
      shapeIds: [],
      deviceIds: [device.id],
    });
  }

  return hints;
}
