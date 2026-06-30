const natural = require('natural');

/**
 * BM25Retriever - BM25 关键词检索器
 * 基于词频和逆文档频率的稀疏检索
 */
class BM25Retriever {
  constructor() {
    this.k1 = 1.5; // BM25 参数 k1
    this.b = 0.75; // BM25 参数 b
    this.documents = []; // 文档列表
    this.tokenizedDocs = []; // 分词后的文档
    this.idf = {}; // 逆文档频率
    this.avgDocLength = 0; // 平均文档长度
  }

  /**
   * 中文分词（简单实现）
   */
  tokenize(text) {
    if (!text) return [];

    // 简单分词：按字符、空格、标点分割
    const tokens = [];

    // 1. 按标点和空格分割
    const segments = text.split(/[\s，。！？、；：""''（）《》【】\[\],.!?;:()\[\]{}]+/);

    // 2. 对每个片段进行处理
    segments.forEach(segment => {
      if (!segment) return;

      // 提取英文单词
      const words = segment.match(/[a-zA-Z]+/g) || [];
      words.forEach(word => tokens.push(word.toLowerCase()));

      // 提取数字
      const numbers = segment.match(/\d+/g) || [];
      numbers.forEach(num => tokens.push(num));

      // 中文按字符分割（bigram）
      const chinese = segment.replace(/[a-zA-Z0-9]+/g, '');
      if (chinese.length > 0) {
        // 单字
        for (let i = 0; i < chinese.length; i++) {
          tokens.push(chinese[i]);
        }
        // 双字词
        for (let i = 0; i < chinese.length - 1; i++) {
          tokens.push(chinese.slice(i, i + 2));
        }
      }
    });

    return tokens.filter(t => t.length > 0);
  }

  /**
   * 索引文档
   * @param {Array} documents - 文档数组 [{ id, content, userId, metadata }]
   */
  indexDocuments(documents) {
    this.documents = documents;
    this.tokenizedDocs = documents.map(doc => this.tokenize(doc.content));

    // 计算平均文档长度
    const totalLength = this.tokenizedDocs.reduce((sum, tokens) => sum + tokens.length, 0);
    this.avgDocLength = totalLength / this.tokenizedDocs.length;

    // 计算 IDF
    this.calculateIDF();

    console.log(`[BM25Retriever] Indexed ${documents.length} documents`);
  }

  /**
   * 计算 IDF (Inverse Document Frequency)
   */
  calculateIDF() {
    const N = this.documents.length; // 总文档数
    const df = {}; // 文档频率

    // 统计每个词出现在多少个文档中
    this.tokenizedDocs.forEach(tokens => {
      const uniqueTokens = [...new Set(tokens)];
      uniqueTokens.forEach(token => {
        df[token] = (df[token] || 0) + 1;
      });
    });

    // 计算 IDF: log((N - df(t) + 0.5) / (df(t) + 0.5) + 1)
    this.idf = {};
    Object.keys(df).forEach(token => {
      this.idf[token] = Math.log((N - df[token] + 0.5) / (df[token] + 0.5) + 1);
    });
  }

  /**
   * 计算 BM25 分数
   * @param {Array} queryTokens - 查询分词
   * @param {Array} docTokens - 文档分词
   * @param {number} docLength - 文档长度
   */
  calculateBM25Score(queryTokens, docTokens, docLength) {
    const termFreq = {};
    docTokens.forEach(token => {
      termFreq[token] = (termFreq[token] || 0) + 1;
    });

    let score = 0;
    queryTokens.forEach(token => {
      const idf = this.idf[token] || 0;
      const tf = termFreq[token] || 0;

      // BM25 公式
      const numerator = tf * (this.k1 + 1);
      const denominator = tf + this.k1 * (1 - this.b + this.b * (docLength / this.avgDocLength));

      score += idf * (numerator / denominator);
    });

    return score;
  }

  /**
   * 检索文档
   * @param {string} query - 查询文本
   * @param {string} userId - 用户 ID（过滤）
   * @param {number} limit - 返回结果数量
   * @returns {Array} - 检索结果 [{ document, score }]
   */
  search(query, userId, limit = 10) {
    if (!query || this.documents.length === 0) {
      return [];
    }

    // 分词查询
    const queryTokens = this.tokenize(query);

    if (queryTokens.length === 0) {
      return [];
    }

    // 计算每个文档的 BM25 分数
    const scores = [];
    this.documents.forEach((doc, idx) => {
      // 按用户 ID 过滤
      if (doc.userId !== userId) {
        return;
      }

      const docTokens = this.tokenizedDocs[idx];
      const docLength = docTokens.length;
      const score = this.calculateBM25Score(queryTokens, docTokens, docLength);

      if (score > 0) {
        scores.push({
          document: doc,
          score: score
        });
      }
    });

    // 按分数降序排序
    scores.sort((a, b) => b.score - a.score);

    // 返回 top-k
    return scores.slice(0, limit);
  }

  /**
   * 获取索引文档数量
   */
  getDocumentCount() {
    return this.documents.length;
  }
}

module.exports = BM25Retriever;
