const { ChatOpenAI } = require('@langchain/openai');
const { HumanMessage, AIMessage, SystemMessage, ToolMessage } = require('@langchain/core/messages');
const toolRegistry = require('../tools');
const { SYSTEM_PROMPT } = require('../prompts/system');
const MemoryManager = require('../memory/MemoryManager');

/**
 * DogWorldAgent - 基于阿里云通义千问的 Agent
 * 支持 Tool Calling 和流式输出
 */
class DogWorldAgent {
  constructor(apiKey, baseURL, redisClient) {
    if (!apiKey) {
      throw new Error('API Key is required for DogWorldAgent');
    }

    // 初始化 LLM（使用阿里云通义千问，兼容 OpenAI SDK）
    this.llm = new ChatOpenAI({
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

    console.log('[DogWorldAgent] Initialized with model: qwen-plus');
  }

  /**
   * 处理用户消息并调用 Tools
   * @param {Array} messages - 当前这轮对话的消息（通常只包含最新的用户消息）
   * @param {Object} context - 上下文信息（userId, token, conversationId 等）
   * @param {Function} onStream - 流式输出回调
   */
  async chat(messages, context, onStream) {
    try {
      // 获取当前用户的最新问题（绝对优先级最高）
      const currentUserMessage = messages[messages.length - 1];

      // 历史对话（语义压缩的摘要，仅辅助理解）
      let chatHistorySummary = '';
      if (context.conversationId && this.memoryManager) {
        const recentMessages = await this.memoryManager.getRecentMessages(context.conversationId);

        if (recentMessages.length > 0) {
          console.log(`[DogWorldAgent] Loaded ${recentMessages.length} messages from Redis (for context only)`);

          // 语义压缩：提取主题类别，而非原始片段
          const userQuestions = recentMessages.filter(m => m.role === 'user').slice(-3);
          if (userQuestions.length > 0) {
            // 简单分类（生产环境应该用 LLM 做 summary）
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

      // 转换当前消息为 LangChain 格式（只包含当前问题）
      const langchainMessages = this.convertMessages([currentUserMessage]);

      // 构建分层的 System Prompt
      let systemPrompt = SYSTEM_PROMPT;

      systemPrompt += `\n\n---\n\n`;

      // 层级 1: 当前问题（最高优先级）- 不重复问题内容，只保留结构
      systemPrompt += `## 【CURRENT QUESTION - 最高优先级】\n\n`;
      systemPrompt += `你必须回答用户当前提出的问题（在 messages 中）。\n\n`;

      // 层级 2: 知识库上下文（可参考）
      if (context.knowledgeContext) {
        systemPrompt += `---\n\n`;
        systemPrompt += `## 【RAG CONTEXT - 可参考】\n\n`;
        systemPrompt += `以下是从专业知识库中检索到的相关内容：\n\n${context.knowledgeContext}\n\n`;
        systemPrompt += `**使用规则**：\n`;
        systemPrompt += `1. 知识库检索已由系统完成，你无需再调用 knowledge_search 工具\n`;
        systemPrompt += `2. 优先基于上述知识库内容回答当前问题\n`;
        systemPrompt += `3. ⚠️ 如果知识库内容不足、过时或不完整，你可以调用 web_search 工具补充最新信息\n`;
        systemPrompt += `4. 当同时有 RAG 和 Web Search 结果时，综合两者给出完整答案\n\n`;
        console.log('[DogWorldAgent] Knowledge context injected');
      }

      // 层级 2.5: Web Search 上下文（如果有）
      if (context.webSearchContext) {
        systemPrompt += `---\n\n`;
        systemPrompt += `## 【WEB SEARCH CONTEXT - 最新信息补充】\n\n`;
        systemPrompt += `以下是从互联网搜索到的最新信息：\n\n${context.webSearchContext}\n\n`;
        systemPrompt += `**使用规则**：\n`;
        systemPrompt += `1. Web Search 结果用于补充知识库不足的部分\n`;
        systemPrompt += `2. 综合 RAG CONTEXT 和 WEB SEARCH CONTEXT 给出完整答案\n`;
        systemPrompt += `3. 如果两者有冲突，优先信任最新的 Web Search 结果（特别是时效性信息）\n\n`;
        console.log('[DogWorldAgent] Web search context injected');
      }

      // 层级 3: 历史对话（仅辅助理解）- 语义压缩后的摘要
      if (chatHistorySummary) {
        systemPrompt += `---\n\n`;
        systemPrompt += `## 【CHAT HISTORY - 仅辅助理解，不可主导】\n\n`;
        systemPrompt += `${chatHistorySummary}\n\n`;
        systemPrompt += `**使用规则**：此信息仅用于理解用户背景，不能改变当前问题的回答目标。\n\n`;
      }

      systemPrompt += `---\n\n`;

      // 决策锁死规则（最关键）
      systemPrompt += `⚠️ **决策规则（必须严格遵守）**：\n\n`;
      systemPrompt += `1. 你只能回答 CURRENT QUESTION（用户当前提出的问题）\n`;
      systemPrompt += `2. 严禁使用 CHAT HISTORY 作为问题来源\n`;
      systemPrompt += `3. CHAT HISTORY 只能提供背景，不可影响答案结构\n`;
      systemPrompt += `4. 如果历史与当前问题冲突，以 CURRENT QUESTION 为准\n`;
      systemPrompt += `5. 不得延续上一轮对话主题\n`;

      systemPrompt += `\n⚠️ **Answer ONLY: CURRENT QUESTION**`;

      langchainMessages.unshift(new SystemMessage(systemPrompt));

      // 动态工具配置
      let tools = [];

      // 如果知识库上下文已提供，只提供 web_search 工具（用于补充）
      if (context.knowledgeContext) {
        const webSearchTool = toolRegistry.getTool('web_search');
        if (webSearchTool) {
          tools = [webSearchTool.getSchema()];
          console.log('[DogWorldAgent] RAG provided, web_search tool available for supplementing');
        }
      } else {
        // 没有知识上下文，提供所有工具
        tools = toolRegistry.getAllSchemas();
        console.log('[DogWorldAgent] Available tools:', tools.map(t => t.function.name));
      }

      // 如果 Web Search 结果已经提供，直接流式输出（不再调用工具）
      if (context.webSearchContext) {
        console.log('[DogWorldAgent] Web search results provided, streaming final answer');
        const stream = await this.llm.stream(langchainMessages);

        let fullContent = '';
        for await (const chunk of stream) {
          if (chunk.content) {
            fullContent += chunk.content;
            onStream({ type: 'text', content: chunk.content });
          }
        }

        return fullContent;
      }

      // 第一次调用 LLM（非流式，用于判断是否需要调用 Tool）
      const response = await this.llm.invoke(langchainMessages, {
        tools: tools,
        tool_choice: 'auto'
      });

      // 调试：打印 response 结构
      console.log('[DogWorldAgent] Response type:', response.constructor.name);
      console.log('[DogWorldAgent] Response has tool_calls:', !!response.tool_calls);
      console.log('[DogWorldAgent] Response content preview:', response.content?.slice(0, 100));
      if (response.tool_calls) {
        console.log('[DogWorldAgent] Tool calls:', JSON.stringify(response.tool_calls));
      }

      // 检查是否有 tool calls
      if (response.tool_calls && response.tool_calls.length > 0) {
        console.log('[DogWorldAgent] Tool calls detected:', response.tool_calls.length);

        // 执行所有 tool calls
        const toolResults = await this.executeToolCalls(response.tool_calls, context);

        // 构建包含 tool 结果的新消息历史
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
        const finalStream = await this.llm.stream(messagesWithTools);

        let fullContent = '';
        for await (const chunk of finalStream) {
          if (chunk.content) {
            fullContent += chunk.content;
            onStream({ type: 'text', content: chunk.content });
          }
        }

        return fullContent;
      } else {
        // 没有 tool calls，直接流式输出
        console.log('[DogWorldAgent] No tool calls, streaming response');

        const stream = await this.llm.stream(langchainMessages);

        let fullContent = '';
        for await (const chunk of stream) {
          if (chunk.content) {
            fullContent += chunk.content;
            onStream({ type: 'text', content: chunk.content });
          }
        }

        return fullContent;
      }
    } catch (error) {
      console.error('[DogWorldAgent] Error:', error);
      throw error;
    }
  }

  /**
   * 转换消息格式
   */
  convertMessages(messages) {
    return messages
      .filter(msg => msg && msg.role && msg.content) // 过滤掉无效消息
      .map(msg => {
        if (msg.role === 'user') {
          return new HumanMessage(msg.content);
        } else if (msg.role === 'assistant') {
          return new AIMessage(msg.content);
        }
        return new HumanMessage(msg.content);
      });
  }

  /**
   * 执行 Tool Calls
   */
  async executeToolCalls(toolCalls, context) {
    const results = [];

    for (const toolCall of toolCalls) {
      console.log(`[DogWorldAgent] Executing tool: ${toolCall.name}`, toolCall.args);

      try {
        const result = await toolRegistry.executeTool(
          toolCall.name,
          toolCall.args,
          context
        );

        results.push({
          tool_call_id: toolCall.id,
          name: toolCall.name,
          result: result,
        });

        console.log(`[DogWorldAgent] Tool result:`, result);
      } catch (error) {
        console.error(`[DogWorldAgent] Tool execution error:`, error);
        results.push({
          tool_call_id: toolCall.id,
          name: toolCall.name,
          result: {
            success: false,
            error: error.message,
          },
        });
      }
    }

    return results;
  }
}

module.exports = DogWorldAgent;
