export interface Notification {
  _id: string;
  recipient: string;
  sender: {
    _id: string;
    username: string;
    avatar: string;
  };
  type: 'like' | 'comment' | 'reply' | 'favorite' | 'follow';
  article?: {
    _id: string;
    title: string;
  };
  comment?: string;
  read: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}
