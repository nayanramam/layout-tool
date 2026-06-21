import type {
  DeviceInstance,
  DeviceType,
  Layout,
  LVSItem,
  LVSItemKind,
  Netlist,
  NetlistDevice,
} from '../../types';
import { createId, shapeBBox } from '../geometry';

function extractLayoutDevices(layout: Layout): DeviceInstance[] {
  return layout.devices;
}

function compareDimensions(a: NetlistDevice, b: DeviceInstance): boolean {
  return (
    Math.abs(a.W - b.W) < 0.05 &&
    Math.abs(a.L - b.L) < 0.05 &&
    a.type === b.type
  );
}

function makeItem(
  kind: LVSItemKind,
  status: LVSItem['status'],
  label: string,
  detail: string,
): LVSItem {
  return {
    id: createId('lvs'),
    kind,
    status,
    label,
    detail,
  };
}

export function runLVSLite(layout: Layout, netlist: Netlist | null): LVSItem[] {
  if (!netlist) {
    return [
      makeItem(
        'component',
        'missing',
        'Netlist not loaded',
        'Upload a SPICE/CDL netlist to compare layout against schematic.',
      ),
    ];
  }

  const items: LVSItem[] = [];
  const layoutDevices = extractLayoutDevices(layout);
  const matchedLayout = new Set<string>();
  const matchedNetlist = new Set<string>();

  for (const nlDevice of netlist.devices) {
    const match = layoutDevices.find(
      (device) =>
        !matchedLayout.has(device.id) &&
        device.type === nlDevice.type &&
        compareDimensions(nlDevice, device),
    );

    if (match) {
      matchedLayout.add(match.id);
      matchedNetlist.add(nlDevice.id);
      items.push(
        makeItem(
          'component',
          'matched',
          nlDevice.name,
          `${nlDevice.type.toUpperCase()} W=${nlDevice.W} L=${nlDevice.L} found in layout`,
        ),
      );
    } else {
      items.push(
        makeItem(
          'component',
          'missing',
          nlDevice.name,
          `Missing ${nlDevice.type.toUpperCase()} W=${nlDevice.W} L=${nlDevice.L} in layout`,
        ),
      );
    }
  }

  for (const layoutDevice of layoutDevices) {
    if (!matchedLayout.has(layoutDevice.id)) {
      items.push(
        makeItem(
          'component',
          'extra',
          layoutDevice.name,
          `Extra ${layoutDevice.type.toUpperCase()} in layout not present in netlist`,
        ),
      );
    }
  }

  for (const net of netlist.nets) {
    const routed = layout.wires.some((wire) => wire.net === net.name);
    const labeled = layout.labels.some((label) => label.net === net.name);
    const terminalTouched = net.pins.some((pin) => {
      const device = layout.devices.find((entry) => entry.name === pin.device);
      if (!device) return false;
      const terminalPoint = device.terminals[pin.terminal];
      return layout.shapes.some((shape) => {
        if (!['licon', 'li', 'm1', 'mcon'].includes(shape.layer)) return false;
        const box = shapeBBox(shape);
        return (
          terminalPoint.x >= box.x - 0.2 &&
          terminalPoint.x <= box.x + box.width + 0.2 &&
          terminalPoint.y >= box.y - 0.2 &&
          terminalPoint.y <= box.y + box.height + 0.2
        );
      });
    });

    if (routed || labeled || terminalTouched) {
      items.push(
        makeItem(
          'net',
          'matched',
          net.name,
          `Net ${net.name} appears routed or labeled in layout`,
        ),
      );
    } else {
      items.push(
        makeItem(
          'net',
          'missing',
          net.name,
          `Net ${net.name} has no visible routing or label in layout`,
        ),
      );
    }
  }

  for (const net of netlist.nets) {
    for (let i = 0; i < net.pins.length; i += 1) {
      for (let j = i + 1; j < net.pins.length; j += 1) {
        const a = net.pins[i];
        const b = net.pins[j];
        const deviceA = layout.devices.find((entry) => entry.name === a.device);
        const deviceB = layout.devices.find((entry) => entry.name === b.device);
        if (!deviceA || !deviceB) continue;

        const connected = layout.wires.some((wire) => wire.net === net.name);
        items.push(
          makeItem(
            'connection',
            connected ? 'matched' : 'missing',
            `${a.device}.${a.terminal} ↔ ${b.device}.${b.terminal}`,
            connected
              ? `Connection on net ${net.name} appears routed`
              : `Expected connection on net ${net.name} is not routed yet`,
          ),
        );
      }
    }
  }

  return items;
}

export function filterLVSItems(
  items: LVSItem[],
  kind: LVSItemKind | 'all',
  status: LVSItem['status'] | 'all',
): LVSItem[] {
  return items.filter((item) => {
    const kindOk = kind === 'all' || item.kind === kind;
    const statusOk = status === 'all' || item.status === status;
    return kindOk && statusOk;
  });
}

export function summarizeDeviceFromLayout(layout: Layout, type: DeviceType): number {
  return layout.devices.filter((device) => device.type === type).length;
}
