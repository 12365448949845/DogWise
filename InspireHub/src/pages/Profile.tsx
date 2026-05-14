import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAppSelector } from '@/store/hooks';
import { userApi } from '@/features/user/services/userApi';
import ArticleCard from '@/components/ArticleCard';
import type { User } from '@shared/types/user';
import type { Article, Pagination } from '@shared/types/article';
import { getImageUrl } from '@/utils/image';

const Profile = () => {
  const { id } = useParams<{ id: string }>();
  const { user: currentUser, token } = useAppSelector((state) => state.auth);

  const [profile, setProfile] = useState<User | null>(null);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [articleCount, setArticleCount] = useState(0);
  const [articles, setArticles] = useState<Article[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const isOwner = currentUser && id === currentUser._id;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [profileRes, articlesRes] = await Promise.all([
          userApi.getProfile(id),
          userApi.getUserArticles(id, { page: 1, limit: 10 }),
        ]);
        if (cancelled) return;
        setProfile(profileRes.data.user);
        setArticleCount(profileRes.data.articleCount);
        setFollowersCount(profileRes.data.user.followers?.length || 0);
        setFollowingCount(profileRes.data.user.following?.length || 0);
        setIsFollowing(profileRes.data.isFollowing || false);
        setArticles(articlesRes.data.articles);
        setPagination(articlesRes.data.pagination);
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [id, currentUser]);

  const handleLoadMore = async () => {
    if (!id || !pagination || pagination.page >= pagination.pages) return;
    setLoadingMore(true);
    try {
      const res = await userApi.getUserArticles(id, { page: pagination.page + 1, limit: 10 });
      setArticles((prev) => [...prev, ...res.data.articles]);
      setPagination(res.data.pagination);
    } catch {
      // silent
    } finally {
      setLoadingMore(false);
    }
  };

  const handleFollow = async () => {
    if (!id || !token) return;
    setFollowLoading(true);
    try {
      const res = await userApi.toggleFollow(id);
      setIsFollowing(res.data.following);
      setFollowersCount(res.data.followersCount);
    } catch {
      // silent
    } finally {
      setFollowLoading(false);
    }
  };

  const hasMore = pagination ? pagination.page < pagination.pages : false;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-400">Loading profile...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-red-500">User not found</p>
        <Link to="/" className="text-indigo-600 hover:underline">Back to Home</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Profile Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-8">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-2xl font-bold text-indigo-600 shrink-0">
            {profile.avatar ? (
              <img src={getImageUrl(profile.avatar)} alt={profile.username} className="w-full h-full rounded-full object-cover" />
            ) : (
              profile.username[0]?.toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {profile.username}
              </h1>
              {isOwner ? (
                <Link
                  to="/settings"
                  className="text-sm px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Edit Profile
                </Link>
              ) : token && (
                <button
                  onClick={handleFollow}
                  disabled={followLoading}
                  className={`text-sm px-4 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                    isFollowing
                      ? 'border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-red-300 hover:text-red-500'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {isFollowing ? 'Unfollow' : 'Follow'}
                </button>
              )}
            </div>
            {profile.bio && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{profile.bio}</p>
            )}
            <div className="flex items-center gap-4 mt-3 text-sm text-gray-500 dark:text-gray-400">
              <span><strong className="text-gray-800 dark:text-gray-200">{articleCount}</strong> articles</span>
              <span><strong className="text-gray-800 dark:text-gray-200">{followersCount}</strong> followers</span>
              <span><strong className="text-gray-800 dark:text-gray-200">{followingCount}</strong> following</span>
            </div>
          </div>
        </div>
      </div>

      {/* Articles */}
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Articles</h2>

      {articles.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          No articles published yet.
        </div>
      ) : (
        <div className="space-y-6">
          {articles.map((article) => (
            <ArticleCard key={article._id} article={article} />
          ))}
        </div>
      )}

      {hasMore && (
        <div className="text-center mt-6">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="px-6 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {loadingMore ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
};

export default Profile;
