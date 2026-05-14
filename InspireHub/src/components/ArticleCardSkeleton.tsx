import { memo } from 'react';

const Bone = ({ className = '' }: { className?: string }) => (
  <div className={`bg-gray-200 dark:bg-gray-700 rounded animate-pulse ${className}`} />
);

const ArticleCardSkeleton = memo(() => (
  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
    {/* Author header */}
    <div className="flex items-center gap-3 px-5 pt-5 pb-3">
      <Bone className="w-10 h-10 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Bone className="h-4 w-28" />
        <Bone className="h-3 w-20" />
      </div>
    </div>

    {/* Title + content */}
    <div className="px-5 pb-3 space-y-2">
      <Bone className="h-5 w-3/4" />
      <Bone className="h-4 w-full" />
      <Bone className="h-4 w-5/6" />
    </div>

    {/* Cover image placeholder */}
    <div className="px-5 pb-3">
      <Bone className="h-44 w-[60%] rounded-lg" />
    </div>

    {/* Tags */}
    <div className="flex gap-1.5 px-5 pb-3">
      <Bone className="h-5 w-14 rounded-full" />
      <Bone className="h-5 w-16 rounded-full" />
      <Bone className="h-5 w-12 rounded-full" />
    </div>

    {/* Action bar */}
    <div className="flex items-center gap-4 px-5 py-3 border-t border-gray-100 dark:border-gray-700">
      <Bone className="h-3 w-10" />
      <Bone className="h-3 w-10" />
      <Bone className="h-3 w-10" />
    </div>
  </div>
));

ArticleCardSkeleton.displayName = 'ArticleCardSkeleton';
export default ArticleCardSkeleton;
