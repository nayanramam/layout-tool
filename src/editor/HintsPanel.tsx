import { useLayoutStore } from '../store/layoutStore';

export function HintsPanel() {
  const hints = useLayoutStore((s) => s.hints);

  return (
    <section className="panel">
      <h3>Teaching hints</h3>
      <p className="panel-note">Soft guidance on resistance, routing, and good practice.</p>
      <ul className="issue-list">
        {hints.length === 0 ? (
          <li className="empty">No hints yet — place devices and route to get feedback.</li>
        ) : (
          hints.map((hint) => (
            <li key={hint.id} className={`issue hint ${hint.category}`}>
              <strong>{hint.message}</strong>
              <span>{hint.explanation}</span>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
