import type { Layout, Point, Rect, Shape, Wire } from '../../types';
import { LAYER_ORDER } from '../../pdk/sky130';
import { shapeBBox } from './index';

const EMPTY_BOUNDS: Rect = { x: -2, y: -2, width: 4, height: 4 };

export function computeLayoutBounds(layout: Layout): Rect {
  const boxes: Rect[] = [];

  for (const shape of layout.shapes) {
    boxes.push(shapeBBox(shape));
  }

  for (const wire of layout.wires) {
    if (wire.points.length === 0) continue;
    const xs = wire.points.map((p) => p.x);
    const ys = wire.points.map((p) => p.y);
    boxes.push({
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    });
  }

  if (boxes.length === 0) {
    return EMPTY_BOUNDS;
  }

  const minX = Math.min(...boxes.map((b) => b.x));
  const minY = Math.min(...boxes.map((b) => b.y));
  const maxX = Math.max(...boxes.map((b) => b.x + b.width));
  const maxY = Math.max(...boxes.map((b) => b.y + b.height));

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function zoomToFitView(
  bounds: Rect,
  viewportWidth: number,
  viewportHeight: number,
  padding = 40,
): { panX: number; panY: number; zoom: number } {
  if (viewportWidth <= 0 || viewportHeight <= 0) {
    return { panX: 120, panY: 120, zoom: 120 };
  }

  const contentWidth = Math.max(bounds.width, 0.5);
  const contentHeight = Math.max(bounds.height, 0.5);
  const availableWidth = Math.max(viewportWidth - padding * 2, 1);
  const availableHeight = Math.max(viewportHeight - padding * 2, 1);

  const zoom = Math.min(800, Math.max(20, Math.min(availableWidth / contentWidth, availableHeight / contentHeight)));
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;

  return {
    zoom,
    panX: viewportWidth / 2 - centerX * zoom,
    panY: viewportHeight / 2 - centerY * zoom,
  };
}

export function layerDrawPriority(layer: Shape['layer']): number {
  return LAYER_ORDER.indexOf(layer);
}

export function pickTopShapeAtPoint(shapes: Shape[], point: Point): Shape | null {
  const hits = shapes.filter((shape) => {
    if (!shape.rect) return false;
    return (
      point.x >= shape.rect.x &&
      point.x <= shape.rect.x + shape.rect.width &&
      point.y >= shape.rect.y &&
      point.y <= shape.rect.y + shape.rect.height
    );
  });

  if (hits.length === 0) return null;

  return hits.sort((a, b) => layerDrawPriority(b.layer) - layerDrawPriority(a.layer))[0];
}

function pointToSegmentDistance(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - a.x, point.y - a.y);
  }
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(point.x - projX, point.y - projY);
}

export function pickWireAtPoint(wires: Wire[], point: Point, tolerance = 0.12): Wire | null {
  let best: { wire: Wire; dist: number } | null = null;
  for (const wire of wires) {
    for (let i = 1; i < wire.points.length; i += 1) {
      const dist = pointToSegmentDistance(point, wire.points[i - 1], wire.points[i]);
      const threshold = Math.max(tolerance, wire.width / 2 + 0.05);
      if (dist <= threshold && (!best || dist < best.dist)) {
        best = { wire, dist };
      }
    }
  }
  return best?.wire ?? null;
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function pointInRect(point: Point, rect: Rect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

export function wireIntersectsRect(wire: Wire, region: Rect): boolean {
  for (const point of wire.points) {
    if (pointInRect(point, region)) return true;
  }
  for (let i = 1; i < wire.points.length; i += 1) {
    const a = wire.points[i - 1];
    const b = wire.points[i];
    const segBox: Rect = {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      width: Math.abs(b.x - a.x),
      height: Math.abs(b.y - a.y),
    };
    if (rectsIntersect(segBox, region)) return true;
  }
  return false;
}

export function hasHitAtPoint(layout: Layout, point: Point): boolean {
  return (
    pickTopShapeAtPoint(layout.shapes, point) !== null ||
    pickWireAtPoint(layout.wires, point) !== null
  );
}

export function collectRegionSelection(
  layout: Layout,
  region: Rect,
): { shapeIds: string[]; wireIds: string[] } {
  const deviceIds = new Set<string>();
  const shapeIds = new Set<string>();

  for (const shape of layout.shapes) {
    const box = shapeBBox(shape);
    if (!rectsIntersect(box, region)) continue;
    if (shape.deviceId) {
      deviceIds.add(shape.deviceId);
    } else {
      shapeIds.add(shape.id);
    }
  }

  for (const shape of layout.shapes) {
    if (shape.deviceId && deviceIds.has(shape.deviceId)) {
      shapeIds.add(shape.id);
    }
  }

  const wireIds = layout.wires
    .filter((wire) => wireIntersectsRect(wire, region))
    .map((wire) => wire.id);

  return { shapeIds: [...shapeIds], wireIds };
}

export function cloneLayout(layout: Layout): Layout {
  return structuredClone(layout);
}
