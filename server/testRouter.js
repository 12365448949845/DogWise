const QueryRouter = require('./src/ai/router/QueryRouter');

const router = new QueryRouter();

const testQueries = [
  '怎么训练狗狗坐下',
  '金毛幼犬拉肚子怎么办',
  '狗狗不听指令怎么办',
  '你好',
  '谢谢'
];

console.log('========== Router 测试 ==========\n');

testQueries.forEach(query => {
  const shouldUseRAG = router.shouldUseRAG(query);
  const searchQuery = router.extractSearchQuery(query);

  console.log(`查询: "${query}"`);
  console.log(`  触发 RAG: ${shouldUseRAG ? '✅ 是' : '❌ 否'}`);
  console.log(`  提取查询: "${searchQuery}"`);
  console.log('');
});
