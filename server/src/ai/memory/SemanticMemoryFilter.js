/**
 * SemanticMemoryFilter - 语义记忆过滤器
 * 判断对话内容是否需要存入向量数据库
 */
class SemanticMemoryFilter {
  constructor() {
    // 不需要存储的简单问候和感谢
    this.simpleGreetings = [
      '你好', 'hi', 'hello', '您好', '嗨',
      '谢谢', '感谢', 'thanks', 'thank you',
      '再见', 'bye', 'goodbye', '拜拜',
      '好的', '好', '嗯', '哦', 'ok', 'okay'
    ];

    // 结构化信息关键词（这些会被 StructuredInfoExtractTool 处理）
    this.structuredKeywords = [
      '名字', '叫', '品种', '年龄', '岁', '月',
      '过敏', '疫苗', '体重', '公斤', 'kg',
      '性别', '公', '母', '男', '女'
    ];

    // 语义记忆关键词（需要存储的内容）
    this.semanticKeywords = [
      '喜欢', '不喜欢', '讨厌', '偏好',
      '每天', '经常', '通常', '习惯',
      '我觉得', '我认为', '我发现',
      '总是', '从来不', '一般'
    ];
  }

  /**
   * 过滤消息，返回需要存入向量数据库的内容
   * @param {Array} messages - 消息数组 [{ role, content, timestamp }]
   * @returns {Array} - 需要存储的消息
   */
  filter(messages) {
    if (!messages || messages.length === 0) {
      return [];
    }

    const semanticMessages = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];

      // 只处理用户消息
      if (msg.role !== 'user') {
        continue;
      }

      const content = msg.content || '';
      const contentLower = content.toLowerCase();

      // 1. 过滤空消息
      if (content.trim().length === 0) {
        continue;
      }

      // 2. 过滤简单问候
      if (this.isSimpleGreeting(contentLower)) {
        continue;
      }

      // 3. 过滤过短的消息（少于 10 个字符）
      if (content.length < 10) {
        continue;
      }

      // 4. 检查是否包含语义关键词
      const hasSemanticKeyword = this.semanticKeywords.some(kw =>
        content.includes(kw)
      );

      // 5. 检查是否是纯结构化信息（短句 + 只包含结构化关键词）
      const hasStructuredKeyword = this.structuredKeywords.some(kw =>
        content.includes(kw)
      );
      const isPureStructured = content.length < 50 &&
                               hasStructuredKeyword &&
                               !hasSemanticKeyword;

      if (isPureStructured) {
        continue;
      }

      // 6. 长句子（超过 30 字）或包含语义关键词的消息 → 需要存储
      if (content.length > 30 || hasSemanticKeyword) {
        semanticMessages.push({
          ...msg,
          index: i
        });
      }
    }

    console.log(`[SemanticMemoryFilter] Filtered ${semanticMessages.length}/${messages.length} messages for semantic storage`);

    return semanticMessages;
  }

  /**
   * 判断是否是简单问候
   */
  isSimpleGreeting(text) {
    return this.simpleGreetings.some(greeting =>
      text === greeting || text.trim() === greeting
    );
  }

  /**
   * 检查消息是否值得存储（对外接口）
   * @param {string} content - 消息内容
   * @returns {boolean}
   */
  shouldStore(content) {
    if (!content || content.trim().length === 0) {
      return false;
    }

    const contentLower = content.toLowerCase();

    // 简单问候 → 不存储
    if (this.isSimpleGreeting(contentLower)) {
      return false;
    }

    // 太短 → 不存储
    if (content.length < 10) {
      return false;
    }

    // 包含语义关键词 → 存储
    const hasSemanticKeyword = this.semanticKeywords.some(kw =>
      content.includes(kw)
    );

    if (hasSemanticKeyword) {
      return true;
    }

    // 纯结构化短句 → 不存储
    const hasStructuredKeyword = this.structuredKeywords.some(kw =>
      content.includes(kw)
    );
    const isPureStructured = content.length < 50 && hasStructuredKeyword;

    if (isPureStructured) {
      return false;
    }

    // 长句子 → 存储
    return content.length > 30;
  }
}

module.exports = SemanticMemoryFilter;
