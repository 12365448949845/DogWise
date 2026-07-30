const test = require('node:test');
const assert = require('node:assert/strict');

process.env.ALIYUN_API_KEY ||= 'test-key';
process.env.ALIYUN_BASE_URL ||= 'http://localhost.invalid/v1';
delete process.env.SEARCH_ENGINE;

const { deterministicPointId } = require('../src/ai/utils/pointId');
const { mergeDogProfiles, containsProfileSignal } = require('../src/ai/services/MemoryProcessingService');
const SemanticMemoryFilter = require('../src/ai/memory/SemanticMemoryFilter');
const SemanticChunker = require('../src/ai/memory/SemanticChunker');
const { articleToChunks } = require('../src/ai/knowledge/MongoKnowledgeSync');
const KnowledgeVectorManager = require('../src/ai/knowledge/KnowledgeVectorManager');
const WebSearchTool = require('../src/ai/tools/search/WebSearchTool');
const WebSearchDecisionMaker = require('../src/ai/decision/WebSearchDecisionMaker');
const DogRecipeRecommendTool = require('../src/ai/tools/recipe/DogRecipeRecommendTool');
const MultiModalAgent = require('../src/ai/agents/MultiModalAgent');

test('deterministicPointId returns stable Qdrant-compatible UUIDs', () => {
  const first = deterministicPointId('conversation:turn');
  const second = deterministicPointId('conversation:turn');
  assert.equal(first, second);
  assert.match(first, /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
  assert.notEqual(first, deterministicPointId('another-turn'));
});

test('dog profile updates merge without erasing prior fields', () => {
  const merged = mergeDogProfiles(
    {
      dogs: [{ name: '旺财', breed: '金毛', allergies: ['牛肉'] }],
      preferences: { interestedTopics: ['训练'] }
    },
    {
      dogs: [{ name: '旺财', weight: 25, allergies: ['鸡肉'] }],
      preferences: { interestedTopics: ['饮食'] }
    }
  );

  assert.equal(merged.dogs[0].breed, '金毛');
  assert.equal(merged.dogs[0].weight, 25);
  assert.deepEqual(merged.dogs[0].allergies, ['牛肉', '鸡肉']);
  assert.deepEqual(merged.preferences.interestedTopics, ['训练', '饮食']);
  assert.equal(containsProfileSignal([{ role: 'user', content: '旺财体重25公斤' }]), true);
});

test('semantic memory stores a relevant user turn with its answer idempotently', async () => {
  const messages = [
    { role: 'user', content: '我家金毛一直喜欢用响片训练，而且每天都会练习十分钟。' },
    { role: 'assistant', content: '可以继续保持短时、高频、正向强化的训练方式。' }
  ];
  const filtered = new SemanticMemoryFilter().filter(messages);
  assert.equal(filtered.length, 2);

  const chunker = new SemanticChunker();
  const first = await chunker.chunk(filtered, { conversationId: 'conv-1', userId: 'user-1' });
  const second = await chunker.chunk(filtered, { conversationId: 'conv-1', userId: 'user-1' });
  assert.match(first[0].content, /助手:/);
  assert.equal(first[0].id, second[0].id);
});

test('Mongo knowledge articles are split into vector-ready chunks', () => {
  const chunks = articleToChunks({
    _id: 'article-1',
    title: '幼犬护理',
    content: '## 洗澡\n幼犬完成免疫前应注意保暖。\n\n## 喂养\n根据主粮热量密度喂养。',
    category: 'daily',
    tags: ['幼犬'],
    status: 'published'
  });

  assert.equal(chunks.length, 2);
  assert.equal(chunks[0].metadata.documentId, 'mongo:article-1');
  assert.match(chunks[0].content, /免疫/);
});

test('batch knowledge storage pairs each chunk with its embedding', async () => {
  const manager = new KnowledgeVectorManager();
  const chunks = [
    { content: 'first', summary: 'one', metadata: { documentId: 'doc', chunkIndex: 0 } },
    { content: 'second', summary: 'two', metadata: { documentId: 'doc', chunkIndex: 1 } }
  ];
  const embeddings = [[1, 0], [0, 1]];
  let saved;

  manager.embeddingService = {
    generateBatchEmbeddings: async texts => {
      assert.equal(texts.length, 2);
      return embeddings;
    }
  };
  manager.client = {
    upsert: async (collection, payload) => {
      saved = { collection, ...payload };
    }
  };

  await manager.saveBatchKnowledge(chunks);

  assert.equal(saved.collection, 'knowledge_base');
  assert.deepEqual(saved.points.map(point => point.vector), embeddings);
  assert.notEqual(saved.points[0].id, saved.points[1].id);
});

test('web search is disabled instead of returning mock results', async () => {
  const tool = new WebSearchTool();
  const result = await tool.execute({ query: '最新疫苗政策' }, { userId: 'user-1' });
  assert.equal(tool.isConfigured(), false);
  assert.equal(result.success, false);
  assert.deepEqual(result.results, []);
});

test('web decision accepts relevance as the RAG score', () => {
  const decisionMaker = new WebSearchDecisionMaker('test-key', 'http://localhost.invalid/v1');
  const result = decisionMaker.applyHardRules('金毛饮食', {
    success: true,
    knowledge: [
      { relevance: 0.9, content: 'a'.repeat(200) },
      { relevance: 0.9, content: 'b'.repeat(200) }
    ]
  });
  assert.equal(result.decision, 'no_search');
});

test('recipe portions avoid unverified body-weight percentages', () => {
  const guide = new DogRecipeRecommendTool().getPortionGuide({ weight: '15kg', age: '成犬' });
  assert.match(guide, /10%/);
  assert.doesNotMatch(guide, /每餐|体重的/);
});

test('multimodal agent rejects local files outside uploads', async () => {
  const agent = new MultiModalAgent('test-key', 'http://localhost.invalid/v1');
  await assert.rejects(
    agent.convertLocalImageToBase64('http://localhost/.env'),
    /uploads directory/
  );
});
