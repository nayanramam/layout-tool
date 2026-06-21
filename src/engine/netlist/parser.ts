import type { DeviceType, Netlist, NetlistDevice, NetlistNet } from '../../types';
import { createId } from '../geometry';

const NMOS_PATTERNS = [
  /sky130_fd_pr__nfet/i,
  /nfet/i,
  /nmos/i,
  /nch/i,
];

const PMOS_PATTERNS = [
  /sky130_fd_pr__pfet/i,
  /pfet/i,
  /pmos/i,
  /pch/i,
];

function detectDeviceType(model: string): DeviceType | null {
  if (NMOS_PATTERNS.some((pattern) => pattern.test(model))) return 'nmos';
  if (PMOS_PATTERNS.some((pattern) => pattern.test(model))) return 'pmos';
  return null;
}

function parseValue(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const cleaned = raw.replace(/[{}]/g, '').trim();
  const numeric = Number.parseFloat(cleaned);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function stripComments(line: string): string {
  const hash = line.indexOf('*');
  const semi = line.indexOf(';');
  const cut = [hash, semi].filter((idx) => idx >= 0).sort((a, b) => a - b)[0];
  return cut === undefined ? line : line.slice(0, cut);
}

function tokenizeParams(paramBlock: string): Record<string, string> {
  const params: Record<string, string> = {};
  const regex = /(\w+)\s*=\s*([^=\s]+(?:\s*[^=\s]+)*?)(?=\s+\w+\s*=|$)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(paramBlock)) !== null) {
    params[match[1].toLowerCase()] = match[2].trim();
  }
  return params;
}

function buildNets(devices: NetlistDevice[]): NetlistNet[] {
  const netMap = new Map<string, NetlistNet>();

  for (const device of devices) {
    const entries: { terminal: 'd' | 'g' | 's' | 'b'; net: string }[] = [
      { terminal: 'd', net: device.terminals.d },
      { terminal: 'g', net: device.terminals.g },
      { terminal: 's', net: device.terminals.s },
      { terminal: 'b', net: device.terminals.b },
    ];

    for (const entry of entries) {
      const existing = netMap.get(entry.net) ?? { name: entry.net, pins: [] };
      existing.pins.push({ device: device.name, terminal: entry.terminal });
      netMap.set(entry.net, existing);
    }
  }

  return [...netMap.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function parseSpiceNetlist(source: string): Netlist {
  const lines = source
    .split(/\r?\n/)
    .map((line) => stripComments(line).trim())
    .filter(Boolean);

  let subcktName = 'top';
  const devices: NetlistDevice[] = [];
  let inSubckt = false;

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.startsWith('.subckt')) {
      const parts = line.split(/\s+/);
      subcktName = parts[1] ?? 'top';
      inSubckt = true;
      continue;
    }
    if (lower.startsWith('.ends')) {
      inSubckt = false;
      continue;
    }
    if (line.startsWith('.')) continue;
    if (!inSubckt && !devices.length && !line.startsWith('*')) {
      // Allow flat netlists without explicit subckt wrapper.
      inSubckt = true;
    }
    if (!inSubckt) continue;

    const match = line.match(/^(\w+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)(?:\s+(.*))?$/i);
    if (!match) continue;

    const [, name, d, g, s, b, model, paramBlock = ''] = match;
    const deviceType = detectDeviceType(model);
    if (!deviceType) continue;

    const params = tokenizeParams(paramBlock);
    const W = parseValue(params.w ?? params.width, 1);
    const L = parseValue(params.l ?? params.length, 0.15);
    const fingers = parseValue(params.nf ?? params.fingers, 1);

    devices.push({
      id: createId('nldev'),
      name,
      type: deviceType,
      W,
      L,
      fingers: Math.max(1, Math.round(fingers)),
      terminals: { d, g, s, b },
    });
  }

  return {
    subcktName,
    devices,
    nets: buildNets(devices),
  };
}

export function loadExampleNetlist(): Netlist {
  return parseSpiceNetlist(`
* CMOS inverter example for sky130 teaching layout
.subckt inv VDD VSS IN OUT
XM1 OUT IN VDD VDD sky130_fd_pr__pfet_01v8 w=2 l=0.15 nf=1
XM2 OUT IN VSS VSS sky130_fd_pr__nfet_01v8 w=1 l=0.15 nf=1
.ends inv
`);
}
