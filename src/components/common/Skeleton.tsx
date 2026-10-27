import React from 'react';

export interface SkeletonProps {
  className?: string;
  variant?: 'rect' | 'circle' | 'pill' | 'text';
  width?: string | number;
  height?: string | number;
  dark?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rect',
  width,
  height,
  dark = false,
}) => {
  const roundedClass =
    variant === 'circle'
      ? 'rounded-full'
      : variant === 'pill'
      ? 'rounded-full'
      : variant === 'text'
      ? 'rounded'
      : 'rounded-md';

  const baseShimmer = dark ? 'skeleton-shimmer-dark' : 'skeleton-shimmer';

  return (
    <div
      aria-hidden="true"
      style={{
        width: width !== undefined ? (typeof width === 'number' ? `${width}px` : width) : undefined,
        height: height !== undefined ? (typeof height === 'number' ? `${height}px` : height) : undefined,
      }}
      className={`${baseShimmer} ${roundedClass} ${className}`}
    />
  );
};

export const SkeletonText: React.FC<{
  lines?: number;
  className?: string;
  lineHeightClass?: string;
  lastLineWidth?: string;
  dark?: boolean;
}> = ({ lines = 2, className = '', lineHeightClass = 'h-4', lastLineWidth = '65%', dark = false }) => {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          dark={dark}
          variant="text"
          className={`w-full ${lineHeightClass}`}
          width={i === lines - 1 && lines > 1 ? lastLineWidth : '100%'}
        />
      ))}
    </div>
  );
};

export const SkeletonBadge: React.FC<{
  width?: string;
  height?: string;
  className?: string;
}> = ({ width = '5rem', height = '1.375rem', className = '' }) => {
  return <Skeleton variant="pill" width={width} height={height} className={className} />;
};

export const SkeletonCard: React.FC<{
  children?: React.ReactNode;
  className?: string;
  dark?: boolean;
}> = ({ children, className = '', dark = false }) => {
  return (
    <div
      className={`rounded-xl p-5 border ${
        dark
          ? 'bg-surface-dark border-outline/20 text-surface-bright'
          : 'bg-surface-card border-border-subtle shadow-sm'
      } ${className}`}
      aria-hidden="true"
    >
      {children}
    </div>
  );
};

export const SkeletonTable: React.FC<{
  rows?: number;
  cols?: number;
  className?: string;
}> = ({ rows = 4, cols = 6, className = '' }) => {
  return (
    <div className={`w-full overflow-hidden ${className}`} aria-hidden="true">
      {/* Table Header */}
      <div className="flex items-center gap-4 py-3 px-6 bg-surface-container-low border-b border-border-subtle">
        {Array.from({ length: cols }).map((_, c) => (
          <Skeleton key={c} variant="text" className="h-3 flex-1" />
        ))}
      </div>
      {/* Table Rows */}
      <div className="divide-y divide-border-subtle">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 py-4 px-6">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton
                key={c}
                variant={c === 2 || c === 3 || c === 4 ? 'pill' : 'text'}
                className={c === cols - 1 ? 'h-6 w-20 ml-auto' : 'h-4 flex-1'}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export const SkeletonCodeBlock: React.FC<{
  lines?: number;
  className?: string;
}> = ({ lines = 8, className = '' }) => {
  return (
    <div
      className={`bg-surface-dark rounded-xl overflow-hidden border border-outline/20 p-4 text-surface-bright ${className}`}
      aria-hidden="true"
    >
      {/* Terminal traffic light header */}
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-outline/20">
        <div className="flex items-center gap-2">
          <Skeleton variant="circle" width={12} height={12} dark />
          <Skeleton variant="circle" width={12} height={12} dark />
          <Skeleton variant="circle" width={12} height={12} dark />
          <Skeleton variant="text" width={140} height={12} className="ml-2" dark />
        </div>
        <Skeleton variant="text" width={40} height={12} dark />
      </div>

      {/* Code lines */}
      <div className="space-y-2 font-mono">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <span className="w-8 text-right text-outline text-xs select-none">{140 + i}</span>
            <Skeleton
              variant="text"
              dark
              className="h-3"
              width={`${45 + ((i * 17) % 50)}%`}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
