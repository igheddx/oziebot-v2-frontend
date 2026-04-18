type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className = "" }: SkeletonProps) {
  return <div className={`animate-pulse rounded-lg bg-surface/70 ${className}`} />;
}

export function CardSkeleton() {
  return (
    <div className="oz-panel p-3">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-2 h-6 w-24" />
      <Skeleton className="mt-2 h-3 w-16" />
    </div>
  );
}

export function RowSkeleton() {
  return (
    <div className="oz-panel p-3">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-2 h-3 w-40" />
    </div>
  );
}
