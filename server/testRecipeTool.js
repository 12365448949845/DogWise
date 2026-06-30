const DogRecipeRecommendTool = require('./src/ai/tools/recipe/DogRecipeRecommendTool');

/**
 * 测试狗狗菜品推荐工具
 */
async function testRecipeTool() {
  console.log('========== Dog Recipe Recommend Tool Test ==========\n');

  const tool = new DogRecipeRecommendTool();

  // 测试 1: 完整食材组合
  console.log('📝 Test 1: 完整食材组合（蛋白质 + 碳水 + 蔬菜）\n');
  const result1 = await tool.execute({
    ingredients: ['鸡胸肉', '红薯', '胡萝卜', '西兰花'],
    dogInfo: {
      breed: '金毛',
      age: '成犬',
      weight: '中型犬（25kg）'
    }
  }, {});

  console.log('结果：', JSON.stringify(result1, null, 2));
  console.log('\n========================================\n');

  // 测试 2: 包含危险食材
  console.log('📝 Test 2: 包含危险食材\n');
  const result2 = await tool.execute({
    ingredients: ['鸡肉', '巧克力', '胡萝卜', '葡萄'],
    dogInfo: {}
  }, {});

  console.log('结果：', JSON.stringify(result2, null, 2));
  console.log('\n========================================\n');

  // 测试 3: 简单食材组合
  console.log('📝 Test 3: 简单食材组合（蛋白质 + 碳水）\n');
  const result3 = await tool.execute({
    ingredients: ['牛肉', '南瓜'],
    dogInfo: {
      age: '幼犬'
    }
  }, {});

  console.log('结果：', JSON.stringify(result3, null, 2));
  console.log('\n========================================');
  console.log('🎉 所有测试完成！');
}

testRecipeTool().catch(err => {
  console.error('❌ 测试失败:', err);
  process.exit(1);
});
