export interface Message {
  _id: string;
  sender: {
    _id: string;
    username: string;
    avatar: string;
  };
  receiver: {
    _id: string;
    username: string;
    avatar: string;
  };
  msgType: 'text' | 'image';
  content: string;
  read: boolean;
  recalled?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  userId: string;
  username: string;
  avatar: string;
  lastMessage: string;
  lastTime: string;
  lastSender: string;
  unreadCount: number;
}
