import { memo, useMemo } from 'react';

interface HighlightProps {
  text: string;
  query?: string;
  className?: string;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const Highlight = memo(({ text, query, className = 'bg-amber-200 dark:bg-amber-700/60 text-amber-900 dark:text-amber-100 rounded-sm px-0.5' }: HighlightProps) => {
  const parts = useMemo(() => {
    if (!query?.trim()) return [text];
    try {
      const regex = new RegExp(`(${escapeRegex(query.trim())})`, 'gi');
      return text.split(regex);
    } catch {
      return [text];
    }
  }, [text, query]);

  if (parts.length === 1) return <>{text}</>;

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query!.trim().toLowerCase() ? (
          <mark key={i} className={className}>{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
});

Highlight.displayName = 'Highlight';

export default Highlight;
