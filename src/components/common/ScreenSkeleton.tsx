import React from 'react';
import {
  Skeleton,
  SkeletonText,
  SkeletonBadge,
  SkeletonCard,
  SkeletonTable,
  SkeletonCodeBlock,
} from './Skeleton';

export const DashboardSkeleton: React.FC = () => {
  return (
    <div
      className="flex flex-col w-full p-margin space-y-6"
      role="region"
      aria-busy="true"
      aria-label="Loading Dashboard data"
    >
      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} className="flex flex-col justify-between h-32">
            <div className="flex items-center justify-between">
              <Skeleton variant="text" width="60%" className="h-3" />
              <Skeleton variant="circle" width={20} height={20} />
            </div>
            <div className="flex items-baseline gap-2 mt-4">
              <Skeleton variant="text" width={48} className="h-8" />
              <SkeletonBadge width="5rem" />
            </div>
          </SkeletonCard>
        ))}
      </div>

      {/* 3 Repositories Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} className="flex flex-col justify-between h-48">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Skeleton variant="circle" width={24} height={24} />
                  <Skeleton variant="text" width={110} className="h-5" />
                </div>
                <SkeletonBadge width="4rem" />
              </div>
              <SkeletonText lines={2} className="mb-4" />
              <div className="space-y-2 mb-4">
                <div className="flex justify-between">
                  <Skeleton variant="text" width={80} className="h-3" />
                  <Skeleton variant="text" width={40} className="h-3" />
                </div>
                <Skeleton variant="rect" className="h-1.5 w-full rounded-full" />
              </div>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-border-subtle">
              <Skeleton variant="text" width={100} className="h-3" />
              <Skeleton variant="text" width={60} className="h-3" />
            </div>
          </SkeletonCard>
        ))}
      </div>

      {/* Middle Section: Recent Findings (Span 2) + Velocity (1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SkeletonCard className="lg:col-span-2 p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton variant="circle" width={20} height={20} />
              <Skeleton variant="text" width={180} className="h-5" />
            </div>
            <Skeleton variant="text" width={70} className="h-3" />
          </div>
          <SkeletonTable rows={4} cols={6} />
        </SkeletonCard>

        <SkeletonCard className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Skeleton variant="circle" width={20} height={20} />
                <Skeleton variant="text" width={140} className="h-5" />
              </div>
              <Skeleton variant="text" width={60} className="h-3" />
            </div>
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between">
                    <Skeleton variant="text" width={120} className="h-3" />
                    <Skeleton variant="text" width={40} className="h-3" />
                  </div>
                  <Skeleton variant="rect" className="h-2 w-full rounded-full" />
                </div>
              ))}
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-border-subtle flex items-center gap-3">
            <Skeleton variant="circle" width={24} height={24} />
            <SkeletonText lines={2} className="flex-1" />
          </div>
        </SkeletonCard>
      </div>

      {/* Bottom Row: Agent Feed + Dark Sandbox Terminal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SkeletonCard className="lg:col-span-2">
          <div className="pb-4 border-b border-border-subtle flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Skeleton variant="circle" width={20} height={20} />
              <Skeleton variant="text" width={140} className="h-5" />
            </div>
            <SkeletonBadge width="6rem" />
          </div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="flex items-start gap-4">
                <Skeleton variant="circle" width={32} height={32} />
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between">
                    <Skeleton variant="text" width="55%" className="h-4" />
                    <Skeleton variant="text" width={40} className="h-3" />
                  </div>
                  <SkeletonText lines={1} lastLineWidth="80%" />
                </div>
              </div>
            ))}
          </div>
        </SkeletonCard>

        <SkeletonCard dark className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Skeleton variant="circle" width={20} height={20} dark />
                <Skeleton variant="text" width={140} className="h-5" dark />
              </div>
              <SkeletonBadge width="7rem" />
            </div>
            <SkeletonText lines={2} dark className="mb-4" />
            <div className="p-3 rounded space-y-2 bg-surface-dark border border-outline/20">
              <Skeleton variant="text" width="85%" className="h-3" dark />
              <Skeleton variant="text" width="70%" className="h-3" dark />
              <Skeleton variant="text" width="90%" className="h-3" dark />
            </div>
          </div>
          <div className="pt-4 border-t border-outline/20 flex items-center justify-between mt-4">
            <Skeleton variant="text" width={100} className="h-3" dark />
            <SkeletonBadge width="6rem" />
          </div>
        </SkeletonCard>
      </div>
    </div>
  );
};

export const VulnerabilityDetailSkeleton: React.FC = () => {
  return (
    <div
      className="flex flex-col w-full pb-16"
      role="region"
      aria-busy="true"
      aria-label="Loading Vulnerability Details"
    >
      {/* Top Navigation Bar / Context Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between px-margin py-6 border-b border-border-subtle bg-surface-card gap-4">
        <div className="flex items-center gap-3">
          <Skeleton variant="text" width={90} className="h-4" />
          <span className="text-text-muted">/</span>
          <SkeletonBadge width="8rem" />
        </div>
        <div className="flex items-center gap-3">
          <SkeletonBadge width="8rem" />
          <SkeletonBadge width="5rem" />
          <SkeletonBadge width="7rem" />
        </div>
      </div>

      {/* Main Grid: 8 Cols Left, 4 Cols Right */}
      <div className="px-margin py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 space-y-8">
          <SkeletonCard className="space-y-4">
            <Skeleton variant="text" width={220} className="h-3" />
            <Skeleton variant="text" width="75%" className="h-7" />
            <SkeletonText lines={2} />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-border-subtle">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <Skeleton variant="text" width={60} className="h-3" />
                  <Skeleton variant="text" width={90} className="h-4" />
                </div>
              ))}
            </div>
          </SkeletonCard>

          <SkeletonCodeBlock lines={10} />

          <SkeletonCard className="space-y-4">
            <div className="flex items-center gap-2">
              <Skeleton variant="circle" width={20} height={20} />
              <Skeleton variant="text" width={260} className="h-5" />
            </div>
            <SkeletonText lines={3} />
            <div className="p-4 rounded-lg bg-surface-canvas border border-border-subtle space-y-3">
              <Skeleton variant="text" width={140} className="h-3" />
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <Skeleton variant="circle" width={24} height={24} />
                  <Skeleton variant="text" width="70%" className="h-4" />
                </div>
              ))}
            </div>
          </SkeletonCard>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <SkeletonCard className="space-y-4">
            <Skeleton variant="text" width={150} className="h-5" />
            <SkeletonText lines={2} />
            <div className="space-y-3 pt-2">
              <Skeleton variant="pill" className="w-full h-11" />
              <Skeleton variant="pill" className="w-full h-11" />
            </div>
          </SkeletonCard>

          <SkeletonCard className="space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton variant="text" width={160} className="h-5" />
              <SkeletonBadge width="4.5rem" />
            </div>
            <SkeletonText lines={2} />
            <div className="p-4 rounded-lg bg-surface-dark border border-outline/20 space-y-2">
              <Skeleton variant="text" width="90%" className="h-3" dark />
              <Skeleton variant="text" width="80%" className="h-3" dark />
              <Skeleton variant="text" width="65%" className="h-3" dark />
            </div>
          </SkeletonCard>

          <SkeletonCard className="space-y-3">
            <Skeleton variant="text" width={120} className="h-4" />
            <div className="space-y-2 pt-2">
              <div className="flex justify-between">
                <Skeleton variant="text" width={90} className="h-3" />
                <Skeleton variant="text" width={110} className="h-3" />
              </div>
              <div className="flex justify-between">
                <Skeleton variant="text" width={80} className="h-3" />
                <Skeleton variant="text" width={60} className="h-3" />
              </div>
            </div>
          </SkeletonCard>
        </div>
      </div>
    </div>
  );
};

export const PatchReviewSkeleton: React.FC = () => {
  return (
    <div
      className="flex flex-col w-full pb-20"
      role="region"
      aria-busy="true"
      aria-label="Loading Patch Review"
    >
      {/* Top Banner Header */}
      <div className="flex flex-col px-margin pt-6 pb-4 bg-surface-container-low border-b border-border-subtle">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-3">
            <SkeletonBadge width="5rem" />
            <SkeletonBadge width="8rem" />
            <Skeleton variant="text" width={180} className="h-4" />
          </div>
          <div className="flex items-center gap-3">
            <SkeletonBadge width="5rem" height="2.25rem" />
            <SkeletonBadge width="8rem" height="2.25rem" />
            <SkeletonBadge width="9rem" height="2.25rem" />
          </div>
        </div>
        <div className="flex items-baseline justify-between mt-2">
          <div className="space-y-1">
            <Skeleton variant="text" width={320} className="h-8" />
            <Skeleton variant="text" width={480} className="h-4" />
          </div>
          <div className="flex gap-3">
            <SkeletonBadge width="5rem" />
            <SkeletonBadge width="5rem" />
          </div>
        </div>
      </div>

      {/* Main Grid: 8 cols diff viewer + 4 cols rationale */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-margin px-margin mt-6">
        <div className="lg:col-span-8 flex flex-col gap-6">
          <SkeletonCard className="p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-surface-container-low border-b border-border-subtle">
              <Skeleton variant="text" width={220} className="h-4" />
              <Skeleton variant="text" width={70} className="h-4" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 divide-x divide-border-subtle p-4 gap-4">
              <div className="space-y-2">
                <Skeleton variant="text" width={140} className="h-4 mb-3" />
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} variant="text" width={`${50 + ((i * 19) % 45)}%`} className="h-3" />
                ))}
              </div>
              <div className="space-y-2 pl-4">
                <Skeleton variant="text" width={140} className="h-4 mb-3" />
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} variant="text" width={`${50 + ((i * 13) % 45)}%`} className="h-3" />
                ))}
              </div>
            </div>
          </SkeletonCard>

          {/* AST Bento */}
          <SkeletonCard>
            <Skeleton variant="text" width={240} className="h-5 mb-4" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-4 rounded-lg bg-surface-container-low space-y-2">
                  <Skeleton variant="text" width={70} className="h-3" />
                  <Skeleton variant="text" width={110} className="h-4" />
                  <SkeletonText lines={2} />
                </div>
              ))}
            </div>
          </SkeletonCard>
        </div>

        <div className="lg:col-span-4 flex flex-col gap-6">
          <SkeletonCard className="space-y-4">
            <div className="flex items-center gap-2">
              <Skeleton variant="circle" width={20} height={20} />
              <Skeleton variant="text" width={150} className="h-5" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-3.5 rounded-lg bg-surface-container-low space-y-1">
                  <Skeleton variant="text" width={110} className="h-3" />
                  <SkeletonText lines={2} />
                </div>
              ))}
            </div>
          </SkeletonCard>

          <SkeletonCard dark className="space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton variant="circle" width={20} height={20} dark />
              <Skeleton variant="text" width={160} className="h-5" dark />
            </div>
            <div className="p-4 rounded-lg bg-surface/40 space-y-2 border border-outline/20">
              <Skeleton variant="text" width="90%" className="h-3" dark />
              <Skeleton variant="text" width="60%" className="h-3" dark />
              <Skeleton variant="text" width="75%" className="h-3" dark />
            </div>
          </SkeletonCard>
        </div>
      </div>
    </div>
  );
};

export const VerificationSandboxSkeleton: React.FC = () => {
  return (
    <div
      className="flex flex-col w-full pb-16"
      role="region"
      aria-busy="true"
      aria-label="Loading Sandbox Verification Engine"
    >
      <div className="px-margin pt-margin pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <SkeletonBadge width="6rem" />
            <SkeletonBadge width="11rem" />
          </div>
          <Skeleton variant="text" width={340} className="h-8" />
        </div>
        <div className="flex gap-3">
          <SkeletonBadge width="11rem" height="2.25rem" />
          <SkeletonBadge width="10rem" height="2.25rem" />
        </div>
      </div>

      <div className="px-margin grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        {/* Left Column (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-gutter">
          <SkeletonCard className="space-y-5">
            <div className="flex justify-between items-center">
              <Skeleton variant="text" width={160} className="h-5" />
              <Skeleton variant="text" width={90} className="h-3" />
            </div>
            <div className="space-y-6 pl-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <Skeleton variant="text" width={140} className="h-4" />
                  <Skeleton variant="text" width={220} className="h-3" />
                </div>
              ))}
            </div>
          </SkeletonCard>

          <SkeletonCard className="space-y-4">
            <Skeleton variant="text" width={130} className="h-5" />
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-lg bg-surface-container space-y-1">
                <Skeleton variant="text" width={70} className="h-3" />
                <Skeleton variant="text" width={90} className="h-5" />
              </div>
              <div className="p-4 rounded-lg bg-surface-container space-y-1">
                <Skeleton variant="text" width={70} className="h-3" />
                <Skeleton variant="text" width={90} className="h-5" />
              </div>
            </div>
          </SkeletonCard>

          <SkeletonCard dark className="space-y-3">
            <div className="flex justify-between items-center">
              <Skeleton variant="text" width={150} className="h-4" dark />
              <SkeletonBadge width="4rem" />
            </div>
            <SkeletonText lines={2} dark />
            <Skeleton variant="rect" className="h-12 w-full rounded" dark />
          </SkeletonCard>
        </div>

        {/* Right Column (7 Cols): Dark Terminal */}
        <div className="lg:col-span-7 flex flex-col">
          <SkeletonCard dark className="flex-1 p-0 overflow-hidden flex flex-col h-[520px]">
            <div className="px-4 py-3 bg-surface-dark border-b border-outline/20 flex justify-between items-center">
              <div className="flex gap-2">
                <Skeleton variant="circle" width={12} height={12} dark />
                <Skeleton variant="circle" width={12} height={12} dark />
                <Skeleton variant="circle" width={12} height={12} dark />
                <Skeleton variant="text" width={180} className="h-3 ml-2" dark />
              </div>
              <SkeletonBadge width="8rem" />
            </div>
            <div className="p-5 space-y-3 flex-1 bg-[#121c19]">
              {Array.from({ length: 11 }).map((_, i) => (
                <Skeleton key={i} variant="text" width={`${55 + ((i * 17) % 40)}%`} className="h-3" dark />
              ))}
            </div>
            <div className="px-4 py-3 border-t border-outline/20 flex justify-between items-center">
              <Skeleton variant="text" width={140} className="h-3" dark />
              <div className="flex gap-2">
                <SkeletonBadge width="5rem" />
                <SkeletonBadge width="7rem" />
              </div>
            </div>
          </SkeletonCard>
        </div>
      </div>
    </div>
  );
};

export const AgentActivitySkeleton: React.FC = () => {
  return (
    <div
      className="flex flex-col w-full min-h-screen bg-surface pb-16"
      role="region"
      aria-busy="true"
      aria-label="Loading Agent Activity Stream"
    >
      <div className="px-margin pt-6 pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <SkeletonBadge width="6rem" />
            <Skeleton variant="text" width={100} className="h-4" />
          </div>
          <Skeleton variant="text" width={280} className="h-8" />
        </div>
        <div className="flex gap-3">
          <SkeletonBadge width="14rem" height="2.25rem" />
          <SkeletonBadge width="8rem" height="2.25rem" />
        </div>
      </div>

      <div className="px-margin grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="flex flex-col gap-6">
          <SkeletonCard className="space-y-4">
            <Skeleton variant="text" width={130} className="h-5" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton variant="rect" className="h-20 w-full rounded-lg" />
              <Skeleton variant="rect" className="h-20 w-full rounded-lg" />
            </div>
            <div className="space-y-2 pt-2 border-t border-border-subtle">
              <Skeleton variant="text" width="100%" className="h-3" />
              <Skeleton variant="text" width="100%" className="h-3" />
              <Skeleton variant="text" width="100%" className="h-3" />
            </div>
          </SkeletonCard>

          <SkeletonCard className="space-y-3">
            <Skeleton variant="text" width={120} className="h-5" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} variant="rect" className="h-14 w-full rounded-lg" />
            ))}
          </SkeletonCard>
        </div>

        <div className="lg:col-span-3 flex flex-col gap-4">
          <SkeletonCard className="flex justify-between items-center p-4">
            <Skeleton variant="text" width={260} className="h-6" />
            <SkeletonBadge width="10rem" />
          </SkeletonCard>

          <div className="flex flex-col gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex gap-4">
                    <Skeleton variant="circle" width={40} height={40} />
                    <div className="space-y-1">
                      <div className="flex gap-2">
                        <Skeleton variant="text" width={70} className="h-4" />
                        <SkeletonBadge width="6rem" />
                      </div>
                      <Skeleton variant="text" width={280} className="h-5" />
                    </div>
                  </div>
                  <SkeletonBadge width="6rem" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-border-subtle">
                  <Skeleton variant="rect" className="h-12 w-full rounded-lg" />
                  <Skeleton variant="rect" className="h-12 w-full rounded-lg" />
                  <Skeleton variant="rect" className="h-12 w-full rounded-lg" />
                </div>
              </SkeletonCard>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
