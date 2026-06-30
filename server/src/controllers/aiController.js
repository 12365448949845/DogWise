const DogWorldAgent = require('../ai/agents/DogWorldAgent');
const MultiModalAgent = require('../ai/agents/MultiModalAgent');
const Conversation = require('../models/Conversation');
const { getRedisClient } = require('../config/redis');
const MemoryManager = require('../ai/memory/MemoryManager');
const { processMemoryAsync } = require('../ai/services/MemoryProcessingService');
const QueryRouter = require('../ai/router/QueryRouter');
const WebSearchDecisionMaker = require('../ai/decision/WebSearchDecisionMaker');
const toolRegistry = require('../ai/tools');
const fs = require('fs');

// 从环境变量读取配置
const ALIYUN_API_KEY = process.env.ALIYUN_API_KEY;
const ALIYUN_BASE_URL = process.env.ALIYUN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';

// 初始化 Redis 和 MemoryManager
let memoryManager = null;
try {
  const redisClient = getRedisClient();
  memoryManager = new MemoryManager(redisClient);
  console.log('[aiController] MemoryManager initialized');
} catch (error) {
  console.error('[aiController] Failed to initialize MemoryManager:', error);
}

// 初始化 QueryRouter 和 WebSearchDecisionMaker
const queryRouter = new QueryRouter();
const webSearchDecisionMaker = new WebSearchDecisionMaker(ALIYUN_API_KEY, ALIYUN_BASE_URL);

/**
 * POST /api/ai/chat
 * Body: { messages: [{ role, content }], conversationId?: string }
 *
 * 工作流程：
 * 1. 前端发送完整的 messages 数组（包含历史）
 * 2. Agent 处理并生成回复
 * 3. 后端将完整对话存入数据库
 */
exports.chatStream = async (req, res) => {
  const { messages, conversationId } = req.body;
  const userId = req.user?.id;

  // 写入文件验证代码执行
  fs.appendFileSync('C:\\Users\\ccp\\Desktop\\vue\\DogWise\\server\\aiController.log',
    `[${new Date().toISOString()}] chatStream called, user: ${userId}, messages: ${messages?.length}\n`);

  console.log('[aiController] ========== NEW REQUEST ==========');
  console.log('[aiController] User:', userId);
  console.log('[aiController] Messages count:', messages?.length);
  console.log('[aiController] Last message:', messages?.[messages.length - 1]?.content);

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ code: 400, message: 'messages is required' });
  }

  if (!ALIYUN_API_KEY) {
    return res.status(500).json({ code: 500, message: 'Aliyun API key not configured' });
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  let fullAiResponse = '';
  let savedConversationId = conversationId;

  try {
    // 1. 获取用户最新问题
    const lastMessage = messages[messages.length - 1];
    let userQuery = '';

    // 提取文本内容（支持多模态格式）
    if (Array.isArray(lastMessage?.content)) {
      // 多模态消息：提取 text 部分
      const textItem = lastMessage.content.find(item => item.type === 'text');
      userQuery = textItem?.text || '';
    } else {
      // 纯文本消息
      userQuery = lastMessage?.content || '';
    }

    console.log(`[aiController] Extracted user query: "${userQuery}"`);

    // 2. 使用 Router 判断是否需要调用 RAG（只对纯文本问题）
    const shouldUseRAG = userQuery && queryRouter.shouldUseRAG(userQuery);
    let knowledgeContext = null;
    let knowledgeResult = null;

    if (shouldUseRAG) {
      // 3. 主动调用知识库 Tool
      const searchQuery = queryRouter.extractSearchQuery(userQuery);
      console.log(`[aiController] RAG triggered, searching knowledge: "${searchQuery}"`);

      const knowledgeTool = toolRegistry.getTool('knowledge_search');
      knowledgeResult = await knowledgeTool.execute(
        { query: searchQuery, limit: 3 },
        { userId }
      );

      if (knowledgeResult.success && knowledgeResult.knowledge && knowledgeResult.knowledge.length > 0) {
        // 格式化知识库内容
        knowledgeContext = knowledgeResult.knowledge.map((k, idx) =>
          `【知识${idx + 1}】${k.title} - ${k.section}\n${k.content}`
        ).join('\n\n');

        console.log(`[aiController] Found ${knowledgeResult.knowledge.length} knowledge items`);
      } else {
        console.log('[aiController] No knowledge found');
      }
    }

    // 4. 使用混合决策器判断是否需要 Web Search
    let webSearchContext = null;
    if (shouldUseRAG && knowledgeResult) {
      const decision = await webSearchDecisionMaker.decide(userQuery, knowledgeResult);

      console.log(`[aiController] 🤔 Web Search Decision: ${decision.needsWebSearch}`);
      console.log(`[aiController] 📊 Reason: ${decision.reason}`);
      console.log(`[aiController] 🎯 Decision Layer: ${decision.decisionLayer}`);
      console.log(`[aiController] 💯 Confidence: ${decision.confidence}`);

      // 5. 如果决策需要 Web Search，则执行
      if (decision.needsWebSearch) {
        console.log('[aiController] 🔍 Triggering web search');

        const webSearchTool = toolRegistry.getTool('web_search');
        if (webSearchTool) {
          const webSearchResult = await webSearchTool.execute(
            { query: userQuery, num_results: 3 },
            { userId, conversationId }
          );

          if (webSearchResult.success && webSearchResult.results && webSearchResult.results.length > 0) {
            // 格式化 Web Search 结果
            webSearchContext = webSearchResult.results.map((r, idx) =>
              `【搜索结果${idx + 1}】${r.title}\n${r.snippet}\n来源：${r.source} | 链接：${r.url}`
            ).join('\n\n');

            console.log(`[aiController] ✅ Web search found ${webSearchResult.results.length} results`);
          } else {
            console.log('[aiController] ⚠️  Web search returned no results');
          }
        }
      } else {
        console.log('[aiController] ✅ RAG sufficient, skipping web search');
      }
    }

    // 6. 检测是否包含多媒体内容
    const currentMessage = messages[messages.length - 1];
    const hasMultimedia = detectMultimedia(currentMessage);

    // 7. 根据是否包含多媒体内容选择 Agent
    const redisClient = memoryManager ? memoryManager.redis : null;
    let agent;

    if (hasMultimedia) {
      console.log('[aiController] Detected multimedia content, using MultiModalAgent');
      agent = new MultiModalAgent(ALIYUN_API_KEY, ALIYUN_BASE_URL, redisClient);
    } else {
      console.log('[aiController] Using DogWorldAgent for text-only conversation');
      agent = new DogWorldAgent(ALIYUN_API_KEY, ALIYUN_BASE_URL, redisClient);
    }

    const context = {
      userId: userId,
      token: req.headers.authorization,
      conversationId: conversationId,
      knowledgeContext: knowledgeContext, // 传入知识库上下文
      webSearchContext: webSearchContext, // 传入 Web Search 上下文
    };

    // 8. 调用 Agent，流式输出（只传当前消息，Agent 会从 Redis 加载历史）
    fullAiResponse = await agent.chat([currentMessage], context, (chunk) => {
      if (chunk.type === 'text') {
        res.write(`data: ${JSON.stringify({ content: chunk.content })}\n\n`);
      }
    });

    // 3. 保存到数据库
    const aiMessage = { role: 'assistant', content: fullAiResponse };

    // 转换消息格式以适配 MongoDB schema（content 必须是字符串）
    const allMessages = [...messages, aiMessage].map(msg => {
      let contentString = msg.content;

      // 如果 content 是数组（多模态消息），提取文本部分
      if (Array.isArray(msg.content)) {
        const textItem = msg.content.find(item => item.type === 'text');
        contentString = textItem?.text || '[多媒体消息]';
      }

      return {
        role: msg.role,
        content: contentString,
        timestamp: new Date(),
      };
    });

    if (conversationId) {
      // 更新已有对话
      await Conversation.findOneAndUpdate(
        { _id: conversationId, user: userId },
        {
          messages: allMessages,
          lastActiveAt: new Date(),
        }
      );
    } else {
      // 创建新对话
      const firstUserMsg = messages.find(m => m.role === 'user');

      // 提取标题（处理多模态消息）
      let title = '新对话';
      if (firstUserMsg) {
        if (Array.isArray(firstUserMsg.content)) {
          const textItem = firstUserMsg.content.find(item => item.type === 'text');
          title = textItem?.text?.slice(0, 30) || '图片对话';
        } else {
          title = firstUserMsg.content.slice(0, 30);
        }
      }

      const newConv = await Conversation.create({
        user: userId,
        title,
        messages: allMessages,
      });

      savedConversationId = newConv._id.toString();
    }

    // 4. 保存到 Redis（短期记忆）
    if (memoryManager && savedConversationId) {
      await memoryManager.saveMessages(savedConversationId, allMessages.map(m => ({
        role: m.role,
        content: m.content,
      })));
    }

    // 5. 异步处理长期记忆（不阻塞响应）
    if (savedConversationId && userId) {
      processMemoryAsync(savedConversationId, allMessages, userId).catch(err => {
        console.error('[aiController] Long-term memory processing error:', err);
      });
    }

    // 6. 发送结束信号和会话 ID
    res.write(`data: ${JSON.stringify({
      type: 'done',
      conversationId: savedConversationId
    })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error) {
    console.error('[aiController] Error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }

  // Handle client disconnect
  req.on('close', () => {
    console.log('[aiController] Client disconnected');
  });
};

/**
 * 检测消息中是否包含多媒体内容
 */
function detectMultimedia(message) {
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
 * 评估 RAG 检索结果的充分性
 * @param {Object} knowledgeResult - RAG 检索结果
 * @param {string} userQuery - 用户查询
 * @returns {Object} - { level: 'sufficient' | 'insufficient', reason: string }
 */
exports.evaluateRAGSufficiency = function(knowledgeResult, userQuery) {
  // 1. 如果没有检索到任何知识
  if (!knowledgeResult.success || !knowledgeResult.knowledge || knowledgeResult.knowledge.length === 0) {
    return {
      level: 'insufficient',
      reason: 'No knowledge retrieved from RAG'
    };
  }

  const knowledge = knowledgeResult.knowledge;

  // 2. 检查检索结果数量（少于2个认为不足）
  if (knowledge.length < 2) {
    return {
      level: 'insufficient',
      reason: `Only ${knowledge.length} knowledge item found, may be incomplete`
    };
  }

  // 3. 检查相关性分数（如果有的话）
  const avgScore = knowledge.reduce((sum, k) => sum + (k.score || 0), 0) / knowledge.length;
  if (avgScore < 0.5) {
    return {
      level: 'insufficient',
      reason: `Low relevance score (avg: ${avgScore.toFixed(2)})`
    };
  }

  // 4. 检测时效性问题（关键词匹配）
  const timeKeywords = ['2024', '2025', '2026', '最新', '新政策', '近期', '今年'];
  const needsLatestInfo = timeKeywords.some(keyword => userQuery.includes(keyword));

  if (needsLatestInfo) {
    return {
      level: 'insufficient',
      reason: 'Query requires latest information, RAG may be outdated'
    };
  }

  // 5. 检查内容长度（总字数少于100认为不足）
  const totalLength = knowledge.reduce((sum, k) => sum + k.content.length, 0);
  if (totalLength < 100) {
    return {
      level: 'insufficient',
      reason: `Content too short (${totalLength} chars), may lack details`
    };
  }

  // 6. 默认认为充分
  return {
    level: 'sufficient',
    reason: `${knowledge.length} items retrieved with avg score ${avgScore.toFixed(2)}`
  };
};
