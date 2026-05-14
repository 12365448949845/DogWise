import { useState, useRef, useEffect, memo } from 'react';

interface LazyImageProps {
  src: string;
  alt?: string;
  className?: string;
  placeholderClassName?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}

const LazyImage = memo(({
  src,
  alt = '',
  className = '',
  placeholderClassName = '',
  onClick,
  style,
}: LazyImageProps) => {
  const [loaded, setLoaded] = useState(false);
  const [inView, setInView] = useState(false);
  const imgRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <span ref={imgRef} className={`relative block ${!loaded ? placeholderClassName : ''}`} onClick={onClick}>
      {/* Placeholder */}
      {!loaded && (
        <span className={`absolute inset-0 block bg-gray-200 dark:bg-gray-700 animate-pulse rounded`} />
      )}

      {/* Actual image - only load when in viewport */}
      {inView && (
        <img
          src={src}
          alt={alt}
          style={style}
          className={`transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'} ${className}`}
          onLoad={() => setLoaded(true)}
          loading="lazy"
        />
      )}
    </span>
  );
});

LazyImage.displayName = 'LazyImage';
export default LazyImage;
