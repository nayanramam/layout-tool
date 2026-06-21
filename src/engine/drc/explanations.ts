import type { DRCViolation, LayerId } from '../../types';
import { SKY130_LAYERS } from '../../pdk/sky130';
import { SKY130_RULES } from '../../pdk/sky130/rules';

export type DrcHelp = {
  explanation: string;
  suggestion: string;
};

function layerName(id: LayerId | string): string {
  const layer = SKY130_LAYERS[id as LayerId];
  return layer?.name ?? id;
}

function parseWidth(message: string): { required?: number; found?: number } {
  const match = message.match(/min width ([\d.]+)um, found ([\d.]+)um/);
  if (!match) return {};
  return { required: Number.parseFloat(match[1]), found: Number.parseFloat(match[2]) };
}

function parseArea(message: string): { required?: number; found?: number } {
  const match = message.match(/min area ([\d.]+)um², found ([\d.]+)um²/);
  if (!match) return {};
  return { required: Number.parseFloat(match[1]), found: Number.parseFloat(match[2]) };
}

function parseSpacing(message: string): {
  layerA?: string;
  layerB?: string;
  required?: number;
  found?: number;
} {
  const match = message.match(/([\w]+)\/([\w]+): min spacing ([\d.]+)um, found ([\d.]+)um/);
  if (!match) return {};
  return {
    layerA: match[1],
    layerB: match[2],
    required: Number.parseFloat(match[3]),
    found: Number.parseFloat(match[4]),
  };
}

function parseEnclosure(message: string): {
  enclosing?: string;
  enclosed?: string;
  required?: number;
} {
  const match = message.match(/(\w+) must enclose (\w+) by ([\d.]+)um/);
  if (!match) return {};
  return {
    enclosing: match[1],
    enclosed: match[2],
    required: Number.parseFloat(match[3]),
  };
}

export function getDrcHelp(violation: DRCViolation): DrcHelp {
  const { ruleId, message } = violation;

  if (ruleId === 'nwell.enclosure') {
    return {
      explanation:
        'PMOS transistors must sit inside an N-well. The well provides the correct body bias for P-type devices. Without it, the device cannot be manufactured correctly.',
      suggestion:
        'Add or extend an N-well rectangle so it fully surrounds the PMOS diffusion with at least 0.18 µm of margin on every side.',
    };
  }

  if (ruleId.endsWith('.missing')) {
    const implantId = ruleId.replace('.missing', '') as LayerId;
    const isN = implantId === 'nsdm';
    return {
      explanation: isN
        ? 'NMOS source/drain regions need an N+ implant (NSDM) so the diffusion is properly doped for N-type behavior.'
        : 'PMOS source/drain regions need a P+ implant (PSDM) so the diffusion is properly doped for P-type behavior.',
      suggestion: isN
        ? 'Place an NSDM layer over the NMOS diffusion, or re-place the NMOS device so the implant is included.'
        : 'Place a PSDM layer over the PMOS diffusion, or re-place the PMOS device so the implant is included.',
    };
  }

  if (ruleId.endsWith('.width')) {
    const layerId = ruleId.replace('.width', '') as LayerId;
    const { required, found } = parseWidth(message);
    const minWidth = required ?? SKY130_RULES.minWidth[layerId];
    const name = layerName(layerId);
    const deficit =
      minWidth && found !== undefined ? (minWidth - found).toFixed(3) : undefined;

    return {
      explanation: `${name} shapes must stay wide enough for the fab process. If a shape is too narrow, it may not print reliably or can break during manufacturing.`,
      suggestion:
        deficit && found !== undefined && minWidth
          ? `Widen this ${name} shape by at least ${deficit} µm so its smallest side is ≥ ${minWidth} µm (currently ${found} µm).`
          : `Widen this ${name} shape until its narrowest dimension meets the minimum width rule.`,
    };
  }

  if (ruleId.endsWith('.area')) {
    const layerId = ruleId.replace('.area', '') as LayerId;
    const { required, found } = parseArea(message);
    const minArea = required ?? SKY130_RULES.minArea[layerId];
    const name = layerName(layerId);

    return {
      explanation: `${name} islands must have enough total area. Very small slivers or specks often fail during etch and can lift off the wafer.`,
      suggestion:
        minArea && found !== undefined
          ? `Enlarge this ${name} shape so its area is at least ${minArea} µm² (currently ${found} µm²).`
          : `Enlarge or merge this ${name} shape until it meets the minimum area rule.`,
    };
  }

  if (ruleId.endsWith('.spacing')) {
    const { layerA, layerB, required, found } = parseSpacing(message);
    const a = layerName(layerA ?? '');
    const b = layerName(layerB ?? '');
    const isPolyDiff =
      (layerA === 'poly' && layerB === 'diff') || (layerA === 'diff' && layerB === 'poly');

    if (isPolyDiff) {
      const gap =
        required !== undefined && found !== undefined
          ? (required - found).toFixed(3)
          : undefined;
      return {
        explanation:
          'Poly (gate) and diffusion must stay separated. If they touch or sit too close, you get an unintended short or a malformed transistor.',
        suggestion: gap
          ? `Move the poly gate or diffusion apart by at least ${gap} µm more (need ${required} µm gap, currently ${found} µm).`
          : 'Separate the poly gate from the diffusion until the required gap is met.',
      };
    }

    const gap =
      required !== undefined && found !== undefined
        ? (required - found).toFixed(3)
        : undefined;

    return {
      explanation: `${a} and ${b} shapes on the same layer (or interacting layers) must keep a minimum gap so they do not short together during fabrication.`,
      suggestion: gap
        ? `Increase the spacing between these shapes by at least ${gap} µm (need ${required} µm, currently ${found} µm).`
        : `Move one of the shapes away until the required spacing is satisfied.`,
    };
  }

  if (ruleId.includes('.encloses.')) {
    const { enclosing, enclosed, required } = parseEnclosure(message);
    const outer = layerName(enclosing ?? '');
    const inner = layerName(enclosed ?? '');

    if (enclosing === 'nwell' && enclosed === 'diff') {
      return {
        explanation:
          'N-well must extend beyond PMOS diffusion on all sides. The extra margin ensures the well fully contains the device body.',
        suggestion:
          required !== undefined
            ? `Grow the N-well outward so it extends at least ${required} µm beyond the diffusion on every edge.`
            : 'Extend the N-well so it fully wraps the PMOS diffusion with adequate margin.',
      };
    }

    if (enclosing === 'nsdm' || enclosing === 'psdm') {
      return {
        explanation: `${outer} must overlap ${inner} with enough margin so the implant fully covers the source/drain region after process bias.`,
        suggestion:
          required !== undefined
            ? `Expand ${outer} so it extends at least ${required} µm beyond ${inner} on all sides.`
            : `Expand ${outer} to fully cover ${inner} with the required overlap.`,
      };
    }

    if (enclosing === 'diff' && enclosed === 'licon') {
      return {
        explanation:
          'Li contacts must sit inside diffusion with enough overlap so the contact lands reliably on the active region.',
        suggestion:
          required !== undefined
            ? `Move or resize the contact so diffusion extends at least ${required} µm past it on every side.`
            : 'Center the contact on diffusion and ensure enough overlap on all sides.',
      };
    }

    if (enclosing === 'poly' && enclosed === 'licon') {
      return {
        explanation:
          'Li contacts on poly (gate contacts) need poly to extend past the contact so the connection is solid.',
        suggestion:
          required !== undefined
            ? `Extend poly at least ${required} µm beyond the contact on all sides.`
            : 'Extend the poly gate so it fully encloses the contact with adequate margin.',
      };
    }

    if (enclosing === 'li' && enclosed === 'licon') {
      return {
        explanation:
          'Local interconnect must overlap li contacts so metal reliably connects to the layer below.',
        suggestion:
          required !== undefined
            ? `Extend local interconnect at least ${required} µm past the contact.`
            : 'Draw local interconnect over the contact with enough overlap on all sides.',
      };
    }

    if (enclosing === 'm1' && enclosed === 'mcon') {
      return {
        explanation:
          'Metal 1 must overlap mcon vias so the via is fully captured and does not create an open circuit.',
        suggestion:
          required !== undefined
            ? `Widen M1 so it extends at least ${required} µm beyond the via on every side.`
            : 'Draw a wider M1 patch over the via with adequate enclosure.',
      };
    }

    return {
      explanation: `${outer} must surround ${inner} with a minimum overlap so layers connect reliably after manufacturing bias.`,
      suggestion:
        required !== undefined
          ? `Expand ${outer} so it extends at least ${required} µm beyond ${inner} on all sides.`
          : `Expand ${outer} to fully enclose ${inner} with the required margin.`,
    };
  }

  return {
    explanation: message,
    suggestion: 'Adjust the highlighted shapes until this rule passes, then re-run DRC.',
  };
}

export function hitDrcViolation(
  point: { x: number; y: number },
  violations: DRCViolation[],
  zoom: number,
): DRCViolation | null {
  const pad = 10 / zoom;
  for (const violation of violations) {
    const { bbox } = violation;
    if (bbox.width <= 0 && bbox.height <= 0) continue;
    if (
      point.x >= bbox.x - pad &&
      point.x <= bbox.x + bbox.width + pad &&
      point.y >= bbox.y - pad &&
      point.y <= bbox.y + bbox.height + pad
    ) {
      return violation;
    }
  }
  return null;
}
