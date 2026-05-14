import { useState, useEffect, useRef, useCallback, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

const HISTORY_KEY = 'search_history';
const MAX_HISTORY = 5;

const getHistory = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
};

const saveHistory = (keyword: string) => {
  const list = getHistory().filter((k) => k !== keyword);
  list.unshift(keyword);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_HISTORY)));
};

const removeHistory = (keyword: string) => {
  const list = getHistory().filter((k) => k !== keyword);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
};

const clearHistory = () => {
  localStorage.removeItem(HISTORY_KEY);
};

const SearchBar = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<string[]>(getHistory);
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const refreshHistory = useCallback(() => setHistory(getHistory()), []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const doSearch = useCallback((keyword: string) => {
    const trimmed = keyword.trim();
    if (!trimmed) return;
    saveHistory(trimmed);
    refreshHistory();
    setShowDropdown(false);
    setQuery('');
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  }, [navigate, refreshHistory]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    doSearch(query);
  };

  const handleRemove = (e: React.MouseEvent, keyword: string) => {
    e.stopPropagation();
    removeHistory(keyword);
    refreshHistory();
  };

  const handleClear = () => {
    clearHistory();
    refreshHistory();
  };

  return (
    <div ref={wrapperRef} className="relative">
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { refreshHistory(); setShowDropdown(true); }}
          placeholder="搜索文章、知识、用户..."
          className="w-44 lg:w-56 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
        />
      </form>

      {showDropdown && history.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden z-50">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100 dark:border-gray-700">
            <span className="text-[11px] text-gray-400">搜索历史</span>
            <button
              onClick={handleClear}
              className="text-[11px] text-gray-400 hover:text-red-500 transition-colors"
            >
              清空
            </button>
          </div>
          {history.map((keyword) => (
            <button
              key={keyword}
              onClick={() => doSearch(keyword)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-gray-700 transition-colors group"
            >
              <span className="truncate">🕐 {keyword}</span>
              <span
                onClick={(e) => handleRemove(e, keyword)}
                className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 text-xs ml-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ✕
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
