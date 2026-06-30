/**
 * QueryRouter - 查询路由器
 * 决定是否需要调用知识库（不依赖 LLM 判断）
 */
class QueryRouter {
  constructor() {
    // 触发 RAG 的关键词
    this.ragKeywords = [
      // 宠物相关
      '狗', '犬', '金毛', '拉布拉多', '哈士奇', '柯基', '泰迪', '比熊', '萨摩耶', '阿拉斯加',
      '猫', '猫咪', '宠物',

      // 饮食相关
      '吃', '喂', '食物', '饮食', '营养', '过敏', '中毒',
      '鸡蛋', '巧克力', '骨头', '牛奶', '水果', '蔬菜', '肉',

      // 健康医疗
      '呕吐', '拉肚子', '腹泻', '便秘', '发烧', '咳嗽', '流鼻涕',
      '抽搐', '癫痫', '受伤', '骨折', '流血', '疫苗', '驱虫',
      '生病', '疾病', '症状', '治疗', '药', '医院', '兽医',

      // 行为训练
      '训练', '教', '学', '听话', '指令', '服从', '叫', '咬',
      '定点', '大小便', '尿', '便便', '社交', '攻击', '乱叫',

      // 日常护理
      '洗澡', '美容', '剪毛', '梳毛', '护理', '清洁', '牙齿',
      '耳朵', '眼睛', '指甲',

      // 常见问题词
      '怎么办', '怎么', '如何', '能不能', '可以吗', '应该', '需要',
      '多久', '时间', '方法', '注意'
    ];
  }

  /**
   * 判断是否需要调用 RAG
   * @param {string} query - 用户问题
   * @returns {boolean} - true: 调用 RAG, false: 直接 LLM
   */
  shouldUseRAG(query) {
    if (!query || query.trim().length === 0) {
      return false;
    }

    const lowerQuery = query.toLowerCase();

    // 规则 1：简单问候 → 不调用 RAG
    const greetings = ['你好', '您好', 'hello', 'hi', '谢谢', '再见', 'bye'];
    if (greetings.some(g => lowerQuery === g || lowerQuery === g + '！' || lowerQuery === g + '!')) {
      return false;
    }

    // 规则 2：包含关键词 → 调用 RAG
    const hasKeyword = this.ragKeywords.some(keyword => query.includes(keyword));
    if (hasKeyword) {
      console.log(`[QueryRouter] Matched keyword in query: "${query}" → Use RAG`);
      return true;
    }

    // 规则 3：问题形式（带问号） → 调用 RAG
    if (query.includes('?') || query.includes('？')) {
      console.log(`[QueryRouter] Question detected: "${query}" → Use RAG`);
      return true;
    }

    // 默认：不调用 RAG
    console.log(`[QueryRouter] No match: "${query}" → Direct LLM`);
    return false;
  }

  /**
   * 提取查询关键词（用于知识库检索）
   * @param {string} query - 用户问题
   * @returns {string} - 提取的关键词
   */
  extractSearchQuery(query) {
    // 简单处理：移除常见的问句词，保留核心内容
    let cleanQuery = query
      .replace(/怎么办/g, '')
      .replace(/如何/g, '')
      .replace(/能不能/g, '')
      .replace(/可以吗/g, '')
      .replace(/应该/g, '')
      .replace(/[？?！!]/g, '')
      .trim();

    // 如果清理后太短，返回原始查询
    if (cleanQuery.length < 2) {
      return query;
    }

    return cleanQuery;
  }
}

module.exports = QueryRouter;
