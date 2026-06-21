import { describe, expect, it } from 'vitest';
import { runDRC } from '../engine/drc';
import { parseSpiceNetlist } from '../engine/netlist/parser';
import { runHints } from '../engine/hints';
import { runLVSLite } from '../engine/lvs';
import { createMosDevice } from '../engine/pcells/mos';
import { pickTopShapeAtPoint, zoomToFitView, computeLayoutBounds, collectRegionSelection } from '../engine/geometry/view';
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

describe('zoomToFitView', () => {
  it('returns centered view for layout bounds', () => {
    const nmos = createMosDevice('nmos', { x: 0, y: 0 }, 1, 0.15, 1, 'MN1');
    const bounds = computeLayoutBounds({
      cellName: 'x',
      shapes: nmos.shapes,
      devices: [nmos.device],
      wires: [],
      labels: [],
    });
    const view = zoomToFitView(bounds, 800, 600);
    expect(view.zoom).toBeGreaterThan(0);
    expect(Number.isFinite(view.panX)).toBe(true);
  });
});
