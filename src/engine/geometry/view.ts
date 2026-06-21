import type { Layout, Point, Rect, Shape, Wire } from '../../types';
import { LAYER_ORDER } from '../../pdk/sky130';
import { expandRect, shapeBBox } from './index';

const EMPTY_BOUNDS: Rect = { x: -2, y: -2, width: 4, height: 4 };

function wireBBox(wire: Wire): Rect | null {
  if (wire.points.length === 0) return null;
  const xs = wire.points.map((p) => p.x);
  const ys = wire.points.map((p) => p.y);
  const half = wire.width / 2 + 0.02;
  const minX = Math.min(...xs) - half;
  const minY = Math.min(...ys) - half;
  const maxX = Math.max(...xs) + half;
  const maxY = Math.max(...ys) + half;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function layoutHasContent(layout: Layout): boolean {
  return layout.shapes.length > 0 || layout.wires.length > 0 || layout.devices.length > 0;
}

export function computeLayoutBounds(layout: Layout): Rect {
  const boxes: Rect[] = [];

  for (const shape of layout.shapes) {
    boxes.push(shapeBBox(shape));
  }

  for (const wire of layout.wires) {
    const box = wireBBox(wire);
    if (box) boxes.push(box);
  }

  for (const device of layout.devices) {
    for (const point of Object.values(device.terminals)) {
      boxes.push({ x: point.x - 0.06, y: point.y - 0.06, width: 0.12, height: 0.12 });
    }
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

/** Bounds with generous margin for zoom-to-fit (Cadence-style fit all). */
export function boundsForZoomFit(layout: Layout): Rect | null {
  if (!layoutHasContent(layout)) return null;

  const raw = computeLayoutBounds(layout);
  const margin = Math.max(1.0, raw.width * 0.25, raw.height * 0.25);
  return expandRect(raw, margin);
}

export function zoomToFitView(
  bounds: Rect,
  viewportWidth: number,
  viewportHeight: number,
  paddingPx = 48,
): { panX: number; panY: number; zoom: number } {
  if (viewportWidth <= 0 || viewportHeight <= 0) {
    return { panX: 120, panY: 120, zoom: 120 };
  }

  const contentWidth = Math.max(bounds.width, 0.05);
  const contentHeight = Math.max(bounds.height, 0.05);
  const availableWidth = Math.max(viewportWidth - paddingPx * 2, 1);
  const availableHeight = Math.max(viewportHeight - paddingPx * 2, 1);

  const fitZoom = Math.min(availableWidth / contentWidth, availableHeight / contentHeight);
  const zoom = Math.min(400, Math.max(8, fitZoom));

  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;

  return {
    zoom,
    panX: viewportWidth / 2 - centerX * zoom,
    panY: viewportHeight / 2 - centerY * zoom,
  };
}

export const DEFAULT_VIEW = { panX: 120, panY: 120, zoom: 120 };

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

export function hitIsInCurrentSelection(
  layout: Layout,
  point: Point,
  selectedShapeIds: string[],
  selectedWireIds: string[],
): boolean {
  if (selectedShapeIds.length === 0 && selectedWireIds.length === 0) return false;

  const shapeIds = new Set(selectedShapeIds);
  const wireIds = new Set(selectedWireIds);

  const hit = pickTopShapeAtPoint(layout.shapes, point);
  if (hit) {
    if (shapeIds.has(hit.id)) return true;
    if (hit.deviceId) {
      return layout.shapes
        .filter((shape) => shape.deviceId === hit.deviceId)
        .some((shape) => shapeIds.has(shape.id));
    }
    return false;
  }

  const wire = pickWireAtPoint(layout.wires, point);
  return wire !== null && wireIds.has(wire.id);
}

export function expandSelectionShapeIds(layout: Layout, selectedShapeIds: string[]): Set<string> {
  const shapeIds = new Set(selectedShapeIds);
  const deviceIds = new Set<string>();

  for (const id of shapeIds) {
    const shape = layout.shapes.find((entry) => entry.id === id);
    if (shape?.deviceId) deviceIds.add(shape.deviceId);
  }

  for (const shape of layout.shapes) {
    if (shape.deviceId && deviceIds.has(shape.deviceId)) {
      shapeIds.add(shape.id);
    }
  }

  return shapeIds;
}

export function cloneLayout(layout: Layout): Layout {
  return structuredClone(layout);
}
