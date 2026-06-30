const BaseTool = require('../base/BaseTool');
const KnowledgeVectorManager = require('../../knowledge/KnowledgeVectorManager');

/**
 * KnowledgeSearchTool - 搜索狗狗知识库（基于向量检索）
 * 从向量数据库中检索专业的狗狗知识
 */
class KnowledgeSearchTool extends BaseTool {
  constructor() {
    super();
    this.name = 'knowledge_search';
    this.description = `搜索 DogWorld 专业知识库，获取狗狗养护、健康、训练、饮食等专业权威知识。

**必须调用的场景：**
- 所有关于狗狗饮食、健康、训练、护理、行为的问题
- 用户问"狗能吃XX吗"、"金毛XX怎么办"等具体问题
- 需要专业、详细、准确的知识回答时

**调用示例：**
- "金毛可以吃鸡蛋吗？" → 调用（饮食问题，需要专业建议）
- "金毛食物过敏怎么办？" → 调用（健康问题）
- "狗狗疫苗接种时间表" → 调用（需要准确时间）
- "金毛训练方法" → 调用（训练指导）

**何时不调用：**
- 用户只是打招呼、闲聊（"你好"、"谢谢"）
- 已经调用过且上下文中有足够信息`;

    this.parameters = {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '搜索查询，描述要查找的知识'
        },
        limit: {
          type: 'number',
          description: '返回结果数量，默认 3',
          default: 3
        },
        category: {
          type: 'string',
          enum: ['饮食营养', '健康医疗', '行为训练', '日常护理', 'FAQ'],
          description: '可选的分类筛选'
        }
      },
      required: ['query']
    };

    this.knowledgeManager = new KnowledgeVectorManager();
  }

  /**
   * 执行知识库搜索
   * @param {Object} input - { query, limit, category }
   * @param {Object} context - 上下文
   * @returns {Promise<Object>} - 搜索结果
   */
  async execute(input, context) {
    const { query, limit = 3, category } = input;

    if (!query || query.trim().length === 0) {
      return {
        success: false,
        error: '查询内容不能为空'
      };
    }

    try {
      console.log(`[KnowledgeSearchTool] Searching knowledge: "${query}", category: ${category || 'all'}`);

      // 构建过滤条件
      const filter = category ? { category } : null;

      // 从向量数据库检索
      const results = await this.knowledgeManager.searchKnowledge(query, limit, filter);

      if (results.length === 0) {
        return {
          success: true,
          message: '未找到相关知识',
          knowledge: []
        };
      }

      // 格式化结果
      const formattedKnowledge = results.map(r => ({
        title: r.metadata.documentTitle,
        section: r.metadata.section,
        content: r.content,
        category: r.metadata.category,
        breeds: r.metadata.breeds || [],
        relevance: r.score,
        source: r.metadata.sourceFile
      }));

      console.log(`[KnowledgeSearchTool] Found ${formattedKnowledge.length} relevant knowledge items`);

      return {
        success: true,
        knowledge: formattedKnowledge,
        count: formattedKnowledge.length
      };
    } catch (error) {
      console.error('[KnowledgeSearchTool] Error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = KnowledgeSearchTool;
