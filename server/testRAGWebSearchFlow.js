const { evaluateRAGSufficiency } = require('./src/controllers/aiController');

/**
 * 测试 RAG 充分性评估逻辑
 */
function testRAGSufficiency() {
  console.log('========== RAG Sufficiency Evaluation Test ==========\n');

  // 测试 1: 充分的 RAG 结果
  console.log('📝 Test 1: 充分的 RAG 结果\n');
  const result1 = {
    success: true,
    knowledge: [
      { title: '金毛饮食指南', section: '营养需求', content: '金毛犬作为大型犬，需要高蛋白、适量脂肪的饮食。成年金毛每日需要约1500-2000卡路里，幼犬需要更高的营养密度。优质的狗粮应该包含肉类作为主要蛋白质来源...', score: 0.85 },
      { title: '金毛健康管理', section: '日常护理', content: '金毛犬需要定期梳毛，每周至少2-3次，以防止毛发打结。同时要注意定期清洁耳朵，预防耳道感染。金毛容易患髋关节疾病，应控制体重...', score: 0.78 },
      { title: '金毛训练技巧', section: '基础训练', content: '金毛犬聪明且易训练，建议从幼犬期开始基础服从训练。使用正向强化法效果最好，结合食物奖励和口头表扬...', score: 0.72 }
    ]
  };
  const query1 = '金毛犬怎么养';
  const sufficiency1 = evaluateRAGSufficiency(result1, query1);
  console.log('结果：', sufficiency1);
  console.log('\n========================================\n');

  // 测试 2: 不充分 - 结果太少
  console.log('📝 Test 2: 不充分 - 结果太少\n');
  const result2 = {
    success: true,
    knowledge: [
      { title: '柯基简介', section: '品种特点', content: '柯基犬是小型犬', score: 0.65 }
    ]
  };
  const query2 = '柯基犬饲养指南';
  const sufficiency2 = evaluateRAGSufficiency(result2, query2);
  console.log('结果：', sufficiency2);
  console.log('\n========================================\n');

  // 测试 3: 不充分 - 相关性低
  console.log('📝 Test 3: 不充分 - 相关性低\n');
  const result3 = {
    success: true,
    knowledge: [
      { title: '泰迪美容', section: '修剪技巧', content: '泰迪犬的毛发需要定期修剪...', score: 0.35 },
      { title: '泰迪训练', section: '行为矫正', content: '泰迪犬容易吠叫...', score: 0.42 }
    ]
  };
  const query3 = '泰迪犬健康问题';
  const sufficiency3 = evaluateRAGSufficiency(result3, query3);
  console.log('结果：', sufficiency3);
  console.log('\n========================================\n');

  // 测试 4: 不充分 - 需要最新信息
  console.log('📝 Test 4: 不充分 - 需要最新信息\n');
  const result4 = {
    success: true,
    knowledge: [
      { title: '狗狗疫苗指南', section: '疫苗种类', content: '狗狗需要接种狂犬病疫苗、犬瘟热疫苗等...', score: 0.80 },
      { title: '疫苗接种时间', section: '接种周期', content: '幼犬通常在6-8周开始接种第一针...', score: 0.75 }
    ]
  };
  const query4 = '2024年最新狗狗疫苗政策';
  const sufficiency4 = evaluateRAGSufficiency(result4, query4);
  console.log('结果：', sufficiency4);
  console.log('\n========================================\n');

  // 测试 5: 不充分 - 内容太短
  console.log('📝 Test 5: 不充分 - 内容太短\n');
  const result5 = {
    success: true,
    knowledge: [
      { title: '哈士奇特点', section: '性格', content: '活泼好动', score: 0.70 },
      { title: '哈士奇外形', section: '外观', content: '蓝眼睛', score: 0.68 }
    ]
  };
  const query5 = '哈士奇完整饲养指南';
  const sufficiency5 = evaluateRAGSufficiency(result5, query5);
  console.log('结果：', sufficiency5);
  console.log('\n========================================\n');

  // 测试 6: 不充分 - 没有检索到任何知识
  console.log('📝 Test 6: 不充分 - 没有检索到任何知识\n');
  const result6 = {
    success: true,
    knowledge: []
  };
  const query6 = '某超稀有犬种';
  const sufficiency6 = evaluateRAGSufficiency(result6, query6);
  console.log('结果：', sufficiency6);
  console.log('\n========================================\n');

  console.log('🎉 所有测试完成！\n');
  console.log('📊 测试总结：');
  console.log(`- Test 1 (充分): ${sufficiency1.level === 'sufficient' ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`- Test 2 (结果太少): ${sufficiency2.level === 'insufficient' ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`- Test 3 (相关性低): ${sufficiency3.level === 'insufficient' ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`- Test 4 (需要最新信息): ${sufficiency4.level === 'insufficient' ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`- Test 5 (内容太短): ${sufficiency5.level === 'insufficient' ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`- Test 6 (无结果): ${sufficiency6.level === 'insufficient' ? '✅ PASS' : '❌ FAIL'}`);
}

testRAGSufficiency();
