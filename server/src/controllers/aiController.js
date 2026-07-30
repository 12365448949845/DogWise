const mongoose = require('mongoose');
const DogWorldAgent = require('../ai/agents/DogWorldAgent');
const MultiModalAgent = require('../ai/agents/MultiModalAgent');
const Conversation = require('../models/Conversation');
const { getRedisClient } = require('../config/redis');
const MemoryManager = require('../ai/memory/MemoryManager');
const { processMemoryAsync } = require('../ai/services/MemoryProcessingService');
const QueryRouter = require('../ai/router/QueryRouter');
const WebSearchDecisionMaker = require('../ai/decision/WebSearchDecisionMaker');
const toolRegistry = require('../ai/tools');

const ALIYUN_API_KEY = process.env.ALIYUN_API_KEY;
const ALIYUN_BASE_URL = process.env.ALIYUN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const MAX_HISTORY_MESSAGES = 20;
const MAX_TEXT_LENGTH = 10000;
const MAX_MEDIA_ITEMS = 6;

let memoryManager = null;
try {
  memoryManager = new MemoryManager(getRedisClient());
  console.log('[aiController] MemoryManager initialized');
} catch (error) {
  console.error('[aiController] Failed to initialize MemoryManager:', error.message);
}

const queryRouter = new QueryRouter();
const webSearchDecisionMaker = ALIYUN_API_KEY
  ? new WebSearchDecisionMaker(ALIYUN_API_KEY, ALIYUN_BASE_URL)
  : null;

exports.chatStream = async (req, res) => {
  const userId = req.user?.id;
  const conversationId = req.body?.conversationId;

  let currentMessage;
  let existingConversation = null;

  try {
    currentMessage = getIncomingUserMessage(req.body || {});
    validateUserMessage(currentMessage);

    if (!ALIYUN_API_KEY) {
      return res.status(500).json({ code: 500, message: 'Aliyun API key not configured' });
    }

    if (conversationId) {
      if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        return res.status(400).json({ code: 400, message: 'Invalid conversationId' });
      }

      existingConversation = await Conversation.findOne({
        _id: conversationId,
        user: userId,
        status: 'active'
      }).lean();

      if (!existingConversation) {
        return res.status(404).json({ code: 404, message: 'Conversation not found' });
      }
    }
  } catch (error) {
    const status = error.statusCode || 400;
    return res.status(status).json({ code: status, message: error.message });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const abortController = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) abortController.abort();
  });

  try {
    const userQuery = getTextContent(currentMessage.content);
    const history = (existingConversation?.messages || [])
      .filter(message => message.role === 'user' || message.role === 'assistant')
      .map(message => ({ role: message.role, content: message.content }));
    const agentMessages = [...history.slice(-MAX_HISTORY_MESSAGES), currentMessage];

    const retrieval = await retrieveContexts(userQuery, {
      userId,
      conversationId,
      signal: abortController.signal
    });

    const redisClient = memoryManager?.redis || null;
    const Agent = detectMultimedia(currentMessage) ? MultiModalAgent : DogWorldAgent;
    const agent = new Agent(ALIYUN_API_KEY, ALIYUN_BASE_URL, redisClient);

    const context = {
      userId,
      conversationId,
      knowledgeContext: retrieval.knowledgeContext,
      webSearchContext: retrieval.webSearchContext,
      signal: abortController.signal
    };

    const fullAiResponse = await agent.chat(agentMessages, context, chunk => {
      if (chunk.type === 'text') {
        writeSse(res, { content: chunk.content });
      }
    });

    if (abortController.signal.aborted) return;

    const userMessage = toStoredMessage(currentMessage);
    const aiMessage = toStoredMessage({ role: 'assistant', content: fullAiResponse });
    let savedConversationId = conversationId;

    if (existingConversation) {
      const updated = await Conversation.findOneAndUpdate(
        { _id: conversationId, user: userId, status: 'active' },
        {
          $push: { messages: { $each: [userMessage, aiMessage] } },
          $set: { lastActiveAt: new Date() }
        },
        { new: true }
      );

      if (!updated) throw new Error('Conversation changed or is no longer available');
    } else {
      const created = await Conversation.create({
        user: userId,
        title: createConversationTitle(currentMessage),
        messages: [userMessage, aiMessage]
      });
      savedConversationId = created._id.toString();
    }

    const recentMessages = [...history, userMessage, aiMessage];
    if (memoryManager) {
      await memoryManager.saveMessages(savedConversationId, recentMessages);
    }

    processMemoryAsync(savedConversationId, [userMessage, aiMessage], userId).catch(error => {
      console.error('[aiController] Long-term memory processing error:', error.message);
    });

    writeSse(res, {
      type: 'done',
      conversationId: savedConversationId,
      sources: retrieval.sources
    });
    if (!res.writableEnded) {
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } catch (error) {
    if (abortController.signal.aborted) return;
    console.error('[aiController] Chat error:', error);
    writeSse(res, { error: 'AI service is temporarily unavailable' });
    if (!res.writableEnded) {
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
};

async function retrieveContexts(userQuery, context) {
  let knowledgeResult = null;
  let knowledgeContext = null;
  let webSearchContext = null;
  const sources = [];

  if (!userQuery || !queryRouter.shouldUseRAG(userQuery)) {
    return { knowledgeContext, webSearchContext, sources };
  }

  const knowledgeTool = toolRegistry.getTool('knowledge_search');
  knowledgeResult = await knowledgeTool.execute(
    { query: queryRouter.extractSearchQuery(userQuery), limit: 3 },
    context
  );

  if (knowledgeResult.success && knowledgeResult.knowledge?.length) {
    knowledgeContext = knowledgeResult.knowledge.map((item, index) =>
      `[Knowledge ${index + 1}] ${item.title} - ${item.section}\n${item.content}`
    ).join('\n\n');

    sources.push(...knowledgeResult.knowledge.map(item => ({
      type: 'knowledge',
      title: item.title,
      section: item.section,
      score: getKnowledgeScore(item)
    })));
  }

  const webSearchTool = toolRegistry.getTool('web_search');
  if (!webSearchDecisionMaker || !webSearchTool?.isConfigured() || context.signal?.aborted) {
    return { knowledgeResult, knowledgeContext, webSearchContext, sources };
  }

  const decision = await webSearchDecisionMaker.decide(userQuery, knowledgeResult);
  if (!decision.needsWebSearch) {
    return { knowledgeResult, knowledgeContext, webSearchContext, sources };
  }

  const webResult = await webSearchTool.execute(
    { query: userQuery, num_results: 3 },
    context
  );

  if (webResult.success && webResult.results?.length) {
    webSearchContext = webResult.results.map((item, index) =>
      `[Web ${index + 1}] ${item.title}\n${item.snippet}\nSource: ${item.source} | URL: ${item.url}`
    ).join('\n\n');

    sources.push(...webResult.results.map(item => ({
      type: 'web',
      title: item.title,
      url: item.url,
      source: item.source
    })));
  }

  return { knowledgeResult, knowledgeContext, webSearchContext, sources };
}

function getIncomingUserMessage(body) {
  if (body.message !== undefined) {
    if (typeof body.message === 'string') {
      return { role: 'user', content: body.message };
    }
    if (body.message && typeof body.message === 'object') {
      return { role: 'user', content: body.message.content };
    }
  }

  if (Array.isArray(body.messages)) {
    const lastUserMessage = [...body.messages].reverse().find(message => message?.role === 'user');
    if (lastUserMessage) return { role: 'user', content: lastUserMessage.content };
  }

  const error = new Error('A user message is required');
  error.statusCode = 400;
  throw error;
}

function validateUserMessage(message) {
  const { content } = message || {};

  if (typeof content === 'string') {
    if (!content.trim()) throw new Error('Message content cannot be empty');
    if (content.length > MAX_TEXT_LENGTH) throw new Error('Message content is too long');
    return;
  }

  if (!Array.isArray(content) || content.length === 0) {
    throw new Error('Unsupported message content');
  }
  if (content.length > MAX_MEDIA_ITEMS + 1) {
    throw new Error('Too many message attachments');
  }

  let hasContent = false;
  for (const item of content) {
    if (item?.type === 'text') {
      if (typeof item.text !== 'string' || item.text.length > MAX_TEXT_LENGTH) {
        throw new Error('Invalid text content');
      }
      hasContent ||= Boolean(item.text.trim());
      continue;
    }

    if (item?.type === 'image_url' && typeof item.image_url?.url === 'string') {
      hasContent = true;
      continue;
    }

    if (item?.type === 'video_url' && typeof item.video_url?.url === 'string') {
      hasContent = true;
      continue;
    }

    throw new Error('Unsupported message attachment');
  }

  if (!hasContent) throw new Error('Message content cannot be empty');
}

function getTextContent(content) {
  if (typeof content === 'string') return content.trim();
  const text = content.find(item => item?.type === 'text')?.text;
  return typeof text === 'string' ? text.trim() : '';
}

function toStoredMessage(message) {
  const isMultimedia = Array.isArray(message.content);
  return {
    role: message.role,
    content: getTextContent(message.content) || (isMultimedia ? '[Multimedia message]' : ''),
    timestamp: new Date()
  };
}

function createConversationTitle(message) {
  const text = getTextContent(message.content);
  return (text || 'Image conversation').slice(0, 30);
}

function detectMultimedia(message) {
  return Array.isArray(message?.content) && message.content.some(item =>
    item?.type === 'image_url' || item?.type === 'video_url'
  );
}

function getKnowledgeScore(item) {
  const value = item?.score ?? item?.relevance ?? 0;
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function writeSse(res, payload) {
  if (!res.writableEnded && !res.destroyed) {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }
}

exports.evaluateRAGSufficiency = function evaluateRAGSufficiency(knowledgeResult, userQuery) {
  if (!knowledgeResult?.success || !knowledgeResult.knowledge?.length) {
    return { level: 'insufficient', reason: 'No knowledge retrieved from RAG' };
  }

  const knowledge = knowledgeResult.knowledge;
  const avgScore = knowledge.reduce((sum, item) => sum + getKnowledgeScore(item), 0) / knowledge.length;
  const totalLength = knowledge.reduce((sum, item) => sum + (item.content?.length || 0), 0);
  const timeKeywords = ['最新', '新政策', '近期', '今年', '最近', String(new Date().getFullYear())];

  if (timeKeywords.some(keyword => userQuery.includes(keyword))) {
    return { level: 'insufficient', reason: 'Query requires current information' };
  }
  if (knowledge.length < 2 || avgScore < 0.5 || totalLength < 100) {
    return { level: 'insufficient', reason: `RAG quality is low (score: ${avgScore.toFixed(2)})` };
  }
  return { level: 'sufficient', reason: `${knowledge.length} items with score ${avgScore.toFixed(2)}` };
};

exports._private = {
  getIncomingUserMessage,
  validateUserMessage,
  getTextContent,
  getKnowledgeScore,
  detectMultimedia
};
