import { useState } from 'react';
import { useLayoutStore } from '../store/layoutStore';
import { DrcHelpTooltip } from './DrcHelpTooltip';

export function DRCPanel() {
  const violations = useLayoutStore((s) => s.drcViolations);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <section className="panel">
      <h3>
        Live DRC
        <span className={`badge ${violations.length ? 'error' : 'ok'}`}>{violations.length}</span>
      </h3>
      <p className="panel-note">Essential sky130 rules update as you edit. Hover an error for help.</p>
      <ul className="issue-list">
        {violations.length === 0 ? (
          <li className="empty">No DRC violations</li>
        ) : (
          violations.map((violation) => (
            <li
              key={violation.id}
              className={`issue error drc-item ${hoveredId === violation.id ? 'hovered' : ''}`}
              onMouseEnter={() => setHoveredId(violation.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <strong>{violation.ruleId}</strong>
              <span>{violation.message}</span>
              {hoveredId === violation.id ? <DrcHelpTooltip violation={violation} /> : null}
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
