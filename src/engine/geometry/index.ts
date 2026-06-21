import type { Point, Polygon, Rect, Shape } from '../../types';

export function rectFromPoints(p1: Point, p2: Point): Rect {
  const x = Math.min(p1.x, p2.x);
  const y = Math.min(p1.y, p2.y);
  return {
    x,
    y,
    width: Math.abs(p2.x - p1.x),
    height: Math.abs(p2.y - p1.y),
  };
}

export function normalizeRect(rect: Rect): Rect {
  return {
    x: rect.x,
    y: rect.y,
    width: Math.max(rect.width, 0),
    height: Math.max(rect.height, 0),
  };
}

export function shapeToPolygon(shape: Shape): Polygon {
  if (shape.kind === 'polygon' && shape.polygon) {
    return shape.polygon;
  }
  if (shape.rect) {
    const { x, y, width, height } = shape.rect;
    return [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ];
  }
  return [];
}

export function shapeBBox(shape: Shape): Rect {
  const poly = shapeToPolygon(shape);
  if (poly.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const xs = poly.map((p) => p.x);
  const ys = poly.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function expandRect(rect: Rect, margin: number): Rect {
  return {
    x: rect.x - margin,
    y: rect.y - margin,
    width: rect.width + margin * 2,
    height: rect.height + margin * 2,
  };
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function rectCenter(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

export function rectMinWidth(rect: Rect): number {
  return Math.min(rect.width, rect.height);
}

export function rectArea(rect: Rect): number {
  return rect.width * rect.height;
}

export function distance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

export function snapValue(value: number, grid: number): number {
  return Math.round(value / grid) * grid;
}

export function snapPoint(point: Point, grid: number): Point {
  return { x: snapValue(point.x, grid), y: snapValue(point.y, grid) };
}

export function wireLength(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += distance(points[i - 1], points[i]);
  }
  return total;
}

export function pointInRect(point: Point, rect: Rect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

export function rectContainsRect(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

export function minRectSpacing(a: Rect, b: Rect): number {
  const dx = Math.max(0, Math.max(a.x - (b.x + b.width), b.x - (a.x + a.width)));
  const dy = Math.max(0, Math.max(a.y - (b.y + b.height), b.y - (a.y + a.height)));
  return Math.hypot(dx, dy);
}

export function enclosureDeficit(enclosing: Rect, enclosed: Rect, required: number): number {
  const left = enclosed.x - enclosing.x;
  const right = enclosing.x + enclosing.width - (enclosed.x + enclosed.width);
  const bottom = enclosed.y - enclosing.y;
  const top = enclosing.y + enclosing.height - (enclosed.y + enclosed.height);
  const minSide = Math.min(left, right, bottom, top);
  return Math.max(0, required - minSide);
}

export function screenToWorld(
  screenX: number,
  screenY: number,
  panX: number,
  panY: number,
  zoom: number,
): Point {
  return {
    x: (screenX - panX) / zoom,
    y: (screenY - panY) / zoom,
  };
}

export function worldToScreen(
  worldX: number,
  worldY: number,
  panX: number,
  panY: number,
  zoom: number,
): Point {
  return {
    x: worldX * zoom + panX,
    y: worldY * zoom + panY,
  };
}

export function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
