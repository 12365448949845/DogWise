import api from '@/services/api';
import type { ApiResponse } from '@/services/api';

export const uploadApi = {
  uploadImage(file: File) {
    const formData = new FormData();
    formData.append('image', file);
    return api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }) as unknown as Promise<ApiResponse<{ url: string }>>;
  },
};
