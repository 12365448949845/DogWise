import api from '@/services/api';
import type { ApiResponse } from '@/services/api';

export interface KnowledgeArticle {
  _id: string;
  title: string;
  content: string;
  summary: string;
  cover: string;
  category: string;
  tags: string[];
  author: {
    _id: string;
    username: string;
    avatar: string;
    role: string;
  };
  viewCount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeListResponse {
  articles: KnowledgeArticle[];
  total: number;
  page: number;
  totalPages: number;
  categories: Record<string, { icon: string; label: string }>;
}

export const knowledgeApi = {
  getList(params?: { category?: string; page?: number; limit?: number; search?: string }) {
    return api.get('/knowledge', { params }) as unknown as Promise<ApiResponse<KnowledgeListResponse>>;
  },

  getById(id: string) {
    return api.get(`/knowledge/${id}`) as unknown as Promise<ApiResponse<{ article: KnowledgeArticle }>>;
  },

  create(data: { title: string; content: string; summary?: string; cover?: string; category: string; tags?: string[] }) {
    return api.post('/knowledge', data) as unknown as Promise<ApiResponse<{ article: KnowledgeArticle }>>;
  },

  update(id: string, data: Partial<KnowledgeArticle>) {
    return api.put(`/knowledge/${id}`, data) as unknown as Promise<ApiResponse<{ article: KnowledgeArticle }>>;
  },

  delete(id: string) {
    return api.delete(`/knowledge/${id}`) as unknown as Promise<ApiResponse<{ deleted: boolean }>>;
  },

  getCategoryCounts() {
    return api.get('/knowledge/counts') as unknown as Promise<ApiResponse<{ counts: Record<string, number> }>>;
  },
};
