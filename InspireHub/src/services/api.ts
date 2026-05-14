import axios from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

// Unified response type from backend
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
  timestamp: number;
}

const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach JWT token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor: unwrap data, handle errors
api.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    return response.data as unknown as AxiosResponse<ApiResponse>;
  },
  (error) => {
    if (error.response) {
      const { status, data, config } = error.response;

      if (status === 401) {
        // Only auto-redirect for non-auth endpoints
        // Auth endpoints (login, register) handle 401 themselves
        const isAuthEndpoint = config?.url?.includes('/auth/');
        if (!isAuthEndpoint) {
          localStorage.removeItem('token');
          // Use soft navigation instead of hard redirect to preserve state
          const currentPath = window.location.pathname;
          if (currentPath !== '/login') {
            window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
          }
        }
      }

      return Promise.reject(data || { code: status, message: 'Request failed' });
    }

    return Promise.reject({ message: 'Network error' });
  }
);

export default api;
