import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { articleApi } from '@/features/article/services/articleApi';
import type { Article, Pagination, ArticleQueryParams } from '@shared/types/article';

interface ArticleState {
  articles: Article[];
  currentArticle: Article | null;
  pagination: Pagination | null;
  loading: boolean;
  error: string | null;
}

const initialState: ArticleState = {
  articles: [],
  currentArticle: null,
  pagination: null,
  loading: false,
  error: null,
};

export const fetchArticles = createAsyncThunk(
  'article/fetchArticles',
  async (params: ArticleQueryParams | undefined, { rejectWithValue }) => {
    try {
      const res = await articleApi.getList(params);
      return res.data;
    } catch (err: unknown) {
      const error = err as { message?: string };
      return rejectWithValue(error.message || 'Failed to fetch articles');
    }
  }
);

export const fetchMoreArticles = createAsyncThunk(
  'article/fetchMoreArticles',
  async (params: ArticleQueryParams, { rejectWithValue }) => {
    try {
      const res = await articleApi.getList(params);
      return res.data;
    } catch (err: unknown) {
      const error = err as { message?: string };
      return rejectWithValue(error.message || 'Failed to load more');
    }
  }
);

export const fetchArticleById = createAsyncThunk(
  'article/fetchById',
  async (id: string, { rejectWithValue }) => {
    try {
      const res = await articleApi.getById(id);
      return res.data.article;
    } catch (err: unknown) {
      const error = err as { message?: string };
      return rejectWithValue(error.message || 'Failed to fetch article');
    }
  }
);

const articleSlice = createSlice({
  name: 'article',
  initialState,
  reducers: {
    clearCurrentArticle(state) {
      state.currentArticle = null;
    },
    clearArticles(state) {
      state.articles = [];
      state.pagination = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch list (replace)
    builder
      .addCase(fetchArticles.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchArticles.fulfilled, (state, action) => {
        state.loading = false;
        state.articles = action.payload.articles;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchArticles.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Fetch more (append for infinite scroll)
    builder
      .addCase(fetchMoreArticles.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchMoreArticles.fulfilled, (state, action) => {
        state.loading = false;
        state.articles = [...state.articles, ...action.payload.articles];
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchMoreArticles.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Fetch single
    builder
      .addCase(fetchArticleById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchArticleById.fulfilled, (state, action) => {
        state.loading = false;
        state.currentArticle = action.payload;
      })
      .addCase(fetchArticleById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearCurrentArticle, clearArticles } = articleSlice.actions;
export default articleSlice.reducer;
