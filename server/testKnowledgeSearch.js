const EmbeddingService = require('./src/ai/services/EmbeddingService');
const { getQdrantClient } = require('./src/config/qdrant');
require('dotenv').config();

async function testSearch() {
  try {
    const embeddingService = new EmbeddingService();
    const qdrantClient = getQdrantClient();

    // 测试查询
    const queries = [
      '狗狗不听指令怎么办',
      '金毛可以吃鸡蛋吗',
      '幼犬拉肚子',
      '训练狗狗坐下'
    ];

    for (const query of queries) {
      console.log(`\n========== 查询: "${query}" ==========`);

      // 生成向量
      const queryVector = await embeddingService.generateEmbedding(query);
      console.log(`向量维度: ${queryVector.length}`);

      // 向量检索
      const results = await qdrantClient.search('knowledge_base', {
        vector: queryVector,
        limit: 3,
        with_payload: true
      });

      console.log(`检索结果数量: ${results.length}`);
      results.forEach((hit, idx) => {
        console.log(`\n[结果 ${idx + 1}] 相似度: ${hit.score.toFixed(4)}`);
        console.log(`标题: ${hit.payload.metadata.documentTitle}`);
        console.log(`章节: ${hit.payload.metadata.section}`);
        console.log(`内容片段: ${hit.payload.content.slice(0, 100)}...`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('测试失败:', error);
    process.exit(1);
  }
}

testSearch();
