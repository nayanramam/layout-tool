import type { Layout, LayerId, Point, Shape } from '../../types';
import { SKY130_LAYERS } from '../../pdk/sky130';
import { shapeToPolygon } from '../geometry';

type GdsRecord = {
  recordType: number;
  dataType: number;
  data: number[] | string;
};

const RECORD_HEADER = 0;
const RECORD_UNITS = 3;
const RECORD_BGNSTR = 5;
const RECORD_STRNAME = 6;
const RECORD_ENDSTR = 7;
const RECORD_BOUNDARY = 8;
const RECORD_LAYER = 13;
const RECORD_DATATYPE = 14;
const RECORD_XY = 16;
const RECORD_ENDEL = 17;

function encodeInt16(value: number): number[] {
  const v = Math.round(value);
  return [(v >> 8) & 0xff, v & 0xff];
}

function encodeInt32(value: number): number[] {
  const v = Math.round(value);
  return [(v >> 24) & 0xff, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}

function encodeFloat64(value: number): number[] {
  const buffer = new ArrayBuffer(8);
  new DataView(buffer).setFloat64(0, value, false);
  return [...new Uint8Array(buffer)];
}

function encodeString(value: string): number[] {
  const padded =
    value.length % 2 === 0 ? value : `${value}\0`;
  const bytes: number[] = [];
  for (let i = 0; i < padded.length; i += 1) {
    bytes.push(padded.charCodeAt(i) & 0xff);
  }
  return bytes;
}

function makeRecord(recordType: number, dataType: number, data: number[] | string): GdsRecord {
  return { recordType, dataType, data };
}

function recordBytes(record: GdsRecord): number[] {
  const payload =
    typeof record.data === 'string'
      ? encodeString(record.data)
      : record.data;
  const length = 4 + payload.length;
  const sizeWords = length / 2;
  return [...encodeInt16(sizeWords), record.recordType, record.dataType, ...payload];
}

function micronsToDbu(value: number, dbuPerMicron: number): number {
  return Math.round(value * dbuPerMicron);
}

function layerInfo(layerId: LayerId): { layer: number; datatype: number } {
  const layer = SKY130_LAYERS[layerId];
  return { layer: layer.gdsNumber, datatype: layer.datatype };
}

function shapeToBoundaryRecords(shape: Shape, dbuPerMicron: number): GdsRecord[] {
  const { layer, datatype } = layerInfo(shape.layer);
  const polygon = shapeToPolygon(shape);
  const xy: number[] = [];
  for (const point of polygon) {
    xy.push(...encodeInt32(micronsToDbu(point.x, dbuPerMicron)));
    xy.push(...encodeInt32(micronsToDbu(point.y, dbuPerMicron)));
  }
  if (polygon.length > 0) {
    xy.push(...encodeInt32(micronsToDbu(polygon[0].x, dbuPerMicron)));
    xy.push(...encodeInt32(micronsToDbu(polygon[0].y, dbuPerMicron)));
  }

  return [
    makeRecord(RECORD_BOUNDARY, 0x00, []),
    makeRecord(RECORD_LAYER, 0x02, encodeInt16(layer)),
    makeRecord(RECORD_DATATYPE, 0x02, encodeInt16(datatype)),
    makeRecord(RECORD_XY, 0x03, xy),
    makeRecord(RECORD_ENDEL, 0x00, []),
  ];
}

function wireToPathRecords(points: Point[], layerId: LayerId, width: number, dbuPerMicron: number): GdsRecord[] {
  const { layer, datatype } = layerInfo(layerId);
  if (points.length < 2) return [];

  const half = width / 2;
  const upper: Point[] = [];
  const lower: Point[] = [];

  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const prev = points[i - 1] ?? current;
    const next = points[i + 1] ?? current;
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    upper.push({ x: current.x + nx * half, y: current.y + ny * half });
    lower.push({ x: current.x - nx * half, y: current.y - ny * half });
  }

  const polygon = [...upper, ...lower.reverse()];
  const xy: number[] = [];
  for (const point of polygon) {
    xy.push(...encodeInt32(micronsToDbu(point.x, dbuPerMicron)));
    xy.push(...encodeInt32(micronsToDbu(point.y, dbuPerMicron)));
  }
  if (polygon.length > 0) {
    xy.push(...encodeInt32(micronsToDbu(polygon[0].x, dbuPerMicron)));
    xy.push(...encodeInt32(micronsToDbu(polygon[0].y, dbuPerMicron)));
  }

  return [
    makeRecord(RECORD_BOUNDARY, 0x00, []),
    makeRecord(RECORD_LAYER, 0x02, encodeInt16(layer)),
    makeRecord(RECORD_DATATYPE, 0x02, encodeInt16(datatype)),
    makeRecord(RECORD_XY, 0x03, xy),
    makeRecord(RECORD_ENDEL, 0x00, []),
  ];
}

export function exportLayoutToGds(layout: Layout, dbuPerMicron = 1000): Uint8Array {
  const records: GdsRecord[] = [
    makeRecord(RECORD_HEADER, 0x06, encodeInt16(600)),
    makeRecord(RECORD_UNITS, 0x05, [
      ...encodeFloat64(1 / dbuPerMicron),
      ...encodeFloat64(1 / dbuPerMicron),
    ]),
    makeRecord(RECORD_BGNSTR, 0x02, [
      ...encodeInt16(2026),
      ...encodeInt16(1),
      ...encodeInt16(1),
      ...encodeInt16(0),
      ...encodeInt16(0),
      ...encodeInt16(0),
      ...encodeInt16(2026),
      ...encodeInt16(1),
      ...encodeInt16(1),
      ...encodeInt16(0),
      ...encodeInt16(0),
      ...encodeInt16(0),
    ]),
    makeRecord(RECORD_STRNAME, 0x06, layout.cellName || 'layout_cell'),
  ];

  for (const shape of layout.shapes) {
    records.push(...shapeToBoundaryRecords(shape, dbuPerMicron));
  }

  for (const wire of layout.wires) {
    records.push(...wireToPathRecords(wire.points, wire.layer, wire.width, dbuPerMicron));
  }

  records.push(makeRecord(RECORD_ENDSTR, 0x00, []));
  records.push(makeRecord(RECORD_ENDEL, 0x00, []));

  const bytes = records.flatMap((record) => recordBytes(record));
  return new Uint8Array(bytes);
}

export function downloadGds(layout: Layout, filename = 'layout.gds'): void {
  const data = exportLayoutToGds(layout);
  const blob = new Blob([new Uint8Array(data)], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export const CADENCE_IMPORT_NOTES = `
Cadence Virtuoso stream-in:
1. In Virtuoso, choose File > Import > Stream.
2. Select the exported .gds file.
3. Map layers using the sky130 layer map (e.g. 64/20 nwell, 65/20 diff, 66/20 poly, 67/20 li, 68/20 m1).
4. Set database units to match export (1 user unit = 0.001um if DBU=1000).
5. Open the imported cell and verify connectivity before signoff DRC/LVS.
`.trim();
