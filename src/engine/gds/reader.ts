import type { LayerId, Shape } from '../../types';
import { createId } from '../geometry';

type ParsedRecord = {
  recordType: number;
  dataType: number;
  data: Uint8Array;
};

function readInt16(data: Uint8Array, offset: number): number {
  return (data[offset] << 8) | data[offset + 1];
}

function readInt32(data: Uint8Array, offset: number): number {
  return (
    (data[offset] << 24) |
    (data[offset + 1] << 16) |
    (data[offset + 2] << 8) |
    data[offset + 3]
  );
}

function parseRecords(buffer: ArrayBuffer): ParsedRecord[] {
  const data = new Uint8Array(buffer);
  const records: ParsedRecord[] = [];
  let offset = 0;
  while (offset + 4 <= data.length) {
    const lengthWords = readInt16(data, offset);
    const lengthBytes = lengthWords * 2;
    if (lengthBytes < 4) break;
    const recordType = data[offset + 2];
    const dataType = data[offset + 3];
    const payload = data.slice(offset + 4, offset + lengthBytes);
    records.push({ recordType, dataType, data: payload });
    offset += lengthBytes;
  }
  return records;
}

const SKY130_LAYER_MAP: Record<string, LayerId> = {
  '64/20': 'nwell',
  '65/20': 'diff',
  '66/20': 'poly',
  '66/44': 'licon',
  '67/20': 'li',
  '67/44': 'mcon',
  '68/20': 'm1',
  '93/44': 'nsdm',
  '94/20': 'psdm',
};

export function importGdsToShapes(buffer: ArrayBuffer, dbuPerMicron = 1000): Shape[] {
  const records = parseRecords(buffer);
  const shapes: Shape[] = [];
  let currentLayer: number | null = null;
  let currentDatatype: number | null = null;

  for (const record of records) {
    if (record.recordType === 0x0d) {
      currentLayer = readInt16(record.data, 0);
    }
    if (record.recordType === 0x0e) {
      currentDatatype = readInt16(record.data, 0);
    }
    if (record.recordType === 0x10 && currentLayer !== null && currentDatatype !== null) {
      const key = `${currentLayer}/${currentDatatype}`;
      const layerId = SKY130_LAYER_MAP[key];
      if (!layerId) continue;

      const points: { x: number; y: number }[] = [];
      for (let i = 0; i + 8 <= record.data.length; i += 8) {
        points.push({
          x: readInt32(record.data, i) / dbuPerMicron,
          y: readInt32(record.data, i + 4) / dbuPerMicron,
        });
      }
      if (points.length >= 4) {
        const xs = points.map((p) => p.x);
        const ys = points.map((p) => p.y);
        shapes.push({
          id: createId('shape'),
          layer: layerId,
          kind: 'rect',
          rect: {
            x: Math.min(...xs),
            y: Math.min(...ys),
            width: Math.max(...xs) - Math.min(...xs),
            height: Math.max(...ys) - Math.min(...ys),
          },
        });
      }
    }
  }

  return shapes;
}

export async function importGdsFile(file: File): Promise<Shape[]> {
  const buffer = await file.arrayBuffer();
  return importGdsToShapes(buffer);
}
