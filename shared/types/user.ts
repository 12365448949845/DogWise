export interface User {
  _id: string;
  username: string;
  email: string;
  avatar: string;
  bio: string;
  role: 'user' | 'admin';
  followers: string[];
  following: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
}

export interface UpdateProfilePayload {
  username?: string;
  bio?: string;
  avatar?: string;
}
