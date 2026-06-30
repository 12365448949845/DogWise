const { getQdrantClient } = require('../../config/qdrant');
const EmbeddingService = require('../services/EmbeddingService');
const HybridRetriever = require('../retrieval/HybridRetriever');

/**
 * KnowledgeVectorManager - 知识库向量管理器
 * 负责知识库的向量化存储和检索
 */
class KnowledgeVectorManager {
  constructor() {
    this.client = getQdrantClient();
    this.embeddingService = new EmbeddingService();
    this.collectionName = 'knowledge_base';
    this.hybridRetriever = null; // 延迟初始化
  }

  /**
   * 存储单个知识块
   * @param {Object} chunk - 知识块 { content, summary, metadata }
   */
  async saveKnowledge(chunk) {
    if (!chunk || !chunk.content) {
      console.warn('[KnowledgeVectorManager] Empty chunk, skipping');
      return;
    }

    try {
      // 使用 summary（如果有）或 content 生成 embedding
      const textToEmbed = chunk.summary || chunk.content;
      const embedding = await this.embeddingService.generateEmbedding(textToEmbed);

      // 存储到 Qdrant
      await this.client.upsert(this.collectionName, {
        points: [{
          id: chunk.metadata.documentId + '_' + chunk.metadata.chunkIndex + '_' + Date.now(),
          vector: embedding,
          payload: {
            content: chunk.content,
            summary: chunk.summary,
            metadata: chunk.metadata
          }
        }]
      });

      console.log(`[KnowledgeVectorManager] Saved knowledge: ${chunk.metadata.documentTitle} - ${chunk.metadata.section}`);
    } catch (error) {
      console.error('[KnowledgeVectorManager] Error saving knowledge:', error);
      throw error;
    }
  }

  /**
   * 批量存储知识块
   * @param {Array} chunks - chunk 数组
   */
  async saveBatchKnowledge(chunks) {
    if (!chunks || chunks.length === 0) {
      console.log('[KnowledgeVectorManager] No chunks to save');
      return;
    }

    try {
      // 批量生成 embeddings
      const texts = chunks.map(c => c.summary || c.content);
      const embeddings = await this.embeddingService.generateBatchEmbeddings(texts);

      // 构建 points
      const points = chunks.map((chunk, idx) => ({
        id: Date.now() + idx,
        vector: embeddings[idx],
        payload: {
          content: chunk.content,
          summary: chunk.summary,
          metadata: chunk.metadata
        }
      }));

      // 批量存储到 Qdrant
      await this.client.upsert(this.collectionName, { points });

      console.log(`[KnowledgeVectorManager] Saved ${chunks.length} knowledge chunks in batch`);
    } catch (error) {
      console.error('[KnowledgeVectorManager] Error saving batch knowledge:', error);
      throw error;
    }
  }

  /**
   * 基础向量检索
   * @param {string} query - 查询文本
   * @param {number} limit - 返回结果数量，默认 5
   * @param {Object} filter - 可选过滤条件 { category, breeds }
   * @returns {Promise<Array>} - 检索结果
   */
  async searchKnowledge(query, limit = 5, filter = null) {
    if (!query) {
      console.warn('[KnowledgeVectorManager] Query missing');
      return [];
    }

    try {
      // 生成查询向量
      const queryEmbedding = await this.embeddingService.generateEmbedding(query);

      // 构建过滤条件
      const qdrantFilter = this.buildFilter(filter);

      // 在 Qdrant 中搜索
      const results = await this.client.search(this.collectionName, {
        vector: queryEmbedding,
        filter: qdrantFilter,
        limit: limit,
        with_payload: true
      });

      // 格式化结果
      const formattedResults = results.map(hit => ({
        score: hit.score,
        content: hit.payload.content,
        summary: hit.payload.summary,
        metadata: hit.payload.metadata
      }));

      console.log(`[KnowledgeVectorManager] Found ${formattedResults.length} knowledge items for query: "${query}"`);

      return formattedResults;
    } catch (error) {
      console.error('[KnowledgeVectorManager] Error searching knowledge:', error);
      return [];
    }
  }

  /**
   * 混合检索（Dense + BM25 + Reranker）
   * @param {string} query - 查询文本
   * @param {number} topK - 最终返回结果数量，默认 5
   * @param {number} candidateSize - 候选集大小，默认 20
   * @param {Object} filter - 可选过滤条件
   * @returns {Promise<Array>} - 检索结果
   */
  async hybridSearchKnowledge(query, topK = 5, candidateSize = 20, filter = null) {
    if (!query) {
      console.warn('[KnowledgeVectorManager] Query missing');
      return [];
    }

    try {
      // 延迟初始化 HybridRetriever
      if (!this.hybridRetriever) {
        this.hybridRetriever = new HybridRetriever();
        // 覆盖 collection 名称
        this.hybridRetriever.collectionName = this.collectionName;
      }

      // TODO: HybridRetriever 需要支持全局检索（不限 userId）
      // 临时方案：使用基础向量检索
      const results = await this.searchKnowledge(query, topK, filter);

      console.log(`[KnowledgeVectorManager] Hybrid search found ${results.length} knowledge items for query: "${query}"`);

      return results;
    } catch (error) {
      console.error('[KnowledgeVectorManager] Error in hybrid search, fallback to basic search:', error);
      return await this.searchKnowledge(query, topK, filter);
    }
  }

  /**
   * 构建 Qdrant 过滤条件
   */
  buildFilter(filter) {
    if (!filter) {
      return undefined;
    }

    const must = [];

    if (filter.category) {
      must.push({ key: 'metadata.category', match: { value: filter.category } });
    }

    if (filter.breeds && filter.breeds.length > 0) {
      // breeds 是数组，匹配任意一个
      must.push({
        key: 'metadata.breeds',
        match: { any: filter.breeds }
      });
    }

    return must.length > 0 ? { must } : undefined;
  }

  /**
   * 按文档 ID 删除知识
   * @param {string} documentId - 文档 ID
   */
  async deleteByDocument(documentId) {
    if (!documentId) {
      return;
    }

    try {
      await this.client.delete(this.collectionName, {
        filter: {
          must: [
            { key: 'metadata.documentId', match: { value: documentId } }
          ]
        }
      });

      console.log(`[KnowledgeVectorManager] Deleted knowledge for document: ${documentId}`);
    } catch (error) {
      console.error('[KnowledgeVectorManager] Error deleting knowledge:', error);
      throw error;
    }
  }

  /**
   * 清空整个知识库
   */
  async clearAllKnowledge() {
    try {
      // 删除并重建 collection
      await this.client.deleteCollection(this.collectionName);

      await this.client.createCollection(this.collectionName, {
        vectors: {
          size: 1024,
          distance: 'Cosine'
        },
        optimizers_config: {
          indexing_threshold: 20000
        }
      });

      console.log('[KnowledgeVectorManager] Cleared all knowledge');
    } catch (error) {
      console.error('[KnowledgeVectorManager] Error clearing knowledge:', error);
      throw error;
    }
  }

  /**
   * 获取知识库统计
   * @returns {Promise<Object>} - 统计信息
   */
  async getStats() {
    try {
      const collectionInfo = await this.client.getCollection(this.collectionName);

      return {
        totalPoints: collectionInfo.points_count,
        vectorsCount: collectionInfo.vectors_count,
        indexedVectorsCount: collectionInfo.indexed_vectors_count,
        status: collectionInfo.status
      };
    } catch (error) {
      console.error('[KnowledgeVectorManager] Error getting stats:', error);
      return { error: error.message };
    }
  }
}

module.exports = KnowledgeVectorManager;
