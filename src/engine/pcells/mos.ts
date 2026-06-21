import type { DeviceInstance, DeviceType, Point, Shape } from '../../types';
import { createId } from '../geometry';

const CONTACT_SIZE = 0.17;
const IMPLANT_MARGIN = 0.125;
const NWELL_MARGIN = 0.18;
const GATE_EXTENSION = 0.09;

export type MosPlacement = {
  device: DeviceInstance;
  shapes: Shape[];
};

export function createMosDevice(
  type: DeviceType,
  origin: Point,
  W: number,
  L: number,
  fingers = 1,
  name?: string,
): MosPlacement {
  const deviceId = createId('dev');
  const diffHeight = Math.max(W, 0.42);
  const diffWidth = L * fingers + 0.24 * Math.max(fingers - 1, 0) + 0.24;
  const diffRect = {
    x: origin.x,
    y: origin.y,
    width: diffWidth,
    height: diffHeight,
  };

  const polyWidth = 0.15;
  const polyRect = {
    x: origin.x + diffWidth / 2 - polyWidth / 2,
    y: origin.y - GATE_EXTENSION,
    width: polyWidth,
    height: diffHeight + GATE_EXTENSION * 2,
  };

  const implantRect = {
    x: diffRect.x - IMPLANT_MARGIN,
    y: diffRect.y - IMPLANT_MARGIN,
    width: diffRect.width + IMPLANT_MARGIN * 2,
    height: diffRect.height + IMPLANT_MARGIN * 2,
  };

  const shapes: Shape[] = [];

  if (type === 'pmos') {
    shapes.push({
      id: createId('shape'),
      layer: 'nwell',
      kind: 'rect',
      rect: {
        x: implantRect.x - NWELL_MARGIN,
        y: implantRect.y - NWELL_MARGIN,
        width: implantRect.width + NWELL_MARGIN * 2,
        height: implantRect.height + NWELL_MARGIN * 2,
      },
      deviceId,
    });
    shapes.push({
      id: createId('shape'),
      layer: 'psdm',
      kind: 'rect',
      rect: implantRect,
      deviceId,
    });
  } else {
    shapes.push({
      id: createId('shape'),
      layer: 'nsdm',
      kind: 'rect',
      rect: implantRect,
      deviceId,
    });
  }

  shapes.push(
    {
      id: createId('shape'),
      layer: 'diff',
      kind: 'rect',
      rect: diffRect,
      deviceId,
    },
    {
      id: createId('shape'),
      layer: 'poly',
      kind: 'rect',
      rect: polyRect,
      deviceId,
    },
  );

  const dPoint: Point = { x: diffRect.x + diffRect.width * 0.15, y: diffRect.y + diffRect.height / 2 };
  const sPoint: Point = { x: diffRect.x + diffRect.width * 0.85, y: diffRect.y + diffRect.height / 2 };
  const gPoint: Point = { x: polyRect.x + polyRect.width / 2, y: polyRect.y - 0.1 };
  const bPoint: Point =
    type === 'pmos'
      ? { x: diffRect.x + diffRect.width / 2, y: diffRect.y + diffRect.height + 0.25 }
      : { x: diffRect.x + diffRect.width / 2, y: diffRect.y - 0.25 };

  const device: DeviceInstance = {
    id: deviceId,
    type,
    name: name ?? `${type.toUpperCase()}${Math.floor(Math.random() * 100)}`,
    W,
    L,
    fingers,
    origin,
    terminals: { d: dPoint, g: gPoint, s: sPoint, b: bPoint },
  };

  return { device, shapes };
}

export function createContactArray(origin: Point, rows = 1, cols = 1): Shape[] {
  const spacing = 0.17;
  const shapes: Shape[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      shapes.push({
        id: createId('shape'),
        layer: 'licon',
        kind: 'rect',
        rect: {
          x: origin.x + col * spacing,
          y: origin.y + row * spacing,
          width: CONTACT_SIZE,
          height: CONTACT_SIZE,
        },
      });
    }
  }
  return shapes;
}
