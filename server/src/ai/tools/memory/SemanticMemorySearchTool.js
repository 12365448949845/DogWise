const BaseTool = require('../base/BaseTool');
const VectorMemoryManager = require('../../memory/VectorMemoryManager');

/**
 * SemanticMemorySearchTool - 语义记忆搜索工具
 * 从用户的历史对话中检索相关的偏好、习惯和行为模式
 */
class SemanticMemorySearchTool extends BaseTool {
  constructor() {
    super();
    this.name = 'semantic_memory_search';
    this.description = `搜索用户的历史偏好、兴趣和行为模式。

调用时机：
- 用户问"我之前说过..."、"你还记得我..."
- 需要个性化推荐时
- 用户询问自己的习惯和偏好

示例：
- "我之前喜欢什么训练方法？"
- "根据我的情况推荐..."
- "你还记得我的狗喜欢什么吗？"`;

    this.parameters = {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '搜索查询，描述要查找的信息'
        },
        limit: {
          type: 'number',
          description: '返回结果数量，默认 3',
          default: 3
        },
        useHybrid: {
          type: 'boolean',
          description: '是否使用混合检索（Dense + BM25 + Reranker），默认 true',
          default: true
        }
      },
      required: ['query']
    };

    this.vectorMemory = new VectorMemoryManager();
  }

  /**
   * 执行语义记忆搜索（使用混合检索）
   * @param {Object} input - { query, limit, useHybrid }
   * @param {Object} context - { userId }
   * @returns {Promise<Object>} - 搜索结果
   */
  async execute(input, context) {
    const { query, limit = 3, useHybrid = true } = input;
    const userId = context.userId;

    if (!userId) {
      return {
        success: false,
        error: '用户未登录'
      };
    }

    if (!query || query.trim().length === 0) {
      return {
        success: false,
        error: '查询内容不能为空'
      };
    }

    try {
      console.log(`[SemanticMemorySearchTool] Searching memories for user ${userId}: "${query}" (hybrid: ${useHybrid})`);

      // 使用混合检索或基础向量检索
      const results = useHybrid
        ? await this.vectorMemory.hybridSearchMemories(query, userId, limit, limit * 4)
        : await this.vectorMemory.searchMemories(query, userId, limit);

      if (results.length === 0) {
        return {
          success: true,
          message: '未找到相关记忆',
          memories: []
        };
      }

      // 格式化结果
      const formattedMemories = results.map(r => ({
        content: r.summary || r.content,
        relevance: r.score || r.rerankScore,
        timestamp: r.metadata?.timestamp,
        topics: r.metadata?.topics || []
      }));

      console.log(`[SemanticMemorySearchTool] Found ${formattedMemories.length} relevant memories`);

      return {
        success: true,
        memories: formattedMemories,
        count: formattedMemories.length
      };
    } catch (error) {
      console.error('[SemanticMemorySearchTool] Error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = SemanticMemorySearchTool;
