const mongoose = require('mongoose');

/**
 * Conversation Model - 存储 AI 对话历史
 * 用于 Agent 的短期和长期记忆管理
 */
const conversationSchema = new mongoose.Schema(
  {
    // 所属用户
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // 对话标题（自动生成或用户编辑）
    title: {
      type: String,
      default: '新对话',
      maxlength: 100,
    },
    // 消息历史
    messages: [
      {
        role: {
          type: String,
          enum: ['user', 'assistant', 'system'],
          required: true,
        },
        content: {
          type: String,
          required: true,
        },
        // 工具调用记录（可选）
        toolCalls: {
          type: mongoose.Schema.Types.Mixed,
          default: null,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // 最后活跃时间（用于排序和清理）
    lastActiveAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    // 对话状态
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
    },
  },
  { timestamps: true }
);

// 索引：用户 + 最后活跃时间（用于获取对话列表）
conversationSchema.index({ user: 1, lastActiveAt: -1 });

// 自动更新 lastActiveAt
conversationSchema.pre('save', async function () {
  if (this.isModified('messages')) {
    this.lastActiveAt = new Date();
  }
});

module.exports = mongoose.model('Conversation', conversationSchema);
