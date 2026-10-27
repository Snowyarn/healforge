import React from 'react';
import type { AutofixStatus } from '../../types';

interface AutofixBadgeProps {
  status: AutofixStatus;
}

export const AutofixBadge: React.FC<AutofixBadgeProps> = ({ status }) => {
  if (status === 'Ready' || status === 'Applied') {
    return (
      <span className="inline-flex items-center text-[#166534] bg-[#DCFCE7] border border-[#BBF7D0] px-2 py-0.5 rounded font-label-code-sm">
        {status === 'Applied' ? 'Applied' : 'Ready'}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center text-text-muted bg-surface-container px-2 py-0.5 rounded font-label-code-sm">
      {status}
    </span>
  );
};
