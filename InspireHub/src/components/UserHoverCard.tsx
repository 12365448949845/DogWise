import { useState, useRef, useCallback, useEffect, useLayoutEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { userApi } from '@/features/user/services/userApi';
import { useAppSelector } from '@/store/hooks';
import { getImageUrl } from '@/utils/image';

interface UserData {
  _id: string;
  username: string;
  avatar: string;
  bio: string;
  followers: string[];
  following: string[];
  isFollowing: boolean;
}

interface UserHoverCardProps {
  userId: string;
  children: ReactNode;
}

const TRANSITION_MS = 180;

const UserHoverCard = ({ userId, children }: UserHoverCardProps) => {
  const { token, user: currentUser } = useAppSelector((state) => state.auth);
  const navigate = useNavigate();
  // mounted = portal in DOM; visible = opacity/transform for transition
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchedRef = useRef(false);

  const isSelf = currentUser?._id === userId;

  // Reposition after popover mounts / content changes
  useLayoutEffect(() => {
    if (!mounted || !triggerRef.current || !popoverRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const cardRect = popoverRef.current.getBoundingClientRect();
    const top = triggerRect.top - cardRect.height - 8;
    const left = triggerRect.left + triggerRect.width / 2 - cardRect.width / 2;
    setPos({ top, left });
  }, [mounted, loading, userData]);

  const show = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (unmountTimer.current) clearTimeout(unmountTimer.current);
    setMounted(true);
    // RAF ensures portal is in DOM before triggering transition
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));

    if (!fetchedRef.current && !loading) {
      setLoading(true);
      fetchedRef.current = true;
      userApi.getProfile(userId).then((res) => {
        setUserData({
          ...res.data.user,
          isFollowing: res.data.isFollowing,
        });
        setFollowing(res.data.isFollowing);
      }).catch(() => {
        fetchedRef.current = false;
      }).finally(() => setLoading(false));
    }
  }, [userId, loading]);

  const hide = useCallback(() => {
    closeTimer.current = setTimeout(() => {
      setVisible(false);
      // Wait for exit transition, then unmount
      unmountTimer.current = setTimeout(() => setMounted(false), TRANSITION_MS);
    }, 150);
  }, []);

  const handlePopoverEnter = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (unmountTimer.current) clearTimeout(unmountTimer.current);
    setVisible(true);
  }, []);

  const handlePopoverLeave = useCallback(() => {
    closeTimer.current = setTimeout(() => {
      setVisible(false);
      unmountTimer.current = setTimeout(() => setMounted(false), TRANSITION_MS);
    }, 150);
  }, []);

  const handleFollow = useCallback(async () => {
    if (!token || isSelf || followLoading) return;
    setFollowLoading(true);
    try {
      const res = await userApi.toggleFollow(userId);
      setFollowing(res.data.following);
      if (userData) {
        const newFollowers = res.data.following
          ? [...userData.followers, currentUser!._id]
          : userData.followers.filter((id) => id !== currentUser!._id);
        setUserData({ ...userData, followers: newFollowers });
      }
    } catch { /* silent */ }
    setFollowLoading(false);
  }, [token, isSelf, followLoading, userId, userData, currentUser]);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      if (unmountTimer.current) clearTimeout(unmountTimer.current);
    };
  }, []);

  return (
    <>
      <div
        ref={triggerRef}
        className="inline-block"
        onMouseEnter={show}
        onMouseLeave={hide}
      >
        {children}
      </div>

      {mounted && createPortal(
        <div
          ref={popoverRef}
          className="fixed z-[9999]"
          style={{
            top: pos.top,
            left: pos.left,
            opacity: visible ? 1 : 0,
            transform: visible ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(4px)',
            transition: `opacity ${TRANSITION_MS}ms ease, transform ${TRANSITION_MS}ms ease`,
            pointerEvents: visible ? 'auto' : 'none',
          }}
          onMouseEnter={handlePopoverEnter}
          onMouseLeave={handlePopoverLeave}
        >
          <div className="w-72 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : userData ? (
              <>
                {/* Top section with avatar */}
                <div className="px-5 pt-5 pb-4">
                  <div className="flex items-center gap-3.5">
                    <Link to={`/profile/${userData._id}`} className="shrink-0">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900 dark:to-purple-900 flex items-center justify-center text-xl font-bold text-indigo-600 overflow-hidden ring-2 ring-white dark:ring-gray-800 shadow-md">
                        {userData.avatar ? (
                          <img src={getImageUrl(userData.avatar)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          userData.username?.[0]?.toUpperCase()
                        )}
                      </div>
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link
                        to={`/profile/${userData._id}`}
                        className="text-base font-bold text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors truncate block"
                      >
                        {userData.username}
                      </Link>
                      {userData.bio && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                          {userData.bio}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Buttons */}
                {!isSelf && token && (
                  <div className="px-5 pb-4 flex gap-2.5">
                    <button
                      onClick={handleFollow}
                      disabled={followLoading}
                      className={`flex-1 py-2 rounded-full text-sm font-semibold transition-all ${
                        following
                          ? 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500 border border-gray-300 dark:border-gray-500'
                          : 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-md shadow-indigo-300 dark:shadow-none'
                      }`}
                    >
                      {following ? '已关注' : '+ 关注'}
                    </button>
                    <button
                      onClick={() => { setVisible(false); setMounted(false); navigate(`/notifications?tab=message&user=${userId}`); }}
                      className="flex-1 py-2 rounded-full text-sm font-semibold border border-indigo-400 dark:border-indigo-500 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all"
                    >
                      私信
                    </button>
                  </div>
                )}

                {/* Stats bar */}
                <div className="flex border-t border-gray-100 dark:border-gray-700">
                  <Link
                    to={`/profile/${userData._id}`}
                    className="flex-1 py-3 text-center hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                  >
                    <div className="text-base font-bold text-gray-900 dark:text-white">
                      {userData.following?.length || 0}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">关注</div>
                  </Link>
                  <div className="w-px bg-gray-100 dark:bg-gray-700" />
                  <Link
                    to="/feed"
                    className="flex-1 py-3 text-center hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                  >
                    <div className="text-base font-bold text-gray-900 dark:text-white">
                      {userData.followers?.length || 0}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">粉丝</div>
                  </Link>
                </div>
              </>
            ) : null}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default UserHoverCard;
