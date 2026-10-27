import React from 'react';
import type { SeverityLevel } from '../../types';

interface SeverityBadgeProps {
  severity: SeverityLevel;
  cvssScore?: number;
  pulse?: boolean;
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity, cvssScore, pulse = false }) => {
  if (severity === 'Critical') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-label-code-sm bg-orange-50 text-status-critical border border-orange-200 font-label-code-sm">
        {pulse && <span className="w-1.5 h-1.5 rounded-full bg-status-critical mr-1.5 animate-pulse" />}
        Critical {cvssScore !== undefined ? `(${cvssScore})` : ''}
      </span>
    );
  }

  if (severity === 'High') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-label-code-sm bg-amber-50 text-status-high border border-amber-200 font-label-code-sm">
        High {cvssScore !== undefined ? `(${cvssScore})` : ''}
      </span>
    );
  }

  if (severity === 'Medium') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-label-code-sm bg-yellow-50 text-status-medium border border-yellow-200 font-label-code-sm">
        Medium {cvssScore !== undefined ? `(${cvssScore})` : ''}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-label-code-sm bg-sky-50 text-status-low border border-sky-200 font-label-code-sm">
      Low {cvssScore !== undefined ? `(${cvssScore})` : ''}
    </span>
  );
};
