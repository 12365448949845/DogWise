import { useEffect, useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppSelector } from '@/store/hooks';
import { notificationApi } from '@/features/notification/services/notificationApi';

const POLL_INTERVAL = 60_000; // 60s

interface CategoryCounts {
  comment: number;
  like: number;
  follow: number;
  message: number;
}

const categories: {
  key: keyof CategoryCounts;
  label: string;
  icon: string;
  gradient: string;
  iconBg: string;
  badgeColor: string;
}[] = [
  { key: 'comment', label: '评论', icon: '💬', gradient: 'from-blue-500/10 to-indigo-500/10 dark:from-blue-500/20 dark:to-indigo-500/20', iconBg: 'bg-blue-100 dark:bg-blue-900/40', badgeColor: 'bg-blue-500' },
  { key: 'like', label: '赞和收藏', icon: '❤️', gradient: 'from-pink-500/10 to-rose-500/10 dark:from-pink-500/20 dark:to-rose-500/20', iconBg: 'bg-pink-100 dark:bg-pink-900/40', badgeColor: 'bg-rose-500' },
  { key: 'follow', label: '新增粉丝', icon: '👥', gradient: 'from-violet-500/10 to-purple-500/10 dark:from-violet-500/20 dark:to-purple-500/20', iconBg: 'bg-violet-100 dark:bg-violet-900/40', badgeColor: 'bg-violet-500' },
  { key: 'message', label: '私信', icon: '✉️', gradient: 'from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20', iconBg: 'bg-amber-100 dark:bg-amber-900/40', badgeColor: 'bg-amber-500' },
];

const NotificationBell = () => {
  const { token } = useAppSelector((state) => state.auth);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [counts, setCounts] = useState<CategoryCounts>({ comment: 0, like: 0, follow: 0, message: 0 });

  const totalUnread = counts.comment + counts.like + counts.follow + counts.message;

  const poll = useCallback(() => {
    if (document.visibilityState === 'visible') {
      notificationApi.getUnreadCounts().then((res) => {
        setCounts(res.data);
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') poll();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [token, poll]);

  const handleEnter = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };

  const handleLeave = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  };

  if (!token) return null;

  return (
    <div
      className="relative"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <Link
        to="/notifications"
        className="relative p-2 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all duration-200 inline-flex group"
        title="Notifications"
      >
        <span className="text-lg group-hover:scale-110 transition-transform duration-200">🔔</span>
        {totalUnread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-gradient-to-r from-red-500 to-rose-500 text-white text-[10px] font-bold rounded-full px-1 shadow-sm animate-pulse">
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </Link>

      {/* Hover dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-2xl border border-gray-200/60 dark:border-gray-700/60 shadow-xl shadow-black/8 dark:shadow-black/30 p-1.5 z-50">
          <div className="px-3 pt-2 pb-1.5 mb-1">
            <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">通知中心</p>
          </div>
          {categories.map((cat) => {
            const count = counts[cat.key];
            return (
              <Link
                key={cat.key}
                to={`/notifications?tab=${cat.key}`}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 text-gray-700 dark:text-gray-200 hover:bg-gradient-to-r ${cat.gradient} group/item`}
              >
                <span className={`w-8 h-8 ${cat.iconBg} rounded-lg flex items-center justify-center text-sm group-hover/item:scale-110 transition-transform duration-200`}>
                  {cat.icon}
                </span>
                <span className="flex-1 font-medium">{cat.label}</span>
                {count > 0 && (
                  <span className={`min-w-[20px] h-[20px] flex items-center justify-center ${cat.badgeColor} text-white text-[10px] font-bold rounded-full px-1.5 shadow-sm`}>
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
