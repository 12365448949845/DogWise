const StructuredInfoExtractTool = require('../tools/memory/StructuredInfoExtractTool');
const SemanticMemoryFilter = require('../memory/SemanticMemoryFilter');
const SemanticChunker = require('../memory/SemanticChunker');
const VectorMemoryManager = require('../memory/VectorMemoryManager');
const User = require('../../models/User');

/**
 * MemoryProcessingService - 记忆处理服务
 * 异步处理对话记忆（不阻塞用户响应）
 */

/**
 * 异步处理记忆
 * @param {string} conversationId - 对话 ID
 * @param {Array} messages - 消息数组 [{ role, content, timestamp }]
 * @param {string} userId - 用户 ID
 */
async function processMemoryAsync(conversationId, messages, userId) {
  console.log(`[MemoryProcessing] Starting memory processing for conversation: ${conversationId}`);

  try {
    // 1. 提取结构化信息
    await extractAndSaveStructuredInfo(messages, userId);

    // 2. 处理语义记忆
    await processSemanticMemory(conversationId, messages, userId);

    console.log('[MemoryProcessing] Memory processing completed successfully');
  } catch (error) {
    console.error('[MemoryProcessing] Error during memory processing:', error);
    // 不抛出错误，避免影响主流程
  }
}

/**
 * 提取并保存结构化信息
 */
async function extractAndSaveStructuredInfo(messages, userId) {
  try {
    const structuredTool = new StructuredInfoExtractTool();
    const structuredData = await structuredTool.execute({ messages }, { userId });

    if (structuredData && Object.keys(structuredData).length > 0) {
      // 更新 User 模型的 dogProfile
      await User.findByIdAndUpdate(
        userId,
        {
          $set: { dogProfile: structuredData }
        },
        { new: true, upsert: false }
      );

      console.log('[MemoryProcessing] Updated structured data for user:', userId);
      console.log('[MemoryProcessing] Structured data:', JSON.stringify(structuredData, null, 2));
    } else {
      console.log('[MemoryProcessing] No structured data extracted');
    }
  } catch (error) {
    console.error('[MemoryProcessing] Error extracting structured info:', error);
  }
}

/**
 * 处理语义记忆
 */
async function processSemanticMemory(conversationId, messages, userId) {
  try {
    // 1. 过滤语义记忆
    const filter = new SemanticMemoryFilter();
    const semanticMessages = filter.filter(messages);

    if (!semanticMessages || semanticMessages.length === 0) {
      console.log('[MemoryProcessing] No semantic content to store');
      return;
    }

    console.log(`[MemoryProcessing] Filtered ${semanticMessages.length} messages for semantic storage`);

    // 2. 切块
    const chunker = new SemanticChunker();
    const chunks = await chunker.chunk(semanticMessages, {
      conversationId,
      userId
    });

    if (!chunks || chunks.length === 0) {
      console.log('[MemoryProcessing] No chunks created');
      return;
    }

    console.log(`[MemoryProcessing] Created ${chunks.length} chunks`);

    // 3. 存入向量数据库
    const vectorMemory = new VectorMemoryManager();
    await vectorMemory.saveBatchMemories(chunks);

    console.log(`[MemoryProcessing] Saved ${chunks.length} chunks to vector DB`);
  } catch (error) {
    console.error('[MemoryProcessing] Error processing semantic memory:', error);
  }
}

module.exports = {
  processMemoryAsync
};
