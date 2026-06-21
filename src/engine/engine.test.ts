import { describe, expect, it } from 'vitest';
import { runDRC } from './drc';
import { getDrcHelp, hitDrcViolation } from './drc/explanations';
import { parseSpiceNetlist } from '../engine/netlist/parser';
import { runHints } from '../engine/hints';
import { runLVSLite } from '../engine/lvs';
import { createMosDevice } from '../engine/pcells/mos';
import { pickTopShapeAtPoint, zoomToFitView, computeLayoutBounds, boundsForZoomFit, collectRegionSelection, expandSelectionShapeIds } from '../engine/geometry/view';
import type { Layout } from '../types';

describe('parseSpiceNetlist', () => {
  it('parses sky130 inverter subckt', () => {
    const netlist = parseSpiceNetlist(`
.subckt inv VDD VSS IN OUT
XM1 OUT IN VDD VDD sky130_fd_pr__pfet_01v8 w=2 l=0.15
XM2 OUT IN VSS VSS sky130_fd_pr__nfet_01v8 w=1 l=0.15
.ends
`);
    expect(netlist.devices).toHaveLength(2);
    expect(netlist.devices[0].type).toBe('pmos');
    expect(netlist.devices[1].W).toBe(1);
    expect(netlist.nets.some((net) => net.name === 'OUT')).toBe(true);
  });
});

describe('runDRC', () => {
  it('flags PMOS diffusion without nwell', () => {
    const pmos = createMosDevice('pmos', { x: 0, y: 0 }, 2, 0.15, 1, 'MP1');
    const layout: Layout = {
      cellName: 'test',
      shapes: pmos.shapes.filter((shape) => shape.layer !== 'nwell'),
      devices: [pmos.device],
      wires: [],
      labels: [],
    };
    const violations = runDRC(layout);
    expect(violations.some((v) => v.ruleId.includes('nwell'))).toBe(true);
  });
});

describe('getDrcHelp', () => {
  it('explains poly-to-diff spacing in plain language', () => {
    const help = getDrcHelp({
      id: 'drc1',
      ruleId: 'diff:poly.spacing',
      message: 'poly/diff: min spacing 0.155um, found 0.100um',
      layer: 'poly',
      severity: 'error',
      bbox: { x: 0, y: 0, width: 1, height: 1 },
      shapeIds: ['a', 'b'],
    });
    expect(help.explanation.toLowerCase()).toContain('gate');
    expect(help.suggestion).toContain('0.055');
  });

  it('suggests widening for min-width violations', () => {
    const help = getDrcHelp({
      id: 'drc2',
      ruleId: 'poly.width',
      message: 'poly: min width 0.15um, found 0.120um',
      layer: 'poly',
      severity: 'error',
      bbox: { x: 0, y: 0, width: 1, height: 0.12 },
      shapeIds: ['a'],
    });
    expect(help.suggestion).toContain('0.15');
    expect(help.suggestion).toContain('0.12');
  });
});

describe('hitDrcViolation', () => {
  it('returns violation when pointer is inside marker bbox', () => {
    const violation = {
      id: 'drc3',
      ruleId: 'poly.width',
      message: 'poly too narrow',
      layer: 'poly' as const,
      severity: 'error' as const,
      bbox: { x: 1, y: 2, width: 0.5, height: 0.5 },
      shapeIds: ['a'],
    };
    expect(hitDrcViolation({ x: 1.2, y: 2.2 }, [violation], 100)).toBe(violation);
    expect(hitDrcViolation({ x: 5, y: 5 }, [violation], 100)).toBeNull();
  });
});

describe('runLVSLite', () => {
  it('reports missing devices before placement', () => {
    const netlist = parseSpiceNetlist(`
.subckt inv VDD VSS IN OUT
XM1 OUT IN VDD VDD sky130_fd_pr__pfet_01v8 w=2 l=0.15
XM2 OUT IN VSS VSS sky130_fd_pr__nfet_01v8 w=1 l=0.15
.ends
`);
    const layout: Layout = { cellName: 'inv', shapes: [], devices: [], wires: [], labels: [] };
    const items = runLVSLite(layout, netlist);
    expect(items.some((item) => item.status === 'missing' && item.kind === 'component')).toBe(true);
  });
});

describe('runHints', () => {
  it('warns about narrow width', () => {
    const nmos = createMosDevice('nmos', { x: 0, y: 0 }, 0.3, 0.15, 1, 'MN1');
    const layout: Layout = {
      cellName: 'test',
      shapes: nmos.shapes,
      devices: [nmos.device],
      wires: [],
      labels: [],
    };
    const hints = runHints(layout);
    expect(hints.some((hint) => hint.category === 'resistance')).toBe(true);
  });
});

describe('device group selection', () => {
  it('picks a shape inside a transistor device', () => {
    const pmos = createMosDevice('pmos', { x: 1, y: 1 }, 2, 0.15, 1, 'MP1');
    const poly = pmos.shapes.find((shape) => shape.layer === 'poly');
    expect(poly?.rect).toBeTruthy();
    const hit = pickTopShapeAtPoint(pmos.shapes, {
      x: poly!.rect!.x + poly!.rect!.width / 2,
      y: poly!.rect!.y + poly!.rect!.height / 2,
    });
    expect(hit?.deviceId).toBe(pmos.device.id);
  });
});

describe('collectRegionSelection', () => {
  it('selects full transistor when region touches one layer', () => {
    const pmos = createMosDevice('pmos', { x: 1, y: 1 }, 2, 0.15, 1, 'MP1');
    const poly = pmos.shapes.find((shape) => shape.layer === 'poly');
    const region = {
      x: poly!.rect!.x,
      y: poly!.rect!.y,
      width: poly!.rect!.width,
      height: poly!.rect!.height,
    };
    const selection = collectRegionSelection(
      {
        cellName: 'test',
        shapes: pmos.shapes,
        devices: [pmos.device],
        wires: [],
        labels: [],
      },
      region,
    );
    expect(selection.shapeIds.length).toBe(pmos.shapes.length);
  });
});

describe('expandSelectionShapeIds', () => {
  it('includes every shape for selected devices', () => {
    const pmos = createMosDevice('pmos', { x: 0, y: 0 }, 2, 0.15, 1, 'MP1');
    const nmos = createMosDevice('nmos', { x: 3, y: 0 }, 1, 0.15, 1, 'MN1');
    const layout: Layout = {
      cellName: 'test',
      shapes: [...pmos.shapes, ...nmos.shapes],
      devices: [pmos.device, nmos.device],
      wires: [],
      labels: [],
    };
    const poly = pmos.shapes.find((shape) => shape.layer === 'poly')!;
    const expanded = expandSelectionShapeIds(layout, [poly.id, ...nmos.shapes.map((shape) => shape.id)]);
    expect(expanded.size).toBe(pmos.shapes.length + nmos.shapes.length);
  });
});

describe('zoomToFitView', () => {
  it('returns centered view for layout bounds with margin', () => {
    const nmos = createMosDevice('nmos', { x: 0, y: 0 }, 1, 0.15, 1, 'MN1');
    const layout = {
      cellName: 'x',
      shapes: nmos.shapes,
      devices: [nmos.device],
      wires: [],
      labels: [],
    };
    const bounds = boundsForZoomFit(layout);
    expect(bounds).not.toBeNull();
    const view = zoomToFitView(bounds!, 800, 600);
    expect(view.zoom).toBeGreaterThan(0);
    expect(view.zoom).toBeLessThan(400);
    expect(Number.isFinite(view.panX)).toBe(true);
  });

  it('uses wider bounds than raw geometry so fit does not over-zoom', () => {
    const nmos = createMosDevice('nmos', { x: 0, y: 0 }, 1, 0.15, 1, 'MN1');
    const layout = {
      cellName: 'x',
      shapes: nmos.shapes,
      devices: [nmos.device],
      wires: [],
      labels: [],
    };
    const raw = computeLayoutBounds(layout);
    const padded = boundsForZoomFit(layout)!;
    const rawFit = zoomToFitView(raw, 800, 600).zoom;
    const paddedFit = zoomToFitView(padded, 800, 600).zoom;
    expect(paddedFit).toBeLessThan(rawFit);
  });
});
