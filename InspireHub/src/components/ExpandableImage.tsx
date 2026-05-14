import { useState, memo } from 'react';
import LazyImage from '@/components/LazyImage';

interface ExpandableImageProps {
  src: string;
  alt?: string;
  /** 'card' = small thumbnail (50%), 'detail' = medium thumbnail (65%) */
  variant?: 'card' | 'detail';
}

const COLLAPSED_WIDTH = { card: '55%', detail: '60%' };

const ExpandableImage = memo(({ src, alt = '', variant = 'card' }: ExpandableImageProps) => {
  const [expanded, setExpanded] = useState(false);
  const [rotation, setRotation] = useState(0);

  const collapse = () => { setExpanded(false); setRotation(0); };
  const rotateLeft = (e: React.MouseEvent) => { e.stopPropagation(); setRotation((r) => r - 90); };
  const rotateRight = (e: React.MouseEvent) => { e.stopPropagation(); setRotation((r) => r + 90); };

  return (
    <span className="not-prose block">
      {/* Toolbar when expanded */}
      {expanded && (
        <span className="flex items-center gap-5 mb-2 text-xs text-gray-500 dark:text-gray-400">
          <button
            onClick={collapse}
            className="flex items-center gap-1 hover:text-indigo-500 transition-colors"
          >
            🔍 收起
          </button>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-indigo-500 transition-colors"
          >
            🔎 查看大图
          </a>
          <button
            onClick={rotateLeft}
            className="flex items-center gap-1 hover:text-indigo-500 transition-colors"
          >
            ↺ 向左旋转
          </button>
          <button
            onClick={rotateRight}
            className="flex items-center gap-1 hover:text-indigo-500 transition-colors"
          >
            ↻ 向右旋转
          </button>
        </span>
      )}

      {/* Wrapper: width transitions smoothly, image always fills 100% of wrapper */}
      <span
        className="cursor-pointer block"
        style={{
          width: expanded ? '100%' : COLLAPSED_WIDTH[variant],
          transition: 'width 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <span className="rounded-lg overflow-hidden block">
          <LazyImage
            src={src}
            alt={alt}
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: 'transform 0.3s ease',
            }}
            className="w-full"
            placeholderClassName="w-full h-48"
          />
        </span>
      </span>
    </span>
  );
});

ExpandableImage.displayName = 'ExpandableImage';
export default ExpandableImage;
