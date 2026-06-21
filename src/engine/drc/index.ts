import type { DeviceInstance, DRCViolation, Layout, LayerId, Shape } from '../../types';
import { SKY130_RULES } from '../../pdk/sky130';
import {
  createId,
  enclosureDeficit,
  minRectSpacing,
  rectArea,
  rectMinWidth,
  shapeBBox,
} from '../geometry';
import { ShapeIndex } from '../geometry/spatialIndex';

function violation(
  ruleId: string,
  message: string,
  layer: LayerId,
  shapeIds: string[],
  bbox = { x: 0, y: 0, width: 0, height: 0 },
): DRCViolation {
  return {
    id: createId('drc'),
    ruleId,
    message,
    layer,
    severity: 'error',
    bbox,
    shapeIds,
  };
}

function checkMinWidth(shapes: Shape[]): DRCViolation[] {
  const violations: DRCViolation[] = [];
  for (const shape of shapes) {
    const minWidth = SKY130_RULES.minWidth[shape.layer];
    if (!minWidth || !shape.rect) continue;
    const actual = rectMinWidth(shape.rect);
    if (actual + 1e-6 < minWidth) {
      violations.push(
        violation(
          `${shape.layer}.width`,
          `${shape.layer}: min width ${minWidth}um, found ${actual.toFixed(3)}um`,
          shape.layer,
          [shape.id],
          shapeBBox(shape),
        ),
      );
    }
  }
  return violations;
}

function checkMinArea(shapes: Shape[]): DRCViolation[] {
  const violations: DRCViolation[] = [];
  for (const shape of shapes) {
    const minArea = SKY130_RULES.minArea[shape.layer];
    if (!minArea || !shape.rect) continue;
    const area = rectArea(shape.rect);
    if (area + 1e-6 < minArea) {
      violations.push(
        violation(
          `${shape.layer}.area`,
          `${shape.layer}: min area ${minArea}um², found ${area.toFixed(4)}um²`,
          shape.layer,
          [shape.id],
          shapeBBox(shape),
        ),
      );
    }
  }
  return violations;
}

function spacingKey(a: LayerId, b: LayerId): string {
  return [a, b].sort().join(':');
}

function checkSpacing(shapes: Shape[], index: ShapeIndex): DRCViolation[] {
  const violations: DRCViolation[] = [];
  const ruleMap = new Map<string, number>();
  for (const rule of SKY130_RULES.minSpacing) {
    ruleMap.set(spacingKey(rule.layerA, rule.layerB), rule.minSpacing);
  }

  for (const shape of shapes) {
    const bbox = shapeBBox(shape);
    const neighbors = index.queryNeighbors(shape, 2);
    for (const neighbor of neighbors) {
      const key = spacingKey(shape.layer, neighbor.layer);
      const required = ruleMap.get(key);
      if (!required) continue;
      const actual = minRectSpacing(shapeBBox(shape), shapeBBox(neighbor));
      if (actual + 1e-6 < required) {
        violations.push(
          violation(
            `${key}.spacing`,
            `${shape.layer}/${neighbor.layer}: min spacing ${required}um, found ${actual.toFixed(3)}um`,
            shape.layer,
            [shape.id, neighbor.id],
            bbox,
          ),
        );
      }
    }
  }
  return violations;
}

function checkEnclosure(shapes: Shape[], devices: DeviceInstance[]): DRCViolation[] {
  const violations: DRCViolation[] = [];
  const byLayer = new Map<LayerId, Shape[]>();
  for (const shape of shapes) {
    const list = byLayer.get(shape.layer) ?? [];
    list.push(shape);
    byLayer.set(shape.layer, list);
  }

  for (const rule of SKY130_RULES.enclosure) {
    const enclosingShapes = byLayer.get(rule.enclosing) ?? [];
    const enclosedShapes = byLayer.get(rule.enclosed) ?? [];

    for (const enclosed of enclosedShapes) {
      const enclosedBox = shapeBBox(enclosed);
      const relevantEnclosing = enclosingShapes.filter((candidate) => {
        const box = shapeBBox(candidate);
        return !(
          box.x + box.width < enclosedBox.x ||
          box.y + box.height < enclosedBox.y ||
          box.x > enclosedBox.x + enclosedBox.width ||
          box.y > enclosedBox.y + enclosedBox.height
        );
      });

      if (relevantEnclosing.length === 0) {
        if (rule.enclosing === 'nwell' && rule.enclosed === 'diff') {
          const pmosDevice = devices.find(
            (device) =>
              device.type === 'pmos' &&
              device.id === enclosed.deviceId,
          );
          if (pmosDevice) {
            violations.push(
              violation(
                'nwell.enclosure',
                'PMOS diffusion must be enclosed by N-well',
                'nwell',
                [enclosed.id],
                enclosedBox,
              ),
            );
          }
        }
        continue;
      }

      let bestDeficit = Number.POSITIVE_INFINITY;
      for (const enclosing of relevantEnclosing) {
        const deficit = enclosureDeficit(shapeBBox(enclosing), enclosedBox, rule.minEnclosure);
        bestDeficit = Math.min(bestDeficit, deficit);
      }

      if (bestDeficit > 1e-6) {
        violations.push(
          violation(
            `${rule.enclosing}.encloses.${rule.enclosed}`,
            `${rule.enclosing} must enclose ${rule.enclosed} by ${rule.minEnclosure}um`,
            rule.enclosing,
            [enclosed.id],
            enclosedBox,
          ),
        );
      }
    }
  }

  return violations;
}

function checkImplantCoverage(shapes: Shape[], devices: DeviceInstance[]): DRCViolation[] {
  const violations: DRCViolation[] = [];
  const diffShapes = shapes.filter((shape) => shape.layer === 'diff' && shape.deviceId);

  for (const diff of diffShapes) {
    const device = devices.find((entry) => entry.id === diff.deviceId);
    if (!device) continue;
    const implantLayer: LayerId = device.type === 'nmos' ? 'nsdm' : 'psdm';
    const implant = shapes.find(
      (shape) => shape.layer === implantLayer && shape.deviceId === device.id,
    );
    if (!implant) {
      violations.push(
        violation(
          `${implantLayer}.missing`,
          `${device.type.toUpperCase()} diffusion requires ${implantLayer.toUpperCase()} implant`,
          implantLayer,
          [diff.id],
          shapeBBox(diff),
        ),
      );
    }
  }

  return violations;
}

export function runDRC(layout: Layout): DRCViolation[] {
  const index = new ShapeIndex();
  index.rebuild(layout.shapes);

  const results = [
    ...checkMinWidth(layout.shapes),
    ...checkMinArea(layout.shapes),
    ...checkSpacing(layout.shapes, index),
    ...checkEnclosure(layout.shapes, layout.devices),
    ...checkImplantCoverage(layout.shapes, layout.devices),
  ];

  const seen = new Set<string>();
  return results.filter((item) => {
    const key = `${item.ruleId}:${item.shapeIds.sort().join(',')}:${item.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function runLiveDRC(layout: Layout): DRCViolation[] {
  return runDRC(layout);
}
