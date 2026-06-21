import type { DRCViolation } from '../types';
import { getDrcHelp } from '../engine/drc/explanations';

type Props = {
  violation: DRCViolation;
};

export function DrcHelpContent({ violation }: Props) {
  const help = getDrcHelp(violation);

  return (
    <>
      <p className="drc-help-explanation">{help.explanation}</p>
      <p className="drc-help-suggestion">
        <strong>Fix:</strong> {help.suggestion}
      </p>
    </>
  );
}

type TooltipProps = Props & {
  className?: string;
};

export function DrcHelpTooltip({ violation, className = 'drc-help-tooltip' }: TooltipProps) {
  return (
    <div className={className} role="tooltip">
      <DrcHelpContent violation={violation} />
    </div>
  );
}
