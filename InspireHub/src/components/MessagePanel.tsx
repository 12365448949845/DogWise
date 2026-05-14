import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { messageApi } from '@/features/message/services/messageApi';
import { userApi } from '@/features/user/services/userApi';
import { uploadApi } from '@/services/uploadApi';
import { useAppSelector } from '@/store/hooks';
import { getImageUrl } from '@/utils/image';
import EmojiPicker from '@/components/EmojiPicker';
import type { Message, Conversation } from '@shared/types/message';

const TIME_GAP_MS = 5 * 60 * 1000; // 5 minutes
const RECALL_WINDOW_MS = 5 * 60 * 1000;
function isWithinRecallWindow(createdAt: string): boolean {
  const elapsed = new Date().getTime() - new Date(createdAt).getTime();
  return elapsed < RECALL_WINDOW_MS;
}

const MessagePanel = () => {
  const { user: currentUser } = useAppSelector((state) => state.auth);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeUserId = searchParams.get('user') || '';

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [activePartner, setActivePartner] = useState<{ _id: string; username: string; avatar: string } | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; msg: Message; canRecall: boolean } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevMsgCountRef = useRef(0);
  const sendingRef = useRef(false);

  const loadConversations = useCallback(async () => {
    try {
      const res = await messageApi.getConversations();
      setConversations(res.data.conversations);
    } catch { /* silent */ }
  }, []);

  const loadChat = useCallback(async (partnerId: string, convs: Conversation[]) => {
    setLoading(true);
    try {
      const existing = convs.find((c) => c.userId === partnerId);
      if (existing) {
        setActivePartner({ _id: existing.userId, username: existing.username, avatar: existing.avatar });
      } else {
        const profileRes = await userApi.getProfile(partnerId);
        const u = profileRes.data.user;
        setActivePartner({ _id: u._id, username: u.username, avatar: u.avatar });
      }
      const res = await messageApi.getMessages(partnerId, { page: 1, limit: 50 });
      setMessages(res.data.messages);
      setCurrentPage(1);
      setHasMore(res.data.pagination.page < res.data.pagination.pages);
      await messageApi.markAsRead(partnerId);
      // Refresh sidebar to update unread badges
      const convRes = await messageApi.getConversations().catch(() => null);
      if (convRes) setConversations(convRes.data.conversations);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  // Initial load + react to activeUserId changes
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const convRes = await messageApi.getConversations().catch(() => null);
      if (cancelled) return;
      const convs = convRes?.data.conversations || [];
      setConversations(convs);

      if (activeUserId) {
        await loadChat(activeUserId, convs);
      }
    };

    init();

    // Poll for new messages when a chat is open
    if (activeUserId) {
      pollRef.current = setInterval(async () => {
        // Skip poll if currently sending (avoid overwriting temp messages)
        if (sendingRef.current) return;
        try {
          const res = await messageApi.getMessages(activeUserId, { page: 1, limit: 50 });
          if (cancelled || sendingRef.current) return;
          const newMsgs = res.data.messages;
          setMessages((prev) => {
            // If we have temp messages, don't replace
            if (prev.some((m) => m._id.startsWith('temp-'))) return prev;
            // If user loaded older pages, only append genuinely new messages
            // by comparing the latest message ID
            const lastReal = prev.length > 0 ? prev[prev.length - 1]._id : '';
            const lastNew = newMsgs.length > 0 ? newMsgs[newMsgs.length - 1]._id : '';
            if (lastReal === lastNew) return prev; // no change
            // If prev has more than 50 messages (loaded history), merge new ones
            if (prev.length > 50) {
              // Find messages in newMsgs that are newer than our latest
              const latestIdx = newMsgs.findIndex((m) => m._id === lastReal);
              if (latestIdx >= 0 && latestIdx < newMsgs.length - 1) {
                return [...prev, ...newMsgs.slice(latestIdx + 1)];
              }
              return prev; // can't merge safely, skip
            }
            return newMsgs;
          });
        } catch { /* silent */ }
      }, 5000);
    }

    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeUserId, loadChat]);

  // Scroll to bottom only when new messages arrive
  useEffect(() => {
    if (messages.length > prevMsgCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMsgCountRef.current = messages.length;
  }, [messages]);

  // Load older messages on scroll to top
  const handleScroll = useCallback(async () => {
    const container = messagesContainerRef.current;
    if (!container || !hasMore || loadingMore || !activeUserId) return;
    if (container.scrollTop < 60) {
      setLoadingMore(true);
      const prevHeight = container.scrollHeight;
      try {
        const nextPage = currentPage + 1;
        const res = await messageApi.getMessages(activeUserId, { page: nextPage, limit: 50 });
        const older = res.data.messages;
        setMessages((prev) => [...older, ...prev]);
        setCurrentPage(nextPage);
        setHasMore(res.data.pagination.page < res.data.pagination.pages);
        // Preserve scroll position
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight - prevHeight;
        });
      } catch { /* silent */ }
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, activeUserId, currentPage]);

  const selectConversation = (userId: string) => {
    setSearchParams({ tab: 'message', user: userId });
  };

  const handleSend = async () => {
    if (!input.trim() || !activeUserId || sending || !currentUser || !activePartner) return;
    const content = input.trim();
    setSending(true);
    sendingRef.current = true;
    setSendError('');

    // Optimistic update: insert temp message immediately
    const tempId = `temp-${Date.now()}`;
    const tempMsg: Message = {
      _id: tempId,
      sender: { _id: currentUser!._id, username: currentUser!.username || '', avatar: currentUser?.avatar || '' },
      receiver: { _id: activePartner!._id, username: activePartner!.username, avatar: activePartner!.avatar },
      msgType: 'text',
      content,
      read: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);
    setInput('');

    try {
      const res = await messageApi.sendMessage(activeUserId, content);
      // Replace temp message with real one
      setMessages((prev) => prev.map((m) => (m._id === tempId ? res.data.message : m)));
      loadConversations();
    } catch {
      // Remove temp message, restore input, show error
      setMessages((prev) => prev.filter((m) => m._id !== tempId));
      setInput(content);
      setSendError('发送失败，请重试');
      setTimeout(() => setSendError(''), 3000);
    }
    setSending(false);
    sendingRef.current = false;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeUserId || !currentUser || !activePartner) return;
    setUploading(true);
    try {
      const uploadRes = await uploadApi.uploadImage(file);
      const imageUrl = uploadRes.data.url;
      // Send as image message
      const tempId = `temp-${Date.now()}`;
      const tempMsg: Message = {
        _id: tempId,
        sender: { _id: currentUser._id, username: currentUser.username || '', avatar: currentUser?.avatar || '' },
        receiver: { _id: activePartner._id, username: activePartner.username, avatar: activePartner.avatar },
        msgType: 'image',
        content: imageUrl,
        read: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, tempMsg]);
      const res = await messageApi.sendMessage(activeUserId, imageUrl, 'image');
      setMessages((prev) => prev.map((m) => (m._id === tempId ? res.data.message : m)));
      loadConversations();
    } catch {
      setSendError('图片发送失败');
      setTimeout(() => setSendError(''), 3000);
    }
    setUploading(false);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const insertEmoji = (emoji: string) => {
    setInput((prev) => prev + emoji);
    setShowEmojiPicker(false);
  };

  const handleContextMenu = (e: React.MouseEvent, msg: Message) => {
    e.preventDefault();
    e.stopPropagation();
    if (msg.recalled) return;
    const isSender = msg.sender._id === currentUser?._id;
    const canRecall = isSender && isWithinRecallWindow(msg.createdAt);
    setCtxMenu({ x: e.clientX, y: e.clientY, msg, canRecall });
  };

  const handleCopy = async () => {
    if (!ctxMenu) return;
    try {
      await navigator.clipboard.writeText(ctxMenu.msg.content);
    } catch { /* fallback ignored */ }
    setCtxMenu(null);
  };

  const handleDelete = async () => {
    if (!ctxMenu) return;
    const msgId = ctxMenu.msg._id;
    setCtxMenu(null);
    try {
      await messageApi.deleteMessage(msgId);
      setMessages((prev) => prev.filter((m) => m._id !== msgId));
    } catch {
      setSendError('删除失败');
      setTimeout(() => setSendError(''), 3000);
    }
  };

  const handleRecall = async () => {
    if (!ctxMenu) return;
    const msgId = ctxMenu.msg._id;
    setCtxMenu(null);
    try {
      await messageApi.recallMessage(msgId);
      setMessages((prev) =>
        prev.map((m) => (m._id === msgId ? { ...m, recalled: true } : m))
      );
    } catch {
      setSendError('撤回失败，可能已超过5分钟');
      setTimeout(() => setSendError(''), 3000);
    }
  };

  // Close context menu on click / right-click / scroll outside
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    const container = messagesContainerRef.current;
    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    container?.addEventListener('scroll', close);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
      container?.removeEventListener('scroll', close);
    };
  }, [ctxMenu]);

  // Merge activePartner into conversation list if not already present
  const mergedConversations = (() => {
    if (!activePartner || conversations.some((c) => c.userId === activePartner._id)) {
      return conversations;
    }
    const virtual: Conversation = {
      userId: activePartner._id,
      username: activePartner.username,
      avatar: activePartner.avatar,
      lastMessage: '',
      lastTime: new Date().toISOString(),
      lastSender: '',
      unreadCount: 0,
    };
    return [virtual, ...conversations];
  })();

  const filteredConversations = search
    ? mergedConversations.filter((c) => c.username.toLowerCase().includes(search.toLowerCase()))
    : mergedConversations;

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isThisYear = d.getFullYear() === now.getFullYear();
    if (isThisYear) return d.toLocaleDateString([], { month: 'numeric', day: 'numeric' });
    return d.toLocaleDateString();
  };

  const formatDividerTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `今天 ${time}`;
    if (isYesterday) return `昨天 ${time}`;
    return `${d.toLocaleDateString([], { month: 'numeric', day: 'numeric' })} ${time}`;
  };

  // Determine whether to show a time divider before each message
  const shouldShowTimeDivider = (idx: number) => {
    if (idx === 0) return true;
    const prev = new Date(messages[idx - 1].createdAt).getTime();
    const curr = new Date(messages[idx].createdAt).getTime();
    return curr - prev > TIME_GAP_MS;
  };

  return (
    <div className="flex bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden" style={{ height: 'calc(100vh - 240px)', minHeight: '400px' }}>
      {/* Left: Contacts sidebar */}
      <div className="w-72 border-r border-gray-200 dark:border-gray-700 flex flex-col shrink-0">
        {/* Search */}
        <div className="p-3 border-b border-gray-100 dark:border-gray-700">
          <div className="relative">
            <input
              type="text"
              placeholder="搜索联系人"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-3 pr-8 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-indigo-300"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              暂无联系人
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <div
                key={conv.userId}
                onClick={() => selectConversation(conv.userId)}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                  activeUserId === conv.userId
                    ? 'bg-indigo-50 dark:bg-indigo-900/20'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-750'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-sm font-bold text-indigo-600 overflow-hidden shrink-0">
                  {conv.avatar ? (
                    <img src={getImageUrl(conv.avatar)} alt="" className="w-full h-full object-cover" />
                  ) : (
                    conv.username?.[0]?.toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {conv.username}
                    </span>
                    {conv.lastMessage && (
                      <span className="text-xs text-gray-400 shrink-0 ml-2">
                        {formatTime(conv.lastTime)}
                      </span>
                    )}
                  </div>
                  {conv.lastMessage && (
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-xs text-gray-400 truncate">
                      {conv.lastSender === currentUser?._id ? '我: ' : ''}
                      {conv.lastMessage.startsWith('/uploads/') ? '[图片]' : conv.lastMessage}
                    </p>
                    {conv.unreadCount > 0 && (
                      <span className="ml-2 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1 shrink-0">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right: Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {!activeUserId ? (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <div className="text-6xl mb-4 opacity-30">💬</div>
            <p className="text-sm">暂未找到或发起聊天，快去和朋友聊聊吧~</p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="px-5 py-3.5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                {activePartner?.username || '...'}
              </span>
            </div>

            {/* Messages area */}
            <div
              ref={messagesContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto px-5 py-4 relative"
            >
              {/* Load more indicator */}
              {loadingMore && (
                <div className="flex justify-center py-2 mb-2">
                  <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {hasMore && !loadingMore && (
                <div className="text-center text-xs text-gray-400 py-2 mb-2">上滑加载更多</div>
              )}

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">
                  开始你们的对话吧
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isMine = msg.sender._id === currentUser?._id;
                  const isTemp = msg._id.startsWith('temp-');
                  const showDivider = shouldShowTimeDivider(idx);
                  return (
                    <div key={msg._id}>
                      {/* Time divider */}
                      {showDivider && (
                        <div className="flex items-center justify-center my-4">
                          <span className="px-3 py-1 text-[11px] text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-750 rounded-full">
                            {formatDividerTime(msg.createdAt)}
                          </span>
                        </div>
                      )}

                      {msg.recalled ? (
                        <div className="flex justify-center mb-3">
                          <span className="text-xs text-gray-400 dark:text-gray-500 italic">
                            {isMine ? '你撤回了一条消息' : `${activePartner?.username || '对方'}撤回了一条消息`}
                          </span>
                        </div>
                      ) : (
                        <div
                          className={`flex gap-2.5 mb-3 ${isMine ? 'flex-row-reverse' : ''}`}
                        >
                          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-xs font-bold text-indigo-600 overflow-hidden shrink-0">
                            {(isMine ? currentUser?.avatar : activePartner?.avatar) ? (
                              <img
                                src={getImageUrl((isMine ? currentUser?.avatar : activePartner?.avatar) || '')}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              (isMine ? currentUser?.username : activePartner?.username)?.[0]?.toUpperCase()
                            )}
                          </div>
                          <div
                            className={`max-w-[65%] ${isMine ? 'items-end' : 'items-start'}`}
                            onContextMenu={(e) => handleContextMenu(e, msg)}
                          >
                            {msg.msgType === 'image' && msg.content ? (
                              <div className={`rounded-2xl overflow-hidden ${isTemp ? 'opacity-60' : ''}`}>
                                <img
                                  src={getImageUrl(msg.content)}
                                  alt="图片消息"
                                  className="max-w-full max-h-52 rounded-2xl object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() => window.open(getImageUrl(msg.content), '_blank')}
                                />
                              </div>
                            ) : (
                              <div
                                className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                                  isMine
                                    ? 'bg-indigo-600 text-white rounded-tr-sm'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-tl-sm'
                                } ${isTemp ? 'opacity-60' : ''}`}
                              >
                                {msg.content}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Send error toast */}
            {sendError && (
              <div className="px-5 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs text-center">
                {sendError}
              </div>
            )}

            {/* Input area */}
            <div className="border-t border-gray-200 dark:border-gray-700 p-3">
              {/* Toolbar: emoji + image */}
              <div className="flex items-center gap-1 mb-2 relative">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker((v) => !v)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors text-base"
                  title="表情"
                >
                  😊
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors text-base disabled:opacity-50"
                  title="发送图片"
                >
                  🖼️
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  onChange={handleImageUpload}
                />
                {uploading && <span className="text-xs text-gray-400 ml-1">上传中...</span>}

                {/* Emoji Picker Popup */}
                {showEmojiPicker && (
                  <EmojiPicker
                    onSelect={insertEmoji}
                    className="absolute bottom-full left-0 mb-1"
                  />
                )}
              </div>

              {/* Text input + send */}
              <div className="flex gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setShowEmojiPicker(false)}
                  placeholder="按 Enter 发送消息"
                  rows={1}
                  className="flex-1 resize-none px-4 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || sending}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  发送
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Right-click context menu (fixed position) */}
      {ctxMenu && (
        <div
          className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-[9999] min-w-[80px]"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {ctxMenu.msg.msgType !== 'image' && (
            <button
              onClick={handleCopy}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              复制
            </button>
          )}
          <button
            onClick={handleDelete}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            删除
          </button>
          {ctxMenu.canRecall && (
            <button
              onClick={handleRecall}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              撤回
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default MessagePanel;
