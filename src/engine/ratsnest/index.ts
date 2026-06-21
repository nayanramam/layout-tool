import type { Layout, Netlist, Point, RatsnestLine, TerminalHighlight } from '../../types';
import { distance } from '../geometry';

export function buildRatsnestLines(layout: Layout, netlist: Netlist | null): RatsnestLine[] {
  if (!netlist) return [];

  const lines: RatsnestLine[] = [];
  for (const net of netlist.nets) {
    const points: Point[] = [];
    for (const pin of net.pins) {
      const device = layout.devices.find((entry) => entry.name === pin.device);
      if (!device) continue;
      points.push(device.terminals[pin.terminal]);
    }

    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const routed = layout.wires.some((wire) => wire.net === net.name);
        if (!routed) {
          lines.push({
            net: net.name,
            from: points[i],
            to: points[j],
          });
        }
      }
    }
  }
  return lines;
}

export function highlightSameNetTerminals(
  layout: Layout,
  netlist: Netlist | null,
  activeNet: string | null,
): TerminalHighlight[] {
  if (!netlist || !activeNet) return [];

  const net = netlist.nets.find((entry) => entry.name === activeNet);
  if (!net) return [];

  return net.pins.flatMap((pin) => {
    const device = layout.devices.find((entry) => entry.name === pin.device);
    if (!device) return [];
    return [
      {
        net: activeNet,
        point: device.terminals[pin.terminal],
        deviceName: pin.device,
        terminal: pin.terminal,
      },
    ];
  });
}

export function inferNetFromPoint(
  layout: Layout,
  netlist: Netlist | null,
  point: Point,
  threshold = 0.35,
): string | null {
  if (!netlist) return null;

  let best: { net: string; dist: number } | null = null;
  for (const net of netlist.nets) {
    for (const pin of net.pins) {
      const device = layout.devices.find((entry) => entry.name === pin.device);
      if (!device) continue;
      const terminalPoint = device.terminals[pin.terminal];
      const dist = distance(point, terminalPoint);
      if (dist <= threshold && (!best || dist < best.dist)) {
        best = { net: net.name, dist };
      }
    }
  }
  return best?.net ?? null;
}

export function nearestUnconnectedNet(
  layout: Layout,
  netlist: Netlist | null,
): string | null {
  const lines = buildRatsnestLines(layout, netlist);
  return lines[0]?.net ?? null;
}
