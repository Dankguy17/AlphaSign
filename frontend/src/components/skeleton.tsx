type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className = "" }: SkeletonProps) {
  return <span aria-hidden className={`skeleton block rounded-md ${className}`} />;
}

export function MarketSnapshotSkeleton() {
  return (
    <section className="panel p-5" aria-busy="true" aria-label="Loading market data">
      <Skeleton className="h-5 w-44" />
      <Skeleton className="mt-3 h-3 w-56" />
      <div className="mt-7 flex items-end justify-between gap-4">
        <div className="space-y-3"><Skeleton className="h-4 w-48" /><Skeleton className="h-12 w-56" /></div>
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="mt-5 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-[86px]" /><Skeleton className="h-[86px]" /><Skeleton className="h-[86px] sm:col-span-2" />
      </div>
      <Skeleton className="mt-4 h-[480px] w-full" />
    </section>
  );
}
