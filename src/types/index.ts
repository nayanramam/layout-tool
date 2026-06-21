export type Point = { x: number; y: number };

export type Rect = { x: number; y: number; width: number; height: number };

export type Polygon = Point[];

export type LayerId =
  | 'nwell'
  | 'diff'
  | 'poly'
  | 'licon'
  | 'li'
  | 'mcon'
  | 'm1'
  | 'nsdm'
  | 'psdm';

export type Layer = {
  id: LayerId;
  name: string;
  gdsNumber: number;
  datatype: number;
  color: string;
  fillAlpha: number;
  visible: boolean;
};

export type Shape = {
  id: string;
  layer: LayerId;
  kind: 'rect' | 'polygon';
  rect?: Rect;
  polygon?: Polygon;
  deviceId?: string;
};

export type DeviceType = 'nmos' | 'pmos';

export type DeviceInstance = {
  id: string;
  type: DeviceType;
  name: string;
  W: number;
  L: number;
  fingers: number;
  origin: Point;
  terminals: {
    d: Point;
    g: Point;
    s: Point;
    b: Point;
  };
};

export type Wire = {
  id: string;
  layer: LayerId;
  points: Point[];
  width: number;
  net?: string;
};

export type Label = {
  id: string;
  net: string;
  point: Point;
  layer: LayerId;
};

export type Layout = {
  cellName: string;
  shapes: Shape[];
  devices: DeviceInstance[];
  wires: Wire[];
  labels: Label[];
};

export type NetlistDevice = {
  id: string;
  name: string;
  type: DeviceType;
  W: number;
  L: number;
  fingers: number;
  terminals: { d: string; g: string; s: string; b: string };
};

export type NetlistNet = {
  name: string;
  pins: { device: string; terminal: 'd' | 'g' | 's' | 'b' }[];
};

export type Netlist = {
  subcktName: string;
  devices: NetlistDevice[];
  nets: NetlistNet[];
};

export type SpacingRule = {
  layerA: LayerId;
  layerB: LayerId;
  minSpacing: number;
};

export type EnclosureRule = {
  enclosing: LayerId;
  enclosed: LayerId;
  minEnclosure: number;
};

export type RuleDeck = {
  minWidth: Partial<Record<LayerId, number>>;
  minSpacing: SpacingRule[];
  enclosure: EnclosureRule[];
  minArea: Partial<Record<LayerId, number>>;
};

export type DRCViolation = {
  id: string;
  ruleId: string;
  message: string;
  layer: LayerId;
  severity: 'error' | 'warning';
  bbox: Rect;
  shapeIds: string[];
};

export type LVSItemKind = 'component' | 'connection' | 'net';

export type LVSStatus = 'matched' | 'missing' | 'extra';

export type LVSItem = {
  id: string;
  kind: LVSItemKind;
  status: LVSStatus;
  label: string;
  detail: string;
};

export type Hint = {
  id: string;
  category: 'resistance' | 'routing' | 'practice';
  message: string;
  explanation: string;
  shapeIds: string[];
  deviceIds: string[];
};

export type EditorTool =
  | 'select'
  | 'rect'
  | 'wire'
  | 'via'
  | 'instance'
  | 'delete'
  | 'nmos'
  | 'pmos'
  | 'contact'
  | 'label';

export type ViewState = {
  panX: number;
  panY: number;
  zoom: number;
};

export type RatsnestLine = {
  net: string;
  from: Point;
  to: Point;
};

export type TerminalHighlight = {
  net: string;
  point: Point;
  deviceName?: string;
  terminal?: string;
};
