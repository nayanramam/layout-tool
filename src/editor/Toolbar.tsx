import type { DeviceType, EditorTool } from '../types';
import { useLayoutStore } from '../store/layoutStore';
import { CADENCE_SHORTCUTS } from './toolCursors';

const TOOLS: { id: EditorTool; label: string; hint: string; key?: string }[] = [
  { id: 'select', label: 'Select (S)', hint: 'Select and move objects', key: 'S' },
  { id: 'wire', label: 'Path (P)', hint: 'Draw path / wire', key: 'P' },
  { id: 'via', label: 'Via (O)', hint: 'Place via / contact', key: 'O' },
  { id: 'instance', label: 'Instance (A)', hint: 'Create instance from netlist', key: 'A' },
  { id: 'delete', label: 'Delete (Del)', hint: 'Click objects to delete', key: 'Del' },
  { id: 'rect', label: 'Rect', hint: 'Draw rectangle on active layer' },
  { id: 'nmos', label: 'NMOS', hint: 'Place NMOS device' },
  { id: 'pmos', label: 'PMOS', hint: 'Place PMOS device' },
];

export function Toolbar() {
  const tool = useLayoutStore((s) => s.tool);
  const setTool = useLayoutStore((s) => s.setTool);
  const undo = useLayoutStore((s) => s.undo);
  const redo = useLayoutStore((s) => s.redo);
  const past = useLayoutStore((s) => s.past);
  const future = useLayoutStore((s) => s.future);
  const instanceDeviceType = useLayoutStore((s) => s.instanceDeviceType);
  const setInstanceDeviceType = useLayoutStore((s) => s.setInstanceDeviceType);
  const runFullDRC = useLayoutStore((s) => s.runFullDRC);
  const exportGds = useLayoutStore((s) => s.exportGds);
  const loadExampleNetlist = useLayoutStore((s) => s.loadExampleNetlist);
  const zoomToFit = useLayoutStore((s) => s.zoomToFit);
  const drcCount = useLayoutStore((s) => s.drcViolations.length);

  const handleFit = () => {
    const canvas = document.querySelector('.layout-canvas');
    const rect = canvas?.getBoundingClientRect();
    zoomToFit(rect?.width ?? 800, rect?.height ?? 600);
  };

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        {TOOLS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={tool === entry.id ? 'active' : ''}
            title={entry.hint}
            onClick={() => setTool(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <div className="toolbar-group">
        {tool === 'instance' ? (
          <>
            <button
              type="button"
              className={instanceDeviceType === 'nmos' ? 'active' : ''}
              onClick={() => setInstanceDeviceType('nmos')}
            >
              NMOS
            </button>
            <button
              type="button"
              className={instanceDeviceType === 'pmos' ? 'active' : ''}
              onClick={() => setInstanceDeviceType('pmos')}
            >
              PMOS
            </button>
          </>
        ) : null}
        <button type="button" disabled={past.length === 0} onClick={undo} title="U">
          Undo
        </button>
        <button type="button" disabled={future.length === 0} onClick={redo} title="Shift+U">
          Redo
        </button>
        <button type="button" onClick={handleFit} title="Space">
          Fit
        </button>
        <button type="button" onClick={loadExampleNetlist}>
          Load example netlist
        </button>
        <button type="button" onClick={runFullDRC}>
          Run DRC {drcCount > 0 ? `(${drcCount})` : ''}
        </button>
        <button type="button" onClick={exportGds}>
          Export GDS
        </button>
      </div>
      <div className="shortcut-hints">
        {CADENCE_SHORTCUTS.map((entry) => (
          <span key={entry.key}>
            <kbd>{entry.key}</kbd> {entry.action}
          </span>
        ))}
      </div>
    </div>
  );
}

export function setInstanceTypeShortcut(type: DeviceType): void {
  useLayoutStore.getState().setInstanceDeviceType(type);
}
