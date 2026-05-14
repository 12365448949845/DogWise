const mongoose = require('mongoose');

const articleSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    content: {
      type: String,
      required: true,
    },
    summary: {
      type: String,
      default: '',
      maxlength: 300,
    },
    cover: {
      type: String,
      default: '',
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    likes: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
    favorites: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
    viewCount: {
      type: Number,
      default: 0,
    },
    commentCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'published',
    },
  },
  { timestamps: true }
);

// Text search
articleSchema.index({ title: 'text', tags: 'text' });

// List page: status=published, sort by newest
articleSchema.index({ status: 1, createdAt: -1 });

// Tag filter: status + tag + sort
articleSchema.index({ status: 1, tags: 1, createdAt: -1 });

// Author page & feed: author + status + sort
articleSchema.index({ author: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Article', articleSchema);
