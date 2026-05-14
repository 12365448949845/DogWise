import { useEffect, useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import MessagePanel from '@/components/MessagePanel';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  fetchNotifications,
  markAsRead,
  markAllAsRead,
} from '@/features/notification/slices/notificationSlice';
import { notificationApi } from '@/features/notification/services/notificationApi';
import { getImageUrl } from '@/utils/image';

interface TabCounts {
  comment: number;
  like: number;
  follow: number;
  message: number;
}

const tabs: {
  key: keyof TabCounts;
  label: string;
  types: string;
  icon: string;
  activeGradient: string;
  activeShadow: string;
  iconBg: string;
  badgeColor: string;
  accentBorder: string;
  emptyIcon: string;
  emptyText: string;
}[] = [
  {
    key: 'comment', label: '评论', types: 'comment,reply', icon: '💬',
    activeGradient: 'bg-gradient-to-r from-blue-500 to-indigo-500',
    activeShadow: 'shadow-blue-500/25',
    iconBg: 'bg-blue-50 dark:bg-blue-900/30',
    badgeColor: 'bg-blue-500',
    accentBorder: 'border-l-blue-500',
    emptyIcon: '💬',
    emptyText: '暂无评论通知，去发表精彩内容吧~',
  },
  {
    key: 'like', label: '赞和收藏', types: 'like,favorite', icon: '❤️',
    activeGradient: 'bg-gradient-to-r from-pink-500 to-rose-500',
    activeShadow: 'shadow-pink-500/25',
    iconBg: 'bg-pink-50 dark:bg-pink-900/30',
    badgeColor: 'bg-rose-500',
    accentBorder: 'border-l-rose-500',
    emptyIcon: '❤️',
    emptyText: '暂无互动消息，继续创作精彩内容~',
  },
  {
    key: 'follow', label: '新增粉丝', types: 'follow', icon: '👥',
    activeGradient: 'bg-gradient-to-r from-violet-500 to-purple-500',
    activeShadow: 'shadow-violet-500/25',
    iconBg: 'bg-violet-50 dark:bg-violet-900/30',
    badgeColor: 'bg-violet-500',
    accentBorder: 'border-l-violet-500',
    emptyIcon: '👥',
    emptyText: '暂无新粉丝，好的内容会吸引关注的~',
  },
  {
    key: 'message', label: '私信', types: '', icon: '✉️',
    activeGradient: 'bg-gradient-to-r from-amber-500 to-orange-500',
    activeShadow: 'shadow-amber-500/25',
    iconBg: 'bg-amber-50 dark:bg-amber-900/30',
    badgeColor: 'bg-amber-500',
    accentBorder: 'border-l-amber-500',
    emptyIcon: '✉️',
    emptyText: '暂未找到或发起聊天，快去和朋友聊聊吧~',
  },
];

const typeLabel: Record<string, string> = {
  like: '赞了你的文章',
  comment: '评论了你的文章',
  reply: '回复了你的评论',
  favorite: '收藏了你的文章',
  follow: '关注了你',
};

const typeIcon: Record<string, string> = {
  like: '👍',
  comment: '💬',
  reply: '↩️',
  favorite: '⭐',
  follow: '➕',
};

const relativeTime = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}小时前`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}天前`;
  return new Date(dateStr).toLocaleDateString();
};

const Notifications = () => {
  const dispatch = useAppDispatch();
  const { notifications, pagination, loading, unreadCount } = useAppSelector(
    (state) => state.notification
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'comment';
  const [tabCounts, setTabCounts] = useState<TabCounts>({ comment: 0, like: 0, follow: 0, message: 0 });

  const currentTab = tabs.find((t) => t.key === activeTab) || tabs[0];
  const currentTypes = currentTab.types;

  // Fetch per-tab unread counts
  useEffect(() => {
    notificationApi.getUnreadCounts().then((res) => {
      setTabCounts(res.data);
    }).catch(() => {});
  }, [activeTab]);

  useEffect(() => {
    if (!currentTypes) return;
    dispatch(fetchNotifications({ page: 1, types: currentTypes }));
  }, [dispatch, currentTypes]);

  const handleTabChange = useCallback((key: string) => {
    setSearchParams({ tab: key });
  }, [setSearchParams]);

  const handleMarkRead = (id: string) => {
    dispatch(markAsRead(id));
  };

  const handleMarkAll = () => {
    dispatch(markAllAsRead());
  };

  const handleLoadMore = () => {
    if (pagination && pagination.page < pagination.pages) {
      dispatch(fetchNotifications({ page: pagination.page + 1, types: currentTypes }));
    }
  };

  const hasMore = pagination ? pagination.page < pagination.pages : false;

  return (
    <div className={`mx-auto px-4 py-6 ${activeTab === 'message' ? 'max-w-5xl' : 'max-w-3xl'}`}>

      {/* ── Pill-style Tab Bar ── */}
      <div className="flex items-center gap-2 mb-8">
        <div className="flex items-center gap-1.5 p-1 bg-gray-100/80 dark:bg-gray-800/80 rounded-2xl backdrop-blur-sm">
          {tabs.map((tab) => {
            const count = tabCounts[tab.key];
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                  isActive
                    ? `${tab.activeGradient} text-white shadow-lg ${tab.activeShadow}`
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white/60 dark:hover:bg-gray-700/60'
                }`}
              >
                <span className={`text-base transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}>
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
                {count > 0 && (
                  <span className={`min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold rounded-full px-1 ${
                    isActive
                      ? 'bg-white/25 text-white'
                      : `${tab.badgeColor} text-white`
                  }`}>
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Mark all read */}
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAll}
            className="ml-auto flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-all duration-200"
          >
            <span className="text-base">✓</span>
            全部已读
          </button>
        )}
      </div>

      {/* ── Message tab → full MessagePanel ── */}
      {!currentTypes ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/60 dark:border-gray-700/60 shadow-sm overflow-hidden">
          <MessagePanel />
        </div>
      ) : notifications.length === 0 && !loading ? (
        /* ── Empty State ── */
        <div className="flex flex-col items-center justify-center py-24">
          <div className={`w-20 h-20 ${currentTab.iconBg} rounded-2xl flex items-center justify-center text-4xl mb-6 shadow-sm`}>
            {currentTab.emptyIcon}
          </div>
          <p className="text-gray-400 dark:text-gray-500 text-sm">{currentTab.emptyText}</p>
        </div>
      ) : (
        /* ── Notification Cards ── */
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n._id}
              className={`group flex items-start gap-4 p-4 rounded-2xl border-l-[3px] transition-all duration-200 cursor-pointer ${
                n.read
                  ? 'bg-white dark:bg-gray-800/60 border-l-transparent hover:bg-gray-50 dark:hover:bg-gray-800 hover:shadow-sm'
                  : `bg-white dark:bg-gray-800 ${currentTab.accentBorder} shadow-sm hover:shadow-md`
              }`}
              onClick={() => !n.read && handleMarkRead(n._id)}
            >
              {/* Avatar */}
              <div className="relative shrink-0">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center text-sm font-bold text-gray-600 dark:text-gray-300 overflow-hidden ring-2 ring-white dark:ring-gray-800 shadow-sm">
                  {n.sender.avatar ? (
                    <img src={getImageUrl(n.sender.avatar)} alt="" className="w-full h-full object-cover" />
                  ) : (
                    n.sender.username[0]?.toUpperCase()
                  )}
                </div>
                {/* Type icon badge */}
                <span className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 ${currentTab.iconBg} rounded-full flex items-center justify-center text-[10px] ring-2 ring-white dark:ring-gray-800`}>
                  {typeIcon[n.type] || '🔔'}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                  <Link
                    to={`/profile/${n.sender._id}`}
                    className="font-semibold hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {n.sender.username}
                  </Link>
                  <span className="text-gray-500 dark:text-gray-400 mx-1">{typeLabel[n.type] || n.type}</span>
                  {n.article && (
                    <Link
                      to={`/article/${n.article._id}`}
                      className="font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      「{n.article.title}」
                    </Link>
                  )}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                  {relativeTime(n.createdAt)}
                </p>
              </div>

              {/* Unread dot */}
              {!n.read && (
                <span className={`w-2.5 h-2.5 rounded-full ${currentTab.badgeColor} shrink-0 mt-2 animate-pulse shadow-sm`} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-8 text-gray-400 text-sm">
          <span className="w-5 h-5 border-2 border-gray-300 dark:border-gray-600 border-t-indigo-500 rounded-full animate-spin" />
          加载中...
        </div>
      )}

      {/* Load more */}
      {hasMore && !loading && (
        <div className="text-center mt-6">
          <button
            onClick={handleLoadMore}
            className="px-8 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-750 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm transition-all duration-200"
          >
            加载更多
          </button>
        </div>
      )}
    </div>
  );
};

export default Notifications;
