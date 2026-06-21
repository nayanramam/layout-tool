import { useEffect } from 'react';
import { LayoutCanvas } from './editor/LayoutCanvas';
import { Toolbar } from './editor/Toolbar';
import { LayerPanel } from './editor/LayerPanel';
import { DRCPanel } from './editor/DRCPanel';
import { LVSPanel } from './editor/LVSPanel';
import { HintsPanel } from './editor/HintsPanel';
import { NetlistUpload } from './editor/NetlistUpload';
import { useLayoutStore } from './store/layoutStore';
import { CADENCE_IMPORT_NOTES } from './engine/gds/writer';
import './App.css';

function App() {
  const refreshDerived = useLayoutStore((s) => s.refreshDerived);

  useEffect(() => {
    const finishHydration = () => refreshDerived();
    if (useLayoutStore.persist.hasHydrated()) {
      finishHydration();
    }
    return useLayoutStore.persist.onFinishHydration(finishHydration);
  }, [refreshDerived]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>Analog Layout Teaching Tool</h1>
          <p>sky130 layout editor with live DRC, LVS-lite, and Cadence GDS export</p>
        </div>
      </header>
      <Toolbar />
      <div className="workspace">
        <aside className="sidebar left">
          <NetlistUpload />
          <LayerPanel />
        </aside>
        <main className="canvas-wrap">
          <LayoutCanvas />
          <div className="canvas-help">
            Cadence-style: Space fit · P path · O via · A instance · Del delete tool · Esc select ·
            U undo · Shift+U redo · Drag region to select · Shift+drag pan
          </div>
        </main>
        <aside className="sidebar right">
          <DRCPanel />
          <LVSPanel />
          <HintsPanel />
          <section className="panel compact">
            <h3>Cadence export</h3>
            <pre className="cadence-notes">{CADENCE_IMPORT_NOTES}</pre>
          </section>
        </aside>
      </div>
    </div>
  );
}

export default App;
