import api from '@/services/api';
import type { ApiResponse } from '@/services/api';
import type { AuthResponse, LoginPayload, RegisterPayload, User } from '@shared/types/user';

export const authApi = {
  register(data: RegisterPayload) {
    return api.post('/auth/register', data) as unknown as Promise<ApiResponse<AuthResponse>>;
  },

  login(data: LoginPayload) {
    return api.post('/auth/login', data) as unknown as Promise<ApiResponse<AuthResponse>>;
  },

  getMe() {
    return api.get('/auth/me') as unknown as Promise<ApiResponse<{ user: User }>>;
  },
};
