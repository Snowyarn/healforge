import React, { useState } from 'react';
import type { AuditActivityEvent } from '../../types/account';

interface ActivitySectionProps {
  activity: AuditActivityEvent[];
}

export const ActivitySection: React.FC<ActivitySectionProps> = ({ activity }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = ['All', 'Auth', 'Profile', 'Security', 'API', 'Billing', 'Team', 'Privacy'];

  const filteredEvents = activity.filter((evt) => {
    const matchesCategory =
      selectedCategory === 'All' || evt.category.toLowerCase() === selectedCategory.toLowerCase();
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      !query ||
      evt.action.toLowerCase().includes(query) ||
      evt.description.toLowerCase().includes(query) ||
      evt.actor.toLowerCase().includes(query) ||
      evt.ip.toLowerCase().includes(query);

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="pb-4 border-b border-border-subtle">
        <h2 className="text-lg font-bold font-headline-sm text-text-primary">
          Audit Activity & Security Log
        </h2>
        <p className="text-xs text-text-muted mt-0.5">
          Immutable audit trail of authentication challenges, API key operations, and workspace membership edits.
        </p>
      </div>

      {/* Search & Category Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'bg-surface-card hover:bg-surface-container text-text-secondary border border-border-subtle'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Search input */}
        <div className="relative min-w-[220px]">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-text-muted text-[16px]">
            search
          </span>
          <input
            type="text"
            placeholder="Search audit log..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-surface-card border border-border-subtle focus:border-primary text-xs outline-none text-text-primary"
          />
        </div>
      </div>

      {/* Activity Table */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border-subtle text-text-muted uppercase text-[10px] tracking-wider">
                <th className="pb-2 font-medium">Timestamp</th>
                <th className="pb-2 font-medium">Category</th>
                <th className="pb-2 font-medium">Action & Details</th>
                <th className="pb-2 font-medium">Actor</th>
                <th className="pb-2 font-medium">IP Address</th>
                <th className="pb-2 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/50">
              {filteredEvents.length > 0 ? (
                filteredEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-surface-container/30 transition-colors">
                    <td className="py-3 font-mono text-[11px] text-text-muted whitespace-nowrap">
                      {evt.timestamp}
                    </td>

                    <td className="py-3">
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-surface-container text-text-secondary border border-border-subtle">
                        {evt.category}
                      </span>
                    </td>

                    <td className="py-3 max-w-sm">
                      <div className="font-semibold text-text-primary text-xs">{evt.action}</div>
                      <div className="text-[11px] text-text-secondary mt-0.5 leading-relaxed">
                        {evt.description}
                      </div>
                    </td>

                    <td className="py-3 text-[11px] text-text-secondary whitespace-nowrap">
                      {evt.actor}
                    </td>

                    <td className="py-3 font-mono text-[11px] text-text-muted whitespace-nowrap">
                      {evt.ip}
                    </td>

                    <td className="py-3 text-right">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                          evt.status === 'Success'
                            ? 'bg-status-success/10 text-status-success'
                            : evt.status === 'Warning'
                            ? 'bg-status-warning/10 text-status-warning'
                            : 'bg-status-critical/10 text-status-critical'
                        }`}
                      >
                        {evt.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-text-muted text-xs">
                    No activity logs match your filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
