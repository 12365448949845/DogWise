import { createBrowserRouter } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import AppLayout from '@/layout/AppLayout';
import ProtectedRoute from '@/components/ProtectedRoute';

// Home is eagerly loaded — it's the landing page, must be instant
import Home from '@/pages/Home';

// All other pages are lazy-loaded (code-split)
const Discover = lazy(() => import('@/pages/Discover'));
const Knowledge = lazy(() => import('@/pages/Knowledge'));
const KnowledgeDetail = lazy(() => import('@/pages/KnowledgeDetail'));
const AIChat = lazy(() => import('@/pages/AIChat'));
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const ArticleDetail = lazy(() => import('@/pages/ArticleDetail'));
const CreateArticle = lazy(() => import('@/pages/CreateArticle'));
const Profile = lazy(() => import('@/pages/Profile'));
const Search = lazy(() => import('@/pages/Search'));
const Settings = lazy(() => import('@/pages/Settings'));
const Notifications = lazy(() => import('@/pages/Notifications'));
const Feed = lazy(() => import('@/pages/Feed'));
const NotFound = lazy(() => import('@/pages/NotFound'));

// Prefetch map — call these on hover to preload chunks
export const prefetchMap = {
  discover: () => import('@/pages/Discover'),
  knowledge: () => import('@/pages/Knowledge'),
  ai: () => import('@/pages/AIChat'),
  feed: () => import('@/pages/Feed'),
  write: () => import('@/pages/CreateArticle'),
  login: () => import('@/pages/Login'),
  register: () => import('@/pages/Register'),
  search: () => import('@/pages/Search'),
  notifications: () => import('@/pages/Notifications'),
  settings: () => import('@/pages/Settings'),
};

const PageSkeleton = () => (
  <div className="max-w-3xl mx-auto px-4 py-8 animate-pulse">
    <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-6" />
    <div className="space-y-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
            <div className="space-y-2 flex-1">
              <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          </div>
          <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-32 w-1/2 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      ))}
    </div>
  </div>
);

const SuspenseWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<PageSkeleton />}>
    {children}
  </Suspense>
);

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      /* ──── Core pages ──── */
      {
        index: true,
        element: <Home />,
      },
      {
        path: 'discover',
        element: <SuspenseWrapper><Discover /></SuspenseWrapper>,
      },
      {
        path: 'knowledge',
        element: <SuspenseWrapper><Knowledge /></SuspenseWrapper>,
      },
      {
        path: 'knowledge/:id',
        element: <SuspenseWrapper><KnowledgeDetail /></SuspenseWrapper>,
      },
      {
        path: 'knowledge/:id/edit',
        element: <ProtectedRoute><SuspenseWrapper><CreateArticle /></SuspenseWrapper></ProtectedRoute>,
      },
      {
        path: 'ai',
        element: <SuspenseWrapper><AIChat /></SuspenseWrapper>,
      },

      /* ──── Auth ──── */
      {
        path: 'login',
        element: <SuspenseWrapper><Login /></SuspenseWrapper>,
      },
      {
        path: 'register',
        element: <SuspenseWrapper><Register /></SuspenseWrapper>,
      },

      /* ──── Article ──── */
      {
        path: 'article/:id',
        element: <SuspenseWrapper><ArticleDetail /></SuspenseWrapper>,
      },
      {
        path: 'article/:id/edit',
        element: <ProtectedRoute><SuspenseWrapper><CreateArticle /></SuspenseWrapper></ProtectedRoute>,
      },
      {
        path: 'write',
        element: <ProtectedRoute><SuspenseWrapper><CreateArticle /></SuspenseWrapper></ProtectedRoute>,
      },

      /* ──── User ──── */
      {
        path: 'search',
        element: <SuspenseWrapper><Search /></SuspenseWrapper>,
      },
      {
        path: 'profile/:id',
        element: <SuspenseWrapper><Profile /></SuspenseWrapper>,
      },
      {
        path: 'settings',
        element: <ProtectedRoute><SuspenseWrapper><Settings /></SuspenseWrapper></ProtectedRoute>,
      },
      {
        path: 'notifications',
        element: <ProtectedRoute><SuspenseWrapper><Notifications /></SuspenseWrapper></ProtectedRoute>,
      },
      {
        path: 'feed',
        element: <ProtectedRoute><SuspenseWrapper><Feed /></SuspenseWrapper></ProtectedRoute>,
      },

      /* ──── Fallback ──── */
      {
        path: '*',
        element: <SuspenseWrapper><NotFound /></SuspenseWrapper>,
      },
    ],
  },
]);

export default router;
