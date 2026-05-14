import { useState, memo } from 'react';
import LazyImage from '@/components/LazyImage';

interface ImageGalleryProps {
  images: string[];
  alt?: string;
}

/**
 * ImageGallery — Juejin-style gallery
 *
 * Collapsed : images in a flex row, fully visible, proportionally scaled, left-aligned.
 * Expanded  : clicked image slides open at full width (smooth width animation);
 *             other images shrink to small thumbnails below.
 */
const CURSOR_LEFT = `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><path d='M19 12H5'/><path d='M12 19l-7-7 7-7'/></svg>") 16 16, pointer`;
const CURSOR_RIGHT = `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><path d='M5 12h14'/><path d='M12 5l7 7-7 7'/></svg>") 16 16, pointer`;

const ImageGallery = memo(({ images, alt = '' }: ImageGalleryProps) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [rotation, setRotation] = useState(0);

  if (images.length === 0) return null;

  const isExpanded = activeIndex !== null;
  const colCount = Math.min(images.length, 4);
  const gapPx = 6;
  const collapsedItemWidth = `calc(${100 / colCount}% - ${((colCount - 1) * gapPx) / colCount}px)`;

  const handleClick = (idx: number) => {
    setActiveIndex((prev) => (prev === idx ? null : idx));
    setRotation(0);
  };

  const collapse = () => { setActiveIndex(null); setRotation(0); };

  return (
    <div>
      {/* ── Toolbar (slides in when expanded) ── */}
      <div
        className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 overflow-hidden"
        style={{
          maxHeight: isExpanded ? 30 : 0,
          opacity: isExpanded ? 1 : 0,
          marginBottom: isExpanded ? 6 : 0,
          transition: 'max-height 0.35s ease, opacity 0.3s ease, margin-bottom 0.3s ease',
        }}
      >
        <button onClick={collapse} className="hover:text-indigo-500 transition-colors">🔍 收起</button>
        {activeIndex !== null && (
          <>
            <a href={images[activeIndex]} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-500 transition-colors">🔎 查看大图</a>
            <button onClick={() => setRotation((r) => r - 90)} className="hover:text-indigo-500 transition-colors">↺ 左旋</button>
            <button onClick={() => setRotation((r) => r + 90)} className="hover:text-indigo-500 transition-colors">↻ 右旋</button>
            <span className="text-gray-400 ml-auto">{activeIndex + 1} / {images.length}</span>
          </>
        )}
      </div>

      {/* ── Main large image (slides open with width animation) ── */}
      <div
        style={{
          width: isExpanded ? '100%' : '0%',
          opacity: isExpanded ? 1 : 0,
          overflow: 'hidden',
          marginBottom: isExpanded ? 8 : 0,
          transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s ease, margin-bottom 0.3s ease',
        }}
      >
        {activeIndex !== null && (
          <div className="rounded-xl overflow-hidden relative">
            <LazyImage
              src={images[activeIndex]}
              alt={alt}
              className="w-full"
              placeholderClassName="w-full h-48"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: 'transform 0.3s ease',
              }}
            />
            {/* Three click zones: left (prev) | center (collapse) | right (next) */}
            <div className="absolute inset-0 flex">
              {/* Left zone */}
              <div
                className="w-1/3 h-full"
                style={{ cursor: activeIndex > 0 ? CURSOR_LEFT : 'zoom-out' }}
                onClick={() => activeIndex > 0 ? handleClick(activeIndex - 1) : collapse()}
              />
              {/* Center zone */}
              <div
                className="w-1/3 h-full"
                style={{ cursor: 'zoom-out' }}
                onClick={collapse}
              />
              {/* Right zone */}
              <div
                className="w-1/3 h-full"
                style={{ cursor: activeIndex < images.length - 1 ? CURSOR_RIGHT : 'zoom-out' }}
                onClick={() => activeIndex < images.length - 1 ? handleClick(activeIndex + 1) : collapse()}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Image strip (grid when collapsed, thumbnails when expanded) ── */}
      <div className="flex gap-1.5" style={{ maxWidth: isExpanded ? '100%' : ({ 1: '50%', 2: '72%' } as Record<number, string>)[colCount] || '100%', transition: 'max-width 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}>
        {images.map((src, idx) => {
          const isCurrent = isExpanded && idx === activeIndex;
          return (
            <div
              key={idx}
              className={`rounded-lg overflow-hidden cursor-pointer ${
                isCurrent ? 'ring-2 ring-indigo-400' : ''
              } ${isExpanded ? '' : 'hover:opacity-90'}`}
              onClick={() => handleClick(idx)}
              style={{
                width: isExpanded ? 56 : collapsedItemWidth,
                opacity: isExpanded && !isCurrent ? 0.65 : 1,
                flexShrink: 0,
                transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease',
              }}
            >
              <LazyImage
                src={src}
                alt={`${alt} ${idx + 1}`}
                className={`w-full ${isExpanded ? 'h-14 object-cover' : ''}`}
                placeholderClassName="w-full h-28"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});

ImageGallery.displayName = 'ImageGallery';
export default ImageGallery;
