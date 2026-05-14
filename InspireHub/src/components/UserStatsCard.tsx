import { useEffect, useState, memo } from 'react';
import { Link } from 'react-router-dom';
import { useAppSelector } from '@/store/hooks';
import { userApi } from '@/features/user/services/userApi';
import { getImageUrl } from '@/utils/image';

interface UserStats {
  username: string;
  avatar: string;
  totalViews: number;
  totalLikes: number;
  followingCount: number;
  followersCount: number;
}

const StatItem = ({ label, value }: { label: string; value: number }) => (
  <div className="text-center">
    <div className="text-lg font-bold text-gray-900 dark:text-white">{value}</div>
    <div className="text-xs text-gray-400 dark:text-gray-500">{label}</div>
  </div>
);

const UserStatsCard = memo(() => {
  const { user, token } = useAppSelector((state) => state.auth);
  const [stats, setStats] = useState<UserStats | null>(null);

  useEffect(() => {
    if (!token) return;
    userApi.getMyStats().then((res) => setStats(res.data)).catch(() => {});
  }, [token]);

  // Not logged in — show login prompt
  if (!token || !user) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
        <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
          <span className="text-2xl text-gray-400">👤</span>
        </div>
        <div className="flex items-center justify-center gap-2 text-sm">
          <Link to="/login" className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">
            登录
          </Link>
          <span className="text-gray-400">/</span>
          <Link to="/register" className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">
            注册
          </Link>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">即刻畅享 InspireHub</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      {/* Avatar + Name */}
      <div className="flex flex-col items-center mb-4">
        <Link to={`/profile/${user._id}`}>
          <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-xl font-bold text-indigo-600 overflow-hidden mb-2">
            {(stats?.avatar || user.avatar) ? (
              <img src={getImageUrl(stats?.avatar || user.avatar || '')} alt="" className="w-full h-full object-cover" />
            ) : (
              user.username?.[0]?.toUpperCase()
            )}
          </div>
        </Link>
        <Link
          to={`/profile/${user._id}`}
          className="text-sm font-semibold text-gray-900 dark:text-white hover:text-indigo-600 transition-colors truncate max-w-full"
        >
          {stats?.username || user.username}
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-1">
        <StatItem label="浏览" value={stats?.totalViews || 0} />
        <StatItem label="点赞" value={stats?.totalLikes || 0} />
        <StatItem label="关注" value={stats?.followingCount || 0} />
        <StatItem label="粉丝" value={stats?.followersCount || 0} />
      </div>
    </div>
  );
});

UserStatsCard.displayName = 'UserStatsCard';
export default UserStatsCard;
