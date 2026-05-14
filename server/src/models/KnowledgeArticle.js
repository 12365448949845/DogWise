const mongoose = require('mongoose');

const knowledgeArticleSchema = new mongoose.Schema(
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
    category: {
      type: String,
      required: true,
      enum: ['breeds', 'health', 'training', 'nutrition', 'daily'],
    },
    tags: {
      type: [String],
      default: [],
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    viewCount: {
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

knowledgeArticleSchema.index({ status: 1, category: 1, createdAt: -1 });
knowledgeArticleSchema.index({ title: 'text', tags: 'text' });

module.exports = mongoose.model('KnowledgeArticle', knowledgeArticleSchema);
