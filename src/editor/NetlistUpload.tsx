import type { ChangeEvent } from 'react';
import { useLayoutStore } from '../store/layoutStore';

export function NetlistUpload() {
  const loadNetlistText = useLayoutStore((s) => s.loadNetlistText);
  const importGds = useLayoutStore((s) => s.importGds);
  const netlist = useLayoutStore((s) => s.netlist);

  const onNetlistFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    loadNetlistText(text);
    event.target.value = '';
  };

  const onGdsFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await importGds(file);
    event.target.value = '';
  };

  return (
    <section className="panel">
      <h3>Netlist &amp; import</h3>
      <p className="panel-note">
        {netlist
          ? `Loaded subckt: ${netlist.subcktName} (${netlist.devices.length} devices)`
          : 'Upload SPICE/CDL netlist to enable LVS-lite and ratsnest.'}
      </p>
      <label className="file-button">
        Upload netlist (.sp, .cir, .spice)
        <input type="file" accept=".sp,.cir,.spice,.txt" hidden onChange={onNetlistFile} />
      </label>
      <label className="file-button secondary">
        Import GDS
        <input type="file" accept=".gds,.gds2" hidden onChange={onGdsFile} />
      </label>
    </section>
  );
}
