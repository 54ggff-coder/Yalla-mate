import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className }) => {
  return (
    <div className={`animate-pulse bg-slate-200/80 rounded-lg ${className}`}></div>
  );
};

export const OutingCardSkeleton = () => (
  <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-3.5">
    <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="w-1/3 h-4" />
          <Skeleton className="w-1/4 h-3" />
        </div>
    </div>
    <Skeleton className="w-full h-4" />
    <Skeleton className="w-4/5 h-4" />
    <div className="flex gap-2 pt-2">
      <Skeleton className="w-16 h-6 rounded-full" />
      <Skeleton className="w-20 h-6 rounded-full" />
    </div>
  </div>
);

export const ReelCardSkeleton = () => (
  <div className="w-full h-[600px] bg-slate-900 rounded-3xl relative overflow-hidden flex flex-col justify-end p-6 space-y-4">
    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
    <div className="absolute right-4 bottom-24 flex flex-col items-center gap-4 z-10">
      <Skeleton className="w-12 h-12 rounded-full bg-slate-800" />
      <Skeleton className="w-10 h-10 rounded-full bg-slate-800" />
      <Skeleton className="w-10 h-10 rounded-full bg-slate-800" />
      <Skeleton className="w-10 h-10 rounded-full bg-slate-800" />
    </div>
    <div className="space-y-2 z-10 max-w-[80%]">
      <div className="flex items-center gap-2">
        <Skeleton className="w-8 h-8 rounded-full bg-slate-800" />
        <Skeleton className="w-24 h-4 bg-slate-800" />
      </div>
      <Skeleton className="w-full h-4 bg-slate-800" />
      <Skeleton className="w-2/3 h-4 bg-slate-800" />
    </div>
  </div>
);

export const FeedItemSkeleton = () => (
  <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Skeleton className="w-11 h-11 rounded-full" />
        <div className="space-y-1.5">
          <Skeleton className="w-32 h-4" />
          <Skeleton className="w-20 h-3" />
        </div>
      </div>
      <Skeleton className="w-12 h-4" />
    </div>
    <Skeleton className="w-full h-48 rounded-2xl" />
    <div className="space-y-1.5">
      <Skeleton className="w-full h-4" />
      <Skeleton className="w-5/6 h-4" />
    </div>
    <div className="flex gap-4 pt-2 border-t border-slate-50">
      <Skeleton className="w-16 h-5" />
      <Skeleton className="w-16 h-5" />
    </div>
  </div>
);

