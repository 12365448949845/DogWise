const BaseTool = require('../base/BaseTool');
const { ChatOpenAI } = require('@langchain/openai');

/**
 * StructuredInfoExtractTool - 结构化信息提取工具
 * 从对话中提取结构化的用户和宠物信息
 */
class StructuredInfoExtractTool extends BaseTool {
  constructor() {
    super();
    this.name = 'structured_info_extract';
    this.description = '从对话中提取结构化的用户和宠物信息（名字、品种、年龄、过敏等）';

    // 初始化 LLM（用于信息提取）
    this.llm = new ChatOpenAI({
      openAIApiKey: process.env.ALIYUN_API_KEY,
      configuration: {
        baseURL: process.env.ALIYUN_BASE_URL
      },
      modelName: 'qwen-plus',
      temperature: 0.1 // 低温度，确保提取准确
    });
  }

  /**
   * 执行结构化信息提取
   * @param {Object} input - { messages: [...] }
   * @param {Object} context - { userId }
   * @returns {Promise<Object>} - 提取的结构化数据
   */
  async execute(input, context) {
    const { messages } = input;

    if (!messages || messages.length === 0) {
      return {};
    }

    try {
      // 构建提取提示词
      const conversationText = this.buildConversationText(messages);
      const extractionPrompt = this.buildExtractionPrompt(conversationText);

      // 调用 LLM 提取信息
      const response = await this.llm.invoke(extractionPrompt);
      const extractedText = response.content;

      // 解析 JSON 结果
      const structuredData = this.parseExtractedData(extractedText);

      console.log('[StructuredInfoExtractTool] Extracted structured data:', structuredData);

      return structuredData;
    } catch (error) {
      console.error('[StructuredInfoExtractTool] Error:', error);
      return {};
    }
  }

  /**
   * 构建对话文本
   */
  buildConversationText(messages) {
    return messages
      .slice(-10) // 只取最近 10 条消息
      .map(msg => `${msg.role === 'user' ? '用户' : '助手'}: ${msg.content}`)
      .join('\n');
  }

  /**
   * 构建提取提示词
   */
  buildExtractionPrompt(conversationText) {
    return `你是一个信息提取助手。请从以下对话中提取关于用户宠物狗的结构化信息。

对话内容：
${conversationText}

请以 JSON 格式返回提取的信息，格式如下：
{
  "dogs": [
    {
      "name": "狗的名字（如果提到）",
      "breed": "品种（如：金毛、泰迪等）",
      "age": 年龄（月数，如果提到"2岁"则为24）,
      "gender": "性别（公/母）",
      "weight": 体重（公斤）,
      "allergies": ["过敏物质1", "过敏物质2"],
      "healthIssues": ["健康问题1"],
      "vaccinations": []
    }
  ],
  "preferences": {
    "interestedTopics": ["关注的话题"],
    "dislikedTopics": ["不感兴趣的话题"]
  }
}

注意事项：
1. 只提取明确提到的信息，不要猜测
2. 如果某个字段没有提到，设为 null
3. 如果对话中没有提到任何宠物信息，返回空对象 {}
4. 年龄统一转换为月数
5. 只返回 JSON，不要有其他文字

JSON 输出：`;
  }

  /**
   * 解析提取的数据
   */
  parseExtractedData(text) {
    try {
      // 尝试提取 JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {};
      }

      const data = JSON.parse(jsonMatch[0]);

      // 清理空值
      if (data.dogs && Array.isArray(data.dogs)) {
        data.dogs = data.dogs.map(dog => {
          const cleanedDog = {};
          Object.entries(dog).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
              cleanedDog[key] = value;
            }
          });
          return cleanedDog;
        }).filter(dog => Object.keys(dog).length > 0);
      }

      // 如果没有有效数据，返回空对象
      if (!data.dogs || data.dogs.length === 0) {
        if (!data.preferences ||
            (data.preferences.interestedTopics.length === 0 &&
             data.preferences.dislikedTopics.length === 0)) {
          return {};
        }
      }

      return data;
    } catch (error) {
      console.error('[StructuredInfoExtractTool] Parse error:', error);
      return {};
    }
  }
}

module.exports = StructuredInfoExtractTool;
