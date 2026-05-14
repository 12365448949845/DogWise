import api from '@/services/api';
import type { ApiResponse } from '@/services/api';
import type { Message, Conversation } from '@shared/types/message';

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export const messageApi = {
  getConversations() {
    return api.get('/messages/conversations') as unknown as Promise<
      ApiResponse<{ conversations: Conversation[] }>
    >;
  },

  getMessages(userId: string, params?: { page?: number; limit?: number }) {
    return api.get(`/messages/${userId}`, { params }) as unknown as Promise<
      ApiResponse<{ messages: Message[]; pagination: Pagination }>
    >;
  },

  sendMessage(userId: string, content: string, msgType: 'text' | 'image' = 'text') {
    return api.post(`/messages/${userId}`, { content, msgType }) as unknown as Promise<
      ApiResponse<{ message: Message }>
    >;
  },

  markAsRead(userId: string) {
    return api.put(`/messages/${userId}/read`) as unknown as Promise<ApiResponse<null>>;
  },

  getUnreadCount() {
    return api.get('/messages/unread-count') as unknown as Promise<
      ApiResponse<{ unreadCount: number }>
    >;
  },

  deleteMessage(messageId: string) {
    return api.delete(`/messages/msg/${messageId}`) as unknown as Promise<ApiResponse<null>>;
  },

  recallMessage(messageId: string) {
    return api.put(`/messages/msg/${messageId}/recall`) as unknown as Promise<ApiResponse<null>>;
  },
};
