import { useState, useRef, useCallback, useEffect, type FormEvent, type KeyboardEvent, type DragEvent, type ClipboardEvent } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { articleApi } from '@/features/article/services/articleApi';
import { knowledgeApi } from '@/services/knowledgeApi';
import { uploadApi } from '@/services/uploadApi';
import { getImageUrl } from '@/utils/image';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import ImageUpload from '@/components/ImageUpload';
import MarkdownToolbar from '@/components/MarkdownToolbar';
import { useAppSelector } from '@/store/hooks';

const KNOWLEDGE_CATEGORIES = [
  { id: 'breeds', icon: '🐕', label: '品种百科' },
  { id: 'health', icon: '🏥', label: '健康护理' },
  { id: 'training', icon: '🎓', label: '训练教程' },
  { id: 'nutrition', icon: '🥩', label: '饮食营养' },
  { id: 'daily', icon: '🏠', label: '日常养护' },
];

const CreateArticle = () => {
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id?: string }>();
  const location = useLocation();
  const { user } = useAppSelector((state) => state.auth);
  const isAdmin = user?.role === 'admin';
  const isEditMode = Boolean(editId);
  const isKnowledgeEdit = isEditMode && location.pathname.includes('/knowledge/');

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [summary, setSummary] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [cover, setCover] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(!!editId);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [publishTarget, setPublishTarget] = useState<'article' | 'knowledge'>('article');
  const [knowledgeCategory, setKnowledgeCategory] = useState('');
  const [showTargetMenu, setShowTargetMenu] = useState(false);

  // Load existing article for edit mode
  useEffect(() => {
    if (!editId) return;
    const load = async () => {
      try {
        if (isKnowledgeEdit) {
          const res = await knowledgeApi.getById(editId);
          const a = res.data.article;
          setTitle(a.title);
          setContent(a.content);
          setSummary(a.summary || '');
          setTags(a.tags || []);
          setCover(a.cover || '');
          setPublishTarget('knowledge');
          setKnowledgeCategory(a.category);
          setShowSettings(true);
        } else {
          const res = await articleApi.getById(editId);
          const a = res.data.article;
          setTitle(a.title);
          setContent(a.content);
          setSummary(a.summary || '');
          setTags(a.tags || []);
          setCover(a.cover || '');
          setPublishTarget('article');
          setShowSettings(true);
        }
      } catch {
        setError('加载文章失败');
      } finally {
        setFetching(false);
      }
    };
    load();
  }, [editId, isKnowledgeEdit]);

  const selectedCatObj = KNOWLEDGE_CATEGORIES.find((c) => c.id === knowledgeCategory);
  const targetLabel = publishTarget === 'knowledge'
    ? (selectedCatObj ? `📚 ${selectedCatObj.icon} ${selectedCatObj.label}` : '📚 知识库（请选分类）')
    : '📝 发现区';

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const wordCount = content.length;
  const readTime = Math.max(1, Math.ceil(wordCount / 500));

  const handleAddTag = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim().replace(/,/g, '');
      if (newTag && !tags.includes(newTag) && tags.length < 5) {
        setTags([...tags, newTag]);
      }
      setTagInput('');
    }
  };

  const removeTag = (index: number) => {
    setTags(tags.filter((_, i) => i !== index));
  };

  const handleSubmit = useCallback(async (e?: FormEvent) => {
    e?.preventDefault();
    setError('');

    if (!content.trim()) {
      setError('请输入文章内容');
      return;
    }

    // Auto-generate title from first line if not provided, strip markdown syntax
    const finalTitle = title.trim() || content.trim().split('\n')[0]
      .replace(/^#+\s*/, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/~~(.*?)~~/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .trim()
      .slice(0, 100) || '无标题';

    const token = localStorage.getItem('token');
    if (!token) {
      setError('登录已过期，请重新登录');
      navigate('/login');
      return;
    }

    setLoading(true);
    try {
      if (isEditMode && editId && publishTarget === 'knowledge') {
        await knowledgeApi.update(editId, {
          title: finalTitle,
          content: content.trim(),
          summary: summary.trim(),
          tags,
          cover: cover || undefined,
          category: knowledgeCategory,
        } as Partial<import('@/services/knowledgeApi').KnowledgeArticle>);
        navigate(`/knowledge/${editId}`);
      } else if (isEditMode && editId && publishTarget === 'article') {
        await articleApi.update(editId, {
          title: finalTitle,
          content: content.trim(),
          summary: summary.trim(),
          tags,
          cover: cover || undefined,
        });
        navigate(`/article/${editId}`);
      } else if (publishTarget === 'knowledge' && isAdmin) {
        const res = await knowledgeApi.create({
          title: finalTitle,
          content: content.trim(),
          summary: summary.trim(),
          tags,
          cover: cover || undefined,
          category: knowledgeCategory,
        });
        navigate(`/knowledge/${res.data.article._id}`);
      } else {
        const res = await articleApi.create({
          title: finalTitle,
          content: content.trim(),
          summary: summary.trim(),
          tags,
          cover: cover || undefined,
        });
        navigate(`/article/${res.data.article._id}`);
      }
    } catch (err: unknown) {
      const e = err as { code?: number; message?: string };
      console.error('[CreateArticle] publish error:', err);
      if (e.code === 401) {
        setError('登录已过期，请重新登录');
      } else {
        setError(e.message || '发布失败，请重试');
      }
    } finally {
      setLoading(false);
    }
  }, [title, content, summary, tags, cover, navigate, publishTarget, isAdmin, knowledgeCategory, isEditMode, editId]);

  const insertImageAtCursor = useCallback((url: string) => {
    const textarea = textareaRef.current;
    const fullUrl = getImageUrl(url);
    const markdown = `\n![image](${fullUrl})\n`;

    if (textarea) {
      const start = textarea.selectionStart;
      const newValue = content.slice(0, start) + markdown + content.slice(start);
      setContent(newValue);
      setTimeout(() => {
        textarea.focus();
        const cursorPos = start + markdown.length;
        textarea.setSelectionRange(cursorPos, cursorPos);
      }, 0);
    } else {
      setContent(prev => prev + markdown);
    }
  }, [content]);

  const [uploading, setUploading] = useState(false);

  const handleImageUpload = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const res = await uploadApi.uploadImage(file);
      insertImageAtCursor(res.data.url);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || '图片上传失败');
    } finally {
      setUploading(false);
    }
  }, [insertImageAtCursor]);

  const handlePaste = useCallback((e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) handleImageUpload(file);
        break;
      }
    }
  }, [handleImageUpload]);

  const handleDrop = useCallback((e: DragEvent<HTMLTextAreaElement>) => {
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.type.startsWith('image/')) {
      e.preventDefault();
      handleImageUpload(file);
    }
  }, [handleImageUpload]);

  const handleDragOver = useCallback((e: DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
  }, []);

  if (fetching) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-sm text-gray-400">加载文章中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors"
              title="返回"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm text-gray-400 dark:text-gray-500">
              {wordCount} 字 · 约 {readTime} 分钟阅读
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                showSettings
                  ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 text-amber-600'
                  : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              ⚙️ 设置
            </button>
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                showPreview
                  ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 text-amber-600'
                  : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              👁 预览
            </button>
            {isAdmin && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowTargetMenu(!showTargetMenu)}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors flex items-center gap-1.5 ${
                    publishTarget === 'knowledge'
                      ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <span>{targetLabel}</span>
                  <svg className={`w-3.5 h-3.5 transition-transform ${showTargetMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showTargetMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowTargetMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 z-50 w-56 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl py-1 overflow-hidden">
                      {/* 发现区 */}
                      <button
                        type="button"
                        onClick={() => { setPublishTarget('article'); setKnowledgeCategory(''); setShowTargetMenu(false); }}
                        className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
                          publishTarget === 'article'
                            ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 font-medium'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750'
                        }`}
                      >
                        <span className="text-base">📝</span>
                        <span>发现区</span>
                        {publishTarget === 'article' && <span className="ml-auto text-amber-500">✓</span>}
                      </button>

                      <div className="h-px bg-gray-100 dark:bg-gray-700 mx-2 my-1" />

                      {/* 知识库 - 树形 */}
                      <div className="px-4 py-2 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">📚 知识库</div>
                      {KNOWLEDGE_CATEGORIES.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => { setPublishTarget('knowledge'); setKnowledgeCategory(cat.id); setShowTargetMenu(false); setShowSettings(true); }}
                          className={`w-full flex items-center gap-2.5 pl-8 pr-4 py-2 text-sm transition-colors ${
                            publishTarget === 'knowledge' && knowledgeCategory === cat.id
                              ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 font-medium'
                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-750'
                          }`}
                        >
                          <span className="w-4 h-4 flex items-center justify-center text-gray-300 dark:text-gray-600">└</span>
                          <span className="text-base">{cat.icon}</span>
                          <span>{cat.label}</span>
                          {publishTarget === 'knowledge' && knowledgeCategory === cat.id && <span className="ml-auto text-purple-500">✓</span>}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={loading || !content.trim() || (publishTarget === 'knowledge' && !knowledgeCategory)}
              className="px-5 py-1.5 bg-amber-500 text-white text-sm font-bold rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {loading ? (isEditMode ? '保存中...' : '发布中...') : isEditMode ? '保存修改' : publishTarget === 'knowledge' ? '发布到知识库' : '发布文章'}
            </button>
          </div>
        </div>
      </header>

      {/* Error toast */}
      {error && (
        <div className="max-w-[1400px] mx-auto w-full px-4 pt-3">
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
            <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600">✕</button>
          </div>
        </div>
      )}

      {/* Settings Panel (collapsible) */}
      {showSettings && (
        <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="max-w-[1400px] mx-auto px-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Summary */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                  摘要
                </label>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  maxLength={300}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition resize-none"
                  placeholder="文章的简短描述（可选，不填则自动截取）"
                />
              </div>

              {/* Cover */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                  封面图片
                </label>
                <ImageUpload value={cover} onChange={setCover} className="[&>div]:h-[88px]" />
              </div>

              {/* Tags */}
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                  标签（最多 5 个，回车添加）
                </label>
                <div className="flex flex-wrap items-center gap-2 p-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 min-h-[40px]">
                  {tags.map((tag, i) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full text-xs font-medium"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => removeTag(i)}
                        className="hover:text-red-500 transition-colors"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  {tags.length < 5 && (
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleAddTag}
                      className="flex-1 min-w-[120px] bg-transparent text-sm text-gray-900 dark:text-white outline-none placeholder-gray-400"
                      placeholder={tags.length === 0 ? '输入标签，按回车添加...' : '继续添加...'}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Editor Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor */}
        <div className={`flex-1 flex flex-col min-w-0 ${showPreview ? 'border-r border-gray-200 dark:border-gray-700' : ''}`}>
          {/* Title */}
          <div className="px-6 pt-6 pb-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              className="w-full text-2xl md:text-3xl font-bold text-gray-900 dark:text-white bg-transparent outline-none placeholder-gray-400 dark:placeholder-gray-500 border-b-2 border-gray-200 dark:border-gray-700 focus:border-amber-500 pb-2 transition-colors"
              placeholder="请输入文章标题"
            />
          </div>

          {/* Markdown Toolbar */}
          <div className="px-6 py-1">
            <MarkdownToolbar
              textareaId="create-content-textarea"
              onInsert={setContent}
              currentValue={content}
              onImageUpload={handleImageUpload}
            />
          </div>

          {/* Content Textarea */}
          <div className="flex-1 px-6 pb-6 relative">
            {uploading && (
              <div className="absolute top-2 right-8 px-3 py-1 bg-amber-500 text-white text-xs rounded-full animate-pulse z-10">
                图片上传中...
              </div>
            )}
            <textarea
              ref={textareaRef}
              id="create-content-textarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onPaste={handlePaste}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="w-full h-full min-h-[500px] bg-transparent text-gray-900 dark:text-white text-base leading-relaxed outline-none resize-none placeholder-gray-300 dark:placeholder-gray-600 font-mono"
              placeholder="开始写作...&#10;&#10;支持 Markdown 语法：&#10;# 标题&#10;**粗体** *斜体*&#10;- 列表&#10;> 引用&#10;```代码块```&#10;&#10;💡 支持粘贴/拖拽图片直接上传"
            />
          </div>
        </div>

        {/* Live Preview */}
        {showPreview && (
          <div className="hidden md:block flex-1 min-w-0 overflow-y-auto bg-white dark:bg-gray-800">
            <div className="px-8 py-6 max-w-none">
              {title && (
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-6">
                  {title}
                </h1>
              )}
              {content.trim() ? (
                <div className="prose dark:prose-invert prose-amber max-w-none">
                  <MarkdownRenderer content={content} />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-gray-300 dark:text-gray-600">
                  <svg className="w-16 h-16 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <p className="text-sm">在左侧编写内容，实时预览将显示在这里</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateArticle;
