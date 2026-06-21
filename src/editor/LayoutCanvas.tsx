import { useEffect, useRef, useState } from 'react';
import { Application, Container, Graphics } from 'pixi.js';
import { LAYER_ORDER, SKY130_LAYERS } from '../pdk/sky130';
import {
  appendWirePoint,
  commitDraftRect,
  handleCanvasShortcut,
  useLayoutStore,
} from '../store/layoutStore';
import { rectFromPoints, screenToWorld, snapPoint } from '../engine/geometry';
import { hasHitAtPoint } from '../engine/geometry/view';
import { toolCursorClass } from './toolCursors';

const BG = 0x101418;
const GRID_COLOR = 0x1e2830;

function hexToNumber(hex: string): number {
  return Number.parseInt(hex.replace('#', ''), 16);
}

function drawScene(
  world: Container,
  view: { panX: number; panY: number; zoom: number },
  state: ReturnType<typeof useLayoutStore.getState>,
  marquee?: { start: { x: number; y: number }; current: { x: number; y: number } } | null,
): void {
  world.removeChildren();
  world.position.set(view.panX, view.panY);
  world.scale.set(view.zoom);

  const grid = new Graphics();
  const span = 20;
  const step = 0.5;
  for (let x = -span; x <= span; x += step) {
    grid.moveTo(x, -span).lineTo(x, span);
  }
  for (let y = -span; y <= span; y += step) {
    grid.moveTo(-span, y).lineTo(span, y);
  }
  grid.stroke({ color: GRID_COLOR, width: 1 / view.zoom, alpha: 0.8 });
  world.addChild(grid);

  const {
    layout,
    layerVisibility,
    selectedShapeIds,
    selectedWireIds,
    drcViolations,
    ratsnestLines,
    terminalHighlights,
    tool,
    draft,
  } = state;

  for (const layerId of LAYER_ORDER) {
    if (!layerVisibility[layerId]) continue;
    const layer = SKY130_LAYERS[layerId];
    const color = hexToNumber(layer.color);

    for (const shape of layout.shapes) {
      if (shape.layer !== layerId || !shape.rect) continue;
      const g = new Graphics();
      g.rect(shape.rect.x, shape.rect.y, shape.rect.width, shape.rect.height);
      g.fill({ color, alpha: layer.fillAlpha });
      g.stroke({
        color: selectedShapeIds.includes(shape.id) ? 0xffffff : color,
        width: selectedShapeIds.includes(shape.id) ? 2 / view.zoom : 1 / view.zoom,
        alpha: 0.95,
      });
      world.addChild(g);
    }
  }

  for (const wire of layout.wires) {
    if (!layerVisibility[wire.layer]) continue;
    const layer = SKY130_LAYERS[wire.layer];
    const g = new Graphics();
    if (wire.points.length >= 2) {
      g.moveTo(wire.points[0].x, wire.points[0].y);
      for (let i = 1; i < wire.points.length; i += 1) {
        g.lineTo(wire.points[i].x, wire.points[i].y);
      }
      const selected = selectedWireIds.includes(wire.id);
      g.stroke({
        color: selected ? 0xffffff : hexToNumber(layer.color),
        width: selected ? wire.width + 0.04 : wire.width,
        alpha: 0.95,
      });
    }
    world.addChild(g);
  }

  for (const line of ratsnestLines) {
    const g = new Graphics();
    g.moveTo(line.from.x, line.from.y);
    g.lineTo(line.to.x, line.to.y);
    g.stroke({ color: 0xffc107, width: 1 / view.zoom, alpha: 0.45 });
    world.addChild(g);
  }

  for (const highlight of terminalHighlights) {
    const g = new Graphics();
    g.circle(highlight.point.x, highlight.point.y, 0.08);
    g.fill({ color: 0x00e676, alpha: 0.9 });
    g.stroke({ color: 0xffffff, width: 1 / view.zoom });
    world.addChild(g);
  }

  for (const device of layout.devices) {
    for (const point of Object.values(device.terminals)) {
      const g = new Graphics();
      g.circle(point.x, point.y, 0.04);
      g.fill({ color: 0xffffff, alpha: 0.65 });
      world.addChild(g);
      if (tool === 'wire') {
        const ring = new Graphics();
        ring.circle(point.x, point.y, 0.06);
        ring.stroke({ color: 0x80cbc4, width: 1 / view.zoom, alpha: 0.5 });
        world.addChild(ring);
      }
    }
  }

  for (const violation of drcViolations) {
    const g = new Graphics();
    g.rect(violation.bbox.x, violation.bbox.y, violation.bbox.width, violation.bbox.height);
    g.stroke({ color: 0xff5252, width: 2 / view.zoom, alpha: 0.95 });
    world.addChild(g);
  }

  if (draft.start && draft.current) {
    const preview = rectFromPoints(draft.start, draft.current);
    const g = new Graphics();
    g.rect(preview.x, preview.y, preview.width, preview.height);
    g.stroke({ color: 0xffffff, width: 1 / view.zoom, alpha: 0.8 });
    world.addChild(g);
  }

  if (draft.points && draft.points.length > 0) {
    const g = new Graphics();
    g.moveTo(draft.points[0].x, draft.points[0].y);
    for (let i = 1; i < draft.points.length; i += 1) {
      g.lineTo(draft.points[i].x, draft.points[i].y);
    }
    g.stroke({ color: 0xffffff, width: 0.12, alpha: 0.9 });
    world.addChild(g);
  }

  if (marquee?.start && marquee.current) {
    const box = rectFromPoints(marquee.start, marquee.current);
    const g = new Graphics();
    g.rect(box.x, box.y, box.width, box.height);
    g.fill({ color: 0x42a5f5, alpha: 0.12 });
    g.stroke({ color: 0x42a5f5, width: 1 / view.zoom, alpha: 0.95 });
    world.addChild(g);
  }
}

const MARQUEE_THRESHOLD_PX = 5;

type SelectDragState =
  | {
      kind: 'pending';
      start: { x: number; y: number };
      screenStart: { x: number; y: number };
      hadHit: boolean;
    }
  | { kind: 'marquee'; start: { x: number; y: number }; current: { x: number; y: number } }
  | { kind: 'move'; last: { x: number; y: number } };

export function LayoutCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  const wheelHandlerRef = useRef<((event: WheelEvent) => void) | null>(null);
  const draggingRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const selectDragRef = useRef<SelectDragState | null>(null);
  const isDrawingRef = useRef(false);
  const moveUndoPushedRef = useRef(false);
  const [pixiReady, setPixiReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [marquee, setMarquee] = useState<{ start: { x: number; y: number }; current: { x: number; y: number } } | null>(null);

  const layout = useLayoutStore((s) => s.layout);
  const layerVisibility = useLayoutStore((s) => s.layerVisibility);
  const view = useLayoutStore((s) => s.view);
  const tool = useLayoutStore((s) => s.tool);
  const draft = useLayoutStore((s) => s.draft);
  const selectedShapeIds = useLayoutStore((s) => s.selectedShapeIds);
  const selectedWireIds = useLayoutStore((s) => s.selectedWireIds);
  const drcViolations = useLayoutStore((s) => s.drcViolations);
  const ratsnestLines = useLayoutStore((s) => s.ratsnestLines);
  const terminalHighlights = useLayoutStore((s) => s.terminalHighlights);
  const gridSnap = useLayoutStore((s) => s.gridSnap);

  useEffect(() => {
    canvasRef.current?.focus();
  }, []);

  useEffect(() => {
    const mount = canvasRef.current;
    if (!mount) return;

    let cancelled = false;
    const app = new Application();
    appRef.current = app;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const state = useLayoutStore.getState();
      const factor = event.deltaY > 0 ? 0.9 : 1.1;
      const nextZoom = Math.min(800, Math.max(20, state.view.zoom * factor));
      useLayoutStore.getState().setView({ zoom: nextZoom });
    };
    wheelHandlerRef.current = onWheel;

    void app
      .init({
        background: BG,
        antialias: true,
        resizeTo: mount,
      })
      .then(() => {
        if (cancelled) {
          app.destroy(true);
          return;
        }

        mount.appendChild(app.canvas);

        const world = new Container();
        worldRef.current = world;
        app.stage.addChild(world);

        mount.addEventListener('wheel', onWheel, { passive: false });
        setPixiReady(true);
        setInitError(null);
      })
      .catch((error: unknown) => {
        console.error('PixiJS init failed:', error);
        setInitError(error instanceof Error ? error.message : 'WebGL initialization failed');
        setPixiReady(false);
      });

    return () => {
      cancelled = true;
      if (wheelHandlerRef.current) {
        mount.removeEventListener('wheel', wheelHandlerRef.current);
        wheelHandlerRef.current = null;
      }
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
      worldRef.current = null;
      setPixiReady(false);
    };
  }, []);

  useEffect(() => {
    if (!pixiReady) return;
    const world = worldRef.current;
    if (!world) return;
    drawScene(world, view, useLayoutStore.getState(), marquee);
  }, [
    pixiReady,
    layout,
    layerVisibility,
    view,
    draft,
    selectedShapeIds,
    selectedWireIds,
    drcViolations,
    ratsnestLines,
    terminalHighlights,
    tool,
    marquee,
  ]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    canvasRef.current?.focus();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    const worldPoint = screenToWorld(screenX, screenY, view.panX, view.panY, view.zoom);
    const snapped = snapPoint(worldPoint, gridSnap);
    const store = useLayoutStore.getState();

    if (event.button === 1 || (event.button === 0 && event.shiftKey)) {
      draggingRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        panX: view.panX,
        panY: view.panY,
      };
      return;
    }

    if (tool === 'select') {
      const hadHit = hasHitAtPoint(store.layout, snapped);
      selectDragRef.current = {
        kind: 'pending',
        start: snapped,
        screenStart: { x: screenX, y: screenY },
        hadHit,
      };
      if (hadHit) {
        store.selectAtPoint(snapped);
      }
      moveUndoPushedRef.current = false;
      return;
    }

    if (tool === 'delete') {
      store.deleteAtPoint(snapped);
      return;
    }

    if (tool === 'rect') {
      isDrawingRef.current = true;
      store.setDraftStart(snapped);
      return;
    }

    if (tool === 'wire') {
      if (!store.draft.points?.length) {
        store.setDraftStart(snapped);
      } else {
        appendWirePoint(snapped);
      }
      return;
    }

    if (tool === 'via') {
      store.placeVia(snapped);
      return;
    }

    if (tool === 'instance') {
      store.placeNextInstance(snapped);
      return;
    }

    if (tool === 'nmos' || tool === 'pmos') {
      store.placeDevice(tool, snapped);
      return;
    }

    if (tool === 'contact') {
      store.placeVia(snapped);
      return;
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (draggingRef.current) {
      const dx = event.clientX - draggingRef.current.startX;
      const dy = event.clientY - draggingRef.current.startY;
      useLayoutStore.getState().setView({
        panX: draggingRef.current.panX + dx,
        panY: draggingRef.current.panY + dy,
      });
      return;
    }

    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    const worldPoint = screenToWorld(screenX, screenY, view.panX, view.panY, view.zoom);
    const snapped = snapPoint(worldPoint, gridSnap);
    const store = useLayoutStore.getState();

    if (isDrawingRef.current && tool === 'rect') {
      store.setDraftCurrent(snapped);
      return;
    }

    const selectDrag = selectDragRef.current;
    if (tool === 'select' && selectDrag && event.buttons === 1) {
      if (selectDrag.kind === 'pending') {
        const screenDist = Math.hypot(
          screenX - selectDrag.screenStart.x,
          screenY - selectDrag.screenStart.y,
        );
        if (screenDist <= MARQUEE_THRESHOLD_PX) return;

        if (selectDrag.hadHit) {
          selectDragRef.current = { kind: 'move', last: snapped };
        } else {
          selectDragRef.current = { kind: 'marquee', start: selectDrag.start, current: snapped };
          setMarquee({ start: selectDrag.start, current: snapped });
        }
        return;
      }

      if (selectDrag.kind === 'marquee') {
        selectDragRef.current = { ...selectDrag, current: snapped };
        setMarquee({ start: selectDrag.start, current: snapped });
        return;
      }

      if (selectDrag.kind === 'move') {
        const dx = snapped.x - selectDrag.last.x;
        const dy = snapped.y - selectDrag.last.y;
        if (dx !== 0 || dy !== 0) {
          if (!moveUndoPushedRef.current) {
            store.pushHistory();
            moveUndoPushedRef.current = true;
          }
          store.moveSelected(dx, dy);
          selectDragRef.current = { kind: 'move', last: snapped };
        }
      }
    }
  };

  const handlePointerUp = () => {
    const store = useLayoutStore.getState();
    const selectDrag = selectDragRef.current;

    if (tool === 'select' && selectDrag) {
      if (selectDrag.kind === 'marquee') {
        store.selectInRegion(rectFromPoints(selectDrag.start, selectDrag.current));
      } else if (selectDrag.kind === 'pending' && !selectDrag.hadHit) {
        store.selectAtPoint(selectDrag.start);
      }
    }

    draggingRef.current = null;
    selectDragRef.current = null;
    setMarquee(null);
    moveUndoPushedRef.current = false;
    if (isDrawingRef.current && tool === 'rect') {
      commitDraftRect();
      isDrawingRef.current = false;
    }
  };

  const handleDoubleClick = () => {
    if (tool === 'wire') {
      useLayoutStore.getState().finalizeWire();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    handleCanvasShortcut(event.nativeEvent, {
      width: rect?.width ?? 800,
      height: rect?.height ?? 600,
    });
  };

  return (
    <div className="layout-canvas-wrap">
      {initError ? (
        <div className="canvas-error">
          Canvas failed to start: {initError}. Try a normal browser tab (Chrome/Edge/Firefox).
        </div>
      ) : null}
      {!pixiReady && !initError ? <div className="canvas-loading">Loading canvas…</div> : null}
      <div
        ref={canvasRef}
        className={`layout-canvas ${toolCursorClass(tool)}`}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
