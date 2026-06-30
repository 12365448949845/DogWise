import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { toggleTheme } from '@/store/slices/themeSlice';
import { logout } from '@/features/auth/slices/authSlice';
import SearchBar from '@/components/SearchBar';
import NotificationBell from '@/components/NotificationBell';
import { resetNotifications } from '@/features/notification/slices/notificationSlice';
import { prefetchMap } from '@/router';

const mainNav = [
  { path: '/discover', label: '发现', icon: '🏠', prefetch: 'discover' as const },
  { path: '/knowledge', label: '知识', icon: '📚', prefetch: 'knowledge' as const },
  { path: '/ai', label: 'AI问答', icon: '🤖', prefetch: 'ai' as const },
];

const Header = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const mode = useAppSelector((state) => state.theme.mode);
  const { user, token } = useAppSelector((state) => state.auth);

  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const currentY = window.scrollY;
      // Hide when scrolling down past 80px, show when scrolling up
      if (currentY > 80 && currentY > lastScrollY.current) {
        setHidden(true);
      } else {
        setHidden(false);
      }
      lastScrollY.current = currentY;
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isActive = (path: string) =>
    path === '/' ? pathname === '/' : pathname.startsWith(path);

  const handleLogout = () => {
    dispatch(logout());
    dispatch(resetNotifications());
    navigate('/');
  };

  return (
    <header className={`sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 transition-transform duration-300 ${hidden ? '-translate-y-full' : 'translate-y-0'}`}>
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand + Main Nav */}
        <div className="flex items-center gap-6">
          <Link to="/" className="text-xl font-bold text-amber-600 flex items-center gap-1.5">
            🐶 <span>DogWorld</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {mainNav.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onMouseEnter={() => prefetchMap[item.prefetch]()}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1.5 ${
                  isActive(item.path)
                    ? 'bg-amber-500 text-white font-medium'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-amber-50 dark:hover:bg-gray-800'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <SearchBar />
          <button
            onClick={() => dispatch(toggleTheme())}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={`Current: ${mode}`}
          >
            {mode === 'dark' ? '☀️' : '🌙'}
          </button>

          {token && user ? (
            <>
              <Link
                to="/write"
                onMouseEnter={() => prefetchMap.write()}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1.5 font-medium ${
                  isActive('/write')
                    ? 'bg-amber-500 text-white'
                    : 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                }`}
              >
                ✍️ 发布
              </Link>
              <Link
                to="/feed"
                onMouseEnter={() => prefetchMap.feed()}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1.5 ${
                  isActive('/feed')
                    ? 'bg-amber-500 text-white font-medium'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-amber-50 dark:hover:bg-gray-800'
                }`}
              >
                👥 关注
              </Link>
              <NotificationBell />
              <Link
                to={`/profile/${user?._id}`}
                className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {user?.avatar ? (
                  <img
                    src={user.avatar.startsWith('http') ? user.avatar : `${import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || ''}${user.avatar}`}
                    alt=""
                    className="w-7 h-7 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center text-xs font-bold text-amber-600">
                    {user?.username?.[0]?.toUpperCase()}
                  </div>
                )}
                <span className="text-sm text-gray-700 dark:text-gray-300 hidden lg:inline">
                  {user?.username || 'User'}
                </span>
              </Link>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-red-500 transition-colors"
              >
                退出
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                onMouseEnter={() => prefetchMap.login()}
                className="text-sm text-gray-600 dark:text-gray-300 hover:text-amber-600 transition-colors"
              >
                登录
              </Link>
              <Link
                to="/register"
                onMouseEnter={() => prefetchMap.register()}
                className="px-4 py-2 bg-amber-500 text-white text-sm rounded-lg hover:bg-amber-600 transition-colors font-medium"
              >
                注册
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
