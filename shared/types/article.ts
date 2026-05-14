import type { User } from './user';

export interface Article {
  _id: string;
  title: string;
  content: string;
  summary: string;
  cover: string;
  author: Pick<User, '_id' | 'username' | 'avatar' | 'bio'>;
  tags: string[];
  likes: string[];
  favorites: string[];
  viewCount: number;
  commentCount: number;
  status: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
}

export interface ArticleListResponse {
  articles: Article[];
  pagination: Pagination;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface CreateArticlePayload {
  title: string;
  content: string;
  summary?: string;
  cover?: string;
  tags?: string[];
}

export interface UpdateArticlePayload extends Partial<CreateArticlePayload> {}

export interface ArticleQueryParams {
  page?: number;
  limit?: number;
  tag?: string;
  search?: string;
  author?: string;
  sort?: 'newest' | 'hot';
}

export interface TrendingArticle {
  _id: string;
  title: string;
  cover: string;
  author: Pick<User, '_id' | 'username' | 'avatar'>;
  likesCount: number;
  commentCount: number;
}
