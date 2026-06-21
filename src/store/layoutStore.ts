import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  DeviceType,
  DRCViolation,
  EditorTool,
  Hint,
  LayerId,
  Layout,
  LVSItem,
  Netlist,
  Point,
  RatsnestLine,
  Rect,
  Shape,
  TerminalHighlight,
  ViewState,
} from '../types';
import { runDRC } from '../engine/drc';
import { runHints } from '../engine/hints';
import { downloadGds } from '../engine/gds/writer';
import { importGdsFile } from '../engine/gds/reader';
import {
  expandSelectionShapeIds,
  boundsForZoomFit,
  cloneLayout,
  collectRegionSelection,
  DEFAULT_VIEW,
  pickTopShapeAtPoint,
  pickWireAtPoint,
  zoomToFitView,
} from '../engine/geometry/view';
import { filterLVSItems, runLVSLite } from '../engine/lvs';
import { loadExampleNetlist, parseSpiceNetlist } from '../engine/netlist/parser';
import { createMosDevice } from '../engine/pcells/mos';
import { createVia } from '../engine/pcells/via';
import {
  buildRatsnestLines,
  highlightSameNetTerminals,
  inferNetFromPoint,
} from '../engine/ratsnest';
import { createId, normalizeRect, rectFromPoints, snapPoint } from '../engine/geometry';
import { defaultLayerVisibility } from '../pdk/sky130';

const GRID = 0.005;
const MAX_HISTORY = 50;

type DraftState = {
  start?: Point;
  current?: Point;
  points?: Point[];
};

type LayoutStore = {
  layout: Layout;
  netlist: Netlist | null;
  activeLayer: LayerId;
  layerVisibility: Record<LayerId, boolean>;
  tool: EditorTool;
  instanceDeviceType: DeviceType;
  view: ViewState;
  selectedShapeIds: string[];
  selectedWireIds: string[];
  draft: DraftState;
  activeNet: string | null;
  drcViolations: DRCViolation[];
  lvsItems: LVSItem[];
  hints: Hint[];
  ratsnestLines: RatsnestLine[];
  terminalHighlights: TerminalHighlight[];
  lvsKindFilter: 'all' | 'component' | 'connection' | 'net';
  lvsStatusFilter: 'all' | 'matched' | 'missing' | 'extra';
  gridSnap: number;
  past: Layout[];
  future: Layout[];
  setTool: (tool: EditorTool) => void;
  escapeToSelect: () => void;
  setInstanceDeviceType: (type: DeviceType) => void;
  setActiveLayer: (layer: LayerId) => void;
  toggleLayerVisibility: (layer: LayerId) => void;
  setView: (partial: Partial<ViewState>) => void;
  zoomToFit: (viewportWidth: number, viewportHeight: number) => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  loadNetlistText: (text: string) => void;
  loadExampleNetlist: () => void;
  importGds: (file: File) => Promise<void>;
  exportGds: () => void;
  runFullDRC: () => void;
  refreshDerived: () => void;
  setDraftStart: (point: Point) => void;
  setDraftCurrent: (point: Point) => void;
  clearDraft: () => void;
  addRectShape: (rect: Rect) => void;
  finalizeWire: () => void;
  placeDevice: (type: DeviceType, origin: Point) => void;
  placeNextInstance: (origin: Point) => void;
  placeVia: (origin: Point) => void;
  placeContacts: (origin: Point) => void;
  moveSelected: (dx: number, dy: number) => void;
  deleteSelected: () => void;
  deleteAtPoint: (point: Point) => void;
  selectAtPoint: (point: Point) => void;
  selectInRegion: (region: Rect) => void;
  setActiveNet: (net: string | null) => void;
  setLvsKindFilter: (value: LayoutStore['lvsKindFilter']) => void;
  setLvsStatusFilter: (value: LayoutStore['lvsStatusFilter']) => void;
  getFilteredLvsItems: () => LVSItem[];
};

function emptyLayout(): Layout {
  return {
    cellName: 'teaching_cell',
    shapes: [],
    devices: [],
    wires: [],
    labels: [],
  };
}

function recompute(store: LayoutStore): Pick<
  LayoutStore,
  'drcViolations' | 'lvsItems' | 'hints' | 'ratsnestLines' | 'terminalHighlights'
> {
  const drcViolations = runDRC(store.layout);
  const lvsItems = runLVSLite(store.layout, store.netlist);
  const hints = runHints(store.layout);
  const ratsnestLines = buildRatsnestLines(store.layout, store.netlist);
  const terminalHighlights = highlightSameNetTerminals(store.layout, store.netlist, store.activeNet);
  return { drcViolations, lvsItems, hints, ratsnestLines, terminalHighlights };
}

function applyLayout(state: LayoutStore, layout: Layout, clearSelection = false) {
  const next = {
    layout,
    ...(clearSelection ? { selectedShapeIds: [], selectedWireIds: [] } : {}),
    ...recompute({ ...state, layout }),
  };
  return next;
}

function collectDeviceShapeIds(layout: Layout, deviceId: string): string[] {
  return layout.shapes.filter((shape) => shape.deviceId === deviceId).map((shape) => shape.id);
}

export const useLayoutStore = create<LayoutStore>()(
  persist(
    (set, get) => ({
  layout: emptyLayout(),
  netlist: null,
  activeLayer: 'm1',
  layerVisibility: defaultLayerVisibility(),
  tool: 'select',
  instanceDeviceType: 'nmos',
  view: { ...DEFAULT_VIEW },
  selectedShapeIds: [],
  selectedWireIds: [],
  draft: {},
  activeNet: null,
  drcViolations: [],
  lvsItems: [],
  hints: [],
  ratsnestLines: [],
  terminalHighlights: [],
  lvsKindFilter: 'all',
  lvsStatusFilter: 'all',
  gridSnap: GRID,
  past: [],
  future: [],

  setTool: (tool) =>
    set((state) => ({
      tool,
      draft: {},
      selectedShapeIds: tool === 'select' || tool === 'delete' ? state.selectedShapeIds : [],
      selectedWireIds: tool === 'select' || tool === 'delete' ? state.selectedWireIds : [],
    })),

  escapeToSelect: () =>
    set({
      tool: 'select',
      draft: {},
    }),

  setInstanceDeviceType: (type) => set({ instanceDeviceType: type }),

  setActiveLayer: (layer) => set({ activeLayer: layer }),
  toggleLayerVisibility: (layer) =>
    set((state) => ({
      layerVisibility: { ...state.layerVisibility, [layer]: !state.layerVisibility[layer] },
    })),
  setView: (partial) => set((state) => ({ view: { ...state.view, ...partial } })),

  zoomToFit: (viewportWidth, viewportHeight) => {
    const bounds = boundsForZoomFit(get().layout);
    if (!bounds) {
      set({ view: { ...DEFAULT_VIEW } });
      return;
    }
    const view = zoomToFitView(bounds, viewportWidth, viewportHeight);
    set({ view });
  },

  pushHistory: () =>
    set((state) => ({
      past: [...state.past, cloneLayout(state.layout)].slice(-MAX_HISTORY),
      future: [],
    })),

  undo: () => {
    const { past, layout, future } = get();
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    set((state) => ({
      past: past.slice(0, -1),
      future: [cloneLayout(layout), ...future].slice(0, MAX_HISTORY),
      ...applyLayout(state, previous, true),
    }));
  },

  redo: () => {
    const { future, layout, past } = get();
    if (future.length === 0) return;
    const next = future[0];
    set((state) => ({
      future: future.slice(1),
      past: [...past, cloneLayout(layout)].slice(-MAX_HISTORY),
      ...applyLayout(state, next, true),
    }));
  },

  loadNetlistText: (text) => {
    const netlist = parseSpiceNetlist(text);
    set((state) => ({ netlist, ...recompute({ ...state, netlist }) }));
  },

  loadExampleNetlist: () => {
    const netlist = loadExampleNetlist();
    set((state) => ({ netlist, ...recompute({ ...state, netlist }) }));
  },

  importGds: async (file) => {
    get().pushHistory();
    const shapes = await importGdsFile(file);
    set((state) => applyLayout(state, { ...state.layout, shapes: [...state.layout.shapes, ...shapes] }));
  },

  exportGds: () => {
    downloadGds(get().layout, `${get().layout.cellName || 'layout'}.gds`);
  },

  runFullDRC: () => set((state) => ({ drcViolations: runDRC(state.layout) })),

  refreshDerived: () => set((state) => recompute(state)),

  setDraftStart: (point) => {
    const snapped = snapPoint(point, get().gridSnap);
    const tool = get().tool;
    if (tool === 'wire') {
      const net = inferNetFromPoint(get().layout, get().netlist, snapped);
      set({ draft: { points: [snapped] }, activeNet: net });
      return;
    }
    set({ draft: { start: snapped, current: snapped } });
  },

  setDraftCurrent: (point) => {
    const snapped = snapPoint(point, get().gridSnap);
    set((state) => ({ draft: { ...state.draft, current: snapped } }));
  },

  clearDraft: () => set({ draft: {} }),

  addRectShape: (rect) => {
    const normalized = normalizeRect(rect);
    if (normalized.width < get().gridSnap || normalized.height < get().gridSnap) return;
    get().pushHistory();
    const shape: Shape = {
      id: createId('shape'),
      layer: get().activeLayer,
      kind: 'rect',
      rect: normalized,
    };
    set((state) => applyLayout(state, { ...state.layout, shapes: [...state.layout.shapes, shape] }, false));
    set({ draft: {} });
  },

  finalizeWire: () => {
    const { draft, activeLayer, layout, netlist } = get();
    const points = draft.points ?? [];
    if (points.length < 2) {
      set({ draft: {} });
      return;
    }
    get().pushHistory();
    const net = get().activeNet ?? inferNetFromPoint(layout, netlist, points[0]);
    const wire = {
      id: createId('wire'),
      layer: activeLayer,
      points,
      width: activeLayer === 'm1' ? 0.14 : 0.17,
      net: net ?? undefined,
    };
    set((state) =>
      applyLayout(state, { ...state.layout, wires: [...state.layout.wires, wire] }, false),
    );
    set({ draft: {} });
  },

  placeDevice: (type, origin) => {
    const snapped = snapPoint(origin, get().gridSnap);
    get().pushHistory();
    const placedNames = new Set(get().layout.devices.map((device) => device.name));
    const netlistDevice = get().netlist?.devices.find(
      (device) => device.type === type && !placedNames.has(device.name),
    );
    const placement = createMosDevice(
      type,
      snapped,
      netlistDevice?.W ?? (type === 'pmos' ? 2 : 1),
      netlistDevice?.L ?? 0.15,
      netlistDevice?.fingers ?? 1,
      netlistDevice?.name,
    );
    set((state) =>
      applyLayout(
        state,
        {
          ...state.layout,
          shapes: [...state.layout.shapes, ...placement.shapes],
          devices: [...state.layout.devices, placement.device],
        },
        false,
      ),
    );
  },

  placeNextInstance: (origin) => {
    const placedNames = new Set(get().layout.devices.map((device) => device.name));
    const nextFromNetlist = get().netlist?.devices.find((device) => !placedNames.has(device.name));
    const type = nextFromNetlist?.type ?? get().instanceDeviceType;
    get().placeDevice(type, origin);
  },

  placeVia: (origin) => {
    const snapped = snapPoint(origin, get().gridSnap);
    get().pushHistory();
    const shapes = createVia(snapped, get().activeLayer);
    set((state) =>
      applyLayout(state, { ...state.layout, shapes: [...state.layout.shapes, ...shapes] }, false),
    );
  },

  placeContacts: (origin) => {
    get().placeVia(origin);
  },

  moveSelected: (dx, dy) => {
    const shapeIds = expandSelectionShapeIds(get().layout, get().selectedShapeIds);
    const wireIds = new Set(get().selectedWireIds);
    if (shapeIds.size === 0 && wireIds.size === 0) return;
    set((state) => {
      const shapes = state.layout.shapes.map((shape) => {
        if (!shapeIds.has(shape.id) || !shape.rect) return shape;
        return {
          ...shape,
          rect: {
            ...shape.rect,
            x: shape.rect.x + dx,
            y: shape.rect.y + dy,
          },
        };
      });
      const movedDeviceIds = new Set<string>();
      for (const shape of state.layout.shapes) {
        if (shape.deviceId && shapeIds.has(shape.id)) {
          movedDeviceIds.add(shape.deviceId);
        }
      }
      const devices = state.layout.devices.map((device) => {
        if (!movedDeviceIds.has(device.id)) return device;
        return {
          ...device,
          origin: { x: device.origin.x + dx, y: device.origin.y + dy },
          terminals: {
            d: { x: device.terminals.d.x + dx, y: device.terminals.d.y + dy },
            g: { x: device.terminals.g.x + dx, y: device.terminals.g.y + dy },
            s: { x: device.terminals.s.x + dx, y: device.terminals.s.y + dy },
            b: { x: device.terminals.b.x + dx, y: device.terminals.b.y + dy },
          },
        };
      });
      const wires = state.layout.wires.map((wire) => {
        if (!wireIds.has(wire.id)) return wire;
        return {
          ...wire,
          points: wire.points.map((point) => ({ x: point.x + dx, y: point.y + dy })),
        };
      });
      const layout = { ...state.layout, shapes, devices, wires };
      return { layout, ...recompute({ ...state, layout }) };
    });
  },

  deleteSelected: () => {
    const shapeIds = new Set(get().selectedShapeIds);
    const wireIds = new Set(get().selectedWireIds);
    if (shapeIds.size === 0 && wireIds.size === 0) return;
    get().pushHistory();
    set((state) => {
      const removedDeviceIds = new Set(
        state.layout.shapes
          .filter((shape) => shapeIds.has(shape.id) && shape.deviceId)
          .map((shape) => shape.deviceId!),
      );
      const layout = {
        ...state.layout,
        shapes: state.layout.shapes.filter((shape) => !shapeIds.has(shape.id)),
        devices: state.layout.devices.filter((device) => !removedDeviceIds.has(device.id)),
        wires: state.layout.wires.filter((wire) => !wireIds.has(wire.id)),
      };
      return {
        layout,
        selectedShapeIds: [],
        selectedWireIds: [],
        ...recompute({ ...state, layout }),
      };
    });
  },

  deleteAtPoint: (point) => {
    get().selectAtPoint(point);
    get().deleteSelected();
  },

  selectInRegion: (region) => {
    const normalized = normalizeRect(region);
    if (normalized.width < 1e-6 && normalized.height < 1e-6) return;
    const { shapeIds, wireIds } = collectRegionSelection(get().layout, normalized);
    set({ selectedShapeIds: shapeIds, selectedWireIds: wireIds });
  },

  selectAtPoint: (point) => {
    const layout = get().layout;
    const hit = pickTopShapeAtPoint(layout.shapes, point);
    if (hit) {
      if (hit.deviceId) {
        set({
          selectedShapeIds: collectDeviceShapeIds(layout, hit.deviceId),
          selectedWireIds: [],
        });
        return;
      }
      set({ selectedShapeIds: [hit.id], selectedWireIds: [] });
      return;
    }

    const wire = pickWireAtPoint(layout.wires, point);
    if (wire) {
      set({ selectedShapeIds: [], selectedWireIds: [wire.id] });
      return;
    }

    set({ selectedShapeIds: [], selectedWireIds: [] });
  },

  setActiveNet: (net) =>
    set((state) => ({
      activeNet: net,
      terminalHighlights: highlightSameNetTerminals(state.layout, state.netlist, net),
    })),

  setLvsKindFilter: (value) => set({ lvsKindFilter: value }),
  setLvsStatusFilter: (value) => set({ lvsStatusFilter: value }),

  getFilteredLvsItems: () =>
    filterLVSItems(get().lvsItems, get().lvsKindFilter, get().lvsStatusFilter),
}),
    {
      name: 'layout-tool-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        layout: state.layout,
        netlist: state.netlist,
        view: state.view,
        layerVisibility: state.layerVisibility,
        activeLayer: state.activeLayer,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (!error && state) {
          queueMicrotask(() => {
            useLayoutStore.setState(recompute(useLayoutStore.getState()));
          });
        }
      },
    },
  ),
);

export function commitDraftRect(): void {
  const state = useLayoutStore.getState();
  const { draft } = state;
  if (!draft.start || !draft.current) return;
  const rect = normalizeRect(rectFromPoints(draft.start, draft.current));
  state.addRectShape(rect);
}

export function appendWirePoint(point: Point): void {
  const state = useLayoutStore.getState();
  const snapped = snapPoint(point, state.gridSnap);
  const points = [...(state.draft.points ?? []), snapped];
  const net = inferNetFromPoint(state.layout, state.netlist, snapped) ?? state.activeNet;
  useLayoutStore.setState({ draft: { points }, activeNet: net });
}

export function handleCanvasShortcut(
  event: KeyboardEvent,
  viewport: { width: number; height: number },
): boolean {
  const store = useLayoutStore.getState();
  const key = event.key;
  const lower = key.toLowerCase();

  if (lower === 'u' && event.shiftKey) {
    event.preventDefault();
    store.redo();
    return true;
  }

  if (lower === 'u' && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    store.undo();
    return true;
  }

  if (key === ' ' || key === 'Spacebar') {
    event.preventDefault();
    store.zoomToFit(viewport.width, viewport.height);
    return true;
  }

  if (key === 'Escape') {
    event.preventDefault();
    store.escapeToSelect();
    return true;
  }

  if (key === 'Delete') {
    event.preventDefault();
    store.setTool('delete');
    return true;
  }

  if (lower === 'p') {
    event.preventDefault();
    store.setTool('wire');
    return true;
  }

  if (lower === 'o') {
    event.preventDefault();
    store.setTool('via');
    return true;
  }

  if (lower === 'a') {
    event.preventDefault();
    store.setTool('instance');
    return true;
  }

  if (lower === 's' && !event.ctrlKey && !event.metaKey) {
    event.preventDefault();
    store.setTool('select');
    return true;
  }

  if (key === 'Enter' && store.tool === 'wire') {
    event.preventDefault();
    store.finalizeWire();
    return true;
  }

  return false;
}
