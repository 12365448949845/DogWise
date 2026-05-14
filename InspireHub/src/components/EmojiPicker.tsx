import { memo } from 'react';

const EMOJIS = [
  '😀','😂','🤣','😊','😍','🥰','😘','😜',
  '🤗','😎','🥺','😢','😭','😤','🤔','🙄',
  '😴','🤮','👍','👎','👏','🙏','💪','❤️',
  '🔥','⭐','🎉','🌹','💯','✨','🥇','🍻',
  '☕','🎵','📸','💬','👋','🤝','✅','❌',
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  className?: string;
}

const EmojiPicker = memo(({ onSelect, className = '' }: EmojiPickerProps) => (
  <div className={`p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50 w-64 max-h-48 overflow-y-auto ${className}`}>
    <div className="grid grid-cols-8 gap-1">
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onSelect(emoji)}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-lg transition-colors"
        >
          {emoji}
        </button>
      ))}
    </div>
  </div>
));

EmojiPicker.displayName = 'EmojiPicker';
export default EmojiPicker;
