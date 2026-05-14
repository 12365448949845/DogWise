import api from '@/services/api';
import type { ApiResponse } from '@/services/api';
import type { Notification, Pagination } from '@shared/types/notification';
import requestCache from '@/utils/requestCache';

export const notificationApi = {
  getList(params?: { page?: number; limit?: number; types?: string }) {
    return api.get('/notifications', { params }) as unknown as Promise<
      ApiResponse<{ notifications: Notification[]; unreadCount: number; pagination: Pagination }>
    >;
  },

  getUnreadCount() {
    return requestCache.dedupe('notification:unread', () =>
      api.get('/notifications/unread-count') as unknown as Promise<
        ApiResponse<{ unreadCount: number }>
      >,
      10 // cache 10s, avoid duplicate polls
    );
  },

  getUnreadCounts() {
    return api.get('/notifications/unread-counts') as unknown as Promise<
      ApiResponse<{ comment: number; like: number; follow: number; message: number }>
    >;
  },

  markAsRead(id: string) {
    return api.put(`/notifications/${id}/read`) as unknown as Promise<ApiResponse<null>>;
  },

  markAllAsRead() {
    return api.put('/notifications/read-all') as unknown as Promise<ApiResponse<null>>;
  },
};
