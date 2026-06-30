const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace('/api', '');

export const getImageUrl = (url?: string): string => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${API_BASE}${url}`;
};
