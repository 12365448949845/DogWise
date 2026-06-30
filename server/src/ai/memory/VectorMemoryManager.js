const { getQdrantClient } = require('../../config/qdrant');
const EmbeddingService = require('../services/EmbeddingService');
const HybridRetriever = require('../retrieval/HybridRetriever');

/**
 * VectorMemoryManager - 向量记忆管理器
 * 负责语义记忆的向量化存储和检索
 */
class VectorMemoryManager {
  constructor() {
    this.client = getQdrantClient();
    this.embeddingService = new EmbeddingService();
    this.collectionName = 'semantic_memory';
    this.hybridRetriever = null; // 延迟初始化
  }

  /**
   * 存储单个语义记忆
   * @param {Object} chunk - 语义块 { id, conversationId, userId, content, summary, metadata }
   */
  async saveMemory(chunk) {
    if (!chunk || !chunk.content) {
      console.warn('[VectorMemoryManager] Empty chunk, skipping');
      return;
    }

    try {
      // 使用 summary（如果有）或 content 生成 embedding
      const textToEmbed = chunk.summary || chunk.content;
      const embedding = await this.embeddingService.generateEmbedding(textToEmbed);

      // 存储到 Qdrant
      await this.client.upsert(this.collectionName, {
        points: [{
          id: chunk.id || `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          vector: embedding,
          payload: {
            conversationId: chunk.conversationId,
            userId: chunk.userId,
            content: chunk.content,
            summary: chunk.summary,
            metadata: chunk.metadata || {}
          }
        }]
      });

      console.log(`[VectorMemoryManager] Saved memory: ${chunk.id}`);
    } catch (error) {
      console.error('[VectorMemoryManager] Error saving memory:', error);
      throw error;
    }
  }

  /**
   * 批量存储语义记忆
   * @param {Array} chunks - chunk 数组
   */
  async saveBatchMemories(chunks) {
    if (!chunks || chunks.length === 0) {
      console.log('[VectorMemoryManager] No chunks to save');
      return;
    }

    try {
      // 批量生成 embeddings
      const texts = chunks.map(c => c.summary || c.content);
      const embeddings = await this.embeddingService.generateBatchEmbeddings(texts);

      // 构建 points
      const points = chunks.map((chunk, idx) => ({
        id: chunk.id || `${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 9)}`,
        vector: embeddings[idx],
        payload: {
          conversationId: chunk.conversationId,
          userId: chunk.userId,
          content: chunk.content,
          summary: chunk.summary,
          metadata: chunk.metadata || {}
        }
      }));

      // 批量存储到 Qdrant
      await this.client.upsert(this.collectionName, { points });

      console.log(`[VectorMemoryManager] Saved ${chunks.length} memories in batch`);
    } catch (error) {
      console.error('[VectorMemoryManager] Error saving batch memories:', error);
      throw error;
    }
  }

  /**
   * 语义检索记忆（基础向量检索，保留向后兼容）
   * @param {string} query - 查询文本
   * @param {string} userId - 用户 ID
   * @param {number} limit - 返回结果数量，默认 5
   * @returns {Promise<Array>} - 检索结果
   */
  async searchMemories(query, userId, limit = 5) {
    if (!query || !userId) {
      console.warn('[VectorMemoryManager] Query or userId missing');
      return [];
    }

    try {
      // 生成查询向量
      const queryEmbedding = await this.embeddingService.generateEmbedding(query);

      // 在 Qdrant 中搜索
      const results = await this.client.search(this.collectionName, {
        vector: queryEmbedding,
        filter: {
          must: [
            { key: 'userId', match: { value: userId } }
          ]
        },
        limit: limit,
        with_payload: true
      });

      // 格式化结果
      const formattedResults = results.map(hit => ({
        score: hit.score,
        content: hit.payload.content,
        summary: hit.payload.summary,
        metadata: hit.payload.metadata,
        conversationId: hit.payload.conversationId
      }));

      console.log(`[VectorMemoryManager] Found ${formattedResults.length} memories for query: "${query}"`);

      return formattedResults;
    } catch (error) {
      console.error('[VectorMemoryManager] Error searching memories:', error);
      return [];
    }
  }

  /**
   * 混合检索记忆（Dense + BM25 + Reranker）
   * @param {string} query - 查询文本
   * @param {string} userId - 用户 ID
   * @param {number} topK - 最终返回结果数量，默认 5
   * @param {number} candidateSize - 候选集大小，默认 20
   * @returns {Promise<Array>} - 检索结果
   */
  async hybridSearchMemories(query, userId, topK = 5, candidateSize = 20) {
    if (!query || !userId) {
      console.warn('[VectorMemoryManager] Query or userId missing');
      return [];
    }

    try {
      // 延迟初始化 HybridRetriever
      if (!this.hybridRetriever) {
        this.hybridRetriever = new HybridRetriever();
      }

      // 执行混合检索
      const results = await this.hybridRetriever.search(query, userId, topK, candidateSize);

      console.log(`[VectorMemoryManager] Hybrid search found ${results.length} memories for query: "${query}"`);

      return results;
    } catch (error) {
      console.error('[VectorMemoryManager] Error in hybrid search, fallback to dense search:', error);
      // 降级到基础向量检索
      return await this.searchMemories(query, userId, topK);
    }
  }

  /**
   * 按对话 ID 删除记忆
   * @param {string} conversationId - 对话 ID
   */
  async deleteByConversation(conversationId) {
    if (!conversationId) {
      return;
    }

    try {
      await this.client.delete(this.collectionName, {
        filter: {
          must: [
            { key: 'conversationId', match: { value: conversationId } }
          ]
        }
      });

      console.log(`[VectorMemoryManager] Deleted memories for conversation: ${conversationId}`);
    } catch (error) {
      console.error('[VectorMemoryManager] Error deleting memories:', error);
      throw error;
    }
  }

  /**
   * 按用户 ID 删除所有记忆
   * @param {string} userId - 用户 ID
   */
  async deleteByUser(userId) {
    if (!userId) {
      return;
    }

    try {
      await this.client.delete(this.collectionName, {
        filter: {
          must: [
            { key: 'userId', match: { value: userId } }
          ]
        }
      });

      console.log(`[VectorMemoryManager] Deleted all memories for user: ${userId}`);
    } catch (error) {
      console.error('[VectorMemoryManager] Error deleting user memories:', error);
      throw error;
    }
  }

  /**
   * 获取用户的记忆统计
   * @param {string} userId - 用户 ID
   * @returns {Promise<Object>} - 统计信息
   */
  async getMemoryStats(userId) {
    if (!userId) {
      return { count: 0 };
    }

    try {
      const result = await this.client.scroll(this.collectionName, {
        filter: {
          must: [
            { key: 'userId', match: { value: userId } }
          ]
        },
        limit: 1,
        with_payload: false,
        with_vector: false
      });

      return {
        userId: userId,
        sampleCount: result.points.length,
        message: 'Use count API for accurate stats'
      };
    } catch (error) {
      console.error('[VectorMemoryManager] Error getting stats:', error);
      return { count: 0, error: error.message };
    }
  }
}

module.exports = VectorMemoryManager;
