const { getQdrantClient } = require('../../config/qdrant');
const EmbeddingService = require('../services/EmbeddingService');
const BM25Retriever = require('./BM25Retriever');
const RerankService = require('../services/RerankService');

/**
 * HybridRetriever - 混合检索器
 * Dense Retrieval (向量) + BM25 (关键词) + Reranker (重排)
 */
class HybridRetriever {
  constructor() {
    this.qdrantClient = getQdrantClient();
    this.embeddingService = new EmbeddingService();
    this.bm25Retriever = new BM25Retriever();
    this.rerankService = new RerankService();
    this.collectionName = 'semantic_memory';

    // 混合检索权重
    this.denseWeight = 0.6; // 向量检索权重
    this.bm25Weight = 0.4;  // BM25 权重
  }

  /**
   * 初始化 BM25 索引
   * @param {string} userId - 用户 ID
   */
  async initializeBM25Index(userId) {
    try {
      // 从 Qdrant 获取该用户的所有文档
      const scrollResult = await this.qdrantClient.scroll(this.collectionName, {
        filter: {
          must: [{ key: 'userId', match: { value: userId } }]
        },
        limit: 1000, // 一次最多拉取 1000 条
        with_payload: true,
        with_vector: false
      });

      const documents = scrollResult.points.map(point => ({
        id: point.id,
        content: point.payload.content,
        userId: point.payload.userId,
        metadata: point.payload.metadata
      }));

      // 索引到 BM25
      if (documents.length > 0) {
        this.bm25Retriever.indexDocuments(documents);
        console.log(`[HybridRetriever] Initialized BM25 index with ${documents.length} documents`);
      }
    } catch (error) {
      console.error('[HybridRetriever] Error initializing BM25 index:', error);
    }
  }

  /**
   * 混合检索
   * @param {string} query - 查询文本
   * @param {string} userId - 用户 ID
   * @param {number} topK - 最终返回结果数量
   * @param {number} candidateSize - 候选集大小（用于重排）
   * @returns {Promise<Array>} - 检索结果
   */
  async search(query, userId, topK = 5, candidateSize = 20) {
    if (!query || !userId) {
      return [];
    }

    try {
      // 确保 BM25 索引已初始化
      if (this.bm25Retriever.getDocumentCount() === 0) {
        await this.initializeBM25Index(userId);
      }

      // 1. Dense Retrieval（向量检索）
      const denseResults = await this.denseSearch(query, userId, candidateSize);

      // 2. BM25 Retrieval（关键词检索）
      const bm25Results = this.bm25Retriever.search(query, userId, candidateSize);

      // 3. 融合结果（Reciprocal Rank Fusion）
      const fusedResults = this.fuseResults(denseResults, bm25Results, candidateSize);

      // 4. Rerank（重排）
      const rerankedResults = await this.rerankService.rerank(query, fusedResults, topK);

      console.log(`[HybridRetriever] Retrieved ${rerankedResults.length} results (Dense: ${denseResults.length}, BM25: ${bm25Results.length})`);

      return rerankedResults;
    } catch (error) {
      console.error('[HybridRetriever] Error during hybrid search:', error);
      return [];
    }
  }

  /**
   * Dense 向量检索
   */
  async denseSearch(query, userId, limit) {
    try {
      const queryEmbedding = await this.embeddingService.generateEmbedding(query);

      const results = await this.qdrantClient.search(this.collectionName, {
        vector: queryEmbedding,
        filter: {
          must: [{ key: 'userId', match: { value: userId } }]
        },
        limit: limit,
        with_payload: true
      });

      return results.map(hit => ({
        id: hit.id,
        content: hit.payload.content,
        summary: hit.payload.summary,
        metadata: hit.payload.metadata,
        conversationId: hit.payload.conversationId,
        score: hit.score,
        source: 'dense'
      }));
    } catch (error) {
      console.error('[HybridRetriever] Dense search error:', error);
      return [];
    }
  }

  /**
   * 融合 Dense 和 BM25 结果（Reciprocal Rank Fusion）
   */
  fuseResults(denseResults, bm25Results, topK) {
    const scoreMap = new Map();

    // Dense 结果
    denseResults.forEach((result, rank) => {
      const key = result.id || result.content;
      const rrfScore = 1 / (60 + rank + 1); // RRF 公式
      scoreMap.set(key, {
        document: result,
        score: rrfScore * this.denseWeight
      });
    });

    // BM25 结果
    bm25Results.forEach((result, rank) => {
      const key = result.document.id || result.document.content;
      const rrfScore = 1 / (60 + rank + 1);

      if (scoreMap.has(key)) {
        // 文档在两个结果中都出现，累加分数
        const existing = scoreMap.get(key);
        existing.score += rrfScore * this.bm25Weight;
      } else {
        // 只在 BM25 中出现
        scoreMap.set(key, {
          document: result.document,
          score: rrfScore * this.bm25Weight
        });
      }
    });

    // 转换为数组并排序
    const fused = Array.from(scoreMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return fused.map(item => item.document);
  }

  /**
   * 设置混合权重
   */
  setWeights(denseWeight = 0.6, bm25Weight = 0.4) {
    this.denseWeight = denseWeight;
    this.bm25Weight = bm25Weight;
    console.log(`[HybridRetriever] Updated weights - Dense: ${denseWeight}, BM25: ${bm25Weight}`);
  }

  /**
   * 清除 BM25 索引（用户数据更新时调用）
   */
  clearBM25Index() {
    this.bm25Retriever = new BM25Retriever();
    console.log('[HybridRetriever] Cleared BM25 index');
  }
}

module.exports = HybridRetriever;
