import { useLayoutStore } from '../store/layoutStore';

export function DRCPanel() {
  const violations = useLayoutStore((s) => s.drcViolations);

  return (
    <section className="panel">
      <h3>
        Live DRC
        <span className={`badge ${violations.length ? 'error' : 'ok'}`}>{violations.length}</span>
      </h3>
      <p className="panel-note">Essential sky130 rules update as you edit.</p>
      <ul className="issue-list">
        {violations.length === 0 ? (
          <li className="empty">No DRC violations</li>
        ) : (
          violations.map((violation) => (
            <li key={violation.id} className="issue error">
              <strong>{violation.ruleId}</strong>
              <span>{violation.message}</span>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
