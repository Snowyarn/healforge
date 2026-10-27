import React from 'react';
import type { ReachabilityStatus } from '../../types';

interface ReachabilityBadgeProps {
  status: ReachabilityStatus;
}

export const ReachabilityBadge: React.FC<ReachabilityBadgeProps> = ({ status }) => {
  if (status === 'Reachable') {
    return (
      <span className="inline-flex items-center text-[#0284C7] bg-[#E0F2FE] border border-[#BAE6FD] px-2 py-0.5 rounded font-label-code-sm">
        Reachable
      </span>
    );
  }

  return (
    <span className="inline-flex items-center text-text-muted bg-surface-container px-2 py-0.5 rounded font-label-code-sm">
      Unreachable
    </span>
  );
};
