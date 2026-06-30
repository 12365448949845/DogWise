const { OpenAI } = require('openai');

/**
 * RerankService - 重排服务
 * 使用阿里云 Reranker 模型对检索结果进行精准重排
 */
class RerankService {
  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.ALIYUN_API_KEY,
      baseURL: process.env.ALIYUN_BASE_URL
    });
    this.useSimpleRerank = true; // 简单重排模式
  }

  /**
   * 重排文档
   * @param {string} query - 查询文本
   * @param {Array} candidates - 候选文档 [{ content, score, ... }]
   * @param {number} topK - 返回前 K 个结果
   * @returns {Promise<Array>} - 重排后的文档
   */
  async rerank(query, candidates, topK = 5) {
    if (!candidates || candidates.length === 0) {
      return [];
    }

    if (candidates.length <= topK) {
      return candidates;
    }

    try {
      if (this.useSimpleRerank) {
        return this.simpleRerank(query, candidates, topK);
      } else {
        return await this.llmRerank(query, candidates, topK);
      }
    } catch (error) {
      console.error('[RerankService] Error:', error);
      return candidates.slice(0, topK);
    }
  }

  /**
   * 简单重排：基于关键词匹配度
   */
  simpleRerank(query, candidates, topK) {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/);

    const scored = candidates.map(candidate => {
      const contentLower = (candidate.content || '').toLowerCase();

      let matchCount = 0;
      queryWords.forEach(word => {
        if (contentLower.includes(word)) {
          matchCount++;
        }
      });

      const coverage = matchCount / queryWords.length;
      const rerankScore = candidate.score * 0.7 + coverage * 0.3;

      return {
        ...candidate,
        rerankScore: rerankScore
      };
    });

    scored.sort((a, b) => b.rerankScore - a.rerankScore);

    console.log(`[RerankService] Simple reranked ${scored.length} candidates to top ${topK}`);

    return scored.slice(0, topK);
  }

  /**
   * LLM 重排：使用 LLM 判断相关性
   */
  async llmRerank(query, candidates, topK) {
    const prompt = `请评估以下文档与查询的相关性，为每个文档打分（0-10分）。

查询：${query}

文档：
${candidates.map((c, idx) => `${idx + 1}. ${c.content.slice(0, 200)}`).join('\n\n')}

请返回 JSON 格式的评分：
{ "scores": [分数1, 分数2, ...] }`;

    try {
      const response = await this.client.chat.completions.create({
        model: 'qwen-plus',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1
      });

      const content = response.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error('Failed to parse rerank scores');
      }

      const result = JSON.parse(jsonMatch[0]);
      const scores = result.scores || [];

      const reranked = candidates.map((candidate, idx) => ({
        ...candidate,
        rerankScore: scores[idx] || 0
      }));

      reranked.sort((a, b) => b.rerankScore - a.rerankScore);

      console.log(`[RerankService] LLM reranked ${reranked.length} candidates to top ${topK}`);

      return reranked.slice(0, topK);
    } catch (error) {
      console.error('[RerankService] LLM rerank failed, fallback to simple:', error);
      return this.simpleRerank(query, candidates, topK);
    }
  }

  setRerankMode(useSimple = true) {
    this.useSimpleRerank = useSimple;
    console.log(`[RerankService] Rerank mode: ${useSimple ? 'simple' : 'llm'}`);
  }
}

module.exports = RerankService;
