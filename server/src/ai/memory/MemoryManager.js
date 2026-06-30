const Redis = require('ioredis');

/**
 * MemoryManager - Agent 短期记忆管理
 * 使用 Redis 存储最近 N 轮对话
 */
class MemoryManager {
  constructor(redisClient) {
    this.redis = redisClient;
    this.maxRounds = 10; // 最近 10 轮对话
    this.ttl = 60 * 60 * 24; // 24 小时过期
  }

  /**
   * 生成 Redis Key
   * @param {string} conversationId - 对话 ID
   */
  getKey(conversationId) {
    return `memory:conversation:${conversationId}`;
  }

  /**
   * 保存消息到 Redis
   * @param {string} conversationId - 对话 ID
   * @param {Array} messages - 消息数组 [{ role, content }]
   */
  async saveMessages(conversationId, messages) {
    if (!conversationId || !messages || messages.length === 0) {
      return;
    }

    const key = this.getKey(conversationId);

    try {
      // 只保留最近的对话轮次（用户消息 + AI 回复算一轮）
      const recentMessages = messages.slice(-this.maxRounds * 2);

      // 存储为 JSON 字符串
      await this.redis.setex(
        key,
        this.ttl,
        JSON.stringify(recentMessages)
      );

      console.log(`[MemoryManager] Saved ${recentMessages.length} messages to Redis for conversation: ${conversationId}`);
    } catch (error) {
      console.error('[MemoryManager] Error saving messages:', error);
    }
  }

  /**
   * 从 Redis 获取最近的对话历史
   * @param {string} conversationId - 对话 ID
   * @returns {Array} 消息数组 [{ role, content }]
   */
  async getRecentMessages(conversationId) {
    if (!conversationId) {
      return [];
    }

    const key = this.getKey(conversationId);

    try {
      const data = await this.redis.get(key);

      if (!data) {
        console.log(`[MemoryManager] No memory found for conversation: ${conversationId}`);
        return [];
      }

      const messages = JSON.parse(data);
      console.log(`[MemoryManager] Loaded ${messages.length} messages from Redis for conversation: ${conversationId}`);

      return messages;
    } catch (error) {
      console.error('[MemoryManager] Error loading messages:', error);
      return [];
    }
  }

  /**
   * 清除对话记忆
   * @param {string} conversationId - 对话 ID
   */
  async clearMemory(conversationId) {
    if (!conversationId) {
      return;
    }

    const key = this.getKey(conversationId);

    try {
      await this.redis.del(key);
      console.log(`[MemoryManager] Cleared memory for conversation: ${conversationId}`);
    } catch (error) {
      console.error('[MemoryManager] Error clearing memory:', error);
    }
  }

  /**
   * 获取记忆统计信息
   * @param {string} conversationId - 对话 ID
   */
  async getMemoryStats(conversationId) {
    if (!conversationId) {
      return null;
    }

    const key = this.getKey(conversationId);

    try {
      const ttl = await this.redis.ttl(key);
      const data = await this.redis.get(key);
      const messages = data ? JSON.parse(data) : [];

      return {
        conversationId,
        messageCount: messages.length,
        rounds: Math.floor(messages.length / 2),
        ttl: ttl > 0 ? ttl : 0,
        maxRounds: this.maxRounds,
      };
    } catch (error) {
      console.error('[MemoryManager] Error getting stats:', error);
      return null;
    }
  }
}

module.exports = MemoryManager;
