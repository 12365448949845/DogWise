import { configureStore } from '@reduxjs/toolkit';
import themeReducer from './slices/themeSlice';
import authReducer from '@/features/auth/slices/authSlice';
import articleReducer from '@/features/article/slices/articleSlice';
import notificationReducer from '@/features/notification/slices/notificationSlice';

export const store = configureStore({
  reducer: {
    theme: themeReducer,
    auth: authReducer,
    article: articleReducer,
    notification: notificationReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
