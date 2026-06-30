const { QdrantClient } = require('@qdrant/js-client-rest');

let qdrantClient = null;

/**
 * 获取 Qdrant 客户端单例
 */
function getQdrantClient() {
  if (!qdrantClient) {
    const url = process.env.QDRANT_URL || 'http://localhost:6333';
    const apiKey = process.env.QDRANT_API_KEY;

    qdrantClient = new QdrantClient({
      url: url,
      ...(apiKey && { apiKey: apiKey })
    });

    console.log(`[Qdrant] Initialized client with URL: ${url}`);
  }

  return qdrantClient;
}

/**
 * 初始化 collections（semantic_memory 和 knowledge_base）
 */
async function initializeCollection() {
  const client = getQdrantClient();

  try {
    // 获取所有已存在的 collections
    const collections = await client.getCollections();
    const existingNames = collections.collections.map(c => c.name);

    // 初始化 semantic_memory collection
    if (!existingNames.includes('semantic_memory')) {
      await client.createCollection('semantic_memory', {
        vectors: {
          size: 1024,  // Qwen3-Embedding text-embedding-v3 维度
          distance: 'Cosine'
        },
        optimizers_config: {
          indexing_threshold: 20000
        }
      });
      console.log('[Qdrant] Created collection: semantic_memory');
    } else {
      console.log('[Qdrant] Collection already exists: semantic_memory');
    }

    // 初始化 knowledge_base collection
    if (!existingNames.includes('knowledge_base')) {
      await client.createCollection('knowledge_base', {
        vectors: {
          size: 1024,
          distance: 'Cosine'
        },
        optimizers_config: {
          indexing_threshold: 20000
        }
      });
      console.log('[Qdrant] Created collection: knowledge_base');
    } else {
      console.log('[Qdrant] Collection already exists: knowledge_base');
    }
  } catch (error) {
    console.error('[Qdrant] Error initializing collections:', error);
    throw error;
  }
}

/**
 * 关闭 Qdrant 连接（如果需要）
 */
async function closeQdrant() {
  if (qdrantClient) {
    qdrantClient = null;
    console.log('[Qdrant] Connection closed');
  }
}

module.exports = {
  getQdrantClient,
  initializeCollection,
  closeQdrant
};
