import { memo, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import ExpandableImage from '@/components/ExpandableImage';
import { getImageUrl } from '@/utils/image';
import 'highlight.js/styles/github-dark.css';

interface Props {
  content: string;
}

const remarkPlugins = [remarkGfm];
const rehypePlugins = [rehypeHighlight];

const components = {
  img: ({ src, alt }: { src?: string; alt?: string }) => {
    if (!src) return null;
    return <ExpandableImage src={getImageUrl(src)} alt={alt || ''} variant="detail" />;
  },
};

const MarkdownRenderer = memo(({ content }: Props) => {
  const rendered = useMemo(
    () => (
      <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={components}>
        {content}
      </ReactMarkdown>
    ),
    [content]
  );

  return (
    <div className="prose prose-indigo dark:prose-invert max-w-none
      prose-headings:font-bold prose-headings:text-gray-900 dark:prose-headings:text-white
      prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-p:leading-relaxed
      prose-a:text-indigo-600 prose-a:no-underline hover:prose-a:underline
      prose-code:before:content-none prose-code:after:content-none
      prose-code:bg-gray-100 dark:prose-code:bg-gray-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono
      prose-pre:bg-gray-900 prose-pre:rounded-lg prose-pre:overflow-x-auto
      prose-img:rounded-lg prose-img:shadow-md
      prose-blockquote:border-indigo-500 prose-blockquote:text-gray-600 dark:prose-blockquote:text-gray-400
      prose-table:border-collapse
      prose-th:border prose-th:border-gray-300 dark:prose-th:border-gray-600 prose-th:px-3 prose-th:py-2 prose-th:bg-gray-50 dark:prose-th:bg-gray-800
      prose-td:border prose-td:border-gray-300 dark:prose-td:border-gray-600 prose-td:px-3 prose-td:py-2
      prose-hr:border-gray-200 dark:prose-hr:border-gray-700
      prose-li:text-gray-700 dark:prose-li:text-gray-300"
    >
      {rendered}
    </div>
  );
});

MarkdownRenderer.displayName = 'MarkdownRenderer';
export default MarkdownRenderer;
