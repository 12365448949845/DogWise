import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { notificationApi } from '@/features/notification/services/notificationApi';
import type { Notification, Pagination } from '@shared/types/notification';

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  pagination: Pagination | null;
  loading: boolean;
}

const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0,
  pagination: null,
  loading: false,
};

export const fetchNotifications = createAsyncThunk(
  'notification/fetchList',
  async ({ page = 1, types }: { page?: number; types?: string } = {}, { rejectWithValue }) => {
    try {
      const res = await notificationApi.getList({ page, limit: 20, types });
      return { ...res.data, page };
    } catch (err: unknown) {
      const e = err as { message?: string };
      return rejectWithValue(e.message || 'Failed to fetch notifications');
    }
  }
);

export const fetchUnreadCount = createAsyncThunk(
  'notification/fetchUnreadCount',
  async (_, { rejectWithValue }) => {
    try {
      const res = await notificationApi.getUnreadCount();
      return res.data.unreadCount;
    } catch (err: unknown) {
      const e = err as { message?: string };
      return rejectWithValue(e.message || 'Failed');
    }
  }
);

export const markAsRead = createAsyncThunk(
  'notification/markAsRead',
  async (id: string, { rejectWithValue }) => {
    try {
      await notificationApi.markAsRead(id);
      return id;
    } catch (err: unknown) {
      const e = err as { message?: string };
      return rejectWithValue(e.message || 'Failed');
    }
  }
);

export const markAllAsRead = createAsyncThunk(
  'notification/markAllAsRead',
  async (_, { rejectWithValue }) => {
    try {
      await notificationApi.markAllAsRead();
    } catch (err: unknown) {
      const e = err as { message?: string };
      return rejectWithValue(e.message || 'Failed');
    }
  }
);

const notificationSlice = createSlice({
  name: 'notification',
  initialState,
  reducers: {
    resetNotifications(state) {
      state.notifications = [];
      state.pagination = null;
      state.unreadCount = 0;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false;
        const { notifications, unreadCount, pagination, page } = action.payload;
        if (page === 1) {
          state.notifications = notifications;
        } else {
          state.notifications = [...state.notifications, ...notifications];
        }
        state.unreadCount = unreadCount;
        state.pagination = pagination;
      })
      .addCase(fetchNotifications.rejected, (state) => {
        state.loading = false;
      });

    builder.addCase(fetchUnreadCount.fulfilled, (state, action) => {
      state.unreadCount = action.payload;
    });

    builder.addCase(markAsRead.fulfilled, (state, action) => {
      const n = state.notifications.find((n) => n._id === action.payload);
      if (n && !n.read) {
        n.read = true;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
    });

    builder.addCase(markAllAsRead.fulfilled, (state) => {
      state.notifications.forEach((n) => { n.read = true; });
      state.unreadCount = 0;
    });
  },
});

export const { resetNotifications } = notificationSlice.actions;
export default notificationSlice.reducer;
