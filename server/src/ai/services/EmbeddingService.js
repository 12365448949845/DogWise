const { OpenAI } = require('openai');

/**
 * EmbeddingService - 阿里云通义千问 Embedding 服务
 * 使用 text-embedding-v3 模型生成 1024 维向量
 */
class EmbeddingService {
  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.ALIYUN_API_KEY,
      baseURL: process.env.ALIYUN_BASE_URL
    });
    this.model = process.env.ALIYUN_EMBEDDING_MODEL || 'text-embedding-v3';

    console.log(`[EmbeddingService] Initialized with model: ${this.model}`);
  }

  /**
   * 生成单个文本的 embedding 向量
   * @param {string} text - 输入文本
   * @returns {Promise<number[]>} - 1024 维向量
   */
  async generateEmbedding(text) {
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: text,
        dimensions: 1024
      });

      const embedding = response.data[0].embedding;
      console.log(`[EmbeddingService] Generated embedding for text (${text.length} chars)`);

      return embedding;
    } catch (error) {
      console.error('[EmbeddingService] Error generating embedding:', error);
      throw error;
    }
  }

  /**
   * 批量生成 embedding 向量（节省 API 调用）
   * 阿里云限制：每次最多 10 条
   * @param {string[]} texts - 文本数组
   * @returns {Promise<number[][]>} - 向量数组
   */
  async generateBatchEmbeddings(texts) {
    if (!texts || texts.length === 0) {
      return [];
    }

    // 过滤空文本
    const validTexts = texts.filter(t => t && t.trim().length > 0);

    if (validTexts.length === 0) {
      return [];
    }

    try {
      const allEmbeddings = [];
      const batchSize = 10; // 阿里云限制：每次最多 10 条

      // 分批处理
      for (let i = 0; i < validTexts.length; i += batchSize) {
        const batch = validTexts.slice(i, i + batchSize);

        const response = await this.client.embeddings.create({
          model: this.model,
          input: batch,
          dimensions: 1024
        });

        const batchEmbeddings = response.data.map(item => item.embedding);
        allEmbeddings.push(...batchEmbeddings);

        console.log(`[EmbeddingService] Generated ${allEmbeddings.length}/${validTexts.length} embeddings`);
      }

      return allEmbeddings;
    } catch (error) {
      console.error('[EmbeddingService] Error generating batch embeddings:', error);
      throw error;
    }
  }
}

module.exports = EmbeddingService;
