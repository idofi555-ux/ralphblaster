'use client';

export default function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
      {/* Title skeleton */}
      <div className="h-4 bg-gray-200 rounded animate-shimmer mb-2 w-3/4" />
      
      {/* Description skeleton */}
      <div className="space-y-1.5 mb-3">
        <div className="h-3 bg-gray-200 rounded animate-shimmer w-full" />
        <div className="h-3 bg-gray-200 rounded animate-shimmer w-5/6" />
      </div>
      
      {/* Priority badge skeleton */}
      <div className="flex justify-between items-center">
        <div className="h-5 bg-gray-200 rounded-full animate-shimmer w-16" />
      </div>
    </div>
  );
}
