import api from './api';
import type { ApiResponse } from './api';

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface Conversation {
  _id: string;
  title: string;
  messages: ConversationMessage[];
  lastActiveAt: string;
  createdAt: string;
}

export interface ConversationListItem {
  _id: string;
  title: string;
  lastActiveAt: string;
  createdAt: string;
}

export const conversationApi = {
  /**
   * 获取对话列表
   */
  getList(params?: { page?: number; limit?: number }) {
    return api.get('/ai/conversations', { params }) as unknown as Promise<ApiResponse<{
      conversations: ConversationListItem[];
      total: number;
      page: number;
      totalPages: number;
    }>>;
  },

  /**
   * 获取单个对话详情（包含消息历史）
   */
  getById(id: string) {
    return api.get(`/ai/conversations/${id}`) as unknown as Promise<ApiResponse<{
      conversation: Conversation;
    }>>;
  },

  /**
   * 删除对话
   */
  delete(id: string) {
    return api.delete(`/ai/conversations/${id}`) as unknown as Promise<ApiResponse<{
      deleted: boolean;
    }>>;
  },

  /**
   * 更新对话标题
   */
  updateTitle(id: string, title: string) {
    return api.put(`/ai/conversations/${id}`, { title }) as unknown as Promise<ApiResponse<{
      conversation: ConversationListItem;
    }>>;
  },

  /**
   * 发送消息（流式）
   * @param message 当前消息内容
   * @param conversationId 可选的对话 ID（新对话则不传）
   */
  async sendMessage(message: string, conversationId?: string) {
    const token = localStorage.getItem('token');
    const response = await fetch(
      `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'}/ai/chat`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message, conversationId }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response;
  },
};
