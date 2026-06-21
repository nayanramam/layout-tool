import type { Layout, Point, Shape, Wire } from '../../types';
import { createId, distance, shapeBBox } from '../geometry';

class UnionFind {
  private parent = new Map<string, string>();

  find(value: string): string {
    const parent = this.parent.get(value) ?? value;
    if (parent !== value) {
      const root = this.find(parent);
      this.parent.set(value, root);
      return root;
    }
    this.parent.set(value, value);
    return value;
  }

  union(a: string, b: string): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) {
      this.parent.set(rootB, rootA);
    }
  }
}

const CONNECT_LAYERS = new Set(['licon', 'li', 'mcon', 'm1', 'poly', 'diff']);

function shapeNodeId(shape: Shape): string {
  return `shape:${shape.id}`;
}

function wireNodeId(wire: Wire, index: number): string {
  return `wire:${wire.id}:${index}`;
}

function shapesTouch(a: Shape, b: Shape, tolerance = 0.02): boolean {
  const boxA = shapeBBox(a);
  const boxB = shapeBBox(b);
  return !(
    boxA.x > boxB.x + boxB.width + tolerance ||
    boxB.x > boxA.x + boxA.width + tolerance ||
    boxA.y > boxB.y + boxB.height + tolerance ||
    boxB.y > boxA.y + boxA.height + tolerance
  );
}

function wireTouchesShape(wire: Wire, shape: Shape, tolerance = 0.05): boolean {
  const box = shapeBBox(shape);
  for (const point of wire.points) {
    if (
      point.x >= box.x - tolerance &&
      point.x <= box.x + box.width + tolerance &&
      point.y >= box.y - tolerance &&
      point.y <= box.y + box.height + tolerance
    ) {
      return true;
    }
  }
  return false;
}

export type ExtractedNet = {
  id: string;
  nodeIds: string[];
  shapeIds: string[];
  wireIds: string[];
};

export function extractConnectivity(layout: Layout): ExtractedNet[] {
  const uf = new UnionFind();
  const conductiveShapes = layout.shapes.filter((shape) => CONNECT_LAYERS.has(shape.layer));
  const nodes: string[] = [];

  for (const shape of conductiveShapes) {
    const node = shapeNodeId(shape);
    nodes.push(node);
  }

  for (const wire of layout.wires) {
    wire.points.forEach((_, index) => {
      nodes.push(wireNodeId(wire, index));
    });
  }

  for (const wire of layout.wires) {
    for (let i = 1; i < wire.points.length; i += 1) {
      uf.union(wireNodeId(wire, i - 1), wireNodeId(wire, i));
    }
  }

  for (let i = 0; i < conductiveShapes.length; i += 1) {
    for (let j = i + 1; j < conductiveShapes.length; j += 1) {
      const a = conductiveShapes[i];
      const b = conductiveShapes[j];
      if (a.layer === b.layer || (a.layer === 'licon' && ['poly', 'diff', 'li'].includes(b.layer)) || (b.layer === 'licon' && ['poly', 'diff', 'li'].includes(a.layer))) {
        if (shapesTouch(a, b)) {
          uf.union(shapeNodeId(a), shapeNodeId(b));
        }
      }
    }
  }

  for (const wire of layout.wires) {
    for (let i = 0; i < wire.points.length; i += 1) {
      const node = wireNodeId(wire, i);
      for (const shape of conductiveShapes) {
        if (wireTouchesShape(wire, shape)) {
          uf.union(node, shapeNodeId(shape));
        }
      }
    }
  }

  const groups = new Map<string, ExtractedNet>();
  for (const node of nodes) {
    const root = uf.find(node);
    const group = groups.get(root) ?? {
      id: createId('net'),
      nodeIds: [],
      shapeIds: [],
      wireIds: [],
    };
    group.nodeIds.push(node);
    if (node.startsWith('shape:')) {
      group.shapeIds.push(node.replace('shape:', ''));
    }
    if (node.startsWith('wire:')) {
      const wireId = node.split(':')[1];
      if (!group.wireIds.includes(wireId)) {
        group.wireIds.push(wireId);
      }
    }
    groups.set(root, group);
  }

  return [...groups.values()];
}

export function nearestTerminal(point: Point, layout: Layout, maxDistance = 0.5): {
  deviceName: string;
  terminal: 'd' | 'g' | 's' | 'b';
  point: Point;
  distance: number;
} | null {
  let best: {
    deviceName: string;
    terminal: 'd' | 'g' | 's' | 'b';
    point: Point;
    distance: number;
  } | null = null;

  for (const device of layout.devices) {
    const entries = Object.entries(device.terminals) as ['d' | 'g' | 's' | 'b', Point][];
    for (const [terminal, terminalPoint] of entries) {
      const dist = distance(point, terminalPoint);
      if (dist <= maxDistance && (!best || dist < best.distance)) {
        best = {
          deviceName: device.name,
          terminal,
          point: terminalPoint,
          distance: dist,
        };
      }
    }
  }

  return best;
}
