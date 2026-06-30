const { ChatOpenAI } = require('@langchain/openai');
const { HumanMessage, AIMessage, SystemMessage, ToolMessage } = require('@langchain/core/messages');
const { SYSTEM_PROMPT } = require('../prompts/system');
const MemoryManager = require('../memory/MemoryManager');
const toolRegistry = require('../tools');
const fs = require('fs');
const path = require('path');

/**
 * MultiModalAgent - 基于 Qwen2-VL 的多模态 Agent
 * 支持文本、图片、视频输入
 */
class MultiModalAgent {
  constructor(apiKey, baseURL, redisClient) {
    if (!apiKey) {
      throw new Error('API Key is required for MultiModalAgent');
    }

    // 初始化 Qwen2-VL 模型（支持图片和视频）
    this.visionLLM = new ChatOpenAI({
      apiKey: apiKey,
      configuration: {
        baseURL: baseURL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      },
      modelName: 'qwen-vl-max', // Qwen2-VL 模型
      temperature: 0.7,
      streaming: true,
    });

    // 初始化纯文本模型（用于不含多媒体的对话）
    this.textLLM = new ChatOpenAI({
      apiKey: apiKey,
      configuration: {
        baseURL: baseURL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      },
      modelName: 'qwen-plus',
      temperature: 0.7,
      streaming: true,
    });

    // 初始化 MemoryManager
    this.memoryManager = redisClient ? new MemoryManager(redisClient) : null;

    console.log('[MultiModalAgent] Initialized with Qwen2-VL (qwen-vl-max) and qwen-plus');
  }

  /**
   * 处理多模态消息
   * @param {Array} messages - 消息数组，可能包含文本、图片、视频
   * @param {Object} context - 上下文信息
   * @param {Function} onStream - 流式输出回调
   */
  async chat(messages, context, onStream) {
    try {
      const currentUserMessage = messages[messages.length - 1];

      // 检测是否包含多媒体内容
      const hasMultimedia = this.detectMultimedia(currentUserMessage);

      // 加载历史对话摘要
      let chatHistorySummary = '';
      if (context.conversationId && this.memoryManager) {
        const recentMessages = await this.memoryManager.getRecentMessages(context.conversationId);

        if (recentMessages.length > 0) {
          console.log(`[MultiModalAgent] Loaded ${recentMessages.length} messages from Redis`);

          const userQuestions = recentMessages.filter(m => m.role === 'user').slice(-3);
          if (userQuestions.length > 0) {
            const topics = [];
            userQuestions.forEach(q => {
              const content = q.content;
              if (content.includes('吃') || content.includes('喂') || content.includes('食物')) topics.push('饮食');
              if (content.includes('训练') || content.includes('指令') || content.includes('听话')) topics.push('训练');
              if (content.includes('呕吐') || content.includes('拉肚子') || content.includes('生病')) topics.push('健康');
            });

            if (topics.length > 0) {
              chatHistorySummary = `用户最近在咨询宠物${[...new Set(topics)].join('、')}相关问题`;
            } else {
              chatHistorySummary = `用户最近在咨询宠物养护相关问题`;
            }
          }
        }
      }

      // 构建系统提示
      let systemPrompt = this.buildSystemPrompt(context, chatHistorySummary, hasMultimedia);

      // 转换消息格式
      const langchainMessages = await this.convertMessages(messages, hasMultimedia);
      langchainMessages.unshift(new SystemMessage(systemPrompt));

      // 选择合适的模型
      const llm = hasMultimedia ? this.visionLLM : this.textLLM;
      console.log(`[MultiModalAgent] Using ${hasMultimedia ? 'qwen-vl-max' : 'qwen-plus'} for this request`);

      // 如果有知识上下文，直接流式输出（不使用工具）
      if (context.knowledgeContext) {
        console.log('[MultiModalAgent] Knowledge context provided, streaming directly');
        const stream = await llm.stream(langchainMessages);

        let fullContent = '';
        for await (const chunk of stream) {
          if (chunk.content) {
            fullContent += chunk.content;
            onStream({ type: 'text', content: chunk.content });
          }
        }

        return fullContent;
      }

      // 获取可用的工具（只提供菜品推荐工具）
      const recipeToolSchema = toolRegistry.getTool('dog_recipe_recommend')?.getSchema();
      const tools = recipeToolSchema ? [recipeToolSchema] : [];

      if (tools.length > 0) {
        console.log('[MultiModalAgent] Available tools:', tools.map(t => t.function.name));

        // 第一次调用 LLM（非流式，判断是否需要调用工具）
        const response = await llm.invoke(langchainMessages, {
          tools: tools,
          tool_choice: 'auto'
        });

        console.log('[MultiModalAgent] Tool calls:', response.tool_calls?.length || 0);

        // 如果有工具调用
        if (response.tool_calls && response.tool_calls.length > 0) {
          console.log('[MultiModalAgent] Executing tool calls...');

          // 执行工具调用
          const toolResults = await this.executeToolCalls(response.tool_calls, context);

          // 构建包含工具结果的消息
          const messagesWithTools = [
            ...langchainMessages,
            response,
            ...toolResults.map(result =>
              new ToolMessage({
                content: JSON.stringify(result.result),
                tool_call_id: result.tool_call_id,
              })
            ),
          ];

          // 再次调用 LLM 生成最终回复（流式）
          const finalStream = await llm.stream(messagesWithTools);

          let fullContent = '';
          for await (const chunk of finalStream) {
            if (chunk.content) {
              fullContent += chunk.content;
              onStream({ type: 'text', content: chunk.content });
            }
          }

          return fullContent;
        }
      }

      // 没有工具调用，直接流式输出
      console.log('[MultiModalAgent] No tool calls, streaming response');
      const stream = await llm.stream(langchainMessages);

      let fullContent = '';
      for await (const chunk of stream) {
        if (chunk.content) {
          fullContent += chunk.content;
          onStream({ type: 'text', content: chunk.content });
        }
      }

      return fullContent;
    } catch (error) {
      console.error('[MultiModalAgent] Error:', error);
      throw error;
    }
  }

  /**
   * 构建系统提示
   */
  buildSystemPrompt(context, chatHistorySummary, hasMultimedia) {
    let systemPrompt = SYSTEM_PROMPT;

    // 多模态特殊指令
    if (hasMultimedia) {
      systemPrompt += `\n\n---\n\n`;
      systemPrompt += `## 【多模态能力】\n\n`;
      systemPrompt += `你具备视觉理解能力，可以分析用户上传的图片或视频内容。\n`;
      systemPrompt += `在回答时，请结合图片/视频中的内容，提供专业的狗狗护理建议。\n\n`;

      systemPrompt += `### 【菜品推荐工具使用规则】\n\n`;
      systemPrompt += `当用户上传食材图片并明确要求菜品推荐时，你可以调用 dog_recipe_recommend 工具。\n\n`;
      systemPrompt += `**必须同时满足以下条件才能调用**：\n`;
      systemPrompt += `1. 用户上传了包含食材的图片\n`;
      systemPrompt += `2. 用户明确表达了想要菜品推荐的意图，例如：\n`;
      systemPrompt += `   - "给我推荐一些菜品"\n`;
      systemPrompt += `   - "这些食材能做什么"\n`;
      systemPrompt += `   - "帮我搭配一下"\n`;
      systemPrompt += `   - "怎么给狗狗做饭"\n`;
      systemPrompt += `3. 你已经从图片中识别出了具体的食材\n\n`;
      systemPrompt += `**不应调用工具的情况**：\n`;
      systemPrompt += `- 用户只是问"这是什么"、"能吃吗"等简单问题\n`;
      systemPrompt += `- 用户没有明确要求菜品推荐\n`;
      systemPrompt += `- 图片中没有食材\n\n`;
    }

    systemPrompt += `\n\n---\n\n`;
    systemPrompt += `## 【CURRENT QUESTION - 最高优先级】\n\n`;
    systemPrompt += `你必须回答用户当前提出的问题（在 messages 中）。\n\n`;

    // 知识库上下文
    if (context.knowledgeContext) {
      systemPrompt += `---\n\n`;
      systemPrompt += `## 【RAG CONTEXT - 可参考】\n\n`;
      systemPrompt += `以下是从专业知识库中检索到的相关内容：\n\n${context.knowledgeContext}\n\n`;
      systemPrompt += `**使用规则**：\n`;
      systemPrompt += `1. 知识库检索已由系统完成，你无需再调用 knowledge_search 工具\n`;
      systemPrompt += `2. 直接基于上述知识库内容回答当前问题\n`;
      systemPrompt += `3. 如果知识库内容不足，可以补充你的专业知识\n`;
      systemPrompt += `4. 你当前没有可用的工具，请直接生成回答\n\n`;
    }

    // 历史对话摘要
    if (chatHistorySummary) {
      systemPrompt += `---\n\n`;
      systemPrompt += `## 【CHAT HISTORY - 仅辅助理解，不可主导】\n\n`;
      systemPrompt += `${chatHistorySummary}\n\n`;
      systemPrompt += `**使用规则**：此信息仅用于理解用户背景，不能改变当前问题的回答目标。\n\n`;
    }

    systemPrompt += `---\n\n`;
    systemPrompt += `⚠️ **决策规则（必须严格遵守）**：\n\n`;
    systemPrompt += `1. 你只能回答 CURRENT QUESTION（用户当前提出的问题）\n`;
    systemPrompt += `2. 严禁使用 CHAT HISTORY 作为问题来源\n`;
    systemPrompt += `3. CHAT HISTORY 只能提供背景，不可影响答案结构\n`;
    systemPrompt += `4. 如果历史与当前问题冲突，以 CURRENT QUESTION 为准\n`;
    systemPrompt += `5. 不得延续上一轮对话主题\n`;

    if (context.knowledgeContext) {
      systemPrompt += `6. ⚠️ 重要：知识库检索已完成，你无需调用任何工具，直接基于 RAG CONTEXT 回答即可\n`;
    }

    systemPrompt += `\n⚠️ **Answer ONLY: CURRENT QUESTION**`;

    return systemPrompt;
  }

  /**
   * 检测消息中是否包含多媒体内容
   */
  detectMultimedia(message) {
    if (!message || !message.content) return false;

    // 检测是否包含图片或视频 URL
    if (Array.isArray(message.content)) {
      return message.content.some(item =>
        item.type === 'image_url' ||
        item.type === 'video_url' ||
        item.image_url ||
        item.video_url
      );
    }

    return false;
  }

  /**
   * 转换消息格式（支持多模态）
   */
  async convertMessages(messages, hasMultimedia) {
    const convertedMessages = [];

    for (const msg of messages.filter(m => m && m.role && m.content)) {
      if (msg.role === 'user') {
        // 如果消息包含多媒体内容
        if (hasMultimedia && Array.isArray(msg.content)) {
          const contentItems = [];

          for (const item of msg.content) {
            if (item.type === 'text') {
              contentItems.push({ type: 'text', text: item.text });
            } else if (item.type === 'image_url') {
              const imageUrl = item.image_url.url;

              // 检查是否是本地 URL
              if (imageUrl.startsWith('http://localhost') || imageUrl.startsWith('http://127.0.0.1')) {
                // 转换为 Base64
                const base64Image = await this.convertLocalImageToBase64(imageUrl);
                if (base64Image) {
                  contentItems.push({ type: 'image_url', image_url: { url: base64Image } });
                  console.log('[MultiModalAgent] Converted local image to base64');
                } else {
                  console.warn('[MultiModalAgent] Failed to convert local image, skipping');
                }
              } else {
                // 公网 URL 直接使用
                contentItems.push({ type: 'image_url', image_url: { url: imageUrl } });
              }
            } else if (item.type === 'video_url') {
              contentItems.push({ type: 'video_url', video_url: { url: item.video_url.url } });
            } else {
              contentItems.push(item);
            }
          }

          convertedMessages.push(new HumanMessage({ content: contentItems }));
        } else {
          // 纯文本消息
          convertedMessages.push(new HumanMessage(msg.content));
        }
      } else if (msg.role === 'assistant') {
        convertedMessages.push(new AIMessage(msg.content));
      } else {
        convertedMessages.push(new HumanMessage(msg.content));
      }
    }

    return convertedMessages;
  }

  /**
   * 将本地图片 URL 转换为 Base64 格式
   */
  async convertLocalImageToBase64(localUrl) {
    try {
      // 从 URL 提取文件路径
      const urlObj = new URL(localUrl);
      const relativePath = urlObj.pathname; // 例如: /uploads/xxx.webp

      // 构建完整的文件系统路径
      const projectRoot = path.resolve(__dirname, '../../..');
      const filePath = path.join(projectRoot, relativePath);

      console.log(`[MultiModalAgent] Converting local image: ${filePath}`);

      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        console.error(`[MultiModalAgent] File not found: ${filePath}`);
        return null;
      }

      // 读取文件并转换为 Base64
      const imageBuffer = fs.readFileSync(filePath);
      const base64Image = imageBuffer.toString('base64');

      // 检测 MIME 类型
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
      };
      const mimeType = mimeTypes[ext] || 'image/jpeg';

      // 返回 data URL 格式
      return `data:${mimeType};base64,${base64Image}`;
    } catch (error) {
      console.error('[MultiModalAgent] Error converting image to base64:', error);
      return null;
    }
  }

  /**
   * 执行工具调用
   */
  async executeToolCalls(toolCalls, context) {
    const results = [];

    for (const toolCall of toolCalls) {
      try {
        const toolName = toolCall.name;
        const toolArgs = toolCall.args;

        console.log(`[MultiModalAgent] Executing tool: ${toolName}`);
        console.log(`[MultiModalAgent] Tool args:`, JSON.stringify(toolArgs));

        const tool = toolRegistry.getTool(toolName);
        if (!tool) {
          console.error(`[MultiModalAgent] Tool not found: ${toolName}`);
          results.push({
            tool_call_id: toolCall.id,
            result: { success: false, error: `Tool not found: ${toolName}` }
          });
          continue;
        }

        const result = await tool.execute(toolArgs, context);
        results.push({
          tool_call_id: toolCall.id,
          result: result
        });

        console.log(`[MultiModalAgent] Tool ${toolName} executed successfully`);
      } catch (error) {
        console.error(`[MultiModalAgent] Tool execution error:`, error);
        results.push({
          tool_call_id: toolCall.id,
          result: { success: false, error: error.message }
        });
      }
    }

    return results;
  }
}

module.exports = MultiModalAgent;
