import { useState, useRef, useEffect, useCallback } from 'react';
import MultiImagePicker from '@/components/MultiImagePicker';
import { getImageUrl } from '@/utils/image';

/* ─── Types ─── */
interface ChatMsg {
  id: number;
  role: 'user' | 'ai';
  content: string;
  images?: string[];
}

interface Conversation {
  id: string;
  title: string;
  messages: ChatMsg[];
  createdAt: number;
}

/* ─── Constants ─── */
const WELCOME_MSG: ChatMsg = {
  id: 0,
  role: 'ai',
  content: '你好！我是 DogWorld AI 助手 🐶 有任何关于狗狗的问题都可以问我，比如健康、训练、饮食、品种等方面的疑问。',
};

const suggestedQuestions = [
  '幼犬什么时候可以洗澡？',
  '狗狗拉稀了怎么办？',
  '金毛和拉布拉多有什么区别？',
  '狗狗一天应该吃多少？',
  '狗狗为什么会吃草？',
  '如何判断狗狗是否生病了？',
];

/* ─── Helpers ─── */
const groupByDate = (convs: Conversation[]) => {
  const now = Date.now();
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const yesterdayStart = todayStart - 86400000;
  const thirtyDaysAgo = now - 30 * 86400000;

  const groups: { label: string; items: Conversation[] }[] = [
    { label: '今天', items: [] },
    { label: '昨天', items: [] },
    { label: '30 天内', items: [] },
    { label: '更早', items: [] },
  ];

  convs.forEach((c) => {
    if (c.createdAt >= todayStart) groups[0].items.push(c);
    else if (c.createdAt >= yesterdayStart) groups[1].items.push(c);
    else if (c.createdAt >= thirtyDaysAgo) groups[2].items.push(c);
    else groups[3].items.push(c);
  });

  return groups.filter((g) => g.items.length > 0);
};

/* ─── Component ─── */
const AIChat = () => {
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    try {
      const saved = localStorage.getItem('dogworld_ai_convs');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([WELCOME_MSG]);
  const [input, setInput] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [images, setImages] = useState<string[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [editingMsgId, setEditingMsgId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Persist conversations
  useEffect(() => {
    localStorage.setItem('dogworld_ai_convs', JSON.stringify(conversations));
  }, [conversations]);

  // Auto-scroll to bottom (skip initial welcome-only state)
  const prevMsgCountRef = useRef(messages.length);
  useEffect(() => {
    if (messages.length > 1 && messages.length !== prevMsgCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMsgCountRef.current = messages.length;
  }, [messages]);

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, []);

  const saveConversation = useCallback((convId: string, msgs: ChatMsg[]) => {
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === convId);
      const title = msgs.find((m) => m.role === 'user')?.content.slice(0, 30) || '新对话';
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], messages: msgs, title };
        return updated;
      }
      return [{ id: convId, title, messages: msgs, createdAt: Date.now() }, ...prev];
    });
  }, []);

  const handleSend = useCallback(async (text?: string) => {
    const question = text || input.trim();
    if (!question && images.length === 0) return;
    if (streaming) return;

    const convId = activeConvId || `conv_${Date.now()}`;
    if (!activeConvId) setActiveConvId(convId);

    // Add user message + empty AI placeholder
    const userMsg: ChatMsg = {
      id: Date.now(),
      role: 'user',
      content: question || (images.length ? `[发送了 ${images.length} 张图片]` : ''),
      images: images.length ? [...images] : undefined,
    };
    const aiMsg: ChatMsg = { id: Date.now() + 1, role: 'ai', content: '' };

    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setInput('');
    setImages([]);
    setStreaming(true);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    // Build conversation history for API (exclude welcome msg & empty placeholder)
    const historyForApi = [...messages, userMsg]
      .filter((m) => m.id !== 0 && m.content)
      .map((m) => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.content }));

    // Stream from backend
    const controller = new AbortController();
    abortRef.current = controller;
    let fullContent = '';

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'}/ai/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ messages: historyForApi }),
          signal: controller.signal,
        }
      );

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No response body');

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') break;

          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              fullContent += `\n\n⚠️ ${parsed.error}`;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { ...updated[updated.length - 1], content: fullContent };
                return updated;
              });
              break;
            }
            if (parsed.content) {
              fullContent += parsed.content;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { ...updated[updated.length - 1], content: fullContent };
                return updated;
              });
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        fullContent += '\n\n[已停止生成]';
      } else {
        fullContent = fullContent || '抱歉，请求失败了，请稍后再试 😢';
      }
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { ...updated[updated.length - 1], content: fullContent };
        return updated;
      });
    } finally {
      setStreaming(false);
      abortRef.current = null;
      // Save after streaming done
      setMessages((prev) => {
        saveConversation(convId, prev);
        return prev;
      });
    }
  }, [input, images, activeConvId, streaming, messages, saveConversation]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const startNewChat = () => {
    setActiveConvId(null);
    setMessages([WELCOME_MSG]);
    setInput('');
    setImages([]);
  };

  const loadConversation = (conv: Conversation) => {
    setActiveConvId(conv.id);
    setMessages(conv.messages);
  };

  const deleteConversation = (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    setConversations((prev) => prev.filter((c) => c.id !== convId));
    if (activeConvId === convId) startNewChat();
  };

  /* ─── Copy & Edit helpers ─── */
  const copyMessage = useCallback((content: string) => {
    navigator.clipboard.writeText(content);
  }, []);

  const startEdit = useCallback((msg: ChatMsg) => {
    setEditingMsgId(msg.id);
    setEditingText(msg.content);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingMsgId(null);
    setEditingText('');
  }, []);

  const submitEdit = useCallback((msgId: number) => {
    const trimmed = editingText.trim();
    if (!trimmed) return;

    // Find the index of this user message
    const idx = messages.findIndex((m) => m.id === msgId);
    if (idx < 0) return;

    // Remove this msg and everything after it, then re-send
    const before = messages.slice(0, idx);
    setMessages(before);
    setEditingMsgId(null);
    setEditingText('');

    // Trigger a new send with edited text
    setTimeout(() => handleSend(trimmed), 50);
  }, [editingText, messages, handleSend]);

  const groups = groupByDate(conversations);
  const isNewChat = messages.length <= 1;

  return (
    <div className="h-[calc(100vh-theme(spacing.16)-theme(spacing.12))] flex bg-white dark:bg-gray-900">

      {/* ══════ Left Sidebar ══════ */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-0'} shrink-0 transition-all duration-300 overflow-hidden border-r border-gray-200/60 dark:border-gray-700/60 bg-gray-50/80 dark:bg-gray-800/80 flex flex-col`}>
        {/* New chat button */}
        <div className="p-3">
          <button
            onClick={startNewChat}
            className="w-full flex items-center gap-2.5 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 hover:shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 transition-all duration-200"
          >
            <span className="text-base">✨</span>
            开启新对话
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto px-2 pb-3 scrollbar-thin">
          {groups.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <p className="text-xs text-gray-400 dark:text-gray-500">暂无历史对话</p>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.label} className="mb-3">
                <p className="px-3 py-1.5 text-[11px] font-semibold text-gray-400 dark:text-gray-500">
                  {group.label}
                </p>
                {group.items.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => loadConversation(conv)}
                    className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer text-sm transition-all duration-150 ${
                      activeConvId === conv.id
                        ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 font-medium'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/60'
                    }`}
                  >
                    <span className="truncate flex-1">{conv.title}</span>
                    <button
                      onClick={(e) => deleteConversation(e, conv.id)}
                      className="opacity-0 group-hover:opacity-100 shrink-0 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-all text-xs"
                      title="删除"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ══════ Main Chat Area ══════ */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <div className="h-12 shrink-0 flex items-center gap-3 px-4 border-b border-gray-200/60 dark:border-gray-700/60">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500 dark:text-gray-400"
            title={sidebarOpen ? '收起侧边栏' : '展开侧边栏'}
          >
            {sidebarOpen ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            )}
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">🐶 DogWorld AI</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-medium">在线</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {messages.map((msg) => (
              <div key={msg.id} className={`group/msg flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {/* Avatar */}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 shadow-sm ${
                  msg.role === 'ai'
                    ? 'bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/40 dark:to-purple-900/40'
                    : 'bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40'
                }`}>
                  {msg.role === 'ai' ? '🐶' : '😊'}
                </div>

                {/* Bubble + actions */}
                <div className="max-w-[80%] flex flex-col">
                  {/* Edit mode */}
                  {msg.role === 'user' && editingMsgId === msg.id ? (
                    <div className="w-full">
                      <div className="border-2 border-blue-500 rounded-2xl px-4 py-3 bg-white dark:bg-gray-800">
                        <textarea
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          className="w-full resize-none bg-transparent text-sm text-gray-900 dark:text-white focus:outline-none leading-relaxed"
                          rows={Math.max(1, editingText.split('\n').length)}
                          autoFocus
                        />
                      </div>
                      <div className="flex justify-end gap-2 mt-2">
                        <button
                          onClick={cancelEdit}
                          className="px-4 py-1.5 text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                          取消
                        </button>
                        <button
                          onClick={() => submitEdit(msg.id)}
                          disabled={!editingText.trim()}
                          className="px-4 py-1.5 text-sm text-white bg-blue-600 rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          发送
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Normal bubble */}
                      <div className={`text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-4 py-3 rounded-2xl rounded-tr-md shadow-sm'
                          : 'text-gray-800 dark:text-gray-200'
                      }`}>
                        {/* Image thumbnails */}
                        {msg.images && msg.images.length > 0 && (
                          <div className={`flex flex-wrap gap-2 ${msg.content ? 'mb-2' : ''}`}>
                            {msg.images.map((url, i) => (
                              <img key={i} src={url.startsWith('http') ? url : getImageUrl(url)} alt="" className="max-w-[200px] max-h-[160px] rounded-lg object-cover" />
                            ))}
                          </div>
                        )}
                        {msg.role === 'ai' ? (
                          msg.content ? (
                            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                              {msg.content}
                              {streaming && msg.id === messages[messages.length - 1]?.id && (
                                <span className="inline-block w-2 h-4 bg-violet-500 rounded-sm ml-0.5 animate-pulse" />
                              )}
                            </div>
                          ) : streaming && msg.id === messages[messages.length - 1]?.id ? (
                            <div className="flex items-center gap-1.5 py-1">
                              <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                              <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                              <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                          ) : (
                            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">{msg.content}</div>
                          )
                        ) : (
                          msg.content && <span className="whitespace-pre-wrap">{msg.content}</span>
                        )}
                      </div>

                      {/* Copy & Edit actions for user messages */}
                      {msg.role === 'user' && msg.content && !streaming && (
                        <div className="flex justify-end gap-1 mt-1 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-150">
                          <button
                            onClick={() => copyMessage(msg.content)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            title="复制"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                            </svg>
                          </button>
                          <button
                            onClick={() => startEdit(msg)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            title="修改"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}

            {/* Suggested questions — shown only in new chat */}
            {isNewChat && (
              <div className="pt-2">
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-3 flex items-center gap-1">
                  <span>💡</span> 你可以试着问：
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestedQuestions.map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSend(q)}
                      className="px-3.5 py-2 text-xs bg-white dark:bg-gray-800 text-violet-600 dark:text-violet-400 rounded-xl border border-violet-200/80 dark:border-violet-800/60 hover:bg-violet-50 dark:hover:bg-violet-900/20 hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-sm transition-all duration-200"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* ── Input Area ── */}
        <div className="shrink-0 border-t border-gray-200/60 dark:border-gray-700/60 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto px-4 py-3">
            {/* Image previews + upload via shared component */}
            <MultiImagePicker images={images} onChange={setImages} max={5} />

            <div className="relative flex items-end gap-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-2.5 focus-within:border-violet-400 dark:focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-400/20 transition-all duration-200">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => { setInput(e.target.value); autoResize(); }}
                onKeyDown={handleKeyDown}
                placeholder="给 DogWorld AI 发送消息..."
                rows={1}
                className="flex-1 resize-none bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none max-h-40 leading-relaxed py-0.5"
              />

              {/* Send / Stop button */}
              {streaming ? (
                <button
                  onClick={() => abortRef.current?.abort()}
                  className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center bg-red-500 text-white shadow-sm hover:bg-red-600 transition-all duration-200"
                  title="停止生成"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                </button>
              ) : (
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() && images.length === 0}
                  className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 ${
                    input.trim() || images.length > 0
                      ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm hover:shadow-md hover:scale-105'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="19" x2="12" y2="5" />
                    <polyline points="5 12 12 5 19 12" />
                  </svg>
                </button>
              )}
            </div>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center mt-2">
              内容由 AI 生成，请仔细甄别
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIChat;
