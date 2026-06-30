const WebSearchDecisionMaker = require('./src/ai/decision/WebSearchDecisionMaker');

// 从环境变量读取配置
require('dotenv').config();
const ALIYUN_API_KEY = process.env.ALIYUN_API_KEY;
const ALIYUN_BASE_URL = process.env.ALIYUN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';

/**
 * 测试混合决策器
 */
async function testDecisionMaker() {
  console.log('========== Web Search Decision Maker Test ==========\n');

  const decisionMaker = new WebSearchDecisionMaker(ALIYUN_API_KEY, ALIYUN_BASE_URL);

  // 测试 1: 硬规则 - 无检索结果（必须搜索）
  console.log('📝 Test 1: 硬规则 - 无检索结果（必须搜索）\n');
  const result1 = await decisionMaker.decide(
    '稀有犬种 XYZ 的饲养指南',
    { success: true, knowledge: [] }
  );
  console.log('结果：', result1);
  console.log('\n========================================\n');

  // 测试 2: 硬规则 - RAG 分数极低（必须搜索）
  console.log('📝 Test 2: 硬规则 - RAG 分数极低（必须搜索）\n');
  const result2 = await decisionMaker.decide(
    '柯基犬饲养指南',
    {
      success: true,
      knowledge: [
        { title: '泰迪美容', content: '泰迪需要定期修剪...', score: 0.25 },
        { title: '哈士奇训练', content: '哈士奇很活泼...', score: 0.28 }
      ]
    }
  );
  console.log('结果：', result2);
  console.log('\n========================================\n');

  // 测试 3: 硬规则 - 时效性需求（必须搜索）
  console.log('📝 Test 3: 硬规则 - 时效性需求（必须搜索）\n');
  const result3 = await decisionMaker.decide(
    '2024年最新宠物狗疫苗政策',
    {
      success: true,
      knowledge: [
        { title: '疫苗指南', content: '狗狗需要接种狂犬病疫苗...', score: 0.75 },
        { title: '接种时间', content: '幼犬6-8周开始接种...', score: 0.70 }
      ]
    }
  );
  console.log('结果：', result3);
  console.log('\n========================================\n');

  // 测试 4: 硬规则 - RAG 充分（不需要搜索）
  console.log('📝 Test 4: 硬规则 - RAG 充分（不需要搜索）\n');
  const result4 = await decisionMaker.decide(
    '金毛犬怎么养',
    {
      success: true,
      knowledge: [
        { title: '金毛饮食指南', content: '金毛犬作为大型犬，需要高蛋白、适量脂肪的饮食。成年金毛每日需要约1500-2000卡路里，幼犬需要更高的营养密度。优质的狗粮应该包含肉类作为主要蛋白质来源，配合适量的碳水化合物和脂肪。建议选择大型犬专用粮，避免过度喂食导致肥胖。每日应分2-3次喂食，保证充足的饮水。', score: 0.88 },
        { title: '金毛健康管理', content: '金毛犬需要定期梳毛，每周至少2-3次，以防止毛发打结。同时要注意定期清洁耳朵，预防耳道感染。金毛容易患髋关节疾病，应控制体重，避免过度运动。定期体检包括疫苗接种、驱虫、血液检查等。注意观察狗狗的精神状态和食欲变化。', score: 0.85 },
        { title: '金毛训练技巧', content: '金毛犬聪明且易训练，建议从幼犬期开始基础服从训练。使用正向强化法效果最好，结合食物奖励和口头表扬。注意训练时间不宜过长，每次10-15分钟为宜。可以教授坐、卧、握手等基础指令，逐步增加难度。金毛天性温顺，适合作为家庭伴侣犬。', score: 0.82 }
      ]
    }
  );
  console.log('结果：', result4);
  console.log('\n========================================\n');

  // 测试 5: LLM 判断 - 规则不确定的情况
  console.log('📝 Test 5: LLM 判断 - 规则不确定的情况\n');
  const result5 = await decisionMaker.decide(
    '泰迪犬的性格特点',
    {
      success: true,
      knowledge: [
        { title: '泰迪品种介绍', content: '泰迪是贵宾犬的一种美容造型，体型小巧，活泼好动...', score: 0.65 },
        { title: '泰迪毛发护理', content: '泰迪的卷毛需要定期修剪和打理...', score: 0.60 }
      ]
    }
  );
  console.log('结果：', result5);
  console.log('\n========================================\n');

  console.log('🎉 所有测试完成！\n');
  console.log('📊 测试总结：');
  console.log(`- Test 1 (无检索结果): ${result1.needsWebSearch && result1.decisionLayer === 'rule' ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`- Test 2 (分数极低): ${result2.needsWebSearch && result2.decisionLayer === 'rule' ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`- Test 3 (时效性): ${result3.needsWebSearch && result3.decisionLayer === 'rule' ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`- Test 4 (RAG充分): ${!result4.needsWebSearch && result4.decisionLayer === 'rule' ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`- Test 5 (LLM判断): ${result5.decisionLayer === 'llm' ? '✅ PASS' : '❌ FAIL'}`);

  process.exit(0);
}

testDecisionMaker().catch(err => {
  console.error('❌ 测试失败:', err);
  process.exit(1);
});
