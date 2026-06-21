import RBush from 'rbush';
import type { Rect, Shape } from '../../types';
import { expandRect, shapeBBox } from '../geometry';

export type IndexedShape = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  shape: Shape;
};

export class ShapeIndex {
  private tree = new RBush<IndexedShape>();

  rebuild(shapes: Shape[]): void {
    this.tree.clear();
    const items = shapes.map((shape) => {
      const bbox = shapeBBox(shape);
      return {
        minX: bbox.x,
        minY: bbox.y,
        maxX: bbox.x + bbox.width,
        maxY: bbox.y + bbox.height,
        shape,
      };
    });
    this.tree.load(items);
  }

  queryBBox(bbox: Rect): Shape[] {
    return this.tree
      .search({
        minX: bbox.x,
        minY: bbox.y,
        maxX: bbox.x + bbox.width,
        maxY: bbox.y + bbox.height,
      })
      .map((item) => item.shape);
  }

  queryNeighbors(shape: Shape, margin = 0): Shape[] {
    const bbox = expandRect(shapeBBox(shape), margin);
    return this.queryBBox(bbox).filter((candidate) => candidate.id !== shape.id);
  }
}
