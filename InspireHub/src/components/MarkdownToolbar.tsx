import { useRef } from 'react';

interface Props {
  textareaId: string;
  currentValue: string;
  onInsert: (newValue: string) => void;
  onImageUpload?: (file: File) => void;
}

const actions = [
  { label: 'B', title: 'Bold', prefix: '**', suffix: '**', placeholder: 'bold text' },
  { label: 'I', title: 'Italic', prefix: '*', suffix: '*', placeholder: 'italic text' },
  { label: '~~', title: 'Strikethrough', prefix: '~~', suffix: '~~', placeholder: 'strikethrough' },
  { label: 'H1', title: 'Heading 1', prefix: '# ', suffix: '', placeholder: 'heading' },
  { label: 'H2', title: 'Heading 2', prefix: '## ', suffix: '', placeholder: 'heading' },
  { label: 'H3', title: 'Heading 3', prefix: '### ', suffix: '', placeholder: 'heading' },
  { label: '""', title: 'Blockquote', prefix: '> ', suffix: '', placeholder: 'quote' },
  { label: '`', title: 'Inline Code', prefix: '`', suffix: '`', placeholder: 'code' },
  { label: '```', title: 'Code Block', prefix: '```\n', suffix: '\n```', placeholder: 'code block' },
  { label: '🔗', title: 'Link', prefix: '[', suffix: '](url)', placeholder: 'link text' },
  { label: '—', title: 'Horizontal Rule', prefix: '\n---\n', suffix: '', placeholder: '' },
  { label: '•', title: 'Unordered List', prefix: '- ', suffix: '', placeholder: 'item' },
  { label: '1.', title: 'Ordered List', prefix: '1. ', suffix: '', placeholder: 'item' },
];

const MarkdownToolbar = ({ textareaId, currentValue, onInsert, onImageUpload }: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAction = (prefix: string, suffix: string, placeholder: string) => {
    const textarea = document.getElementById(textareaId) as HTMLTextAreaElement | null;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = currentValue.slice(start, end) || placeholder;

    const newValue =
      currentValue.slice(0, start) + prefix + selected + suffix + currentValue.slice(end);
    onInsert(newValue);

    setTimeout(() => {
      textarea.focus();
      const cursorPos = start + prefix.length + selected.length + suffix.length;
      textarea.setSelectionRange(cursorPos, cursorPos);
    }, 0);
  };

  const handleImageClick = () => {
    if (onImageUpload) {
      fileInputRef.current?.click();
    } else {
      handleAction('![', '](url)', 'alt text');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImageUpload) {
      onImageUpload(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex flex-wrap items-center gap-1 px-3 py-2 border border-b-0 border-gray-300 dark:border-gray-600 rounded-t-lg bg-gray-50 dark:bg-gray-800/50">
      {actions.map((action, i) => (
        <span key={action.title} className="contents">
          <button
            type="button"
            title={action.title}
            onClick={() => handleAction(action.prefix, action.suffix, action.placeholder)}
            className="min-w-[32px] h-8 px-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-amber-100 dark:hover:bg-gray-700 hover:text-amber-600 dark:hover:text-amber-400 rounded transition-colors"
          >
            {action.label}
          </button>
          {(i === 2 || i === 5 || i === 8 || i === 10) && (
            <span className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1" />
          )}
        </span>
      ))}

      <span className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1" />

      {/* Image Upload Button */}
      <button
        type="button"
        title="上传图片"
        onClick={handleImageClick}
        className="min-w-[32px] h-8 px-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-amber-100 dark:hover:bg-gray-700 hover:text-amber-600 dark:hover:text-amber-400 rounded transition-colors"
      >
        📷
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
};

export default MarkdownToolbar;
