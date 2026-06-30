const WebSearchTool = require('./src/ai/tools/search/WebSearchTool');

/**
 * 测试 Web Search Tool
 */
async function testWebSearch() {
  console.log('========== Web Search Tool Test ==========\n');

  const tool = new WebSearchTool();

  // 测试 1: 基本搜索
  console.log('📝 Test 1: 基本搜索\n');
  const result1 = await tool.execute({
    query: '狗狗疫苗接种注意事项',
    num_results: 3
  }, {
    userId: 'test_user',
    conversationId: 'test_conv_1'
  });

  console.log('结果：', JSON.stringify(result1, null, 2));
  console.log('\n========================================\n');

  // 测试 2: 时效性问题
  console.log('📝 Test 2: 时效性问题\n');
  const result2 = await tool.execute({
    query: '2024年宠物狗最新政策',
    num_results: 3
  }, {
    userId: 'test_user',
    conversationId: 'test_conv_2'
  });

  console.log('结果：', JSON.stringify(result2, null, 2));
  console.log('\n========================================\n');

  // 测试 3: 空查询
  console.log('📝 Test 3: 空查询（应该报错）\n');
  const result3 = await tool.execute({
    query: '',
    num_results: 3
  }, {
    userId: 'test_user'
  });

  console.log('结果：', JSON.stringify(result3, null, 2));
  console.log('\n========================================');
  console.log('🎉 所有测试完成！');
}

testWebSearch().catch(err => {
  console.error('❌ 测试失败:', err);
  process.exit(1);
});
