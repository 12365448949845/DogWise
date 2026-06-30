/**
 * SemanticChunker - 语义记忆切块器
 * 将对话消息切分为适合向量存储的语义块
 */
class SemanticChunker {
  constructor() {
    this.maxChunkTokens = 500; // 最大 chunk 大小（约 500 tokens）
    this.maxChunkChars = 1000; // 约 500 tokens 的字符数（中文）
  }

  /**
   * 对语义消息进行切块
   * @param {Array} messages - 过滤后的语义消息 [{ role, content, index, timestamp }]
   * @param {Object} context - 上下文信息 { conversationId, userId }
   * @returns {Promise<Array>} - chunk 数组
   */
  async chunk(messages, context) {
    if (!messages || messages.length === 0) {
      return [];
    }

    const chunks = [];
    const { conversationId, userId } = context;

    // 按对话轮次切块（用户消息 + 后续的 AI 回复）
    for (let i = 0; i < messages.length; i++) {
      const userMsg = messages[i];

      // 查找对应的 AI 回复（在原始对话中紧跟用户消息的 assistant 消息）
      const aiMsg = this.findCorrespondingAIResponse(messages, i);

      const content = this.buildChunkContent(userMsg, aiMsg);

      // 如果单个对话轮次过长，进一步切分
      if (content.length > this.maxChunkChars) {
        const subChunks = this.splitLongContent(content, {
          conversationId,
          userId,
          roundIndex: i,
          timestamp: userMsg.timestamp
        });
        chunks.push(...subChunks);
      } else {
        // 创建单个 chunk
        chunks.push({
          id: `${conversationId}_${Date.now()}_${i}`,
          conversationId,
          userId,
          content: content,
          summary: null, // 稍后由 LLM 生成
          metadata: {
            timestamp: userMsg.timestamp || new Date(),
            roundIndex: i,
            topics: this.extractTopics(content),
            sentiment: this.detectSentiment(content),
            intent: 'user_expression'
          }
        });
      }
    }

    console.log(`[SemanticChunker] Created ${chunks.length} chunks from ${messages.length} messages`);

    return chunks;
  }

  /**
   * 查找对应的 AI 回复（简化版）
   */
  findCorrespondingAIResponse(messages, userMsgIndex) {
    // 简单实现：查找下一条 assistant 消息
    for (let i = userMsgIndex + 1; i < messages.length; i++) {
      if (messages[i].role === 'assistant') {
        return messages[i];
      }
    }
    return null;
  }

  /**
   * 构建 chunk 内容（用户消息 + AI 回复）
   */
  buildChunkContent(userMsg, aiMsg) {
    let content = `用户: ${userMsg.content}`;

    if (aiMsg && aiMsg.content) {
      content += `\n助手: ${aiMsg.content}`;
    }

    return content;
  }

  /**
   * 切分过长的内容
   */
  splitLongContent(content, baseMetadata) {
    const chunks = [];
    const sentences = this.splitIntoSentences(content);

    let currentChunk = '';
    let chunkIndex = 0;

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > this.maxChunkChars) {
        // 当前 chunk 已满，保存并开始新 chunk
        if (currentChunk.length > 0) {
          chunks.push({
            id: `${baseMetadata.conversationId}_${Date.now()}_${baseMetadata.roundIndex}_${chunkIndex}`,
            conversationId: baseMetadata.conversationId,
            userId: baseMetadata.userId,
            content: currentChunk.trim(),
            summary: null,
            metadata: {
              ...baseMetadata,
              chunkIndex: chunkIndex
            }
          });
          chunkIndex++;
        }
        currentChunk = sentence;
      } else {
        currentChunk += sentence;
      }
    }

    // 保存最后一个 chunk
    if (currentChunk.length > 0) {
      chunks.push({
        id: `${baseMetadata.conversationId}_${Date.now()}_${baseMetadata.roundIndex}_${chunkIndex}`,
        conversationId: baseMetadata.conversationId,
        userId: baseMetadata.userId,
        content: currentChunk.trim(),
        summary: null,
        metadata: {
          ...baseMetadata,
          chunkIndex: chunkIndex
        }
      });
    }

    return chunks;
  }

  /**
   * 将文本切分为句子
   */
  splitIntoSentences(text) {
    // 按句号、问号、感叹号切分
    const sentences = text.split(/([。！？\.\!\?]+)/).filter(s => s.trim().length > 0);

    // 重新组合（标点符号和前面的文本合并）
    const result = [];
    for (let i = 0; i < sentences.length; i += 2) {
      const sentence = sentences[i];
      const punctuation = sentences[i + 1] || '';
      result.push(sentence + punctuation);
    }

    return result;
  }

  /**
   * 提取主题关键词（简化版）
   */
  extractTopics(content) {
    const topics = [];

    // 狗狗品种
    const breeds = ['金毛', '泰迪', '哈士奇', '柯基', '边牧', '拉布拉多', '萨摩耶', '比熊'];
    breeds.forEach(breed => {
      if (content.includes(breed)) {
        topics.push(`breed:${breed}`);
      }
    });

    // 主题分类
    const categories = {
      'health': ['健康', '生病', '疫苗', '看病', '兽医', '症状'],
      'training': ['训练', '教', '学习', '指令', '服从'],
      'nutrition': ['吃', '食物', '饮食', '营养', '喂'],
      'daily': ['遛狗', '洗澡', '玩', '散步', '运动']
    };

    Object.entries(categories).forEach(([category, keywords]) => {
      if (keywords.some(kw => content.includes(kw))) {
        topics.push(`category:${category}`);
      }
    });

    return topics;
  }

  /**
   * 检测情感（简化版）
   */
  detectSentiment(content) {
    const positiveWords = ['喜欢', '开心', '高兴', '好', '棒', '很棒', '优秀'];
    const negativeWords = ['不喜欢', '讨厌', '难过', '担心', '害怕', '坏', '不好'];
    const urgentWords = ['急', '紧急', '怎么办', '救命', '危险'];

    if (urgentWords.some(w => content.includes(w))) {
      return 'urgent';
    }

    const positiveCount = positiveWords.filter(w => content.includes(w)).length;
    const negativeCount = negativeWords.filter(w => content.includes(w)).length;

    if (positiveCount > negativeCount) {
      return 'positive';
    } else if (negativeCount > positiveCount) {
      return 'negative';
    }

    return 'neutral';
  }
}

module.exports = SemanticChunker;
