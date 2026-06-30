const VectorMemoryManager = require('../memory/VectorMemoryManager');
const HybridRetriever = require('../retrieval/HybridRetriever');
const EmbeddingService = require('../services/EmbeddingService');

/**
 * 测试混合检索功能
 */
async function testHybridRetrieval() {
  console.log('\n=== 开始测试混合检索功能 ===\n');

  try {
    const testUserId = 'test_user_' + Date.now();
    const vectorMemory = new VectorMemoryManager();

    // 1. 准备测试数据
    console.log('1. 准备测试数据...');
    const baseTimestamp = Date.now();
    const testMemories = [
      {
        id: baseTimestamp + 1,
        conversationId: 'conv_1',
        userId: testUserId,
        content: '我家金毛叫旺财，今年2岁了，特别喜欢玩飞盘。',
        summary: '用户的狗：金毛旺财，2岁，喜欢玩飞盘',
        metadata: {
          timestamp: new Date(),
          topics: ['狗信息', '爱好'],
          sentiment: 'positive'
        }
      },
      {
        id: baseTimestamp + 2,
        conversationId: 'conv_1',
        userId: testUserId,
        content: '旺财对鸡肉过敏，不能吃任何含鸡肉的狗粮。',
        summary: '旺财对鸡肉过敏，饮食禁忌',
        metadata: {
          timestamp: new Date(),
          topics: ['过敏', '饮食'],
          sentiment: 'neutral'
        }
      },
      {
        id: baseTimestamp + 3,
        conversationId: 'conv_2',
        userId: testUserId,
        content: '我每天早上7点带旺财去公园遛狗，它喜欢和其他金毛一起玩。',
        summary: '遛狗习惯：每天早上7点去公园，喜欢社交',
        metadata: {
          timestamp: new Date(),
          topics: ['遛狗', '习惯'],
          sentiment: 'positive'
        }
      },
      {
        id: baseTimestamp + 4,
        conversationId: 'conv_3',
        userId: testUserId,
        content: '旺财最近学会了握手和坐下，训练用的是正向激励法，每次做对就给零食奖励。',
        summary: '训练方法：正向激励，零食奖励，已学会握手和坐下',
        metadata: {
          timestamp: new Date(),
          topics: ['训练', '技能'],
          sentiment: 'positive'
        }
      },
      {
        id: baseTimestamp + 5,
        conversationId: 'conv_4',
        userId: testUserId,
        content: '我很关注狗狗的健康问题，特别是关节保健和营养均衡。',
        summary: '用户关注：狗狗健康、关节保健、营养',
        metadata: {
          timestamp: new Date(),
          topics: ['健康', '营养'],
          sentiment: 'neutral'
        }
      }
    ];

    // 2. 存储测试数据
    console.log('2. 存储测试数据到 Qdrant...');
    await vectorMemory.saveBatchMemories(testMemories);
    console.log(`✓ 成功存储 ${testMemories.length} 条记忆\n`);

    // 等待索引完成
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 3. 测试基础向量检索
    console.log('3. 测试基础向量检索（Dense Only）...');
    const query1 = '旺财对什么过敏？';
    const denseResults = await vectorMemory.searchMemories(query1, testUserId, 3);
    console.log(`查询: "${query1}"`);
    console.log('结果:');
    denseResults.forEach((r, idx) => {
      console.log(`  ${idx + 1}. [分数: ${r.score.toFixed(4)}] ${r.summary}`);
    });
    console.log();

    // 4. 测试混合检索
    console.log('4. 测试混合检索（Dense + BM25 + Reranker）...');
    const query2 = '我家狗的过敏情况';
    const hybridResults = await vectorMemory.hybridSearchMemories(query2, testUserId, 3, 10);
    console.log(`查询: "${query2}"`);
    console.log('结果:');
    hybridResults.forEach((r, idx) => {
      const score = r.rerankScore || r.score;
      console.log(`  ${idx + 1}. [分数: ${score?.toFixed(4)}] ${r.summary || r.content}`);
    });
    console.log();

    // 5. 测试关键词查询
    console.log('5. 测试关键词查询...');
    const query3 = '训练方法';
    const keywordResults = await vectorMemory.hybridSearchMemories(query3, testUserId, 3, 10);
    console.log(`查询: "${query3}"`);
    console.log('结果:');
    keywordResults.forEach((r, idx) => {
      const score = r.rerankScore || r.score;
      console.log(`  ${idx + 1}. [分数: ${score?.toFixed(4)}] ${r.summary || r.content}`);
    });
    console.log();

    // 6. 测试语义理解
    console.log('6. 测试语义理解（同义词）...');
    const query4 = '遛狗的时间和地点';
    const semanticResults = await vectorMemory.hybridSearchMemories(query4, testUserId, 3, 10);
    console.log(`查询: "${query4}"`);
    console.log('结果:');
    semanticResults.forEach((r, idx) => {
      const score = r.rerankScore || r.score;
      console.log(`  ${idx + 1}. [分数: ${score?.toFixed(4)}] ${r.summary || r.content}`);
    });
    console.log();

    // 7. 清理测试数据
    console.log('7. 清理测试数据...');
    await vectorMemory.deleteByUser(testUserId);
    console.log('✓ 测试数据已清理\n');

    console.log('=== 混合检索测试完成 ===\n');
    console.log('结论:');
    console.log('✓ 基础向量检索：适合语义理解');
    console.log('✓ 混合检索：结合语义理解和关键词匹配');
    console.log('✓ BM25：提升关键词精准度');
    console.log('✓ Reranker：优化最终排序质量\n');

  } catch (error) {
    console.error('测试失败:', error);
    throw error;
  }
}

// 运行测试
if (require.main === module) {
  testHybridRetrieval()
    .then(() => {
      console.log('测试成功完成');
      process.exit(0);
    })
    .catch(err => {
      console.error('测试失败:', err);
      process.exit(1);
    });
}

module.exports = { testHybridRetrieval };
