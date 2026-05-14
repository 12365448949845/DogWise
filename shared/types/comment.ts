import type { User } from './user';

export interface Comment {
  _id: string;
  content: string;
  author: Pick<User, '_id' | 'username' | 'avatar'>;
  article: string;
  parentComment: string | null;
  images: string[];
  likes: string[];
  createdAt: string;
  updatedAt: string;
  replies?: Comment[];
}

export interface CreateCommentPayload {
  content: string;
  parentCommentId?: string;
  images?: string[];
}
