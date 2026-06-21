import { useMemo } from 'react';
import { filterLVSItems } from '../engine/lvs';
import { useLayoutStore } from '../store/layoutStore';

export function LVSPanel() {
  const lvsItems = useLayoutStore((s) => s.lvsItems);
  const kindFilter = useLayoutStore((s) => s.lvsKindFilter);
  const statusFilter = useLayoutStore((s) => s.lvsStatusFilter);
  const setLvsKindFilter = useLayoutStore((s) => s.setLvsKindFilter);
  const setLvsStatusFilter = useLayoutStore((s) => s.setLvsStatusFilter);
  const items = useMemo(
    () => filterLVSItems(lvsItems, kindFilter, statusFilter),
    [lvsItems, kindFilter, statusFilter],
  );

  return (
    <section className="panel">
      <h3>LVS-lite</h3>
      <p className="panel-note">Compare layout against uploaded netlist.</p>
      <div className="filter-row">
        <select value={kindFilter} onChange={(e) => setLvsKindFilter(e.target.value as typeof kindFilter)}>
          <option value="all">All kinds</option>
          <option value="component">Components</option>
          <option value="connection">Connections</option>
          <option value="net">Nets</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setLvsStatusFilter(e.target.value as typeof statusFilter)}
        >
          <option value="all">All status</option>
          <option value="matched">Matched</option>
          <option value="missing">Missing</option>
          <option value="extra">Extra</option>
        </select>
      </div>
      <ul className="issue-list">
        {items.length === 0 ? (
          <li className="empty">No LVS items for current filters</li>
        ) : (
          items.map((item) => (
            <li key={item.id} className={`issue ${item.status}`}>
              <strong>
                [{item.kind}] {item.label}
              </strong>
              <span>{item.detail}</span>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
